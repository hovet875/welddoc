import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RENDER_STORAGE_KEY = "welddoc:document-package-render";
const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json"],
  [".ico", "image/x-icon"],
]);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

function readConfig() {
  return {
    supabaseUrl: requireEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    pollMs: Number(process.env.WELDDOC_POLL_MS || "5000"),
    jobLimit: Number(process.env.WELDDOC_JOB_LIMIT || "3"),
    heartbeatMs: Number(process.env.WELDDOC_HEARTBEAT_MS || "10000"),
    staleJobTimeoutMs: Number(process.env.WELDDOC_STALE_JOB_TIMEOUT_MS || "900000"),
    distDir: path.resolve(__dirname, "..", "..", process.env.WELDDOC_DIST_DIR || "dist"),
    staticPort: Number(process.env.WELDDOC_STATIC_PORT || "4173"),
    workerRef: process.env.WELDDOC_WORKER_ID || `nas-worker-${process.pid}`,
    artifactBucket: process.env.WELDDOC_ARTIFACT_BUCKET || "files",
    artifactPrefix: process.env.WELDDOC_ARTIFACT_PREFIX || "document-package-artifacts",
    headless: process.env.WELDDOC_HEADLESS !== "false",
    runOnce: process.env.WELDDOC_RUN_ONCE === "true",
  };
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function log(message, extra) {
  const timestamp = new Date().toISOString();
  if (extra === undefined) {
    console.log(`[${timestamp}] ${message}`);
    return;
  }
  console.log(`[${timestamp}] ${message}`, extra);
}

function getContentType(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function serveStaticFile(distDir, requestPath) {
  const normalizedPath = decodeURIComponent(requestPath.split("?")[0] || "/");
  const relativePath = normalizedPath === "/" ? "/index.html" : normalizedPath;
  const absolutePath = path.join(distDir, relativePath.replace(/^\/+/, ""));
  const shouldFallbackToIndex = !path.extname(relativePath);
  const targetPath =
    shouldFallbackToIndex || !(await fileExists(absolutePath))
      ? path.join(distDir, "index.html")
      : absolutePath;

  const body = await readFile(targetPath);
  return {
    body,
    contentType: getContentType(targetPath),
  };
}

function startStaticServer(distDir, port) {
  const server = http.createServer(async (req, res) => {
    try {
      const { body, contentType } = await serveStaticFile(distDir, req.url || "/");
      res.writeHead(200, { "Content-Type": contentType });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error instanceof Error ? error.message : "Static server error");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
      });
    });
  });
}

function createSha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sanitizeStorageName(value, fallback) {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || fallback;
}

function collectSourceFileIds(snapshot) {
  const ids = new Set();
  for (const section of snapshot?.source_zip?.sections ?? []) {
    for (const file of section.files ?? []) {
      if (file.file_id) ids.add(file.file_id);
    }
  }
  return Array.from(ids);
}

async function listQueuedJobs(admin, limit) {
  const { data, error } = await admin
    .from("document_package_jobs")
    .select("id, project_id, requested_documents, options, created_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

async function claimJob(admin, jobId, workerRef) {
  const timestamp = nowIso();
  const { data, error } = await admin
    .from("document_package_jobs")
    .update({
      status: "running",
      started_at: timestamp,
      progress_percent: 1,
      progress_step: "snapshot_received",
      progress_message: "Jobb claimet av worker.",
      progress_details: {},
      worker_ref: workerRef,
      heartbeat_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id, project_id, requested_documents, options, created_at")
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function updateJobProgress(admin, jobId, fields) {
  const payload = {
    ...fields,
    heartbeat_at: nowIso(),
    updated_at: nowIso(),
  };
  const { error } = await admin.from("document_package_jobs").update(payload).eq("id", jobId);
  if (error) throw error;
}

async function markJobFailed(admin, jobId, errorMessage, fields = {}) {
  const { error } = await admin
    .from("document_package_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      finished_at: nowIso(),
      updated_at: nowIso(),
      heartbeat_at: nowIso(),
      ...fields,
    })
    .eq("id", jobId);

  if (error) throw error;
}

async function failStaleRunningJobs(admin, staleJobTimeoutMs) {
  if (!(staleJobTimeoutMs > 0)) return 0;

  const { data, error } = await admin
    .from("document_package_jobs")
    .select("id, heartbeat_at, started_at")
    .eq("status", "running");

  if (error) throw error;

  const staleBefore = Date.now() - staleJobTimeoutMs;
  const staleJobs = (data ?? []).filter((job) => {
    const lastHeartbeatAt = parseTimestamp(job.heartbeat_at);
    const startedAt = parseTimestamp(job.started_at);
    const lastSeen = lastHeartbeatAt ?? startedAt;
    return lastSeen !== null && lastSeen < staleBefore;
  });

  for (const job of staleJobs) {
    await markJobFailed(admin, job.id, "Worker heartbeat timed out before job completion.", {
      progress_message: "Jobben ble markert som feilet fordi worker-heartbeat stoppet.",
      progress_percent: 100,
    });
  }

  if (staleJobs.length > 0) {
    log(`Marked ${staleJobs.length} stale running document package job(s) as failed`);
  }

  return staleJobs.length;
}

async function fetchFileRecords(admin, fileIds) {
  if (fileIds.length === 0) return new Map();

  const { data, error } = await admin
    .from("files")
    .select("id, bucket, path, label, mime_type, size_bytes")
    .in("id", fileIds);

  if (error) throw error;

  return new Map((data ?? []).map((row) => [row.id, row]));
}

async function downloadSourceFiles(admin, snapshot) {
  const fileIds = collectSourceFileIds(snapshot);
  const fileRecords = await fetchFileRecords(admin, fileIds);
  const fileBuffers = new Map();

  for (const fileId of fileIds) {
    const record = fileRecords.get(fileId);
    if (!record) {
      throw new Error(`Fant ikke filmetadata for ${fileId}.`);
    }

    const { data, error } = await admin.storage.from(record.bucket).download(record.path);
    if (error) throw error;

    const arrayBuffer = await data.arrayBuffer();
    fileBuffers.set(fileId, Buffer.from(arrayBuffer));
  }

  return fileBuffers;
}

async function buildZipBuffer(snapshot, fileBuffers) {
  const zip = new JSZip();

  for (const section of snapshot.source_zip.sections ?? []) {
    for (const file of section.files ?? []) {
      const buffer = fileBuffers.get(file.file_id);
      if (!buffer) {
        throw new Error(`Mangler filbuffer for ${file.file_id}.`);
      }
      zip.file(file.relative_path, buffer);
    }
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

async function renderMainPdf(browser, baseUrl, snapshot) {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];

  try {
    page.on("pageerror", (error) => {
      pageErrors.push(error instanceof Error ? error.message : String(error));
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.addInitScript(
      ({ storageKey, payload }) => {
        window.localStorage.setItem(storageKey, payload);
        window.sessionStorage.setItem(storageKey, payload);
      },
      {
        storageKey: RENDER_STORAGE_KEY,
        payload: JSON.stringify(snapshot),
      }
    );

    await page.goto(`${baseUrl}/worker/document-package-render`, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });

    let renderState = null;

    try {
      const renderStateHandle = await page.waitForFunction(
        () => {
          const state = document.documentElement.dataset.documentPackageRenderReady;
          return state === "true" || state === "error" ? state : null;
        },
        undefined,
        { timeout: 30000 }
      );
      renderState = await renderStateHandle.jsonValue();
    } catch (error) {
      const debugState = await page.evaluate(() => ({
        ready: document.documentElement.dataset.documentPackageRenderReady ?? "",
        error: document.documentElement.dataset.documentPackageRenderError ?? "",
        title: document.title,
      }));
      const debugParts = [
        debugState.ready ? `ready=${debugState.ready}` : "",
        debugState.error,
        ...pageErrors.slice(-3),
        ...consoleErrors.slice(-3),
      ].filter(Boolean);
      const debugMessage = debugParts.length > 0 ? `: ${debugParts.join(" | ")}` : "";
      throw new Error(`Timed out waiting for document package render readiness${debugMessage}`);
    }

    if (renderState !== "true") {
      const renderError = await page.evaluate(() => {
        return (
          document.documentElement.dataset.documentPackageRenderError ||
          document.body.innerText.trim() ||
          "Worker render route reported an unknown error."
        );
      });
      const detailParts = [renderError, ...pageErrors.slice(-3), ...consoleErrors.slice(-3)].filter(Boolean);
      throw new Error(`Document package render failed: ${detailParts.join(" | ")}`);
    }

    return await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await page.close();
  }
}

async function uploadArtifact(admin, config, job, options) {
  const fileId = randomUUID();
  const storagePath = `${config.artifactPrefix}/${job.id}/${options.fileName}`;
  const sha256 = createSha256(options.buffer);
  let fileRowCreated = false;

  try {
    const { error: uploadError } = await admin.storage
      .from(config.artifactBucket)
      .upload(storagePath, options.buffer, {
        upsert: true,
        contentType: options.mimeType,
      });

    if (uploadError) throw uploadError;

    const { error: insertError } = await admin.from("files").insert({
      id: fileId,
      bucket: config.artifactBucket,
      path: storagePath,
      type: options.fileType,
      label: options.label,
      mime_type: options.mimeType,
      size_bytes: options.buffer.byteLength,
      sha256,
    });

    if (insertError) throw insertError;
    fileRowCreated = true;

    return {
      fileId,
      bucket: config.artifactBucket,
      path: storagePath,
    };
  } catch (error) {
    if (fileRowCreated) {
      try {
        await admin.from("files").delete().eq("id", fileId);
      } catch {}
    }

    try {
      await admin.storage.from(config.artifactBucket).remove([storagePath]);
    } catch {}

    throw error;
  }
}

async function cleanupArtifact(admin, artifact) {
  if (!artifact?.fileId || !artifact.bucket || !artifact.path) return;

  try {
    const { error: fileDeleteError } = await admin.from("files").delete().eq("id", artifact.fileId);
    if (fileDeleteError) throw fileDeleteError;
  } catch (error) {
    log(`Failed to delete artifact file row ${artifact.fileId}`, error instanceof Error ? error.message : error);
  }

  try {
    const { error: storageDeleteError } = await admin.storage.from(artifact.bucket).remove([artifact.path]);
    if (storageDeleteError) throw storageDeleteError;
  } catch (error) {
    log(`Failed to delete artifact storage object ${artifact.path}`, error instanceof Error ? error.message : error);
  }
}

async function cleanupArtifacts(admin, artifacts) {
  await Promise.allSettled((artifacts ?? []).map((artifact) => cleanupArtifact(admin, artifact)));
}

async function completeJob(admin, jobId, artifacts) {
  const { error } = await admin
    .from("document_package_jobs")
    .update({
      status: "completed",
      progress_percent: 100,
      progress_step: "finalizing_job",
      progress_message: "Jobben er ferdig.",
      finished_at: nowIso(),
      updated_at: nowIso(),
      heartbeat_at: nowIso(),
      artifact_file_id: artifacts.sourceZipFileId ?? artifacts.mainPdfFileId ?? null,
      main_pdf_file_id: artifacts.mainPdfFileId ?? null,
      source_zip_file_id: artifacts.sourceZipFileId ?? null,
      error_message: null,
    })
    .eq("id", jobId);

  if (error) throw error;
}

function startJobHeartbeat(admin, jobId, workerRef, heartbeatMs) {
  if (!(heartbeatMs > 0)) {
    return () => undefined;
  }

  let stopped = false;
  let inFlight = false;

  const sendHeartbeat = async () => {
    if (stopped || inFlight) return;
    inFlight = true;

    try {
      const { error } = await admin
        .from("document_package_jobs")
        .update({
          worker_ref: workerRef,
          heartbeat_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq("id", jobId)
        .eq("status", "running");

      if (error) throw error;
    } catch (error) {
      log(`Failed to update heartbeat for package job ${jobId}`, error instanceof Error ? error.message : error);
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(() => {
    void sendHeartbeat();
  }, heartbeatMs);

  timer.unref?.();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

function assertWorkerContract(job) {
  const contract = job.options;
  if (!contract || typeof contract !== "object") {
    throw new Error("Package-jobben mangler worker contract.");
  }

  if (contract.contract_version !== 2 || contract.package_model !== "documentation-package-v2") {
    throw new Error("Ukjent package contract-versjon.");
  }

  if (!contract.snapshot) {
    throw new Error("Package-jobben mangler snapshot.");
  }

  return contract;
}

async function processJob(admin, browser, baseUrl, config, job) {
  const contract = assertWorkerContract(job);
  const snapshot = contract.snapshot;
  const stopHeartbeat = startJobHeartbeat(admin, job.id, config.workerRef, config.heartbeatMs);
  const uploadedArtifacts = [];

  let mainPdfBuffer = null;
  let sourceZipBuffer = null;

  try {
    await updateJobProgress(admin, job.id, {
      progress_percent: 5,
      progress_step: "snapshot_received",
      progress_message: "Snapshot lastet fra jobbpayload.",
    });

    let sourceFiles = new Map();
    if (snapshot.source_zip.enabled) {
      await updateJobProgress(admin, job.id, {
        progress_percent: 20,
        progress_step: "downloading_source_files",
        progress_message: `Laster ${snapshot.source_zip.total_files} kildedokumenter.`,
        progress_details: { total_files: snapshot.source_zip.total_files },
      });
      sourceFiles = await downloadSourceFiles(admin, snapshot);
    }

    if (snapshot.main_pdf.enabled) {
      await updateJobProgress(admin, job.id, {
        progress_percent: 52,
        progress_step: "rendering_main_pdf",
        progress_message: "Renderer pakkesammendrag via lokal render-side.",
      });
      mainPdfBuffer = await renderMainPdf(browser, baseUrl, snapshot);
    }

    if (snapshot.source_zip.enabled) {
      await updateJobProgress(admin, job.id, {
        progress_percent: 72,
        progress_step: "assembling_zip",
        progress_message: "Setter sammen ZIP fra snapshot-manifest.",
      });
      sourceZipBuffer = await buildZipBuffer(snapshot, sourceFiles);
    }

    await updateJobProgress(admin, job.id, {
      progress_percent: 88,
      progress_step: "uploading_artifacts",
      progress_message: "Laster opp ferdige artefakter til Supabase Storage.",
    });

    const artifactBaseName = sanitizeStorageName(
      contract.project?.project_no || contract.project?.name || job.id,
      job.id
    );

    const mainPdfArtifact = mainPdfBuffer
      ? await uploadArtifact(admin, config, job, {
          buffer: mainPdfBuffer,
          fileName: `${artifactBaseName}.pdf`,
          label: contract.requested_artifacts.main_pdf.file_name || `documentation-package-${artifactBaseName}.pdf`,
          mimeType: "application/pdf",
          fileType: "document_package_main_pdf",
        })
      : null;
    if (mainPdfArtifact) uploadedArtifacts.push(mainPdfArtifact);

    const sourceZipArtifact = sourceZipBuffer
      ? await uploadArtifact(admin, config, job, {
          buffer: sourceZipBuffer,
          fileName: `${artifactBaseName}.zip`,
          label: contract.requested_artifacts.source_zip.file_name || `documentation-package-${artifactBaseName}.zip`,
          mimeType: "application/zip",
          fileType: "document_package_zip",
        })
      : null;
    if (sourceZipArtifact) uploadedArtifacts.push(sourceZipArtifact);

    await completeJob(admin, job.id, {
      mainPdfFileId: mainPdfArtifact?.fileId ?? null,
      sourceZipFileId: sourceZipArtifact?.fileId ?? null,
    });
  } catch (error) {
    await cleanupArtifacts(admin, uploadedArtifacts);
    throw error;
  } finally {
    stopHeartbeat();
  }
}

async function main() {
  const config = readConfig();
  const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const staticServer = await startStaticServer(config.distDir, config.staticPort);
  const browser = await chromium.launch({
    headless: config.headless,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  log(`Document package worker started as ${config.workerRef}`);

  const shutdown = async () => {
    await browser.close().catch(() => undefined);
    await new Promise((resolve) => staticServer.server.close(resolve));
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (true) {
    await failStaleRunningJobs(admin, config.staleJobTimeoutMs);

    const queuedJobs = await listQueuedJobs(admin, config.jobLimit);

    if (queuedJobs.length === 0) {
      if (config.runOnce) break;
      await sleep(config.pollMs);
      continue;
    }

    for (const queuedJob of queuedJobs) {
      const claimedJob = await claimJob(admin, queuedJob.id, config.workerRef);
      if (!claimedJob) continue;

      log(`Processing package job ${claimedJob.id}`);

      try {
        await processJob(admin, browser, staticServer.baseUrl, config, claimedJob);
        log(`Completed package job ${claimedJob.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ukjent workerfeil.";
        await markJobFailed(admin, claimedJob.id, message, {
          progress_message: message,
          progress_percent: 100,
        }).catch((updateError) => {
          log(`Failed to persist job failure for ${claimedJob.id}`, updateError);
        });
        log(`Package job ${claimedJob.id} failed: ${message}`);
      }
    }

    if (config.runOnce) break;
    await sleep(config.pollMs);
  }

  await shutdown();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

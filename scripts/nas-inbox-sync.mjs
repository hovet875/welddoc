import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const EDGE_FUNCTION_NAME = process.env.SUPABASE_EDGE_FUNCTION || "nas-inbox-ingest";

const SUPABASE_FUNCTION_URL =
  process.env.SUPABASE_FUNCTION_URL ||
  (SUPABASE_URL ? `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/${EDGE_FUNCTION_NAME}` : "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const NAS_INGEST_TOKEN = process.env.NAS_INGEST_TOKEN || "";

const WELDDOC_ROOT = process.env.WELDDOC_ROOT || "/welddoc";
const INBOX_ROOT = path.join(WELDDOC_ROOT, "01_Inbox");
const PROCESSED_ROOT = path.join(WELDDOC_ROOT, "02_Processed");
const ERROR_ROOT = path.join(WELDDOC_ROOT, "03_Error");
const OCR_ROOT = process.env.WELDDOC_OCR_ROOT || path.join(WELDDOC_ROOT, "99_Temp", "ocr");

const MAX_FILE_MB = Number(process.env.WELDDOC_MAX_FILE_MB || "25");
const MIN_FILE_AGE_SEC = Number(process.env.WELDDOC_MIN_FILE_AGE_SEC || "5");
const OCR_TEXT_MAX_CHARS = Number(process.env.WELDDOC_OCR_TEXT_MAX_CHARS || "250000");

const TARGET_FOLDERS = [
  { folder: "Materialsertifikater", target: "material_certificate" },
  { folder: "NDT-rapporter", target: "ndt_report" },
];

if (!SUPABASE_FUNCTION_URL || !SUPABASE_ANON_KEY || !NAS_INGEST_TOKEN) {
  throw new Error("Missing SUPABASE_FUNCTION_URL (or SUPABASE_URL+SUPABASE_EDGE_FUNCTION), SUPABASE_ANON_KEY or NAS_INGEST_TOKEN.");
}

const now = () => new Date().toISOString();

async function pathExists(inputPath) {
  try {
    await fs.access(inputPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(inputPath) {
  await fs.mkdir(inputPath, { recursive: true });
}

async function moveFile(srcPath, destPath) {
  await ensureDir(path.dirname(destPath));
  try {
    await fs.rename(srcPath, destPath);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "EXDEV") {
      await fs.copyFile(srcPath, destPath);
      await fs.unlink(srcPath);
      return;
    }
    throw err;
  }
}

async function nextAvailablePath(baseDir, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(baseDir, fileName);
  let idx = 1;
  while (await pathExists(candidate)) {
    candidate = path.join(baseDir, `${parsed.name} (${idx})${parsed.ext}`);
    idx += 1;
  }
  return candidate;
}

async function listFilesRecursive(dirPath) {
  if (!(await pathExists(dirPath))) return [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    // Synology metadata folder
    if (entry.name === "@eaDir") continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      // Synology / mac junk
      if (entry.name.includes("SynoEAStream")) continue;
      if (entry.name.startsWith("@")) continue;
      if (entry.name.startsWith("._")) continue;

      files.push(fullPath);
    }
  }

  return files;
}

function toPosixRelative(fromRoot, fullPath) {
  const rel = path.relative(fromRoot, fullPath);
  return rel.split(path.sep).join("/");
}

async function writeErrorNote(destFilePath, message) {
  const notePath = `${destFilePath}.error.txt`;
  await fs.writeFile(notePath, `${now()}\n${message}\n`, "utf8");
}

async function moveToProcessed(srcPath, folderName) {
  const datePart = new Date().toISOString().slice(0, 10);
  const outDir = path.join(PROCESSED_ROOT, folderName, datePart);
  const outPath = await nextAvailablePath(outDir, path.basename(srcPath));
  await moveFile(srcPath, outPath);
  return outPath;
}

async function moveToError(srcPath, folderName, message) {
  const datePart = new Date().toISOString().slice(0, 10);
  const outDir = path.join(ERROR_ROOT, folderName, datePart);
  const outPath = await nextAvailablePath(outDir, path.basename(srcPath));
  await moveFile(srcPath, outPath);
  await writeErrorNote(outPath, message);
  return outPath;
}

async function readOptionalOcrText(fullPath) {
  const rel = toPosixRelative(INBOX_ROOT, fullPath);
  const baseNoExt = fullPath.replace(/\.pdf$/i, "");
  const candidates = [
    `${fullPath}.ocr.txt`,
    `${baseNoExt}.ocr.txt`,
    path.join(OCR_ROOT, `${rel}.txt`),
    path.join(OCR_ROOT, `${rel.replace(/\.pdf$/i, "")}.txt`),
  ];

  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) continue;
    try {
      const text = await fs.readFile(candidate, "utf8");
      const trimmed = text.trim();
      if (!trimmed) continue;
      return trimmed.slice(0, OCR_TEXT_MAX_CHARS);
    } catch {}
  }

  return null;
}

async function callIngestFunction({ fileBuffer, fileName, target, sourceFolder, sourcePath, ocrText }) {
  const form = new FormData();
  form.set("target", target);
  form.set("source_folder", sourceFolder);
  form.set("source_path", sourcePath);
  form.set("suggested_meta", "{}");
  if (ocrText) form.set("ocr_text", ocrText);
  form.set("file", new Blob([fileBuffer], { type: "application/pdf" }), fileName);

  const res = await fetch(SUPABASE_FUNCTION_URL, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "x-ingest-token": NAS_INGEST_TOKEN,
    },
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(body?.error || `HTTP ${res.status}`));
  }
  return body;
}

async function processOneFile(fullPath, folderName, target) {
  const relPath = toPosixRelative(WELDDOC_ROOT, fullPath);

  const stat = await fs.stat(fullPath);
  const ageMs = Date.now() - stat.mtimeMs;

  // Skip files that are too fresh (still being copied)
  if (ageMs < MIN_FILE_AGE_SEC * 1000) {
    console.log(`[SKIP] ${relPath} (too fresh, age ${Math.round(ageMs / 1000)}s)`);
    return;
  }

  const maxBytes = MAX_FILE_MB * 1024 * 1024;
  if (stat.size > maxBytes) {
    throw new Error(
      `File too large (${Math.round(stat.size / 1024 / 1024)}MB > ${MAX_FILE_MB}MB).`
    );
  }

  if (!fullPath.toLowerCase().endsWith(".pdf")) {
    throw new Error("Not a PDF file.");
  }

  const fileBuffer = await fs.readFile(fullPath);

  // Optional OCR text (edge does PDF text extraction anyway)
  let ocrText = await readOptionalOcrText(fullPath);

  // Ignore tiny OCR files (often broken/empty)
  if (ocrText && ocrText.length < 200) {
    ocrText = null;
  }

  const sourcePath = toPosixRelative(WELDDOC_ROOT, fullPath);

  // Build form manually here so we can control headers cleanly
  const form = new FormData();
  form.set("target", target);
  form.set("source_folder", folderName);
  form.set("source_path", sourcePath);
  form.set("suggested_meta", "{}");

  if (ocrText) {
    form.set("ocr_text", ocrText);
  }

  form.set(
    "file",
    new Blob([fileBuffer], { type: "application/pdf" }),
    path.basename(fullPath)
  );

  const res = await fetch(SUPABASE_FUNCTION_URL, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "x-ingest-token": NAS_INGEST_TOKEN,
    },
    body: form,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(String(body?.error || `HTTP ${res.status}`));
  }

  // Move file only after successful ingest
  const movedPath = await moveToProcessed(fullPath, folderName);
  const movedRel = toPosixRelative(WELDDOC_ROOT, movedPath);

  const dedupeFlag = body?.deduped ? " deduped=true" : "";

  console.log(
    `[OK] ${relPath} -> inbox:${body?.inbox_id || "-"} file:${body?.file_id || "-"} moved:${movedRel}${dedupeFlag}`
  );
}

async function processTargetFolder(folderName, target) {
  const folderPath = path.join(INBOX_ROOT, folderName);
  const files = await listFilesRecursive(folderPath);
  if (files.length === 0) {
    console.log(`[INFO] ${folderName}: no files`);
    return;
  }

  console.log(`[INFO] ${folderName}: ${files.length} file(s)`);
  for (const fullPath of files) {
    const relPath = toPosixRelative(WELDDOC_ROOT, fullPath);
    try {
      await processOneFile(fullPath, folderName, target);
    } catch (err) {
      const message = String(err?.message ?? err);
      console.error(`[ERR] ${relPath}: ${message}`);
      try {
        const errPath = await moveToError(fullPath, folderName, message);
        console.error(`[ERR] moved to ${toPosixRelative(WELDDOC_ROOT, errPath)}`);
      } catch (moveErr) {
        console.error(`[ERR] failed to move ${relPath} to error folder: ${String(moveErr?.message ?? moveErr)}`);
      }
    }
  }
}

async function run() {
  console.log(`[START] ${now()}`);
  for (const cfg of TARGET_FOLDERS) {
    await processTargetFolder(cfg.folder, cfg.target);
  }
  console.log(`[DONE] ${now()}`);
}

run().catch((err) => {
  console.error(`[FATAL] ${String(err?.message ?? err)}`);
  process.exitCode = 1;
});

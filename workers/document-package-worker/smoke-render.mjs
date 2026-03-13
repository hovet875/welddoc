import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, stat } from "node:fs/promises";
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

function getDistDir() {
  return path.resolve(__dirname, "..", "..", "dist");
}

async function ensureBuildExists(distDir) {
  try {
    await stat(path.join(distDir, "index.html"));
  } catch {
    throw new Error("Fant ikke dist/index.html. Kjor `npm run build` forst.");
  }
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

  return {
    body: await readFile(targetPath),
    contentType: getContentType(targetPath),
  };
}

function startStaticServer(distDir) {
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
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Klarte ikke a lese serverport for smoke-test."));
        return;
      }

      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function createValidSnapshot() {
  const generatedAt = new Date().toISOString();

  return {
    snapshot_version: 1,
    generated_at: generatedAt,
    requested_documents: ["package_main_pdf"],
    main_pdf: {
      enabled: true,
      section_keys: ["cover_page", "table_of_contents", "package_overview"],
      data: {
        projectLabel: "SMOKE-001",
        projectName: "Worker Render Smoke",
        customer: "Smoke Customer",
        workOrder: "WO-SMOKE-001",
        generatedAt,
        includedDocumentCount: 0,
        traceabilityRowCount: 0,
        weldRowCount: 0,
        weldLogCount: 0,
        contents: [
          {
            order: "01",
            section: "Forside",
            description: "Prosjektidentitet og leveranseinformasjon for dokumentasjonspakken.",
          },
          {
            order: "02",
            section: "Register",
            description: "Oversikt over seksjonene som faktisk inngar i leveransen.",
          },
          {
            order: "03",
            section: "Pakkeoversikt",
            description: "Smoke-test med tom pakkeoversikt.",
          },
        ],
        packageOverview: [],
        materialTraceability: null,
        weldLogs: [],
      },
    },
    source_zip: {
      enabled: false,
      document_keys: [],
      sections: [],
      total_files: 0,
    },
    warnings: [],
  };
}

function createInvalidSnapshot() {
  const generatedAt = new Date().toISOString();

  return {
    snapshot_version: 1,
    generated_at: generatedAt,
    requested_documents: ["package_main_pdf"],
    main_pdf: {
      enabled: true,
      section_keys: ["cover_page"],
      data: null,
    },
    source_zip: {
      enabled: false,
      document_keys: [],
      sections: [],
      total_files: 0,
    },
    warnings: [],
  };
}

async function runCase(browser, baseUrl, name, snapshot, expectations) {
  const context = await browser.newContext();

  try {
    await context.addInitScript(
      ({ storageKey, payload }) => {
        window.localStorage.setItem(storageKey, payload);
        window.sessionStorage.setItem(storageKey, payload);
      },
      {
        storageKey: RENDER_STORAGE_KEY,
        payload: JSON.stringify(snapshot),
      }
    );

    const page = await context.newPage();
    await page.goto(`${baseUrl}/worker/document-package-render`, { waitUntil: "networkidle" });

    const stateHandle = await page.waitForFunction(
      () => {
        const ready = document.documentElement.dataset.documentPackageRenderReady;
        if (ready !== "true" && ready !== "error") return null;

        return {
          ready,
          error: document.documentElement.dataset.documentPackageRenderError ?? "",
          title: document.title,
          text: document.body.innerText,
        };
      },
      undefined,
      { timeout: 30000 }
    );

    const result = await stateHandle.jsonValue();
    assert.equal(result.ready, expectations.ready, `${name}: unexpected render state`);

    if (expectations.ready === "true") {
      assert.match(result.text, /Dokumentasjonspakke/i, `${name}: cover page text missing`);
      assert.match(result.text, /SMOKE-001/i, `${name}: project label missing`);
      assert.equal(result.error, "", `${name}: unexpected render error dataset`);
    }

    if (expectations.ready === "error") {
      assert.match(result.text, /Renderfeil/i, `${name}: error screen text missing`);
      assert.match(result.error, expectations.errorPattern, `${name}: wrong render error dataset`);
    }

    console.log(`PASS ${name}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const distDir = getDistDir();
  await ensureBuildExists(distDir);

  const { server, baseUrl } = await startStaticServer(distDir);
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    await runCase(browser, baseUrl, "worker render success path", createValidSnapshot(), {
      ready: "true",
    });

    await runCase(browser, baseUrl, "worker render explicit error path", createInvalidSnapshot(), {
      ready: "error",
      errorPattern: /main_pdf\.data/i,
    });

    console.log("Document package worker render smoke test passed.");
  } finally {
    await browser.close().catch(() => undefined);
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
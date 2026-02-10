import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker?url";

GlobalWorkerOptions.workerSrc = workerUrl;

type ExtractOptions = {
  maxPages?: number;
  ocrFallback?: boolean;
  ocrMaxPages?: number;
};

async function renderPageToCanvas(page: any, scale: number) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context missing");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const renderTask = page.render({ canvasContext: ctx, viewport });
  await renderTask.promise;
  return canvas;
}

async function runOcrOnPdf(pdf: any, maxPages: number) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  const chunks: string[] = [];
  const pages = Math.min(maxPages, pdf.numPages);
  for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const canvas = await renderPageToCanvas(page, 1.5);
    const result = await worker.recognize(canvas);
    const text = result?.data?.text || "";
    if (text) chunks.push(text);
    page.cleanup?.();
  }

  await worker.terminate();
  return chunks.join("\n");
}

export async function extractPdfText(file: File, opts?: ExtractOptions) {
  const buffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: buffer });
  const pdf = await loadingTask.promise;

  const maxPages = Math.min(opts?.maxPages ?? 2, pdf.numPages);
  const chunks: string[] = [];

  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string }>;
    const pageText = items.map((it) => it.str || "").filter(Boolean).join(" ");
    if (pageText) chunks.push(pageText);
    page.cleanup?.();
  }

  let text = chunks.join("\n");
  const shouldOcr = opts?.ocrFallback && text.replace(/\s+/g, "").length < 20;
  if (shouldOcr) {
    text = await runOcrOnPdf(pdf, opts?.ocrMaxPages ?? 1);
  }

  await pdf.destroy();
  return text;
}

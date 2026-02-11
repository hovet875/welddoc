declare module "pdfjs-dist" {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(src: unknown): { promise: Promise<any> };
}

declare module "pdfjs-dist/build/pdf.worker?url" {
  const workerUrl: string;
  export default workerUrl;
}

declare module "tesseract.js" {
  export function createWorker(lang?: string): Promise<{
    recognize: (image: unknown) => Promise<{ data?: { text?: string } }>;
    terminate: () => Promise<void>;
  }>;
}

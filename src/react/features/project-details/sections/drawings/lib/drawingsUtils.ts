import type { AppPdfPreviewState, DrawingRevision } from "../types";

export const REVISION_OPTIONS: DrawingRevision[] = ["-", "A", "B", "C", "D", "E", "F"];

export function createPdfPreviewState(): AppPdfPreviewState {
  return {
    opened: false,
    title: "Tegning",
    url: null,
    loading: false,
    error: null,
  };
}

export function formatFileSize(sizeBytes: number | null | undefined) {
  if (sizeBytes == null) return "";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kb = sizeBytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function readError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

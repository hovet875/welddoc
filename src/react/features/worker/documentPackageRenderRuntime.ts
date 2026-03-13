export const DOCUMENT_PACKAGE_RENDER_STORAGE_KEY = "welddoc:document-package-render";

export type DocumentPackageRenderStatus = "loading" | "true" | "error";

function normalizeRenderErrorMessage(message: string | null | undefined) {
  const normalized = String(message ?? "").trim();
  return normalized || "Ukjent renderfeil.";
}

export function setDocumentPackageRenderStatus(status: DocumentPackageRenderStatus, errorMessage?: string | null) {
  document.documentElement.dataset.documentPackageRenderReady = status;

  if (status === "error") {
    document.documentElement.dataset.documentPackageRenderError = normalizeRenderErrorMessage(errorMessage);
    return;
  }

  delete document.documentElement.dataset.documentPackageRenderError;
}

export function clearDocumentPackageRenderStatus() {
  delete document.documentElement.dataset.documentPackageRenderReady;
  delete document.documentElement.dataset.documentPackageRenderError;
}
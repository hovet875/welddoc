import type { DocumentPackageDocumentKey } from "@/documents/package/documentPackageCatalog";
import type { DocumentPackageMainPdfData } from "@/documents/package/documentPackageMainPdf.types";
import type { ProjectRow } from "../../../projectDetails.types";
import { buildDocumentPackageSnapshot } from "./buildDocumentPackageSnapshot";

type LoadDocumentPackageMainPdfOptions = {
  requestedDocuments?: DocumentPackageDocumentKey[];
};

export async function loadDocumentPackageMainPdfData(
  project: ProjectRow,
  options?: LoadDocumentPackageMainPdfOptions
): Promise<DocumentPackageMainPdfData> {
  const snapshot = await buildDocumentPackageSnapshot(project, {
    requestedDocuments: Array.from(new Set(["package_main_pdf", ...(options?.requestedDocuments ?? [])])),
  });

  if (!snapshot.main_pdf.data) {
    throw new Error("Pakkesammendraget kunne ikke bygges for gjeldende utvalg.");
  }

  return snapshot.main_pdf.data;
}

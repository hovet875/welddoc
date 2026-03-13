import type { DocumentPackageDocumentKey } from "./documentPackageCatalog";
import type { DocumentPackageMainPdfData } from "./documentPackageMainPdf.types";

export type DocumentPackageMainPdfSectionKey =
  | "cover_page"
  | "table_of_contents"
  | "package_overview"
  | "material_traceability"
  | "weld_log";

export type DocumentPackageZipDocumentKey = Exclude<DocumentPackageDocumentKey, "package_main_pdf">;

export type DocumentPackageZipSourceType =
  | "project_work_order"
  | "project_drawing"
  | "material_certificate"
  | "filler_certificate"
  | "wps"
  | "wpqr"
  | "welder_certificate"
  | "ndt_report"
  | "ndt_personnel_certificate"
  | "calibration_certificate";

export type DocumentPackageZipFileEntry = {
  file_id: string;
  label: string;
  mime_type: string | null;
  size_bytes: number | null;
  output_file_name: string;
  relative_path: string;
  sort_key: string;
  source_type: DocumentPackageZipSourceType;
  source_id: string;
};

export type DocumentPackageZipSection = {
  document_key: DocumentPackageZipDocumentKey;
  label: string;
  folder_name: string;
  files: DocumentPackageZipFileEntry[];
};

export type DocumentPackageSnapshot = {
  snapshot_version: 1;
  generated_at: string;
  requested_documents: DocumentPackageDocumentKey[];
  main_pdf: {
    enabled: boolean;
    section_keys: DocumentPackageMainPdfSectionKey[];
    data: DocumentPackageMainPdfData | null;
  };
  source_zip: {
    enabled: boolean;
    document_keys: DocumentPackageZipDocumentKey[];
    sections: DocumentPackageZipSection[];
    total_files: number;
  };
  warnings: string[];
};

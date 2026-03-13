import type { DocumentPackageDocumentKey } from "@/documents/package/documentPackageCatalog";
import type {
  DocumentPackageMainPdfSectionKey,
  DocumentPackageSnapshot,
  DocumentPackageZipDocumentKey,
} from "@/documents/package/documentPackageSnapshot";

export type DocumentPackageWorkerProgressStepKey =
  | "snapshot_received"
  | "downloading_source_files"
  | "rendering_main_pdf"
  | "assembling_zip"
  | "uploading_artifacts"
  | "finalizing_job";

export type DocumentPackageWorkerContract = {
  contract_version: 2;
  package_model: "documentation-package-v2";
  execution: {
    mode: "external-worker";
    requested_at: string;
    snapshot_built_at: string;
  };
  project: {
    id: string;
    project_no: number;
    name: string;
  };
  requested_artifacts: {
    main_pdf: {
      enabled: boolean;
      document_key: "package_main_pdf";
      sections: DocumentPackageMainPdfSectionKey[];
      file_name: string | null;
    };
    source_zip: {
      enabled: boolean;
      document_keys: DocumentPackageZipDocumentKey[];
      file_name: string | null;
    };
  };
  progress: {
    step_keys: DocumentPackageWorkerProgressStepKey[];
  };
  snapshot: DocumentPackageSnapshot;
};

export function isDocumentPackageZipDocumentKey(key: DocumentPackageDocumentKey): key is DocumentPackageZipDocumentKey {
  return key !== "package_main_pdf";
}

export function createDocumentPackageWorkerContract(input: {
  projectId: string;
  projectNo: number;
  projectName: string;
  requestedDocuments: DocumentPackageDocumentKey[];
  snapshot: DocumentPackageSnapshot;
}): DocumentPackageWorkerContract {
  const uniqueRequestedDocuments = Array.from(new Set(input.requestedDocuments));
  const zipDocumentKeys = uniqueRequestedDocuments.filter(isDocumentPackageZipDocumentKey);
  const projectLabel = String(input.projectNo).trim() || input.projectName || "project";
  const mainPdfEnabled = input.snapshot.main_pdf.enabled;
  const sourceZipEnabled = input.snapshot.source_zip.enabled;

  return {
    contract_version: 2,
    package_model: "documentation-package-v2",
    execution: {
      mode: "external-worker",
      requested_at: new Date().toISOString(),
      snapshot_built_at: input.snapshot.generated_at,
    },
    project: {
      id: input.projectId,
      project_no: input.projectNo,
      name: input.projectName,
    },
    requested_artifacts: {
      main_pdf: {
        enabled: mainPdfEnabled,
        document_key: "package_main_pdf",
        sections: input.snapshot.main_pdf.section_keys,
        file_name: mainPdfEnabled ? `documentation-package-${projectLabel}.pdf` : null,
      },
      source_zip: {
        enabled: sourceZipEnabled,
        document_keys: zipDocumentKeys,
        file_name: sourceZipEnabled ? `documentation-package-${projectLabel}.zip` : null,
      },
    },
    progress: {
      step_keys: [
        "snapshot_received",
        "downloading_source_files",
        "rendering_main_pdf",
        "assembling_zip",
        "uploading_artifacts",
        "finalizing_job",
      ],
    },
    snapshot: input.snapshot,
  };
}

export function getDocumentPackageWorkerStepLabel(step: string | null | undefined) {
  switch (step) {
    case "snapshot_received":
      return "Starter generering av dokumentpakke";

    case "downloading_source_files":
      return "Henter dokumenter";

    case "rendering_main_pdf":
      return "Genererer sammendrag";

    case "assembling_zip":
      return "Setter sammen dokumentpakken";

    case "uploading_artifacts":
      return "Lagrer dokumentpakken";

    case "finalizing_job":
      return "Fullfører";

    default:
      return "Behandler dokumentpakke";
  }
}
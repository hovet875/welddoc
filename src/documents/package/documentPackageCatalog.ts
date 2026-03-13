export type DocumentPackageDocumentKey =
  | "package_main_pdf"
  | "project_work_order"
  | "project_drawings"
  | "material_certificates"
  | "filler_certificates"
  | "wps_wpqr_documents"
  | "welder_certificates"
  | "ndt_documents"
  | "calibration_certificates";

export type DocumentPackageDocumentKind = "source" | "generated";
export type DocumentPackageImplementationState = "available" | "planned";
export type DocumentPackageDelivery = "main-pdf" | "zip-folder";

export type DocumentPackageNavigationTarget =
  | {
      kind: "project-section";
      target: "arbeidsordre" | "tegninger" | "sporbarhet" | "sveiselogg" | "trykktest";
    }
  | {
      kind: "route";
      target: "material-certs" | "procedures" | "certs" | "ndt";
    };

export type DocumentPackageCatalogEntry = {
  key: DocumentPackageDocumentKey;
  label: string;
  description: string;
  kind: DocumentPackageDocumentKind;
  delivery: DocumentPackageDelivery;
  implementation: DocumentPackageImplementationState;
  folderName?: string;
  navigationTarget?: DocumentPackageNavigationTarget;
};

export const DOCUMENT_PACKAGE_CATALOG: DocumentPackageCatalogEntry[] = [
  {
    key: "package_main_pdf",
    label: "Pakkesammendrag PDF",
    description: "Kundevennlig sammendrag med forside, register, pakkeoversikt, materialsporbarhet og sveiselogg nar innholdet er inkludert i leveransen.",
    kind: "generated",
    delivery: "main-pdf",
    implementation: "available",
  },
  {
    key: "project_work_order",
    label: "Arbeidsordre",
    description: "Arbeidsordre koblet til prosjektet legges i ZIP under 01_Arbeidsordre/.",
    kind: "source",
    delivery: "zip-folder",
    implementation: "available",
    folderName: "01_Arbeidsordre",
    navigationTarget: { kind: "project-section", target: "arbeidsordre" },
  },
  {
    key: "project_drawings",
    label: "Tegninger",
    description: "Prosjektets tegnings-PDF-er legges i ZIP under 02_Tegninger/.",
    kind: "source",
    delivery: "zip-folder",
    implementation: "available",
    folderName: "02_Tegninger",
    navigationTarget: { kind: "project-section", target: "tegninger" },
  },
  {
    key: "material_certificates",
    label: "Materialsertifikater",
    description: "Materialsertifikater koblet via prosjektets sporbarhet legges i ZIP under 03_Materialsertifikater/.",
    kind: "source",
    delivery: "zip-folder",
    implementation: "available",
    folderName: "03_Materialsertifikater",
    navigationTarget: { kind: "project-section", target: "sporbarhet" },
  },
  {
    key: "filler_certificates",
    label: "Tilsettsertifikater",
    description: "Tilsettsertifikater koblet via prosjektets sporbarhet legges i ZIP under 04_Tilsettsertifikater/.",
    kind: "source",
    delivery: "zip-folder",
    implementation: "available",
    folderName: "04_Tilsettsertifikater",
    navigationTarget: { kind: "project-section", target: "sporbarhet" },
  },
  {
    key: "wps_wpqr_documents",
    label: "Sveiseprosedyrer og WPQR",
    description: "WPS og WPQR knyttet til sveiseloggen legges i ZIP under 05_Sveiseprosedyrer_WPS_WPQR/.",
    kind: "source",
    delivery: "zip-folder",
    implementation: "available",
    folderName: "05_Sveiseprosedyrer_WPS_WPQR",
    navigationTarget: { kind: "project-section", target: "sveiselogg" },
  },
  {
    key: "welder_certificates",
    label: "Sveisesertifikater",
    description: "Sveisesertifikater knyttet til sveiseloggen legges i ZIP under 06_Sveisesertifikater/.",
    kind: "source",
    delivery: "zip-folder",
    implementation: "available",
    folderName: "06_Sveisesertifikater",
    navigationTarget: { kind: "project-section", target: "sveiselogg" },
  },
  {
    key: "ndt_documents",
    label: "NDT-rapporter",
    description: "NDT-rapporter og eventuelle personellsertifikater med sikker kobling legges i ZIP under 07_NDT-rapporter/.",
    kind: "source",
    delivery: "zip-folder",
    implementation: "available",
    folderName: "07_NDT-rapporter",
    navigationTarget: { kind: "project-section", target: "sveiselogg" },
  },
  {
    key: "calibration_certificates",
    label: "Kalibreringssertifikater",
    description: "Kalibreringssertifikater, typisk for manometer ved trykktest, legges i ZIP under 08_Kalibreringssertifikater/.",
    kind: "source",
    delivery: "zip-folder",
    implementation: "available",
    folderName: "08_Kalibreringssertifikater",
    navigationTarget: { kind: "project-section", target: "trykktest" },
  },
];

export function getDocumentPackageLabel(key: DocumentPackageDocumentKey | string) {
  const current = DOCUMENT_PACKAGE_CATALOG.find((definition) => definition.key === key);
  if (current) return current.label;
  return key;
}

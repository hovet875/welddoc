import type { MaterialTraceabilityDocumentData } from "@/documents/material-traceability/materialTraceabilityDocument.types";
import type { WeldLogDocumentData } from "@/documents/weld-log/weldLogDocument.types";

export type DocumentPackageMainPdfContentsRow = {
  order: string;
  section: string;
  description: string;
};

export type DocumentPackageMainPdfOverviewRow = Record<string, string>;

export type DocumentPackageMainPdfOverviewColumn = {
  key: string;
  label: string;
  group?: string;
  width?: string;
  align?: "left" | "center" | "right";
  wrap?: "wrap" | "nowrap" | "clamp";
  clampLines?: number;
};

export type DocumentPackageMainPdfOverviewSection = {
  key: string;
  section: string;
  location: string;
  columns: DocumentPackageMainPdfOverviewColumn[];
  rows: DocumentPackageMainPdfOverviewRow[];
  emptyMessage?: string;
};

export type DocumentPackageMainPdfData = {
  projectLabel: string;
  projectName: string;
  customer: string;
  workOrder: string;
  generatedAt: string;
  includedDocumentCount: number;
  traceabilityRowCount: number;
  weldRowCount: number;
  weldLogCount: number;
  contents: DocumentPackageMainPdfContentsRow[];
  packageOverview: DocumentPackageMainPdfOverviewSection[];
  materialTraceability: MaterialTraceabilityDocumentData | null;
  weldLogs: WeldLogDocumentData[];
};

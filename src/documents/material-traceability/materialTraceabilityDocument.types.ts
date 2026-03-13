export type MaterialTraceabilityDocumentRow = {
  code: string;
  dimensionType: string;
  materialType: string;
  heat: string;
  certificateReference: string;
};

export type MaterialTraceabilityDocumentData = {
  projectLabel: string;
  projectName: string;
  generatedAt: string;
  rowCount: number;
  rows: MaterialTraceabilityDocumentRow[];
};
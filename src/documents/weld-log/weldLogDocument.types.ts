export type WeldLogDocumentRow = {
  weldNumber: string;
  jointType: string;
  component: string;
  welder: string;
  wps: string;
  weldDate: string;
  filler: string;
  vt: string;
  pt: string;
  vol: string;
  status: string;
};

export type WeldLogDocumentData = {
  projectLabel: string;
  projectName: string;
  drawingLabel: string;
  generatedAt: string;
  rowCount: number;
  rows: WeldLogDocumentRow[];
};
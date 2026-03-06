export type EditorKind = "wps" | "wpqr";
export type EditorMode = "create" | "edit";

export type WpsEditorState = {
  opened: boolean;
  kind: EditorKind;
  mode: EditorMode;
  rowId: string;
  docNo: string;
  docDate: string;
  standardId: string;
  process: string;
  materialId: string;
  fuge: string;
  tykkelse: string;
  wpqrId: string;
  existingFileId: string | null;
  removeExistingPdf: boolean;
  newPdfFile: File | null;
};

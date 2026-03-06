import type { ProjectDrawingRow } from "@/repo/projectDrawingRepo";
import type { AppPdfPreviewState } from "@react/ui/AppPdfPreviewModal";

export type DrawingRevision = "-" | "A" | "B" | "C" | "D" | "E" | "F";

export type UploadEntry = {
  id: string;
  file: File;
  drawingNo: string;
  revision: DrawingRevision;
};

export type DrawingsDataState = {
  rows: ProjectDrawingRow[];
  loading: boolean;
  error: string | null;
  selectedIds: Set<string>;
};

export type { ProjectDrawingRow, AppPdfPreviewState };

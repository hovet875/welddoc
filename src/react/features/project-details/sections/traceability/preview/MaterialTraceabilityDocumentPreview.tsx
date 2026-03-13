import {
  MaterialTraceabilityDocument,
  type MaterialTraceabilityDocumentColumnKey,
} from "@/documents/material-traceability/MaterialTraceabilityDocument";
import type { MaterialTraceabilityDocumentData } from "@/documents/material-traceability/materialTraceabilityDocument.types";

type MaterialTraceabilityDocumentPreviewProps = {
  data: MaterialTraceabilityDocumentData;
  columnKeys?: MaterialTraceabilityDocumentColumnKey[];
  showMeta?: boolean;
};

export function MaterialTraceabilityDocumentPreview({
  data,
  columnKeys,
  showMeta,
}: MaterialTraceabilityDocumentPreviewProps) {
  return (
    <div className="doc-preview-root">
      <MaterialTraceabilityDocument data={data} columnKeys={columnKeys} showMeta={showMeta} />
    </div>
  );
}

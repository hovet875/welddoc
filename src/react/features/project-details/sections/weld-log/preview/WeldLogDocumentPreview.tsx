import { WeldLogDocument, type WeldLogDocumentColumnKey } from "@/documents/weld-log/WeldLogDocument";
import type { WeldLogDocumentData } from "@/documents/weld-log/weldLogDocument.types";

type WeldLogDocumentPreviewProps = {
  data: WeldLogDocumentData;
  columnKeys?: WeldLogDocumentColumnKey[];
  showMeta?: boolean;
};

export function WeldLogDocumentPreview({ data, columnKeys, showMeta }: WeldLogDocumentPreviewProps) {
  return (
    <div className="doc-preview-root">
      <WeldLogDocument data={data} columnKeys={columnKeys} showMeta={showMeta} />
    </div>
  );
}

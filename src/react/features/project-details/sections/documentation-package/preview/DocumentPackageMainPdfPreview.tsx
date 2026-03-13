import { DocumentPackageMainPdf } from "@/documents/package/DocumentPackageMainPdf";
import type { DocumentPackageMainPdfData } from "@/documents/package/documentPackageMainPdf.types";

type DocumentPackageMainPdfPreviewProps = {
  data: DocumentPackageMainPdfData;
};

export function DocumentPackageMainPdfPreview({ data }: DocumentPackageMainPdfPreviewProps) {
  return (
    <div className="doc-preview-root">
      <DocumentPackageMainPdf data={data} />
    </div>
  );
}

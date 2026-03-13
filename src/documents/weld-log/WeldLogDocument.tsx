import { DocumentDataTable } from "@/documents/core/DocumentDataTable";
import { DocumentFooter } from "@/documents/core/DocumentFooter";
import { DocumentHeader } from "@/documents/core/DocumentHeader";
import { DocumentMetaGrid } from "@/documents/core/DocumentMetaGrid";
import { DocumentPage } from "@/documents/core/DocumentPage";
import { chunkDocumentRows, getDocumentPageCount } from "../core/documentPagination";
import { DocumentSection } from "@/documents/core/DocumentSection";
import { DocumentStatusBadge } from "@/documents/core/DocumentStatusBadge";
import type { DocumentTableColumn } from "@/documents/core/DocumentDataTable";
import type { WeldLogDocumentData, WeldLogDocumentRow } from "./weldLogDocument.types";

export type WeldLogDocumentColumnKey =
  | "weldNumber"
  | "jointType"
  | "component"
  | "welder"
  | "wps"
  | "weldDate"
  | "filler"
  | "vt"
  | "pt"
  | "vol"
  | "status";

export const WELD_LOG_DOCUMENT_COLUMNS = [
  { key: "weldNumber", label: "ID", group: "Tegning", width: "3%", align: "center", wrap: "nowrap" },
  { key: "jointType", label: "Fuge", group: "Tegning", width: "5%", align: "center", wrap: "nowrap" },
  { key: "component", label: "Komponent", group: "Tegning", width: "6%", align: "center", wrap: "clamp", clampLines: 2 },
  { key: "welder", label: "Sveiser", group: "Produksjon", width: "10%", align: "center", wrap: "clamp", clampLines: 2 },
  { key: "wps", label: "WPS", group: "Produksjon", width: "8%", align: "center", wrap: "nowrap" },
  { key: "weldDate", label: "Dato", group: "Produksjon", width: "8%", align: "center", wrap: "nowrap" },
  { key: "filler", label: "Tilsett", group: "Produksjon", width: "8%", align: "center", wrap: "nowrap" },
  { key: "vt", label: "VT", group: "Status", width: "13%", align: "center", wrap: "clamp", clampLines: 2 },
  { key: "pt", label: "PT/MT", group: "Status", width: "7%", align: "center", wrap: "nowrap" },
  { key: "vol", label: "RT/UT", group: "Status", width: "8%", align: "center", wrap: "nowrap" },
  {
    key: "status",
    label: "Resultat",
    group: "Status",
    width: "8%",
    align: "center",
    wrap: "nowrap",
    render: (row) => <DocumentStatusBadge label={row.status} />,
  },
] satisfies DocumentTableColumn<WeldLogDocumentRow>[];

export const WELD_LOG_ROWS_PER_PAGE = 18;

export function getWeldLogPageCount(rowCount: number) {
  return getDocumentPageCount(rowCount, WELD_LOG_ROWS_PER_PAGE);
}

type WeldLogDocumentProps = {
  data: WeldLogDocumentData;
  columnKeys?: WeldLogDocumentColumnKey[];
  showMeta?: boolean;
};

export function WeldLogDocument({ data, columnKeys, showMeta = true }: WeldLogDocumentProps) {
  const columns =
    columnKeys?.length
      ? WELD_LOG_DOCUMENT_COLUMNS.filter((column) => columnKeys.includes(column.key as WeldLogDocumentColumnKey))
      : WELD_LOG_DOCUMENT_COLUMNS;
  const footerLeft = `${data.projectLabel || "-"} | ${data.drawingLabel || "-"}`;
  const pages: WeldLogDocumentRow[][] = chunkDocumentRows(data.rows, WELD_LOG_ROWS_PER_PAGE);

  return (
    <>
      {pages.map((rows, index) => {
        const footerRight = [
          pages.length > 1 ? `Side ${index + 1} av ${pages.length}` : "",
          `Generert: ${data.generatedAt}`,
          `Antall sveiser: ${data.rowCount}`,
        ]
          .filter(Boolean)
          .join(" | ");

        return (
          <DocumentPage key={`${data.drawingLabel}-${index}`} orientation="landscape" className="doc-sheet-table">
            <DocumentHeader
              asideWidth="min(540px, 48%)"
              title="Sveiselogg"
              aside={
                showMeta ? (
                  <DocumentMetaGrid
                    columns={3}
                    density="compact"
                    items={[
                      { label: "Prosjekt", value: data.projectLabel },
                      { label: "Prosjektnavn", value: data.projectName || "-" },
                      { label: "Tegning", value: data.drawingLabel },
                    ]}
                  />
                ) : null
              }
            />

            <DocumentSection>
              <DocumentDataTable
                columns={columns}
                rows={rows}
                emptyMessage="Ingen sveiser funnet for valgt tegning."
                getRowKey={(row, rowIndex) => `${row.weldNumber}-${index}-${rowIndex}`}
              />
            </DocumentSection>

            <DocumentFooter left={footerLeft} right={footerRight} />
          </DocumentPage>
        );
      })}
    </>
  );
}

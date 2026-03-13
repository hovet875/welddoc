import { DocumentDataTable } from "@/documents/core/DocumentDataTable";
import { DocumentFooter } from "@/documents/core/DocumentFooter";
import { DocumentHeader } from "@/documents/core/DocumentHeader";
import { DocumentMetaGrid } from "@/documents/core/DocumentMetaGrid";
import { DocumentPage } from "@/documents/core/DocumentPage";
import { chunkDocumentRows, getDocumentPageCount } from "@/documents/core/documentPagination";
import { DocumentSection } from "@/documents/core/DocumentSection";
import type { DocumentTableColumn } from "@/documents/core/DocumentDataTable";
import type {
  MaterialTraceabilityDocumentData,
  MaterialTraceabilityDocumentRow,
} from "./materialTraceabilityDocument.types";

export type MaterialTraceabilityDocumentColumnKey = "code" | "dimensionType" | "materialType" | "heat" | "certificateReference";

export const MATERIAL_TRACEABILITY_DOCUMENT_COLUMNS = [
  { key: "code", label: "Kode", width: "13%", wrap: "nowrap" },
  { key: "dimensionType", label: "Dimensjon / type", width: "33%", wrap: "clamp", clampLines: 2 },
  { key: "materialType", label: "Material / tilsett", width: "26%", wrap: "clamp", clampLines: 2 },
  { key: "heat", label: "Heat", width: "16%", wrap: "nowrap" },
  {
    key: "certificateReference",
    label: "Sertifikat / dokument",
    width: "12%",
    wrap: "clamp",
    clampLines: 2,
  },
] satisfies DocumentTableColumn<MaterialTraceabilityDocumentRow>[];

export const MATERIAL_TRACEABILITY_ROWS_PER_PAGE = 20;

export function getMaterialTraceabilityPageCount(rowCount: number) {
  return getDocumentPageCount(rowCount, MATERIAL_TRACEABILITY_ROWS_PER_PAGE);
}

type MaterialTraceabilityDocumentProps = {
  data: MaterialTraceabilityDocumentData;
  columnKeys?: MaterialTraceabilityDocumentColumnKey[];
  showMeta?: boolean;
};

export function MaterialTraceabilityDocument({
  data,
  columnKeys,
  showMeta = true,
}: MaterialTraceabilityDocumentProps) {
  const columns = columnKeys?.length
    ? MATERIAL_TRACEABILITY_DOCUMENT_COLUMNS.filter((column) =>
        columnKeys.includes(column.key as MaterialTraceabilityDocumentColumnKey)
      )
    : MATERIAL_TRACEABILITY_DOCUMENT_COLUMNS;
  const pages = chunkDocumentRows(data.rows, MATERIAL_TRACEABILITY_ROWS_PER_PAGE);

  return (
    <>
      {pages.map((rows, index) => {
        const footerRight = [
          pages.length > 1 ? `Side ${index + 1} av ${pages.length}` : "",
          `Generert: ${data.generatedAt}`,
          `Antall rader: ${data.rowCount}`,
        ]
          .filter(Boolean)
          .join(" | ");

        return (
          <DocumentPage key={`material-traceability-${index}`} orientation="landscape" className="doc-sheet-table">
            <DocumentHeader
              title="Materialsporbarhet"
              subtitle={pages.length > 1 ? `Del ${index + 1} av ${pages.length}` : undefined}
              aside={
                showMeta ? (
                  <DocumentMetaGrid
                    density="compact"
                    items={[
                      { label: "Prosjekt", value: data.projectLabel },
                      { label: "Prosjektnavn", value: data.projectName || "-" },
                    ]}
                  />
                ) : undefined
              }
            />

            <DocumentSection>
              <DocumentDataTable
                columns={columns}
                rows={rows}
                emptyMessage="Ingen sporbarhetsrader registrert."
                getRowKey={(row, rowIndex) => `${row.code}-${row.heat}-${index}-${rowIndex}`}
              />
            </DocumentSection>

            <DocumentFooter left="WeldDoc dokumentvisning" right={footerRight} />
          </DocumentPage>
        );
      })}
    </>
  );
}

import { Fragment } from "react";
import { DocumentDataTable } from "@/documents/core/DocumentDataTable";
import { DocumentFooter } from "@/documents/core/DocumentFooter";
import { DocumentHeader } from "@/documents/core/DocumentHeader";
import { DocumentPage } from "@/documents/core/DocumentPage";
import { MaterialTraceabilityDocument, getMaterialTraceabilityPageCount } from "@/documents/material-traceability/MaterialTraceabilityDocument";
import { WeldLogDocument, getWeldLogPageCount } from "@/documents/weld-log/WeldLogDocument";
import { chunkDocumentRows, formatDocumentPageRange, getDocumentPageCount } from "../core/documentPagination";
import { DocumentSection } from "@/documents/core/DocumentSection";
import type { DocumentTableColumn } from "@/documents/core/DocumentDataTable";
import { DocumentPackageCoverPage } from "./DocumentPackageCoverPage";
import type {
  DocumentPackageMainPdfContentsRow,
  DocumentPackageMainPdfData,
  DocumentPackageMainPdfOverviewRow,
} from "./documentPackageMainPdf.types";

type RegisterRow = DocumentPackageMainPdfContentsRow & {
  page: string;
};

const CONTENTS_COLUMNS = [
  { key: "order", label: "Del", width: "10%", wrap: "nowrap" },
  { key: "section", label: "Seksjon", width: "30%", wrap: "clamp", clampLines: 2 },
  { key: "description", label: "Beskrivelse", width: "48%", wrap: "clamp", clampLines: 3 },
  { key: "page", label: "Side", width: "12%", wrap: "nowrap", align: "center" },
] satisfies DocumentTableColumn<RegisterRow>[];

const EMPTY_OVERVIEW_COLUMNS = [
  { key: "message", label: "Fil", width: "100%", wrap: "wrap" },
] satisfies DocumentTableColumn<DocumentPackageMainPdfOverviewRow>[];

const REGISTER_ROWS_PER_PAGE = 18;
const PACKAGE_OVERVIEW_PAGE_CAPACITY = 21;
const PACKAGE_OVERVIEW_SECTION_OVERHEAD = 3;
const PACKAGE_OVERVIEW_ROWS_PER_SECTION_PAGE = PACKAGE_OVERVIEW_PAGE_CAPACITY - PACKAGE_OVERVIEW_SECTION_OVERHEAD;

type DocumentPackageMainPdfProps = {
  data: DocumentPackageMainPdfData;
};

type PackageOverviewSlice = {
  section: DocumentPackageMainPdfData["packageOverview"][number];
  rows: DocumentPackageMainPdfOverviewRow[];
  pageIndex: number;
  pageCount: number;
  units: number;
};

function buildRegisterRows(
  data: DocumentPackageMainPdfData,
  pages: {
    cover: string;
    register: string;
    packageOverview: string;
    materialTraceability: string | null;
    weldLogs: string[];
  }
): RegisterRow[] {
  let weldLogIndex = 0;

  return data.contents.map((row) => {
    switch (row.section) {
      case "Forside":
        return { ...row, page: pages.cover };
      case "Register":
        return { ...row, page: pages.register };
      case "Pakkeoversikt":
        return { ...row, page: pages.packageOverview };
      case "Materialsporbarhet":
        return { ...row, page: pages.materialTraceability ?? "" };
      default:
        if (row.section.startsWith("Sveiselogg")) {
          const page = pages.weldLogs[weldLogIndex] ?? "";
          weldLogIndex += 1;
          return { ...row, page };
        }

        return { ...row, page: "" };
    }
  });
}

function buildPackageOverviewPages(sections: DocumentPackageMainPdfData["packageOverview"]) {
  const slices: PackageOverviewSlice[] = sections.flatMap((section) => {
    const rows = chunkDocumentRows(section.rows, PACKAGE_OVERVIEW_ROWS_PER_SECTION_PAGE);
    return rows.map((pageRows, pageIndex) => ({
      section,
      rows: pageRows,
      pageIndex,
      pageCount: rows.length,
      units: pageRows.length + PACKAGE_OVERVIEW_SECTION_OVERHEAD,
    }));
  });

  const pages: PackageOverviewSlice[][] = [];
  let currentPage: PackageOverviewSlice[] = [];
  let currentUnits = 0;

  for (const slice of slices) {
    if (currentPage.length > 0 && currentUnits + slice.units > PACKAGE_OVERVIEW_PAGE_CAPACITY) {
      pages.push(currentPage);
      currentPage = [];
      currentUnits = 0;
    }

    currentPage.push(slice);
    currentUnits += slice.units;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

export function DocumentPackageMainPdf({ data }: DocumentPackageMainPdfProps) {
  const registerPageCount = getDocumentPageCount(data.contents.length, REGISTER_ROWS_PER_PAGE);
  const packageOverviewPages = buildPackageOverviewPages(data.packageOverview);
  const packageOverviewPageCount = Math.max(1, packageOverviewPages.length);
  const materialTraceabilityPageCount = data.materialTraceability
    ? getMaterialTraceabilityPageCount(data.materialTraceability.rowCount)
    : 0;
  const weldLogPageCounts = data.weldLogs.map((row) => getWeldLogPageCount(row.rowCount));

  let nextPage = 1;
  const coverPages = formatDocumentPageRange(nextPage, 1);
  nextPage += 1;
  const registerPagesLabel = formatDocumentPageRange(nextPage, registerPageCount);
  nextPage += registerPageCount;
  const packageOverviewPagesLabel = formatDocumentPageRange(nextPage, packageOverviewPageCount);
  nextPage += packageOverviewPageCount;
  const materialTraceabilityPagesLabel = data.materialTraceability
    ? formatDocumentPageRange(nextPage, materialTraceabilityPageCount)
    : null;
  nextPage += materialTraceabilityPageCount;

  const weldLogPageLabels = weldLogPageCounts.map((pageCount) => {
    const label = formatDocumentPageRange(nextPage, pageCount);
    nextPage += pageCount;
    return label;
  });

  const registerRows = buildRegisterRows(data, {
    cover: coverPages,
    register: registerPagesLabel,
    packageOverview: packageOverviewPagesLabel,
    materialTraceability: materialTraceabilityPagesLabel,
    weldLogs: weldLogPageLabels,
  });

  const registerPages: RegisterRow[][] = chunkDocumentRows(registerRows, REGISTER_ROWS_PER_PAGE);

  return (
    <>
      <DocumentPage orientation="landscape">
        <DocumentPackageCoverPage data={data} />

        <DocumentFooter left="Dokumentasjonspakke" right={`Generert ${data.generatedAt}`} />
      </DocumentPage>

      {registerPages.map((rows: RegisterRow[], index: number) => (
        <DocumentPage key={`register-${index}`} orientation="landscape" className="doc-sheet-table">
          <DocumentHeader title="Register" />

          <DocumentSection title={registerPages.length > 1 ? `Register, del ${index + 1} av ${registerPages.length}` : "Register"}>
            <DocumentDataTable columns={CONTENTS_COLUMNS} rows={rows} emptyMessage="Ingen seksjoner registrert." />
          </DocumentSection>

          <DocumentFooter
            left={data.projectLabel}
            right={registerPages.length > 1 ? `Register ${index + 1}/${registerPages.length}` : `Prosjekt ${data.projectName || "-"}`}
          />
        </DocumentPage>
      ))}

      {packageOverviewPages.length === 0 ? (
        <DocumentPage orientation="landscape" className="doc-sheet-table">
          <DocumentHeader
            title="Pakkeoversikt"
          />

          <DocumentSection title="Pakken inneholder">
            <DocumentDataTable columns={EMPTY_OVERVIEW_COLUMNS} rows={[]} emptyMessage="Ingen leveransedeler registrert." />
          </DocumentSection>

          <DocumentFooter left={data.projectLabel} right={`Prosjekt ${data.projectName || "-"}`} />
        </DocumentPage>
      ) : (
        packageOverviewPages.map((pageSections, index: number) => (
          <DocumentPage key={`package-overview-${index}`} orientation="landscape" className="doc-sheet-table doc-sheet-overview">
            <DocumentHeader
              title="Pakkeoversikt"
            />

            {pageSections.map(({ section, rows, pageIndex, pageCount }) => (
              <DocumentSection key={`${section.key}-${pageIndex}`}>
                <div className="doc-package-overview-section-header">
                  <h2 className="doc-section-title">
                    {section.section}
                    {pageCount > 1 ? `, del ${pageIndex + 1} av ${pageCount}` : ""}
                  </h2>
                  <div className="doc-package-overview-location">{section.location}</div>
                </div>
                <DocumentDataTable columns={section.columns} rows={rows} emptyMessage={section.emptyMessage ?? "Ingen filer registrert."} />
              </DocumentSection>
            ))}

            <DocumentFooter
              left={data.projectLabel}
              right={packageOverviewPages.length > 1 ? `Pakkeoversikt ${index + 1}/${packageOverviewPages.length}` : `Prosjekt ${data.projectName || "-"}`}
            />
          </DocumentPage>
        ))
      )}

      {data.materialTraceability ? <MaterialTraceabilityDocument data={data.materialTraceability} showMeta /> : null}

      {data.weldLogs.map((weldLog, index) => (
        <Fragment key={`${weldLog.drawingLabel}-${index}`}>
          <WeldLogDocument data={weldLog} showMeta />
        </Fragment>
      ))}
    </>
  );
}

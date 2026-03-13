import {
  DOCUMENT_PACKAGE_CATALOG,
  type DocumentPackageCatalogEntry,
  type DocumentPackageDocumentKey,
} from "@/documents/package/documentPackageCatalog";
import type {
  DocumentPackageMainPdfData,
  DocumentPackageMainPdfOverviewColumn,
  DocumentPackageMainPdfOverviewRow,
} from "@/documents/package/documentPackageMainPdf.types";
import type {
  DocumentPackageMainPdfSectionKey,
  DocumentPackageSnapshot,
  DocumentPackageZipDocumentKey,
  DocumentPackageZipFileEntry,
  DocumentPackageZipSection,
  DocumentPackageZipSourceType,
} from "@/documents/package/documentPackageSnapshot";
import type { NdtCertRow, WelderCertRow } from "@/repo/certRepo";
import type { NdtReportRow } from "@/repo/ndtReportRepo";
import type { ProjectTraceabilityRow } from "@/repo/traceabilityRepo";
import type { ProjectWeldRow } from "@/repo/weldLogRepo";
import type { WPQRRow, WPSRow } from "@/repo/wpsRepo";
import type { ProjectRow } from "../../../projectDetails.types";
import { fetchCertData } from "@/repo/certRepo";
import { fetchNdtReports } from "@/repo/ndtReportRepo";
import { fetchProjectDrawings } from "@/repo/projectDrawingRepo";
import { fetchProjectPressureTest } from "@/repo/projectPressureTestRepo";
import { fetchProjectWorkOrder } from "@/repo/projectWorkOrderRepo";
import { fetchProjectTraceability, fetchTraceabilityTypes } from "@/repo/traceabilityRepo";
import { fetchProjectWelds, fetchWeldEmployees, fetchWeldNdtReports } from "@/repo/weldLogRepo";
import { fetchWpsData } from "@/repo/wpsRepo";
import { mapTraceabilityToDocument } from "../../traceability/preview/mapTraceabilityToDocument";
import { mapWeldLogToDocument } from "../../weld-log/preview/mapWeldLogToDocument";
import { collectProjectNdtPersonnelRefs, collectProjectWpsRefs } from "../lib/documentPackageData";

const PACKAGE_DEFINITION_BY_KEY = new Map(DOCUMENT_PACKAGE_CATALOG.map((definition) => [definition.key, definition]));

const WELD_LOG_SOURCE_KEYS: DocumentPackageDocumentKey[] = [
  "wps_wpqr_documents",
  "welder_certificates",
  "ndt_documents",
];

const WORK_ORDER_COLUMNS: DocumentPackageMainPdfOverviewColumn[] = [
  { key: "fileName", label: "Fil", width: "66%", wrap: "clamp", clampLines: 2 },
  { key: "documentType", label: "Dokument", width: "34%", wrap: "nowrap" },
];

const DRAWING_COLUMNS: DocumentPackageMainPdfOverviewColumn[] = [
  { key: "fileName", label: "Fil", width: "44%", wrap: "clamp", clampLines: 2 },
  { key: "drawingNo", label: "Tegningsnr.", width: "36%", wrap: "nowrap" },
  { key: "revision", label: "Rev.", width: "20%", wrap: "nowrap", align: "center" },
];

const MATERIAL_CERTIFICATE_COLUMNS: DocumentPackageMainPdfOverviewColumn[] = [
  { key: "fileName", label: "Fil", width: "34%", wrap: "clamp", clampLines: 2 },
  { key: "certType", label: "Sert.type", width: "10%", wrap: "nowrap", align: "center" },
  { key: "heatNumbers", label: "Smelte / heat", width: "24%", wrap: "clamp", clampLines: 2 },
  { key: "supplier", label: "Leverandør", width: "32%", wrap: "clamp", clampLines: 2 },
];

const FILLER_CERTIFICATE_COLUMNS: DocumentPackageMainPdfOverviewColumn[] = [
  { key: "fileName", label: "Fil", width: "24%", wrap: "clamp", clampLines: 2 },
  { key: "certType", label: "Sert.type", width: "10%", wrap: "nowrap", align: "center" },
  { key: "manufacturer", label: "Produsent", width: "24%", wrap: "clamp", clampLines: 2 },
  { key: "fillerType", label: "Tilsett", width: "28%", wrap: "clamp", clampLines: 2 },
  { key: "diameter", label: "Dia.", width: "14%", wrap: "nowrap", align: "center" },
];

const WPS_WPQR_COLUMNS: DocumentPackageMainPdfOverviewColumn[] = [
  { key: "fileName", label: "Fil", width: "26%", wrap: "clamp", clampLines: 2 },
  { key: "documentType", label: "Type", width: "10%", wrap: "nowrap", align: "center" },
  { key: "documentNo", label: "Nummer", width: "18%", wrap: "nowrap" },
  { key: "standard", label: "Standard", width: "46%", wrap: "clamp", clampLines: 2 },
];

const WELDER_CERTIFICATE_COLUMNS: DocumentPackageMainPdfOverviewColumn[] = [
  { key: "fileName", label: "Fil", width: "18%", wrap: "clamp", clampLines: 2 },
  { key: "welder", label: "Sveiser", width: "22%", wrap: "clamp", clampLines: 2 },
  { key: "certificateNo", label: "Sertifikatnr.", width: "24%", wrap: "nowrap" },
  { key: "standard", label: "Standard", width: "22%", wrap: "clamp", clampLines: 2 },
  { key: "expiresAt", label: "Utløper", width: "14%", wrap: "nowrap", align: "center" },
];

const NDT_REPORT_COLUMNS: DocumentPackageMainPdfOverviewColumn[] = [
  { key: "fileName", label: "Fil", width: "26%", wrap: "clamp", clampLines: 2 },
  { key: "method", label: "Metode", width: "12%", wrap: "nowrap", align: "center" },
  { key: "supplier", label: "Leverandør", width: "24%", wrap: "clamp", clampLines: 2 },
  { key: "inspector", label: "Inspektør", width: "23%", wrap: "clamp", clampLines: 2 },
  { key: "reportDate", label: "Rapportdato", width: "15%", wrap: "nowrap", align: "center" },
];

const NDT_PERSONNEL_COLUMNS: DocumentPackageMainPdfOverviewColumn[] = [
  { key: "fileName", label: "Fil", width: "18%", wrap: "clamp", clampLines: 2 },
  { key: "personnel", label: "Personell", width: "20%", wrap: "clamp", clampLines: 2 },
  { key: "company", label: "Firma", width: "22%", wrap: "clamp", clampLines: 2 },
  { key: "method", label: "Metode", width: "12%", wrap: "nowrap", align: "center" },
  { key: "certificateNo", label: "Sertifikatnr.", width: "15%", wrap: "nowrap" },
  { key: "expiresAt", label: "Utløper", width: "13%", wrap: "nowrap", align: "center" },
];

const CALIBRATION_COLUMNS: DocumentPackageMainPdfOverviewColumn[] = [
  { key: "fileName", label: "Fil", width: "70%", wrap: "clamp", clampLines: 2 },
  { key: "documentType", label: "Dokument", width: "30%", wrap: "nowrap" },
];

type PendingZipFileEntry = {
  fileId: string;
  label: string;
  mimeType: string | null;
  sizeBytes: number | null;
  sortKey: string;
  sourceType: DocumentPackageZipSourceType;
  sourceId: string;
};

export type BuildDocumentPackageSnapshotOptions = {
  requestedDocuments?: DocumentPackageDocumentKey[];
};

function formatGeneratedAt() {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

function formatDrawingLabel(input: { drawing_no?: string | null; revision?: string | null } | null | undefined) {
  const drawingNo = String(input?.drawing_no ?? "").trim();
  const revision = String(input?.revision ?? "").trim();
  if (!drawingNo) return "Sveiselogg";
  if (!revision || revision === "-") return drawingNo;
  return `${drawingNo} rev ${revision}`;
}

function selectedPackageDefinitions(requestedDocuments: DocumentPackageDocumentKey[]) {
  return requestedDocuments
    .map((key) => PACKAGE_DEFINITION_BY_KEY.get(key))
    .filter((definition): definition is DocumentPackageCatalogEntry => Boolean(definition));
}

function overviewDescription(definition: DocumentPackageCatalogEntry) {
  if (definition.folderName) return `Leveres i ${definition.folderName}/`;
  return definition.description;
}

function pushOverviewSection(
  sections: DocumentPackageMainPdfData["packageOverview"],
  definition: DocumentPackageCatalogEntry,
  options: {
    columns: DocumentPackageMainPdfOverviewColumn[];
    rows: DocumentPackageMainPdfOverviewRow[];
    keySuffix?: string;
    sectionLabel?: string;
    location?: string;
    emptyMessage?: string;
  }
) {
  if (options.rows.length === 0) return false;
  sections.push({
    key: options.keySuffix ? `${definition.key}-${options.keySuffix}` : definition.key,
    section: options.sectionLabel ?? definition.label,
    location: options.location ?? overviewDescription(definition),
    columns: options.columns,
    rows: options.rows,
    emptyMessage: options.emptyMessage,
  });
  return true;
}

function normalizeCell(value: string | number | null | undefined) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function createOverviewRow(values: Record<string, string | number | null | undefined>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, normalizeCell(value)])
  ) as DocumentPackageMainPdfOverviewRow;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function formatDisplayDate(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "-";
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(normalized));
  } catch {
    return normalized;
  }
}

function formatStandardLabel(standard: { label: string; revision: number | null } | null | undefined) {
  if (!standard?.label) return "-";
  if (standard.revision == null) return standard.label;
  return `${standard.label} rev ${standard.revision}`;
}

function formatWelderLabel(row: WelderCertRow) {
  const welderNo = String(row.profile?.welder_no ?? "").trim();
  const displayName = String(row.profile?.display_name ?? "").trim();
  return [welderNo, displayName].filter(Boolean).join(" - ") || row.certificate_no || row.id;
}

function sanitizeFileNamePart(value: string) {
  const normalized = String(value)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || "document";
}

function inferFileExtension(label: string, mimeType: string | null | undefined) {
  const match = /\.([A-Za-z0-9]{1,12})$/.exec(String(label).trim());
  if (match) return `.${match[1]}`;
  if (mimeType === "application/zip") return ".zip";
  return ".pdf";
}

function buildZipFileEntries(folderName: string, entries: PendingZipFileEntry[]): DocumentPackageZipFileEntry[] {
  const uniqueEntries = new Map<string, PendingZipFileEntry>();
  for (const entry of entries) {
    if (!uniqueEntries.has(entry.fileId)) {
      uniqueEntries.set(entry.fileId, entry);
    }
  }

  const usedNames = new Set<string>();

  return Array.from(uniqueEntries.values())
    .sort((left, right) => {
      const sortComparison = left.sortKey.localeCompare(right.sortKey, "nb-NO");
      if (sortComparison !== 0) return sortComparison;
      return left.label.localeCompare(right.label, "nb-NO");
    })
    .map((entry) => {
      const extension = inferFileExtension(entry.label, entry.mimeType);
      const baseName = sanitizeFileNamePart(String(entry.label).replace(/\.[A-Za-z0-9]{1,12}$/, ""));
      let suffix = 1;
      let outputFileName = `${baseName}${extension}`;

      while (usedNames.has(outputFileName.toLowerCase())) {
        suffix += 1;
        outputFileName = `${baseName}-${suffix}${extension}`;
      }

      usedNames.add(outputFileName.toLowerCase());

      return {
        file_id: entry.fileId,
        label: entry.label,
        mime_type: entry.mimeType,
        size_bytes: entry.sizeBytes,
        output_file_name: outputFileName,
        relative_path: `${folderName}/${outputFileName}`,
        sort_key: entry.sortKey,
        source_type: entry.sourceType,
        source_id: entry.sourceId,
      };
    });
}

function pushZipSection(
  sections: DocumentPackageZipSection[],
  definition: DocumentPackageCatalogEntry,
  entries: PendingZipFileEntry[]
) {
  if (definition.key === "package_main_pdf" || !definition.folderName || entries.length === 0) return false;
  sections.push({
    document_key: definition.key,
    label: definition.label,
    folder_name: definition.folderName,
    files: buildZipFileEntries(definition.folderName, entries),
  });
  return true;
}

function createMainPdfSectionKeys(data: DocumentPackageMainPdfData): DocumentPackageMainPdfSectionKey[] {
  const keys: DocumentPackageMainPdfSectionKey[] = ["cover_page", "table_of_contents", "package_overview"];
  if (data.materialTraceability) keys.push("material_traceability");
  if (data.weldLogs.length > 0) keys.push("weld_log");
  return keys;
}

function collectTraceabilityCertificateOverviewRows(
  rows: ProjectTraceabilityRow[],
  certificateType: "material" | "filler"
) {
  const refs = new Map<
    string,
    {
      id: string;
      fileId: string;
      fileName: string;
      certType: string;
      supplier: string;
      heatNumbers: string[];
      fillerManufacturer: string;
      fillerType: string;
      fillerDiameter: string;
    }
  >();

  for (const row of rows) {
    const cert = row.cert;
    if (!cert || cert.certificate_type !== certificateType || !cert.id || !cert.file_id) continue;

    const current = refs.get(cert.id) ?? {
      id: cert.id,
      fileId: cert.file_id,
      fileName: cert.file?.label ?? `${certificateType === "material" ? "Material" : "Tilsett"}sertifikat`,
      certType: cert.cert_type,
      supplier: cert.supplier ?? "",
      heatNumbers: [],
      fillerManufacturer: "",
      fillerType: "",
      fillerDiameter: "",
    };

    current.fileId = current.fileId || cert.file_id;
    current.fileName = current.fileName || cert.file?.label || current.fileName;
    current.certType = current.certType || cert.cert_type;
    current.supplier = current.supplier || cert.supplier || "";
    current.heatNumbers = uniqueStrings([...current.heatNumbers, ...(cert.heat_numbers ?? []), row.heat_number]);
    current.fillerManufacturer = current.fillerManufacturer || row.filler_manufacturer || "";
    current.fillerType = current.fillerType || row.filler_type || "";
    current.fillerDiameter = current.fillerDiameter || row.filler_diameter || "";

    refs.set(cert.id, current);
  }

  return Array.from(refs.values());
}

function collectSelectedWpqrRows(wpsRows: WPSRow[], wpqrRows: WPQRRow[]) {
  const wpqrById = new Map(wpqrRows.map((row) => [row.id, row]));
  const selectedIds = uniqueStrings(wpsRows.map((row) => row.wpqr?.id));
  return selectedIds.map((id) => wpqrById.get(id)).filter((row): row is WPQRRow => Boolean(row));
}

function collectSelectedWelderCertRows(welds: ProjectWeldRow[], certRows: WelderCertRow[]) {
  const certById = new Map(certRows.map((row) => [row.id, row]));
  return uniqueStrings(welds.map((row) => row.welder_cert_id))
    .map((id) => certById.get(id))
    .filter((row): row is WelderCertRow => Boolean(row));
}

function collectSelectedNdtReportRows(welds: ProjectWeldRow[], reportRows: NdtReportRow[]) {
  const reportById = new Map(reportRows.map((row) => [row.id, row]));
  const reportIds = uniqueStrings(
    welds.flatMap((row) => [row.visual_report?.id, row.crack_report?.id, row.volumetric_report?.id])
  );

  return reportIds.map((id) => reportById.get(id)).filter((row): row is NdtReportRow => Boolean(row));
}

function collectSelectedNdtPersonnelRows(
  welds: ProjectWeldRow[],
  reportRows: NdtReportRow[],
  certRows: NdtCertRow[]
) {
  const linkedCertIds = new Set(
    collectProjectNdtPersonnelRefs(
      welds
        .flatMap((row) => [row.visual_report?.id, row.crack_report?.id, row.volumetric_report?.id])
        .filter((value): value is string => Boolean(value)),
      reportRows,
      certRows
    ).rows.map((row) => row.id)
  );

  return certRows.filter((row) => linkedCertIds.has(row.id));
}

export async function buildDocumentPackageSnapshot(
  project: ProjectRow,
  options?: BuildDocumentPackageSnapshotOptions
): Promise<DocumentPackageSnapshot> {
  const requestedDocuments = Array.from(
    new Set(options?.requestedDocuments?.length ? options.requestedDocuments : ["package_main_pdf"])
  ) as DocumentPackageDocumentKey[];
  const requestedDocumentSet = new Set(requestedDocuments);
  const requestedZipDocumentKeys = requestedDocuments.filter(
    (key): key is DocumentPackageZipDocumentKey => key !== "package_main_pdf"
  );

  const [
    workOrder,
    drawings,
    traceabilityRows,
    traceabilityTypes,
    weldData,
    wpsData,
    certData,
    employees,
    weldReports,
    ndtReports,
    pressureTest,
  ] = await Promise.all([
    fetchProjectWorkOrder(project.id),
    fetchProjectDrawings(project.id),
    fetchProjectTraceability(project.id),
    fetchTraceabilityTypes(),
    fetchProjectWelds(project.id),
    fetchWpsData(),
    fetchCertData(),
    fetchWeldEmployees(),
    fetchWeldNdtReports(String(project.project_no)),
    fetchNdtReports(),
    fetchProjectPressureTest(project.id),
  ]);

  const generatedAt = formatGeneratedAt();
  const materialTraceabilityData = mapTraceabilityToDocument({
    project,
    rows: traceabilityRows,
    types: traceabilityTypes,
  });

  const wpsRefs = collectProjectWpsRefs(weldData.welds, wpsData.wps);
  const materialCertRows = collectTraceabilityCertificateOverviewRows(traceabilityRows, "material");
  const fillerCertRows = collectTraceabilityCertificateOverviewRows(traceabilityRows, "filler");
  const selectedWpqrRows = collectSelectedWpqrRows(wpsRefs.rows, wpsData.wpqr);
  const selectedWelderCertRows = collectSelectedWelderCertRows(weldData.welds, certData.welderCerts);
  const selectedNdtReportRows = collectSelectedNdtReportRows(weldData.welds, ndtReports);
  const selectedNdtPersonnelRows = collectSelectedNdtPersonnelRows(weldData.welds, ndtReports, certData.ndtCerts);

  const includeTraceabilitySection =
    materialTraceabilityData.rowCount > 0 &&
    (requestedDocumentSet.has("material_certificates") || requestedDocumentSet.has("filler_certificates"));
  const includeWeldLogSection =
    weldData.welds.length > 0 && WELD_LOG_SOURCE_KEYS.some((key) => requestedDocumentSet.has(key));

  const weldLogsFromProject = weldData.logs
    .map((log) => {
      const rows = weldData.welds.filter((row) => row.log_id === log.id);
      return mapWeldLogToDocument({
        project,
        drawingLabel: formatDrawingLabel(log.drawing),
        rows,
        reports: weldReports,
        employees,
        welders: certData.welders,
      });
    })
    .filter((row) => row.rowCount > 0);

  const weldLogs = includeWeldLogSection
    ? (weldLogsFromProject.length > 0
        ? weldLogsFromProject
        : [
            mapWeldLogToDocument({
              project,
              drawingLabel: "Hele prosjektet",
              rows: weldData.welds,
              reports: weldReports,
              employees,
              welders: certData.welders,
            }),
          ])
    : [];

  const packageOverview: DocumentPackageMainPdfData["packageOverview"] = [];
  const zipSections: DocumentPackageZipSection[] = [];
  const includedOverviewDocumentKeys = new Set<DocumentPackageDocumentKey>();
  const includedZipDocumentKeys = new Set<DocumentPackageZipDocumentKey>();

  for (const definition of selectedPackageDefinitions(requestedDocuments)) {
    if (definition.key === "package_main_pdf") continue;

    if (definition.key === "project_work_order") {
      if (!workOrder?.file_id) continue;

      if (
        pushOverviewSection(packageOverview, definition, {
          columns: WORK_ORDER_COLUMNS,
          rows: [
            createOverviewRow({
              fileName: workOrder.file?.label ?? "Arbeidsordre",
              documentType: "Arbeidsordre PDF",
            }),
          ],
        })
      ) {
        includedOverviewDocumentKeys.add(definition.key);
      }

      if (
        pushZipSection(zipSections, definition, [
          {
            fileId: workOrder.file_id,
            label: workOrder.file?.label ?? "Arbeidsordre.pdf",
            mimeType: null,
            sizeBytes: null,
            sortKey: "001",
            sourceType: "project_work_order",
            sourceId: workOrder.entity_id,
          },
        ])
      ) {
        includedZipDocumentKeys.add(definition.key);
      }

      continue;
    }

    if (definition.key === "project_drawings") {
      const drawingFiles = drawings.filter((row) => Boolean(row.file_id));
      if (drawingFiles.length === 0) continue;

      if (
        pushOverviewSection(packageOverview, definition, {
          columns: DRAWING_COLUMNS,
          rows: drawingFiles.map((row) =>
            createOverviewRow({
              fileName: row.file?.label ?? row.drawing_no ?? "Tegning",
              drawingNo: row.drawing_no,
              revision: row.revision,
            })
          ),
        })
      ) {
        includedOverviewDocumentKeys.add(definition.key);
      }

      if (
        pushZipSection(
          zipSections,
          definition,
          drawingFiles.map((row, index) => ({
            fileId: row.file_id!,
            label: row.file?.label ?? row.drawing_no ?? `Tegning-${index + 1}.pdf`,
            mimeType: null,
            sizeBytes: null,
            sortKey: `${String(index + 1).padStart(3, "0")}-${row.drawing_no ?? row.id}`,
            sourceType: "project_drawing",
            sourceId: row.id,
          }))
        )
      ) {
        includedZipDocumentKeys.add(definition.key);
      }

      continue;
    }

    if (definition.key === "material_certificates") {
      if (
        pushOverviewSection(packageOverview, definition, {
          columns: MATERIAL_CERTIFICATE_COLUMNS,
          rows: materialCertRows.map((row) =>
            createOverviewRow({
              fileName: row.fileName,
              certType: row.certType,
              heatNumbers: row.heatNumbers.join(", "),
              supplier: row.supplier,
            })
          ),
        })
      ) {
        includedOverviewDocumentKeys.add(definition.key);
      }

      if (
        pushZipSection(
          zipSections,
          definition,
          materialCertRows.map((row, index) => ({
            fileId: row.fileId,
            label: row.fileName,
            mimeType: null,
            sizeBytes: null,
            sortKey: `${String(index + 1).padStart(3, "0")}-${row.certType}-${row.id}`,
            sourceType: "material_certificate",
            sourceId: row.id,
          }))
        )
      ) {
        includedZipDocumentKeys.add(definition.key);
      }

      continue;
    }

    if (definition.key === "filler_certificates") {
      if (
        pushOverviewSection(packageOverview, definition, {
          columns: FILLER_CERTIFICATE_COLUMNS,
          rows: fillerCertRows.map((row) =>
            createOverviewRow({
              fileName: row.fileName,
              certType: row.certType,
              manufacturer: row.fillerManufacturer || row.supplier,
              fillerType: row.fillerType,
              diameter: row.fillerDiameter,
            })
          ),
        })
      ) {
        includedOverviewDocumentKeys.add(definition.key);
      }

      if (
        pushZipSection(
          zipSections,
          definition,
          fillerCertRows.map((row, index) => ({
            fileId: row.fileId,
            label: row.fileName,
            mimeType: null,
            sizeBytes: null,
            sortKey: `${String(index + 1).padStart(3, "0")}-${row.certType}-${row.id}`,
            sourceType: "filler_certificate",
            sourceId: row.id,
          }))
        )
      ) {
        includedZipDocumentKeys.add(definition.key);
      }

      continue;
    }

    if (definition.key === "wps_wpqr_documents") {
      const overviewRows = [
        ...wpsRefs.rows
          .filter((row) => Boolean(row.file_id))
          .map((row) =>
            createOverviewRow({
              fileName: row.file?.label ?? row.doc_no ?? row.id,
              documentType: "WPS",
              documentNo: row.doc_no,
              standard: formatStandardLabel(row.standard),
            })
          ),
        ...selectedWpqrRows
          .filter((row) => Boolean(row.file_id))
          .map((row) =>
            createOverviewRow({
              fileName: row.file?.label ?? row.doc_no ?? row.id,
              documentType: "WPQR",
              documentNo: row.doc_no,
              standard: formatStandardLabel(row.standard),
            })
          ),
      ];

      if (pushOverviewSection(packageOverview, definition, { columns: WPS_WPQR_COLUMNS, rows: overviewRows })) {
        includedOverviewDocumentKeys.add(definition.key);
      }

      const zipEntries: PendingZipFileEntry[] = [
        ...wpsRefs.rows
          .filter((row) => Boolean(row.file_id))
          .map((row, index) => ({
            fileId: row.file_id!,
            label: row.file?.label ?? row.doc_no ?? `${row.id}.pdf`,
            mimeType: null,
            sizeBytes: null,
            sortKey: `wps-${String(index + 1).padStart(3, "0")}-${row.doc_no ?? row.id}`,
            sourceType: "wps" as const,
            sourceId: row.id,
          })),
        ...selectedWpqrRows
          .filter((row) => Boolean(row.file_id))
          .map((row, index) => ({
            fileId: row.file_id!,
            label: row.file?.label ?? row.doc_no ?? `${row.id}.pdf`,
            mimeType: null,
            sizeBytes: null,
            sortKey: `wpqr-${String(index + 1).padStart(3, "0")}-${row.doc_no ?? row.id}`,
            sourceType: "wpqr" as const,
            sourceId: row.id,
          })),
      ];

      if (pushZipSection(zipSections, definition, zipEntries)) {
        includedZipDocumentKeys.add(definition.key);
      }

      continue;
    }

    if (definition.key === "welder_certificates") {
      const rows = selectedWelderCertRows.filter((row) => Boolean(row.file_id));

      if (
        pushOverviewSection(packageOverview, definition, {
          columns: WELDER_CERTIFICATE_COLUMNS,
          rows: rows.map((row) =>
            createOverviewRow({
              fileName: row.file?.label ?? row.certificate_no ?? row.id,
              welder: formatWelderLabel(row),
              certificateNo: row.certificate_no,
              standard: row.standard,
              expiresAt: formatDisplayDate(row.expires_at),
            })
          ),
        })
      ) {
        includedOverviewDocumentKeys.add(definition.key);
      }

      if (
        pushZipSection(
          zipSections,
          definition,
          rows.map((row, index) => ({
            fileId: row.file_id!,
            label: row.file?.label ?? row.certificate_no ?? `${row.id}.pdf`,
            mimeType: null,
            sizeBytes: null,
            sortKey: `${String(index + 1).padStart(3, "0")}-${row.certificate_no ?? row.id}`,
            sourceType: "welder_certificate",
            sourceId: row.id,
          }))
        )
      ) {
        includedZipDocumentKeys.add(definition.key);
      }

      continue;
    }

    if (definition.key === "ndt_documents") {
      const reportRows = selectedNdtReportRows.filter((row) => Boolean(row.file_id));
      const personnelRows = selectedNdtPersonnelRows.filter((row) => Boolean(row.file_id));

      const reportsAdded = pushOverviewSection(packageOverview, definition, {
        keySuffix: "reports",
        sectionLabel: "NDT-rapporter",
        columns: NDT_REPORT_COLUMNS,
        rows: reportRows.map((row) =>
          createOverviewRow({
            fileName: row.file?.label ?? row.title ?? row.id,
            method: row.method?.label ?? row.method?.code,
            supplier: row.ndt_supplier?.name,
            inspector: row.ndt_inspector?.name,
            reportDate: formatDisplayDate(row.report_date),
          })
        ),
      });

      const personnelAdded = pushOverviewSection(packageOverview, definition, {
        keySuffix: "personnel",
        sectionLabel: "NDT-personellsertifikater",
        columns: NDT_PERSONNEL_COLUMNS,
        rows: personnelRows.map((row) =>
          createOverviewRow({
            fileName: row.file?.label ?? row.certificate_no ?? row.id,
            personnel: row.personnel_name,
            company: row.company,
            method: row.ndt_method,
            certificateNo: row.certificate_no,
            expiresAt: formatDisplayDate(row.expires_at),
          })
        ),
      });

      if (reportsAdded || personnelAdded) {
        includedOverviewDocumentKeys.add(definition.key);
      }

      const zipEntries: PendingZipFileEntry[] = [
        ...reportRows.map((row, index) => ({
          fileId: row.file_id!,
          label: row.file?.label ?? row.title ?? `${row.id}.pdf`,
          mimeType: null,
          sizeBytes: null,
          sortKey: `report-${String(index + 1).padStart(3, "0")}-${row.title ?? row.id}`,
          sourceType: "ndt_report" as const,
          sourceId: row.id,
        })),
        ...personnelRows.map((row, index) => ({
          fileId: row.file_id!,
          label: row.file?.label ?? row.certificate_no ?? `${row.id}.pdf`,
          mimeType: null,
          sizeBytes: null,
          sortKey: `personnel-${String(index + 1).padStart(3, "0")}-${row.certificate_no ?? row.id}`,
          sourceType: "ndt_personnel_certificate" as const,
          sourceId: row.id,
        })),
      ];

      if (pushZipSection(zipSections, definition, zipEntries)) {
        includedZipDocumentKeys.add(definition.key);
      }

      continue;
    }

    if (definition.key === "calibration_certificates") {
      if (!pressureTest.meta?.gauge_cert_file_id) continue;

      if (
        pushOverviewSection(packageOverview, definition, {
          columns: CALIBRATION_COLUMNS,
          rows: [
            createOverviewRow({
              fileName: pressureTest.meta.gauge_file?.label ?? "Kalibreringssertifikat",
              documentType: "Kalibreringssertifikat",
            }),
          ],
        })
      ) {
        includedOverviewDocumentKeys.add(definition.key);
      }

      if (
        pushZipSection(zipSections, definition, [
          {
            fileId: pressureTest.meta.gauge_cert_file_id,
            label: pressureTest.meta.gauge_file?.label ?? "Kalibreringssertifikat.pdf",
            mimeType: null,
            sizeBytes: null,
            sortKey: "001",
            sourceType: "calibration_certificate",
            sourceId: pressureTest.meta.id,
          },
        ])
      ) {
        includedZipDocumentKeys.add(definition.key);
      }
    }
  }

  const materialTraceability = includeTraceabilitySection
    ? {
        ...materialTraceabilityData,
        generatedAt,
      }
    : null;

  const contents: DocumentPackageMainPdfData["contents"] = [];
  let sectionOrder = 1;

  contents.push({
    order: String(sectionOrder++).padStart(2, "0"),
    section: "Forside",
    description: "Prosjektidentitet og leveranseinformasjon for dokumentasjonspakken.",
  });
  contents.push({
    order: String(sectionOrder++).padStart(2, "0"),
    section: "Register",
    description: "Oversikt over seksjonene som faktisk inngar i leveransen.",
  });
  contents.push({
    order: String(sectionOrder++).padStart(2, "0"),
    section: "Pakkeoversikt",
    description: `${includedOverviewDocumentKeys.size} valgt leveransedel${includedOverviewDocumentKeys.size === 1 ? "" : "er"} i ZIP-strukturen.`,
  });

  if (materialTraceability) {
    contents.push({
      order: String(sectionOrder++).padStart(2, "0"),
      section: "Materialsporbarhet",
      description: `${materialTraceability.rowCount} sporbarhetsrad${materialTraceability.rowCount === 1 ? "" : "er"}.`,
    });
  }

  for (const weldLog of weldLogs) {
    contents.push({
      order: String(sectionOrder++).padStart(2, "0"),
      section: `Sveiselogg - ${weldLog.drawingLabel}`,
      description: `${weldLog.rowCount} sveis${weldLog.rowCount === 1 ? "" : "er"}.`,
    });
  }

  const mainPdfData: DocumentPackageMainPdfData = {
    projectLabel: String(project.project_no ?? "").trim() || project.name || "-",
    projectName: project.name || "",
    customer: project.customer || "",
    workOrder: project.work_order || workOrder?.file?.label || "",
    generatedAt,
    includedDocumentCount: includedOverviewDocumentKeys.size,
    traceabilityRowCount: materialTraceability?.rowCount ?? 0,
    weldRowCount: weldLogs.reduce((sum, row) => sum + row.rowCount, 0),
    weldLogCount: weldLogs.filter((row) => row.rowCount > 0).length,
    contents,
    packageOverview,
    materialTraceability,
    weldLogs: weldLogs.map((row) => ({
      ...row,
      generatedAt,
    })),
  };

  const warnings = requestedZipDocumentKeys
    .filter((key) => !includedZipDocumentKeys.has(key))
    .map((key) => `${PACKAGE_DEFINITION_BY_KEY.get(key)?.label ?? key} ble valgt uten filer i snapshot.`);

  const mainPdfEnabled = requestedDocumentSet.has("package_main_pdf");

  return {
    snapshot_version: 1,
    generated_at: generatedAt,
    requested_documents: requestedDocuments,
    main_pdf: {
      enabled: mainPdfEnabled,
      section_keys: mainPdfEnabled ? createMainPdfSectionKeys(mainPdfData) : [],
      data: mainPdfEnabled ? mainPdfData : null,
    },
    source_zip: {
      enabled: zipSections.length > 0,
      document_keys: Array.from(includedZipDocumentKeys),
      sections: zipSections,
      total_files: zipSections.reduce((sum, section) => sum + section.files.length, 0),
    },
    warnings,
  };
}

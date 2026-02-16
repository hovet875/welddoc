import type { ProjectRow } from "../../../repo/projectRepo";
import type { ProjectWorkOrderRow } from "../../../repo/projectWorkOrderRepo";
import type { ProjectDrawingRow } from "../../../repo/projectDrawingRepo";
import type { ProjectTraceabilityRow, TraceabilityTypeRow } from "../../../repo/traceabilityRepo";

import { fetchProjectWorkOrder } from "../../../repo/projectWorkOrderRepo";
import { fetchProjectDrawings } from "../../../repo/projectDrawingRepo";
import { fetchProjectTraceability, fetchTraceabilityTypes } from "../../../repo/traceabilityRepo";
import { fetchProjectWeldLogs } from "../../../repo/weldLogRepo";
import { fetchNdtReports, type NdtReportRow as RepoNdtReportRow } from "../../../repo/ndtReportRepo";
import { fetchWpsData, type WPQRRow, type WPSRow } from "../../../repo/wpsRepo";
import { supabase } from "../../../services/supabaseClient";
import { createSignedUrlForFileRef } from "../../../repo/fileRepo";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { esc, qs } from "../../../utils/dom";
import { createZipBlob, type ZipEntryInput } from "../../../utils/zip";
import { toast } from "../../../ui/toast";
import { listEmployees, listNdtReports, listWelds } from "./weld-log/api";
import type { EmployeeOption, NdtReportRow, WeldListRow } from "./weld-log/types";

type SectionKey = "workorder" | "drawings" | "traceability" | "weldlog" | "wps" | "wpqr" | "ndt";

type PackageSelection = {
  includeCover: boolean;
  includeWorkOrder: boolean;
  includeDrawings: boolean;
  includeTraceability: boolean;
  includeWeldLog: boolean;
  includeWps: boolean;
  includeUsedWpqr: boolean;
  includeNdt: boolean;
};

type PackageData = {
  generatedAt: string;
  workOrder: ProjectWorkOrderRow | null;
  drawings: ProjectDrawingRow[];
  traceability: ProjectTraceabilityRow[];
  traceabilityTypes: TraceabilityTypeRow[];
  welds: WeldListRow[];
  usedWps: WPSRow[];
  usedWpqr: WPQRRow[];
  ndtReports: NdtReportRow[];
  employees: EmployeeOption[];
};

type Descriptor = {
  className: string;
  contentHtml: string;
};

type SectionStat = {
  key: SectionKey;
  title: string;
  startPage: number;
  pageCount: number;
  rowCount: number;
};

type DocTable = {
  key: SectionKey;
  title: string;
  columns: string[];
  rows: string[][];
};

type ZipCandidate = {
  fileId: string;
  folder: string;
  fileName: string;
  source: string;
  originalLabel: string;
};

type ZipManifestRow = {
  targetPath: string;
  source: string;
  fileId: string;
  originalLabel: string;
  note: string;
};

const DASH = "-";

const sectionTitleByKey: Record<SectionKey, string> = {
  workorder: "Arbeidsordre",
  drawings: "Tegninger",
  traceability: "Materialsporbarhet",
  weldlog: "Sveiselogg",
  wps: "Sveiseprosedyrer",
  wpqr: "WPQR (koblet til brukte WPS)",
  ndt: "NDT-rapporter",
};

const zipFolderNames = {
  workorder: "01_Arbeidsordre",
  drawings: "02_Tegninger",
  traceability: "03_Materialsertifikater",
  ndt: "04_NDT",
  wps: "05_WPS",
  wpqr: "06_WPQR",
};

const sanitizeFilePart = (value: string, fallback = "fil") => {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/\.[a-z0-9]{1,6}$/i, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return cleaned || fallback;
};

const extensionFromLabel = (label: string | null | undefined, fallback = "pdf") => {
  const text = String(label ?? "").trim();
  const match = text.match(/\.([a-z0-9]{1,8})$/i);
  if (!match) return fallback;
  return match[1].toLowerCase();
};

const ensureExt = (base: string, ext: string) => {
  const safeExt = ext.replace(/^\./, "").trim().toLowerCase() || "pdf";
  if (new RegExp(`\\.${safeExt}$`, "i").test(base)) return base;
  return `${base}.${safeExt}`;
};

const csvEscape = (value: string) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return DASH;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}.${mm}.${yyyy}`;
  }
  return raw;
};

const formatGeneratedAt = (date: Date) => {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
};

const formatBytes = (bytes: number | null | undefined) => {
  if (bytes == null || !Number.isFinite(bytes)) return DASH;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const normalizeNo = (value: string | number | null | undefined) => {
  const text = String(value ?? "").trim();
  if (!text) return Number.POSITIVE_INFINITY;
  const num = Number(text);
  if (!Number.isFinite(num)) return Number.POSITIVE_INFINITY;
  return num;
};

const chunkRows = <T>(rows: T[], size: number): T[][] => {
  if (!rows.length) return [[]];
  const chunks: T[][] = [];
  for (let idx = 0; idx < rows.length; idx += size) {
    chunks.push(rows.slice(idx, idx + size));
  }
  return chunks;
};

const renderSectionTable = (opts: {
  columns: string[];
  rows: string[][];
  compact?: boolean;
  emptyMessage: string;
}) => {
  const { columns, rows, compact, emptyMessage } = opts;
  const tableClass = `docpack-table${compact ? " is-compact" : ""}`;
  const bodyHtml = rows.length
    ? rows
        .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell || DASH)}</td>`).join("")}</tr>`)
        .join("")
    : `<tr><td colspan="${columns.length}" class="is-empty">${esc(emptyMessage)}</td></tr>`;

  return `
    <div class="docpack-table-wrap">
      <table class="${tableClass}">
        <thead>
          <tr>${columns.map((column) => `<th>${esc(column)}</th>`).join("")}</tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
};

const renderSectionPage = (opts: { title: string; subtitle?: string; bodyHtml: string }) => {
  const logoSrc = `${import.meta.env.BASE_URL}images/titech_transparent_192.png`;
  const subtitle = opts.subtitle ? `<div class="docpack-section-subtitle">${esc(opts.subtitle)}</div>` : "";
  return `
    <section class="docpack-section">
      <header class="docpack-section-head">
        <div class="docpack-headline">
          ${logoSrc ? `<span class="docpack-headline-logo"><img src="${logoSrc}" alt="TI-TECH SVEIS AS"></span>` : ""}
          <h2 class="docpack-section-title">${esc(opts.title)}</h2>
        </div>
        ${subtitle}
      </header>
      ${opts.bodyHtml}
    </section>
  `;
};

const drawingSort = (rows: ProjectDrawingRow[]) =>
  [...rows].sort((a, b) => {
    const noCompare = String(a.drawing_no ?? "").localeCompare(String(b.drawing_no ?? ""), "nb", {
      sensitivity: "base",
      numeric: true,
    });
    if (noCompare !== 0) return noCompare;
    const revCompare = String(a.revision ?? "").localeCompare(String(b.revision ?? ""), "nb", {
      sensitivity: "base",
      numeric: true,
    });
    if (revCompare !== 0) return revCompare;
    return String(a.id).localeCompare(String(b.id));
  });

const traceSort = (rows: ProjectTraceabilityRow[]) =>
  [...rows].sort((a, b) => {
    const codeCompare = String(a.type_code ?? "").localeCompare(String(b.type_code ?? ""), "nb", {
      sensitivity: "base",
      numeric: true,
    });
    if (codeCompare !== 0) return codeCompare;
    const aIndex = Number(a.code_index ?? 0);
    const bIndex = Number(b.code_index ?? 0);
    if (aIndex !== bIndex) return aIndex - bIndex;
    return String(a.id).localeCompare(String(b.id));
  });

const weldSort = (rows: WeldListRow[]) =>
  [...rows].sort((a, b) => {
    const aNo = normalizeNo(a.sveis_id);
    const bNo = normalizeNo(b.sveis_id);
    if (aNo !== bNo) return aNo - bNo;
    return String(a.id).localeCompare(String(b.id));
  });

const traceCode = (row: ProjectTraceabilityRow) => `${String(row.type_code ?? "").trim()}${row.code_index ?? ""}`.trim() || DASH;

const traceDimension = (row: ProjectTraceabilityRow) => {
  const parts: string[] = [];
  if (row.dn) parts.push(`DN${row.dn}`);
  if (row.dn2) parts.push(`DN${row.dn2}`);
  if (row.sch) parts.push(`SCH${row.sch}`);
  if (row.pressure_class) parts.push(String(row.pressure_class));
  if (row.thickness) parts.push(`${row.thickness} mm`);
  if (row.filler_type) parts.push(row.filler_type);
  return parts.join(" | ") || DASH;
};

const traceMaterialLabel = (row: ProjectTraceabilityRow, typeByCode: Map<string, TraceabilityTypeRow>) => {
  const type = row.type ?? typeByCode.get(row.type_code) ?? null;
  if (type?.use_filler_type) return String(row.filler_type ?? "").trim() || DASH;
  return String(row.material?.name ?? "").trim() || DASH;
};

const traceHeatLabel = (row: ProjectTraceabilityRow) => {
  const direct = String(row.heat_number ?? "").trim();
  if (direct) return direct;
  const fromCert = (row.cert?.heat_numbers ?? []).filter(Boolean).join(", ").trim();
  return fromCert || DASH;
};

const welderLabel = (row: WeldListRow) => {
  const no = String(row.sveiser?.welder_no ?? "").trim();
  const name = String(row.sveiser?.display_name ?? "").trim();
  const label = [no, name].filter(Boolean).join(" - ");
  if (label) return label;
  return String(row.sveiser_id ?? "").trim() || DASH;
};

const componentLabel = (row: WeldListRow) => {
  const a = String(row.komponent_a ?? "").trim();
  const b = String(row.komponent_b ?? "").trim();
  if (a && b) return `${a} <-> ${b}`;
  return a || b || DASH;
};

const weldVtLabel = (row: WeldListRow, reportById: Map<string, string>, employeeById: Map<string, string>) => {
  const reportId = String(row.vt_report_id ?? "").trim();
  if (reportId) return reportById.get(reportId) || reportId;
  const inspector = String(row.kontrollert_av ?? "").trim();
  if (!inspector) return DASH;
  return `${employeeById.get(inspector) || inspector}`;
};

const reportLabelById = (id: string | null | undefined, reportById: Map<string, string>) => {
  const key = String(id ?? "").trim();
  if (!key) return DASH;
  return reportById.get(key) || key;
};

const renderCoverContent = (project: ProjectRow, generatedAt: string) => {
  const logoSrc = `${import.meta.env.BASE_URL}images/titech-logo.png`;
  const projectNo = String(project.project_no ?? "").trim();
  const projectName = String(project.name ?? "").trim();
  return `
    <section class="docpack-cover">
      <div class="docpack-cover-logo">
        ${logoSrc ? `<img src="${logoSrc}" alt="TI-TECH SVEIS AS">` : ""}
      </div>
      <div class="docpack-cover-kicker">TI-TECH SVEIS AS</div>
      <h1 class="docpack-cover-title">Dokumentasjonspakke</h1>
      <div class="docpack-cover-project">${esc(projectNo)} - ${esc(projectName || DASH)}</div>
      <div class="docpack-cover-meta">Kunde: ${esc(project.customer || DASH)}</div>
      <div class="docpack-cover-meta">Arbeidsordre: ${esc(project.work_order || DASH)}</div>
      <div class="docpack-cover-meta">Generert: ${esc(generatedAt)}</div>
    </section>
  `;
};

const renderOverviewContent = (opts: {
  project: ProjectRow;
  generatedAt: string;
  sections: SectionStat[];
  includeCover: boolean;
}) => {
  const logoSrc = `${import.meta.env.BASE_URL}images/titech_transparent_192.png`;
  const { project, generatedAt, sections, includeCover } = opts;
  const rows = sections
    .map(
      (section) => `
        <tr>
          <td>${esc(section.title)}</td>
          <td>${esc(String(section.startPage))}</td>
          <td>${esc(String(section.pageCount))}</td>
          <td>${esc(String(section.rowCount))}</td>
        </tr>
      `
    )
    .join("");

  return `
    <section class="docpack-overview">
      <header class="docpack-overview-head">
        <div class="docpack-headline">
          ${logoSrc ? `<span class="docpack-headline-logo"><img src="${logoSrc}" alt="TI-TECH SVEIS AS"></span>` : ""}
          <h2>Prosjektoversikt</h2>
        </div>
        <div class="docpack-overview-meta">Generert: ${esc(generatedAt)}</div>
      </header>
      <div class="docpack-overview-grid">
        <div><strong>Internt prosjektnr.</strong><span>${esc(String(project.project_no ?? DASH))}</span></div>
        <div><strong>Navn</strong><span>${esc(project.name || DASH)}</span></div>
        <div><strong>Kunde</strong><span>${esc(project.customer || DASH)}</span></div>
        <div><strong>Arbeidsordre</strong><span>${esc(project.work_order || DASH)}</span></div>
        <div><strong>Forside</strong><span>${includeCover ? "Ja" : "Nei"}</span></div>
        <div><strong>Innhold</strong><span>${esc(String(sections.length))} deler</span></div>
      </div>
      <div class="docpack-overview-table-wrap">
        <table class="docpack-table">
          <thead>
            <tr>
              <th>Del</th>
              <th>Startside</th>
              <th>Sider</th>
              <th>Rader</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="4" class="is-empty">Ingen deler valgt.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
};

const renderPageShell = (opts: {
  pageNo: number;
  totalPages: number;
  className?: string;
  projectLabel: string;
  contentHtml: string;
}) => {
  const pageClass = `docpack-page${opts.className ? ` ${opts.className}` : ""}`;
  return `
    <article class="${pageClass}">
      <div class="docpack-page-content">
        ${opts.contentHtml}
      </div>
      <footer class="docpack-page-footer">
        <span>${esc(opts.projectLabel)}</span>
        <span>Side ${opts.pageNo} av ${opts.totalPages}</span>
      </footer>
    </article>
  `;
};

const drawRowsForWorkOrder = (workOrder: ProjectWorkOrderRow | null) => {
  if (!workOrder) return [] as string[][];
  const label = String(workOrder.file?.label ?? "").trim() || DASH;
  const uploadedAt = formatDate(workOrder.created_at);
  const size = formatBytes(workOrder.file?.size_bytes ?? null);
  return [[label, uploadedAt, size]];
};

const drawRowsForDrawings = (drawings: ProjectDrawingRow[]) =>
  drawingSort(drawings).map((drawing) => [
    String(drawing.drawing_no ?? "").trim() || DASH,
    String(drawing.revision ?? "").trim() || DASH,
    String(drawing.file?.label ?? "").trim() || DASH,
    formatDate(drawing.created_at),
  ]);

const drawRowsForTraceability = (rows: ProjectTraceabilityRow[], typeByCode: Map<string, TraceabilityTypeRow>) =>
  traceSort(rows).map((row) => [
    traceCode(row),
    String(row.type?.label ?? typeByCode.get(row.type_code)?.label ?? "").trim() || DASH,
    traceDimension(row),
    traceMaterialLabel(row, typeByCode),
    traceHeatLabel(row),
  ]);

const drawRowsForWeldLog = (opts: {
  rows: WeldListRow[];
  reportById: Map<string, string>;
  employeeById: Map<string, string>;
}) => {
  const { rows, reportById, employeeById } = opts;
  return weldSort(rows).map((row) => [
    String(row.sveis_id ?? DASH),
    String(row.fuge ?? DASH),
    componentLabel(row),
    welderLabel(row),
    String(row.wps ?? DASH),
    formatDate(row.dato),
    String(row.tilsett ?? DASH),
    weldVtLabel(row, reportById, employeeById),
    reportLabelById(row.pt_report_id, reportById),
    reportLabelById(row.vol_report_id, reportById),
    row.status ? "Godkjent" : "Til kontroll",
  ]);
};

const wpsMaterialLabel = (row: WPSRow) => {
  const code = String(row.material?.material_code ?? "").trim();
  if (code) return code;
  const name = String(row.material?.name ?? "").trim();
  if (name) return name;
  return String(row.materiale ?? "").trim() || DASH;
};

const wpqrMaterialLabel = (row: WPQRRow) => {
  const code = String(row.material?.material_code ?? "").trim();
  if (code) return code;
  const name = String(row.material?.name ?? "").trim();
  if (name) return name;
  return String(row.materiale ?? "").trim() || DASH;
};

const drawRowsForWps = (rows: WPSRow[]) =>
  [...rows]
    .sort((a, b) => String(a.doc_no ?? "").localeCompare(String(b.doc_no ?? ""), "nb", { sensitivity: "base", numeric: true }))
    .map((row) => [
      "WPS",
      String(row.doc_no ?? "").trim() || DASH,
      String(row.process ?? "").trim().toUpperCase() || DASH,
      String(row.fuge ?? "").trim() || DASH,
      wpsMaterialLabel(row),
      String(row.tykkelse ?? "").trim() || DASH,
      String(row.wpqr?.doc_no ?? "").trim() || DASH,
      row.file_id ? "Ja" : "Nei",
    ]);

const drawRowsForWpqr = (rows: WPQRRow[]) =>
  [...rows]
    .sort((a, b) => String(a.doc_no ?? "").localeCompare(String(b.doc_no ?? ""), "nb", { sensitivity: "base", numeric: true }))
    .map((row) => [
      "WPQR",
      String(row.doc_no ?? "").trim() || DASH,
      String(row.process ?? "").trim().toUpperCase() || DASH,
      String(row.fuge ?? "").trim() || DASH,
      wpqrMaterialLabel(row),
      String(row.tykkelse ?? "").trim() || DASH,
      DASH,
      row.file_id ? "Ja" : "Nei",
    ]);

const drawRowsForNdt = (rows: NdtReportRow[]) =>
  [...rows]
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .map((row) => [
      String(row.report_no ?? "").trim() || DASH,
      String(row.method ?? "").trim().toUpperCase() || DASH,
      formatDate(row.date),
    ]);

const buildDocumentTables = (selection: PackageSelection, data: PackageData): DocTable[] => {
  const tables: DocTable[] = [];
  const reportById = new Map<string, string>();
  data.ndtReports.forEach((report) => {
    const id = String(report.id ?? "").trim();
    if (!id) return;
    const label = String(report.report_no ?? "").trim() || id;
    reportById.set(id, label);
  });

  const employeeById = new Map<string, string>();
  data.employees.forEach((employee) => {
    const id = String(employee.id ?? "").trim();
    if (!id) return;
    employeeById.set(id, String(employee.label ?? "").trim() || id);
  });

  if (selection.includeWorkOrder) {
    tables.push({
      key: "workorder",
      title: sectionTitleByKey.workorder,
      columns: ["Fil", "Lastet opp", "Størrelse"],
      rows: drawRowsForWorkOrder(data.workOrder),
    });
  }

  if (selection.includeDrawings) {
    tables.push({
      key: "drawings",
      title: sectionTitleByKey.drawings,
      columns: ["Tegningsnr.", "Revisjon", "Fil", "Dato"],
      rows: drawRowsForDrawings(data.drawings),
    });
  }

  if (selection.includeTraceability) {
    const typeByCode = new Map<string, TraceabilityTypeRow>();
    data.traceabilityTypes.forEach((type) => typeByCode.set(type.code, type));
    tables.push({
      key: "traceability",
      title: sectionTitleByKey.traceability,
      columns: ["Kode", "Komponent", "Dimensjon", "Material/type", "Heat nr."],
      rows: drawRowsForTraceability(data.traceability, typeByCode),
    });
  }

  if (selection.includeWeldLog) {
    tables.push({
      key: "weldlog",
      title: sectionTitleByKey.weldlog,
      columns: ["Sveis ID", "Fugetype", "Komponent", "Sveiser", "WPS", "Dato", "Tilsett", "Visuell (VT)", "Sprekk (PT/MT)", "Volumetrisk (RT/UT)", "Status"],
      rows: drawRowsForWeldLog({
        rows: data.welds,
        reportById,
        employeeById,
      }),
    });
  }

  if (selection.includeWps || selection.includeUsedWpqr) {
    const procedureRows = [
      ...(selection.includeWps ? drawRowsForWps(data.usedWps) : []),
      ...(selection.includeUsedWpqr ? drawRowsForWpqr(data.usedWpqr) : []),
    ].sort((a, b) => {
      const typeCompare = String(a[0] ?? "").localeCompare(String(b[0] ?? ""), "nb", { sensitivity: "base", numeric: true });
      if (typeCompare !== 0) return typeCompare;
      return String(a[1] ?? "").localeCompare(String(b[1] ?? ""), "nb", { sensitivity: "base", numeric: true });
    });

    tables.push({
      key: "wps",
      title: "Sveiseprosedyrer",
      columns: ["Type", "Dokument nr.", "Prosess", "Fuge", "Materiale", "Tykkelse", "Knyttet WPQR", "PDF"],
      rows: procedureRows,
    });
  }

  if (selection.includeNdt) {
    tables.push({
      key: "ndt",
      title: sectionTitleByKey.ndt,
      columns: ["Rapport", "NDT-Metode", "Dato"],
      rows: drawRowsForNdt(data.ndtReports),
    });
  }

  return tables;
};

const buildSectionDescriptors = (opts: {
  selection: PackageSelection;
  data: PackageData;
  project: ProjectRow;
}) => {
  const { selection, data, project } = opts;
  const descriptors: Descriptor[] = [];
  const sectionStats: SectionStat[] = [];
  const tables = buildDocumentTables(selection, data);

  if (selection.includeCover) {
    descriptors.push({
      className: "is-cover",
      contentHtml: renderCoverContent(project, data.generatedAt),
    });
  }

  const overviewIndex = descriptors.length;
  descriptors.push({
    className: "is-overview",
    contentHtml: "",
  });

  const addSection = (params: {
    key: SectionKey;
    title: string;
    rows: string[][];
    columns: string[];
    pageSize: number;
    compact?: boolean;
    emptyMessage: string;
  }) => {
    const chunks = chunkRows(params.rows, params.pageSize);
    const startPage = descriptors.length + 1;
    const pageCount = Math.max(1, chunks.length);
    sectionStats.push({
      key: params.key,
      title: params.title,
      startPage,
      pageCount,
      rowCount: params.rows.length,
    });

    chunks.forEach((chunk, index) => {
      const subtitle =
        pageCount > 1 ? `Del ${index + 1} av ${pageCount}` : params.rows.length ? `${params.rows.length} rader` : "Ingen rader";
      const table = renderSectionTable({
        columns: params.columns,
        rows: chunk,
        compact: params.compact,
        emptyMessage: params.emptyMessage,
      });
      descriptors.push({
        className: "is-section",
        contentHtml: renderSectionPage({
          title: params.title,
          subtitle,
          bodyHtml: table,
        }),
      });
    });
  };

  const configByKey: Record<SectionKey, { pageSize: number; compact?: boolean; emptyMessage: string }> = {
    workorder: { pageSize: 20, emptyMessage: "Ingen arbeidsordre er registrert for prosjektet." },
    drawings: { pageSize: 24, emptyMessage: "Ingen tegninger funnet." },
    traceability: { pageSize: 20, emptyMessage: "Ingen sporbarhetsrader funnet." },
    weldlog: { pageSize: 14, compact: true, emptyMessage: "Ingen sveiser funnet." },
    wps: { pageSize: 20, emptyMessage: "Ingen sveiseprosedyrer funnet basert på sveiseloggen." },
    wpqr: { pageSize: 20, emptyMessage: "Ingen WPQR er koblet til brukte WPS." },
    ndt: { pageSize: 24, emptyMessage: "Ingen NDT-rapporter funnet for prosjektet." },
  };

  tables.forEach((table) => {
    const config = configByKey[table.key];
    addSection({
      key: table.key,
      title: table.title,
      columns: table.columns,
      rows: table.rows,
      pageSize: config.pageSize,
      compact: config.compact,
      emptyMessage: config.emptyMessage,
    });
  });

  descriptors[overviewIndex] = {
    className: "is-overview",
    contentHtml: renderOverviewContent({
      project,
      generatedAt: data.generatedAt,
      sections: sectionStats,
      includeCover: selection.includeCover,
    }),
  };

  return descriptors;
};

const PDF_PAGE_SIZE: [number, number] = [841.89, 595.28];
const PDF_MARGIN_X = 22;
const PDF_MARGIN_TOP = 20;
const PDF_MARGIN_BOTTOM = 18;
const PDF_FOOTER_SPACE = 16;

const pdfWrapText = (text: string, font: PDFFont, fontSize: number, maxWidth: number) => {
  const raw = String(text ?? "").trim() || DASH;
  const paragraphs = raw.split(/\r?\n/);
  const lines: string[] = [];

  const breakLongToken = (token: string) => {
    let part = "";
    const out: string[] = [];
    for (const ch of token) {
      const next = `${part}${ch}`;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth || !part) {
        part = next;
      } else {
        out.push(part);
        part = ch;
      }
    }
    if (part) out.push(part);
    return out;
  };

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }
    let current = "";
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);
      if (candidateWidth <= maxWidth) {
        current = candidate;
        return;
      }

      if (!current) {
        const broken = breakLongToken(word);
        if (!broken.length) return;
        lines.push(...broken.slice(0, -1));
        current = broken[broken.length - 1];
        return;
      }

      lines.push(current);
      current = word;
    });
    if (current) lines.push(current);
  });

  return lines.length ? lines : [DASH];
};

const buildColumnWidths = (tableWidth: number, weights: number[]) => {
  const sum = weights.reduce((acc, value) => acc + value, 0) || 1;
  let used = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return tableWidth - used;
    }
    const width = Math.floor((tableWidth * weight) / sum);
    used += width;
    return width;
  });
};

const tableWeightsByKey: Record<SectionKey, number[]> = {
  workorder: [4, 2, 2],
  drawings: [3, 1, 4, 2],
  traceability: [1.3, 2.3, 2.8, 2.3, 1.8],
  weldlog: [1.1, 1.1, 1.8, 2, 1.2, 1.2, 1.2, 1.4, 1.4, 1.4, 1.1],
  wps: [0.9, 1.7, 0.9, 0.9, 1.5, 1, 1.6, 0.8],
  wpqr: [1.8, 0.9, 0.9, 1.7, 1, 0.8],
  ndt: [3, 1.2, 1.3],
};

const drawPdfPageFooter = (opts: {
  page: PDFPage;
  pageNo: number;
  totalPages: number;
  projectLabel: string;
  regular: PDFFont;
}) => {
  const { page, pageNo, totalPages, projectLabel, regular } = opts;
  const pageWidth = page.getWidth();
  const y = PDF_MARGIN_BOTTOM - 6;

  page.drawLine({
    start: { x: PDF_MARGIN_X, y: y + 9 },
    end: { x: pageWidth - PDF_MARGIN_X, y: y + 9 },
    color: rgb(0.79, 0.83, 0.89),
    thickness: 0.8,
  });

  page.drawText(projectLabel || "Prosjekt", {
    x: PDF_MARGIN_X,
    y,
    size: 9,
    font: regular,
    color: rgb(0.38, 0.43, 0.5),
  });

  const rightText = `Side ${pageNo} av ${totalPages}`;
  const rightWidth = regular.widthOfTextAtSize(rightText, 9);
  page.drawText(rightText, {
    x: pageWidth - PDF_MARGIN_X - rightWidth,
    y,
    size: 9,
    font: regular,
    color: rgb(0.38, 0.43, 0.5),
  });
};

const drawPdfCoverPage = (opts: {
  page: PDFPage;
  project: ProjectRow;
  generatedAt: string;
  regular: PDFFont;
  bold: PDFFont;
  logoImage: any | null;
}) => {
  const { page, project, generatedAt, regular, bold, logoImage } = opts;
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const centerX = pageWidth / 2;

  page.drawRectangle({
    x: PDF_MARGIN_X,
    y: PDF_MARGIN_BOTTOM + 8,
    width: pageWidth - PDF_MARGIN_X * 2,
    height: pageHeight - (PDF_MARGIN_BOTTOM + 8) - PDF_MARGIN_TOP,
    color: rgb(0.94, 0.97, 1),
    borderColor: rgb(0.67, 0.74, 0.83),
    borderWidth: 1.2,
  });

  let cursorY = pageHeight - 130;

  if (logoImage) {
    const logoHeight = 68;
    const ratio = logoImage.width / logoImage.height;
    const logoWidth = logoHeight * ratio;
    page.drawImage(logoImage, {
      x: centerX - logoWidth / 2,
      y: cursorY,
      width: logoWidth,
      height: logoHeight,
    });
    cursorY -= 88;
  }

  const kicker = "TI-TECH";
  const kickerW = regular.widthOfTextAtSize(kicker, 14);
  page.drawText(kicker, {
    x: centerX - kickerW / 2,
    y: cursorY,
    size: 14,
    font: regular,
    color: rgb(0.36, 0.42, 0.52),
  });
  cursorY -= 34;

  const title = "Dokumentasjonspakke";
  const titleW = bold.widthOfTextAtSize(title, 34);
  page.drawText(title, {
    x: centerX - titleW / 2,
    y: cursorY,
    size: 34,
    font: bold,
    color: rgb(0.09, 0.18, 0.29),
  });
  cursorY -= 58;

  const projectLine = `${String(project.project_no ?? "").trim()} - ${String(project.name ?? "").trim() || DASH}`;
  const projectW = bold.widthOfTextAtSize(projectLine, 20);
  page.drawText(projectLine, {
    x: centerX - projectW / 2,
    y: cursorY,
    size: 20,
    font: bold,
    color: rgb(0.12, 0.21, 0.34),
  });
  cursorY -= 32;

  const lines = [
    `Kunde: ${String(project.customer ?? "").trim() || DASH}`,
    `Arbeidsordre: ${String(project.work_order ?? "").trim() || DASH}`,
    `Generert: ${generatedAt}`,
  ];
  lines.forEach((line) => {
    const width = regular.widthOfTextAtSize(line, 13);
    page.drawText(line, {
      x: centerX - width / 2,
      y: cursorY,
      size: 13,
      font: regular,
      color: rgb(0.21, 0.31, 0.43),
    });
    cursorY -= 21;
  });
};

const drawPdfOverviewPage = (opts: {
  page: PDFPage;
  project: ProjectRow;
  generatedAt: string;
  stats: SectionStat[];
  includeCover: boolean;
  regular: PDFFont;
  bold: PDFFont;
}) => {
  const { page, project, generatedAt, stats, includeCover, regular, bold } = opts;
  const pageWidth = page.getWidth();
  const contentW = pageWidth - PDF_MARGIN_X * 2;
  let y = page.getHeight() - PDF_MARGIN_TOP;

  page.drawRectangle({
    x: PDF_MARGIN_X,
    y: y - 42,
    width: contentW,
    height: 34,
    color: rgb(0.1, 0.25, 0.42),
  });
  page.drawText("Prosjektoversikt", {
    x: PDF_MARGIN_X + 10,
    y: y - 30,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  const meta = `Generert: ${generatedAt}`;
  const metaW = regular.widthOfTextAtSize(meta, 10.5);
  page.drawText(meta, {
    x: pageWidth - PDF_MARGIN_X - metaW - 10,
    y: y - 24,
    size: 10.5,
    font: regular,
    color: rgb(0.86, 0.91, 0.97),
  });
  y -= 60;

  const infoRows = [
    ["Prosjekt", String(project.project_no ?? DASH)],
    ["Navn", String(project.name ?? DASH)],
    ["Kunde", String(project.customer ?? DASH)],
    ["Arbeidsordre", String(project.work_order ?? DASH)],
    ["Forside", includeCover ? "Ja" : "Nei"],
    ["Valgte deler", String(stats.length)],
  ];
  const cardHeight = 74;
  page.drawRectangle({
    x: PDF_MARGIN_X,
    y: y - cardHeight,
    width: contentW,
    height: cardHeight,
    color: rgb(0.93, 0.96, 0.99),
    borderColor: rgb(0.78, 0.83, 0.89),
    borderWidth: 0.8,
  });

  const colW = contentW / 3;
  infoRows.forEach((row, index) => {
    const col = index % 3;
    const line = Math.floor(index / 3);
    const x = PDF_MARGIN_X + col * colW + 8;
    const yBase = y - 20 - line * 34;
    page.drawText(row[0], {
      x,
      y: yBase,
      size: 9.5,
      font: regular,
      color: rgb(0.37, 0.42, 0.5),
    });
    page.drawText(row[1], {
      x,
      y: yBase - 14,
      size: 12,
      font: bold,
      color: rgb(0.15, 0.2, 0.28),
    });
  });
  y -= cardHeight + 14;

  const headers = ["Del", "Startside", "Sider", "Rader"];
  const weights = [4, 1.3, 1.3, 1.3];
  const colWidths = buildColumnWidths(contentW, weights);
  const lineColor = rgb(0.77, 0.82, 0.88);
  const headerH = 20;
  let colX = PDF_MARGIN_X;
  headers.forEach((header, idx) => {
    const w = colWidths[idx];
    page.drawRectangle({
      x: colX,
      y: y - headerH,
      width: w,
      height: headerH,
      color: rgb(0.09, 0.22, 0.37),
      borderColor: lineColor,
      borderWidth: 0.6,
    });
    page.drawText(header, {
      x: colX + 4,
      y: y - 13,
      size: 9,
      font: bold,
      color: rgb(1, 1, 1),
    });
    colX += w;
  });
  y -= headerH;

  if (!stats.length) {
    page.drawRectangle({
      x: PDF_MARGIN_X,
      y: y - 28,
      width: contentW,
      height: 28,
      color: rgb(1, 1, 1),
      borderColor: lineColor,
      borderWidth: 0.6,
    });
    page.drawText("Ingen deler valgt.", {
      x: PDF_MARGIN_X + 6,
      y: y - 18,
      size: 10,
      font: regular,
      color: rgb(0.37, 0.42, 0.5),
    });
    return;
  }

  stats.forEach((row, index) => {
    const rowH = 18;
    const bg = index % 2 ? rgb(0.96, 0.97, 0.99) : rgb(1, 1, 1);
    const values = [row.title, String(row.startPage), String(row.pageCount), String(row.rowCount)];
    let x = PDF_MARGIN_X;
    values.forEach((value, idx) => {
      const w = colWidths[idx];
      page.drawRectangle({
        x,
        y: y - rowH,
        width: w,
        height: rowH,
        color: bg,
        borderColor: lineColor,
        borderWidth: 0.45,
      });
      page.drawText(value, {
        x: x + 4,
        y: y - 12,
        size: 9.5,
        font: regular,
        color: rgb(0.16, 0.21, 0.29),
      });
      x += w;
    });
    y -= rowH;
  });
};

const drawPdfTableSection = (opts: {
  pdf: PDFDocument;
  table: DocTable;
  regular: PDFFont;
  bold: PDFFont;
  generatedAt: string;
  pages: PDFPage[];
}) => {
  const { pdf, table, regular, bold, generatedAt, pages } = opts;
  const weights = tableWeightsByKey[table.key] || Array.from({ length: table.columns.length }, () => 1);
  const lineColor = rgb(0.77, 0.82, 0.88);
  const headerFill = rgb(0.09, 0.22, 0.37);
  const headerText = rgb(1, 1, 1);
  const altFill = rgb(0.96, 0.97, 0.99);
  const white = rgb(1, 1, 1);
  const textColor = rgb(0.15, 0.2, 0.28);
  const pageWidth = PDF_PAGE_SIZE[0];
  const pageHeight = PDF_PAGE_SIZE[1];
  const tableWidth = pageWidth - PDF_MARGIN_X * 2;
  const colWidths = buildColumnWidths(tableWidth, weights);
  const headerFontSize = table.key === "weldlog" ? 7.8 : 9;
  const bodyFontSize = table.key === "weldlog" ? 7.9 : 9.3;
  const bodyLineHeight = bodyFontSize + 1.6;
  const cellPaddingX = 3;
  const cellPaddingY = 3;
  const headerRowH = table.key === "weldlog" ? 16 : 18;
  const rowMinH = table.key === "weldlog" ? 14 : 16;

  let currentPage: PDFPage | null = null;
  let y = 0;
  let continuation = false;
  let rowIndex = 0;

  const drawTop = () => {
    currentPage = pdf.addPage(PDF_PAGE_SIZE);
    pages.push(currentPage);
    y = pageHeight - PDF_MARGIN_TOP;

    const title = continuation ? `${table.title} (forts.)` : table.title;
    currentPage.drawText(title, {
      x: PDF_MARGIN_X,
      y: y - 16,
      size: 17,
      font: bold,
      color: rgb(0.1, 0.18, 0.28),
    });
    const meta = `Generert ${generatedAt}`;
    const metaW = regular.widthOfTextAtSize(meta, 9);
    currentPage.drawText(meta, {
      x: pageWidth - PDF_MARGIN_X - metaW,
      y: y - 14,
      size: 9,
      font: regular,
      color: rgb(0.4, 0.45, 0.52),
    });
    y -= 26;

    let x = PDF_MARGIN_X;
    table.columns.forEach((column, idx) => {
      const w = colWidths[idx];
      currentPage!.drawRectangle({
        x,
        y: y - headerRowH,
        width: w,
        height: headerRowH,
        color: headerFill,
        borderColor: lineColor,
        borderWidth: 0.55,
      });
      const headerLines = pdfWrapText(column, bold, headerFontSize, w - cellPaddingX * 2);
      const headerLine = headerLines[0] || "";
      currentPage!.drawText(headerLine, {
        x: x + cellPaddingX,
        y: y - headerRowH + 5.3,
        size: headerFontSize,
        font: bold,
        color: headerText,
      });
      x += w;
    });
    y -= headerRowH;
    continuation = true;
  };

  drawTop();

  table.rows.forEach((row) => {
    const linesByCell = row.map((cell, idx) => pdfWrapText(cell || DASH, regular, bodyFontSize, colWidths[idx] - cellPaddingX * 2));
    const maxLines = Math.max(1, ...linesByCell.map((lines) => lines.length));
    const rowHeight = Math.max(rowMinH, maxLines * bodyLineHeight + cellPaddingY * 2);
    const minY = PDF_MARGIN_BOTTOM + PDF_FOOTER_SPACE;

    if (y - rowHeight < minY) {
      drawTop();
    }

    const fill = rowIndex % 2 ? altFill : white;
    let x = PDF_MARGIN_X;
    linesByCell.forEach((lines, idx) => {
      const w = colWidths[idx];
      currentPage!.drawRectangle({
        x,
        y: y - rowHeight,
        width: w,
        height: rowHeight,
        color: fill,
        borderColor: lineColor,
        borderWidth: 0.4,
      });

      const textYStart = y - cellPaddingY - bodyFontSize;
      lines.forEach((line, lineIdx) => {
        currentPage!.drawText(line, {
          x: x + cellPaddingX,
          y: textYStart - lineIdx * bodyLineHeight,
          size: bodyFontSize,
          font: regular,
          color: textColor,
        });
      });
      x += w;
    });
    y -= rowHeight;
    rowIndex += 1;
  });
};

const createMainDocumentationPdfVector = async (opts: {
  project: ProjectRow;
  selection: PackageSelection;
  data: PackageData;
}) => {
  const { project, selection, data } = opts;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tables = buildDocumentTables(selection, data);
  const pages: PDFPage[] = [];
  const stats: SectionStat[] = [];

  let logoImage: any | null = null;
  try {
    const logoSrc = `${import.meta.env.BASE_URL}images/titech-logo.png`;
    const response = await fetch(logoSrc, { credentials: "omit" });
    if (response.ok) {
      const bytes = await response.arrayBuffer();
      logoImage = await pdf.embedPng(bytes);
    }
  } catch {}

  if (selection.includeCover) {
    const coverPage = pdf.addPage(PDF_PAGE_SIZE);
    pages.push(coverPage);
    drawPdfCoverPage({
      page: coverPage,
      project,
      generatedAt: data.generatedAt,
      regular,
      bold,
      logoImage,
    });
  }

  const overviewPage = pdf.addPage(PDF_PAGE_SIZE);
  pages.push(overviewPage);

  tables.forEach((table) => {
    const startPage = pages.length + 1;
    const before = pages.length;
    drawPdfTableSection({
      pdf,
      table,
      regular,
      bold,
      generatedAt: data.generatedAt,
      pages,
    });
    const pageCount = pages.length - before;
    stats.push({
      key: table.key,
      title: table.title,
      startPage,
      pageCount,
      rowCount: table.rows.length,
    });
  });

  drawPdfOverviewPage({
    page: overviewPage,
    project,
    generatedAt: data.generatedAt,
    stats,
    includeCover: selection.includeCover,
    regular,
    bold,
  });

  const projectLabel = `${String(project.project_no ?? "").trim()} - ${String(project.name ?? "").trim()}`.trim();
  const totalPages = pages.length;
  pages.forEach((page, index) => {
    drawPdfPageFooter({
      page,
      pageNo: index + 1,
      totalPages,
      projectLabel: projectLabel || "Prosjekt",
      regular,
    });
  });

  return await pdf.save();
};

const DOCPACK_RENDER_CSS = `
:root{
  --docpack-ink:#1a1f28;
  --docpack-muted:#5f6978;
  --docpack-line:#c6ced9;
  --docpack-line-strong:#9da9ba;
  --docpack-accent:#17395f;
  --docpack-accent-soft:#edf3fb;
  --docpack-alt:#f4f7fb;
}
.docpack-print-sheet{
  display:block !important;
  background:#fff;
  background-image:none;
}
.docpack-print-sheet *{
  box-sizing:border-box;
}
.docpack-print-sheet .docpack-page{
  width: 100%;
  max-width: 297mm;
  min-height: 210mm;
  margin: 0 auto;
  padding: 9mm 10mm;
  background:#fff;
  color: var(--docpack-ink);
  font-family: Calibri, "Segoe UI", Arial, sans-serif;
  display: flex;
  flex-direction: column;
  gap: 6mm;
}
.docpack-print-sheet .docpack-page-content{
  flex: 1 1 auto;
  min-height: 0;
}
.docpack-print-sheet .docpack-page.is-cover .docpack-page-content{
  display: flex;
  align-items: center;
  justify-content: center;
}
.docpack-print-sheet .docpack-page-footer{
  flex: 0 0 auto;
  margin-top: auto;
  border-top: 1px solid var(--docpack-line);
  padding-top: 2.5mm;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--docpack-muted);
  font-size: 11px;
  letter-spacing: 0.25px;
}
.docpack-print-sheet .docpack-cover{
  min-height: 100%;
  display: grid;
  align-content: center;
  justify-items: center;
  text-align: center;
  gap: 4mm;
  padding: 12mm;
  width: 100%;
}
.docpack-print-sheet .docpack-cover-logo{
  width: 150px;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.docpack-print-sheet .docpack-cover-logo img{
  width: auto;
  height: 100%;
  display: block;
}
.docpack-print-sheet .docpack-cover-kicker{
  font-size: 24px;
  color: var(--docpack-muted);
  letter-spacing: 1.7px;
  text-transform: uppercase;
}
.docpack-print-sheet .docpack-cover-title{
  margin: 0;
  font-size: 34px;
  letter-spacing: 0.55px;
  color: #11263f;
}
.docpack-print-sheet .docpack-cover-project{
  font-size: 18px;
  font-weight: 700;
}
.docpack-print-sheet .docpack-cover-meta{
  font-size: 12.5px;
  color: #2d425b;
}
.docpack-print-sheet .docpack-overview{
  border: 1px solid var(--docpack-line);
  border-radius: 7px;
  overflow: hidden;
}
.docpack-print-sheet .docpack-overview-head{
  background: linear-gradient(180deg, #1b446f, #143455);
  color: #fff;
  padding: 5mm 6mm;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8mm;
}
.docpack-print-sheet .docpack-headline{
  display: inline-flex;
  align-items: center;
  gap: 2.6mm;
  min-width: 0;
}
.docpack-print-sheet .docpack-headline-logo{
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.docpack-print-sheet .docpack-headline-logo img{
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.docpack-print-sheet .docpack-overview-head h2{
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.3px;
}
.docpack-print-sheet .docpack-overview-meta{
  font-size: 11px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.84);
}
.docpack-print-sheet .docpack-overview-grid{
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 8px;
  padding: 4mm 6mm;
  border-bottom: 1px solid var(--docpack-line);
  background: var(--docpack-accent-soft);
}
.docpack-print-sheet .docpack-overview-grid > div{
  display: grid;
  gap: 2px;
}
.docpack-print-sheet .docpack-overview-grid strong{
  font-size: 10.5px;
  color: var(--docpack-muted);
  letter-spacing: 0.45px;
  text-transform: uppercase;
}
.docpack-print-sheet .docpack-overview-grid span{
  font-size: 12px;
  color: var(--docpack-ink);
}
.docpack-print-sheet .docpack-overview-table-wrap{
  padding: 4mm 6mm 6mm;
}
.docpack-print-sheet .docpack-section{
  border: 1px solid var(--docpack-line);
  border-radius: 7px;
  overflow: hidden;
}
.docpack-print-sheet .docpack-section-head{
  background: linear-gradient(180deg, rgba(23, 57, 95, 0.96), rgba(20, 49, 82, 0.92));
  color: #fff;
  padding: 4mm 5mm;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8mm;
}
.docpack-print-sheet .docpack-section-title{
  margin: 0;
  font-size: 17px;
  letter-spacing: 0.2px;
}
.docpack-print-sheet .docpack-section-subtitle{
  font-size: 10.8px;
  letter-spacing: 0.55px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.85);
}
.docpack-print-sheet .docpack-table-wrap{
  overflow: hidden;
}
.docpack-print-sheet .docpack-table{
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}
.docpack-print-sheet .docpack-table th,
.docpack-print-sheet .docpack-table td{
  border-top: 1px solid var(--docpack-line);
  border-right: 1px solid var(--docpack-line);
  padding: 4px 6px;
  text-align: left;
  vertical-align: middle;
  font-size: 10.5px;
  color: var(--docpack-ink);
  white-space: normal;
  word-break: normal;
  overflow-wrap: anywhere;
}
.docpack-print-sheet .docpack-table th:last-child,
.docpack-print-sheet .docpack-table td:last-child{
  border-right: 0;
}
.docpack-print-sheet .docpack-table th{
  background: var(--docpack-accent);
  color: #fff;
  border-top: 0;
  font-size: 9.8px;
  font-weight: 800;
  letter-spacing: 0.62px;
  text-transform: uppercase;
}
.docpack-print-sheet .docpack-table tbody tr:nth-child(even) td{
  background: var(--docpack-alt);
}
.docpack-print-sheet .docpack-table td.is-empty{
  text-align: center;
  color: var(--docpack-muted);
  padding-top: 9mm;
  padding-bottom: 9mm;
}
.docpack-print-sheet .docpack-table.is-compact th,
.docpack-print-sheet .docpack-table.is-compact td{
  font-size: 9.2px;
  padding: 3px 5px;
}
.docpack-print-sheet .docpack-page.is-cover .docpack-page-footer{
  border-top-color: rgba(157, 169, 186, 0.7);
}
`;

const waitForImagesIn = async (root: ParentNode) => {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = img.onerror = () => resolve();
      });
    })
  );
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Kunne ikke lese bildeblob."));
    reader.readAsDataURL(blob);
  });

const isTaintedCanvasError = (error: unknown) => {
  const message = String((error as any)?.message ?? error ?? "").toLowerCase();
  return (
    message.includes("tainted canvas") ||
    message.includes("canvas-export") ||
    message.includes("securityerror") ||
    message.includes("may not be exported")
  );
};

const inlineImagesAsDataUrls = async (root: ParentNode) => {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  for (const image of images) {
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    const rawSrc = String(image.getAttribute("src") || image.src || "").trim();
    if (!rawSrc) continue;
    if (rawSrc.startsWith("data:")) continue;

    try {
      const absoluteUrl = rawSrc.startsWith("blob:") ? rawSrc : new URL(rawSrc, window.location.href).toString();
      const response = await fetch(absoluteUrl, { credentials: "omit" });
      if (!response.ok) {
        image.removeAttribute("src");
        continue;
      }
      const blob = await response.blob();
      if (!String(blob.type || "").startsWith("image/")) {
        image.removeAttribute("src");
        continue;
      }
      const dataUrl = await blobToDataUrl(blob);
      if (!dataUrl) {
        image.removeAttribute("src");
        continue;
      }
      image.setAttribute("src", dataUrl);
    } catch {
      // Drop image if it cannot be inlined to avoid tainting the canvas.
      image.removeAttribute("src");
    }
  }
};

const renderPageNodeToPngBytes = async (opts: {
  pageNode: HTMLElement;
  cssText: string;
  scale?: number;
}) => {
  const { pageNode, cssText } = opts;
  const scale = Math.max(1, Math.min(3, opts.scale ?? 2));
  const rect = pageNode.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));

  const svgNs = "http://www.w3.org/2000/svg";
  const xhtmlNs = "http://www.w3.org/1999/xhtml";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("xmlns", svgNs);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const styleNode = document.createElementNS(svgNs, "style");
  styleNode.textContent = `
    html, body { margin:0; padding:0; background:#fff; }
    .docpack-print-sheet { display:block !important; background:#fff; }
    ${cssText}
  `;
  svg.appendChild(styleNode);

  const foreignObject = document.createElementNS(svgNs, "foreignObject");
  foreignObject.setAttribute("x", "0");
  foreignObject.setAttribute("y", "0");
  foreignObject.setAttribute("width", "100%");
  foreignObject.setAttribute("height", "100%");

  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", xhtmlNs);
  wrapper.className = "docpack-print-sheet";
  wrapper.style.display = "block";
  wrapper.style.width = `${width}px`;
  const pageClone = pageNode.cloneNode(true) as HTMLElement;
  await inlineImagesAsDataUrls(pageClone);
  await waitForImagesIn(pageClone);
  wrapper.appendChild(pageClone);
  foreignObject.appendChild(wrapper);
  svg.appendChild(foreignObject);

  const serialized = new XMLSerializer().serializeToString(svg);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;

  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Kunne ikke rendere dokumentasjonsside til bilde."));
  });
  image.src = svgUrl;
  await loaded;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kunne ikke opprette canvas-kontekst.");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Kunne ikke lage PNG fra dokumentasjonsside."));
          return;
        }
        resolve(blob);
      }, "image/png");
    } catch (error) {
      reject(new Error("Canvas-export ble blokkert av sikkerhetsregler (tainted canvas)."));
    }
  });

  return new Uint8Array(await pngBlob.arrayBuffer());
};

const createMainDocumentationPdfFromPrintLayout = async (opts: {
  project: ProjectRow;
  selection: PackageSelection;
  data: PackageData;
}) => {
  const { project, selection, data } = opts;
  const descriptors = buildSectionDescriptors({ selection, data, project });
  const totalPages = descriptors.length;
  const projectLabel = `${String(project.project_no ?? "").trim()} - ${String(project.name ?? "").trim()}`.trim() || "Prosjekt";
  const html = descriptors
    .map((descriptor, index) =>
      renderPageShell({
        pageNo: index + 1,
        totalPages,
        className: descriptor.className,
        projectLabel,
        contentHtml: descriptor.contentHtml,
      })
    )
    .join("");

  const sheet = document.createElement("div");
  sheet.className = "docpack-print-sheet";
  sheet.innerHTML = html;
  sheet.style.display = "block";
  sheet.style.position = "fixed";
  sheet.style.left = "-200vw";
  sheet.style.top = "0";
  sheet.style.width = "297mm";
  sheet.style.pointerEvents = "none";
  sheet.style.zIndex = "-1";
  document.body.appendChild(sheet);

  try {
    await inlineImagesAsDataUrls(sheet);
    await waitForImagesIn(sheet);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const renderPages = async () => {
      const pages = Array.from(sheet.querySelectorAll<HTMLElement>(".docpack-page"));
      if (!pages.length) throw new Error("Ingen sider ble generert for hoveddokumentasjonen.");

      const cssText = DOCPACK_RENDER_CSS;
      const pdf = await PDFDocument.create();

      for (const pageNode of pages) {
        const pngBytes = await renderPageNodeToPngBytes({ pageNode, cssText, scale: 2 });
        const image = await pdf.embedPng(pngBytes);
        const page = pdf.addPage(PDF_PAGE_SIZE);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: PDF_PAGE_SIZE[0],
          height: PDF_PAGE_SIZE[1],
        });
      }

      return await pdf.save();
    };

    try {
      return await renderPages();
    } catch (error) {
      if (!isTaintedCanvasError(error)) throw error;

      // Retry once with images stripped, so logo/CORS issues do not block ZIP export.
      Array.from(sheet.querySelectorAll<HTMLImageElement>("img")).forEach((img) => {
        img.removeAttribute("src");
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return await renderPages();
    }
  } finally {
    sheet.remove();
  }
};

const createMainDocumentationPdf = async (opts: {
  project: ProjectRow;
  selection: PackageSelection;
  data: PackageData;
}) => {
  try {
    return await createMainDocumentationPdfFromPrintLayout(opts);
  } catch (error) {
    if (!isTaintedCanvasError(error)) throw error;
    console.warn("Fallback til vector-PDF for dokumentasjonspakke pga tainted canvas.", error);
    return await createMainDocumentationPdfVector(opts);
  }
};

const printDocumentationPackage = async (opts: {
  project: ProjectRow;
  selection: PackageSelection;
  data: PackageData;
}) => {
  const { project, selection, data } = opts;
  const descriptors = buildSectionDescriptors({ selection, data, project });
  const totalPages = descriptors.length;
  const projectLabel = `${String(project.project_no ?? "").trim()} - ${String(project.name ?? "").trim()}`.trim();
  const html = descriptors
    .map((descriptor, index) =>
      renderPageShell({
        pageNo: index + 1,
        totalPages,
        className: descriptor.className,
        projectLabel: projectLabel || "Prosjekt",
        contentHtml: descriptor.contentHtml,
      })
    )
    .join("");

  const existing = document.querySelector(".docpack-print-sheet");
  if (existing) existing.remove();

  const existingPageStyle = document.querySelector<HTMLStyleElement>("style[data-docpack-print-page]");
  if (existingPageStyle) existingPageStyle.remove();

  const sheet = document.createElement("div");
  sheet.className = "docpack-print-sheet";
  sheet.innerHTML = html;
  document.body.appendChild(sheet);

  const pageStyle = document.createElement("style");
  pageStyle.setAttribute("data-docpack-print-page", "true");
  pageStyle.textContent = "@media print { @page { size: A4 landscape; margin: 0; } }";
  document.head.appendChild(pageStyle);

  document.body.classList.add("print-docpack");
  sheet.style.display = "block";

  const waitForImages = () =>
    Promise.all(
      Array.from(sheet.querySelectorAll("img")).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = img.onerror = () => resolve();
        });
      })
    );

  await waitForImages();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const cleanup = () => {
    sheet.remove();
    pageStyle.remove();
    document.body.classList.remove("print-docpack");
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.print();
};

const fetchAllProjectWeldRows = async (projectId: string) => {
  const logs = await fetchProjectWeldLogs(projectId);
  if (!logs.length) return [] as WeldListRow[];

  const rows: WeldListRow[] = [];
  const pageSize = 500;

  for (const log of logs) {
    let page = 0;
    while (true) {
      const result = await listWelds({
        page,
        pageSize,
        filters: { status: "all", search: "" },
        orderBy: "weld_no",
        orderDir: "asc",
        logId: log.id,
      });
      rows.push(...result.rows);
      if ((page + 1) * pageSize >= result.count || result.rows.length === 0) break;
      page += 1;
    }
  }

  return weldSort(rows);
};

const resolveUsedWpsAndWpqrFromWelds = async (welds: WeldListRow[]) => {
  const usedWpsIds = new Set<string>();
  welds.forEach((row) => {
    const id = String(row.wps_id ?? "").trim();
    if (id) usedWpsIds.add(id);
  });

  if (!usedWpsIds.size) {
    return {
      usedWps: [] as WPSRow[],
      usedWpqr: [] as WPQRRow[],
    };
  }

  const { wps, wpqr } = await fetchWpsData();
  const usedWps = wps
    .filter((row) => usedWpsIds.has(String(row.id ?? "").trim()))
    .sort((a, b) => String(a.doc_no ?? "").localeCompare(String(b.doc_no ?? ""), "nb", { sensitivity: "base", numeric: true }));

  const usedWpqrIds = new Set<string>();
  usedWps.forEach((row) => {
    const wpqrId = String(row.wpqr_id ?? "").trim();
    if (wpqrId) usedWpqrIds.add(wpqrId);
  });

  const usedWpqr = wpqr
    .filter((row) => usedWpqrIds.has(String(row.id ?? "").trim()))
    .sort((a, b) => String(a.doc_no ?? "").localeCompare(String(b.doc_no ?? ""), "nb", { sensitivity: "base", numeric: true }));

  return { usedWps, usedWpqr };
};

const collectData = async (project: ProjectRow, selection: PackageSelection): Promise<PackageData> => {
  const projectNo = String(project.project_no ?? "").trim();
  const includeWeldDataForRows = selection.includeWeldLog || selection.includeWps || selection.includeUsedWpqr;
  const includeReports = selection.includeNdt || selection.includeWeldLog;

  const [workOrder, drawings, traceability, traceabilityTypes, welds, ndtReports, employees] = await Promise.all([
    selection.includeWorkOrder ? fetchProjectWorkOrder(project.id) : Promise.resolve(null),
    selection.includeDrawings ? fetchProjectDrawings(project.id) : Promise.resolve([]),
    selection.includeTraceability ? fetchProjectTraceability(project.id) : Promise.resolve([]),
    selection.includeTraceability ? fetchTraceabilityTypes() : Promise.resolve([]),
    includeWeldDataForRows ? fetchAllProjectWeldRows(project.id) : Promise.resolve([]),
    includeReports ? listNdtReports({ projectNo }) : Promise.resolve([]),
    selection.includeWeldLog ? listEmployees() : Promise.resolve([]),
  ]);

  const { usedWps, usedWpqr } =
    selection.includeWps || selection.includeUsedWpqr
      ? await resolveUsedWpsAndWpqrFromWelds(welds)
      : { usedWps: [] as WPSRow[], usedWpqr: [] as WPQRRow[] };

  return {
    generatedAt: formatGeneratedAt(new Date()),
    workOrder,
    drawings,
    traceability,
    traceabilityTypes,
    welds,
    usedWps,
    usedWpqr,
    ndtReports,
    employees,
  };
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const addSuffixToFileName = (name: string, suffix: number) => {
  const match = name.match(/^(.*?)(\.[^.]+)?$/);
  if (!match) return `${name}_${suffix}`;
  const base = match[1] || "fil";
  const ext = match[2] || "";
  return `${base}_${suffix}${ext}`;
};

const fetchLinkedFileIdByEntityId = async (entityType: string, entityIds: string[]) => {
  const ids = Array.from(new Set(entityIds.map((id) => String(id ?? "").trim()).filter(Boolean)));
  if (!ids.length) return new Map<string, string>();

  const { data, error } = await supabase
    .from("file_links")
    .select("entity_id, file_id, created_at")
    .eq("entity_type", entityType)
    .in("entity_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const entityId = String((row as any)?.entity_id ?? "").trim();
    const fileId = String((row as any)?.file_id ?? "").trim();
    if (!entityId || !fileId) continue;
    if (!map.has(entityId)) map.set(entityId, fileId);
  }
  return map;
};

const buildZipCandidates = async (project: ProjectRow, selection: PackageSelection, prefetchedData?: PackageData) => {
  const includeNdtFiles = selection.includeNdt;
  const includeWpsFiles = selection.includeWps || selection.includeUsedWpqr;
  const includeWpqrFiles = selection.includeUsedWpqr;
  const projectNo = String(project.project_no ?? "").trim();
  const [workOrder, drawings, traceability, ndtRows] = await Promise.all([
    selection.includeWorkOrder ? fetchProjectWorkOrder(project.id) : Promise.resolve(null),
    selection.includeDrawings ? fetchProjectDrawings(project.id) : Promise.resolve([] as ProjectDrawingRow[]),
    selection.includeTraceability ? fetchProjectTraceability(project.id) : Promise.resolve([] as ProjectTraceabilityRow[]),
    includeNdtFiles ? fetchNdtReports() : Promise.resolve([] as RepoNdtReportRow[]),
  ]);

  let usedWps: WPSRow[] = [];
  let usedWpqr: WPQRRow[] = [];
  if (includeWpsFiles || includeWpqrFiles) {
    if (prefetchedData) {
      usedWps = prefetchedData.usedWps ?? [];
      usedWpqr = prefetchedData.usedWpqr ?? [];
    } else {
      const welds = await fetchAllProjectWeldRows(project.id);
      const resolved = await resolveUsedWpsAndWpqrFromWelds(welds);
      usedWps = resolved.usedWps;
      usedWpqr = resolved.usedWpqr;
    }
  }

  const wpsFallbackFileMap =
    includeWpsFiles && usedWps.length
      ? await fetchLinkedFileIdByEntityId(
          "wps",
          usedWps
            .filter((row) => !String(row.file_id ?? "").trim())
            .map((row) => String(row.id ?? "").trim())
        )
      : new Map<string, string>();

  const wpqrFallbackFileMap =
    includeWpqrFiles && usedWpqr.length
      ? await fetchLinkedFileIdByEntityId(
          "wpqr",
          usedWpqr
            .filter((row) => !String(row.file_id ?? "").trim())
            .map((row) => String(row.id ?? "").trim())
        )
      : new Map<string, string>();

  const candidates: ZipCandidate[] = [];

  if (selection.includeWorkOrder && workOrder?.file_id) {
    const ext = extensionFromLabel(workOrder.file?.label, "pdf");
    const base = sanitizeFilePart(`Arbeidsordre_${projectNo || project.id}`);
    candidates.push({
      fileId: workOrder.file_id,
      folder: zipFolderNames.workorder,
      fileName: ensureExt(base, ext),
      source: "Arbeidsordre",
      originalLabel: String(workOrder.file?.label ?? "").trim() || workOrder.file_id,
    });
  }

  if (selection.includeDrawings) {
    drawingSort(drawings).forEach((drawing) => {
      const fileId = String(drawing.file_id ?? "").trim();
      if (!fileId) return;
      const ext = extensionFromLabel(drawing.file?.label, "pdf");
      const drawingNo = sanitizeFilePart(String(drawing.drawing_no ?? "").trim(), "Tegning");
      const revision = sanitizeFilePart(String(drawing.revision ?? "-").trim(), "-");
      const base = sanitizeFilePart(`${drawingNo}_Rev-${revision}`, drawingNo);
      candidates.push({
        fileId,
        folder: zipFolderNames.drawings,
        fileName: ensureExt(base, ext),
        source: `Tegning ${String(drawing.drawing_no ?? "").trim()} Rev ${String(drawing.revision ?? "-").trim() || "-"}`,
        originalLabel: String(drawing.file?.label ?? "").trim() || fileId,
      });
    });
  }

  if (selection.includeTraceability) {
    traceSort(traceability).forEach((row) => {
      const fileId = String(row.cert?.file_id ?? "").trim();
      if (!fileId) return;
      const ext = extensionFromLabel(row.cert?.file?.label, "pdf");
      const code = sanitizeFilePart(traceCode(row), "Kode");
      const heat = sanitizeFilePart(traceHeatLabel(row), "");
      const base = sanitizeFilePart(`Materialsertifikat_${code}${heat ? `_${heat}` : ""}`, code);
      candidates.push({
        fileId,
        folder: zipFolderNames.traceability,
        fileName: ensureExt(base, ext),
        source: `Materialsporbarhet ${traceCode(row)}`,
        originalLabel: String(row.cert?.file?.label ?? "").trim() || fileId,
      });
    });
  }

  if (includeNdtFiles) {
    ndtRows
      .filter((row) => String(row.title ?? "").trim() === projectNo)
      .forEach((row) => {
        const fileId = String(row.file_id ?? "").trim();
        if (!fileId) return;
        const fileLabel = String(row.file?.label ?? "").trim();
        const ext = extensionFromLabel(fileLabel, "pdf");
        const reportNoBase = sanitizeFilePart(fileLabel || row.id, "NDT");
        const method = sanitizeFilePart(String(row.method?.code ?? row.method?.label ?? "").trim().toUpperCase(), "NDT");
        const base = sanitizeFilePart(`${method}_${reportNoBase}`, reportNoBase);
        candidates.push({
          fileId,
          folder: zipFolderNames.ndt,
          fileName: ensureExt(base, ext),
          source: `NDT ${String(row.method?.code ?? row.method?.label ?? "").trim() || DASH}`,
          originalLabel: fileLabel || fileId,
        });
        });
  }

  if (includeWpsFiles) {
    usedWps.forEach((row) => {
      const rowId = String(row.id ?? "").trim();
      const fileId = String(row.file_id ?? "").trim() || wpsFallbackFileMap.get(rowId) || "";
      if (!fileId) return;
      const docNo = String(row.doc_no ?? "").trim() || fileId;
      const base = sanitizeFilePart(`WPS_${docNo}`, "WPS");
      candidates.push({
        fileId,
        folder: zipFolderNames.wps,
        fileName: ensureExt(base, "pdf"),
        source: `WPS ${docNo}`,
        originalLabel: `${docNo}.pdf`,
      });
    });
  }

  if (includeWpqrFiles) {
    usedWpqr.forEach((row) => {
      const rowId = String(row.id ?? "").trim();
      const fileId = String(row.file_id ?? "").trim() || wpqrFallbackFileMap.get(rowId) || "";
      if (!fileId) return;
      const docNo = String(row.doc_no ?? "").trim() || fileId;
      const base = sanitizeFilePart(`WPQR_${docNo}`, "WPQR");
      candidates.push({
        fileId,
        folder: zipFolderNames.wpqr,
        fileName: ensureExt(base, "pdf"),
        source: `WPQR ${docNo} (fra brukt WPS)`,
        originalLabel: `${docNo}.pdf`,
      });
    });
  }

  return candidates;
};

const resolveZipTargets = (candidates: ZipCandidate[]) => {
  const takenPaths = new Set<string>();
  const fileIdToPath = new Map<string, string>();
  const targetRows: Array<ZipCandidate & { targetPath: string }> = [];
  const manifestRows: ZipManifestRow[] = [];

  candidates.forEach((candidate) => {
    const existingPath = fileIdToPath.get(candidate.fileId);
    if (existingPath) {
      manifestRows.push({
        targetPath: existingPath,
        source: candidate.source,
        fileId: candidate.fileId,
        originalLabel: candidate.originalLabel,
        note: "Duplikat referanse (samme fil er allerede inkludert).",
      });
      return;
    }

    let fileName = candidate.fileName;
    let targetPath = `${candidate.folder}/${fileName}`;
    let suffix = 2;
    while (takenPaths.has(targetPath.toLowerCase())) {
      fileName = addSuffixToFileName(candidate.fileName, suffix);
      targetPath = `${candidate.folder}/${fileName}`;
      suffix += 1;
    }

    takenPaths.add(targetPath.toLowerCase());
    fileIdToPath.set(candidate.fileId, targetPath);
    targetRows.push({ ...candidate, targetPath });
    manifestRows.push({
      targetPath,
      source: candidate.source,
      fileId: candidate.fileId,
      originalLabel: candidate.originalLabel,
      note: "",
    });
  });

  return { targetRows, manifestRows };
};

const buildZipMetaEntries = (opts: {
  project: ProjectRow;
  selection: PackageSelection;
  manifestRows: ZipManifestRow[];
}) => {
  const { project, selection, manifestRows } = opts;
  const generatedAt = formatGeneratedAt(new Date());
  const selectedParts = [
    selection.includeWorkOrder ? sectionTitleByKey.workorder : "",
    selection.includeDrawings ? sectionTitleByKey.drawings : "",
    selection.includeTraceability ? sectionTitleByKey.traceability : "",
    selection.includeWeldLog ? sectionTitleByKey.weldlog : "",
    selection.includeWps ? sectionTitleByKey.wps : "",
    selection.includeUsedWpqr ? sectionTitleByKey.wpqr : "",
    selection.includeNdt ? sectionTitleByKey.ndt : "",
  ]
    .filter(Boolean)
    .join(", ");

  const readmeText = [
    "Dokumentasjonspakke (ZIP)",
    "",
    `Prosjekt: ${String(project.project_no ?? "")} - ${String(project.name ?? "")}`.trim(),
    `Kunde: ${String(project.customer ?? "")}`,
    `Arbeidsordre: ${String(project.work_order ?? "")}`,
    `Generert: ${generatedAt}`,
    "",
    "Valgte deler:",
    selectedParts || "(ingen)",
    "",
    "Merk:",
    "- Originalfilene i systemet er ikke endret.",
    "- Filnavn inne i ZIP er automatisk normalisert for ryddig struktur.",
    "- Se 00_manifest.csv for kobling mellom originalt filnavn, fil-ID og plassering i ZIP.",
  ].join("\r\n");

  const csvRows = [
    ["target_path", "source", "file_id", "original_label", "note"],
    ...manifestRows.map((row) => [row.targetPath, row.source, row.fileId, row.originalLabel, row.note]),
  ];
  const csvText = csvRows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\r\n");

  return [
    { name: "00_README.txt", data: new TextEncoder().encode(readmeText) },
    { name: "00_manifest.csv", data: new TextEncoder().encode(`\uFEFF${csvText}`) },
  ] as ZipEntryInput[];
};

const fetchZipFileEntries = async (
  rows: Array<ZipCandidate & { targetPath: string }>,
  onProgress: (done: number, total: number) => void
) => {
  const entries: ZipEntryInput[] = [];
  const total = rows.length;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const signedUrl = await createSignedUrlForFileRef(row.fileId, { expiresSeconds: 240 });
    const response = await fetch(signedUrl, { credentials: "omit" });
    if (!response.ok) {
      throw new Error(`Klarte ikke hente fil (${row.originalLabel}).`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    entries.push({
      name: row.targetPath,
      data: bytes,
    });
    onProgress(index + 1, total);
  }

  return entries;
};

const readSelection = (mount: HTMLElement): PackageSelection => {
  const checked = (name: string) => {
    const element = mount.querySelector<HTMLInputElement>(`[data-docpack-opt="${name}"]`);
    return Boolean(element?.checked);
  };
  return {
    includeCover: checked("cover"),
    includeWorkOrder: checked("workorder"),
    includeDrawings: checked("drawings"),
    includeTraceability: checked("traceability"),
    includeWeldLog: checked("weldlog"),
    includeWps: checked("wps"),
    includeUsedWpqr: checked("wpqr-used"),
    includeNdt: checked("ndt"),
  };
};

const setSelection = (mount: HTMLElement, value: boolean) => {
  Array.from(mount.querySelectorAll<HTMLInputElement>("[data-docpack-opt]")).forEach((input) => {
    input.checked = value;
  });
};

export async function renderProjectDocumentationPackageSection(opts: {
  mount: HTMLElement;
  project: ProjectRow;
  signal: AbortSignal;
}) {
  const { mount, project, signal } = opts;

  mount.innerHTML = `
    <section class="panel docpack-panel">
      <div class="panel-head">
        <div class="panel-title">Dokumentasjonspakke</div>
        <div class="panel-meta">Generer prosjektets dokumentasjon som PDF.</div>
      </div>
      <div class="panel-body">
        <div class="docpack-builder">
          <div class="docpack-options">
            <label class="docpack-option is-cover">
              <input type="checkbox" data-docpack-opt="cover" checked />
              <span>
                <span class="docpack-option-title">Forside</span>
                <span class="docpack-option-meta">Prosjektinfo og Ti-Tech logo.</span>
              </span>
            </label>
            <label class="docpack-option">
              <input type="checkbox" data-docpack-opt="workorder" checked />
              <span>
                <span class="docpack-option-title">Arbeidsordre</span>
                <span class="docpack-option-meta">Aktiv arbeidsordre knyttet til prosjektet.</span>
              </span>
            </label>
            <label class="docpack-option">
              <input type="checkbox" data-docpack-opt="drawings" checked />
              <span>
                <span class="docpack-option-title">Tegninger</span>
                <span class="docpack-option-meta">Liste over prosjektets tegninger.</span>
              </span>
            </label>
            <label class="docpack-option">
              <input type="checkbox" data-docpack-opt="traceability" checked />
              <span>
                <span class="docpack-option-title">Materialsporbarhet</span>
                <span class="docpack-option-meta">Sporbarhetsliste med kode, dimensjon og heat.</span>
              </span>
            </label>
            <label class="docpack-option">
              <input type="checkbox" data-docpack-opt="weldlog" checked />
              <span>
                <span class="docpack-option-title">Sveiselogg</span>
                <span class="docpack-option-meta">Sveisrader med produksjonsdata, NDT og status.</span>
              </span>
            </label>
            <label class="docpack-option">
              <input type="checkbox" data-docpack-opt="wps" checked />
              <span>
                <span class="docpack-option-title">WPS (brukte)</span>
                <span class="docpack-option-meta">Tar med WPS som faktisk er brukt i prosjektets sveiselogger.</span>
              </span>
            </label>
            <label class="docpack-option">
              <input type="checkbox" data-docpack-opt="wpqr-used" checked />
              <span>
                <span class="docpack-option-title">WPQR for brukte WPS</span>
                <span class="docpack-option-meta">Tar med WPQR som er koblet til brukte WPS.</span>
              </span>
            </label>
            <label class="docpack-option">
              <input type="checkbox" data-docpack-opt="ndt" checked />
              <span>
                <span class="docpack-option-title">NDT-rapporter</span>
                <span class="docpack-option-meta">Liste over NDT-rapporter for prosjektet.</span>
              </span>
            </label>
          </div>
          <div class="docpack-actions">
            <button class="btn small" type="button" data-docpack-select-all>Velg alle</button>
            <button class="btn small" type="button" data-docpack-clear-all>Fjern alle</button>
            <button class="btn accent" type="button" data-docpack-generate>Forhåndsvis PDF</button>
            <button class="btn" type="button" data-docpack-zip>Last ned ZIP</button>
          </div>
          <div class="docpack-hint muted">
            PDF opprettes via nettleserens print-dialog. ZIP pakker vedlegg automatisk uten manuell renaming.
          </div>
        </div>
      </div>
    </section>
  `;

  const generateBtn = qs<HTMLButtonElement>(mount, "[data-docpack-generate]");
  const zipBtn = qs<HTMLButtonElement>(mount, "[data-docpack-zip]");
  const selectAllBtn = qs<HTMLButtonElement>(mount, "[data-docpack-select-all]");
  const clearAllBtn = qs<HTMLButtonElement>(mount, "[data-docpack-clear-all]");

  const setBusy = (mode: "pdf" | "zip" | null, zipLabel?: string) => {
    const busy = mode !== null;
    generateBtn.disabled = busy;
    zipBtn.disabled = busy;
    selectAllBtn.disabled = busy;
    clearAllBtn.disabled = busy;
    generateBtn.textContent = mode === "pdf" ? "Genererer..." : "Generer PDF";
    zipBtn.textContent = mode === "zip" ? zipLabel || "Pakker..." : "Last ned ZIP";
  };

  selectAllBtn.addEventListener(
    "click",
    () => {
      setSelection(mount, true);
    },
    { signal }
  );

  clearAllBtn.addEventListener(
    "click",
    () => {
      setSelection(mount, false);
    },
    { signal }
  );

  generateBtn.addEventListener(
    "click",
    async () => {
      const selection = readSelection(mount);
      const hasAtLeastOneSection =
        selection.includeWorkOrder ||
        selection.includeDrawings ||
        selection.includeTraceability ||
        selection.includeWeldLog ||
        selection.includeWps ||
        selection.includeUsedWpqr ||
        selection.includeNdt;

      if (!hasAtLeastOneSection) {
        toast("Velg minst en del som skal med i dokumentasjonspakken.");
        return;
      }

      setBusy("pdf");
      try {
        const data = await collectData(project, selection);
        await printDocumentationPackage({ project, selection, data });
      } catch (error: any) {
        console.error(error);
        toast(String(error?.message ?? error ?? "Klarte ikke generere dokumentasjonspakken."));
      } finally {
        setBusy(null);
      }
    },
    { signal }
  );

  zipBtn.addEventListener(
    "click",
    async () => {
      const selection = readSelection(mount);
      const hasAtLeastOneSection =
        selection.includeWorkOrder ||
        selection.includeDrawings ||
        selection.includeTraceability ||
        selection.includeWeldLog ||
        selection.includeWps ||
        selection.includeUsedWpqr ||
        selection.includeNdt;

      if (!hasAtLeastOneSection) {
        toast("Velg minst en del som skal med i dokumentasjonspakken.");
        return;
      }

      setBusy("zip", "Bygger hovedfil...");
      try {
        const data = await collectData(project, selection);
        const mainPdf = await createMainDocumentationPdf({ project, selection, data });

        setBusy("zip", "Samler vedlegg...");
        const candidates = await buildZipCandidates(project, selection, data);
        const { targetRows, manifestRows } = resolveZipTargets(candidates);

        const fileEntries = targetRows.length
          ? await fetchZipFileEntries(targetRows, (done, total) => {
              setBusy("zip", `Pakker ${done}/${total}...`);
            })
          : [];

        const mainEntry: ZipEntryInput = {
          name: "00_Hoveddokumentasjon.pdf",
          data: new Uint8Array(mainPdf),
        };

        setBusy("zip", "Pakker arkiv...");
        const manifestWithMain = [
          {
            targetPath: mainEntry.name,
            source: "Hoveddokumentasjon",
            fileId: "GENERATED",
            originalLabel: mainEntry.name,
            note: "Generert i dokumentasjonspakke-modulen.",
          },
          ...manifestRows,
        ];

        const metaEntries = buildZipMetaEntries({
          project,
          selection,
          manifestRows: manifestWithMain,
        });
        const zipBlob = createZipBlob([mainEntry, ...metaEntries, ...fileEntries]);

        const dateToken = new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace("T", "_")
          .slice(0, 13);
        const projectNo = sanitizeFilePart(String(project.project_no ?? "").trim(), "prosjekt");
        const fileName = `Dokumentasjonspakke_${projectNo}_${dateToken}.zip`;
        downloadBlob(zipBlob, fileName);
        toast(`ZIP klar (${targetRows.length} vedlegg + hovedfil).`);
      } catch (error: any) {
        console.error(error);
        toast(String(error?.message ?? error ?? "Klarte ikke lage ZIP-pakke."));
      } finally {
        setBusy(null);
      }
    },
    { signal }
  );
}

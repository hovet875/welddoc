import type { ProfileWelderRow } from "@/repo/certRepo";
import type { ProjectWeldRow, WeldEmployeeOption } from "@/repo/weldLogRepo";
import { esc } from "@/utils/dom";
import { filterRowsByStatus, formatNorDate, getWelderLabel, sortRowsByWeldNo, statusLabel } from "./weldLogUtils";
import type { WeldLogNdtReportOption, WeldLogPrintColumnKey, WeldLogPrintOptions } from "../types";

type PrintArgs = {
  rows: ProjectWeldRow[];
  reports: WeldLogNdtReportOption[];
  employees: WeldEmployeeOption[];
  welders: ProfileWelderRow[];
  project: { project_no: number; name: string };
  drawingLabel: string;
  options?: WeldLogPrintOptions;
};

const DASH = "—";

const COLUMN_LABELS: Record<WeldLogPrintColumnKey, string> = {
  weldNumber: "Sveis ID",
  jointType: "Fuge",
  component: "Komponent",
  welder: "Sveiser",
  wps: "WPS",
  weldDate: "Dato",
  filler: "Tilsett",
  vt: "Visuell (VT)",
  pt: "Sprekk (PT/MT)",
  vol: "Volumetrisk (RT/UT)",
  status: "Status",
};

const formatGeneratedAt = () => {
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
};

const componentLabel = (row: ProjectWeldRow) => {
  const a = String(row.component_a?.type_code ?? "").trim();
  const aIndex = row.component_a?.code_index ?? "";
  const b = String(row.component_b?.type_code ?? "").trim();
  const bIndex = row.component_b?.code_index ?? "";

  const left = a ? `${a}${aIndex}` : "";
  const right = b ? `${b}${bIndex}` : "";

  if (left && right) return `${left} <-> ${right}`;
  return left || right || DASH;
};

const fillerLabel = (row: ProjectWeldRow) => {
  const fillerCode = String(row.filler?.type_code ?? "").trim();
  if (!fillerCode) return DASH;
  return `${fillerCode}${row.filler?.code_index ?? ""}`;
};

const reportById = (reports: WeldLogNdtReportOption[]) => {
  const map = new Map<string, string>();
  reports.forEach((report) => {
    const id = String(report.id ?? "").trim();
    if (!id) return;
    const no = String(report.report_no ?? "").trim() || id;
    map.set(id, no);
  });
  return map;
};

const employeeById = (employees: WeldEmployeeOption[]) => {
  const map = new Map<string, string>();
  employees.forEach((employee) => {
    const id = String(employee.id ?? "").trim();
    if (!id) return;
    map.set(id, employee.label || id);
  });
  return map;
};

const buildCellValue = (row: ProjectWeldRow, column: WeldLogPrintColumnKey, refs: {
  reportLookup: Map<string, string>;
  employeeLookup: Map<string, string>;
  welders: ProfileWelderRow[];
}) => {
  if (column === "weldNumber") return String(row.weld_no ?? DASH);
  if (column === "jointType") return String(row.joint_type ?? DASH);
  if (column === "component") return componentLabel(row);
  if (column === "welder") return getWelderLabel(row, refs.welders);
  if (column === "wps") return String(row.wps?.doc_no ?? DASH);
  if (column === "weldDate") return formatNorDate(row.weld_date);
  if (column === "filler") return fillerLabel(row);
  if (column === "pt") return refs.reportLookup.get(String(row.crack_report_id ?? "").trim()) || DASH;
  if (column === "vol") return refs.reportLookup.get(String(row.volumetric_report_id ?? "").trim()) || DASH;
  if (column === "status") return statusLabel(row.status);

  const vtReport = refs.reportLookup.get(String(row.visual_report_id ?? "").trim()) || "";
  const vtInspector = refs.employeeLookup.get(String(row.visual_inspector ?? "").trim()) || "";
  return vtReport || (vtInspector ? `Intern: ${vtInspector}` : DASH);
};

export async function printWeldLogTable(args: PrintArgs) {
  const options = args.options;
  const selectedColumns: WeldLogPrintColumnKey[] = options?.columns?.length ? options.columns : [
    "weldNumber",
    "jointType",
    "component",
    "welder",
    "wps",
    "weldDate",
    "filler",
    "vt",
    "pt",
    "vol",
    "status",
  ];

  const filteredRows = sortRowsByWeldNo(filterRowsByStatus(args.rows, options?.statusFilter ?? "all"));
  const reportLookup = reportById(args.reports);
  const employeeLookup = employeeById(args.employees);

  const headCells = selectedColumns.map((column) => `<th>${esc(COLUMN_LABELS[column])}</th>`).join("");

  const bodyRows = filteredRows.map((row) => {
    const cells = selectedColumns
      .map((column) => `<td>${esc(buildCellValue(row, column, { reportLookup, employeeLookup, welders: args.welders }))}</td>`)
      .join("");
    return `<tr>${cells}</tr>`;
  });

  const projectNo = String(args.project.project_no ?? "").trim();
  const projectName = String(args.project.name ?? "").trim();
  const projectLabel = projectNo || projectName || DASH;
  const logoSrc = `${import.meta.env.BASE_URL}images/titech-logo.png`;

  const includeProjectMeta = options?.includeProjectMeta ?? true;

  const html = `
    <div class="weldlog-print-sheet">
      <div class="weldlog-print-page">
        <header class="weldlog-print-header">
          <div class="weldlog-print-brand">
            <div class="weldlog-print-logo">
              ${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : ""}
            </div>
            <div class="weldlog-print-title-wrap">
              <div class="weldlog-print-kicker">Sveiselogg</div>
              <h1 class="weldlog-print-title">QC og Sporbarhet</h1>
            </div>
          </div>
          ${
            includeProjectMeta
              ? `
              <div class="weldlog-print-meta">
                <div><strong>Prosjekt:</strong> ${esc(projectLabel)}</div>
                ${projectName && projectName !== projectLabel ? `<div><strong>Navn:</strong> ${esc(projectName)}</div>` : ""}
                <div><strong>Tegning:</strong> ${esc(args.drawingLabel || DASH)}</div>
                <div><strong>Generert:</strong> ${esc(formatGeneratedAt())}</div>
                <div><strong>Antall sveiser:</strong> ${esc(String(filteredRows.length))}</div>
              </div>
            `
              : ""
          }
        </header>

        <div class="weldlog-print-table-wrap">
          <table class="weldlog-print-table">
            <thead>
              <tr class="weldlog-print-field-row">${headCells}</tr>
            </thead>
            <tbody>
              ${bodyRows.length ? bodyRows.join("") : `<tr><td colspan="${selectedColumns.length}">Ingen sveiser funnet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const existing = document.querySelector(".weldlog-print-sheet");
  if (existing) existing.remove();

  const existingPageStyle = document.querySelector<HTMLStyleElement>("style[data-weldlog-print-page]");
  if (existingPageStyle) existingPageStyle.remove();

  const shell = document.createElement("div");
  shell.innerHTML = html;
  const sheet = shell.firstElementChild as HTMLElement;
  document.body.appendChild(sheet);

  const pageStyle = document.createElement("style");
  pageStyle.setAttribute("data-weldlog-print-page", "true");
  pageStyle.textContent = "@media print { @page { size: A4 landscape; margin: 0; } }";
  document.head.appendChild(pageStyle);
  document.body.classList.add("print-weld-log");

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
    document.body.classList.remove("print-weld-log");
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.print();
}

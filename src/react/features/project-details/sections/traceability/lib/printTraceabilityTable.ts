import type { ProjectTraceabilityRow, TraceabilityTypeRow } from "@/repo/traceabilityRepo";
import { esc } from "@/utils/dom";
import type { TraceabilityPrintColumnKey, TraceabilityPrintOptions } from "../types";
import { lookupType, renderDimension, sortedTraceabilityRows, statusForTraceabilityRow } from "./traceabilityUtils";

type TraceabilityProject = {
  project_no: number;
  name: string;
};

type PrintTraceabilityTableArgs = {
  rows: ProjectTraceabilityRow[];
  types: TraceabilityTypeRow[];
  project: TraceabilityProject;
  options?: TraceabilityPrintOptions;
};

const COLUMN_LABELS: Record<TraceabilityPrintColumnKey, string> = {
  code: "Kode",
  dimensionType: "Dimensjon/type",
  materialType: "Materialkvalitet",
  heat: "Heat nr.",
};

const DEFAULT_COLUMNS: TraceabilityPrintColumnKey[] = ["code", "dimensionType", "materialType", "heat"];

export async function printTraceabilityTable({ rows, types, project, options }: PrintTraceabilityTableArgs) {
  const columns = options?.columns?.length ? options.columns : DEFAULT_COLUMNS;
  const statusFilter = options?.statusFilter ?? "all";

  const statusFilteredRows = sortedTraceabilityRows(rows).filter((row) => {
    if (statusFilter === "all") return true;
    const status = statusForTraceabilityRow(row);
    if (statusFilter === "ready") return status.tone === "success";
    if (statusFilter === "manual") return status.label.toLowerCase() === "manuell";
    if (statusFilter === "missing") return status.label.toLowerCase() === "mangel";
    return true;
  });

  const header = columns.map((column) => COLUMN_LABELS[column]);

  const bodyRows = statusFilteredRows.map((row) => {
    const type = row.type ?? lookupType(types, row.type_code);
    const idx = row.code_index ?? 0;

    const codeLabel = `${row.type_code}${idx || ""}`;
    const dimBase = renderDimension(row);
    const dimLabel = `${dimBase}${type?.label ? ` ${type.label.toLowerCase()}` : ""}`.trim();
    const materialLabel = type?.use_filler_type ? row.filler_type ?? "—" : row.material?.name ?? "—";
    const heatLabel = (row.heat_number || "").trim() || (row.cert?.heat_numbers ?? []).filter(Boolean).join(", ") || "—";

    const allColumns: Record<TraceabilityPrintColumnKey, string> = {
      code: codeLabel,
      dimensionType: dimLabel || "—",
      materialType: materialLabel,
      heat: heatLabel,
    };

    return columns.map((column) => allColumns[column]);
  });

  const projectNo = String(project.project_no ?? "").trim();
  const projectName = (project.name ?? "").trim();
  const projectLabel = esc(projectNo || projectName);
  const projectMeta = esc(projectName && projectNo ? projectName : "");
  const logoSrc = `${import.meta.env.BASE_URL}images/titech-logo.png`;

  const html = `
    <div class="trace-print-sheet">
      <div class="msl-page">
        <header class="msl-header">
          <div class="msl-brand">
            <div class="msl-logo">
              ${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : ""}
            </div>
            <div class="msl-titles">
              <div class="msl-kicker">Materialsporbarhet</div>
              <h1 class="msl-title">Sporbarhetsliste</h1>
            </div>
          </div>
          ${options?.includeProjectMeta === false
            ? ""
            : `
          <div class="msl-project-card">
            <div class="msl-project-label">Prosjekt</div>
            <div class="msl-project-value">${projectLabel}</div>
            ${projectMeta ? `<div class="msl-project-meta">${projectMeta}</div>` : ""}
          </div>
          `}
        </header>

        <div class="msl-table-wrap">
          <table class="msl-table">
            <thead>
              <tr class="msl-head">${header.map((value) => `<th>${value}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${bodyRows
                .map((row) => `<tr>${row.map((cell) => `<td>${esc(String(cell ?? ""))}</td>`).join("")}</tr>`)
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const existing = document.querySelector(".trace-print-sheet");
  if (existing) existing.remove();

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const sheet = wrapper.firstElementChild;
  if (!sheet) throw new Error("Klarte ikke å bygge utskriftsinnhold.");

  document.body.appendChild(sheet);
  document.body.classList.add("print-traceability");

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
    document.body.classList.remove("print-traceability");
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.print();
}

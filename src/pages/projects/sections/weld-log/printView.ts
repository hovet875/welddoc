import type { ProjectRow } from "../../../../repo/projectRepo";
import { esc } from "../../../../utils/dom";
import type { EmployeeOption, NdtReportRow, WeldListRow } from "./types";

const dash = "-";

const formatDate = (value: string | null | undefined) => {
  if (!value) return dash;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}.${mm}.${yyyy}`;
  }
  return raw;
};

const normalizedNo = (value: string | number | null | undefined) => {
  const text = String(value ?? "").trim();
  if (!text) return Number.POSITIVE_INFINITY;
  const num = Number(text);
  if (!Number.isFinite(num)) return Number.POSITIVE_INFINITY;
  return num;
};

const sortedRows = (rows: WeldListRow[]) =>
  [...rows].sort((a, b) => {
    const aNo = normalizedNo(a.sveis_id);
    const bNo = normalizedNo(b.sveis_id);
    if (aNo !== bNo) return aNo - bNo;
    return String(a.id).localeCompare(String(b.id));
  });

const welderLabel = (row: WeldListRow) => {
  const no = String(row.sveiser?.welder_no ?? "").trim();
  const name = String(row.sveiser?.display_name ?? "").trim();
  if (no || name) return [no, name].filter(Boolean).join(" - ");
  return String(row.sveiser_id ?? "").trim() || dash;
};

const componentLabel = (row: WeldListRow) => {
  const a = String(row.komponent_a ?? "").trim();
  const b = String(row.komponent_b ?? "").trim();
  if (a && b) return `${a} <-> ${b}`;
  return a || b || dash;
};

const lookupValue = (map: Map<string, string>, id: string | null | undefined) => {
  const key = String(id ?? "").trim();
  if (!key) return "";
  return map.get(key) || key;
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

export async function printWeldLogTable(opts: {
  rows: WeldListRow[];
  reports: NdtReportRow[];
  employees: EmployeeOption[];
  project: ProjectRow;
  drawingLabel: string;
}) {
  const { rows, reports, employees, project, drawingLabel } = opts;
  const reportById = new Map<string, string>();
  reports.forEach((row) => {
    const id = String(row.id ?? "").trim();
    const no = String(row.report_no ?? "").trim();
    if (id) reportById.set(id, no || id);
  });

  const employeeById = new Map<string, string>();
  employees.forEach((row) => {
    const id = String(row.id ?? "").trim();
    const label = String(row.label ?? "").trim();
    if (id) employeeById.set(id, label || id);
  });

  const projectNo = String(project.project_no ?? "").trim();
  const projectName = String(project.name ?? "").trim();
  const projectLabel = projectNo || projectName || dash;
  const generatedAt = formatGeneratedAt();
  const logoSrc = `${import.meta.env.BASE_URL}images/titech-logo.png`;

  const tableRows = sortedRows(rows).map((row) => {
    const vtReport = lookupValue(reportById, row.vt_report_id);
    const vtInspector = lookupValue(employeeById, row.kontrollert_av);
    const vtValue = vtReport || (vtInspector ? `Intern: ${vtInspector}` : dash);
    const ptValue = lookupValue(reportById, row.pt_report_id) || dash;
    const volValue = lookupValue(reportById, row.vol_report_id) || dash;
    const status = row.status ? "Godkjent" : "Til kontroll";
    const cells = [
      String(row.sveis_id ?? dash),
      String(row.fuge ?? dash),
      componentLabel(row),
      welderLabel(row),
      String(row.wps ?? dash),
      formatDate(row.dato),
      String(row.tilsett ?? dash),
      vtValue,
      ptValue,
      volValue,
      status,
    ];
    return `<tr>${cells.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`;
  });

  const html = `
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
        <div class="weldlog-print-meta">
          <div><strong>Prosjekt:</strong> ${esc(projectLabel)}</div>
          ${projectName && projectName !== projectLabel ? `<div><strong>Navn:</strong> ${esc(projectName)}</div>` : ""}
          <div><strong>Tegning:</strong> ${esc(drawingLabel || dash)}</div>
          <div><strong>Generert:</strong> ${esc(generatedAt)}</div>
          <div><strong>Antall sveiser:</strong> ${esc(String(rows.length))}</div>
        </div>
      </header>

      <div class="weldlog-print-table-wrap">
        <table class="weldlog-print-table">
          <thead>
            <tr class="weldlog-print-group-row">
              <th colspan="3">Tegning</th>
              <th colspan="4">Produksjon</th>
              <th colspan="4">NDT</th>
            </tr>
            <tr class="weldlog-print-field-row">
              <th>Sveis ID</th>
              <th>Fuge</th>
              <th>Komponent</th>
              <th>Sveiser</th>
              <th>WPS</th>
              <th>Dato</th>
              <th>Tilsett</th>
              <th>Visuell (VT)</th>
              <th>Sprekk (PT/MT)</th>
              <th>Volumetrisk (RT/UT)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows.length ? tableRows.join("") : `<tr><td colspan="11">Ingen sveiser funnet.</td></tr>`}
          </tbody>
        </table>
      </div>

      <footer class="weldlog-print-signatures">
        <div class="weldlog-signature-card">
          <div class="weldlog-signature-line"></div>
          <div class="weldlog-signature-label">Sveiser</div>
        </div>
        <div class="weldlog-signature-card">
          <div class="weldlog-signature-line"></div>
          <div class="weldlog-signature-label">Sveisekoordinator</div>
        </div>
        <div class="weldlog-signature-card">
          <div class="weldlog-signature-line"></div>
          <div class="weldlog-signature-label">Tredjepart</div>
        </div>
      </footer>
    </div>
  `;

  const existing = document.querySelector(".weldlog-print-sheet");
  if (existing) existing.remove();
  const existingPageStyle = document.querySelector<HTMLStyleElement>("style[data-weldlog-print-page]");
  if (existingPageStyle) existingPageStyle.remove();

  const sheet = document.createElement("div");
  sheet.className = "weldlog-print-sheet";
  sheet.innerHTML = html;
  document.body.appendChild(sheet);
  const pageStyle = document.createElement("style");
  pageStyle.setAttribute("data-weldlog-print-page", "true");
  pageStyle.textContent = "@media print { @page { size: A4 landscape; margin: 0; } }";
  document.head.appendChild(pageStyle);
  document.body.classList.add("print-weld-log");
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
    document.body.classList.remove("print-weld-log");
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.print();
}

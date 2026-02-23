import type { ProjectRow } from "../../../repo/projectRepo";
import type { ProjectTraceabilityRow, TraceabilityTypeRow } from "../../../repo/traceabilityRepo";

import { esc } from "../../../utils/dom";
import { iconSvg, renderIconButton } from "../../../ui/iconButton";

const lookupType = (types: TraceabilityTypeRow[], code: string) => types.find((t) => t.code === code) || null;

const renderDimension = (row: ProjectTraceabilityRow) => {
  const parts: string[] = [];
  if (row.dn) parts.push(`DN${row.dn}`);
  if (row.dn2) parts.push(`DN${row.dn2}`);
  if (row.sch) parts.push(`SCH${row.sch}`);
  if (row.pressure_class) parts.push(String(row.pressure_class));
  if (row.thickness) parts.push(`${row.thickness} mm`);
  if (row.filler_type) parts.push(row.filler_type);
  return parts.join(" · ") || "—";
};

const renderStatus = (row: ProjectTraceabilityRow) => {
  if (row.material_certificate_id && row.cert?.file_id) {
    return `<button type="button" class="status-pill ok" style="cursor:pointer" data-open-cert="${esc(row.cert.file_id)}">Klar</button>`;
  }
  if (!row.material_certificate_id && String(row.heat_number ?? "").trim()) {
    return `<span class="status-pill manual" title="Manuell heat. Ikke koblet til sertifikat.">Manuell</span>`;
  }
  return `<span class="status-pill warn">Mangel</span>`;
};

const renderCert = (row: ProjectTraceabilityRow) => {
  const selected = (row.heat_number || "").trim();
  if (selected) return esc(selected);
  if (!row.cert) return `<span class="muted">Ikke valgt</span>`;
  const heat = (row.cert.heat_numbers ?? []).filter(Boolean).join(", ");
  return heat ? esc(heat) : `<span class="muted">—</span>`;
};

const sortedRows = (rows: ProjectTraceabilityRow[]) =>
  [...rows].sort((a, b) => {
    const codeA = (a.type_code ?? "").toLowerCase();
    const codeB = (b.type_code ?? "").toLowerCase();
    const codeCompare = codeA.localeCompare(codeB, "nb", { numeric: true, sensitivity: "base" });
    if (codeCompare !== 0) return codeCompare;
    const idxA = a.code_index ?? 0;
    const idxB = b.code_index ?? 0;
    if (idxA !== idxB) return idxA - idxB;
    return String(a.id).localeCompare(String(b.id));
  });

export function renderTraceabilityRows(opts: {
  rows: ProjectTraceabilityRow[];
  types: TraceabilityTypeRow[];
  isAdmin: boolean;
  traceBody: HTMLTableSectionElement;
}) {
  const { rows, types, isAdmin, traceBody } = opts;

  if (rows.length === 0) {
    traceBody.innerHTML = `<tr><td colspan="7" class="muted">Ingen sporbarhet registrert.</td></tr>`;
    return;
  }

  const seqByType = new Map<string, number>();
  const nextSeq = (code: string) => {
    const prev = seqByType.get(code) ?? 0;
    const next = prev + 1;
    seqByType.set(code, next);
    return next;
  };

  traceBody.innerHTML = sortedRows(rows)
    .map((r) => {
      const type = r.type ?? lookupType(types, r.type_code);
      const idx = r.code_index ?? nextSeq(r.type_code);
      const codeLabel = `${r.type_code}${idx}`;
      const typeLabel = type?.use_filler_type ? (r.filler_type ?? "") : (r.material?.name ?? "");
      return `
        <tr>
          <td data-label="Kode"><span class="trace-code">${esc(codeLabel)}</span></td>
          <td data-label="Komponent">${esc(type?.label ?? "")}</td>
          <td data-label="Material/type">${esc(typeLabel || "—")}</td>
          <td data-label="Dimensjon">${esc(renderDimension(r))}</td>
          <td data-label="Sertifikat">${renderCert(r)}</td>
          <td data-label="Status">${renderStatus(r)}</td>
          <td class="actcell">
            ${isAdmin ? renderIconButton({ dataKey: "trace-edit", id: r.id, title: "Endre", icon: iconSvg("pencil") }) : ""}
            ${isAdmin ? renderIconButton({ dataKey: "trace-del", id: r.id, title: "Slett", icon: iconSvg("trash"), danger: true }) : ""}
          </td>
        </tr>
      `;
    })
    .join("");
}

export async function printTraceabilityTable(opts: {
  rows: ProjectTraceabilityRow[];
  types: TraceabilityTypeRow[];
  project: ProjectRow;
}) {
  const { rows, types, project } = opts;
  // 4-kolonne oppsett som i skjemaet
  const header = ["Kode", "Dimensjon/type", "Materialkvalitet", "Heat nr."];

  const bodyRows = sortedRows(rows).map((r) => {
    const type = r.type ?? lookupType(types, r.type_code);
    const idx = r.code_index ?? 0;

    const codeLabel = `${r.type_code}${idx || ""}`;

    const dimBase = renderDimension(r);
    const dimLabel = `${dimBase}${type?.label ? ` ${type.label.toLowerCase()}` : ""}`.trim();

    const materialLabel = type?.use_filler_type ? (r.filler_type ?? "—") : (r.material?.name ?? "—");

    const heatLabel = (r.heat_number || "").trim() || (r.cert?.heat_numbers ?? []).filter(Boolean).join(", ") || "—";

    return [codeLabel, dimLabel || "—", materialLabel, heatLabel];
  });

  const projectNo = project.project_no == null ? "" : String(project.project_no).trim();
  const projectName = (project.name ?? "").trim();
  const projectLabel = esc(projectNo || projectName);
  const projectMeta = esc(projectName && projectNo ? projectName : "");
  const logoSrc = `${import.meta.env.BASE_URL}images/titech-logo.png`;

  const html = `
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
        <div class="msl-project-card">
          <div class="msl-project-label">Prosjekt</div>
          <div class="msl-project-value">${projectLabel}</div>
          ${projectMeta ? `<div class="msl-project-meta">${projectMeta}</div>` : ""}
        </div>
      </header>

      <div class="msl-table-wrap">
        <table class="msl-table">
          <thead>
            <tr class="msl-head">
              ${header.map((h) => `<th>${h}</th>`).join("")}
            </tr>
          </thead>

          <tbody>
            ${bodyRows
              .map((row) => `<tr>${row.map((c) => `<td>${esc(String(c ?? ""))}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const existing = document.querySelector(".trace-print-sheet");
  if (existing) existing.remove();

  const sheet = document.createElement("div");
  sheet.className = "trace-print-sheet";
  sheet.innerHTML = html;
  document.body.appendChild(sheet);
  document.body.classList.add("print-traceability");
  sheet.style.display = "block";

  const waitForImages = () =>
    Promise.all(
      Array.from(sheet.querySelectorAll("img")).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((res) => {
          img.onload = img.onerror = () => res();
        });
      })
    );

  await waitForImages();
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

  const cleanup = () => {
    sheet.remove();
    document.body.classList.remove("print-traceability");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
}

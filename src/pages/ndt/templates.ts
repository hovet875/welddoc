import type { ProfileWelderRow } from "../../repo/certRepo";
import type { ProjectRow } from "../../repo/projectRepo";
import type { CustomerRow } from "../../repo/customerRepo";
import type { NdtMethodRow, NdtReportRow } from "../../repo/ndtReportRepo";
import type { NdtSupplierRow, NdtInspectorRow } from "../../repo/ndtSupplierRepo";
import { esc } from "../../utils/dom";
import { fmtDate, truncateLabel } from "../../utils/format";
import { renderIconButton, iconSvg } from "../../ui/iconButton";
import { renderDatePickerInput } from "../../ui/datePicker";

function formatWelderLabel(w: ProfileWelderRow) {
  const no = w.welder_no ? String(w.welder_no).padStart(3, "0") : "-";
  const name = (w.display_name || "Uten navn").trim();
  return `${no} - ${name}`;
}

function firstNameFromDisplayName(displayName: string | null | undefined) {
  const cleaned = (displayName || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "Uten navn";
  const parts = cleaned.split(" ");
  if (parts.length <= 1) return cleaned;
  return parts.slice(0, -1).join(" ");
}

function formatWelderList(rows: NdtReportRow["report_welders"]) {
  const labels = rows
    .map((r) => r.welder)
    .filter(Boolean)
    .map((w) => firstNameFromDisplayName(w?.display_name));
  return labels.length ? labels.join(", ") : "-";
}

function actionBtn(kind: "edit-ndt" | "del-ndt", id: string, label: string) {
  const danger = kind === "del-ndt";
  const svg = danger ? iconSvg("trash") : iconSvg("pencil");
  const title = danger ? "Slett" : "Endre";
  const dataKey = danger ? "del" : "edit";
  return renderIconButton({ dataKey, id, title, icon: svg, danger, label });
}

export function renderReportTable(
  rows: NdtReportRow[],
  showActions: boolean,
  projectMap: Map<string, ProjectRow>,
  getPillClass: (label: string) => string
) {
  return `
    <div class="table-scroll">
      <table class="data-table ndt-table">
        <thead>
          <tr>
            <th>Fil</th>
            <th>Prosjekt</th>
            <th>Kunde</th>
            <th>NDT-firma</th>
            <th>Kontrollør</th>
            <th>Sveiser</th>
            <th>Rapportdato</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const fileLabel = r.file?.label || "Rapport";
              const fileBase = fileLabel.replace(/\.pdf$/i, "");
              const displayName = truncateLabel(fileBase, 15);
              const methodLabel = (r.method?.code || r.method?.label || "").trim();
              const defectCount = r.defect_count ?? 0;
              const resultLabel = defectCount > 0 ? "Avvist" : "Godkjent";
              const resultClass = defectCount > 0 ? "status-pill fault" : "status-pill ok";
              const projectNo = (r.title ?? "").trim();
              const projectName = projectNo ? projectMap.get(projectNo)?.name ?? "" : "";
              const projectLabel = projectName ? `${projectNo} - ${projectName}` : projectNo;
              const pillClass = getPillClass(methodLabel);
              const filePillClass = pillClass;
              return `
              <tr>
                <td data-label="Fil">
                  <div class="filecell">
                    ${r.file_id
                      ? `<button type="button" class="${filePillClass}" data-openpdf="${esc(r.file_id)}" title="${esc(fileBase)}">${esc(displayName)}</button>`
                      : `<span class="${filePillClass}" title="${esc(fileBase)}">${esc(displayName)}</span>`}
                  </div>
                </td>
                <td data-label="Prosjekt">${esc(projectLabel)}</td>
                <td data-label="Kunde">${esc(r.customer ?? "")}</td>
                <td data-label="NDT-firma">${esc(r.ndt_supplier?.name ?? "")}</td>
                <td data-label="Kontrollør">${esc(r.ndt_inspector?.name ?? "")}</td>
                <td data-label="Sveiser">${esc(formatWelderList(r.report_welders || []))}</td>
                <td data-label="Rapportdato">${esc(fmtDate(r.report_date ?? r.created_at))}</td>
                <td data-label="Status"><span class="${resultClass}">${resultLabel}</span></td>
                <td class="actcell">
                  ${showActions ? `${actionBtn("edit-ndt", r.id, r.title ?? "Rapport")}${actionBtn("del-ndt", r.id, r.title ?? "Rapport")}` : ""}
                </td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function ndtReportFormBody(
  methods: NdtMethodRow[],
  welders: ProfileWelderRow[],
  projects: ProjectRow[],
  customers: CustomerRow[],
  suppliers: NdtSupplierRow[],
  inspectors: NdtInspectorRow[],
  opts?: { showReplaceFile?: boolean }
) {
  const methodOptions = methods
    .map((m) => `<option value="${esc(m.id)}" data-code="${esc(m.code)}">${esc(m.label)}</option>`)
    .join("");

  const projectOptions = projects
    .map((p) => `<option value="${esc(String(p.project_no))}">${esc(`${p.project_no} - ${p.name}`)}</option>`)
    .join("");

  const customerOptions = customers.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
  const supplierOptions = suppliers.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
  const inspectorOptions = inspectors.map((i) => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("");

  const welderOptions = welders
    .map((w) => {
      const label = formatWelderLabel(w);
      return `
      <label class="checkboxpill welder-pill" data-welder-label="${esc(label.toLowerCase())}">
        <input type="checkbox" value="${esc(w.id)}" />
        <span>${esc(label)}</span>
      </label>
    `;
    })
    .join("");

  return `
    <div class="modalgrid">
      <div class="field">
        <label>Prosjektnr</label>
        <select data-f="title" class="select">
          <option value="">Velg prosjekt...</option>
          ${projectOptions}
        </select>
      </div>

      <div class="field">
        <label>Kunde</label>
        <select data-f="customer" class="select">
          <option value="">Velg kunde...</option>
          ${customerOptions}
        </select>
      </div>

      <div class="field">
        <label>Rapportdato</label>
        ${renderDatePickerInput({
          value: new Date().toISOString().slice(0, 10),
          inputAttrs: `data-f="report_date" class="input"`,
          openLabel: "Velg rapportdato",
        })}
      </div>

      <div class="field">
        <label>NDT-metode</label>
        <select data-f="method_id" class="select">
          <option value="">Velg metode...</option>
          ${methodOptions}
        </select>
      </div>

      <div class="field">
        <label>NDT-firma</label>
        <select data-f="ndt_supplier_id" class="select">
          <option value="">Velg firma...</option>
          ${supplierOptions}
        </select>
      </div>

      <div class="field">
        <label>NDT-kontrollør</label>
        <select data-f="ndt_inspector_id" class="select">
          <option value="">Velg kontrollør...</option>
          ${inspectorOptions}
        </select>
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>Sveisere</label>
        <div class="welder-list" data-f="welder_list">
          ${welderOptions || `<div class=\"muted\">Ingen sveisere funnet.</div>`}
        </div>
      </div>

      <div class="field" data-rt-only style="grid-column:1 / -1; display:none;">
        <label>Fordeling pr sveiser (RT)</label>
        <div class="welder-counts" data-f="welder_counts"></div>
        <div class="muted" style="font-size:12px;">Oppgi antall sveis og feil per sveiser for RT-rapporter.</div>
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>PDF</label>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
        <div data-f="pdfMeta"></div>
        ${opts?.showReplaceFile ? `<div class="muted" style="font-size:12px;">Velg en fil for å erstatte eksisterende PDF.</div>` : ""}
      </div>
    </div>
  `;
}

export function currentPdfMeta(fileRef: string | null, label?: string | null) {
  if (!fileRef) {
    return `<div class="pdfmeta muted" style="font-size:12px;">Ingen eksisterende PDF</div>`;
  }

  const safeLabel = (label || "Eksisterende PDF").trim() || "Eksisterende PDF";

  return `
    <div class="pdfmeta">
      <div class="muted" style="font-size:12px;">Eksisterende PDF:
      <button class="linkbtn" type="button" data-openpdf="${esc(fileRef)}">${esc(safeLabel)}</button></div>
    </div>
  `;
}



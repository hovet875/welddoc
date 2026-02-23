import type { WPQRRow, WPSRow } from "../../repo/wpsRepo";
import type { StandardRow } from "../../repo/standardRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import { esc, renderOptions } from "../../utils/dom";
import { fmtDate } from "../../utils/format";
import type { WeldingProcessRow } from "../../repo/weldingProcessRepo";
import { renderIconButton } from "../../ui/iconButton";
import { renderDatePickerInput } from "../../ui/datePicker";

function icon(name: "pencil" | "trash") {
  if (name === "pencil") {
    return `
      <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
        <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L8.25 18.463 3 19.5l1.037-5.25L16.862 3.487zM5.39 17.11l2.872-.566L18.98 5.826l-2.306-2.306L5.956 14.238l-.566 2.872z"/>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
      <path fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H5.5a1 1 0 1 0 0 2H6v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h.5a1 1 0 1 0 0-2H16V4a1 1 0 0 0-1-1H9zm1 2h4V4h-4v1zm-1 5a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1z"/>
    </svg>
  `;
}

export function actionBtn(kind: "edit-wpqr" | "del-wpqr" | "edit-wps" | "del-wps", id: string, label: string) {
  const danger = kind.includes("del");
  const svg = kind.includes("del") ? icon("trash") : icon("pencil");
  const title = danger ? "Slett" : "Endre";
  return renderIconButton({ dataKey: kind, id, title, icon: svg, danger, label });
}

export function formatMaterialLabel(material?: { name: string; material_code: string; material_group: string } | null, fallback?: string | null) {
  if (material) return `${material.name} (${material.material_code}) - ${material.material_group}`;
  return fallback ?? "";
}

function formatStandardLabel(standard?: { label: string; revision: number | null } | null) {
  if (!standard) return "";
  return standard.revision ? `${standard.label}:${standard.revision}` : standard.label;
}

type ProcessOption = {
  value: string;
  code: string;
  label: string;
};

export function processCode(raw: string | null | undefined) {
  const value = (raw || "").trim();
  if (!value) return "";
  const direct = value.match(/^([0-9]{2,4})(?:\s*-\s*.*)?$/);
  if (direct) return direct[1];
  const embedded = value.match(/\b([0-9]{2,4})\b/);
  if (embedded) return embedded[1];
  return value.toUpperCase();
}

function methodFromDocNo(docNo: string) {
  const raw = (docNo || "").toUpperCase();
  const digits = raw.match(/\d+/g)?.join("") ?? "";
  return digits || "";
}

function normalizeProcessLabel(code: string, label: string) {
  const cleanCode = code.trim();
  let cleanLabel = label.trim();
  if (!cleanCode) return cleanLabel;
  cleanLabel = cleanLabel.replace(new RegExp(`^${cleanCode}\\s*-\\s*`, "i"), "").trim();
  return cleanLabel;
}

export function buildProcessOptions(processes: WeldingProcessRow[]): ProcessOption[] {
  const map = new Map<string, ProcessOption>();

  for (const process of processes) {
    let code = (process.code || "").trim();
    let label = (process.label || "").trim();

    if (!code) {
      const withCode = label.match(/^([0-9]{2,4})\s*-\s*(.+)$/);
      if (withCode) {
        code = withCode[1].trim();
        label = withCode[2].trim();
      } else if (/^[0-9]{2,4}$/.test(label)) {
        code = label;
        label = "";
      }
    }

    if (!code) continue;

    const cleanLabel = normalizeProcessLabel(code, label);
    const display = cleanLabel ? `${code} - ${cleanLabel}` : code;
    if (!map.has(code)) {
      map.set(code, { value: code, code, label: display });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.value.localeCompare(b.value, "nb", { numeric: true, sensitivity: "base" })
  );
}

export function resolveProcessValue(raw: string | null | undefined, processes: WeldingProcessRow[]) {
  const value = (raw || "").trim();
  if (!value) return "";

  const options = buildProcessOptions(processes);
  if (options.some((opt) => opt.value === value)) return value;

  const key = processCode(value);
  const byCode = options.find((opt) => opt.code === key);
  if (byCode) return byCode.value;

  const valueLower = value.toLowerCase();
  const byLabel = options.find((opt) => opt.label.toLowerCase() === valueLower || opt.label.toLowerCase().endsWith(`- ${valueLower}`));
  if (byLabel) return byLabel.value;

  return key || value;
}

export function processDisplay(raw: string | null | undefined, processes: WeldingProcessRow[]) {
  const value = (raw || "").trim();
  if (!value) return "Ukjent";

  const options = buildProcessOptions(processes);
  const resolved = resolveProcessValue(value, processes);
  const match = options.find((opt) => opt.value === resolved);
  if (match) return match.label;

  if (/^[0-9]{2,4}$/.test(resolved)) return resolved;
  return value;
}

function renderDocNoWithPill(
  docNo: string,
  fileId: string | null | undefined,
  process: string | null | undefined,
  getPillClass: (method: string) => string
) {
  const method = processCode(process) || methodFromDocNo(docNo) || (process || "").trim();
  const cls = ["type-pill", getPillClass(method)].filter(Boolean).join(" ");
  if (fileId) {
    return `<button class="${cls}" data-openpdf="${esc(fileId)}">${esc(docNo)}</button>`;
  }
  return `<span class="${cls}">${esc(docNo)}</span>`;
}

export function renderWpqrTable(
  rows: WPQRRow[],
  getPillClass: (method: string) => string,
  showActions = true
) {
  return `
    <div class="table-scroll">
      <table class="data-table wpqr-table">
        <thead>
          <tr>
            <th>WPQR nr.</th>
            <th>Standard</th>
            <th>Materiale</th>
            <th>Fuge</th>
            <th>Tykkelse</th>
            <th>Dato lagt opp</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => `
              <tr>
                <td data-label="WPQR nr.">${renderDocNoWithPill(r.doc_no, r.file_id, r.process, getPillClass)}</td>
                <td data-label="Standard">${esc(formatStandardLabel(r.standard ?? null))}</td>
                <td data-label="Materiale">${esc(formatMaterialLabel(r.material, r.materiale))}</td>
                <td data-label="Fuge">${esc(r.fuge)}</td>
                <td data-label="Tykkelse">${esc(r.tykkelse ?? "")}</td>
                <td data-label="Dato lagt opp" class="mutedcell">${esc(fmtDate(r.doc_date || r.created_at))}</td>
                <td class="actcell">
                  ${showActions ? actionBtn("edit-wpqr", r.id, r.doc_no) : ""}
                  ${showActions ? actionBtn("del-wpqr", r.id, r.doc_no) : ""}
                </td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderWpsTable(
  rows: WPSRow[],
  getPillClass: (method: string) => string,
  showActions = true
) {
  return `
    <div class="table-scroll">
      <table class="data-table wps-table">
        <thead>
          <tr>
            <th>WPS nr.</th>
            <th>Standard</th>
            <th>Materiale</th>
            <th>Fuge</th>
            <th>Tykkelse</th>
            <th>Knyttet WPQR</th>
            <th>Dato lagt opp</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => `
              <tr>
                <td data-label="WPS nr.">${renderDocNoWithPill(r.doc_no, r.file_id, r.process, getPillClass)}</td>
                <td data-label="Standard">${esc(formatStandardLabel(r.standard ?? null))}</td>
                <td data-label="Materiale">${esc(formatMaterialLabel(r.material, r.materiale))}</td>
                <td data-label="Fuge">${esc(r.fuge)}</td>
                <td data-label="Tykkelse">${esc(r.tykkelse ?? "")}</td>
                <td data-label="WPQR">
                  ${r.wpqr?.doc_no
                    ? r.wpqr.file_id
                      ? `<button class="type-pill ${getPillClass(r.process)}" data-openpdf="${esc(r.wpqr.file_id)}" title="Koblet WPQR">${esc(r.wpqr.doc_no)}</button>`
                      : `<span class="type-pill ${getPillClass(r.process)}" title="Koblet WPQR">${esc(r.wpqr.doc_no)}</span>`
                    : `<span class="mutedcell">Ikke koblet</span>`}
                </td>
                <td data-label="Dato lagt opp" class="mutedcell">${esc(fmtDate(r.doc_date || r.created_at))}</td>
                <td class="actcell">
                  ${showActions ? actionBtn("edit-wps", r.id, r.doc_no) : ""}
                  ${showActions ? actionBtn("del-wps", r.id, r.doc_no) : ""}
                </td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

/** Samme form brukes til new+edit - du fyller verdier via JS */
export function wpqrFormBody(
  standards: StandardRow[],
  processes: WeldingProcessRow[],
  materials: MaterialRow[],
  jointTypes: string[]
) {
  const materialOptions = materials
    .map((m) => `<option value="${esc(m.id)}">${esc(formatMaterialLabel(m))}</option>`)
    .join("");
  const processOptions = buildProcessOptions(processes)
    .map((process) => `<option value="${esc(process.value)}">${esc(process.label)}</option>`)
    .join("");
  return `
    <div class="modalgrid">
      <div class="field">
        <label>WPQR nr.</label>
        <input data-f="doc_no" class="input" placeholder="WPQR-001" />
      </div>
      <div class="field">
        <label>Dato lagt opp</label>
        ${renderDatePickerInput({
          inputAttrs: `data-f="doc_date" class="input" min="2000-01-01" max="2099-12-31"`,
          openLabel: "Velg dato lagt opp",
        })}
      </div>
      <div class="field">
        <label>Standard</label>
        <select data-f="standard_id" class="select">
          <option value="">Velg standard...</option>
          ${standards
            .map((s) => `<option value="${esc(s.id)}">${esc(formatStandardLabel(s))}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label>Sveisemetode</label>
        <select data-f="process" class="select">
          <option value="">Velg metode...</option>
          ${processOptions}
        </select>
      </div>
      <div class="field">
        <label>Materiale</label>
        <select data-f="material_id" class="select">
          <option value="">Velg materiale...</option>
          ${materialOptions}
        </select>
      </div>
      <div class="field">
        <label>Fuge</label>
        <select data-f="fuge" class="select">${renderOptions(jointTypes, "Velg sammenføyning...")}</select>
      </div>
      <div class="field">
        <label>Tykkelseområde</label>
        <input data-f="tykkelse" class="input" placeholder="f.eks. 3,91 - 6,55" />
        <div class="muted" style="font-size:12px;">Fritekst (eksempel: 2,8-6,8mm (FW: 3-∞))</div>
      </div>

      ${renderModalPdfUploadField("PDF (valgfritt)")}
    </div>
  `;
}

export function wpsFormBody(
  standards: StandardRow[],
  processes: WeldingProcessRow[],
  materials: MaterialRow[],
  jointTypes: string[]
) {
  const materialOptions = materials
    .map((m) => `<option value="${esc(m.id)}">${esc(formatMaterialLabel(m))}</option>`)
    .join("");
  const processOptions = buildProcessOptions(processes)
    .map((process) => `<option value="${esc(process.value)}">${esc(process.label)}</option>`)
    .join("");
  return `
    <div class="modalgrid">
      <div class="field">
        <label>WPS nr.</label>
        <input data-f="doc_no" class="input" placeholder="WPS-141-001" />
      </div>
      <div class="field">
        <label>Dato lagt opp</label>
        ${renderDatePickerInput({
          inputAttrs: `data-f="doc_date" class="input" min="2000-01-01" max="2099-12-31"`,
          openLabel: "Velg dato lagt opp",
        })}
      </div>
      <div class="field">
        <label>Standard</label>
        <select data-f="standard_id" class="select">
          <option value="">Velg standard...</option>
          ${standards
            .map((s) => `<option value="${esc(s.id)}">${esc(formatStandardLabel(s))}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label>Sveisemetode</label>
        <select data-f="process" class="select">
          <option value="">Velg metode...</option>
          ${processOptions}
        </select>
      </div>
      <div class="field">
        <label>Materiale</label>
        <select data-f="material_id" class="select">
          <option value="">Velg materiale...</option>
          ${materialOptions}
        </select>
      </div>
      <div class="field">
        <label>Fuge</label>
        <select data-f="fuge" class="select">${renderOptions(jointTypes, "Velg sammenføyning...")}</select>
      </div>
      <div class="field">
        <label>Koble til WPQR (valgfritt)</label>
        <select data-f="wpqr_id" class="select">
          <option value="">Ikke koblet</option>
        </select>
      </div>

      <div class="field wps-thickness">
        <label>Tykkelseområde</label>
        <input data-f="tykkelse" class="input" placeholder="f.eks. 3,91 - 6,55" />
        <div class="muted" style="font-size:12px;">Fritekst (eksempel: 2,8-6,8mm (FW: 3-∞))</div>
      </div>

      ${renderModalPdfUploadField("PDF (valgfritt)")}
    </div>
  `;
}

export function currentPdfMeta(fileRef: string | null) {
  if (!fileRef) {
    return `<div class="pdfmeta muted" style="font-size:12px;">Ingen eksisterende PDF</div>`;
  }

  return `
    <div class="pdfmeta wps-pdf-meta">
      <div class="wps-pdf-existing">
        <span class="muted" style="font-size:12px;">Eksisterende PDF</span>
        <button class="linkbtn" type="button" data-open-existing-pdf="${esc(fileRef)}">Forhåndsvis</button>
      </div>
      <label class="checkrow">
        <input data-f="remove_pdf" type="checkbox" />
        <span>Fjern eksisterende PDF</span>
      </label>
      <div class="muted" style="font-size:12px;">Velger du ny fil, brukes den i stedet.</div>
    </div>
  `;
}

export function toThicknessInput(rowThickness: string) {
  return String(rowThickness ?? "").trim();
}

function renderModalPdfUploadField(label: string) {
  return `
    <div class="field wps-upload-field" style="grid-column:1 / -1;">
      <label>${esc(label)}</label>
      <div class="dropzone wps-dropzone" data-f="pdf_dropzone">
        <div class="dropzone-title">Dra og slipp PDF her</div>
        <div class="dropzone-sub">Støtter PDF-format</div>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
      </div>
      <div class="filelist wps-filelist" data-f="pdf_preview"></div>
      <div data-f="pdfMeta"></div>
    </div>
  `;
}

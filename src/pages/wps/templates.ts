import type { WPQRRow, WPSRow } from "../../repo/wpsRepo";
import type { StandardRow } from "../../repo/standardRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import { esc, renderOptions } from "../../utils/dom";
import { fmtDate } from "../../utils/format";
import type { WeldingProcessRow } from "../../repo/weldingProcessRepo";
import { renderIconButton } from "../../ui/iconButton";

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

function methodCode(method: string) {
  const digits = (method || "").match(/\d+/g)?.join("") ?? "";
  return digits || "";
}

function methodFromDocNo(docNo: string) {
  const raw = (docNo || "").toUpperCase();
  const digits = raw.match(/\d+/g)?.join("") ?? "";
  return digits || "";
}

export function renderMethodPill(method: string, pillClass: string, extraClass = "") {
  const code = methodCode(method) || method || "Ukjent";
  const cls = [pillClass, extraClass].filter(Boolean).join(" ");
  return `<span class="${cls}">${esc(code)}</span>`;
}

function renderDocNoWithPill(
  docNo: string,
  fileId: string | null | undefined,
  process: string | null | undefined,
  getPillClass: (method: string) => string
) {
  const method = (process || "") || methodFromDocNo(docNo);
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
                <td data-label="Tykkelse">${r.tykkelse ? `${esc(r.tykkelse)} mm` : ""}</td>
                <td data-label="Dato" class="mutedcell">${esc(fmtDate(r.created_at))}</td>
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
            <th>Dato opprettet</th>
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
                <td data-label="Tykkelse">${r.tykkelse ? `${esc(r.tykkelse)} mm` : ""}</td>
                <td data-label="WPQR">
                  ${r.wpqr?.doc_no
                    ? r.wpqr.file_id
                      ? `<button class="type-pill ${getPillClass(r.process)}" data-openpdf="${esc(r.wpqr.file_id)}" title="Koblet WPQR">${esc(r.wpqr.doc_no)}</button>`
                      : `<span class="type-pill ${getPillClass(r.process)}" title="Koblet WPQR">${esc(r.wpqr.doc_no)}</span>`
                    : `<span class="mutedcell">Ikke koblet</span>`}
                </td>
                <td data-label="Dato" class="mutedcell">${esc(fmtDate(r.created_at))}</td>
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

/** Samme form brukes til new+edit – du fyller verdier via JS */
export function wpqrFormBody(
  standards: StandardRow[],
  processes: WeldingProcessRow[],
  materials: MaterialRow[],
  jointTypes: string[]
) {
  const thicknessOptions = [`<option value="">Velg…</option>`]
    .concat(Array.from({ length: 50 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`))
    .join("");
  const thicknessToOptions = [`<option value="">Velg…</option>`]
    .concat(Array.from({ length: 50 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`))
    .join("");
  const materialOptions = materials
    .map((m) => `<option value="${esc(m.id)}">${esc(formatMaterialLabel(m))}</option>`)
    .join("");
  return `
    <div class="modalgrid">
      <div class="field">
        <label>WPQR nr.</label>
        <input data-f="doc_no" class="input" placeholder="WPQR-001" />
      </div>
      <div class="field">
        <label>Standard</label>
        <select data-f="standard_id" class="select">
          <option value="">Velg standard…</option>
          ${standards
            .map((s) => `<option value="${esc(s.id)}">${esc(formatStandardLabel(s))}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label>Sveisemetode (process)</label>
        <select data-f="process" class="select">${renderOptions(processes.map((p) => p.label), "Velg metode…")}</select>
      </div>
      <div class="field">
        <label>Materiale</label>
        <select data-f="material_id" class="select">
          <option value="">Velg materiale…</option>
          ${materialOptions}
        </select>
      </div>
      <div class="field">
        <label>Fuge</label>
        <select data-f="fuge" class="select">${renderOptions(jointTypes, "Velg sammenføyning…")}</select>
      </div>
      <div class="field">
        <label>Tykkelse (mm)</label>
        <div class="inputgroup join">
          <select data-f="tykkelse_from" class="select">
            ${thicknessOptions}
          </select>&nbsp;&nbsp;
          <select data-f="tykkelse_to" class="select">
            ${thicknessToOptions}
          </select>
        </div>
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>PDF (valgfritt)</label>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
        <div data-f="pdfMeta"></div>
      </div>
    </div>
  `;
}

export function wpsFormBody(
  standards: StandardRow[],
  processes: WeldingProcessRow[],
  materials: MaterialRow[],
  jointTypes: string[]
) {
  const thicknessOptions = [`<option value="">Velg…</option>`]
    .concat(Array.from({ length: 50 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`))
    .join("");
  const thicknessToOptions = [`<option value="">Velg…</option>`, `<option value="∞">∞</option>`]
    .concat(Array.from({ length: 50 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`))
    .join("");
  const materialOptions = materials
    .map((m) => `<option value="${esc(m.id)}">${esc(formatMaterialLabel(m))}</option>`)
    .join("");
  return `
    <div class="modalgrid">
      <div class="field">
        <label>WPS nr.</label>
        <input data-f="doc_no" class="input" placeholder="WPS-141-001" />
      </div>
      <div class="field">
        <label>Standard</label>
        <select data-f="standard_id" class="select">
          <option value="">Velg standard…</option>
          ${standards
            .map((s) => `<option value="${esc(s.id)}">${esc(formatStandardLabel(s))}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label>Sveisemetode (process)</label>
        <select data-f="process" class="select">${renderOptions(processes.map((p) => p.label), "Velg metode…")}</select>
      </div>
      <div class="field">
        <label>Materiale</label>
        <select data-f="material_id" class="select">
          <option value="">Velg materiale…</option>
          ${materialOptions}
        </select>
      </div>
      <div class="field">
        <label>Fuge</label>
        <select data-f="fuge" class="select">${renderOptions(jointTypes, "Velg sammenføyning…")}</select>
      </div>
      <div class="field">
        <label>Koble til WPQR (valgfritt)</label>
        <select data-f="wpqr_id" class="select">
          <option value="">Ikke koblet</option>
        </select>
      </div>

      <div class="field wps-thickness">
        <label>Tykkelse (mm)</label>
        <div class="inputgroup join">
          <select data-f="tykkelse_from" class="select">
            ${thicknessOptions}
          </select>
          <select data-f="tykkelse_to" class="select">
            ${thicknessToOptions}
          </select>
        </div>
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>PDF (valgfritt)</label>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
        <div data-f="pdfMeta"></div>
      </div>
    </div>
  `;
}

export function currentPdfMeta(fileRef: string | null) {
  if (!fileRef) {
    return `<div class="pdfmeta muted" style="font-size:12px;">Ingen eksisterende PDF</div>`;
  }

  return `
    <div class="pdfmeta">
      <div class="muted" style="font-size:12px;">Eksisterende PDF:
      <button class="linkbtn" type="button" data-openpdf="${esc(fileRef)}">Åpne PDF</button></div>
      <label class="checkrow">
        <input data-f="remove_pdf" type="checkbox" />
        <span>Fjern eksisterende PDF</span>
      </label>
    </div>
  `;
}

export function toThicknessInput(rowThickness: string) {
  return String(rowThickness ?? "").trim();
}

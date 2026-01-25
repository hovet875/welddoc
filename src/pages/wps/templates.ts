import type { WPQRRow, WPSRow } from "../../repo/wpsRepo";
import { esc, renderOptions } from "../../utils/dom";
import { displayThickness, fmtDate, stripMm } from "../../utils/format";
import { PROSESSER, MATERIALER, SAMMENFOYNINGER } from "../../data/wpsOptions";

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
  const cls = `iconbtn${danger ? " danger" : ""}`;
  const dataAttr = `data-${kind}="${esc(id)}"`;
  const title = danger ? "Slett" : "Endre";
  const aria = `${title} ${esc(label)}`;
  return `
    <button class="${cls}" type="button" ${dataAttr} data-label="${esc(label)}" aria-label="${aria}" title="${title}">
      ${svg}
    </button>
  `;
}

export function renderProcessTableWPQR(process: string, rows: WPQRRow[]) {
  return `
    <div class="wpsgroup">
      <div class="wpsgrouphead">
        <div class="wpsgrouptitle">Metode: ${esc(process)}</div>
        <div class="wpsgroupmeta">${rows.length} stk</div>
      </div>

      <div class="wpsscroll">
        <table class="wpstable">
          <thead>
            <tr>
              <th>WPQR nr.</th>
              <th>Materiale</th>
              <th>Sammenføyning</th>
              <th>Tykkelse</th>
              <th>Dato lagt opp</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td data-label="WPQR nr.">
                  ${r.pdf_path
                    ? `<button class="linkbtn" data-openpdf="${esc(r.pdf_path)}">${esc(r.doc_no)}</button>`
                    : `<span>${esc(r.doc_no)}</span>`}
                </td>
                <td data-label="Materiale">${esc(r.materiale)}</td>
                <td data-label="Fugetype">${esc(r.sammenfoyning)}</td>
                <td data-label="Tykkelse">${esc(displayThickness(r.tykkelse))}</td>
                <td data-label="Dato" class="mutedcell">${esc(fmtDate(r.created_at))}</td>
                <td class="actcell">
                  ${actionBtn("edit-wpqr", r.id, r.doc_no)}
                  ${actionBtn("del-wpqr", r.id, r.doc_no)}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderProcessTableWPS(process: string, rows: WPSRow[]) {
  return `
    <div class="wpsgroup">
      <div class="wpsgrouphead">
        <div class="wpsgrouptitle">Metode: ${esc(process)}</div>
        <div class="wpsgroupmeta">${rows.length} stk</div>
      </div>

      <div class="wpsscroll">
        <table class="wpstable">
          <thead>
            <tr>
              <th>WPS nr.</th>
              <th>Materiale</th>
              <th>Sammenføyning</th>
              <th>Tykkelse</th>
              <th>Knyttet WPQR</th>
              <th>Dato opprettet</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td data-label="WPS nr.">
                  ${r.pdf_path
                    ? `<button class="linkbtn" data-openpdf="${esc(r.pdf_path)}">${esc(r.doc_no)}</button>`
                    : `<span>${esc(r.doc_no)}</span>`}
                </td>

                <td data-label="Materiale">${esc(r.materiale)}</td>
                <td data-label="Fugetype">${esc(r.sammenfoyning)}</td>
                <td data-label="Tykkelse">${esc(displayThickness(r.tykkelse))}</td>

                <td data-label="WPQR">
                  ${r.wpqr?.doc_no
                    ? `<span class="wpqrpill" title="Koblet WPQR">${esc(r.wpqr.doc_no)}</span>`
                    : `<span class="mutedcell">Ikke koblet</span>`}
                </td>

                <td data-label="Dato" class="mutedcell">${esc(fmtDate(r.created_at))}</td>

                <td class="actcell">
                  ${actionBtn("edit-wps", r.id, r.doc_no)}
                  ${actionBtn("del-wps", r.id, r.doc_no)}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/** Samme form brukes til new+edit – du fyller verdier via JS */
export function wpqrFormBody() {
  return `
    <div class="modalgrid">
      <div class="field">
        <label>WPQR nr.</label>
        <input data-f="doc_no" class="input" placeholder="WPQR-001" />
      </div>
      <div class="field">
        <label>Sveisemetode (process)</label>
        <select data-f="process" class="select">${renderOptions(PROSESSER, "Velg metode…")}</select>
      </div>
      <div class="field">
        <label>Materiale</label>
        <select data-f="materiale" class="select">${renderOptions(MATERIALER, "Velg materiale…")}</select>
      </div>
      <div class="field">
        <label>Sammenføyning</label>
        <select data-f="sammenfoyning" class="select">${renderOptions(SAMMENFOYNINGER, "Velg sammenføyning…")}</select>
      </div>
      <div class="field">
        <label>Tykkelse</label>
        <div class="inputgroup join">
          <input data-f="tykkelse" class="input" placeholder="6" />
          <span class="suffix">mm</span>
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

export function wpsFormBody() {
  return `
    <div class="modalgrid">
      <div class="field">
        <label>WPS nr.</label>
        <input data-f="doc_no" class="input" placeholder="WPS-141-001" />
      </div>
      <div class="field">
        <label>Sveisemetode (process)</label>
        <select data-f="process" class="select">${renderOptions(PROSESSER, "Velg metode…")}</select>
      </div>
      <div class="field">
        <label>Materiale</label>
        <select data-f="materiale" class="select">${renderOptions(MATERIALER, "Velg materiale…")}</select>
      </div>
      <div class="field">
        <label>Sammenføyning</label>
        <select data-f="sammenfoyning" class="select">${renderOptions(SAMMENFOYNINGER, "Velg sammenføyning…")}</select>
      </div>
      <div class="field">
        <label>Tykkelse</label>
        <div class="inputgroup join">
          <input data-f="tykkelse" class="input" placeholder="3-6" />
          <span class="suffix">mm</span>
        </div>
      </div>

      <div class="field">
        <label>Koble til WPQR (valgfritt)</label>
        <select data-f="wpqr_id" class="select">
          <option value="">Ikke koblet</option>
        </select>
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>PDF (valgfritt)</label>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
        <div data-f="pdfMeta"></div>
      </div>
    </div>
  `;
}

export function currentPdfMeta(hasPdf: boolean) {
  if (!hasPdf) return ""; // 👈 INGENTING

  return `
    <div class="pdfmeta">
      <label class="checkrow">
        <input data-f="remove_pdf" type="checkbox" />
        <span>Fjern eksisterende PDF</span>
      </label>
    </div>
  `;
}

export function toThicknessInput(rowThickness: string) {
  return stripMm(rowThickness);
}

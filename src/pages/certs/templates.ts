import type { WelderCertRow, NdtCertRow, ProfileWelderRow } from "../../repo/certRepo";
import type { StandardRow } from "../../repo/standardRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import type { NdtMethodRow } from "../../repo/ndtReportRepo";
import type { NdtSupplierRow, NdtInspectorRow } from "../../repo/ndtSupplierRepo";
import type { WeldingProcessRow } from "../../repo/weldingProcessRepo";
import { esc, renderOptions } from "../../utils/dom";
import { fmtDate } from "../../utils/format";
import { renderDatePickerInput } from "../../ui/datePicker";

/** ---- Status chip helpers ----
 * soonDays: hvor tidlig du vil flagge "utløper snart".
 * 30 er et bra standardvalg, men kan endres til f.eks 60/90.
 */
const SOON_DAYS = 30;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function statusFromExpires(expires_at: string | null) {
  if (!expires_at) {
    return { cls: "ok", label: "Gyldig", dateLabel: "" };
  }

  // ISO date ("YYYY-MM-DD") -> lokal midnatt
  const exp = new Date(`${expires_at}T00:00:00`);
  const today = startOfToday();

  const diffMs = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { cls: "fault", label: "Utløpt", dateLabel: fmtDate(expires_at) };
  if (diffDays <= SOON_DAYS) return { cls: "warn", label: "Utløper snart", dateLabel: fmtDate(expires_at) };
  return { cls: "ok", label: "Gyldig", dateLabel: fmtDate(expires_at) };
}



function renderExpiryCell(expires_at: string | null) {
  if (!expires_at) return "";
  const s = statusFromExpires(expires_at);
  return `<span class="status-pill ${esc(s.cls)}" title="${esc(s.label)}" aria-label="${esc(s.label)}">${esc(s.dateLabel)}</span>`;
}

export function materialLabel(m: Pick<MaterialRow, "name" | "material_code" | "material_group">) {
  return `${m.name} (${m.material_code}) - ${m.material_group}`;
}

/** ---- Groups: Welder ---- */
function formatStandardLabel(s: StandardRow) {
  return s.revision ? `${s.label}:${s.revision}` : s.label;
}

type WeldingProcessOption = {
  code: string;
  display: string;
};

function buildWeldingProcessOptions(rows: WeldingProcessRow[]): WeldingProcessOption[] {
  const map = new Map<string, WeldingProcessOption>();
  for (const row of rows) {
    let code = (row.code || "").trim();
    let label = (row.label || "").trim();
    if (!code) {
      const match = label.match(/^(\d{2,4})\s*-\s*(.+)$/);
      if (match) {
        code = match[1].trim();
        label = match[2].trim();
      } else if (/^\d{2,4}$/.test(label)) {
        code = label;
        label = "";
      }
    } else {
      label = label.replace(new RegExp(`^${code}\\s*-\\s*`, "i"), "").trim();
    }
    if (!code) continue;
    const display = label ? `${code} - ${label}` : code;
    if (!map.has(code)) map.set(code, { code, display });
  }
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code, "nb-NO", { numeric: true }));
}

function renderCertPdfUploadField() {
  return `
    <div class="field cert-upload-field" style="grid-column:1 / -1;">
      <label>PDF</label>
      <div class="dropzone cert-dropzone" data-f="pdf_dropzone">
        <div class="dropzone-title">Dra og slipp PDF her</div>
        <div class="dropzone-sub">Støtter PDF-format</div>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
      </div>
      <div class="filelist cert-filelist" data-f="pdf_preview"></div>
      <div data-f="pdfMeta"></div>
    </div>
  `;
}

export function renderWelderGroup(
  keyTitle: string,
  rows: WelderCertRow[],
  showActions: boolean,
  standards: StandardRow[]
) {
  const standardMap = new Map(standards.map((s) => [s.label, formatStandardLabel(s)]));

  return `
    <div class="group">
      <div class="group-head">
        <div class="group-title">${esc(keyTitle)}</div>
        <div class="group-meta">${rows.length} stk</div>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Sertifikatnummer</th>
              <th>Sveisemetode</th>
              <th>Standard</th>
              <th>Grunnmaterial</th>
              <th>FM-gruppe</th>
              <th>Fugetype</th>
              <th>Tykkelsesområde</th>
              <th>Utløpsdato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((r) => {
                const fileRef = r.file_id || r.pdf_path;
                const linkCell = fileRef
                  ? `<button class="file-pill" data-openpdf-welder="${esc(fileRef)}">${esc(r.certificate_no)}</button>`
                  : `<span class="file-pill">${esc(r.certificate_no)}</span>`;

                return `
                  <tr data-welder-row-id="${esc(r.id)}">
                    <td data-label="Sertifikatnummer">${linkCell}</td>
                    <td data-label="Sveisemetode">${esc(r.welding_process_code || "")}</td>
                    <td data-label="Standard">${esc(standardMap.get(r.standard) ?? r.standard)}</td>
                    <td data-label="Grunnmaterial">${esc(
                      r.base_material
                        ? materialLabel(r.base_material)
                        : r.base_material_id
                        ? ""
                        : ""
                    )}</td>
                    <td data-label="FM-gruppe">${esc(r.fm_group ?? "")}</td>
                    <td data-label="Fugetype">${esc(r.coverage_joint_type ?? "")}</td>
                    <td data-label="Tykkelsesområde">${esc(r.coverage_thickness ?? "")}</td>
                    <td data-label="Utløpsdato" class="mutedcell">${renderExpiryCell(r.expires_at ?? null)}</td>
                    <td class="row-menu-cell">
                      ${showActions
                        ? `
                          <button class="btn ghost small" type="button" data-welder-row-menu>...</button>
                          <div class="row-menu" data-welder-row-menu-panel>
                            <button type="button" data-welder-row-action="renew">Oppdater sertifikat</button>
                            <button type="button" data-welder-row-action="edit">Endre sertifikat</button>
                            <button type="button" data-welder-row-action="delete" class="danger">Slett</button>
                          </div>
                        `
                        : ``}
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/** ---- Groups: NDT company ---- */
export function renderNdtGroup(company: string, rows: NdtCertRow[], showActions: boolean) {
  return `
    <div class="group">
      <div class="group-head">
        <div class="group-title">Firma: ${esc(company)}</div>
        <div class="group-meta">${rows.length} stk</div>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Sertifikatnummer</th> 
              <th>NDT-metode</th>
              <th>NDT-kontrollør</th>
              <th>Utløpsdato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((r) => {
                const fileRef = r.file_id || r.pdf_path;
                const linkCell = fileRef
                  ? `&nbsp;<button class="file-pill" data-openpdf-ndt="${esc(fileRef)}">${esc(r.certificate_no)}</button>`
                  : `<span class="file-pill">${esc(r.certificate_no)}</span>`;

                return `
                  <tr data-ndt-row-id="${esc(r.id)}">
                    <td data-label="Sertifikatnummer">${linkCell}</td>    
                    <td data-label="NDT-metode">${esc(r.ndt_method ?? "")}</td>
                    <td data-label="NDT-kontrollør">${esc(r.personnel_name)}</td>
                    <td data-label="Utløpsdato" class="mutedcell">${renderExpiryCell(r.expires_at ?? null)}</td>
                    <td class="row-menu-cell">
                      ${showActions
                        ? `
                          <button class="btn ghost small" type="button" data-ndt-row-menu>...</button>
                          <div class="row-menu" data-ndt-row-menu-panel>
                            <button type="button" data-ndt-row-action="renew">Oppdater sertifikat</button>
                            <button type="button" data-ndt-row-action="edit">Endre sertifikat</button>
                            <button type="button" data-ndt-row-action="delete" class="danger">Slett</button>
                          </div>
                        `
                        : ``}
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/** ---- Forms (admin) ---- */
export function welderCertFormBody(
  welders: ProfileWelderRow[],
  standards: StandardRow[],
  materials: MaterialRow[],
  weldingProcesses: WeldingProcessRow[],
  jointTypes: string[]
) {
  const optionsHtml =
    `<option value="">Velg sveiser...</option>` +
    welders
      .map((w) => {
        const no = w.welder_no == null ? "-" : String(w.welder_no).padStart(3, "0");
        const name = (w.display_name ?? "(uten navn)").trim();
        const label = `${no} - ${name}`;
        return `<option value="${esc(w.id)}">${esc(label)}</option>`;
      })
      .join("");

  const materialOptions = materials
    .map((m) => `<option value="${esc(m.id)}">${esc(materialLabel(m))}</option>`)
    .join("");
  const weldingProcessOptions = buildWeldingProcessOptions(weldingProcesses)
    .map((item) => `<option value="${esc(item.code)}">${esc(item.display)}</option>`)
    .join("");

  return `
    <div class="modalgrid">
      <div class="field">
        <label>Sveiser</label>
        <select data-f="profile_id" class="select">
          ${optionsHtml}
        </select>
      </div>

      <div class="field">
        <label>Sertifikatnummer</label>
        <input data-f="certificate_no" class="input" placeholder="ISO9606-..." />
      </div>

      <div class="field">
        <label>Standard</label>
        <select data-f="standard" class="select">
          <option value="">Velg standard...</option>
          ${standards
            .map((s) => `<option value="${esc(s.label)}">${esc(formatStandardLabel(s))}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label>Sveisemetode</label>
        <select data-f="welding_process_code" class="select">
          <option value="">Velg metode...</option>
          ${weldingProcessOptions}
        </select>
      </div>
      <div class="field">
        <label>Grunnmaterial</label>
        <select data-f="base_material_id" class="select">
          <option value="">Velg material...</option>
          ${materialOptions}
        </select>
      </div>
      <div class="field">
        <label>FM-gruppe</label>
        <select data-f="fm_group" class="select" disabled>
          <option value="">Velg standard først...</option>
        </select>
      </div>
      <div class="field">
        <label>Utløpsdato</label>
        ${renderDatePickerInput({
          inputAttrs: `data-f="expires_at" class="input" min="2000-01-01" max="2099-12-31"`,
          openLabel: "Velg utløpsdato",
        })}
      </div>

      <div class="field cert-thickness">
        <label>Tykkelsesområde (mm)</label>
        <div class="inputgroup join">
          <input
            data-f="coverage_thickness_from"
            class="input"
            inputmode="decimal"
            placeholder="Fra, f.eks. 2,8"
          />
          <input
            data-f="coverage_thickness_to"
            class="input"
            inputmode="decimal"
            placeholder="Til, f.eks. 5,6"
          />
        </div>
        <label class="checkrow" style="margin-top:8px;">
          <input data-f="coverage_thickness_to_infinite" type="checkbox" />
          <span>Ubegrenset øvre grense (&#8734;)</span>
        </label>
        <div class="muted" style="font-size:12px;">Bruk komma eller punktum. Maks 1 desimal.</div>
      </div>

      <div class="field">
        <label>Tilleggsnotat for tykkelse (valgfritt)</label>
        <input data-f="coverage_thickness_note" class="input" placeholder="f.eks. FW: 3-&#8734;" />
        <div class="muted" style="font-size:12px;">Vises som: 2,8-6,8 (FW: 3-&#8734;).</div>
      </div>

      <div class="field">
        <label>Fugetype</label>
        <div class="checkboxgroup cert-fugegroup">
          ${jointTypes
            .map(
              (jointType) => `
                <label class="checkboxpill">
                  <input data-f="coverage_joint_type" type="checkbox" value="${esc(jointType)}" />
                  <span>${esc(jointType)}</span>
                </label>
              `
            )
            .join("")}
        </div>
      </div>

      ${renderCertPdfUploadField()}
    </div>
  `;
}
export function ndtCertFormBody(
  methods: NdtMethodRow[],
  suppliers: NdtSupplierRow[],
  inspectors: NdtInspectorRow[]
) {
  const options = methods.map((m) => m.label);
  const supplierOptions = suppliers.map((s) => s.name);
  const inspectorOptions = inspectors.map((i) => i.name);
  return `
    <div class="modalgrid">
      <div class="field">
        <label>Firma</label>
        <select data-f="company" class="select">${renderOptions(supplierOptions, "Velg firma...")}</select>
      </div>

      <div class="field">
        <label>NDT-kontrollør</label>
        <select data-f="personnel_name" class="select">${renderOptions(inspectorOptions, "Velg kontrollør...")}</select>
      </div>

      <div class="field">
        <label>Sertifikatnummer</label>
        <input data-f="certificate_no" class="input" placeholder="12345" />
      </div>

      <div class="field">
        <label>NDT-metode</label>
        <select data-f="ndt_method" class="select">${renderOptions(options, "Velg metode...")}</select>
      </div>

      <div class="field">
        <label>Utløpsdato</label>
        ${renderDatePickerInput({
          inputAttrs: `data-f="expires_at" class="input" min="2000-01-01" max="2099-12-31"`,
          openLabel: "Velg utløpsdato",
        })}
      </div>

      ${renderCertPdfUploadField()}
    </div>
  `;
}

export function currentPdfMeta(existingPdfRef: string | null) {
  if (!existingPdfRef) {
    return `<div class="pdfmeta muted" style="font-size:12px;">Ingen eksisterende PDF.</div>`;
  }

  return `
    <div class="pdfmeta cert-pdf-meta">
      <div class="cert-pdf-existing">
        <span class="muted" style="font-size:12px;">Eksisterende PDF</span>
        <button class="linkbtn" type="button" data-open-existing-pdf="${esc(existingPdfRef)}">Forhåndsvis</button>
      </div>
      <label class="checkrow">
        <input data-f="remove_pdf" type="checkbox" />
        <span>Fjern eksisterende PDF</span>
      </label>
      <div class="muted" style="font-size:12px;">Velger du ny fil, brukes den i stedet.</div>
    </div>
  `;
}

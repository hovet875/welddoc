import type { WelderCertRow, NdtCertRow, ProfileWelderRow } from "../../repo/certRepo";
import type { StandardRow } from "../../repo/standardRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import type { NdtMethodRow } from "../../repo/ndtReportRepo";
import { esc, renderOptions } from "../../utils/dom";
import { fmtDate } from "../../utils/format";
import { renderIconButton, } from "../../ui/iconButton";

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

export function actionBtn(
  kind: "edit-weldercert" | "del-weldercert" | "edit-ndtcert" | "del-ndtcert",
  id: string,
  label: string
) {
  const danger = kind.includes("del");
  const svg = kind.includes("del") ? icon("trash") : icon("pencil");
  const title = danger ? "Slett" : "Endre";
  return renderIconButton({ dataKey: kind, id, title, icon: svg, danger, label });
}

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
                  <tr>
                    <td data-label="Sertifikatnummer">${linkCell}</td>
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
                    <td data-label="Tykkelsesområde">${r.coverage_thickness ? `${esc(r.coverage_thickness)} mm` : ""}</td>
                    <td data-label="Utløpsdato" class="mutedcell">${renderExpiryCell(r.expires_at ?? null)}</td>
                    <td class="actcell">
                      ${
                        showActions
                          ? `${actionBtn("edit-weldercert", r.id, r.certificate_no)}${actionBtn(
                              "del-weldercert",
                              r.id,
                              r.certificate_no
                            )}`
                          : ``
                      }
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
                  <tr>
                    <td data-label="Sertifikatnummer">${linkCell}</td>    
                    <td data-label="NDT-metode">${esc(r.ndt_method ?? "")}</td>
                    <td data-label="NDT-kontrollør">${esc(r.personnel_name)}</td>
                    <td data-label="Utløpsdato" class="mutedcell">${renderExpiryCell(r.expires_at ?? null)}</td>
                    <td class="actcell">
                      ${
                        showActions
                          ? `${actionBtn("edit-ndtcert", r.id, r.certificate_no)}${actionBtn(
                              "del-ndtcert",
                              r.id,
                              r.certificate_no
                            )}`
                          : ``
                      }
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
  materials: MaterialRow[]
) {
  const thicknessOptions = [`<option value="">Velg…</option>`]
    .concat(Array.from({ length: 50 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`))
    .join("");
  const thicknessToOptions = [`<option value="">Velg…</option>`, `<option value="∞">∞</option>`]
    .concat(Array.from({ length: 50 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`))
    .join("");
  const optionsHtml =
    `<option value="">Velg sveiser…</option>` +
    welders
      .map((w) => {
        const no = w.welder_no == null ? "—" : String(w.welder_no).padStart(3, "0");
        const name = (w.display_name ?? "(uten navn)").trim();
        const label = `${no} – ${name}`;
        return `<option value="${esc(w.id)}">${esc(label)}</option>`;
      })
      .join("");

  const materialOptions = materials
    .map((m) => `<option value="${esc(m.id)}">${esc(materialLabel(m))}</option>`)
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
          <option value="">Velg standard…</option>
          ${standards
            .map((s) => `<option value="${esc(s.label)}">${esc(formatStandardLabel(s))}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field">
        <label>Grunnmaterial</label>
        <select data-f="base_material_id" class="select">
          <option value="">Velg material…</option>
          ${materialOptions}
        </select>
      </div>
      <div class="field">
        <label>FM-gruppe</label>
        <select data-f="fm_group" class="select" disabled>
          <option value="">Velg standard først…</option>
        </select>
      </div>
      <div class="field">
        <label>Utløpsdato</label>
        <input data-f="expires_at" class="input" type="date" min="2000-01-01" max="2099-12-31" />
      </div>

      <div class="field cert-thickness">
        <label>Tykkelsesområde (mm)</label>
        <div class="inputgroup join">
          <select data-f="coverage_thickness_from" class="select">
            ${thicknessOptions}
          </select>
          <select data-f="coverage_thickness_to" class="select">
            ${thicknessToOptions}
          </select>
        </div>
      </div>

      <div class="field">
        <label>Fugetype</label>
        <div class="checkboxgroup cert-fugegroup">
          <label class="checkboxpill">
            <input data-f="coverage_joint_type_fw" type="checkbox" />
            <span>FW (Kilsveis)</span>
          </label>
          <label class="checkboxpill">
            <input data-f="coverage_joint_type_bw" type="checkbox" />
            <span>BW (Buttsveis)</span>
          </label>
        </div>
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>PDF</label>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
        <div data-f="pdfMeta"></div>
      </div>
    </div>
  `;
}


export function ndtCertFormBody(methods: NdtMethodRow[]) {
  const options = methods.map((m) => m.label);
  return `
    <div class="modalgrid">
      <div class="field">
        <label>NDT-kontrollør</label>
        <input data-f="personnel_name" class="input" placeholder="Ola Nordmann" />
      </div>

      <div class="field">
        <label>Firma</label>
        <input data-f="company" class="input" placeholder="Firma AS" required />
      </div>

      <div class="field">
        <label>Sertifikatnummer</label>
        <input data-f="certificate_no" class="input" placeholder="12345" />
      </div>

      <div class="field">
        <label>NDT-metode</label>
        <select data-f="ndt_method" class="select">${renderOptions(options, "Velg metode…")}</select>
      </div>

      <div class="field">
        <label>Utløpsdato</label>
        <input data-f="expires_at" class="input" type="date" min="2000-01-01" max="2099-12-31" />
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>PDF</label>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
        <div data-f="pdfMeta"></div>
      </div>
    </div>
  `;
}

export function currentPdfMeta(hasPdf: boolean) {
  if (!hasPdf) return "";
  return `
    <div class="pdfmeta">
      <label class="checkrow">
        <input data-f="remove_pdf" type="checkbox" />
        <span>Fjern eksisterende PDF</span>
      </label>
    </div>
  `;
}

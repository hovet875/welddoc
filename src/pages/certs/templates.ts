import type { WelderCertRow, NdtCertRow, ProfileWelderRow } from "../../repo/certRepo";
import { esc, renderOptions } from "../../utils/dom";
import { fmtDate } from "../../utils/format";

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

export function padWelderNo(n: number | null) {
  if (n == null) return "";
  return String(n).padStart(3, "0");
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

  if (diffDays < 0) return { cls: "expired", label: "Utløpt", dateLabel: fmtDate(expires_at) };
  if (diffDays <= SOON_DAYS) return { cls: "soon", label: "Utløper snart", dateLabel: fmtDate(expires_at) };
  return { cls: "ok", label: "Gyldig", dateLabel: fmtDate(expires_at) };
}

function renderExpiryCell(expires_at: string | null) {
  const s = statusFromExpires(expires_at);

  // Hvis ingen dato: vis bare status
  if (!expires_at) {
    return `
      <span class="certstatus compact ${esc(s.cls)}" title="${esc(s.label)}">
        <span class="dot" aria-hidden="true"></span>
        ${esc(s.label)}
      </span>
    `;
  }

  return `
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <span>${esc(s.dateLabel)}</span>
      <span class="certstatus compact ${esc(s.cls)}" title="${esc(s.label)}">
        <span class="dot" aria-hidden="true"></span>
        ${esc(s.label)}
      </span>
    </div>
  `;
}

/** ---- Groups: Welder ---- */
export function renderWelderGroup(keyTitle: string, rows: WelderCertRow[], showActions: boolean) {
  return `
    <div class="wpsgroup">
      <div class="wpsgrouphead">
        <div class="wpsgrouptitle">${esc(keyTitle)}</div>
        <div class="wpsgroupmeta">${rows.length} stk</div>
      </div>

      <div class="wpsscroll">
        <table class="wpstable">
          <thead>
            <tr>
              <th>Sertifikatnr</th>
              <th>Standard</th>
              <th>Type fuge</th>
              <th>Tykkelse</th>
              <th>Utløpsdato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((r) => {
                const linkCell = r.pdf_path
                  ? `<button class="linkbtn" data-openpdf-welder="${esc(r.pdf_path)}">${esc(r.certificate_no)}</button>`
                  : `<span>${esc(r.certificate_no)}</span>`;

                return `
                  <tr>
                    <td data-label="Sertifikatnr">${linkCell}</td>
                    <td data-label="Standard">${esc(r.standard)}</td>
                    <td data-label="Type fuge">${esc(r.coverage_joint_type ?? "")}</td>
                    <td data-label="Tykkelse">${esc(r.coverage_thickness ?? "")}</td>
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

/** ---- Groups: NDT method ---- */
export function renderNdtGroup(method: string, rows: NdtCertRow[], showActions: boolean) {
  return `
    <div class="wpsgroup">
      <div class="wpsgrouphead">
        <div class="wpsgrouptitle">Metode: ${esc(method)}</div>
        <div class="wpsgroupmeta">${rows.length} stk</div>
      </div>

      <div class="wpsscroll">
        <table class="wpstable">
          <thead>
            <tr>
              <th>Navn</th>
              <th>Sertifikatnr</th>
              <th>Utløpsdato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((r) => {
                const linkCell = r.pdf_path
                  ? `<button class="linkbtn" data-openpdf-ndt="${esc(r.pdf_path)}">${esc(r.certificate_no)}</button>`
                  : `<span>${esc(r.certificate_no)}</span>`;

                return `
                  <tr>
                    <td data-label="Navn">${esc(r.personnel_name)}</td>
                    <td data-label="Sertifikatnr">${linkCell}</td>
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
export function welderCertFormBody(welders: ProfileWelderRow[]) {
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

  return `
    <div class="modalgrid">
      <div class="field">
        <label>Sveiser</label>
        <select data-f="profile_id" class="select">
          ${optionsHtml}
        </select>
      </div>

      <div class="field">
        <label>Sertifikatnr</label>
        <input data-f="certificate_no" class="input" placeholder="ISO9606-..." />
      </div>

      <div class="field">
        <label>Standard</label>
        <input data-f="standard" class="input" placeholder="ISO 9606-1" />
      </div>

      <div class="field">
        <label>Dekningsområde type fuge</label>
        <input data-f="coverage_joint_type" class="input" placeholder="FW / BW / ..." />
      </div>

      <div class="field">
        <label>Dekningsområde tykkelse</label>
        <input data-f="coverage_thickness" class="input" placeholder="3-20 mm" />
      </div>

      <div class="field">
        <label>Utløpsdato</label>
        <input data-f="expires_at" class="input" type="date" />
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>PDF</label>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
        <div data-f="pdfMeta"></div>
      </div>
    </div>
  `;
}


export function ndtCertFormBody() {
  return `
    <div class="modalgrid">
      <div class="field">
        <label>Navn</label>
        <input data-f="personnel_name" class="input" placeholder="Ola Nordmann" />
      </div>

      <div class="field">
        <label>Sertifikatnr</label>
        <input data-f="certificate_no" class="input" placeholder="12345" />
      </div>

      <div class="field">
        <label>NDT metode</label>
        <input data-f="ndt_method" class="input" placeholder="UT / PT / MT / VT / RT" />
      </div>

      <div class="field">
        <label>Utløpsdato</label>
        <input data-f="expires_at" class="input" type="date" />
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

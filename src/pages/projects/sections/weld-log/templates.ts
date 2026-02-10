import { esc } from "../../../../utils/dom";
import type { DrawingOption, ListFilters, NdtReportRow, WelderOption, WeldDetailRow, WeldListRow } from "./types";

const dash = "—";

const renderValue = (value: string | number | null | undefined) => {
  if (value == null || value === "") return dash;
  return esc(String(value));
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return dash;
  return esc(value);
};

export const statusMeta = (row: WeldListRow) => {
  if (row.status === "avvist") return { label: "Avvist", tone: "danger" };
  if (row.godkjent) return { label: "Godkjent", tone: "ok" };
  if (!row.sveiser_id || !row.dato) return { label: "Mangler", tone: "warn" };
  return { label: "Til kontroll", tone: "pending" };
};

const ndtChip = (label: string, ok: boolean) => {
  const tone = ok ? "ok" : "warn";
  const text = ok ? "OK" : "Mangler";
  return `<span class="chip ${tone}" aria-label="${esc(label)} ${text}">${esc(label)}</span>`;
};

const drawingLabel = (row: DrawingOption) => {
  const rev = (row.revision || "-").trim().toUpperCase() || "-";
  return `${row.drawing_no} · Rev ${rev}`;
};

export function renderLayout(filters: ListFilters, drawings: DrawingOption[], currentDrawingId: string | null) {
  return `
    <section class="panel weld-log">
      <div class="panel-head">
        <div>
          <div class="panel-title">Sveiselogg</div>
          <div class="panel-meta">QC og sporbarhet</div>
        </div>
        <div class="weld-log-actions">
          <button class="btn small" type="button" data-weld-new>Ny sveis</button>
          <button class="btn small" type="button" data-weld-refresh>Oppdater</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="weld-log-toolbar">
          <div class="weld-log-filters">
            <label class="field">
              <span class="muted">Tegning</span>
              <select class="select" data-weld-drawing>
                ${drawings
                  .map(
                    (d) =>
                      `<option value="${esc(d.id)}"${d.id === currentDrawingId ? " selected" : ""}>${esc(drawingLabel(d))}</option>`
                  )
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span class="muted">Status</span>
              <select class="select" data-filter-status>
                <option value="til-kontroll"${filters.status === "til-kontroll" ? " selected" : ""}>Til kontroll</option>
                <option value="godkjent"${filters.status === "godkjent" ? " selected" : ""}>Godkjent</option>
                <option value="avvist"${filters.status === "avvist" ? " selected" : ""}>Avvist</option>
                <option value="alle"${filters.status === "alle" ? " selected" : ""}>Alle</option>
              </select>
            </label>
            <label class="field is-wide">
              <span class="muted">Sok</span>
              <input class="input" data-filter-search placeholder="Sveis ID, sveiser, WPS, rapport" value="${esc(filters.search)}" />
            </label>
          </div>
        </div>
        <div class="weld-bulkbar" data-weld-bulkbar hidden>
          <div class="weld-bulk-left">
            <strong data-bulk-count>0 valgt</strong>
            <button class="btn small" type="button" data-bulk-approve>Godkjenn valgte</button>
            <button class="btn small" type="button" data-bulk-review>Sett til kontroll</button>
          </div>
          <div class="weld-bulk-right">
            <select class="select small" data-bulk-method>
              <option value="vt">VT</option>
              <option value="pt">PT</option>
              <option value="vol">Volumetrisk</option>
            </select>
            <input class="input small" data-bulk-report placeholder="Velg rapport" list="bulk-report-list" />
            <button class="btn small" type="button" data-bulk-attach>Knytt rapport</button>
            <button class="btn danger small" type="button" data-bulk-delete>Slett valgte</button>
          </div>
        </div>
        <div class="weld-table-wrap">
          <table class="data-table weld-log-table" data-weld-table>
            <thead>
              <tr>
                <th class="sticky-col select-col"><input type="checkbox" data-select-all /></th>
                <th class="sticky-col id-col">Sveis ID</th>
                <th>Fuge</th>
                <th>Komponent</th>
                <th>Sveiser</th>
                <th>Dato</th>
                <th>Status</th>
                <th>NDT</th>
                <th></th>
              </tr>
            </thead>
            <tbody data-weld-body></tbody>
          </table>
        </div>
        <div class="weld-pagination" data-weld-pagination></div>
      </div>
    </section>
    <div class="weld-drawer-root" data-weld-drawer-root></div>
    <datalist id="bulk-report-list"></datalist>
  `;
}

export function renderRows(rows: WeldListRow[], selected: Set<string>) {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="9" class="empty">Ingen rader.</td>
      </tr>
    `;
  }

  return rows
    .map((row) => {
      const status = statusMeta(row);
      const component = [row.komponent_a, row.komponent_b].filter(Boolean).join(" / ") || dash;
      const welderLabel = row.sveiser?.welder_no
        ? `${row.sveiser.welder_no} - ${row.sveiser?.display_name ?? ""}`.trim()
        : row.sveiser?.display_name ?? dash;
      const ndt = [
        ndtChip("VT", Boolean(row.vt_report_id)),
        ndtChip("PT", Boolean(row.pt_report_id)),
        ndtChip("Vol", Boolean(row.vol_report_id)),
      ].join(" ");

      return `
        <tr data-row-id="${esc(row.id)}" tabindex="0">
          <td class="sticky-col select-col">
            <input type="checkbox" data-row-select value="${esc(row.id)}"${selected.has(row.id) ? " checked" : ""} />
          </td>
          <td class="sticky-col id-col" data-cell="id">${renderValue(row.sveis_id)}</td>
          <td>${renderValue(row.fuge)}</td>
          <td>${esc(component)}</td>
          <td>${esc(welderLabel)}</td>
          <td>${formatDate(row.dato)}</td>
          <td><span class="chip ${status.tone}">${esc(status.label)}</span></td>
          <td class="ndt-cell">${ndt}</td>
          <td class="row-menu-cell">
            <button class="btn ghost small" type="button" data-row-menu>...</button>
            <div class="row-menu" data-row-menu-panel>
              <button type="button" data-row-action="duplicate">Dupliser</button>
              <button type="button" data-row-action="history">Historikk</button>
              <button type="button" data-row-action="delete" class="danger">Slett</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

export function renderPagination(page: number, pageSize: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return `
    <div class="pager">
      <button class="btn small" type="button" data-page-prev ${page <= 0 ? "disabled" : ""}>Forrige</button>
      <span class="muted">Side ${page + 1} av ${totalPages}</span>
      <button class="btn small" type="button" data-page-next ${page + 1 >= totalPages ? "disabled" : ""}>Neste</button>
    </div>
  `;
}

export function renderBulkReportOptions(reports: NdtReportRow[]) {
  return reports
    .map((r) => `<option value="${esc(r.report_no ?? "")}"></option>`)
    .join("");
}

const reportOptions = (reports: NdtReportRow[], methods: string[]) => {
  return reports
    .filter((r) => methods.includes((r.method || "").toLowerCase()))
    .map((r) => `<option value="${esc(r.report_no ?? "")}"></option>`)
    .join("");
};

const renderRecentReports = (reports: NdtReportRow[], methods: string[]) => {
  const list = reports.filter((r) => methods.includes((r.method || "").toLowerCase())).slice(0, 6);
  if (!list.length) return "";
  return `
    <div class="drawer-recent">
      <div class="muted">Nylige rapporter</div>
      <div class="drawer-recent-list">
        ${list
          .map((r) => {
            const label = `${r.report_no ?? ""} ${r.date ?? ""}`.trim();
            return `<button type="button" class="chip ghost" data-report-pick="${esc(r.id)}">${esc(label || dash)}</button>`;
          })
          .join("")}
      </div>
    </div>
  `;
};

const reportLabel = (reports: NdtReportRow[], reportId: string | null | undefined) => {
  if (!reportId) return "";
  const report = reports.find((r) => r.id === reportId);
  return report?.report_no ?? "";
};

const welderOptions = (welders: WelderOption[]) => {
  return welders
    .map((w) => {
      const no = w.welder_no ?? "";
      const label = `${no} ${w.display_name ?? ""}`.trim();
      return `<option value="${esc(no)}">${esc(label)}</option>`;
    })
    .join("");
};

export function renderDrawer(
  data: WeldDetailRow | null,
  reports: NdtReportRow[],
  welders: WelderOption[],
  open: boolean,
  errors: Record<string, string>,
  loading: boolean
) {
  const hiddenClass = open ? "" : "is-hidden";
  const title = data?.sveis_id ? `Sveis ${data.sveis_id}` : "Ny sveis";

  return `
    <div class="weld-drawer-backdrop ${hiddenClass}" data-drawer-backdrop></div>
    <aside class="weld-drawer ${hiddenClass}" role="dialog" aria-modal="true" aria-label="Sveiselogg" data-drawer>
      <header class="drawer-head">
        <div>
          <div class="drawer-title">${esc(title)}</div>
          <div class="drawer-sub">Oppdater sveis og QC</div>
        </div>
        <button class="btn ghost" type="button" data-drawer-close>Lukk</button>
      </header>
      <div class="drawer-body" ${loading ? "aria-busy=\"true\"" : ""}>
        <section class="drawer-section">
          <h3>Tegning</h3>
          <div class="drawer-grid">
            <label class="field">
              <span>Sveis ID</span>
              <input class="input" data-f="sveis_id" value="${esc(data?.sveis_id ?? "")}" />
              ${errors.sveis_id ? `<div class="field-error">${esc(errors.sveis_id)}</div>` : ""}
            </label>
            <label class="field">
              <span>Fuge</span>
              <input class="input" data-f="fuge" value="${esc(data?.fuge ?? "")}" />
              ${errors.fuge ? `<div class="field-error">${esc(errors.fuge)}</div>` : ""}
            </label>
            <label class="field">
              <span>Komponent A</span>
              <input class="input" data-f="komponent_a" value="${esc(data?.komponent_a ?? "")}" />
            </label>
            <label class="field">
              <span>Komponent B</span>
              <input class="input" data-f="komponent_b" value="${esc(data?.komponent_b ?? "")}" />
            </label>
          </div>
        </section>

        <section class="drawer-section">
          <h3>Produksjon</h3>
          <div class="drawer-grid">
            <label class="field">
              <span>Sveiser</span>
              <input class="input" data-f="sveiser_id" value="${esc(data?.sveiser_id ?? "")}" placeholder="Sveiser nr" list="welder-list" />
              <datalist id="welder-list">${welderOptions(welders)}</datalist>
              ${errors.sveiser_id ? `<div class="field-error">${esc(errors.sveiser_id)}</div>` : ""}
            </label>
            <label class="field">
              <span>WPS</span>
              <input class="input" data-f="wps" value="${esc(data?.wps ?? "")}" />
            </label>
            <label class="field">
              <span>Dato</span>
              <input class="input" type="date" data-f="dato" value="${esc(data?.dato ?? "")}" />
              ${errors.dato ? `<div class="field-error">${esc(errors.dato)}</div>` : ""}
            </label>
            <label class="field">
              <span>Tilsett</span>
              <input class="input" data-f="tilsett" value="${esc(data?.tilsett ?? "")}" />
            </label>
          </div>
        </section>

        <section class="drawer-section">
          <h3>NDT</h3>
          <div class="drawer-grid ndt-grid">
            <div class="ndt-block" data-ndt-block="vt">
              <div class="ndt-head">
                <strong>Visuell (VT)</strong>
                <span class="chip ${data?.vt_report_id ? "ok" : "warn"}">${data?.vt_report_id ? "OK" : "Mangler"}</span>
              </div>
              <label class="field">
                <span>Rapport</span>
                <input class="input" list="vt-report-list" data-f="vt_report_no" value="${esc(reportLabel(reports, data?.vt_report_id))}" placeholder="Velg rapport" />
                <datalist id="vt-report-list">${reportOptions(reports, ["vt"])}</datalist>
              </label>
              <label class="field">
                <span>Dato</span>
                <input class="input" type="date" data-f="vt_date" value="${esc(data?.vt_date ?? "")}" />
              </label>
              <label class="field">
                <span>Kommentar</span>
                <input class="input" data-f="vt_comment" value="${esc(data?.vt_comment ?? "")}" />
              </label>
              ${renderRecentReports(reports, ["vt"])}
            </div>

            <div class="ndt-block" data-ndt-block="pt">
              <div class="ndt-head">
                <strong>Sprekk (PT)</strong>
                <span class="chip ${data?.pt_report_id ? "ok" : "warn"}">${data?.pt_report_id ? "OK" : "Mangler"}</span>
              </div>
              <label class="field">
                <span>Rapport</span>
                <input class="input" list="pt-report-list" data-f="pt_report_no" value="${esc(reportLabel(reports, data?.pt_report_id))}" placeholder="Velg rapport" />
                <datalist id="pt-report-list">${reportOptions(reports, ["pt"])}</datalist>
              </label>
              <label class="field">
                <span>Dato</span>
                <input class="input" type="date" data-f="pt_date" value="${esc(data?.pt_date ?? "")}" />
              </label>
              <label class="field">
                <span>Kommentar</span>
                <input class="input" data-f="pt_comment" value="${esc(data?.pt_comment ?? "")}" />
              </label>
              ${renderRecentReports(reports, ["pt"])}
            </div>

            <div class="ndt-block" data-ndt-block="vol">
              <div class="ndt-head">
                <strong>Volumetrisk (RT/UT)</strong>
                <span class="chip ${data?.vol_report_id ? "ok" : "warn"}">${data?.vol_report_id ? "OK" : "Mangler"}</span>
              </div>
              <label class="field">
                <span>Rapport</span>
                <input class="input" list="vol-report-list" data-f="vol_report_no" value="${esc(reportLabel(reports, data?.vol_report_id))}" placeholder="Velg rapport" />
                <datalist id="vol-report-list">${reportOptions(reports, ["rt", "ut"])}</datalist>
              </label>
              <label class="field">
                <span>Dato</span>
                <input class="input" type="date" data-f="vol_date" value="${esc(data?.vol_date ?? "")}" />
              </label>
              <label class="field">
                <span>Kommentar</span>
                <input class="input" data-f="vol_comment" value="${esc(data?.vol_comment ?? "")}" />
              </label>
              ${renderRecentReports(reports, ["rt", "ut"])}
            </div>
          </div>
        </section>

        <section class="drawer-section">
          <h3>Resultat</h3>
          <div class="drawer-grid">
            <label class="field">
              <span>Kontroll</span>
              <input class="input" data-f="kontrollert_av" value="${esc(data?.kontrollert_av ?? "")}" />
            </label>
            <label class="field field-toggle">
              <span>Godkjent</span>
              <input type="checkbox" data-f="godkjent" ${data?.godkjent ? "checked" : ""} />
            </label>
            <label class="field">
              <span>Merknader</span>
              <input class="input" data-f="merknader" value="${esc(data?.merknader ?? "")}" />
            </label>
          </div>
        </section>
      </div>
      <footer class="drawer-footer">
        <button class="btn ghost" type="button" data-drawer-cancel>Avbryt</button>
        <button class="btn accent" type="button" data-drawer-save>Lagre</button>
      </footer>
    </aside>
  `;
}

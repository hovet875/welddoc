import { esc } from "../../../../utils/dom";
import { renderPagerButtons } from "../../../../ui/pager";
import { renderDatePickerInput } from "../../../../ui/datePicker";
import { iconSvg, renderIconButton } from "../../../../ui/iconButton";
import type {
  DrawingOption,
  EmployeeOption,
  ListFilters,
  NdtMethodOption,
  NdtReportRow,
  RowWpsStatus,
  TraceabilitySelectOption,
  WpsSelectOption,
  WelderOption,
  WeldDetailRow,
  WeldListRow,
} from "./types";

const dash = "—";

const renderValue = (value: string | number | null | undefined) => {
  if (value == null || value === "") return dash;
  return esc(String(value));
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return dash;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return esc(`${dd}.${mm}.${yyyy}`);
  }
  return esc(raw);
};

export const statusMeta = (row: WeldListRow) => {
  if (row.status) return { label: "Godkjent", tone: "ok" };
  return { label: "Til kontroll", tone: "pending" };
};

const ndtChip = (label: string, ok: boolean) => {
  const tone = ok ? "ok" : "warn";
  const text = ok ? "OK" : "Mangler";
  return `<span class="chip ${tone}" aria-label="${esc(label)} ${text}">${esc(label)}</span>`;
};

const wpsStatusBadge = (status: RowWpsStatus | undefined) => {
  if (!status) return `<span class="wps-indicator danger" title="Mangler WPS" aria-label="Mangler WPS">&#10005;</span>`;
  return `<span class="wps-indicator ${status.tone}" title="${esc(status.title)}" aria-label="${esc(status.title)}">${status.symbol}</span>`;
};

const drawingLabel = (row: DrawingOption) => {
  const rev = (row.revision || "-").trim().toUpperCase() || "-";
  return `${row.drawing_no} · Rev ${rev}`;
};

const bulkMethodOptions = (methods: NdtMethodOption[], selectedCode: string) => {
  return methods
    .map((method) => {
      const code = (method.code || "").trim().toUpperCase();
      if (!code) return "";
      const selected = code === selectedCode ? " selected" : "";
      return `<option value="${esc(code)}"${selected}>${esc(method.label || code)}</option>`;
    })
    .join("");
};

const bulkWelderDatalistOptions = (welders: WelderOption[]) => {
  return welders
    .map((welder) => {
      const no = String(welder.welder_no ?? "").trim();
      const name = String(welder.display_name ?? "").trim();
      const label = [no, name].filter(Boolean).join(" - ");
      if (!label) return "";
      return `<option value="${esc(no || label)}">${esc(label)}</option>`;
    })
    .join("");
};

const bulkFillerSelectOptions = (options: TraceabilitySelectOption[], selectedId: string) => {
  const selected = String(selectedId || "").trim();
  const rows = [
    `<option value="">Velg tilsett...</option>`,
    ...options.map((opt) => `<option value="${esc(opt.id)}"${opt.id === selected ? " selected" : ""}>${esc(opt.label)}</option>`),
  ];
  return rows.join("");
};

const bulkFugeSelectOptions = (jointTypes: string[], selectedValue: string) => {
  const selected = String(selectedValue || "").trim();
  const values = Array.from(new Set(jointTypes.map((row) => String(row || "").trim()).filter(Boolean)));
  values.sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
  const rows = [
    `<option value="">Velg fugetype...</option>`,
    ...values.map((value) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(value)}</option>`),
  ];
  return rows.join("");
};

export function renderLayout(
  filters: ListFilters,
  drawings: DrawingOption[],
  currentDrawingId: string | null,
  ndtMethods: NdtMethodOption[],
  selectedBulkMethodCode: string,
  welders: WelderOption[],
  fillerOptions: TraceabilitySelectOption[],
  jointTypes: string[],
  bulkWelderValue: string,
  bulkFillerId: string,
  bulkFugeValue: string
) {
  const methodOptions = bulkMethodOptions(ndtMethods, selectedBulkMethodCode);
  const bulkMethodDisabled = ndtMethods.length ? "" : " disabled";
  const welderOptions = bulkWelderDatalistOptions(welders);
  const fillerSelectOptions = bulkFillerSelectOptions(fillerOptions, bulkFillerId);
  const fugeSelectOptions = bulkFugeSelectOptions(jointTypes, bulkFugeValue);
  const bulkFillerDisabled = fillerOptions.length ? "" : " disabled";
  const bulkFugeDisabled = jointTypes.length ? "" : " disabled";
  return `
    <section class="panel weld-log">
      <div class="panel-head">
        <div>
          <div class="panel-title">Sveiselogg</div>
          <div class="panel-meta">Oversikt over sveiser tilknyttet prosjektet</div>
        </div>
        <div class="weld-log-actions">
          <button class="btn small" type="button" data-weld-new>Ny sveis</button>
          <button class="btn small" type="button" data-weld-bulk-add>Bulk legg til</button>
          <button class="btn small" type="button" data-weld-refresh>Oppdater</button>
          ${renderIconButton({ dataKey: "weld-print", id: "weld-print", title: "Skriv ut", icon: iconSvg("print") })}
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
                <option value="false"${filters.status === "false" ? " selected" : ""}>Til kontroll</option>
                <option value="true"${filters.status === "true" ? " selected" : ""}>Godkjent</option>
                <option value="all"${filters.status === "all" ? " selected" : ""}>Alle</option>
              </select>
            </label>
            <label class="field is-wide">
              <span class="muted">Sok</span>
              <input class="input" data-filter-search placeholder="Sveis ID, sveiser, WPS, rapport" value="${esc(filters.search)}" />
            </label>
          </div>
        </div>
        <div class="weld-bulkbar" data-weld-bulkbar hidden>
          <div class="weld-bulk-groups">
            <div class="weld-bulk-group weld-bulk-group-main">
              <div class="weld-bulk-group-title">Valgte rader</div>
              <strong data-bulk-count>0 valgt</strong>
              <button class="btn small" type="button" data-bulk-approve>Godkjenn valgte</button>
              <button class="btn small" type="button" data-bulk-review>Sett til kontroll</button>
              <button class="btn danger small" type="button" data-bulk-delete>Slett valgte</button>
            </div>
            <div class="weld-bulk-group weld-bulk-group-fuge">
              <div class="weld-bulk-group-title">Fugetype</div>
              <select class="select small" data-bulk-fuge${bulkFugeDisabled}>
                ${fugeSelectOptions}
              </select>
              <div class="weld-bulk-actions-row">
                <button class="btn small" type="button" data-bulk-set-fuge>Sett</button>
                <button class="btn danger small" type="button" data-bulk-clear-fuge>Fjern</button>
              </div>
            </div>
            <div class="weld-bulk-group weld-bulk-group-welder">
              <div class="weld-bulk-group-title">Sveiser ID</div>
              <input
                class="input small"
                data-bulk-welder
                placeholder="Velg sveiser"
                list="bulk-welder-list"
                value="${esc(bulkWelderValue)}"
              />
              <div class="weld-bulk-actions-row">
                <button class="btn small" type="button" data-bulk-set-welder>Sett</button>
                <button class="btn danger small" type="button" data-bulk-clear-welder>Fjern</button>
              </div>
            </div>
            <div class="weld-bulk-group weld-bulk-group-filler">
              <div class="weld-bulk-group-title">Tilsett</div>
              <select class="select small" data-bulk-filler${bulkFillerDisabled}>
                ${fillerSelectOptions}
              </select>
              <div class="weld-bulk-actions-row">
                <button class="btn small" type="button" data-bulk-set-filler>Sett</button>
                <button class="btn danger small" type="button" data-bulk-clear-filler>Fjern</button>
              </div>
            </div>
            <div class="weld-bulk-group weld-bulk-group-report">
              <div class="weld-bulk-group-title">NDT (rapport/godkjenner)</div>
              <select class="select small" data-bulk-method${bulkMethodDisabled}>
                ${methodOptions || `<option value="">Ingen metoder</option>`}
              </select>
              <input class="input small" data-bulk-report placeholder="Velg rapport" list="bulk-report-list" />
              <div class="weld-bulk-actions-row">
                <button class="btn small" type="button" data-bulk-attach>Sett</button>
                <button class="btn danger small" type="button" data-bulk-clear-attach>Fjern</button>
              </div>
            </div>
          </div>
        </div>
        <div class="weld-table-wrap">
          <table class="data-table weld-log-table" data-weld-table>
            <thead>
              <tr class="weld-group-row">
                <th class="select-col group-empty"></th>
                <th colspan="3" class="group-label">Grunninfo</th>
                <th colspan="3" class="group-label">Produksjon</th>
                <th colspan="2" class="group-label">NDT</th>
                <th class="group-empty"></th>
              </tr>
              <tr class="weld-field-row">
                <th class="sticky-col select-col"><input type="checkbox" data-select-all /></th>
                <th class="sticky-col id-col">Sveis ID</th>
                <th>Fuge</th>
                <th>Komponent</th>
                <th>Sveiser</th>
                <th class="wps-col">WPS</th>
                <th>Dato</th>
                <th>NDT</th>
                <th>Status</th>
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
    <datalist id="bulk-welder-list">${welderOptions}</datalist>
  `;
}

export function renderRows(rows: WeldListRow[], selected: Set<string>, wpsStatusByRow: Map<string, RowWpsStatus>) {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="10" class="empty">Ingen rader.</td>
      </tr>
    `;
  }

  return rows
    .map((row) => {
      const status = statusMeta(row);
      const compA = row.komponent_a ? esc(row.komponent_a) : "";
      const compB = row.komponent_b ? esc(row.komponent_b) : "";
      const component = compA && compB
        ? `${compA} <span aria-hidden="true">&#8596;</span> ${compB}`
        : compA || compB || dash;
      const welderLabel = row.sveiser?.welder_no
        ? `${row.sveiser.welder_no} - ${row.sveiser?.display_name ?? ""}`.trim()
        : row.sveiser?.display_name ?? dash;
      const ndt = [
        ndtChip("Visuell", Boolean(row.vt_report_id) || Boolean(row.kontrollert_av)),
        ndtChip("Sprekk", Boolean(row.pt_report_id)),
        ndtChip("Volumetrisk", Boolean(row.vol_report_id)),
      ].join(" ");

      return `
        <tr data-row-id="${esc(row.id)}" tabindex="0">
          <td class="sticky-col select-col">
            <input type="checkbox" data-row-select value="${esc(row.id)}"${selected.has(row.id) ? " checked" : ""} />
          </td>
          <td class="sticky-col id-col" data-cell="id">${renderValue(row.sveis_id)}</td>
          <td>${renderValue(row.fuge)}</td>
          <td>${component}</td>
          <td>${esc(welderLabel)}</td>
          <td class="wps-col">${wpsStatusBadge(wpsStatusByRow.get(row.id))}</td>
          <td>${formatDate(row.dato)}</td>
          <td class="ndt-cell"><div class="ndt-pills">${ndt}</div></td>
          <td><span class="chip ${status.tone}">${esc(status.label)}</span></td>
          <td class="row-menu-cell">
            <button class="btn ghost small" type="button" data-row-menu>...</button>
            <div class="row-menu" data-row-menu-panel>
              <button type="button" data-row-action="info">Vis informasjon</button>
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
  const buttons = renderPagerButtons({ totalPages, currentPage: page + 1 });
  return `<div class="pager">${buttons}</div>`;
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

const employeeOptions = (
  employees: EmployeeOption[],
  selectedId: string | null | undefined,
  welderId: string | null | undefined
) => {
  const selected = (selectedId || "").trim();
  const welder = (welderId || "").trim();
  const rows = [
    `<option value="">Ingen intern godkjenner</option>`,
    ...employees.map((emp) => {
      const isWelder = Boolean(welder && emp.id === welder);
      const selectedAttr = emp.id === selected ? " selected" : "";
      const disabledAttr = isWelder ? " disabled" : "";
      const suffix = isWelder ? " (sveiser)" : "";
      return `<option value="${esc(emp.id)}"${selectedAttr}${disabledAttr}>${esc(`${emp.label}${suffix}`)}</option>`;
    }),
  ];
  if (selected && !employees.some((emp) => emp.id === selected)) {
    rows.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
  }
  return rows.join("");
};

const fugeOptions = (jointTypes: string[], selected: string | null | undefined) => {
  const selectedValue = (selected || "").trim();
  const values = Array.from(new Set(jointTypes.map((v) => (v || "").trim()).filter(Boolean)));
  if (selectedValue && !values.includes(selectedValue)) values.push(selectedValue);
  values.sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
  return [
    `<option value="">Velg fugetype...</option>`,
    ...values.map((value) => `<option value="${esc(value)}"${value === selectedValue ? " selected" : ""}>${esc(value)}</option>`),
  ].join("");
};

const traceabilityOptions = (
  options: TraceabilitySelectOption[],
  selectedId: string | null | undefined,
  placeholder: string,
  fallbackLabel?: string | null
) => {
  const selected = (selectedId || "").trim();
  const rows = [
    `<option value="">${esc(placeholder)}</option>`,
    ...options.map(
      (opt) =>
        `<option value="${esc(opt.id)}"${opt.id === selected ? " selected" : ""}>${esc(opt.label)}</option>`
    ),
  ];
  if (selected && !options.some((opt) => opt.id === selected)) {
    rows.push(`<option value="${esc(selected)}" selected>${esc((fallbackLabel || selected).trim())}</option>`);
  }
  return rows.join("");
};

const wpsOptions = (
  options: WpsSelectOption[],
  selectedId: string | null | undefined,
  placeholder: string,
  fallbackLabel?: string | null
) => {
  const selected = (selectedId || "").trim();
  const rows = [
    `<option value="">${esc(placeholder)}</option>`,
    ...options.map(
      (opt) =>
        `<option value="${esc(opt.id)}"${opt.id === selected ? " selected" : ""}>${esc(opt.label)}</option>`
    ),
  ];
  if (selected && !options.some((opt) => opt.id === selected)) {
    rows.push(`<option value="${esc(selected)}" selected>${esc((fallbackLabel || selected).trim())}</option>`);
  }
  return rows.join("");
};

export function renderDrawer(
  data: WeldDetailRow | null,
  reports: NdtReportRow[],
  welders: WelderOption[],
  employees: EmployeeOption[],
  jointTypes: string[],
  componentOptions: TraceabilitySelectOption[],
  fillerOptions: TraceabilitySelectOption[],
  wpsSelect: WpsSelectOption[],
  wpsPlaceholder: string,
  wpsDisabled: boolean,
  open: boolean,
  errors: Record<string, string>,
  loading: boolean
) {
  const hiddenClass = open ? "" : "is-hidden";
  const title = data?.sveis_id ? `Sveis ${data.sveis_id}` : "Ny sveis";
  const welderValue = data?.sveiser?.welder_no ?? data?.sveiser_id ?? "";

  return `
    <div class="weld-drawer-backdrop ${hiddenClass}" data-drawer-backdrop></div>
    <aside class="weld-drawer ${hiddenClass}" role="dialog" aria-modal="true" aria-label="Sveiselogg" data-drawer>
      <header class="drawer-head">
        <div>
          <div class="drawer-title">${esc(title)}</div>
          <div class="drawer-sub">Oppdater sveis</div>
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
              <select class="select" data-f="fuge">
                ${fugeOptions(jointTypes, data?.fuge)}
              </select>
              ${errors.fuge ? `<div class="field-error">${esc(errors.fuge)}</div>` : ""}
            </label>
            <label class="field">
              <span>Komponent A</span>
              <select class="select" data-f="komponent_a_id">
                ${traceabilityOptions(componentOptions, data?.komponent_a_id, "Velg komponent A...", data?.komponent_a)}
              </select>
            </label>
            <label class="field">
              <span>Komponent B</span>
              <select class="select" data-f="komponent_b_id">
                ${traceabilityOptions(componentOptions, data?.komponent_b_id, "Velg komponent B...", data?.komponent_b)}
              </select>
            </label>
          </div>
        </section>

        <section class="drawer-section">
          <h3>Produksjon</h3>
          <div class="drawer-grid">
            <label class="field">
              <span>Sveiser</span>
              <input class="input" data-f="sveiser_id" value="${esc(welderValue)}" placeholder="Sveiser nr" list="welder-list" />
              <datalist id="welder-list">${welderOptions(welders)}</datalist>
              ${errors.sveiser_id ? `<div class="field-error">${esc(errors.sveiser_id)}</div>` : ""}
            </label>
            <label class="field">
              <span>WPS</span>
              <select class="select" data-f="wps_id"${wpsDisabled ? " disabled" : ""}>
                ${wpsOptions(wpsSelect, data?.wps_id, wpsPlaceholder, data?.wps)}
              </select>
            </label>
            <label class="field">
              <span>Dato</span>
              ${renderDatePickerInput({
                value: data?.dato ?? "",
                inputAttrs: `data-f="dato" class="input"`,
                openLabel: "Velg dato",
              })}
              ${errors.dato ? `<div class="field-error">${esc(errors.dato)}</div>` : ""}
            </label>
            <label class="field">
              <span>Tilsett</span>
              <select class="select" data-f="tilsett_id">
                ${traceabilityOptions(fillerOptions, data?.tilsett_id, "Velg tilsett...", data?.tilsett)}
              </select>
            </label>
          </div>
        </section>

        <section class="drawer-section">
          <h3>NDT</h3>
          <div class="drawer-grid ndt-grid">
            <div class="ndt-block" data-ndt-block="vt">
              <div class="ndt-head">
                <strong>Visuell (VT)</strong>
                <span class="chip ${data?.vt_report_id || data?.kontrollert_av ? "ok" : "warn"}">${data?.vt_report_id || data?.kontrollert_av ? "OK" : "Mangler"}</span>
              </div>
              <label class="field">
                <span>Rapport</span>
                <div class="ndt-report-row">
                  <input class="input" list="vt-report-list" data-f="vt_report_no" value="${esc(reportLabel(reports, data?.vt_report_id))}" placeholder="Velg rapport" />
                  <button class="btn ghost small" type="button" data-clear-report="vt"${data?.vt_report_id ? "" : " disabled"}>Fjern</button>
                </div>
                <datalist id="vt-report-list">${reportOptions(reports, ["vt"])}</datalist>
              </label>
              <label class="field">
                <span>Visuelt godkjent av</span>
                <select class="select" data-f="kontrollert_av">
                  ${employeeOptions(employees, data?.kontrollert_av, data?.sveiser_id)}
                </select>
                ${errors.kontrollert_av ? `<div class="field-error">${esc(errors.kontrollert_av)}</div>` : ""}
              </label>
              <div class="muted ndt-hint">Må være en annen person enn sveiser.</div>
              ${renderRecentReports(reports, ["vt"])}
            </div>

            <div class="ndt-block" data-ndt-block="pt">
              <div class="ndt-head">
                <strong>Sprekk (PT/MT)</strong>
                <span class="chip ${data?.pt_report_id ? "ok" : "warn"}">${data?.pt_report_id ? "OK" : "Mangler"}</span>
              </div>
              <label class="field">
                <span>Rapport</span>
                <div class="ndt-report-row">
                  <input class="input" list="pt-report-list" data-f="pt_report_no" value="${esc(reportLabel(reports, data?.pt_report_id))}" placeholder="Velg rapport" />
                  <button class="btn ghost small" type="button" data-clear-report="pt"${data?.pt_report_id ? "" : " disabled"}>Fjern</button>
                </div>
                <datalist id="pt-report-list">${reportOptions(reports, ["pt", "mt"])}</datalist>
              </label>
              ${renderRecentReports(reports, ["pt", "mt"])}
            </div>

            <div class="ndt-block" data-ndt-block="vol">
              <div class="ndt-head">
                <strong>Volumetrisk (RT/UT)</strong>
                <span class="chip ${data?.vol_report_id ? "ok" : "warn"}">${data?.vol_report_id ? "OK" : "Mangler"}</span>
              </div>
              <label class="field">
                <span>Rapport</span>
                <div class="ndt-report-row">
                  <input class="input" list="vol-report-list" data-f="vol_report_no" value="${esc(reportLabel(reports, data?.vol_report_id))}" placeholder="Velg rapport" />
                  <button class="btn ghost small" type="button" data-clear-report="vol"${data?.vol_report_id ? "" : " disabled"}>Fjern</button>
                </div>
                <datalist id="vol-report-list">${reportOptions(reports, ["rt", "ut"])}</datalist>
              </label>
              ${renderRecentReports(reports, ["rt", "ut"])}
            </div>
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

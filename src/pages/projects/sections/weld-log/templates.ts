import { esc } from "../../../../utils/dom";
import { renderPagerButtons } from "../../../../ui/pager";
import { renderDatePickerInput } from "../../../../ui/datePicker";
import { iconSvg, renderIconButton } from "../../../../ui/iconButton";
import type {
  BulkChangeField,
  DrawingOption,
  EmployeeOption,
  ListFilters,
  NdtReportRow,
  RowWpsStatus,
  TraceabilitySelectOption,
  WpsSelectOption,
  WelderOption,
  WeldDetailRow,
  WeldListRow,
} from "./types";

const dash = "\u2014";

export const VT_NO_REPORT_VALUE = "__VT_NO_REPORT__";

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
  return `${row.drawing_no} - Rev ${rev}`;
};

const bulkFieldOptions = (selected: BulkChangeField | "") => {
  const rows: Array<{ value: BulkChangeField; label: string }> = [
    { value: "fuge", label: "Fugetype" },
    { value: "sveiser", label: "Sveiser" },
    { value: "dato", label: "Dato" },
    { value: "tilsett", label: "Tilsett" },
    { value: "vt", label: "Visuell" },
    { value: "pt", label: "Sprekk" },
    { value: "vol", label: "Volumetrisk" },
  ];
  return [
    `<option value="">Velg felt...</option>`,
    ...rows.map((row) => `<option value="${row.value}"${selected === row.value ? " selected" : ""}>${esc(row.label)}</option>`),
  ].join("");
};

const bulkReportRows = (reports: NdtReportRow[], field: "vt" | "pt" | "vol") => {
  const methods = field === "vt" ? ["vt"] : field === "pt" ? ["pt", "mt"] : ["rt", "ut"];
  return reports.filter((report) => methods.includes(String(report.method ?? "").trim().toLowerCase()));
};

const bulkReportOptions = (reports: NdtReportRow[], field: "vt" | "pt" | "vol", selectedValue: string, vtNoReport: boolean) => {
  const selected = String(selectedValue || "").trim();
  const rows = bulkReportRows(reports, field);
  const options = [
    `<option value="">Velg rapport...</option>`,
    ...(field === "vt"
      ? [`<option value="${esc(VT_NO_REPORT_VALUE)}"${vtNoReport ? " selected" : ""}>Ingen rapport</option>`]
      : []),
    ...rows.map((report) => {
      const reportNo = String(report.report_no ?? "").trim() || dash;
      const date = String(report.date ?? "").trim();
      const label = date ? `${reportNo} - ${date}` : reportNo;
      const selectedAttr = !vtNoReport && report.id === selected ? " selected" : "";
      return `<option value="${esc(report.id)}"${selectedAttr}>${esc(label)}</option>`;
    }),
  ];
  if (selected && selected !== VT_NO_REPORT_VALUE && !rows.some((row) => row.id === selected)) {
    options.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
  }
  return options.join("");
};

const bulkWelderOptions = (welders: WelderOption[], selectedValue: string) => {
  const selected = String(selectedValue || "").trim();
  const rows = [
    `<option value="">Velg sveiser...</option>`,
    ...welders.map((welder) => {
      const no = String(welder.welder_no ?? "").trim();
      const name = String(welder.display_name ?? "").trim();
      const label = [no, name].filter(Boolean).join(" - ") || String(welder.id ?? "").trim() || dash;
      const selectedAttr = welder.id === selected ? " selected" : "";
      return `<option value="${esc(welder.id)}"${selectedAttr}>${esc(label)}</option>`;
    }),
  ];
  if (selected && !welders.some((welder) => welder.id === selected)) {
    rows.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
  }
  return rows.join("");
};

const bulkFillerOptions = (options: TraceabilitySelectOption[], selectedValue: string) => {
  const selected = String(selectedValue || "").trim();
  const rows = [
    `<option value="">Velg tilsett...</option>`,
    ...options.map((option) => `<option value="${esc(option.id)}"${option.id === selected ? " selected" : ""}>${esc(option.label)}</option>`),
  ];
  if (selected && !options.some((option) => option.id === selected)) {
    rows.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
  }
  return rows.join("");
};

const bulkJointTypeOptions = (jointTypes: string[], selectedValue: string) => {
  const selected = String(selectedValue || "").trim();
  const values = Array.from(new Set(jointTypes.map((value) => String(value || "").trim()).filter(Boolean)));
  values.sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
  if (selected && !values.includes(selected)) values.push(selected);
  return [
    `<option value="">Velg fugetype...</option>`,
    ...values.map((value) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(value)}</option>`),
  ].join("");
};

const bulkInspectorOptions = (employees: EmployeeOption[], selectedValue: string) => {
  const selected = String(selectedValue || "").trim();
  const rows = [
    `<option value="">Velg intern godkjenner...</option>`,
    ...employees.map((employee) => {
      const label = String(employee.label ?? "").trim() || String(employee.display_name ?? "").trim() || String(employee.id ?? "").trim();
      return `<option value="${esc(employee.id)}"${employee.id === selected ? " selected" : ""}>${esc(label)}</option>`;
    }),
  ];
  if (selected && !employees.some((employee) => employee.id === selected)) {
    rows.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
  }
  return rows.join("");
};

const bulkValueEditor = (
  field: BulkChangeField | "",
  value: string,
  vtNoReport: boolean,
  vtInspectorId: string,
  reports: NdtReportRow[],
  welders: WelderOption[],
  employees: EmployeeOption[],
  fillerOptions: TraceabilitySelectOption[],
  jointTypes: string[]
) => {
  if (!field) {
    return `<div class="muted">Velg et felt for å fortsette.</div>`;
  }

  if (field === "fuge") {
    return `
      <label class="field">
        <span class="muted">Ny fugetype</span>
        <select class="select" data-bulk-change-value>
          ${bulkJointTypeOptions(jointTypes, value)}
        </select>
      </label>
    `;
  }

  if (field === "sveiser") {
    return `
      <label class="field">
        <span class="muted">Ny sveiser</span>
        <select class="select" data-bulk-change-value>
          ${bulkWelderOptions(welders, value)}
        </select>
      </label>
    `;
  }

  if (field === "dato") {
    return `
      <label class="field">
        <span class="muted">Ny dato</span>
        ${renderDatePickerInput({
          value: value || "",
          inputAttrs: `data-bulk-change-value class="input"`,
          openLabel: "Velg dato",
        })}
      </label>
    `;
  }

  if (field === "tilsett") {
    return `
      <label class="field">
        <span class="muted">Ny tilsett</span>
        <select class="select" data-bulk-change-value>
          ${bulkFillerOptions(fillerOptions, value)}
        </select>
      </label>
    `;
  }

  if (field === "vt") {
    return `
      <div class="weld-bulk-vt-grid">
        <label class="field">
          <span class="muted">Visuell rapport</span>
          <select class="select" data-bulk-change-value>
            ${bulkReportOptions(reports, "vt", value, vtNoReport)}
          </select>
        </label>
        ${
          vtNoReport
            ? `
              <label class="field">
                <span class="muted">Intern godkjenner</span>
                <select class="select" data-bulk-vt-inspector>
                  ${bulkInspectorOptions(employees, vtInspectorId)}
                </select>
              </label>
            `
            : ""
        }
      </div>
    `;
  }

  if (field === "pt") {
    return `
      <label class="field">
        <span class="muted">Sprekkrapport (PT/MT)</span>
        <select class="select" data-bulk-change-value>
          ${bulkReportOptions(reports, "pt", value, false)}
        </select>
      </label>
    `;
  }

  return `
    <label class="field">
      <span class="muted">Volumetrisk rapport (RT/UT)</span>
      <select class="select" data-bulk-change-value>
        ${bulkReportOptions(reports, "vol", value, false)}
      </select>
    </label>
  `;
};

const bulkApplyDisabled = (field: BulkChangeField | "", value: string, vtNoReport: boolean, vtInspectorId: string) => {
  if (!field) return true;
  const selectedValue = String(value || "").trim();
  if (field === "vt") {
    if (vtNoReport) return !String(vtInspectorId || "").trim();
    return !selectedValue || selectedValue === VT_NO_REPORT_VALUE;
  }
  return !selectedValue;
};

export function renderLayout(
  filters: ListFilters,
  pageSize: number,
  drawings: DrawingOption[],
  currentDrawingId: string | null,
  bulkField: BulkChangeField | "",
  bulkValue: string,
  bulkVtNoReport: boolean,
  bulkVtInspectorId: string,
  reports: NdtReportRow[],
  welders: WelderOption[],
  employees: EmployeeOption[],
  fillerOptions: TraceabilitySelectOption[],
  jointTypes: string[]
) {
  const editorHtml = bulkValueEditor(
    bulkField,
    bulkValue,
    bulkVtNoReport,
    bulkVtInspectorId,
    reports,
    welders,
    employees,
    fillerOptions,
    jointTypes
  );
  const applyDisabled = bulkApplyDisabled(bulkField, bulkValue, bulkVtNoReport, bulkVtInspectorId) ? " disabled" : "";
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
          <button class="btn small" type="button" data-weld-refresh>&#x21bb;</button>
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
            <label class="field">
              <span class="muted">Per side</span>
              <select class="select" data-page-size>
                <option value="10"${pageSize === 10 ? " selected" : ""}>10</option>
                <option value="20"${pageSize === 20 ? " selected" : ""}>20</option>
                <option value="50"${pageSize === 50 ? " selected" : ""}>50</option>
                <option value="100"${pageSize === 100 ? " selected" : ""}>100</option>
              </select>
            </label>
          </div>
        </div>
        <div class="weld-table-wrap">
          <table class="data-table weld-log-table" data-weld-table>
            <thead>
              <tr class="weld-group-row">
                <th class="select-col group-empty"></th>
                <th colspan="3" class="group-label">Grunninfo</th>
                <th colspan="4" class="group-label">Produksjon</th>
                <th colspan="2" class="group-label">NDT</th>
                <th class="group-empty"></th>
              </tr>
              <tr class="weld-field-row">
                <th class="sticky-col select-col"><input type="checkbox" data-select-all /></th>
                <th class="sticky-col id-col">Sveis ID</th>
                <th>Fuge</th>
                <th>Komponent</th>
                <th>Sveiser</th>
                <th class="cert-col">Sertifikat</th>
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
        <div class="weld-bulkbar" data-weld-bulkbar hidden>
          <div class="weld-bulkbar-editor">
            <label class="field">
              <span class="muted">Hva vil du endre?</span>
              <select class="select" data-bulk-change-field>
                ${bulkFieldOptions(bulkField)}
              </select>
            </label>
            <div class="weld-bulkbar-editor-next">
              ${editorHtml}
            </div>
            <button class="btn small" type="button" data-bulk-apply${applyDisabled}>Endre valgte</button>
          </div>
          <div class="weld-bulkbar-footer">
            <strong class="weld-bulkbar-count" data-bulk-count>0 valgt</strong>
            <div class="weld-bulkbar-actions">
              <button class="btn success small" type="button" data-bulk-approve>Godkjenn valgte</button>
              <button class="btn small" type="button" data-bulk-review>Sett valgte til kontroll</button>
              <button class="btn danger small" type="button" data-bulk-delete>Slett valgte</button>
            </div>
          </div>
        </div>
      </div>
    </section>
    <div class="weld-drawer-root" data-weld-drawer-root></div>
  `;
}

const certStatusBadge = (status: RowWpsStatus | undefined) => {
  if (!status) return `<span class="wps-indicator danger" title="Mangler sertifikat" aria-label="Mangler sertifikat">&#10005;</span>`;
  return `<span class="wps-indicator ${status.tone}" title="${esc(status.title)}" aria-label="${esc(status.title)}">${status.symbol}</span>`;
};

export function renderRows(
  rows: WeldListRow[],
  selected: Set<string>,
  certStatusByRow: Map<string, RowWpsStatus>,
  wpsStatusByRow: Map<string, RowWpsStatus>
) {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="11" class="empty">Ingen rader.</td>
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
          <td class="sticky-col select-col" data-label="Velg">
            <input type="checkbox" data-row-select value="${esc(row.id)}"${selected.has(row.id) ? " checked" : ""} />
          </td>
          <td class="sticky-col id-col" data-cell="id" data-label="Sveis ID">${renderValue(row.sveis_id)}</td>
          <td data-label="Fuge">${renderValue(row.fuge)}</td>
          <td data-label="Komponent">${component}</td>
          <td data-label="Sveiser">${esc(welderLabel)}</td>
          <td class="cert-col" data-label="Sertifikat">${certStatusBadge(certStatusByRow.get(row.id))}</td>
          <td class="wps-col" data-label="WPS">${wpsStatusBadge(wpsStatusByRow.get(row.id))}</td>
          <td data-label="Dato">${formatDate(row.dato)}</td>
          <td class="ndt-cell" data-label="NDT"><div class="ndt-pills">${ndt}</div></td>
          <td data-label="Status"><span class="chip ${status.tone}">${esc(status.label)}</span></td>
          <td class="row-menu-cell" data-label="Handling">
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
  const buttons = renderPagerButtons({ totalPages, currentPage: page + 1, dataAttrs: { weldpager: "1" } });
  return `<div class="pager">${buttons}</div>`;
}

const reportSelectOptions = (
  reports: NdtReportRow[],
  methods: string[],
  selectedId: string | null | undefined,
  placeholder = "Velg rapport..."
) => {
  const selected = (selectedId || "").trim();
  const filtered = reports.filter((r) => methods.includes((r.method || "").toLowerCase()));
  const rows = [
    `<option value="">${esc(placeholder)}</option>`,
    ...filtered.map((report) => {
      const reportNo = String(report.report_no ?? "").trim() || dash;
      const date = String(report.date ?? "").trim();
      const label = date ? `${reportNo} - ${date}` : reportNo;
      return `<option value="${esc(report.id)}"${report.id === selected ? " selected" : ""}>${esc(label)}</option>`;
    }),
  ];
  if (selected && !filtered.some((report) => report.id === selected)) {
    const fallback = reports.find((report) => report.id === selected);
    const fallbackLabel = String(fallback?.report_no ?? selected).trim() || selected;
    rows.push(`<option value="${esc(selected)}" selected>${esc(fallbackLabel)}</option>`);
  }
  return rows.join("");
};

const vtReportSelectOptions = (reports: NdtReportRow[], selectedId: string | null | undefined, noReportSelected: boolean) => {
  const selected = (selectedId || "").trim();
  const filtered = reports.filter((r) => (r.method || "").toLowerCase() === "vt");
  const rows = [
    `<option value="">Velg rapport...</option>`,
    `<option value="${esc(VT_NO_REPORT_VALUE)}"${!selected && noReportSelected ? " selected" : ""}>Ingen rapport</option>`,
    ...filtered.map((report) => {
      const reportNo = String(report.report_no ?? "").trim() || dash;
      const date = String(report.date ?? "").trim();
      const label = date ? `${reportNo} - ${date}` : reportNo;
      return `<option value="${esc(report.id)}"${report.id === selected ? " selected" : ""}>${esc(label)}</option>`;
    }),
  ];
  if (selected && !filtered.some((report) => report.id === selected)) {
    const fallback = reports.find((report) => report.id === selected);
    const fallbackLabel = String(fallback?.report_no ?? selected).trim() || selected;
    rows.push(`<option value="${esc(selected)}" selected>${esc(fallbackLabel)}</option>`);
  }
  return rows.join("");
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

const welderSelectOptions = (welders: WelderOption[], selectedId: string | null | undefined) => {
  const selected = (selectedId || "").trim();
  const rows = [
    `<option value="">Velg sveiser...</option>`,
    ...welders.map((welder) => {
      const no = String(welder.welder_no ?? "").trim();
      const name = String(welder.display_name ?? "").trim();
      const label = [no, name].filter(Boolean).join(" - ") || String(welder.id ?? "").trim() || dash;
      const id = String(welder.id ?? "").trim();
      return `<option value="${esc(id)}"${id === selected ? " selected" : ""}>${esc(label)}</option>`;
    }),
  ];
  if (selected && !welders.some((welder) => welder.id === selected)) {
    rows.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
  }
  return rows.join("");
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
      const label = String(emp.display_name ?? "").trim() || String(emp.id ?? "").trim();
      return `<option value="${esc(emp.id)}"${selectedAttr}${disabledAttr}>${esc(label)}</option>`;
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
  vtNoReportSelected: boolean,
  open: boolean,
  errors: Record<string, string>,
  loading: boolean
) {
  const hiddenClass = open ? "" : "is-hidden";
  const title = data?.sveis_id ? `Sveis ${data.sveis_id}` : "Ny sveis";
  const welderValue = data?.sveiser_id ?? data?.sveiser?.id ?? "";

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
              <select class="select" data-f="sveiser_id">
                ${welderSelectOptions(welders, welderValue)}
              </select>
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
                  <select class="select" data-f="vt_report_id">
                    ${vtReportSelectOptions(reports, data?.vt_report_id, vtNoReportSelected)}
                  </select>
                  <button class="btn ghost small" type="button" data-clear-report="vt"${data?.vt_report_id ? "" : " disabled"}>Fjern</button>
                </div>
              </label>
              ${
                vtNoReportSelected
                  ? `
              <label class="field">
                <span>Visuelt godkjent av</span>
                <select class="select" data-f="kontrollert_av">
                  ${employeeOptions(employees, data?.kontrollert_av, data?.sveiser_id)}
                </select>
                ${errors.kontrollert_av ? `<div class="field-error">${esc(errors.kontrollert_av)}</div>` : ""}
              </label>
              <div class="muted ndt-hint">Må være en annen person enn sveiser.</div>
              `
                  : ""
              }
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
                  <select class="select" data-f="pt_report_id">
                    ${reportSelectOptions(reports, ["pt", "mt"], data?.pt_report_id)}
                  </select>
                  <button class="btn ghost small" type="button" data-clear-report="pt"${data?.pt_report_id ? "" : " disabled"}>Fjern</button>
                </div>
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
                  <select class="select" data-f="vol_report_id">
                    ${reportSelectOptions(reports, ["rt", "ut"], data?.vol_report_id)}
                  </select>
                  <button class="btn ghost small" type="button" data-clear-report="vol"${data?.vol_report_id ? "" : " disabled"}>Fjern</button>
                </div>
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


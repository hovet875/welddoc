import type { ProjectRow } from "../../../../repo/projectRepo";
import { esc, qs } from "../../../../utils/dom";
import { openConfirmDelete } from "../../../../ui/confirm";
import { modalSaveButton, openModal, renderModal } from "../../../../ui/modal";
import { toast } from "../../../../ui/toast";
import { createPlaceholderProjectDrawing, fetchProjectDrawings } from "../../../../repo/projectDrawingRepo";
import { ensureProjectWeldLog } from "../../../../repo/weldLogRepo";
import { fetchWelderCerts, fetchWelders } from "../../../../repo/certRepo";
import { fetchWelderCertScopes } from "../../../../repo/welderCertScopeRepo";
import { fetchProjectTraceability, type ProjectTraceabilityRow } from "../../../../repo/traceabilityRepo";
import { fetchWpsData } from "../../../../repo/wpsRepo";
import { wireDatePickers } from "../../../../ui/datePicker";
import { bulkUpdate, createEmptyWeldRows, createWeld, deleteWelds, getWeldDetail, listEmployees, listNdtReports, listWelds, updateWeld } from "./api";
import type {
  BulkChangeField,
  DrawingOption,
  EmployeeOption,
  ListFilters,
  NdtReportRow,
  RowWpsStatus,
  TraceabilitySelectOption,
  WelderCertScopeOption,
  WelderMatchScopeRule,
  WpsSelectOption,
  WelderOption,
  WeldDetailRow,
  WeldListRow,
} from "./types";
import { VT_NO_REPORT_VALUE, renderDrawer, renderLayout, renderPagination, renderRows } from "./templates";
import { printWeldLogTable } from "./printView";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_STORAGE_KEY = "weldLogPageSize";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const defaultFilters: ListFilters = {
  status: "all",
};

const nextTick = () => new Promise((resolve) => requestAnimationFrame(resolve));

const emptyDetail = (): WeldDetailRow => ({
  id: "",
  sveis_id: "",
  fuge: "",
  komponent_a: "",
  komponent_a_id: null,
  komponent_b: "",
  komponent_b_id: null,
  sveiser_id: "",
  welder_cert_id: null,
  wps: "",
  wps_id: null,
  dato: "",
  tilsett: "",
  tilsett_id: null,
  vt_report_id: null,
  pt_report_id: null,
  vol_report_id: null,
  status: false,
  kontrollert_av: "",
  updated_at: "",
});

export async function renderProjectWeldLogSection(opts: {
  app: HTMLElement;
  mount: HTMLElement;
  modalMount: HTMLElement;
  project: ProjectRow;
  isAdmin: boolean;
  signal: AbortSignal;
}) {
  const { app, mount, modalMount, project, signal } = opts;
  const savedPageSize = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || "");
  const initialPageSize = PAGE_SIZE_OPTIONS.includes(savedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? savedPageSize
    : DEFAULT_PAGE_SIZE;
  localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(initialPageSize));

  const state = {
    rows: [] as WeldListRow[],
    total: 0,
    page: 0,
    pageSize: initialPageSize,
    orderBy: "weld_no" as const,
    orderDir: "asc" as const,
    filters: { ...defaultFilters },
    selected: new Set<string>(),
    drawerOpen: false,
    drawerLoading: false,
    drawerErrors: {} as Record<string, string>,
    drawerDirty: false,
    drawerData: null as WeldDetailRow | null,
    drawerVtNoReportSelected: false,
    drawerFocusReturn: null as HTMLElement | null,
    reports: [] as NdtReportRow[],
    drawings: [] as DrawingOption[],
    currentDrawingId: null as string | null,
    currentLogId: null as string | null,
    welders: [] as WelderOption[],
    welderCerts: [] as WelderCertScopeOption[],
    welderMatchScopes: [] as WelderMatchScopeRule[],
    employees: [] as EmployeeOption[],
    bulkChangeField: "" as BulkChangeField | "",
    bulkChangeValue: "",
    bulkVtNoReport: false,
    bulkVtInspectorId: "",
    jointTypes: [] as string[],
    componentOptions: [] as TraceabilitySelectOption[],
    fillerOptions: [] as TraceabilitySelectOption[],
    wpsOptions: [] as WpsSelectOption[],
  };

  const normalizeText = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();
  const normalizeJointType = (value: string | null | undefined) => String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const normalizeFmGroup = (value: string | null | undefined) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s._-]+/g, "");
  const normalizeStandard = (value: string | null | undefined) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\((?:19|20)\d{2}\)\s*$/, "")
      .replace(/[:/-]\s*(?:19|20)\d{2}\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  const extractStandardCore = (value: string | null | undefined) => {
    const normalized = normalizeStandard(value);
    if (!normalized) return "";
    const match = normalized.match(/\b(\d{3,5}\s*-\s*\d{1,3})\b/);
    if (!match) return "";
    return match[1].replace(/\s+/g, "");
  };
  const standardsMatch = (a: string | null | undefined, b: string | null | undefined) => {
    const leftCore = extractStandardCore(a);
    const rightCore = extractStandardCore(b);
    if (leftCore && rightCore) return leftCore === rightCore;
    const left = normalizeStandard(a);
    const right = normalizeStandard(b);
    if (!left || !right) return false;
    if (left === right) return true;
    return left.replace(/\s+/g, "") === right.replace(/\s+/g, "");
  };
  const normalizeProcessCode = (value: string | null | undefined) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const stripLeadingZeros = (code: string) => code.replace(/^0+(?=\d)/, "");
    const direct = raw.match(/^([0-9]{2,4})(?:\s*-\s*.*)?$/);
    if (direct) return stripLeadingZeros(direct[1]);
    const embedded = raw.match(/\b([0-9]{2,4})\b/);
    if (embedded) return stripLeadingZeros(embedded[1]);
    return raw.toUpperCase();
  };

  const parseDateOnly = (value: string | null | undefined) => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
    if (!match) return null;
    const [, yyyy, mm, dd] = match;
    const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0));
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const componentMaterialIds = (komponentAId: string | null | undefined, komponentBId: string | null | undefined) =>
    new Set(
      [komponentAId, komponentBId]
        .map((id) => state.componentOptions.find((row) => row.id === id)?.material_id ?? null)
        .filter((id): id is string => Boolean(id))
    );

  const certJointTypes = (coverageJointType: string | null | undefined) =>
    new Set(
      String(coverageJointType ?? "")
        .split(/[;,/]+/)
        .map((value) => normalizeJointType(value))
        .filter(Boolean)
    );

  const isCertExpiredAt = (expiresAt: string | null | undefined, referenceDate: Date) => {
    const expires = parseDateOnly(expiresAt);
    if (!expires) return false;
    return expires.getTime() < referenceDate.getTime();
  };

  const resolveWelderCertForScope = (input: {
    welderId: string;
    wpsId: string | null | undefined;
    fuge: string | null | undefined;
    komponentAId: string | null | undefined;
    komponentBId: string | null | undefined;
    weldDate: string | null | undefined;
  }) => {
    const welderId = String(input.welderId ?? "").trim();
    if (!welderId) return null;

    const wpsId = String(input.wpsId ?? "").trim();
    if (!wpsId) return null;
    const selectedWps = state.wpsOptions.find((row) => row.id === wpsId);
    if (!selectedWps) return null;

    const processCode = normalizeProcessCode(selectedWps.process);
    const jointType = normalizeJointType(input.fuge);
    const materialIds = componentMaterialIds(input.komponentAId, input.komponentBId);
    if (!processCode || !jointType || !materialIds.size) return null;

    const hasScopeConfig = state.welderMatchScopes.length > 0;
    const matchingScopes = state.welderMatchScopes.filter((scope) => {
      if (normalizeProcessCode(scope.welding_process_code) && normalizeProcessCode(scope.welding_process_code) !== processCode) return false;
      if (normalizeJointType(scope.joint_type) && normalizeJointType(scope.joint_type) !== jointType) return false;
      const scopeMaterialId = String(scope.material_id ?? "").trim();
      if (scopeMaterialId && !materialIds.has(scopeMaterialId)) return false;
      return true;
    });

    const certMatchesScope = (cert: WelderCertScopeOption, scope: WelderMatchScopeRule) => {
      if (normalizeText(scope.standard_label) && !standardsMatch(cert.standard, scope.standard_label)) return false;
      if (
        normalizeProcessCode(scope.welding_process_code) &&
        normalizeProcessCode(cert.welding_process_code) !== normalizeProcessCode(scope.welding_process_code)
      ) {
        return false;
      }
      const scopeMaterialId = String(scope.material_id ?? "").trim();
      if (scopeMaterialId && String(cert.base_material_id ?? "").trim() !== scopeMaterialId) return false;
      const scopeJoint = normalizeJointType(scope.joint_type);
      if (scopeJoint) {
        const joints = certJointTypes(cert.coverage_joint_type);
        if (!joints.has(scopeJoint)) return false;
      }
      const scopeFmGroup = normalizeText(scope.fm_group_label);
      if (scopeFmGroup && normalizeFmGroup(cert.fm_group) !== normalizeFmGroup(scope.fm_group_label)) return false;
      return true;
    };

    const certMatchesDirectContext = (cert: WelderCertScopeOption) => {
      if (!standardsMatch(cert.standard, selectedWps.standard_label)) return false;
      if (normalizeProcessCode(cert.welding_process_code) !== processCode) return false;
      const certMaterialId = String(cert.base_material_id ?? "").trim();
      if (certMaterialId && !materialIds.has(certMaterialId)) return false;
      const joints = certJointTypes(cert.coverage_joint_type);
      if (joints.size > 0 && !joints.has(jointType)) return false;
      return true;
    };

    const referenceDate = parseDateOnly(input.weldDate) ?? parseDateOnly(new Date().toISOString()) ?? new Date();
    const candidates = state.welderCerts
      .filter((cert) => String(cert.profile_id ?? "").trim() === welderId)
      .filter((cert) => !isCertExpiredAt(cert.expires_at, referenceDate))
      .map((cert) => {
        const matchesScope = matchingScopes.length ? matchingScopes.filter((scope) => certMatchesScope(cert, scope)) : [];
        if (matchingScopes.length > 0 && matchesScope.length === 0) return null;
        if (matchingScopes.length === 0 && hasScopeConfig) return null;
        if (matchingScopes.length === 0 && !certMatchesDirectContext(cert)) return null;

        const joints = certJointTypes(cert.coverage_joint_type);
        const fmGroup = normalizeText(cert.fm_group);
        const expiresAtTs = parseDateOnly(cert.expires_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const createdAtTs = Number(new Date(cert.created_at).getTime()) || 0;
        const bestScopeSpecificity = matchesScope.reduce((best, scope) => {
          let score = 0;
          if (normalizeText(scope.standard_label)) score += 4;
          if (normalizeProcessCode(scope.welding_process_code)) score += 3;
          if (String(scope.material_id ?? "").trim()) score += 3;
          if (normalizeJointType(scope.joint_type)) score += 2;
          if (normalizeText(scope.fm_group_label)) score += 2;
          return Math.max(best, score);
        }, 0);
        let score = 0;
        score += bestScopeSpecificity;
        if (String(cert.base_material_id ?? "").trim()) score += 3;
        if (joints.size > 0) score += 2;
        if (fmGroup && fmGroup !== "n/a") score += 1;
        return { cert, score, expiresAtTs, createdAtTs };
      })
      .filter((entry): entry is { cert: WelderCertScopeOption; score: number; expiresAtTs: number; createdAtTs: number } => Boolean(entry))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.expiresAtTs !== a.expiresAtTs) return b.expiresAtTs - a.expiresAtTs;
        if (b.createdAtTs !== a.createdAtTs) return b.createdAtTs - a.createdAtTs;
        return String(a.cert.certificate_no ?? "").localeCompare(String(b.cert.certificate_no ?? ""), "nb", { sensitivity: "base" });
      });

    return candidates[0]?.cert.id ?? null;
  };

  const wpsOptionsForSelection = (
    fugeValue: string | null | undefined,
    komponentAId: string | null | undefined,
    komponentBId: string | null | undefined
  ) => {
    const fuge = String(fugeValue ?? "").trim();
    const materialIds = componentMaterialIds(komponentAId, komponentBId);

    if (!fuge || !materialIds.size) {
      return { fuge, materialIds, options: [] as WpsSelectOption[] };
    }

    const options = state.wpsOptions.filter(
      (row) => Boolean(row.material_id && materialIds.has(row.material_id)) && normalizeText(row.fuge) === normalizeText(fuge)
    );
    return { fuge, materialIds, options };
  };

  const drawerWpsOptions = (data: WeldDetailRow | null) => {
    const fuge = String(data?.fuge ?? "").trim();
    if (!fuge) {
      return { options: [] as WpsSelectOption[], placeholder: "Velg fugetype først...", disabled: true };
    }
    const { materialIds, options } = wpsOptionsForSelection(data?.fuge, data?.komponent_a_id, data?.komponent_b_id);
    if (!materialIds.size) {
      return { options: [] as WpsSelectOption[], placeholder: "Velg komponent A/B med materiale først...", disabled: true };
    }
    if (!options.length) {
      return { options: [] as WpsSelectOption[], placeholder: "Ingen WPS matcher valgt materiale/fugetype", disabled: false };
    }
    return { options, placeholder: "Velg WPS...", disabled: false };
  };

  const ensureDrawerWpsSelectionMatches = () => {
    if (!state.drawerData) return;
    const current = state.drawerData.wps_id;
    if (!current) return;
    const { options } = drawerWpsOptions(state.drawerData);
    if (options.some((row) => row.id === current)) return;
    state.drawerData = { ...state.drawerData, wps_id: null, wps: "" };
  };

  const autoSelectDrawerWpsIfSingle = () => {
    if (!state.drawerData) return;
    const { options } = drawerWpsOptions(state.drawerData);
    if (options.length !== 1) return;
    const only = options[0];
    if (state.drawerData.wps_id === only.id) return;
    state.drawerData = { ...state.drawerData, wps_id: only.id, wps: only.doc_no };
  };

  const certStatusForRow = (row: WeldListRow): RowWpsStatus => {
    const selectedCertId = String(row.welder_cert_id ?? "").trim();
    if (selectedCertId) {
      const selectedCertNo = String(state.welderCerts.find((cert) => cert.id === selectedCertId)?.certificate_no ?? "").trim();
      return {
        tone: "ok",
        symbol: "&#10003;",
        title: selectedCertNo ? `Sertifikat valgt: ${selectedCertNo}` : "Sertifikat valgt",
      };
    }

    const welderId = String(row.sveiser_id ?? "").trim();
    if (!welderId) {
      return {
        tone: "danger",
        symbol: "&#10005;",
        title: "Ingen sveiser valgt. Mangler sertifikat.",
      };
    }

    const candidateCertId = resolveWelderCertForScope({
      welderId,
      wpsId: row.wps_id,
      fuge: row.fuge,
      komponentAId: row.komponent_a_id,
      komponentBId: row.komponent_b_id,
      weldDate: row.dato,
    });

    if (candidateCertId) {
      const candidateCertNo = String(state.welderCerts.find((cert) => cert.id === candidateCertId)?.certificate_no ?? "").trim();
      return {
        tone: "warn",
        symbol: "!",
        title: candidateCertNo
          ? `Sertifikatmatch funnet (${candidateCertNo}). Lagre raden for å knytte sertifikat.`
          : "Sertifikatmatch funnet. Lagre raden for å knytte sertifikat.",
      };
    }

    return {
      tone: "danger",
      symbol: "&#10005;",
      title: "Ingen sertifikatmatch funnet.",
    };
  };

  const wpsStatusForRow = (row: WeldListRow): RowWpsStatus => {
    const selectedWpsId = String(row.wps_id ?? "").trim();
    const selectedWpsDoc = String(row.wps ?? "").trim();
    const selected = selectedWpsDoc || selectedWpsId;
    const { options } = wpsOptionsForSelection(row.fuge, row.komponent_a_id, row.komponent_b_id);

    if (selected) {
      return {
        tone: "ok",
        symbol: "&#10003;",
        title: selectedWpsDoc ? `WPS valgt: ${selectedWpsDoc}` : "WPS valgt",
      };
    }

    if (options.length > 1) {
      return {
        tone: "warn",
        symbol: "!",
        title: `${options.length} WPS-forslag funnet. Velg en WPS.`,
      };
    }

    if (options.length === 1) {
      return {
        tone: "warn",
        symbol: "!",
        title: `1 WPS-forslag funnet (${options[0].doc_no}). Velg WPS.`,
      };
    }

    return {
      tone: "danger",
      symbol: "&#10005;",
      title: "Ingen WPS-match. Mangler WPS.",
    };
  };

  const render = () => {
    mount.innerHTML = renderLayout(
      state.filters,
      state.pageSize,
      state.drawings,
      state.currentDrawingId,
      state.bulkChangeField,
      state.bulkChangeValue,
      state.bulkVtNoReport,
      state.bulkVtInspectorId,
      state.reports,
      state.welders,
      state.employees,
      state.fillerOptions,
      state.jointTypes
    );
    const body = qs<HTMLElement>(mount, "[data-weld-body]");
    const certStatusByRow = new Map<string, RowWpsStatus>();
    const wpsStatusByRow = new Map<string, RowWpsStatus>();
    state.rows.forEach((row) => certStatusByRow.set(row.id, certStatusForRow(row)));
    state.rows.forEach((row) => wpsStatusByRow.set(row.id, wpsStatusForRow(row)));
    body.innerHTML = renderRows(state.rows, state.selected, certStatusByRow, wpsStatusByRow);
    const pagination = qs<HTMLElement>(mount, "[data-weld-pagination]");
    pagination.innerHTML = renderPagination(state.page, state.pageSize, state.total);
    const drawerRoot = qs<HTMLElement>(mount, "[data-weld-drawer-root]");
    const wpsState = drawerWpsOptions(state.drawerData);
    drawerRoot.innerHTML = renderDrawer(
      state.drawerData,
      state.reports,
      state.welders,
      state.employees,
      state.jointTypes,
      state.componentOptions,
      state.fillerOptions,
      wpsState.options,
      wpsState.placeholder,
      wpsState.disabled,
      state.drawerVtNoReportSelected,
      state.drawerOpen,
      state.drawerErrors,
      state.drawerLoading
    );
    updateBulkBar();
    wireDrawerFocus();
  };

  const updateBulkBar = () => {
    const bulkBar = mount.querySelector<HTMLElement>("[data-weld-bulkbar]");
    if (!bulkBar) return;
    const count = state.selected.size;
    bulkBar.hidden = count === 0;
    const countEl = bulkBar.querySelector<HTMLElement>("[data-bulk-count]");
    if (countEl) countEl.textContent = `${count} valgt`;
    const selectAll = mount.querySelector<HTMLInputElement>("[data-select-all]");
    if (selectAll) {
      const totalRows = state.rows.length;
      const allSelected = totalRows > 0 && count === totalRows;
      const someSelected = count > 0 && count < totalRows;
      selectAll.checked = allSelected;
      selectAll.indeterminate = someSelected;
      selectAll.disabled = totalRows === 0;
    }
  };

  const closeRowMenus = () => {
    const openMenus = mount.querySelectorAll<HTMLElement>("[data-row-menu-panel].is-open");
    openMenus.forEach((panel) => {
      panel.classList.remove("is-open", "is-floating");
      panel.style.removeProperty("left");
      panel.style.removeProperty("top");
    });
  };

  const positionRowMenu = (trigger: HTMLElement, panel: HTMLElement) => {
    panel.classList.add("is-floating");
    panel.style.left = "0px";
    panel.style.top = "0px";
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gap = 6;
    let left = triggerRect.right - panelRect.width;
    left = Math.max(8, Math.min(left, window.innerWidth - panelRect.width - 8));
    let top = triggerRect.bottom + gap;
    if (top + panelRect.height > window.innerHeight - 8) {
      top = Math.max(8, triggerRect.top - panelRect.height - gap);
    }
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  };

  const fetchList = async () => {
    try {
      const { rows, count } = await listWelds({
        page: state.page,
        pageSize: state.pageSize,
        filters: state.filters,
        orderBy: state.orderBy,
        orderDir: state.orderDir,
        logId: state.currentLogId,
      });
      state.rows = rows;
      state.total = count;
      state.selected.clear();
      render();
    } catch (e: any) {
      toast(String(e?.message ?? e));
    }
  };

  const fetchReports = async () => {
    try {
      state.reports = await listNdtReports({ projectNo: String(project.project_no ?? "").trim() });
    } catch (e: any) {
      toast(String(e?.message ?? e));
    }
  };

  const selectedDrawingLabel = () => {
    const drawing = state.drawings.find((row) => row.id === state.currentDrawingId);
    if (!drawing) return "-";
    const rev = String(drawing.revision ?? "-").trim().toUpperCase() || "-";
    return `${drawing.drawing_no} - Rev ${rev}`;
  };

  const fetchAllRowsForPrint = async () => {
    if (!state.currentLogId) return [] as WeldListRow[];
    const all: WeldListRow[] = [];
    const pageSize = 500;
    let page = 0;
    let total = Number.POSITIVE_INFINITY;

    while (all.length < total) {
      const result = await listWelds({
        page,
        pageSize,
        filters: { status: "all" },
        orderBy: "weld_no",
        orderDir: "asc",
        logId: state.currentLogId,
      });
      total = Number(result.count ?? 0);
      all.push(...result.rows);
      if (!result.rows.length || result.rows.length < pageSize) break;
      page += 1;
      if (page > 200) break;
    }

    return all;
  };

  const printTable = async () => {
    if (!state.currentLogId) {
      toast("Velg tegning for utskrift.");
      return;
    }
    try {
      const rows = await fetchAllRowsForPrint();
      await printWeldLogTable({
        rows,
        reports: state.reports,
        employees: state.employees,
        project,
        drawingLabel: selectedDrawingLabel(),
      });
    } catch (e: any) {
      toast(String(e?.message ?? e));
    }
  };

  const formatInfoDate = (value: string | null | undefined) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "-";
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
    if (!match) return raw;
    const [, yyyy, mm, dd] = match;
    return `${dd}.${mm}.${yyyy}`;
  };

  const infoValueHtml = (value: string | number | boolean | null | undefined) => {
    if (value == null) return `<span class="weld-info-empty">-</span>`;
    const text = String(value).trim();
    if (!text) return `<span class="weld-info-empty">-</span>`;
    return esc(text);
  };

  const infoRowHtml = (label: string, value: string | number | boolean | null | undefined) => {
    return `
      <div class="weld-info-row">
        <div class="weld-info-key">${esc(label)}</div>
        <div class="weld-info-val">${infoValueHtml(value)}</div>
      </div>
    `;
  };

  const resolveWelderLabel = (detail: WeldDetailRow) => {
    const detailNo = String(detail.sveiser?.welder_no ?? "").trim();
    const detailName = String(detail.sveiser?.display_name ?? "").trim();
    const detailLabel = [detailNo, detailName].filter(Boolean).join(" - ");
    if (detailLabel) return detailLabel;
    const id = String(detail.sveiser_id ?? "").trim();
    if (!id) return "";
    const fromState = state.welders.find((row) => row.id === id);
    const no = String(fromState?.welder_no ?? "").trim();
    const name = String(fromState?.display_name ?? "").trim();
    const stateLabel = [no, name].filter(Boolean).join(" - ");
    return stateLabel || id;
  };

  const resolveEmployeeLabel = (employeeId: string | null | undefined) => {
    const id = String(employeeId ?? "").trim();
    if (!id) return "";
    const employee = state.employees.find((row) => row.id === id);
    return employee?.label || id;
  };

  const resolveReportLabel = (reportId: string | null | undefined) => {
    const id = String(reportId ?? "").trim();
    if (!id) return "";
    const report = state.reports.find((row) => row.id === id);
    if (!report) return id;
    const no = String(report.report_no ?? "").trim() || id;
    const method = normalizeMethodCode(report.method);
    const date = formatInfoDate(report.date);
    return [no, method || "", date !== "-" ? date : ""].filter(Boolean).join(" | ");
  };

  const openInfoModal = async (rowId: string) => {
    try {
      const detail = await getWeldDetail(rowId);
      const titleId = String(detail.sveis_id ?? "").trim();
      const statusText = detail.status ? "Godkjent" : "Til kontroll";
      const statusClass = detail.status ? "is-ok" : "is-pending";
      const componentPair = [detail.komponent_a, detail.komponent_b]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(" \u2194 ");

      const bodyHtml = `
        <div class="weld-info-modal">
          <section class="weld-info-hero">
            <div class="weld-info-hero-main">
              <div class="weld-info-hero-title">Sveis ${infoValueHtml(detail.sveis_id)}</div>
              <div class="weld-info-hero-sub">${infoValueHtml(resolveWelderLabel(detail))}</div>
            </div>
            <span class="weld-info-pill ${statusClass}">${esc(statusText)}</span>
          </section>

          <section class="weld-info-section">
            <h3>Grunninfo</h3>
            <div class="weld-info-list">
              ${infoRowHtml("Status", statusText)}
              ${infoRowHtml("Dato", formatInfoDate(detail.dato))}
              ${infoRowHtml("Oppdatert", formatInfoDate(detail.updated_at))}
            </div>
          </section>

          <section class="weld-info-section">
            <h3>Produksjon</h3>
            <div class="weld-info-list">
              ${infoRowHtml("Fuge", detail.fuge)}
              ${infoRowHtml("WPS", detail.wps)}
              ${infoRowHtml("Komponent", componentPair)}
              ${infoRowHtml("Tilsett", detail.tilsett)}
            </div>
          </section>

          <section class="weld-info-section">
            <h3>NDT</h3>
            <div class="weld-info-list">
              ${infoRowHtml("Visuell rapport", resolveReportLabel(detail.vt_report_id))}
              ${infoRowHtml("Visuelt godkjent av", resolveEmployeeLabel(detail.kontrollert_av))}
              ${infoRowHtml("Sprekk rapport", resolveReportLabel(detail.pt_report_id))}
              ${infoRowHtml("RT/UT rapport", resolveReportLabel(detail.vol_report_id))}
            </div>
          </section>

          <details class="weld-info-tech">
            <summary>Vis tekniske ID-er</summary>
            <div class="weld-info-list weld-info-list-tech">
              ${infoRowHtml("rad_id", detail.id)}
              ${infoRowHtml("sveiser_id", detail.sveiser_id)}
              ${infoRowHtml("welder_cert_id", detail.welder_cert_id)}
              ${infoRowHtml("komponent_a_id", detail.komponent_a_id)}
              ${infoRowHtml("komponent_b_id", detail.komponent_b_id)}
              ${infoRowHtml("wps_id", detail.wps_id)}
              ${infoRowHtml("tilsett_id", detail.tilsett_id)}
              ${infoRowHtml("vt_report_id", detail.vt_report_id)}
              ${infoRowHtml("kontrollert_av", detail.kontrollert_av)}
              ${infoRowHtml("pt_report_id", detail.pt_report_id)}
              ${infoRowHtml("vol_report_id", detail.vol_report_id)}
            </div>
          </details>
        </div>
      `;

      const modalHtml = renderModal(`Vis informasjon${titleId ? ` - sveis ${titleId}` : ""}`, bodyHtml, "Lukk");
      const handle = openModal(modalMount, modalHtml, signal);
      const save = modalSaveButton(handle.root);
      save.classList.remove("accent");
      const cancel = handle.root.querySelector<HTMLButtonElement>("[data-modal-cancel]");
      cancel?.remove();
      save.addEventListener("click", () => handle.close(), { once: true });
    } catch (e: any) {
      toast(String(e?.message ?? e));
    }
  };

  const openDrawer = async (id: string, focusReturn?: HTMLElement) => {
    state.drawerOpen = true;
    state.drawerLoading = true;
    state.drawerErrors = {};
    state.drawerDirty = false;
    state.drawerVtNoReportSelected = false;
    state.drawerFocusReturn = focusReturn ?? null;
    state.drawerData = emptyDetail();
    render();

    try {
      const detail = await getWeldDetail(id);
      state.drawerData = detail;
      state.drawerVtNoReportSelected = !detail.vt_report_id && Boolean(String(detail.kontrollert_av ?? "").trim());
      ensureDrawerWpsSelectionMatches();
      autoSelectDrawerWpsIfSingle();
      state.drawerLoading = false;
      render();
      await nextTick();
      const closeBtn = mount.querySelector<HTMLElement>("[data-drawer-close]");
      closeBtn?.focus();
    } catch (e: any) {
      state.drawerLoading = false;
      toast(String(e?.message ?? e));
      render();
    }
  };

  const closeDrawer = () => {
    state.drawerOpen = false;
    state.drawerErrors = {};
    state.drawerVtNoReportSelected = false;
    render();
    state.drawerFocusReturn?.focus();
  };

  const normalizeWelderNo = (value: string) => value.replace(/^0+/, "");

  const resolveWelderId = (value: string) => {
    const raw = value.trim();
    if (!raw) return "";
    if (/^[0-9a-fA-F-]{36}$/.test(raw)) return raw;
    const match = state.welders.find((w) => {
      if (!w.welder_no) return false;
      return w.welder_no === raw || normalizeWelderNo(w.welder_no) === normalizeWelderNo(raw);
    });
    return match?.id ?? "";
  };

  const validateDrawer = (data: WeldDetailRow) => {
    const errors: Record<string, string> = {};
    if (!data.sveis_id) errors.sveis_id = "Sveis ID er påkrevd.";
    if (!data.fuge) errors.fuge = "Fuge er påkrevd.";
    if (!data.sveiser_id) errors.sveiser_id = "Sveiser er påkrevd.";
    if (!data.dato) errors.dato = "Dato er påkrevd.";
    return errors;
  };

  const applyDrawerPatch = (field: string, value: string | boolean | null) => {
    if (!state.drawerData) return;
    const next = { ...state.drawerData } as any;
    next[field] = value;
    state.drawerData = next;
    state.drawerDirty = true;
  };

  const normalizeMethodCode = (value: string | null | undefined) => String(value ?? "").trim().toUpperCase();

  const reportMatchesBulkField = (field: "vt" | "pt" | "vol", report: NdtReportRow) => {
    const methodCode = normalizeMethodCode(report.method);
    if (field === "vt") return methodCode === "VT";
    if (field === "pt") return methodCode === "PT" || methodCode === "MT";
    return methodCode === "RT" || methodCode === "UT";
  };

  const normalizeDateInput = (value: string) => {
    const raw = String(value ?? "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return "";
    return `${match[1]}-${match[2]}-${match[3]}`;
  };

  const resetBulkEditor = () => {
    state.bulkChangeField = "";
    state.bulkChangeValue = "";
    state.bulkVtNoReport = false;
    state.bulkVtInspectorId = "";
  };

  const traceCodeById = (list: TraceabilitySelectOption[], id: string | null | undefined) => {
    if (!id) return null;
    return list.find((row) => row.id === id)?.trace_code ?? null;
  };

  const wpsDocNoById = (id: string | null | undefined) => {
    if (!id) return null;
    return state.wpsOptions.find((row) => row.id === id)?.doc_no ?? null;
  };

  const saveDrawer = async () => {
    if (!state.drawerData) return;
    const errors = validateDrawer(state.drawerData);
    if (Object.keys(errors).length) {
      state.drawerErrors = errors;
      render();
      return;
    }

    const patch = { ...state.drawerData };
    const resolvedWelderId = resolveWelderId(String(patch.sveiser_id ?? ""));
    if (!resolvedWelderId) {
      state.drawerErrors = { ...state.drawerErrors, sveiser_id: "Ugyldig sveiser. Velg fra liste." };
      render();
      return;
    }
    patch.sveiser_id = resolvedWelderId;
    patch.welder_cert_id = resolveWelderCertForScope({
      welderId: resolvedWelderId,
      wpsId: patch.wps_id,
      fuge: patch.fuge,
      komponentAId: patch.komponent_a_id,
      komponentBId: patch.komponent_b_id,
      weldDate: patch.dato,
    });
    const visualInspectorId = String(patch.kontrollert_av ?? "").trim();
    if (visualInspectorId) {
      if (!state.employees.some((emp) => emp.id === visualInspectorId)) {
        state.drawerErrors = { ...state.drawerErrors, kontrollert_av: "Ugyldig ansatt valgt." };
        render();
        return;
      }
      if (visualInspectorId === resolvedWelderId) {
        state.drawerErrors = { ...state.drawerErrors, kontrollert_av: "Visuell godkjenner kan ikke være samme som sveiser." };
        render();
        return;
      }
    }
    const id = patch.id;
    const isNew = !id;

    if (!isNew) {
      const optimisticRows = state.rows.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          ...patch,
          komponent_a: traceCodeById(state.componentOptions, patch.komponent_a_id) ?? row.komponent_a,
          komponent_b: traceCodeById(state.componentOptions, patch.komponent_b_id) ?? row.komponent_b,
          tilsett: traceCodeById(state.fillerOptions, patch.tilsett_id) ?? row.tilsett,
          wps: wpsDocNoById(patch.wps_id) ?? row.wps,
        };
      });
      state.rows = optimisticRows as WeldListRow[];
      render();
    }

    try {
      if (isNew) {
        if (!state.currentLogId) {
          toast("Velg tegning for ny sveis.");
          return;
        }
        await createWeld({ logId: state.currentLogId, patch });
        toast("Sveis opprettet.");
      } else {
        await updateWeld(id, patch);
        toast("Sveis oppdatert.");
      }
      closeDrawer();
      fetchList();
    } catch (e: any) {
      toast(String(e?.message ?? e));
      fetchList();
    }
  };

  const bulkApprove = async () => {
    const ids = Array.from(state.selected);
    if (!ids.length) return;
    try {
      await bulkUpdate(ids, { status: true });
      toast("Valgte rader godkjent.");
      fetchList();
    } catch (e: any) {
      toast(String(e?.message ?? e));
    }
  };

  const bulkReview = async () => {
    const ids = Array.from(state.selected);
    if (!ids.length) return;
    try {
      await bulkUpdate(ids, { status: false });
      toast("Valgte rader satt til kontroll.");
      fetchList();
    } catch (e: any) {
      toast(String(e?.message ?? e));
    }
  };

  const bulkApplyChange = async () => {
    const ids = Array.from(state.selected);
    if (!ids.length) return;
    const field = state.bulkChangeField;
    if (!field) {
      toast("Velg hva du vil endre.");
      return;
    }

    const value = String(state.bulkChangeValue ?? "").trim();
    const patch: Partial<WeldDetailRow> = {};
    let successMessage = "Valgte rader oppdatert.";

    if (field === "fuge") {
      if (!value) {
        toast("Velg fugetype.");
        return;
      }
      patch.fuge = value;
      patch.welder_cert_id = null;
      successMessage = "Fugetype satt for valgte rader.";
    } else if (field === "sveiser") {
      const resolvedWelderId = resolveWelderId(value);
      if (!resolvedWelderId) {
        toast("Ugyldig sveiser valgt.");
        return;
      }
      patch.sveiser_id = resolvedWelderId;
      patch.welder_cert_id = null;
      successMessage = "Sveiser satt for valgte rader.";
    } else if (field === "dato") {
      const nextDate = normalizeDateInput(value);
      if (!nextDate) {
        toast("Velg gyldig dato.");
        return;
      }
      patch.dato = nextDate;
      successMessage = "Dato satt for valgte rader.";
    } else if (field === "tilsett") {
      if (!value) {
        toast("Velg tilsett.");
        return;
      }
      if (!state.fillerOptions.some((row) => row.id === value)) {
        toast("Ugyldig tilsett valgt.");
        return;
      }
      patch.tilsett_id = value;
      successMessage = "Tilsett satt for valgte rader.";
    } else if (field === "vt") {
      const useInspector = state.bulkVtNoReport || value === VT_NO_REPORT_VALUE;
      if (useInspector) {
        const inspectorId = String(state.bulkVtInspectorId ?? "").trim();
        if (!inspectorId) {
          toast("Velg intern godkjenner.");
          return;
        }
        if (!state.employees.some((emp) => emp.id === inspectorId)) {
          toast("Ugyldig intern godkjenner valgt.");
          return;
        }
        const hasConflict = state.rows.some((row) => ids.includes(row.id) && String(row.sveiser_id ?? "").trim() === inspectorId);
        if (hasConflict) {
          toast("Intern godkjenner kan ikke være samme person som sveiser på valgt rad.");
          return;
        }
        patch.vt_report_id = null;
        patch.kontrollert_av = inspectorId;
        successMessage = "Intern VT-godkjenner satt for valgte rader.";
      } else {
        if (!value) {
          toast("Velg visuell rapport.");
          return;
        }
        const report = state.reports.find((row) => row.id === value && reportMatchesBulkField("vt", row));
        if (!report) {
          toast("Ugyldig visuell rapport valgt.");
          return;
        }
        patch.vt_report_id = report.id;
        patch.kontrollert_av = null;
        successMessage = "Visuell rapport satt for valgte rader.";
      }
    } else if (field === "pt") {
      if (!value) {
        toast("Velg sprekkrapport.");
        return;
      }
      const report = state.reports.find((row) => row.id === value && reportMatchesBulkField("pt", row));
      if (!report) {
        toast("Ugyldig sprekkrapport valgt.");
        return;
      }
      patch.pt_report_id = report.id;
      successMessage = "Sprekkrapport satt for valgte rader.";
    } else if (field === "vol") {
      if (!value) {
        toast("Velg volumetrisk rapport.");
        return;
      }
      const report = state.reports.find((row) => row.id === value && reportMatchesBulkField("vol", row));
      if (!report) {
        toast("Ugyldig volumetrisk rapport valgt.");
        return;
      }
      patch.vol_report_id = report.id;
      successMessage = "Volumetrisk rapport satt for valgte rader.";
    }

    try {
      await bulkUpdate(ids, patch);
      toast(successMessage);
      resetBulkEditor();
      await fetchList();
    } catch (e: any) {
      toast(String(e?.message ?? e));
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(state.selected);
    if (!ids.length) return;
    await openConfirmDelete(modalMount, signal, {
      title: "Slett valgte",
      messageHtml: `Slett ${esc(String(ids.length))} valgte rader?`,
      onConfirm: async () => deleteWelds(ids),
      onDone: async () => {
        toast("Rader slettet.");
        fetchList();
      },
    });
  };

  const handleRowAction = async (rowId: string, action: string) => {
    if (action === "info") {
      await openInfoModal(rowId);
      return;
    }
    if (action === "delete") {
      await openConfirmDelete(modalMount, signal, {
        title: "Slett sveis",
        messageHtml: "Slett valgt sveis?",
        onConfirm: async () => deleteWelds([rowId]),
        onDone: async () => fetchList(),
      });
      return;
    }
  };

  const openNewWeld = (focusReturn?: HTMLElement) => {
    const today = new Date().toISOString().slice(0, 10);
    state.drawerOpen = true;
    state.drawerLoading = false;
    state.drawerErrors = {};
    state.drawerDirty = false;
    state.drawerVtNoReportSelected = false;
    state.drawerFocusReturn = focusReturn ?? null;
    state.drawerData = { ...emptyDetail(), dato: today };
    render();
    nextTick().then(() => {
      const closeBtn = mount.querySelector<HTMLElement>("[data-drawer-close]");
      closeBtn?.focus();
    });
  };

  const openBulkAddModal = (focusReturn?: HTMLElement) => {
    if (!state.currentLogId) {
      toast("Velg tegning først.");
      return;
    }

    const modalHtml = renderModal(
      "Bulk legg til sveiser",
      `
        <div class="modalgrid">
          <div class="field">
            <label for="bulk-weld-count">Antall tomme rader</label>
            <input id="bulk-weld-count" class="input" type="number" min="1" max="200" step="1" value="20" data-bulk-weld-count />
          </div>
          <div class="field">
            <label>Neste sveis-ID blir brukt automatisk</label>
            <div class="muted">Radene opprettes med stigende Sveis ID og tomt innhold.</div>
          </div>
        </div>
      `,
      "Opprett"
    );
    const handle = openModal(modalMount, modalHtml, signal);
    const save = modalSaveButton(handle.root);
    const input = handle.root.querySelector<HTMLInputElement>("[data-bulk-weld-count]");

    nextTick().then(() => {
      input?.focus();
      input?.select();
    });

    save.addEventListener(
      "click",
      async () => {
        const count = Math.trunc(Number(input?.value ?? 0));
        if (!Number.isFinite(count) || count < 1 || count > 200) {
          toast("Velg et antall mellom 1 og 200.");
          input?.focus();
          return;
        }
        if (!state.currentLogId) {
          toast("Velg tegning først.");
          return;
        }

        save.disabled = true;
        const originalText = save.textContent;
        save.textContent = "Oppretter...";
        try {
          const created = await createEmptyWeldRows({ logId: state.currentLogId, count });
          handle.close();
          if (state.filters.status !== "true") {
            const projectedTotal = state.total + created.count;
            state.page = Math.max(0, Math.ceil(projectedTotal / state.pageSize) - 1);
          }
          await fetchList();
          toast(
            `Opprettet ${created.count} tomme rader (Sveis ID ${created.firstWeldNo}-${created.lastWeldNo}).`
          );
          focusReturn?.focus();
        } catch (e: any) {
          toast(String(e?.message ?? e));
          save.disabled = false;
          save.textContent = originalText || "Opprett";
        }
      },
      { signal }
    );
  };

  const loadDrawings = async () => {
    let rows = await fetchProjectDrawings(project.id);
    if (!rows.length) {
      const projectNo = String(project.project_no ?? "").trim();
      const defaultBase = projectNo || "PROSJEKT";
      await createPlaceholderProjectDrawing({ project_id: project.id, drawing_no: `${defaultBase}001`, revision: "-" });
      rows = await fetchProjectDrawings(project.id);
    }
    state.drawings = rows.map((d) => ({ id: d.id, drawing_no: d.drawing_no, revision: d.revision }));
    state.currentDrawingId = state.drawings[0]?.id ?? null;
    if (state.currentDrawingId) {
      state.currentLogId = await ensureProjectWeldLog(project.id, state.currentDrawingId);
    }
  };

  const traceHeat = (row: ProjectTraceabilityRow) => {
    const direct = String(row.heat_number ?? "").trim();
    if (direct) return direct;
    const certHeat = row.cert?.heat_numbers ?? [];
    return String(certHeat.find((v) => String(v || "").trim()) ?? "").trim();
  };

  const traceCode = (row: ProjectTraceabilityRow) => {
    const idx = row.code_index ?? "";
    return `${row.type_code}${idx}`;
  };

  const toTraceabilityOption = (row: ProjectTraceabilityRow): TraceabilitySelectOption => {
    const code = traceCode(row);
    const dn = String(row.dn ?? "").trim();
    const heat = traceHeat(row);
    const labelParts = [code, dn ? `DN${dn}` : "", heat];
    return {
      id: row.id,
      trace_code: code,
      material_id: row.material_id ?? null,
      dn: dn || null,
      heat_number: heat || null,
      label: labelParts.filter(Boolean).join(" - "),
    };
  };

  const loadTraceabilityOptions = async () => {
    try {
      const rows = await fetchProjectTraceability(project.id);
      const componentRows = rows.filter((row) => row.cert?.certificate_type !== "filler" && !row.type?.use_filler_type);
      const fillerRows = rows.filter(
        (row) => row.cert?.certificate_type === "filler" || row.type?.use_filler_type || Boolean(String(row.filler_type ?? "").trim())
      );
      const sortOptions = (a: TraceabilitySelectOption, b: TraceabilitySelectOption) =>
        a.label.localeCompare(b.label, "nb", { sensitivity: "base", numeric: true });
      state.componentOptions = componentRows.map(toTraceabilityOption).sort(sortOptions);
      state.fillerOptions = fillerRows.map(toTraceabilityOption).sort(sortOptions);
    } catch (e: any) {
      state.componentOptions = [];
      state.fillerOptions = [];
      toast(String(e?.message ?? e));
    }
  };

  const loadWpsOptions = async () => {
    try {
      const { wps } = await fetchWpsData();
      state.wpsOptions = wps
        .map((row) => ({
          id: row.id,
          doc_no: row.doc_no,
          process: row.process ?? null,
          standard_label: row.standard?.label ?? null,
          material_id: row.material_id ?? row.material?.id ?? null,
          fuge: row.fuge ?? "",
          label: row.doc_no,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base", numeric: true }));
    } catch (e: any) {
      state.wpsOptions = [];
      toast(String(e?.message ?? e));
    }
  };

  const loadWelders = async () => {
    try {
      const scopePromise = fetchWelderCertScopes().catch(() => [] as Awaited<ReturnType<typeof fetchWelderCertScopes>>);
      const [rows, certs, scopes] = await Promise.all([fetchWelders(), fetchWelderCerts(), scopePromise]);
      state.welders = rows.map((w) => ({ id: w.id, welder_no: w.welder_no, display_name: w.display_name }));
      state.welderCerts = certs.map((cert) => ({
        id: cert.id,
        profile_id: cert.profile_id,
        certificate_no: cert.certificate_no,
        standard: cert.standard,
        welding_process_code: cert.welding_process_code ?? null,
        base_material_id: cert.base_material_id ?? null,
        coverage_joint_type: cert.coverage_joint_type ?? null,
        fm_group: cert.fm_group ?? null,
        expires_at: cert.expires_at ?? null,
        created_at: cert.created_at,
      }));
      state.welderMatchScopes = scopes.map((scope) => ({
        id: scope.id,
        standard_label: scope.standard?.label ?? null,
        fm_group_label: scope.fm_group?.label ?? null,
        material_id: scope.material_id ?? null,
        welding_process_code: scope.welding_process_code ?? null,
        joint_type: scope.joint_type ?? null,
      }));
      const jointTypeSet = new Set<string>();
      certs.forEach((cert) => {
        (cert.coverage_joint_type || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .forEach((v) => jointTypeSet.add(v));
      });
      state.jointTypes = Array.from(jointTypeSet).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
    } catch (e: any) {
      state.welders = [];
      state.welderCerts = [];
      state.welderMatchScopes = [];
      state.jointTypes = [];
      toast(String(e?.message ?? e));
    }
  };

  const loadEmployees = async () => {
    try {
      state.employees = await listEmployees();
    } catch (e: any) {
      state.employees = [];
      toast(String(e?.message ?? e));
    }
  };

  const wireDrawerFocus = () => {
    if (!state.drawerOpen) return;
    const drawer = mount.querySelector<HTMLElement>("[data-drawer]");
    if (!drawer) return;
    const focusable = Array.from(drawer.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"));
    if (!focusable.length) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDrawer();
        return;
      }
      if (e.key !== "Tab") return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    drawer.addEventListener("keydown", handleKey, { signal });
  };

  mount.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-row-menu]") && !target.closest("[data-row-menu-panel]")) {
        closeRowMenus();
      }
      const selectAll = target.closest<HTMLInputElement>("[data-select-all]");
      if (selectAll) {
        const checked = selectAll.checked;
        state.selected = checked ? new Set(state.rows.map((r) => r.id)) : new Set();
        render();
        return;
      }

      const selectAllCell = target.closest<HTMLElement>("thead th.select-col");
      if (selectAllCell && !target.closest("[data-select-all]")) {
        const selectAllInput = selectAllCell.querySelector<HTMLInputElement>("[data-select-all]");
        if (selectAllInput) {
          const checked = !selectAllInput.checked || selectAllInput.indeterminate;
          selectAllInput.indeterminate = false;
          selectAllInput.checked = checked;
          state.selected = checked ? new Set(state.rows.map((r) => r.id)) : new Set();
          render();
        }
        return;
      }

      const rowSelect = target.closest<HTMLInputElement>("[data-row-select]");
      if (rowSelect) {
        if (rowSelect.checked) state.selected.add(rowSelect.value);
        else state.selected.delete(rowSelect.value);
        updateBulkBar();
        return;
      }

      const rowSelectCell = target.closest<HTMLElement>("tbody td.select-col");
      if (rowSelectCell && !target.closest("[data-row-select]")) {
        const row = rowSelectCell.closest<HTMLElement>("[data-row-id]");
        const input = rowSelectCell.querySelector<HTMLInputElement>("[data-row-select]");
        if (row && input) {
          const checked = !input.checked;
          input.checked = checked;
          const rowId = input.value || row.getAttribute("data-row-id") || "";
          if (rowId) {
            if (checked) state.selected.add(rowId);
            else state.selected.delete(rowId);
          }
          updateBulkBar();
        }
        return;
      }

      const rowIdCell = target.closest<HTMLElement>("tbody td.id-col");
      if (rowIdCell) {
        const row = rowIdCell.closest<HTMLElement>("[data-row-id]");
        const input = row?.querySelector<HTMLInputElement>("[data-row-select]");
        if (row && input) {
          const checked = !input.checked;
          input.checked = checked;
          const rowId = input.value || row.getAttribute("data-row-id") || "";
          if (rowId) {
            if (checked) state.selected.add(rowId);
            else state.selected.delete(rowId);
          }
          updateBulkBar();
        }
        return;
      }

      const rowMenu = target.closest<HTMLElement>("[data-row-menu]");
      if (rowMenu) {
        const panel = rowMenu.parentElement?.querySelector<HTMLElement>("[data-row-menu-panel]");
        if (panel) {
          const willOpen = !panel.classList.contains("is-open");
          closeRowMenus();
          if (willOpen) {
            panel.classList.add("is-open");
            positionRowMenu(rowMenu, panel);
          }
        }
        return;
      }

      const rowAction = target.closest<HTMLElement>("[data-row-action]");
      if (rowAction) {
        closeRowMenus();
        const action = rowAction.getAttribute("data-row-action") || "";
        const row = rowAction.closest<HTMLElement>("[data-row-id]");
        if (row) handleRowAction(row.getAttribute("data-row-id") || "", action);
        return;
      }

      const clearReport = target.closest<HTMLElement>("[data-clear-report]");
      if (clearReport && state.drawerOpen) {
        const method = (clearReport.getAttribute("data-clear-report") || "").trim();
        if (method === "vt") {
          state.drawerVtNoReportSelected = true;
          applyDrawerPatch("vt_report_id", null);
          render();
        } else if (method === "pt" || method === "vol") {
          applyDrawerPatch(`${method}_report_id`, null);
          render();
        }
        return;
      }

      const row = target.closest<HTMLElement>("[data-row-id]");
      if (row && !target.closest("button")) {
        closeRowMenus();
        openDrawer(row.getAttribute("data-row-id") || "", row);
        return;
      }

      const newBtn = target.closest<HTMLElement>("[data-weld-new]");
      if (newBtn) {
        openNewWeld(newBtn);
        return;
      }

      const bulkAddBtn = target.closest<HTMLElement>("[data-weld-bulk-add]");
      if (bulkAddBtn) {
        openBulkAddModal(bulkAddBtn);
        return;
      }

      const closeBtn = target.closest<HTMLElement>("[data-drawer-close]");
      if (closeBtn) {
        closeDrawer();
        return;
      }

      const cancelBtn = target.closest<HTMLElement>("[data-drawer-cancel]");
      if (cancelBtn) {
        closeDrawer();
        return;
      }

      const saveBtn = target.closest<HTMLElement>("[data-drawer-save]");
      if (saveBtn) {
        saveDrawer();
        return;
      }

      const backdrop = target.closest<HTMLElement>("[data-drawer-backdrop]");
      if (backdrop) closeDrawer();

      const bulkApproveBtn = target.closest<HTMLElement>("[data-bulk-approve]");
      if (bulkApproveBtn) bulkApprove();

      const bulkReviewBtn = target.closest<HTMLElement>("[data-bulk-review]");
      if (bulkReviewBtn) bulkReview();

      const bulkDeleteBtn = target.closest<HTMLElement>("[data-bulk-delete]");
      if (bulkDeleteBtn) bulkDelete();
      const bulkApplyBtn = target.closest<HTMLElement>("[data-bulk-apply]");
      if (bulkApplyBtn) {
        bulkApplyChange();
        return;
      }
    },
    { signal }
  );

  mount.addEventListener(
    "keydown",
    (e) => {
      const target = e.target as HTMLElement;
      const row = target.closest<HTMLElement>("[data-row-id]");
      if (row && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        openDrawer(row.getAttribute("data-row-id") || "", row);
      }
    },
    { signal }
  );

  mount.addEventListener(
    "input",
    (e) => {
      const target = e.target as HTMLElement;
      if (!state.drawerOpen || !state.drawerData) return;
      const field = target.getAttribute("data-f") || "";
      if (!field) return;
      if (field === "vt_report_id" || field === "pt_report_id" || field === "vol_report_id") return;
      const input = target as HTMLInputElement;
      applyDrawerPatch(field, input.type === "checkbox" ? input.checked : input.value);
    },
    { signal }
  );

  mount.addEventListener(
    "change",
    async (e) => {
      const target = e.target as HTMLElement;
      const drawingSelect = target.closest<HTMLSelectElement>("[data-weld-drawing]");
      if (drawingSelect) {
        state.currentDrawingId = drawingSelect.value || null;
        state.currentLogId = state.currentDrawingId
          ? await ensureProjectWeldLog(project.id, state.currentDrawingId)
          : null;
        fetchList();
        return;
      }
      const statusFilter = target.closest<HTMLSelectElement>("[data-filter-status]");
      if (statusFilter) {
        state.filters.status = statusFilter.value as ListFilters["status"];
        state.page = 0;
        fetchList();
        return;
      }
      const pageSizeFilter = target.closest<HTMLSelectElement>("[data-page-size]");
      if (pageSizeFilter) {
        const next = Number(pageSizeFilter.value || String(DEFAULT_PAGE_SIZE));
        if (!PAGE_SIZE_OPTIONS.includes(next as (typeof PAGE_SIZE_OPTIONS)[number])) return;
        if (next === state.pageSize) return;
        state.pageSize = next;
        state.page = 0;
        localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next));
        fetchList();
        return;
      }

      const bulkField = target.closest<HTMLSelectElement>("[data-bulk-change-field]");
      if (bulkField) {
        state.bulkChangeField = (bulkField.value || "") as BulkChangeField | "";
        state.bulkChangeValue = "";
        state.bulkVtNoReport = false;
        state.bulkVtInspectorId = "";
        render();
        return;
      }

      const bulkValue = target.closest<HTMLInputElement | HTMLSelectElement>("[data-bulk-change-value]");
      if (bulkValue) {
        state.bulkChangeValue = String((bulkValue as HTMLInputElement).value || "").trim();
        if (state.bulkChangeField === "vt") {
          state.bulkVtNoReport = state.bulkChangeValue === VT_NO_REPORT_VALUE;
          if (!state.bulkVtNoReport) state.bulkVtInspectorId = "";
        }
        render();
        return;
      }

      const bulkVtInspector = target.closest<HTMLSelectElement>("[data-bulk-vt-inspector]");
      if (bulkVtInspector) {
        state.bulkVtInspectorId = bulkVtInspector.value || "";
        render();
        return;
      }

      if (!state.drawerOpen || !state.drawerData) return;
      const field = target.getAttribute("data-f") || "";
      if (!field) return;
      const input = target as HTMLInputElement;
      if (field === "vt_report_id") {
        const nextValue = String(input.value || "").trim();
        if (nextValue === VT_NO_REPORT_VALUE) {
          state.drawerVtNoReportSelected = true;
          applyDrawerPatch("vt_report_id", null);
          render();
          return;
        }
        state.drawerVtNoReportSelected = false;
        applyDrawerPatch("vt_report_id", nextValue || null);
        applyDrawerPatch("kontrollert_av", "");
        render();
        return;
      }
      if (field === "pt_report_id" || field === "vol_report_id") {
        applyDrawerPatch(field, String(input.value || "").trim() || null);
        render();
        return;
      }
      applyDrawerPatch(field, input.type === "checkbox" ? input.checked : input.value);
      if (field === "kontrollert_av") {
        state.drawerVtNoReportSelected = true;
      }
      if (field === "kontrollert_av" && String(input.value || "").trim()) {
        applyDrawerPatch("vt_report_id", null);
        render();
        return;
      }
      if (field === "fuge" || field === "komponent_a_id" || field === "komponent_b_id") {
        ensureDrawerWpsSelectionMatches();
        autoSelectDrawerWpsIfSingle();
        render();
      }
    },
    { signal }
  );

  window.addEventListener("resize", closeRowMenus, { signal });
  document.addEventListener("scroll", closeRowMenus, { capture: true, passive: true, signal });

  mount.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      const pageBtn = target.closest<HTMLButtonElement>("[data-weldpager][data-page]");
      if (pageBtn) {
        const next = Number(pageBtn.getAttribute("data-page"));
        const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
        if (Number.isFinite(next) && next >= 1 && next <= totalPages) {
          state.page = next - 1;
          fetchList();
        }
      }
      const printBtn = target.closest<HTMLElement>("[data-weld-print]");
      if (printBtn) {
        printTable();
        return;
      }
      const refresh = target.closest<HTMLElement>("[data-weld-refresh]");
      if (refresh) fetchList();
      const reportPick = target.closest<HTMLElement>("[data-report-pick]");
      if (reportPick && state.drawerData) {
        const id = reportPick.getAttribute("data-report-pick") || "";
        const report = state.reports.find((r) => r.id === id);
        if (!report) return;
        const method = (report.method || "").toLowerCase();
        if (method === "vt") {
          state.drawerVtNoReportSelected = false;
          applyDrawerPatch("kontrollert_av", "");
          applyDrawerPatch("vt_report_id", report.id);
        }
        if (method === "pt") applyDrawerPatch("pt_report_id", report.id);
        if (method === "mt") applyDrawerPatch("pt_report_id", report.id);
        if (method === "rt" || method === "ut") applyDrawerPatch("vol_report_id", report.id);
        render();
        toast("Rapport valgt.");
      }
    },
    { signal }
  );

  wireDatePickers(mount, signal);

  const preloadPromise = Promise.all([
    fetchReports(),
    loadWelders(),
    loadEmployees(),
    loadTraceabilityOptions(),
    loadWpsOptions(),
  ]);
  await loadDrawings();
  render();
  await fetchList();
  await preloadPromise;
  render();

  const openAddBtn = app.querySelector<HTMLElement>("[data-open-weld-add]");
  if (openAddBtn) {
    openAddBtn.addEventListener("click", () => openNewWeld(openAddBtn), { signal });
  }
}


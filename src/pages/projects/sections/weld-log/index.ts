import type { ProjectRow } from "../../../../repo/projectRepo";
import { esc, qs } from "../../../../utils/dom";
import { openConfirmDelete } from "../../../../ui/confirm";
import { toast } from "../../../../ui/toast";
import { createPlaceholderProjectDrawing, fetchProjectDrawings } from "../../../../repo/projectDrawingRepo";
import { ensureProjectWeldLog } from "../../../../repo/weldLogRepo";
import { fetchWelders } from "../../../../repo/certRepo";
import { bulkUpdate, createWeld, deleteWelds, getWeldDetail, listNdtReports, listWelds, updateWeld } from "./api";
import type { BulkMethod, DrawingOption, ListFilters, NdtReportRow, WelderOption, WeldDetailRow, WeldListRow } from "./types";
import { renderBulkReportOptions, renderDrawer, renderLayout, renderPagination, renderRows } from "./templates";

const PAGE_SIZE = 25;

const defaultFilters: ListFilters = {
  status: "til-kontroll",
  search: "",
};

const nextTick = () => new Promise((resolve) => requestAnimationFrame(resolve));

const emptyDetail = (): WeldDetailRow => ({
  id: "",
  sveis_id: "",
  fuge: "",
  komponent_a: "",
  komponent_b: "",
  sveiser_id: "",
  wps: "",
  dato: "",
  tilsett: "",
  vt_report_id: null,
  pt_report_id: null,
  vol_report_id: null,
  status: "",
  kontrollert_av: "",
  godkjent: false,
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

  const state = {
    rows: [] as WeldListRow[],
    total: 0,
    page: 0,
    orderBy: "created_at" as const,
    orderDir: "desc" as const,
    filters: { ...defaultFilters },
    selected: new Set<string>(),
    drawerOpen: false,
    drawerLoading: false,
    drawerErrors: {} as Record<string, string>,
    drawerDirty: false,
    drawerData: null as WeldDetailRow | null,
    drawerFocusReturn: null as HTMLElement | null,
    reports: [] as NdtReportRow[],
    drawings: [] as DrawingOption[],
    currentDrawingId: null as string | null,
    currentLogId: null as string | null,
    welders: [] as WelderOption[],
  };

  const render = () => {
    mount.innerHTML = renderLayout(state.filters, state.drawings, state.currentDrawingId);
    const body = qs<HTMLElement>(mount, "[data-weld-body]");
    body.innerHTML = renderRows(state.rows, state.selected);
    const pagination = qs<HTMLElement>(mount, "[data-weld-pagination]");
    pagination.innerHTML = renderPagination(state.page, PAGE_SIZE, state.total);
    const drawerRoot = qs<HTMLElement>(mount, "[data-weld-drawer-root]");
    drawerRoot.innerHTML = renderDrawer(
      state.drawerData,
      state.reports,
      state.welders,
      state.drawerOpen,
      state.drawerErrors,
      state.drawerLoading
    );
    const bulkDatalist = qs<HTMLDataListElement>(mount, "#bulk-report-list");
    bulkDatalist.innerHTML = renderBulkReportOptions(state.reports);
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
  };

  const fetchList = async () => {
    try {
      const { rows, count } = await listWelds({
        page: state.page,
        pageSize: PAGE_SIZE,
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
      state.reports = await listNdtReports();
    } catch (e: any) {
      toast(String(e?.message ?? e));
    }
  };

  const openDrawer = async (id: string, focusReturn?: HTMLElement) => {
    state.drawerOpen = true;
    state.drawerLoading = true;
    state.drawerErrors = {};
    state.drawerDirty = false;
    state.drawerFocusReturn = focusReturn ?? null;
    state.drawerData = emptyDetail();
    render();

    try {
      const detail = await getWeldDetail(id);
      state.drawerData = detail;
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
    if (!data.sveis_id) errors.sveis_id = "Sveis ID er paakrevd.";
    if (!data.fuge) errors.fuge = "Fuge er paakrevd.";
    if (!data.sveiser_id) errors.sveiser_id = "Sveiser er paakrevd.";
    if (!data.dato) errors.dato = "Dato er paakrevd.";
    return errors;
  };

  const applyDrawerPatch = (field: string, value: string | boolean) => {
    if (!state.drawerData) return;
    const next = { ...state.drawerData } as any;
    if (field === "godkjent") next.godkjent = Boolean(value);
    else next[field] = value;
    state.drawerData = next;
    state.drawerDirty = true;
  };

  const attachReportByNo = (method: BulkMethod, reportNo: string) => {
    const normalized = reportNo.trim();
    if (!normalized) return null;
    const report = state.reports.find((r) => {
      const m = (r.method || "").toLowerCase();
      const matchesMethod = method === "vol" ? m === "rt" || m === "ut" : m === method;
      return matchesMethod && (r.report_no || "").trim() === normalized;
    });
    return report?.id ?? null;
  };

  const mapReportNoToId = (method: BulkMethod, reportNo: string) => {
    const normalized = reportNo.trim();
    if (!normalized) return null;
    const report = state.reports.find((r) => {
      const m = (r.method || "").toLowerCase();
      const matchesMethod = method === "vol" ? m === "rt" || m === "ut" : m === method;
      return matchesMethod && (r.report_no || "").trim() === normalized;
    });
    return report?.id ?? null;
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
    const id = patch.id;
    const isNew = !id;

    if (!isNew) {
      const optimisticRows = state.rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
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
      await bulkUpdate(ids, { godkjent: true, status: "godkjent" });
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
      await bulkUpdate(ids, { godkjent: false, status: "kontroll" });
      toast("Valgte rader satt til kontroll.");
      fetchList();
    } catch (e: any) {
      toast(String(e?.message ?? e));
    }
  };

  const bulkAttach = async (method: BulkMethod, reportNo: string) => {
    const ids = Array.from(state.selected);
    if (!ids.length) return;
    const reportId = attachReportByNo(method, reportNo);
    if (!reportId) {
      toast("Fant ikke rapport.");
      return;
    }
    const patch: Record<string, string> = {};
    if (method === "vt") patch.vt_report_id = reportId;
    if (method === "pt") patch.pt_report_id = reportId;
    if (method === "vol") patch.vol_report_id = reportId;

    try {
      await bulkUpdate(ids, patch as any);
      toast("Rapport knyttet til valgte rader.");
      fetchList();
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
    if (action === "delete") {
      await openConfirmDelete(modalMount, signal, {
        title: "Slett sveis",
        messageHtml: "Slett valgt sveis?",
        onConfirm: async () => deleteWelds([rowId]),
        onDone: async () => fetchList(),
      });
      return;
    }
    if (action === "history") {
      toast("Historikk kommer.");
      return;
    }
    if (action === "duplicate") {
      toast("Duplisering kommer.");
    }
  };

  const openNewWeld = (focusReturn?: HTMLElement) => {
    state.drawerOpen = true;
    state.drawerLoading = false;
    state.drawerErrors = {};
    state.drawerDirty = false;
    state.drawerFocusReturn = focusReturn ?? null;
    state.drawerData = emptyDetail();
    render();
    nextTick().then(() => {
      const closeBtn = mount.querySelector<HTMLElement>("[data-drawer-close]");
      closeBtn?.focus();
    });
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

  const loadWelders = async () => {
    const rows = await fetchWelders();
    state.welders = rows.map((w) => ({ id: w.id, welder_no: w.welder_no, display_name: w.display_name }));
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
      const selectAll = target.closest<HTMLInputElement>("[data-select-all]");
      if (selectAll) {
        const checked = selectAll.checked;
        state.selected = checked ? new Set(state.rows.map((r) => r.id)) : new Set();
        render();
        return;
      }

      const rowSelect = target.closest<HTMLInputElement>("[data-row-select]");
      if (rowSelect) {
        if (rowSelect.checked) state.selected.add(rowSelect.value);
        else state.selected.delete(rowSelect.value);
        updateBulkBar();
        return;
      }

      const rowMenu = target.closest<HTMLElement>("[data-row-menu]");
      if (rowMenu) {
        const panel = rowMenu.parentElement?.querySelector<HTMLElement>("[data-row-menu-panel]");
        if (panel) panel.classList.toggle("is-open");
        return;
      }

      const rowAction = target.closest<HTMLElement>("[data-row-action]");
      if (rowAction) {
        const action = rowAction.getAttribute("data-row-action") || "";
        const row = rowAction.closest<HTMLElement>("[data-row-id]");
        if (row) handleRowAction(row.getAttribute("data-row-id") || "", action);
        return;
      }

      const row = target.closest<HTMLElement>("[data-row-id]");
      if (row && !target.closest("button")) {
        openDrawer(row.getAttribute("data-row-id") || "", row);
        return;
      }

      const newBtn = target.closest<HTMLElement>("[data-weld-new]");
      if (newBtn) {
        openNewWeld(newBtn);
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

      const bulkAttachBtn = target.closest<HTMLElement>("[data-bulk-attach]");
      if (bulkAttachBtn) {
        const methodEl = mount.querySelector<HTMLSelectElement>("[data-bulk-method]");
        const reportEl = mount.querySelector<HTMLInputElement>("[data-bulk-report]");
        const method = (methodEl?.value || "vt") as BulkMethod;
        const reportNo = reportEl?.value || "";
        bulkAttach(method, reportNo);
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
      const search = target.closest<HTMLInputElement>("[data-filter-search]");
      if (search) {
        state.filters.search = search.value;
        state.page = 0;
        fetchList();
        return;
      }

      if (!state.drawerOpen || !state.drawerData) return;
      const field = target.getAttribute("data-f") || "";
      if (!field) return;
      const input = target as HTMLInputElement;
      if (field.endsWith("_report_no")) return;
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

      if (!state.drawerOpen || !state.drawerData) return;
      const field = target.getAttribute("data-f") || "";
      if (!field) return;
      const input = target as HTMLInputElement;
      if (field.endsWith("_report_no")) {
        const method = field.startsWith("vt") ? "vt" : field.startsWith("pt") ? "pt" : "vol";
        const id = mapReportNoToId(method, input.value);
        if (!id) {
          toast("Fant ikke rapport.");
          return;
        }
        applyDrawerPatch(`${method}_report_id`, id);
        return;
      }
      applyDrawerPatch(field, input.type === "checkbox" ? input.checked : input.value);
    },
    { signal }
  );

  mount.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      const pagePrev = target.closest<HTMLElement>("[data-page-prev]");
      if (pagePrev) {
        state.page = Math.max(0, state.page - 1);
        fetchList();
      }
      const pageNext = target.closest<HTMLElement>("[data-page-next]");
      if (pageNext) {
        state.page = state.page + 1;
        fetchList();
      }
      const refresh = target.closest<HTMLElement>("[data-weld-refresh]");
      if (refresh) fetchList();
      const reportPick = target.closest<HTMLElement>("[data-report-pick]");
      if (reportPick && state.drawerData) {
        const id = reportPick.getAttribute("data-report-pick") || "";
        const report = state.reports.find((r) => r.id === id);
        if (!report) return;
        const method = (report.method || "").toLowerCase();
        if (method === "vt") applyDrawerPatch("vt_report_id", report.id);
        if (method === "pt") applyDrawerPatch("pt_report_id", report.id);
        if (method === "rt" || method === "ut") applyDrawerPatch("vol_report_id", report.id);
        toast("Rapport valgt.");
      }
    },
    { signal }
  );

  await fetchReports();
  await loadWelders();
  await loadDrawings();
  render();
  await fetchList();

  const openAddBtn = app.querySelector<HTMLElement>("[data-open-weld-add]");
  if (openAddBtn) {
    openAddBtn.addEventListener("click", () => openNewWeld(openAddBtn), { signal });
  }
}

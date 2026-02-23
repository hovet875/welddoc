import type { ProjectRow } from "../../../repo/projectRepo";
import type { ProjectDrawingRow } from "../../../repo/projectDrawingRepo";
import type {
  PressureTestPerformerOption,
  PressureTestType,
  ProjectPressureTestItemRow,
  ProjectPressureTestRow,
} from "../../../repo/projectPressureTestRepo";

import { fetchProjectDrawings } from "../../../repo/projectDrawingRepo";
import {
  createProjectPressureTestRow,
  createProjectPressureTestRows,
  deleteProjectPressureTestRow,
  fetchProjectPressureTest,
  fetchProjectPressureTestRows,
  listPressureTestPerformers,
  removePressureGaugeCertificate,
  saveProjectPressureTestMeta,
  updateProjectPressureTestRow,
  upsertPressureGaugeCertificate,
} from "../../../repo/projectPressureTestRepo";
import { createSignedUrlForFileRef } from "../../../repo/fileRepo";
import { openConfirmDelete } from "../../../ui/confirm";
import { renderDatePickerInput, wireDatePickers } from "../../../ui/datePicker";
import { modalSaveButton, openModal, renderModal } from "../../../ui/modal";
import { renderPagerButtons } from "../../../ui/pager";
import { openPdfPreview } from "../../../ui/pdfPreview";
import { toast } from "../../../ui/toast";
import { esc, qs } from "../../../utils/dom";
import { formatErrorMessage } from "../../../utils/error";
import { validatePdfFile } from "../../../utils/format";

const PAGE_SIZE = 25;

type ResultFilter = "all" | "godkjent" | "ikke_godkjent" | "unset";

type RowDraft = {
  id: string;
  line_no: number;
  drawing_no: string;
  description: string;
  test_medium: string;
  working_pressure: string;
  test_pressure: string;
  hold_time: string;
  result: string;
};

const normalizeText = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

const textOrNull = (value: string | null | undefined) => {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
};

const lineNo = (row: Pick<ProjectPressureTestItemRow, "line_no">) => {
  const line = Number(row.line_no ?? 0);
  return Number.isFinite(line) && line > 0 ? line : 0;
};

const sortRowsByLine = (rows: ProjectPressureTestItemRow[]) => {
  return [...rows].sort((a, b) => {
    const aLine = lineNo(a);
    const bLine = lineNo(b);
    if (aLine !== bLine) return aLine - bLine;
    return String(a.id).localeCompare(String(b.id));
  });
};

const normalizeResult = (value: string | null | undefined) => {
  const raw = normalizeText(value);
  if (raw === "godkjent") return "godkjent";
  if (raw === "ikke_godkjent" || raw === "ikke godkjent" || raw === "ikke-godkjent") return "ikke_godkjent";
  return "";
};

const resultMeta = (value: string | null | undefined) => {
  const normalized = normalizeResult(value);
  if (normalized === "godkjent") return { label: "Godkjent", tone: "ok" as const };
  if (normalized === "ikke_godkjent") return { label: "Ikke godkjent", tone: "danger" as const };
  return { label: "Ikke satt", tone: "pending" as const };
};

const formatDate = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (!match) return raw;
  const [, yyyy, mm, dd] = match;
  return `${dd}.${mm}.${yyyy}`;
};

const testTypeLabel = (value: string | null | undefined) => {
  return String(value ?? "").trim().toLowerCase() === "leak" ? "Lekkasjetest" : "Trykktest";
};

const nextLineNo = (rows: ProjectPressureTestItemRow[]) => {
  const last = rows.reduce((max, row) => Math.max(max, lineNo(row)), 0);
  return last + 1;
};

const toDrawerDraft = (row: ProjectPressureTestItemRow): RowDraft => ({
  id: String(row.id ?? "").trim(),
  line_no: lineNo(row),
  drawing_no: String(row.drawing_no ?? "").trim(),
  description: String(row.description ?? "").trim(),
  test_medium: String(row.test_medium ?? "").trim(),
  working_pressure: String(row.working_pressure ?? "").trim(),
  test_pressure: String(row.test_pressure ?? "").trim(),
  hold_time: String(row.hold_time ?? "").trim(),
  result: normalizeResult(row.result),
});

const newDrawerDraft = (rows: ProjectPressureTestItemRow[]): RowDraft => ({
  id: "",
  line_no: nextLineNo(rows),
  drawing_no: "",
  description: "",
  test_medium: "",
  working_pressure: "",
  test_pressure: "",
  hold_time: "",
  result: "",
});

const resolvePerformerLabel = (meta: ProjectPressureTestRow | null, performers: PressureTestPerformerOption[]) => {
  const relationNo = String(meta?.performer?.welder_no ?? "").trim();
  const relationName = String(meta?.performer?.display_name ?? "").trim();
  const relationLabel = [relationNo, relationName].filter(Boolean).join(" - ");
  if (relationLabel) return relationLabel;

  const performerId = String(meta?.performed_by ?? "").trim();
  if (!performerId) return "-";
  const option = performers.find((row) => row.id === performerId);
  return option?.label || performerId;
};

const drawingValues = (drawings: ProjectDrawingRow[], rows: ProjectPressureTestItemRow[]) => {
  const values = new Set<string>();
  drawings.forEach((drawing) => {
    const drawingNo = String(drawing.drawing_no ?? "").trim();
    if (drawingNo) values.add(drawingNo);
  });
  rows.forEach((row) => {
    const drawingNo = String(row.drawing_no ?? "").trim();
    if (drawingNo) values.add(drawingNo);
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base", numeric: true }));
};

export async function renderProjectPressureTestSection(opts: {
  mount: HTMLElement;
  modalMount: HTMLElement;
  project: ProjectRow;
  isAdmin: boolean;
  signal: AbortSignal;
}) {
  const { mount, modalMount, project, isAdmin, signal } = opts;

  const state = {
    meta: null as ProjectPressureTestRow | null,
    rows: [] as ProjectPressureTestItemRow[],
    performers: [] as PressureTestPerformerOption[],
    drawings: [] as ProjectDrawingRow[],
    page: 0,
    filters: {
      drawing: "",
      result: "all" as ResultFilter,
      search: "",
    },
    drawerOpen: false,
    drawerLoading: false,
    drawerData: null as RowDraft | null,
    drawerIsNew: false,
    drawerErrors: {} as Record<string, string>,
    drawerFocusReturn: null as HTMLElement | null,
    refreshing: false,
  };

  const filteredRows = () => {
    const searchNeedle = normalizeText(state.filters.search);
    const drawingFilter = String(state.filters.drawing ?? "").trim();
    const resultFilter = state.filters.result;

    return state.rows.filter((row) => {
      if (drawingFilter && String(row.drawing_no ?? "").trim() !== drawingFilter) return false;

      const normalizedResult = normalizeResult(row.result);
      if (resultFilter === "godkjent" && normalizedResult !== "godkjent") return false;
      if (resultFilter === "ikke_godkjent" && normalizedResult !== "ikke_godkjent") return false;
      if (resultFilter === "unset" && normalizedResult) return false;

      if (!searchNeedle) return true;

      const resultLabel = resultMeta(row.result).label;
      const haystack = [
        String(lineNo(row)),
        String(row.drawing_no ?? ""),
        String(row.description ?? ""),
        String(row.test_medium ?? ""),
        String(row.working_pressure ?? ""),
        String(row.test_pressure ?? ""),
        String(row.hold_time ?? ""),
        resultLabel,
      ]
        .join(" ")
        .trim();

      return normalizeText(haystack).includes(searchNeedle);
    });
  };

  const totalPages = () => {
    const total = filteredRows().length;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  };

  const ensurePageInBounds = () => {
    const maxPage = totalPages() - 1;
    if (state.page > maxPage) state.page = maxPage;
    if (state.page < 0) state.page = 0;
  };

  const pagedRows = () => {
    const rows = filteredRows();
    const start = state.page * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  };

  const closeRowMenus = () => {
    const openMenus = mount.querySelectorAll<HTMLElement>("[data-pt-row-menu-panel].is-open");
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
  const renderRows = () => {
    const rows = pagedRows();
    if (!rows.length) {
      return `
        <tr>
          <td colspan="${isAdmin ? "9" : "8"}" class="empty">Ingen testlinjer.</td>
        </tr>
      `;
    }

    return rows
      .map((row) => {
        const result = resultMeta(row.result);
        const rowId = esc(row.id);
        return `
          <tr data-pt-row-id="${rowId}" tabindex="0">
            <td class="id-col">${lineNo(row)}</td>
            <td>${esc(String(row.drawing_no ?? "")) || "-"}</td>
            <td>${esc(String(row.description ?? "")) || "-"}</td>
            <td>${esc(String(row.test_medium ?? "")) || "-"}</td>
            <td>${esc(String(row.working_pressure ?? "")) || "-"}</td>
            <td>${esc(String(row.test_pressure ?? "")) || "-"}</td>
            <td>${esc(String(row.hold_time ?? "")) || "-"}</td>
            <td><span class="chip ${result.tone}">${esc(result.label)}</span></td>
            ${
              isAdmin
                ? `
                  <td class="row-menu-cell">
                    <button class="btn ghost small" type="button" data-pt-row-menu>...</button>
                    <div class="row-menu" data-pt-row-menu-panel>
                      <button type="button" data-pt-row-action="edit">Rediger</button>
                      <button type="button" data-pt-row-action="delete" class="danger">Slett</button>
                    </div>
                  </td>
                `
                : ""
            }
          </tr>
        `;
      })
      .join("");
  };

  const renderDrawer = () => {
    const draft = state.drawerData ?? newDrawerDraft(state.rows);
    const hiddenClass = state.drawerOpen ? "" : "is-hidden";
    const title = state.drawerIsNew ? "Ny testlinje" : `Testlinje ${draft.line_no}`;
    const disabledAttr = !isAdmin || state.drawerLoading ? " disabled" : "";
    const resultValue = normalizeResult(draft.result);
    const saveLabel = state.drawerLoading ? "Lagrer..." : "Lagre";

    return `
      <div class="weld-drawer-backdrop ${hiddenClass}" data-pt-drawer-backdrop></div>
      <aside class="weld-drawer ${hiddenClass}" role="dialog" aria-modal="true" aria-label="Testlinje" data-pt-drawer>
        <header class="drawer-head">
          <div>
            <div class="drawer-title">${esc(title)}</div>
            <div class="drawer-sub">Oppdater testlinje</div>
          </div>
          <button class="btn ghost" type="button" data-pt-drawer-close>Lukk</button>
        </header>
        <div class="drawer-body"${state.drawerLoading ? ' aria-busy="true"' : ""}>
          <section class="drawer-section">
            <h3>Grunninfo</h3>
            <div class="drawer-grid">
              <label class="field">
                <span>ID</span>
                <input class="input" value="${esc(String(draft.line_no))}" disabled />
              </label>
              <label class="field">
                <span>Tegningsnummer</span>
                <input
                  class="input"
                  data-pt-f="drawing_no"
                  list="pressure-row-drawing-options"
                  value="${esc(draft.drawing_no)}"${disabledAttr}
                />
              </label>
              <label class="field" style="grid-column: 1 / -1;">
                <span>Beskrivelse</span>
                <input class="input" data-pt-f="description" value="${esc(draft.description)}"${disabledAttr} />
              </label>
            </div>
          </section>

          <section class="drawer-section">
            <h3>Testdata</h3>
            <div class="drawer-grid">
              <label class="field">
                <span>Testmedie</span>
                <input class="input" data-pt-f="test_medium" value="${esc(draft.test_medium)}"${disabledAttr} />
              </label>
              <label class="field">
                <span>Arbeidstrykk</span>
                <input class="input" data-pt-f="working_pressure" value="${esc(draft.working_pressure)}"${disabledAttr} />
              </label>
              <label class="field">
                <span>Testtrykk</span>
                <input class="input" data-pt-f="test_pressure" value="${esc(draft.test_pressure)}"${disabledAttr} />
              </label>
              <label class="field">
                <span>Holdetid</span>
                <input class="input" data-pt-f="hold_time" value="${esc(draft.hold_time)}"${disabledAttr} />
              </label>
              <label class="field">
                <span>Resultat</span>
                <select class="select" data-pt-f="result"${disabledAttr}>
                  <option value=""${!resultValue ? " selected" : ""}>Ikke satt</option>
                  <option value="godkjent"${resultValue === "godkjent" ? " selected" : ""}>Godkjent</option>
                  <option value="ikke_godkjent"${resultValue === "ikke_godkjent" ? " selected" : ""}>Ikke godkjent</option>
                </select>
              </label>
            </div>
          </section>
        </div>
        <footer class="drawer-footer">
          <button class="btn ghost" type="button" data-pt-drawer-cancel>Avbryt</button>
          <button class="btn accent" type="button" data-pt-drawer-save${disabledAttr}>${saveLabel}</button>
        </footer>
      </aside>
    `;
  };

  const render = () => {
    ensurePageInBounds();

    const filteredCount = filteredRows().length;
    const totalCount = state.rows.length;
    const certName = String(state.meta?.gauge_file?.label ?? "").trim();
    const certFileId = String(state.meta?.gauge_cert_file_id ?? "").trim();
    const testType = testTypeLabel(state.meta?.test_type);
    const testDate = formatDate(state.meta?.test_date);
    const location = String(state.meta?.test_location ?? "").trim() || "-";
    const performer = resolvePerformerLabel(state.meta, state.performers);
    const equipment = String(state.meta?.test_equipment ?? "").trim() || "-";
    const gaugeId = String(state.meta?.gauge_id ?? "").trim() || "-";
    const comments = String(state.meta?.comments ?? "").trim();
    const drawings = drawingValues(state.drawings, state.rows);
    const pagerButtons = renderPagerButtons({
      totalPages: totalPages(),
      currentPage: state.page + 1,
      dataAttrs: { ptpager: "1" },
    });
    const actionsDisabledAttr = state.refreshing ? " disabled" : "";

    mount.innerHTML = `
      <section class="panel weld-log pressure-test-log">
        <div class="panel-head">
          <div>
            <div class="panel-title">Trykk- og lekkasjetestprotokoll</div>
            <div class="panel-meta">${filteredCount} av ${totalCount} rader</div>
          </div>
          <div class="weld-log-actions pressure-test-actions">
            ${isAdmin ? `<button class="btn small" type="button" data-pt-edit-protocol${actionsDisabledAttr}>Protokoll</button>` : ""}
            ${isAdmin ? `<button class="btn small" type="button" data-pt-new-row${actionsDisabledAttr}>Ny linje</button>` : ""}
            ${isAdmin ? `<button class="btn small" type="button" data-pt-bulk-add${actionsDisabledAttr}>Bulk legg til</button>` : ""}
            <button class="btn small" type="button" data-pt-refresh${actionsDisabledAttr}>${state.refreshing ? "Oppdaterer..." : "Oppdater"}</button>
          </div>
        </div>

        <div class="panel-body">
          <div class="pressure-test-summary">
            <div class="pressure-test-cards">
              <article class="pressure-test-card">
                <div class="pressure-test-card-label">Protokoll</div>
                <div class="pressure-test-card-value">${esc(testType)}</div>
                <div class="pressure-test-card-sub">${esc(testDate)} · ${esc(location)}</div>
              </article>

              <article class="pressure-test-card">
                <div class="pressure-test-card-label">Utfort av</div>
                <div class="pressure-test-card-value">${esc(performer)}</div>
                <div class="pressure-test-card-sub">Kunde: ${esc(String(project.customer ?? "-"))}</div>
                <div class="pressure-test-card-sub">AO: ${esc(String(project.work_order ?? "-"))}</div>
              </article>

              <article class="pressure-test-card">
                <div class="pressure-test-card-label">Testutstyr</div>
                <div class="pressure-test-card-value">${esc(equipment)}</div>
                <div class="pressure-test-card-sub">Manometer ID: ${esc(gaugeId)}</div>
                <div class="pressure-test-card-sub">Prosjekt: ${esc(String(project.project_no ?? "-"))}</div>
              </article>

              ${
                comments
                  ? `
                    <article class="pressure-test-card is-wide">
                      <div class="pressure-test-card-label">Kommentar</div>
                      <div class="pressure-test-card-sub">${esc(comments)}</div>
                    </article>
                  `
                  : ""
              }
            </div>

            <div class="pressure-test-cert-row">
              <div>
                <div class="pressure-test-cert-title">Manometer-sertifikat (PDF)</div>
                <div class="pressure-test-cert-meta">${certName ? esc(certName) : "Ingen sertifikat lastet opp."}</div>
              </div>
              <div class="pressure-test-cert-actions">
                ${certFileId ? `<button class="btn small" type="button" data-pt-cert-open>Apne</button>` : ""}
                ${isAdmin ? `<button class="btn small" type="button" data-pt-cert-upload>${certFileId ? "Bytt PDF" : "Last opp PDF"}</button>` : ""}
                ${isAdmin && certFileId ? `<button class="btn small danger" type="button" data-pt-cert-remove>Fjern</button>` : ""}
              </div>
            </div>
          </div>

          <div class="weld-log-toolbar pressure-test-toolbar">
            <div class="weld-log-filters pressure-test-filters">
              <label class="field">
                <span class="muted">Tegning</span>
                <select class="select" data-pt-filter-drawing>
                  <option value="">Alle</option>
                  ${drawings
                    .map((drawing) => `<option value="${esc(drawing)}"${drawing === state.filters.drawing ? " selected" : ""}>${esc(drawing)}</option>`)
                    .join("")}
                </select>
              </label>

              <label class="field">
                <span class="muted">Resultat</span>
                <select class="select" data-pt-filter-result>
                  <option value="all"${state.filters.result === "all" ? " selected" : ""}>Alle</option>
                  <option value="godkjent"${state.filters.result === "godkjent" ? " selected" : ""}>Godkjent</option>
                  <option value="ikke_godkjent"${state.filters.result === "ikke_godkjent" ? " selected" : ""}>Ikke godkjent</option>
                  <option value="unset"${state.filters.result === "unset" ? " selected" : ""}>Ikke satt</option>
                </select>
              </label>

              <label class="field is-wide">
                <span class="muted">Sok</span>
                <input class="input" data-pt-filter-search placeholder="ID, tegning, beskrivelse, testmedie" value="${esc(state.filters.search)}" />
              </label>
            </div>
          </div>

          <div class="weld-table-wrap pressure-test-table-wrap">
            <table class="data-table weld-log-table pressure-test-table">
              <thead>
                <tr class="weld-group-row">
                  <th colspan="3" class="group-label">Grunninfo</th>
                  <th colspan="4" class="group-label">Testdata</th>
                  <th class="group-label">Resultat</th>
                  ${isAdmin ? `<th class="group-empty"></th>` : ""}
                </tr>
                <tr class="weld-field-row">
                  <th class="id-col">ID</th>
                  <th>Tegningsnummer</th>
                  <th>Beskrivelse</th>
                  <th>Testmedie</th>
                  <th>Arbeidstrykk</th>
                  <th>Testtrykk</th>
                  <th>Holdetid</th>
                  <th>Status</th>
                  ${isAdmin ? `<th></th>` : ""}
                </tr>
              </thead>
              <tbody data-pt-rows>
                ${renderRows()}
              </tbody>
            </table>
          </div>

          <div class="weld-pagination pressure-test-pagination" data-pt-pagination>
            ${pagerButtons ? `<div class="pager">${pagerButtons}</div>` : ""}
          </div>
        </div>
      </section>

      <div class="weld-drawer-root" data-pt-drawer-root>
        ${renderDrawer()}
      </div>

      <datalist id="pressure-row-drawing-options">
        ${drawings.map((drawing) => `<option value="${esc(drawing)}"></option>`).join("")}
      </datalist>
    `;
  };
  const loadAll = async () => {
    const [bundle, performerRows, drawingRows] = await Promise.all([
      fetchProjectPressureTest(project.id),
      listPressureTestPerformers(),
      fetchProjectDrawings(project.id),
    ]);
    state.meta = bundle.meta;
    state.rows = sortRowsByLine(bundle.rows);
    state.performers = performerRows;
    state.drawings = drawingRows;
    ensurePageInBounds();
  };

  const reloadRows = async () => {
    state.rows = sortRowsByLine(await fetchProjectPressureTestRows(project.id));
    ensurePageInBounds();
  };

  const refresh = async () => {
    state.refreshing = true;
    render();
    try {
      await loadAll();
    } catch (error: any) {
      console.error(error);
      toast(formatErrorMessage(error));
    } finally {
      state.refreshing = false;
      render();
    }
  };

  const closeDrawer = () => {
    state.drawerOpen = false;
    state.drawerLoading = false;
    state.drawerData = null;
    state.drawerErrors = {};
    render();
    state.drawerFocusReturn?.focus();
  };

  const openNewRow = (focusReturn?: HTMLElement) => {
    if (!isAdmin) {
      toast("Du ma vere admin for a gjore dette.");
      return;
    }
    state.drawerIsNew = true;
    state.drawerOpen = true;
    state.drawerLoading = false;
    state.drawerErrors = {};
    state.drawerFocusReturn = focusReturn ?? null;
    state.drawerData = newDrawerDraft(state.rows);
    render();
  };

  const openEditRow = (rowId: string, focusReturn?: HTMLElement) => {
    if (!isAdmin) {
      toast("Du ma vere admin for a gjore dette.");
      return;
    }
    const row = state.rows.find((entry) => entry.id === rowId);
    if (!row) {
      toast("Fant ikke raden.");
      return;
    }
    state.drawerIsNew = false;
    state.drawerOpen = true;
    state.drawerLoading = false;
    state.drawerErrors = {};
    state.drawerFocusReturn = focusReturn ?? null;
    state.drawerData = toDrawerDraft(row);
    render();
  };

  const applyDrawerPatch = (field: keyof RowDraft, value: string) => {
    if (!state.drawerData) return;
    state.drawerData = { ...state.drawerData, [field]: value };
    if (state.drawerErrors[field]) {
      const nextErrors = { ...state.drawerErrors };
      delete nextErrors[field];
      state.drawerErrors = nextErrors;
    }
  };

  const saveDrawer = async () => {
    if (!isAdmin) {
      toast("Du ma vere admin for a gjore dette.");
      return;
    }
    const draft = state.drawerData;
    if (!draft || state.drawerLoading) return;

    state.drawerLoading = true;
    render();

    try {
      const payload = {
        drawing_no: textOrNull(draft.drawing_no),
        description: textOrNull(draft.description),
        test_medium: textOrNull(draft.test_medium),
        working_pressure: textOrNull(draft.working_pressure),
        test_pressure: textOrNull(draft.test_pressure),
        hold_time: textOrNull(draft.hold_time),
        result: textOrNull(normalizeResult(draft.result)),
      };

      if (state.drawerIsNew) {
        await createProjectPressureTestRow({
          project_id: project.id,
          ...payload,
        });
        toast("Testrad opprettet.");
      } else {
        await updateProjectPressureTestRow(draft.id, payload);
        toast("Testrad lagret.");
      }

      await reloadRows();
      closeDrawer();
    } catch (error: any) {
      console.error(error);
      state.drawerLoading = false;
      render();
      toast(formatErrorMessage(error));
    }
  };

  const deleteRow = async (rowId: string) => {
    const row = state.rows.find((entry) => entry.id === rowId);
    const label = row ? `rad ${lineNo(row)}` : "rad";

    await openConfirmDelete(modalMount, signal, {
      title: "Slett testrad",
      messageHtml: `Slett ${esc(label)}?`,
      onConfirm: async () => deleteProjectPressureTestRow(rowId),
      onDone: async () => {
        await reloadRows();
        render();
      },
    });
  };

  const openBulkAddModal = (focusReturn?: HTMLElement) => {
    if (!isAdmin) {
      toast("Du ma vere admin for a gjore dette.");
      return;
    }

    const modalHtml = renderModal(
      "Bulk legg til testlinjer",
      `
        <div class="modalgrid">
          <div class="field">
            <label for="bulk-pressure-count">Antall tomme linjer</label>
            <input id="bulk-pressure-count" class="input" type="number" min="1" max="200" step="1" value="12" data-bulk-pressure-count />
          </div>
          <div class="field">
            <label>Linjene opprettes med neste ledige ID</label>
            <div class="muted">Nye linjer blir lagt til med stigende ID.</div>
          </div>
        </div>
      `,
      "Opprett"
    );
    const handle = openModal(modalMount, modalHtml, signal);
    const save = modalSaveButton(handle.root);
    const input = handle.root.querySelector<HTMLInputElement>("[data-bulk-pressure-count]");

    save.addEventListener(
      "click",
      async () => {
        const count = Math.trunc(Number(input?.value ?? 0));
        if (!Number.isFinite(count) || count < 1 || count > 200) {
          toast("Velg et antall mellom 1 og 200.");
          input?.focus();
          return;
        }

        save.disabled = true;
        const originalText = save.textContent;
        save.textContent = "Oppretter...";
        try {
          const added = await createProjectPressureTestRows({ project_id: project.id, count });
          handle.close();
          await reloadRows();
          render();
          toast(`Opprettet ${added.count} linjer (${added.firstLineNo}-${added.lastLineNo}).`);
          focusReturn?.focus();
        } catch (error: any) {
          console.error(error);
          save.disabled = false;
          save.textContent = originalText || "Opprett";
          toast(formatErrorMessage(error));
        }
      },
      { signal }
    );
  };
  const openProtocolModal = () => {
    if (!isAdmin) {
      toast("Du ma vere admin for a gjore dette.");
      return;
    }

    const currentType = String(state.meta?.test_type ?? "").trim().toLowerCase() === "leak" ? "leak" : "pressure";
    const performedBy = String(state.meta?.performed_by ?? "").trim();
    const modalHtml = renderModal(
      "Rediger protokoll",
      `
        <div class="modalgrid">
          <div class="field">
            <label>Testtype</label>
            <select class="select" data-pt-meta="test_type">
              <option value="pressure"${currentType === "pressure" ? " selected" : ""}>Trykktest</option>
              <option value="leak"${currentType === "leak" ? " selected" : ""}>Lekkasjetest</option>
            </select>
          </div>
          <div class="field">
            <label>Dato</label>
            ${renderDatePickerInput({
              value: String(state.meta?.test_date ?? "").trim(),
              inputAttrs: 'data-pt-meta="test_date"',
            })}
          </div>
          <div class="field">
            <label>Sted</label>
            <input class="input" data-pt-meta="test_location" value="${esc(String(state.meta?.test_location ?? "").trim())}" />
          </div>
          <div class="field">
            <label>Testen er utfort av</label>
            <select class="select" data-pt-meta="performed_by">
              <option value="">Velg bruker</option>
              ${state.performers
                .map((performer) => `<option value="${esc(performer.id)}"${performedBy === performer.id ? " selected" : ""}>${esc(performer.label)}</option>`)
                .join("")}
            </select>
          </div>
          <div class="field">
            <label>Testutstyr</label>
            <input class="input" data-pt-meta="test_equipment" value="${esc(String(state.meta?.test_equipment ?? "").trim())}" />
          </div>
          <div class="field">
            <label>Kalibrert manometer ID</label>
            <input class="input" data-pt-meta="gauge_id" value="${esc(String(state.meta?.gauge_id ?? "").trim())}" />
          </div>
          <div class="field" style="grid-column: 1 / -1;">
            <label>Kommentar</label>
            <textarea class="input" data-pt-meta="comments" style="min-height: 110px; resize: vertical;">${esc(
              String(state.meta?.comments ?? "").trim()
            )}</textarea>
          </div>
        </div>
      `,
      "Lagre"
    );

    const handle = openModal(modalMount, modalHtml, signal);
    wireDatePickers(handle.root as HTMLElement, signal);
    const save = modalSaveButton(handle.root);

    save.addEventListener(
      "click",
      async () => {
        save.disabled = true;
        save.textContent = "Lagrer...";
        try {
          const read = (selector: string) => {
            const input = handle.root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
            return String(input?.value ?? "").trim();
          };

          const nextType: PressureTestType = read("[data-pt-meta='test_type']") === "leak" ? "leak" : "pressure";
          const patch = {
            test_type: nextType,
            test_date: textOrNull(read("[data-pt-meta='test_date']")),
            test_location: textOrNull(read("[data-pt-meta='test_location']")),
            performed_by: textOrNull(read("[data-pt-meta='performed_by']")),
            test_equipment: textOrNull(read("[data-pt-meta='test_equipment']")),
            gauge_id: textOrNull(read("[data-pt-meta='gauge_id']")),
            comments: textOrNull(read("[data-pt-meta='comments']")),
          };

          state.meta = await saveProjectPressureTestMeta(project.id, patch);
          handle.close();
          render();
          toast("Protokoll lagret.");
        } catch (error: any) {
          console.error(error);
          save.disabled = false;
          save.textContent = "Lagre";
          toast(formatErrorMessage(error));
        }
      },
      { signal }
    );
  };

  const openUploadModal = () => {
    if (!isAdmin) {
      toast("Du ma vere admin for a gjore dette.");
      return;
    }
    const modalHtml = renderModal(
      "Last opp manometer-sertifikat",
      `
        <div class="modalgrid">
          <div class="field" style="grid-column: 1 / -1;">
            <label>PDF</label>
            <input data-f="file" class="input" type="file" accept="application/pdf" />
          </div>
        </div>
      `,
      "Lagre"
    );
    const handle = openModal(modalMount, modalHtml, signal);
    const save = modalSaveButton(handle.root);
    save.addEventListener(
      "click",
      async () => {
        const file = qs<HTMLInputElement>(handle.root, "[data-f=file]").files?.[0] ?? null;
        if (!file) return;
        const fileErr = validatePdfFile(file, 25);
        if (fileErr) {
          toast(fileErr);
          return;
        }
        save.disabled = true;
        save.textContent = "Lagrer...";
        try {
          state.meta = await upsertPressureGaugeCertificate(project.id, file);
          handle.close();
          render();
        } catch (error: any) {
          console.error(error);
          save.disabled = false;
          save.textContent = "Lagre";
          toast(formatErrorMessage(error));
        }
      },
      { signal }
    );
  };

  const openCertificate = async () => {
    const fileId = String(state.meta?.gauge_cert_file_id ?? "").trim();
    if (!fileId) return;
    try {
      const url = await createSignedUrlForFileRef(fileId, { expiresSeconds: 120 });
      const title = String(state.meta?.gauge_file?.label ?? "Manometer-sertifikat").trim() || "Manometer-sertifikat";
      openPdfPreview({ url, title });
    } catch (error: any) {
      console.error(error);
      toast(formatErrorMessage(error));
    }
  };

  const removeCertificate = async () => {
    if (!isAdmin) {
      toast("Du ma vere admin for a gjore dette.");
      return;
    }
    await openConfirmDelete(modalMount, signal, {
      title: "Fjern manometer-sertifikat",
      messageHtml: "Fjern tilknyttet PDF-sertifikat?",
      onConfirm: async () => {
        await removePressureGaugeCertificate(project.id);
        state.meta = await fetchProjectPressureTest(project.id).then((bundle) => bundle.meta);
      },
      onDone: async () => {
        render();
      },
    });
  };
  mount.addEventListener(
    "click",
    async (event) => {
      const target = event.target as HTMLElement;

      if (!target.closest("[data-pt-row-menu]") && !target.closest("[data-pt-row-menu-panel]")) {
        closeRowMenus();
      }

      const pageBtn = target.closest<HTMLButtonElement>("[data-ptpager][data-page]");
      if (pageBtn) {
        const next = Number(pageBtn.getAttribute("data-page"));
        if (Number.isFinite(next) && next >= 1 && next <= totalPages()) {
          state.page = next - 1;
          render();
        }
        return;
      }

      const refreshBtn = target.closest<HTMLElement>("[data-pt-refresh]");
      if (refreshBtn) {
        await refresh();
        return;
      }

      const protocolBtn = target.closest<HTMLElement>("[data-pt-edit-protocol]");
      if (protocolBtn) {
        openProtocolModal();
        return;
      }

      const newRowBtn = target.closest<HTMLElement>("[data-pt-new-row]");
      if (newRowBtn) {
        openNewRow(newRowBtn);
        return;
      }

      const bulkBtn = target.closest<HTMLElement>("[data-pt-bulk-add]");
      if (bulkBtn) {
        openBulkAddModal(bulkBtn);
        return;
      }

      const openCertBtn = target.closest<HTMLElement>("[data-pt-cert-open]");
      if (openCertBtn) {
        await openCertificate();
        return;
      }

      const uploadCertBtn = target.closest<HTMLElement>("[data-pt-cert-upload]");
      if (uploadCertBtn) {
        openUploadModal();
        return;
      }

      const removeCertBtn = target.closest<HTMLElement>("[data-pt-cert-remove]");
      if (removeCertBtn) {
        await removeCertificate();
        return;
      }

      const rowMenuBtn = target.closest<HTMLElement>("[data-pt-row-menu]");
      if (rowMenuBtn) {
        const panel = rowMenuBtn.parentElement?.querySelector<HTMLElement>("[data-pt-row-menu-panel]");
        if (panel) {
          const willOpen = !panel.classList.contains("is-open");
          closeRowMenus();
          if (willOpen) {
            panel.classList.add("is-open");
            positionRowMenu(rowMenuBtn, panel);
          }
        }
        return;
      }

      const rowAction = target.closest<HTMLElement>("[data-pt-row-action]");
      if (rowAction) {
        closeRowMenus();
        const action = rowAction.getAttribute("data-pt-row-action") || "";
        const row = rowAction.closest<HTMLElement>("[data-pt-row-id]");
        const rowId = row?.getAttribute("data-pt-row-id") || "";
        if (!rowId) return;

        if (action === "edit") {
          openEditRow(rowId, row || undefined);
          return;
        }
        if (action === "delete") {
          await deleteRow(rowId);
          return;
        }
      }

      const drawerClose = target.closest<HTMLElement>("[data-pt-drawer-close], [data-pt-drawer-cancel], [data-pt-drawer-backdrop]");
      if (drawerClose) {
        closeDrawer();
        return;
      }

      const drawerSave = target.closest<HTMLElement>("[data-pt-drawer-save]");
      if (drawerSave) {
        await saveDrawer();
        return;
      }

      const row = target.closest<HTMLElement>("[data-pt-row-id]");
      if (row && isAdmin) {
        if (target.closest("button, a, input, select, textarea, [data-pt-row-menu-panel], [data-date-open], [data-date-input]")) return;
        const rowId = row.getAttribute("data-pt-row-id") || "";
        if (rowId) openEditRow(rowId, row);
      }
    },
    { signal }
  );

  mount.addEventListener(
    "input",
    (event) => {
      const target = event.target as HTMLElement;

      const search = target.closest<HTMLInputElement>("[data-pt-filter-search]");
      if (search) {
        state.filters.search = search.value;
        state.page = 0;
        render();
        return;
      }

      if (!state.drawerOpen || !state.drawerData) return;
      const field = target.getAttribute("data-pt-f") as keyof RowDraft | null;
      if (!field) return;
      const input = target as HTMLInputElement;
      applyDrawerPatch(field, input.value);
    },
    { signal }
  );

  mount.addEventListener(
    "change",
    (event) => {
      const target = event.target as HTMLElement;

      const drawing = target.closest<HTMLSelectElement>("[data-pt-filter-drawing]");
      if (drawing) {
        state.filters.drawing = drawing.value;
        state.page = 0;
        render();
        return;
      }

      const result = target.closest<HTMLSelectElement>("[data-pt-filter-result]");
      if (result) {
        state.filters.result = result.value as ResultFilter;
        state.page = 0;
        render();
        return;
      }

      if (!state.drawerOpen || !state.drawerData) return;
      const field = target.getAttribute("data-pt-f") as keyof RowDraft | null;
      if (!field) return;
      const input = target as HTMLSelectElement;
      applyDrawerPatch(field, input.value);
    },
    { signal }
  );

  mount.addEventListener(
    "keydown",
    (event) => {
      if (!(event.target instanceof HTMLElement)) return;

      if (event.key === "Escape" && state.drawerOpen) {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (!isAdmin) return;
      const row = event.target.closest<HTMLElement>("[data-pt-row-id]");
      if (!row) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button, a, input, select, textarea")) return;
      const rowId = row.getAttribute("data-pt-row-id") || "";
      if (!rowId) return;
      event.preventDefault();
      openEditRow(rowId, row);
    },
    { signal }
  );

  window.addEventListener("resize", closeRowMenus, { signal });
  document.addEventListener("scroll", closeRowMenus, { capture: true, passive: true, signal });

  try {
    await loadAll();
    render();
  } catch (error: any) {
    console.error(error);
    mount.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">Trykk- og lekkasjetestprotokoll</div>
          <div class="panel-meta">Feil</div>
        </div>
        <div class="panel-body">
          <div class="err">${esc(formatErrorMessage(error))}</div>
        </div>
      </section>
    `;
    toast(formatErrorMessage(error));
  }
}


import { renderHeader, wireHeader } from "../../components/header";
import { getIsAdmin, getSession, getProfileAccess } from "../../app/auth";
import { toast } from "../../ui/toast";
import { Footer } from "../../components/footer";
import { esc, qs } from "../../utils/dom";
import { fetchWpsData } from "../../repo/wpsRepo";
import type { WPQRRow, WPSRow } from "../../repo/wpsRepo";
import { fetchMaterials } from "../../repo/materialRepo";
import { fetchStandards } from "../../repo/standardRepo";
import { fetchWeldingProcesses } from "../../repo/weldingProcessRepo";
import { fetchWeldJointTypes } from "../../repo/weldJointTypeRepo";
import { createState } from "./state";
import { renderMethodPill, renderWpqrTable, renderWpsTable } from "./templates";
import { buildTypePillMap, typePillClass } from "../../ui/typePill";
import { openPdf, openWpqrModal, openWpsModal, handleDeleteWpqr, handleDeleteWps } from "./handlers";
import { openConfirmDelete } from "../../ui/confirm";

import "../../styles/pages/wps.css";

export async function renderWpsPage(app: HTMLElement) {
  // ---- SPA lifecycle: unngå dobbel mount ----
  const prev = (app as any).__wps_unmount as undefined | (() => void);
  if (prev) prev();

  const controller = new AbortController();
  const { signal } = controller;

  (app as any).__wps_unmount = () => {
    controller.abort();
    // rydd etter deg
    (app as any).__wps_unmount = undefined;
  };

  const state = createState();

  // Fetch user session and display name
  const session = await getSession();
  let displayName = "Bruker";
  const email = session?.user?.email ?? "";
  
  if (session?.user) {
    try {
      const access = await getProfileAccess(session.user);
      displayName = access.displayName;
    } catch (err) {
      console.warn("Feilet å hente profil", err);
    }
  }

  app.innerHTML = `
    <div class="shell page-wps">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">Sveiseprosedyrer</h1>
            <p class="section-subtitle">Bibliotek for gyldige WPS og WPQR.</p>
          </div>
          <div class="section-actions">
            <button data-new-wps class="btn accent small">Last opp WPS</button>
            <button data-new-wpqr class="btn accent small">Last opp WPQR</button>
            <button data-refresh class="btn small">Oppdater</button>
          </div>
        </section>

        <section class="filters">
          <div class="field">
            <label>Metode</label>
            <select data-filter-process class="select">
              <option value="">Alle metoder</option>
            </select>
          </div>
          <div class="field">
            <label>Grunnmateriale</label>
            <select data-filter-material class="select">
              <option value="">Alle materialer</option>
            </select>
          </div>
          <div class="field">
            <label>Fuge</label>
            <select data-filter-fuge class="select">
              <option value="">Alle fugetyper</option>
            </select>
          </div>
          <div class="field">
            <label>Søk</label>
            <input data-filter-text class="input" placeholder="WPS/WPQR, standard, materiale, metode…" />
          </div>
        </section>

        <section class="section-grid">
          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">WPS</div>
              <div class="panel-head-center" data-method-pills-wps></div>
              <div data-wps-count class="panel-meta">—</div>
            </div>
            <div class="panel-body">
              <div data-wps-body class="listmount"><div class="muted">Laster…</div></div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">WPQR</div>
              <div class="panel-head-center" data-method-pills-wpqr></div>
              <div data-wpqr-count class="panel-meta">—</div>
            </div>
            <div class="panel-body">
              <div data-wpqr-body class="listmount"><div class="muted">Laster…</div></div>
            </div>
          </div>
        </section>

        <div data-modal-mount></div>
      </main>

      ${Footer()}
    </div>
  `;

  wireHeader(app);

  const pageRoot = qs<HTMLElement>(app, ".page-wps");

  const wpqrBody = qs<HTMLDivElement>(app, "[data-wpqr-body]");
  const wpsBody = qs<HTMLDivElement>(app, "[data-wps-body]");
  const wpqrCount = qs<HTMLDivElement>(app, "[data-wpqr-count]");
  const wpsCount = qs<HTMLDivElement>(app, "[data-wps-count]");
  const methodPillsWps = qs<HTMLDivElement>(app, "[data-method-pills-wps]");
  const methodPillsWpqr = qs<HTMLDivElement>(app, "[data-method-pills-wpqr]");
  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");

  const refreshBtn = qs<HTMLButtonElement>(app, "[data-refresh]");
  const newWpqrBtn = qs<HTMLButtonElement>(app, "[data-new-wpqr]");
  const newWpsBtn = qs<HTMLButtonElement>(app, "[data-new-wps]");
  const filterProcess = qs<HTMLSelectElement>(app, "[data-filter-process]");
  const filterMaterial = qs<HTMLSelectElement>(app, "[data-filter-material]");
  const filterFuge = qs<HTMLSelectElement>(app, "[data-filter-fuge]");
  const filterText = qs<HTMLInputElement>(app, "[data-filter-text]");

  let activeProcess = "";
  let activeMaterial = "";
  let activeFuge = "";
  let activeText = "";

  function setLoading(isLoading: boolean) {
    state.loading = isLoading;
    refreshBtn.disabled = isLoading;
    newWpqrBtn.disabled = isLoading;
    newWpsBtn.disabled = isLoading;
  }

  function normalize(s: string | null | undefined) {
    return (s ?? "").toString().trim().toLowerCase();
  }

  function matchesText(target: string, term: string) {
    if (!term) return true;
    return normalize(target).includes(term);
  }

  function buildMethodList() {
    const fromRows = new Set<string>();
    [...state.wpsAll, ...state.wpqrAll].forEach((r: any) => {
      const p = (r.process || "").trim();
      if (p) fromRows.add(p);
    });
    const base = fromRows.size > 0 ? Array.from(fromRows) : state.processes.map((p) => p.label);
    return base.filter(Boolean).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
  }

  function buildFugeList() {
    const set = new Set<string>();
    state.jointTypes.forEach((j) => {
      const label = (j.label || "").trim();
      if (label) set.add(label);
    });
    [...state.wpsAll, ...state.wpqrAll].forEach((r: any) => {
      const f = (r.fuge || "").trim();
      if (f) set.add(f);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
  }

  function materialLabelFromRow(r: WPQRRow | WPSRow) {
    if (r.material) {
      return `${r.material.name} (${r.material.material_code}) - ${r.material.material_group}`;
    }
    return r.materiale ?? "";
  }

  function buildMaterialList() {
    const set = new Set<string>();
    [...state.wpsAll, ...state.wpqrAll].forEach((r: any) => {
      const label = materialLabelFromRow(r).trim();
      if (label) set.add(label);
    });
    if (set.size === 0) {
      state.materials.forEach((m) => {
        const label = `${m.name} (${m.material_code}) - ${m.material_group}`;
        if (label) set.add(label);
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
  }

  function applyFiltersWpqr(rows: WPQRRow[]) {
    const term = normalize(activeText);
    return rows
      .filter((r) => {
        if (activeProcess && normalize(r.process) !== normalize(activeProcess)) return false;
        if (activeMaterial && normalize(materialLabelFromRow(r)) !== normalize(activeMaterial)) return false;
        if (activeFuge && normalize(r.fuge) !== normalize(activeFuge)) return false;
        if (!term) return true;
        const standardLabel = r.standard ? `${r.standard.label}${r.standard.revision ? `:${r.standard.revision}` : ""}` : "";
        const materialLabel = materialLabelFromRow(r);
        const hay = [r.doc_no, r.process, r.fuge, standardLabel, materialLabel].filter(Boolean).join(" ");
        return matchesText(hay, term);
      })
      .sort((a, b) => {
        const pa = normalize(a.process);
        const pb = normalize(b.process);
        if (pa !== pb) return pa.localeCompare(pb, "nb", { sensitivity: "base" });
        const fa = normalize(a.fuge);
        const fb = normalize(b.fuge);
        if (fa !== fb) return fa.localeCompare(fb, "nb", { sensitivity: "base" });
        return normalize(a.doc_no).localeCompare(normalize(b.doc_no), "nb", { sensitivity: "base" });
      });
  }

  function applyFiltersWps(rows: WPSRow[]) {
    const term = normalize(activeText);
    return rows
      .filter((r) => {
        if (activeProcess && normalize(r.process) !== normalize(activeProcess)) return false;
        if (activeMaterial && normalize(materialLabelFromRow(r)) !== normalize(activeMaterial)) return false;
        if (activeFuge && normalize(r.fuge) !== normalize(activeFuge)) return false;
        if (!term) return true;
        const standardLabel = r.standard ? `${r.standard.label}${r.standard.revision ? `:${r.standard.revision}` : ""}` : "";
        const materialLabel = materialLabelFromRow(r);
        const hay = [r.doc_no, r.process, r.fuge, standardLabel, materialLabel, r.wpqr?.doc_no ?? ""].filter(Boolean).join(" ");
        return matchesText(hay, term);
      })
      .sort((a, b) => {
        const pa = normalize(a.process);
        const pb = normalize(b.process);
        if (pa !== pb) return pa.localeCompare(pb, "nb", { sensitivity: "base" });
        const fa = normalize(a.fuge);
        const fb = normalize(b.fuge);
        if (fa !== fb) return fa.localeCompare(fb, "nb", { sensitivity: "base" });
        return normalize(a.doc_no).localeCompare(normalize(b.doc_no), "nb", { sensitivity: "base" });
      });
  }

  function renderMethodPills(target: HTMLElement, methods: string[]) {
    const items = methods.length ? methods : ["Ukjent"];
    const pillMap = buildTypePillMap(items);
    target.innerHTML = items
      .map((m) => {
        const isActive = !activeProcess || normalize(activeProcess) === normalize(m);
        const cls = isActive ? "is-active" : "is-muted";
        return `
          <button class="method-pill-btn" data-method-pill="${esc(m)}" type="button">
            ${renderMethodPill(m, typePillClass(m, pillMap), cls)}
          </button>
        `;
      })
      .join("");
  }

  function renderLists() {
    const filteredWpqr = applyFiltersWpqr(state.wpqrAll);
    const filteredWps = applyFiltersWps(state.wpsAll);

    wpqrCount.textContent = `${filteredWpqr.length} stk`;
    wpsCount.textContent = `${filteredWps.length} stk`;

    const methodList = buildMethodList();
    const pillMap = buildTypePillMap(methodList);
    const getPillClass = (value: string) => typePillClass(value, pillMap);
    renderMethodPills(methodPillsWps, methodList);
    renderMethodPills(methodPillsWpqr, methodList);

    wpqrBody.innerHTML =
      filteredWpqr.length === 0
        ? `<div class="muted">Ingen data.</div>`
        : renderWpqrTable(filteredWpqr, getPillClass, state.isAdmin);

    wpsBody.innerHTML =
      filteredWps.length === 0
        ? `<div class="muted">Ingen data.</div>`
        : renderWpsTable(filteredWps, getPillClass, state.isAdmin);
  }

  function requireAdmin() {
    if (state.isAdmin) return true;
    toast("Kun admin har tilgang til dette.");
    return false;
  }

  function updateAdminUi() {
    const show = state.isAdmin;
    newWpqrBtn.style.display = show ? "" : "none";
    newWpsBtn.style.display = show ? "" : "none";
  }

  async function load() {
    const seq = ++state.loadSeq;

    setLoading(true);
    wpqrBody.innerHTML = `<div class="muted">Laster…</div>`;
    wpsBody.innerHTML = `<div class="muted">Laster…</div>`;

    try {
      const [res, materials, standards, processes, jointTypes] = await Promise.all([
        fetchWpsData(),
        fetchMaterials(),
        fetchStandards(),
        fetchWeldingProcesses(),
        fetchWeldJointTypes(),
      ]);

      // race-safe: dropp hvis en nyere load har startet
      if (seq !== state.loadSeq) return;

      state.wpqrAll = res.wpqr;
      state.wpsAll = res.wps;
      state.materials = materials;
      state.standards = standards;
      state.processes = processes;
      state.jointTypes = jointTypes;

      const methodList = buildMethodList();
      filterProcess.innerHTML = [
        `<option value="">Alle metoder</option>`,
        ...methodList.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`),
      ].join("");

      const fugeList = buildFugeList();
      filterFuge.innerHTML = [
        `<option value="">Alle fugetyper</option>`,
        ...fugeList.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`),
      ].join("");

      const materialList = buildMaterialList();
      filterMaterial.innerHTML = [
        `<option value="">Alle materialer</option>`,
        ...materialList.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`),
      ].join("");

      renderLists();
    } catch (e: any) {
      console.error(e);
      wpqrBody.innerHTML = `<div class="err">Feil: ${String(e?.message ?? e)}</div>`;
      wpsBody.innerHTML = `<div class="err">Feil: ${String(e?.message ?? e)}</div>`;
    } finally {
      // kun “release” hvis dette er siste load
      if (seq === state.loadSeq) setLoading(false);
    }
  }

  refreshBtn.addEventListener("click", () => load(), { signal });

  filterProcess.addEventListener(
    "change",
    () => {
      activeProcess = filterProcess.value || "";
      renderLists();
    },
    { signal }
  );

  filterMaterial.addEventListener(
    "change",
    () => {
      activeMaterial = filterMaterial.value || "";
      renderLists();
    },
    { signal }
  );

  filterFuge.addEventListener(
    "change",
    () => {
      activeFuge = filterFuge.value || "";
      renderLists();
    },
    { signal }
  );

  filterText.addEventListener(
    "input",
    () => {
      activeText = filterText.value || "";
      renderLists();
    },
    { signal }
  );

  newWpqrBtn.addEventListener(
    "click",
    () => {
      if (!requireAdmin()) return;
      openWpqrModal(
        modalMount,
        signal,
        "new",
        null,
        state.materials,
        state.standards,
        state.processes,
        state.jointTypes.map((j) => j.label),
        load
      );
    },
    { signal }
  );

  newWpsBtn.addEventListener(
    "click",
    () => {
      if (!requireAdmin()) return;
      openWpsModal(modalMount, signal, state, "new", null, load);
    },
    { signal }
  );

  // ---- Event delegation (én gang, stable) ----
  pageRoot.addEventListener(
    "click",
    async (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;

      const pill = t.closest?.("[data-method-pill]") as HTMLElement | null;
      if (pill) {
        const method = pill.getAttribute("data-method-pill") || "";
        activeProcess = normalize(activeProcess) === normalize(method) ? "" : method;
        filterProcess.value = activeProcess;
        renderLists();
        return;
      }

      const pdfBtn = t.closest?.("button[data-openpdf]") as HTMLButtonElement | null;
      if (pdfBtn) {
        const path = pdfBtn.getAttribute("data-openpdf");
        if (path) await openPdf(path);
        return;
      }

      const editWpqr = t.closest?.("button[data-edit-wpqr]") as HTMLButtonElement | null;
      if (editWpqr) {
        if (!requireAdmin()) return;
        const id = editWpqr.getAttribute("data-edit-wpqr") || "";
        const row = state.wpqrAll.find((x) => x.id === id) ?? null;
        if (row)
          openWpqrModal(
            modalMount,
            signal,
            "edit",
            row,
            state.materials,
            state.standards,
            state.processes,
            state.jointTypes.map((j) => j.label),
            load
          );
        return;
      }

      const editWps = t.closest?.("button[data-edit-wps]") as HTMLButtonElement | null;
      if (editWps) {
        if (!requireAdmin()) return;
        const id = editWps.getAttribute("data-edit-wps") || "";
        const row = state.wpsAll.find((x) => x.id === id) ?? null;
        if (row) openWpsModal(modalMount, signal, state, "edit", row, load);
        return;
      }

      const delWpqr = t.closest?.("button[data-del-wpqr]") as HTMLButtonElement | null;
      if (delWpqr) {
        if (!requireAdmin()) return;
        const id = delWpqr.getAttribute("data-del-wpqr") || "";
        const label = delWpqr.getAttribute("data-label") || "WPQR";

        await openConfirmDelete(modalMount, signal, {
          title: "Slett WPQR",
          messageHtml: `Er du sikker på at du vil slette <b>${label}</b>?<br/>WPS som er koblet til denne blir automatisk frakoblet.`,
          onConfirm: async () => handleDeleteWpqr(id),
          onDone: load,
        });
        return;
      }

      const delWps = t.closest?.("button[data-del-wps]") as HTMLButtonElement | null;
      if (delWps) {
        if (!requireAdmin()) return;
        const id = delWps.getAttribute("data-del-wps") || "";
        const label = delWps.getAttribute("data-label") || "WPS";

        await openConfirmDelete(modalMount, signal, {
          title: "Slett WPS",
          messageHtml: `Er du sikker på at du vil slette <b>${label}</b>?`,
          onConfirm: async () => handleDeleteWps(id),
          onDone: load,
        });
        return;
      }
    },
    { signal }
  );

  updateAdminUi();
  getIsAdmin()
    .then((isAdmin) => {
      state.isAdmin = isAdmin;
      updateAdminUi();
      renderLists();
    })
    .catch((e) => console.warn("Admin-check failed", e));

  // initial load
  load();

  // returner unmount hvis du vil bruke den i routeren din
  return (app as any).__wps_unmount as () => void;
}

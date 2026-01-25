import { renderHeader, wireHeader } from "../../components/header";
import { Footer } from "../../components/footer";
import { qs } from "../../utils/dom";
import { fetchWpsData } from "../../repo/wpsRepo";
import { createState, groupByProcess } from "./state";
import { renderProcessTableWPQR, renderProcessTableWPS } from "./templates";
import { openPdf, openWpqrModal, openWpsModal, handleDeleteWpqr, handleDeleteWps } from "./handlers";
import { openConfirmDelete } from "../../ui/confirm";

import "../../styles/pages/wps.css";

export function renderWpsPage(app: HTMLElement) {
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

  app.innerHTML = `
    <div class="shell page-wps">
      ${renderHeader()}

      <main class="main">
        <section class="wpsheader">
          <div>
            <h1 class="wpsh1">Sveiseprosedyrer</h1>
            <p class="wpsp">Bibliotek for gyldige WPS og WPQR.</p>
          </div>
          <div class="wpsactions">
            <button data-new-wps class="btn accent small">Ny WPS</button>
            <button data-new-wpqr class="btn accent small">Ny WPQR</button>
            <button data-refresh class="btn small">Oppdater</button>
          </div>
        </section>

        <section class="wpsgrid">
          <div class="wpspanel">
            <div class="wpspanelhead">
              <div class="wpspaneltitle">WPS</div>
              <div data-wps-count class="wpspanelmeta">—</div>
            </div>
            <div class="wpspanelbody">
              <div data-wps-body class="listmount"><div class="muted">Laster…</div></div>
            </div>
          </div>

          <div class="wpspanel">
            <div class="wpspanelhead">
              <div class="wpspaneltitle">WPQR</div>
              <div data-wpqr-count class="wpspanelmeta">—</div>
            </div>
            <div class="wpspanelbody">
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

  const wpqrBody = qs<HTMLDivElement>(app, "[data-wpqr-body]");
  const wpsBody = qs<HTMLDivElement>(app, "[data-wps-body]");
  const wpqrCount = qs<HTMLDivElement>(app, "[data-wpqr-count]");
  const wpsCount = qs<HTMLDivElement>(app, "[data-wps-count]");
  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");

  const refreshBtn = qs<HTMLButtonElement>(app, "[data-refresh]");
  const newWpqrBtn = qs<HTMLButtonElement>(app, "[data-new-wpqr]");
  const newWpsBtn = qs<HTMLButtonElement>(app, "[data-new-wps]");

  function setLoading(isLoading: boolean) {
    state.loading = isLoading;
    refreshBtn.disabled = isLoading;
    newWpqrBtn.disabled = isLoading;
    newWpsBtn.disabled = isLoading;
  }

  function renderLists() {
    wpqrCount.textContent = `${state.wpqrAll.length} stk`;
    wpsCount.textContent = `${state.wpsAll.length} stk`;

    const wpqrGrouped = groupByProcess(state.wpqrAll);
    const wpsGrouped = groupByProcess(state.wpsAll);

    wpqrBody.innerHTML =
      wpqrGrouped.length === 0
        ? `<div class="muted">Ingen data.</div>`
        : wpqrGrouped.map(([p, rows]) => renderProcessTableWPQR(p, rows)).join("");

    wpsBody.innerHTML =
      wpsGrouped.length === 0
        ? `<div class="muted">Ingen data.</div>`
        : wpsGrouped.map(([p, rows]) => renderProcessTableWPS(p, rows)).join("");
  }

  async function load() {
    const seq = ++state.loadSeq;

    setLoading(true);
    wpqrBody.innerHTML = `<div class="muted">Laster…</div>`;
    wpsBody.innerHTML = `<div class="muted">Laster…</div>`;

    try {
      const res = await fetchWpsData();

      // race-safe: dropp hvis en nyere load har startet
      if (seq !== state.loadSeq) return;

      state.wpqrAll = res.wpqr;
      state.wpsAll = res.wps;

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

  newWpqrBtn.addEventListener(
    "click",
    () => openWpqrModal(modalMount, signal, state, "new", null, load),
    { signal }
  );

  newWpsBtn.addEventListener(
    "click",
    () => openWpsModal(modalMount, signal, state, "new", null, load),
    { signal }
  );

  // ---- Event delegation (én gang, stable) ----
  app.addEventListener(
    "click",
    async (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;

      const pdfBtn = t.closest?.("button[data-openpdf]") as HTMLButtonElement | null;
      if (pdfBtn) {
        const path = pdfBtn.getAttribute("data-openpdf");
        if (path) await openPdf(path);
        return;
      }

      const editWpqr = t.closest?.("button[data-edit-wpqr]") as HTMLButtonElement | null;
      if (editWpqr) {
        const id = editWpqr.getAttribute("data-edit-wpqr") || "";
        const row = state.wpqrAll.find((x) => x.id === id) ?? null;
        if (row) openWpqrModal(modalMount, signal, state, "edit", row, load);
        return;
      }

      const editWps = t.closest?.("button[data-edit-wps]") as HTMLButtonElement | null;
      if (editWps) {
        const id = editWps.getAttribute("data-edit-wps") || "";
        const row = state.wpsAll.find((x) => x.id === id) ?? null;
        if (row) openWpsModal(modalMount, signal, state, "edit", row, load);
        return;
      }

      const delWpqr = t.closest?.("button[data-del-wpqr]") as HTMLButtonElement | null;
      if (delWpqr) {
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

  // initial load
  load();

  // returner unmount hvis du vil bruke den i routeren din
  return (app as any).__wps_unmount as () => void;
}

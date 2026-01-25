import { renderHeader, wireHeader } from "../../components/header";
import { Footer } from "../../components/footer";
import { qs } from "../../utils/dom";

import "../../styles/pages/certs.css";

import { fetchCertData } from "../../repo/certRepo";
import { createState, groupByWelder, groupByMethod } from "./state";

import { renderWelderGroup, renderNdtGroup } from "./templates";
import { openConfirmDelete } from "../../ui/confirm";
import {
  openWelderPdf,
  openNdtPdf,
  openWelderCertModal,
  openNdtCertModal,
  handleDeleteWelderCert,
  handleDeleteNdtCert,
} from "./handlers";


export function renderCertsPage(app: HTMLElement) {
  // ---- SPA lifecycle: unngå dobbel mount ----
  const prev = (app as any).__certs_unmount as undefined | (() => void);
  if (prev) prev();

  const controller = new AbortController();
  const { signal } = controller;

  (app as any).__certs_unmount = () => {
    controller.abort();
    (app as any).__certs_unmount = undefined;
  };

  const state = createState();

  app.innerHTML = `
    <div class="shell page-certs">
      ${renderHeader()}

      <main class="main">
        <section class="wpsheader">
          <div>
            <h1 class="wpsh1">Sveisesertifikater</h1>
            <p class="wpsp">Bibliotek for sveisesertifikater og NDT-personell sertifikater.</p>
          </div>

          <div class="wpsactions">
            <button data-new-welder class="btn accent small">Nytt sveisesertifikat</button>
            <button data-new-ndt class="btn accent small">Nytt NDT-sertifikat</button>
            <button data-refresh class="btn small">Oppdater</button>
          </div>
        </section>

        <section class="wpsgrid">
          <div class="wpspanel">
            <div class="wpspanelhead">
              <div class="wpspaneltitle">Sveisesertifikater</div>
              <div data-welder-count class="wpspanelmeta">—</div>
            </div>
            <div class="wpspanelbody">
              <div data-welder-body class="listmount"><div class="muted">Laster…</div></div>
            </div>
          </div>

          <div class="wpspanel">
            <div class="wpspanelhead">
              <div class="wpspaneltitle">NDT-personell</div>
              <div data-ndt-count class="wpspanelmeta">—</div>
            </div>
            <div class="wpspanelbody">
              <div data-ndt-body class="listmount"><div class="muted">Laster…</div></div>
            </div>
          </div>
        </section>

        <div data-modal-mount></div>
      </main>

      ${Footer()}
    </div>
  `;

  wireHeader(app);

  const welderBody = qs<HTMLDivElement>(app, "[data-welder-body]");
  const ndtBody = qs<HTMLDivElement>(app, "[data-ndt-body]");
  const welderCount = qs<HTMLDivElement>(app, "[data-welder-count]");
  const ndtCount = qs<HTMLDivElement>(app, "[data-ndt-count]");
  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");

  const refreshBtn = qs<HTMLButtonElement>(app, "[data-refresh]");
  const newWelderBtn = qs<HTMLButtonElement>(app, "[data-new-welder]");
  const newNdtBtn = qs<HTMLButtonElement>(app, "[data-new-ndt]");

  function setLoading(isLoading: boolean) {
    state.loading = isLoading;
    refreshBtn.disabled = isLoading;
    newWelderBtn.disabled = isLoading;
    newNdtBtn.disabled = isLoading;
  }

  function renderLists() {
    welderCount.textContent = `${state.welderCertsAll.length} stk`;
    ndtCount.textContent = `${state.ndtCertsAll.length} stk`;

    const welderGrouped = groupByWelder(state.welderCertsAll);
    const ndtGrouped = groupByMethod(state.ndtCertsAll);

    // NB: showActions styres i UI basert på om knapper finnes/brukes.
    // Siden RLS stopper user fra å skrive, er dette mer for UX.
    const showActions = true;

    welderBody.innerHTML =
      welderGrouped.length === 0
        ? `<div class="muted">Ingen data.</div>`
        : welderGrouped.map(([k, rows]) => renderWelderGroup(k, rows, showActions)).join("");

    ndtBody.innerHTML =
      ndtGrouped.length === 0
        ? `<div class="muted">Ingen data.</div>`
        : ndtGrouped.map(([m, rows]) => renderNdtGroup(m, rows, showActions)).join("");
  }

  async function load() {
    const seq = ++state.loadSeq;

    setLoading(true);
    welderBody.innerHTML = `<div class="muted">Laster…</div>`;
    ndtBody.innerHTML = `<div class="muted">Laster…</div>`;

    try {
      const res = await fetchCertData();

      if (seq !== state.loadSeq) return;

      state.welders = res.welders;
      state.welderCertsAll = res.welderCerts;
      state.ndtCertsAll = res.ndtCerts;

      renderLists();
    } catch (e: any) {
      console.error(e);
      welderBody.innerHTML = `<div class="err">Feil: ${String(e?.message ?? e)}</div>`;
      ndtBody.innerHTML = `<div class="err">Feil: ${String(e?.message ?? e)}</div>`;
    } finally {
      if (seq === state.loadSeq) setLoading(false);
    }
  }

  refreshBtn.addEventListener("click", () => load(), { signal });

  newWelderBtn.addEventListener(
    "click",
    () => openWelderCertModal(modalMount, signal, state.welders, "new", null, load),
    { signal }
  );

  newNdtBtn.addEventListener(
    "click",
    () => openNdtCertModal(modalMount, signal, "new", null, load),
    { signal }
  );

  // ---- Event delegation ----
  app.addEventListener(
    "click",
    async (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;

      // PDFs
      const welderPdfBtn = t.closest?.("button[data-openpdf-welder]") as HTMLButtonElement | null;
      if (welderPdfBtn) {
        const path = welderPdfBtn.getAttribute("data-openpdf-welder");
        if (path) await openWelderPdf(path);
        return;
      }

      const ndtPdfBtn = t.closest?.("button[data-openpdf-ndt]") as HTMLButtonElement | null;
      if (ndtPdfBtn) {
        const path = ndtPdfBtn.getAttribute("data-openpdf-ndt");
        if (path) await openNdtPdf(path);
        return;
      }

      // Edit welder cert
      const editWelder = t.closest?.("button[data-edit-weldercert]") as HTMLButtonElement | null;
      if (editWelder) {
        const id = editWelder.getAttribute("data-edit-weldercert") || "";
        const row = state.welderCertsAll.find((x) => x.id === id) ?? null;
        if (row) openWelderCertModal(modalMount, signal, state.welders, "edit", row, load);
        return;
      }

      // Edit ndt cert
      const editNdt = t.closest?.("button[data-edit-ndtcert]") as HTMLButtonElement | null;
      if (editNdt) {
        const id = editNdt.getAttribute("data-edit-ndtcert") || "";
        const row = state.ndtCertsAll.find((x) => x.id === id) ?? null;
        if (row) openNdtCertModal(modalMount, signal, "edit", row, load);
        return;
      }

      // Delete welder cert
      const delWelder = t.closest?.("button[data-del-weldercert]") as HTMLButtonElement | null;
      if (delWelder) {
        const id = delWelder.getAttribute("data-del-weldercert") || "";
        const label = delWelder.getAttribute("data-label") || "Sertifikat";

        await openConfirmDelete(modalMount, signal, {
          title: "Slett sveisesertifikat",
          messageHtml: `Er du sikker på at du vil slette <b>${label}</b>?`,
          onConfirm: async () => handleDeleteWelderCert(id),
          onDone: load,
        });
        return;
      }

      // Delete ndt cert
      const delNdt = t.closest?.("button[data-del-ndtcert]") as HTMLButtonElement | null;
      if (delNdt) {
        const id = delNdt.getAttribute("data-del-ndtcert") || "";
        const label = delNdt.getAttribute("data-label") || "Sertifikat";

        await openConfirmDelete(modalMount, signal, {
          title: "Slett NDT-sertifikat",
          messageHtml: `Er du sikker på at du vil slette <b>${label}</b>?`,
          onConfirm: async () => handleDeleteNdtCert(id),
          onDone: load,
        });
        return;
      }
    },
    { signal }
  );

  load();
  return (app as any).__certs_unmount as () => void;
}

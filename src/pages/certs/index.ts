import { renderHeader, wireHeader } from "../../components/header";
import { getIsAdmin, getSession, getProfileAccess } from "../../app/auth";
import { toast } from "../../ui/toast";
import { Footer } from "../../components/footer";
import { qs, esc } from "../../utils/dom";

import "../../styles/pages/certs.css";

import { fetchCertData, type WelderCertRow, type NdtCertRow } from "../../repo/certRepo";
import { fetchStandards, fetchStandardFmGroups } from "../../repo/standardRepo";
import { fetchMaterials } from "../../repo/materialRepo";
import { fetchNdtMethods } from "../../repo/ndtReportRepo";
import { createState, groupByWelder, groupByCompany } from "./state";

import { renderWelderGroup, renderNdtGroup, materialLabel } from "./templates";
import { openConfirmDelete } from "../../ui/confirm";
import {
  openWelderPdf,
  openNdtPdf,
  printWelderPdf,
  printNdtPdf,
  openWelderCertModal,
  openNdtCertModal,
  handleDeleteWelderCert,
  handleDeleteNdtCert,
} from "./handlers";


export async function renderCertsPage(app: HTMLElement) {
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
    <div class="shell page-certs">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">Sveisesertifikater</h1>
            <p class="section-subtitle">Bibliotek for sveisesertifikater og NDT-personell sertifikater.</p>
          </div>

          <div class="section-actions">
            <button data-new-welder class="btn accent small">Legg til sveisesertifikat</button>
            <button data-new-ndt class="btn accent small">Legg til NDT-personell sertifikat</button>
            <button data-refresh class="btn small">Oppdater</button>
          </div>
        </section>

        <section class="section-grid">
          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">Sveisesertifikater</div>
              <div data-welder-count class="panel-meta">—</div>
            </div>
            <div class="panel-body">
              <div class="panel-filters">
                <div class="filter-field">
                  <label>Sveiser</label>
                  <select class="select" data-filter-welder></select>
                </div>
                <div class="filter-field">
                  <label>Grunnmaterial</label>
                  <select class="select" data-filter-welder-material>
                    <option value="">Alle materialer</option>
                  </select>
                </div>
                <div class="filter-field">
                  <label>Fugetype</label>
                  <select class="select" data-filter-welder-joint>
                    <option value="">Alle</option>
                    <option value="FW">FW (Kilsveis)</option>
                    <option value="BW">BW (Buttsveis)</option>
                  </select>
                </div>
                <div class="filter-field">
                  <label>Status</label>
                  <select class="select" data-filter-welder-status>
                    <option value="">Alle</option>
                    <option value="ok">Gyldig</option>
                    <option value="warn">Utløper snart</option>
                    <option value="fault">Utløpt</option>
                  </select>
                </div>
                <div class="filter-field is-wide">
                  <label>Søk</label>
                  <input class="input" data-filter-welder-search placeholder="Søk sertifikat, standard, FM-gruppe..." />
                </div>
              </div>
              <div data-welder-body class="listmount"><div class="muted">Laster…</div></div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">NDT-personell sertifikater</div>
              <div data-ndt-count class="panel-meta">—</div>
            </div>
            <div class="panel-body">
              <div class="panel-filters">
                <div class="filter-field">
                  <label>Firma</label>
                  <select class="select" data-filter-ndt-company></select>
                </div>
                <div class="filter-field">
                  <label>NDT-metode</label>
                  <select class="select" data-filter-ndt-method></select>
                </div>
                <div class="filter-field">
                  <label>Status</label>
                  <select class="select" data-filter-ndt-status>
                    <option value="">Alle</option>
                    <option value="ok">Gyldig</option>
                    <option value="warn">Utløper snart</option>
                    <option value="fault">Utløpt</option>
                  </select>
                </div>
                <div class="filter-field is-wide">
                  <label>Søk</label>
                  <input class="input" data-filter-ndt-search placeholder="Søk sertifikat, kontrollør..." />
                </div>
              </div>
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

  const pageRoot = qs<HTMLElement>(app, ".page-certs");

  const welderBody = qs<HTMLDivElement>(app, "[data-welder-body]");
  const ndtBody = qs<HTMLDivElement>(app, "[data-ndt-body]");
  const welderCount = qs<HTMLDivElement>(app, "[data-welder-count]");
  const ndtCount = qs<HTMLDivElement>(app, "[data-ndt-count]");
  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");

  const refreshBtn = qs<HTMLButtonElement>(app, "[data-refresh]");
  const newWelderBtn = qs<HTMLButtonElement>(app, "[data-new-welder]");
  const newNdtBtn = qs<HTMLButtonElement>(app, "[data-new-ndt]");

  const welderFilter = qs<HTMLSelectElement>(app, "[data-filter-welder]");
  const welderMaterialFilter = qs<HTMLSelectElement>(app, "[data-filter-welder-material]");
  const welderJointFilter = qs<HTMLSelectElement>(app, "[data-filter-welder-joint]");
  const welderStatusFilter = qs<HTMLSelectElement>(app, "[data-filter-welder-status]");
  const welderSearchFilter = qs<HTMLInputElement>(app, "[data-filter-welder-search]");

  const ndtCompanyFilter = qs<HTMLSelectElement>(app, "[data-filter-ndt-company]");
  const ndtMethodFilter = qs<HTMLSelectElement>(app, "[data-filter-ndt-method]");
  const ndtStatusFilter = qs<HTMLSelectElement>(app, "[data-filter-ndt-status]");
  const ndtSearchFilter = qs<HTMLInputElement>(app, "[data-filter-ndt-search]");

  const filters = {
    welderId: "",
    material: "",
    joint: "",
    status: "",
    search: "",
    ndtCompany: "",
    ndtMethod: "",
    ndtStatus: "",
    ndtSearch: "",
  };

  const SOON_DAYS = 30;

  function expiryStatus(expiresAt: string | null) {
    if (!expiresAt) return "ok";
    const exp = new Date(`${expiresAt}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "fault";
    if (diffDays <= SOON_DAYS) return "warn";
    return "ok";
  }

  function norm(value: string) {
    return value.trim().toLowerCase();
  }

  function hasWelderFilters() {
    return !!(
      filters.welderId ||
      filters.material ||
      filters.joint ||
      filters.status ||
      filters.search
    );
  }

  function hasNdtFilters() {
    return !!(filters.ndtCompany || filters.ndtMethod || filters.ndtStatus || filters.ndtSearch);
  }

  function formatCount(filtered: number, total: number, active: boolean) {
    return active ? `${filtered} av ${total} stk` : `${total} stk`;
  }

  function filterWelderRows(rows: WelderCertRow[]) {
    let out = rows.slice();

    if (filters.welderId) {
      out = out.filter((r) => r.profile_id === filters.welderId);
    }

    if (filters.joint) {
      out = out.filter((r) => (r.coverage_joint_type || "").split(",").map((s) => s.trim()).includes(filters.joint));
    }

    if (filters.status) {
      out = out.filter((r) => expiryStatus(r.expires_at ?? null) === filters.status);
    }

    if (filters.material) {
      const q = norm(filters.material);
      out = out.filter((r) => {
        const label = r.base_material ? materialLabel(r.base_material) : "";
        return norm(label).includes(q);
      });
    }

    if (filters.search) {
      const q = norm(filters.search);
      out = out.filter((r) => {
        const welderNo = r.profile?.welder_no ? String(r.profile.welder_no) : "";
        const welderName = (r.profile?.display_name || "").trim();
        const baseMat = r.base_material ? materialLabel(r.base_material) : "";
        const hay = [
          r.certificate_no,
          r.standard,
          r.fm_group || "",
          r.coverage_joint_type || "",
          r.coverage_thickness || "",
          welderNo,
          welderName,
          baseMat,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return out;
  }

  function filterNdtRows(rows: NdtCertRow[]) {
    let out = rows.slice();

    if (filters.ndtCompany) {
      out = out.filter((r) => (r.company || "").trim() === filters.ndtCompany);
    }

    if (filters.ndtMethod) {
      out = out.filter((r) => (r.ndt_method || "").trim() === filters.ndtMethod);
    }

    if (filters.ndtStatus) {
      out = out.filter((r) => expiryStatus(r.expires_at ?? null) === filters.ndtStatus);
    }

    if (filters.ndtSearch) {
      const q = norm(filters.ndtSearch);
      out = out.filter((r) => {
        const hay = [r.certificate_no, r.ndt_method, r.personnel_name, r.company]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return out;
  }

  function setSelectOptions(
    select: HTMLSelectElement,
    items: Array<{ value: string; label: string }>,
    placeholder: string
  ) {
    const current = select.value;
    select.innerHTML =
      `<option value="">${esc(placeholder)}</option>` +
      items.map((item) => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join("");
    if (current && items.some((item) => item.value === current)) {
      select.value = current;
    } else {
      select.value = "";
    }
  }

  function renderFilterOptions() {
    const welderItems = state.welders.map((w) => {
      const no = w.welder_no == null ? "—" : String(w.welder_no).padStart(3, "0");
      const name = (w.display_name ?? "(uten navn)").trim();
      return { value: w.id, label: `${no} – ${name}` };
    });

    setSelectOptions(welderFilter, welderItems, "Alle sveisere");
    filters.welderId = welderFilter.value;

    const materialItems = state.materials.map((m) => ({ value: materialLabel(m), label: materialLabel(m) }));
    setSelectOptions(welderMaterialFilter, materialItems, "Alle materialer");
    filters.material = welderMaterialFilter.value;

    const companySet = new Set(state.ndtCerts.map((r) => (r.company || "").trim()).filter(Boolean));
    const companyItems = Array.from(companySet)
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ value: c, label: c }));

    const methodSet = new Set(state.ndtMethods.map((m) => m.label));
    for (const row of state.ndtCerts) {
      if (row.ndt_method) methodSet.add(row.ndt_method);
    }
    const methodItems = Array.from(methodSet)
      .sort((a, b) => a.localeCompare(b))
      .map((m) => ({ value: m, label: m }));

    setSelectOptions(ndtCompanyFilter, companyItems, "Alle firma");
    setSelectOptions(ndtMethodFilter, methodItems, "Alle metoder");
    filters.ndtCompany = ndtCompanyFilter.value;
    filters.ndtMethod = ndtMethodFilter.value;
  }

  function setLoading(isLoading: boolean) {
    state.loading = isLoading;
    refreshBtn.disabled = isLoading;
    newWelderBtn.disabled = isLoading;
    newNdtBtn.disabled = isLoading;
  }

  function wireFilters() {
    welderFilter.addEventListener(
      "change",
      () => {
        filters.welderId = welderFilter.value;
        renderLists();
      },
      { signal }
    );

    welderMaterialFilter.addEventListener(
      "change",
      () => {
        filters.material = welderMaterialFilter.value;
        renderLists();
      },
      { signal }
    );

    welderJointFilter.addEventListener(
      "change",
      () => {
        filters.joint = welderJointFilter.value;
        renderLists();
      },
      { signal }
    );

    welderStatusFilter.addEventListener(
      "change",
      () => {
        filters.status = welderStatusFilter.value;
        renderLists();
      },
      { signal }
    );

    welderSearchFilter.addEventListener(
      "input",
      () => {
        filters.search = welderSearchFilter.value;
        renderLists();
      },
      { signal }
    );

    ndtCompanyFilter.addEventListener(
      "change",
      () => {
        filters.ndtCompany = ndtCompanyFilter.value;
        renderLists();
      },
      { signal }
    );

    ndtMethodFilter.addEventListener(
      "change",
      () => {
        filters.ndtMethod = ndtMethodFilter.value;
        renderLists();
      },
      { signal }
    );

    ndtStatusFilter.addEventListener(
      "change",
      () => {
        filters.ndtStatus = ndtStatusFilter.value;
        renderLists();
      },
      { signal }
    );

    ndtSearchFilter.addEventListener(
      "input",
      () => {
        filters.ndtSearch = ndtSearchFilter.value;
        renderLists();
      },
      { signal }
    );
  }

  function renderLists() {
    const welderFiltered = filterWelderRows(state.welderCerts);
    const ndtFiltered = filterNdtRows(state.ndtCerts);

    welderCount.textContent = formatCount(welderFiltered.length, state.welderCerts.length, hasWelderFilters());
    ndtCount.textContent = formatCount(ndtFiltered.length, state.ndtCerts.length, hasNdtFilters());

    const welderGrouped = groupByWelder(welderFiltered);
    const ndtGrouped = groupByCompany(ndtFiltered);

    // NB: showActions styres i UI basert på admin-tilgang.
    const showActions = state.isAdmin;

    welderBody.innerHTML =
      welderGrouped.length === 0
        ? `<div class="muted">${hasWelderFilters() ? "Ingen treff." : "Ingen data."}</div>`
        : welderGrouped.map(([k, rows]) => renderWelderGroup(k, rows, showActions, state.standards)).join("");

    ndtBody.innerHTML =
      ndtGrouped.length === 0
        ? `<div class="muted">${hasNdtFilters() ? "Ingen treff." : "Ingen data."}</div>`
        : ndtGrouped.map(([m, rows]) => renderNdtGroup(m, rows, showActions)).join("");
  }

  function requireAdmin() {
    if (state.isAdmin) return true;
    toast("Kun admin har tilgang til dette.");
    return false;
  }

  function updateAdminUi() {
    const show = state.isAdmin;
    newWelderBtn.style.display = show ? "" : "none";
    newNdtBtn.style.display = show ? "" : "none";
  }

  async function load() {
    const seq = ++state.loadSeq;

    setLoading(true);
    welderBody.innerHTML = `<div class="muted">Laster…</div>`;
    ndtBody.innerHTML = `<div class="muted">Laster…</div>`;

    try {
      const [res, standards, fmGroups, materials, ndtMethods] = await Promise.all([
        fetchCertData(),
        fetchStandards(),
        fetchStandardFmGroups(),
        fetchMaterials(),
        fetchNdtMethods(),
      ]);

      if (seq !== state.loadSeq) return;

      state.welders = res.welders;
      state.welderCerts = res.welderCerts;
      state.ndtCerts = res.ndtCerts;
      state.standards = standards;
      state.fmGroups = fmGroups;
      state.materials = materials;
      state.ndtMethods = ndtMethods;

      renderFilterOptions();
      renderLists();
    } catch (e: any) {
      console.error(e);
      welderBody.innerHTML = `<div class="err">Feil: ${String(e?.message ?? e)}</div>`;
      ndtBody.innerHTML = `<div class="err">Feil: ${String(e?.message ?? e)}</div>`;
    } finally {
      if (seq === state.loadSeq) setLoading(false);
    }
  }

  wireFilters();

  refreshBtn.addEventListener("click", () => load(), { signal });

  newWelderBtn.addEventListener(
    "click",
    () => {
      if (!requireAdmin()) return;
      openWelderCertModal(
        modalMount,
        signal,
        state.welders,
        state.standards,
        state.fmGroups,
        state.materials,
        "new",
        null,
        load
      );
    },
    { signal }
  );

  newNdtBtn.addEventListener(
    "click",
    () => {
      if (!requireAdmin()) return;
      openNdtCertModal(modalMount, signal, state.ndtMethods, "new", null, load);
    },
    { signal }
  );

  // ---- Event delegation ----
  pageRoot.addEventListener(
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

      const printWelderBtn = t.closest?.("button[data-print-weldercert]") as HTMLButtonElement | null;
      if (printWelderBtn) {
        const id = printWelderBtn.getAttribute("data-print-weldercert") || "";
        const row = state.welderCerts.find((x: WelderCertRow) => x.id === id) ?? null;
        const ref = row?.file_id || row?.pdf_path || "";
        if (!ref) {
          toast("Ingen PDF tilgjengelig for utskrift.");
          return;
        }
        try {
          await printWelderPdf(ref);
        } catch (e: any) {
          console.error(e);
          toast(String(e?.message ?? e));
        }
        return;
      }

      const printNdtBtn = t.closest?.("button[data-print-ndtcert]") as HTMLButtonElement | null;
      if (printNdtBtn) {
        const id = printNdtBtn.getAttribute("data-print-ndtcert") || "";
        const row = state.ndtCerts.find((x: NdtCertRow) => x.id === id) ?? null;
        const ref = row?.file_id || row?.pdf_path || "";
        if (!ref) {
          toast("Ingen PDF tilgjengelig for utskrift.");
          return;
        }
        try {
          await printNdtPdf(ref);
        } catch (e: any) {
          console.error(e);
          toast(String(e?.message ?? e));
        }
        return;
      }

      // Edit welder cert
      const editWelder = t.closest?.("button[data-edit-weldercert]") as HTMLButtonElement | null;
      if (editWelder) {
        if (!requireAdmin()) return;
        const id = editWelder.getAttribute("data-edit-weldercert") || "";
        const row = state.welderCerts.find((x: WelderCertRow) => x.id === id) ?? null;
        if (row) {
          openWelderCertModal(
            modalMount,
            signal,
            state.welders,
            state.standards,
            state.fmGroups,
            state.materials,
            "edit",
            row,
            load
          );
        }
        return;
      }

      // Edit ndt cert
      const editNdt = t.closest?.("button[data-edit-ndtcert]") as HTMLButtonElement | null;
      if (editNdt) {
        if (!requireAdmin()) return;
        const id = editNdt.getAttribute("data-edit-ndtcert") || "";
        const row = state.ndtCerts.find((x: NdtCertRow) => x.id === id) ?? null;
        if (row) openNdtCertModal(modalMount, signal, state.ndtMethods, "edit", row, load);
        return;
      }

      // Delete welder cert
      const delWelder = t.closest?.("button[data-del-weldercert]") as HTMLButtonElement | null;
      if (delWelder) {
        if (!requireAdmin()) return;
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
        if (!requireAdmin()) return;
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

  updateAdminUi();
  getIsAdmin()
    .then((isAdmin) => {
      state.isAdmin = isAdmin;
      updateAdminUi();
      renderLists();
    })
    .catch((e) => console.warn("Admin-rolle feilet", e));

  load();
  return (app as any).__certs_unmount as () => void;
}

import { renderHeader, wireHeader } from "../../components/header";
import { getIsAdmin, getSession, getProfileAccess } from "../../app/auth";
import { toast } from "../../ui/toast";
import { Footer } from "../../components/footer";
import { esc, qs } from "../../utils/dom";

import "../../styles/pages/ndt.css";

import { fetchWelders } from "../../repo/certRepo";
import { fetchCustomers } from "../../repo/customerRepo";
import { fetchProjects } from "../../repo/projectRepo";
import { fetchNdtMethods, fetchNdtReports } from "../../repo/ndtReportRepo";
import { createState } from "./state";
import { renderReportTable } from "./templates";
import { buildTypePillMap, typePillClass } from "../../ui/typePill";
import { renderPagerButtons } from "../../ui/pager";
import { openPdf, openNdtReportModal, handleDeleteReport, printNdtReportPdf, uploadNdtBatchWithMeta, type NdtUploadEntry } from "./handlers";
import { openConfirmDelete } from "../../ui/confirm";
import { iconSvg } from "../../ui/iconButton";

export async function renderNdtPage(app: HTMLElement) {
  // ---- SPA lifecycle: unngå dobbel mount ----
  const prev = (app as any).__ndt_unmount as undefined | (() => void);
  if (prev) prev();

  const controller = new AbortController();
  const { signal } = controller;

  (app as any).__ndt_unmount = () => {
    controller.abort();
    (app as any).__ndt_unmount = undefined;
  };

  const state = createState();

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
    <div class="shell page-ndt">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">NDT</h1>
            <p class="section-subtitle">Basket for alle NDT-rapporter med enkel opplasting og filtrering.</p>
          </div>
          <div class="section-actions">
            <button data-open-upload class="btn accent small">Legg til filer</button>
            <button data-refresh class="btn small">Oppdater</button>
          </div>
        </section>

        <section class="panel panel-upload upload-panel" data-upload-panel hidden>
          <div class="panel-head">
            <div>
              <div class="panel-title">Legg til filer</div>
              <div class="panel-meta">Legg til flere NDT-rapporter og fyll inn prosjektnr, metode og sveisere.</div>
            </div>
            <div class="panel-actions">
              <button class="iconbtn btnlike" type="button" data-upload-close aria-label="Skjul" title="Skjul">
                ${iconSvg("chevron-up")}
              </button>
            </div>
          </div>
          <div class="panel-body" data-upload-body></div>
          <div class="panel-footer">
            <div class="upload-status muted" data-upload-status>—</div>
            <div class="upload-actions">
              <button class="iconbtn btnlike" type="button" data-upload-clear aria-label="Nullstill" title="Nullstill">
                ${iconSvg("rotate-ccw")}
              </button>&nbsp;
              <button class="btn accent small" type="button" data-upload-save>Last opp</button>
            </div>
          </div>
        </section>

        <section class="filters">
          <div class="field">
            <label>Metode</label>
            <select data-filter-method class="select">
              <option value="">Alle metoder</option>
            </select>
          </div>
          <div class="field">
            <label>Prosjekt</label>
            <select data-filter-project class="select">
              <option value="">Alle prosjekter</option>
            </select>
          </div>
          <div class="field">
            <label>År</label>
            <select data-filter-year class="select">
              <option value="">Alle år</option>
            </select>
          </div>
          <div class="field">
            <label>Sveiser</label>
            <select data-filter-welder class="select">
              <option value="">Alle sveisere</option>
            </select>
          </div>
          <div class="field">
            <label>Søk</label>
            <input data-filter-text class="input" placeholder="Filnavn, prosjektnr eller kunde…" />
          </div>
        </section>

        <section class="panel panel-rt">
          <div class="panel-head">
            <div class="panel-title">Statistikk</div>
            <div class="panel-meta">Mål <2%</div>
          </div>
          <div class="panel-body">
            <div data-rt-stats class="listmount"><div class="muted">Laster…</div></div>
          </div>
        </section>

        <section class="section-grid">
          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">Rapporter</div>
              <div class="panel-head-center" data-method-pills></div>
              <div class="panel-actions">
                <div data-report-count class="panel-meta">—</div>
              </div>
            </div>
            <div class="panel-body">
              <div data-report-body class="listmount"><div class="muted">Laster…</div></div>
              <div class="panel-footer">
                <div class="pager pager-bottom" data-pager></div>
              </div>
            </div>
          </div>
        </section>

        <div data-modal-mount></div>
      </main>

      ${Footer()}
    </div>
  `;

  wireHeader(app);

  const reportBody = qs<HTMLDivElement>(app, "[data-report-body]");
  const reportCount = qs<HTMLDivElement>(app, "[data-report-count]");
  const pager = qs<HTMLDivElement>(app, "[data-pager]");
  const methodPills = qs<HTMLDivElement>(app, "[data-method-pills]");
  const rtStats = qs<HTMLDivElement>(app, "[data-rt-stats]");
  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");

  const refreshBtn = qs<HTMLButtonElement>(app, "[data-refresh]");
  const openUploadBtn = qs<HTMLButtonElement>(app, "[data-open-upload]");
  const uploadPanel = qs<HTMLElement>(app, "[data-upload-panel]");
  const uploadBody = qs<HTMLDivElement>(app, "[data-upload-body]");
  const uploadStatus = qs<HTMLDivElement>(app, "[data-upload-status]");
  const uploadClose = qs<HTMLButtonElement>(app, "[data-upload-close]");
  const uploadClear = qs<HTMLButtonElement>(app, "[data-upload-clear]");
  const uploadSave = qs<HTMLButtonElement>(app, "[data-upload-save]");

  const filterMethod = qs<HTMLSelectElement>(app, "[data-filter-method]");
  const filterProject = qs<HTMLSelectElement>(app, "[data-filter-project]");
  const filterYear = qs<HTMLSelectElement>(app, "[data-filter-year]");
  const filterWelder = qs<HTMLSelectElement>(app, "[data-filter-welder]");
  const filterText = qs<HTMLInputElement>(app, "[data-filter-text]");

  type UploadEntry = {
    id: string;
    file: File;
    title: string;
    customer: string;
    reportDate: string;
    methodId: string;
    welderIds: string[];
    welderStats: Map<string, { weld_count: number | null; defect_count: number | null }>;
  };

  let uploadEntries: UploadEntry[] = [];
  let uploadInitialized = false;
  let uploadPreviewUrl: string | null = null;
  let uploadPreviewName: string | null = null;
  let uploadPreviewId: string | null = null;
  let uploadingIds = new Set<string>();

  let uploadProject: HTMLSelectElement | null = null;
  let uploadCustomer: HTMLSelectElement | null = null;
  let uploadDate: HTMLInputElement | null = null;
  let uploadMethod: HTMLSelectElement | null = null;
  let uploadInput: HTMLInputElement | null = null;
  let uploadList: HTMLDivElement | null = null;
  let uploadDropzone: HTMLDivElement | null = null;

  const formatWelderLabel = (w: { welder_no: string | null; display_name: string | null }) => {
    const no = w.welder_no ? String(w.welder_no).padStart(3, "0") : "—";
    const name = (w.display_name || "Uten navn").trim();
    return `${no} – ${name}`;
  };

  const buildProjectOptions = (selected: string) => {
    const base = state.projects
      .map((p) => ({ no: String(p.project_no), name: p.name }))
      .sort((a, b) => a.no.localeCompare(b.no, "nb-NO", { numeric: true }))
      .map((p) => `<option value="${esc(p.no)}" ${p.no === selected ? "selected" : ""}>${esc(`${p.no} - ${p.name}`)}</option>`)
      .join("");

    if (selected && !state.projects.some((p) => String(p.project_no) === selected)) {
      return `<option value="${esc(selected)}" selected>${esc(selected)}</option>${base}`;
    }
    return base;
  };

  const buildCustomerOptions = (selected: string) => {
    const base = state.customers
      .map((c) => `<option value="${esc(c.name)}" ${c.name === selected ? "selected" : ""}>${esc(c.name)}</option>`)
      .join("");
    if (selected && !state.customers.some((c) => c.name === selected)) {
      return `<option value="${esc(selected)}" selected>${esc(selected)}</option>${base}`;
    }
    return base;
  };

  const buildMethodOptions = (selected: string) => {
    const base = state.methods
      .map((m) => `<option value="${esc(m.id)}" ${m.id === selected ? "selected" : ""}>${esc(m.label)}</option>`)
      .join("");
    if (selected && !state.methods.some((m) => m.id === selected)) {
      return `<option value="${esc(selected)}" selected>${esc(selected)}</option>${base}`;
    }
    return base;
  };

  const getMethodById = (id: string) => state.methods.find((m) => m.id === id);

  const syncCustomerForProject = (projectNo: string, fallback: string) => {
    const projectMap = new Map(state.projects.map((p) => [String(p.project_no), p]));
    return projectMap.get(projectNo)?.customer ?? fallback;
  };

  function renderUploadPanelBody() {
    const today = new Date().toISOString().slice(0, 10);
    return `
      <div class="upload-grid">
        <div class="field">
          <label>Prosjektnr (for alle)</label>
          <select data-upload-project class="select">
            <option value="">Velg prosjekt…</option>
            ${buildProjectOptions("")}
          </select>
        </div>
        <div class="field">
          <label>Kunde (for alle)</label>
          <select data-upload-customer class="select">
            <option value="">Velg kunde…</option>
            ${buildCustomerOptions("")}
          </select>
        </div>
        <div class="field">
          <label>Rapportdato (for alle)</label>
          <input data-upload-date class="input" type="date" value="${today}" />
        </div>
        <div class="field">
          <label>NDT-metode (for alle)</label>
          <select data-upload-method class="select">
            <option value="">Velg metode…</option>
            ${buildMethodOptions("")}
          </select>
        </div>
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>PDF-filer</label>
        <div class="dropzone" data-upload-dropzone>
          <div class="dropzone-title">Dra og slipp filer her</div>
          <div class="dropzone-sub">Støtter PDF-format</div>
          <input data-upload-files type="file" class="input" accept="application/pdf" multiple />
        </div>
        <div class="filelist" data-upload-list></div>
      </div>
    `;
  }

  const renderUploadList = () => {
    if (!uploadList) return;

    if (uploadEntries.length === 0) {
      uploadList.innerHTML = `<div class="muted">Ingen filer valgt.</div>`;
      if (uploadStatus) uploadStatus.textContent = "Ingen filer valgt.";
      if (uploadSave) uploadSave.disabled = true;
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl);
        uploadPreviewUrl = null;
        uploadPreviewName = null;
        uploadPreviewId = null;
      }
      return;
    }

    const previewPanel = uploadPreviewUrl
      ? `
        <div class="upload-preview-dock">
          <div class="upload-preview-head">
            <div class="upload-preview-title">${esc(uploadPreviewName || "Forhåndsvisning")}</div>
            <button type="button" class="iconbtn btnlike" data-preview-close aria-label="Lukk" title="Lukk">
              ${iconSvg("x")}
            </button>
          </div>
          <iframe class="upload-preview-frame" src="${esc(uploadPreviewUrl)}" title="Forhåndsvisning"></iframe>
        </div>
      `
      : "";

    const welderLabelMap = new Map(state.welders.map((w) => [w.id, formatWelderLabel(w)]));

    uploadList.innerHTML = `
      <div class="upload-list-wrap">
        ${previewPanel}
        <div class="upload-file-list">
          ${uploadEntries
            .map((entry) => {
              const method = getMethodById(entry.methodId);
              const isRt = method?.code === "RT";
              const isUploading = uploadingIds.has(entry.id);

              const welderOptions = state.welders
                .map((w) => {
                  const label = formatWelderLabel(w);
                  const checked = entry.welderIds.includes(w.id) ? "checked" : "";
                  return `
                    <label class="checkboxpill welder-pill" data-welder-label="${esc(label.toLowerCase())}">
                      <input type="checkbox" data-file-welder data-file-id="${esc(entry.id)}" value="${esc(w.id)}" ${checked} />
                      <span>${esc(label)}</span>
                    </label>
                  `;
                })
                .join("");

              const rtCounts = isRt
                ? entry.welderIds
                    .map((id) => {
                      const label = welderLabelMap.get(id) || id;
                      const values = entry.welderStats.get(id);
                      const weldValue = values?.weld_count ?? "";
                      const defectValue = values?.defect_count ?? "";
                      return `
                        <div class="welder-count-row" data-welder-id="${esc(id)}">
                          <div class="welder-count-label">${esc(label)}</div>
                          <input class="input" data-file-weld-count data-file-id="${esc(entry.id)}" data-welder-id="${esc(id)}" type="number" min="0" step="1" placeholder="Antall sveis" value="${esc(String(weldValue))}" />
                          <input class="input" data-file-defect-count data-file-id="${esc(entry.id)}" data-welder-id="${esc(id)}" type="number" min="0" step="1" placeholder="Antall feil" value="${esc(String(defectValue))}" />
                        </div>
                      `;
                    })
                    .join("")
                : "";

              const rtBody = isRt
                ? `
                  <div class="field">
                    <label>Fordeling pr sveiser (RT)</label>
                    <div class="welder-counts" data-file-rt>
                      ${rtCounts || `<div class=\"muted\">Ingen sveisere valgt.</div>`}
                    </div>
                    <div class="muted" style="font-size:12px;">Oppgi antall sveis og feil per sveiser for RT-rapporter.</div>
                  </div>
                `
                : "";

              return `
                <div class="upload-file-card" data-file-id="${esc(entry.id)}">
                  <div class="upload-file-head">
                    <div>
                      <div class="upload-file-name">${esc(entry.file.name)}</div>
                      <div class="upload-file-meta">Klar</div>
                    </div>
                    <div class="upload-file-actions">
                      <button type="button" class="iconbtn btnlike" data-file-preview="${esc(entry.id)}" aria-label="Forhandsvis" title="Forhandsvis">
                        ${iconSvg("eye")}
                      </button>
                      <button type="button" class="btn tiny ${isUploading ? "" : "accent"}" data-file-upload="${esc(entry.id)}" ${isUploading ? "disabled" : ""}>
                        ${isUploading ? "Laster opp…" : "Last opp"}
                      </button>
                      <button type="button" class="iconbtn btnlike danger" data-file-remove="${esc(entry.id)}" aria-label="Fjern" title="Fjern">
                        ${iconSvg("trash")}
                      </button>
                    </div>
                  </div>
                  <div class="upload-file-body">
                    <div class="upload-file-fields">
                      <div class="upload-col">
                        <div class="field">
                          <label>Prosjektnr</label>
                          <select class="select" data-file-project data-file-id="${esc(entry.id)}">
                            <option value="">Velg prosjekt…</option>
                            ${buildProjectOptions(entry.title)}
                          </select>
                        </div>
                        <div class="field">
                          <label>Kunde</label>
                          <select class="select" data-file-customer data-file-id="${esc(entry.id)}">
                            <option value="">Velg kunde…</option>
                            ${buildCustomerOptions(entry.customer)}
                          </select>
                        </div>
                        <div class="field">
                          <label>Rapportdato</label>
                          <input class="input" type="date" data-file-date data-file-id="${esc(entry.id)}" value="${esc(entry.reportDate)}" />
                        </div>
                        <div class="field">
                          <label>NDT-metode</label>
                          <select class="select" data-file-method data-file-id="${esc(entry.id)}">
                            <option value="">Velg metode…</option>
                            ${buildMethodOptions(entry.methodId)}
                          </select>
                        </div>
                      </div>
                      <div class="upload-col">
                        <div class="field">
                          <label>Sveisere</label>
                          <input class="input" data-file-welder-search data-file-id="${esc(entry.id)}" placeholder="Søk sveiser…" />
                          <div class="welder-list" data-file-welder-list data-file-id="${esc(entry.id)}">
                            ${welderOptions || `<div class=\"muted\">Ingen sveisere funnet.</div>`}
                          </div>
                        </div>
                        ${rtBody}
                      </div>
                    </div>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    if (uploadStatus) {
      uploadStatus.textContent = `${uploadEntries.length} filer`;
    }
    if (uploadSave) uploadSave.disabled = uploadEntries.length === 0;
  };

  const setUploadPreview = (entry: UploadEntry | null) => {
    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
      uploadPreviewUrl = null;
      uploadPreviewName = null;
      uploadPreviewId = null;
    }
    if (!entry) {
      renderUploadList();
      return;
    }
    uploadPreviewUrl = URL.createObjectURL(entry.file);
    uploadPreviewName = entry.file.name;
    uploadPreviewId = entry.id;
    renderUploadList();
  };

  const buildUploadPayload = (entry: UploadEntry): NdtUploadEntry => {
    const title = (entry.title || "").trim();
    const customer = (entry.customer || "").trim();
    const report_date = (entry.reportDate || "").trim();
    const method_id = (entry.methodId || "").trim();

    if (!title || !customer || !report_date) {
      throw new Error("Velg prosjektnr, kunde og dato.");
    }
    if (!method_id) throw new Error("Velg NDT-metode.");

    const method = getMethodById(method_id);
    const isRt = method?.code === "RT";
    const welder_stats = entry.welderIds.map((welder_id) => {
      const v = entry.welderStats.get(welder_id);
      return { welder_id, weld_count: v?.weld_count ?? null, defect_count: v?.defect_count ?? null };
    });

    if (isRt) {
      if (welder_stats.length === 0) throw new Error("Velg minst en sveiser for RT.");
      const missing = welder_stats.some(
        (s) => s.weld_count == null || Number.isNaN(s.weld_count) || s.defect_count == null || Number.isNaN(s.defect_count)
      );
      if (missing) throw new Error("Oppgi antall sveis og feil per sveiser for RT.");
      const totalWelds = welder_stats.reduce((sum, s) => sum + (s.weld_count ?? 0), 0);
      if (totalWelds <= 0) throw new Error("Antall sveis må være større enn 0 for RT.");
    }

    const totalWelds = welder_stats.length > 0 ? welder_stats.reduce((sum, s) => sum + (s.weld_count ?? 0), 0) : null;
    const totalDefects = welder_stats.length > 0 ? welder_stats.reduce((sum, s) => sum + (s.defect_count ?? 0), 0) : null;
    const weld_count = isRt ? totalWelds : null;
    const defect_count = isRt ? totalDefects : null;

    return {
      file: entry.file,
      method_id,
      weld_count,
      defect_count,
      title,
      customer,
      report_date,
      welder_stats,
    };
  };

  const uploadSingle = async (entry: UploadEntry) => {
    if (uploadingIds.has(entry.id)) return;

    uploadingIds.add(entry.id);
    renderUploadList();

    try {
      await uploadNdtBatchWithMeta([buildUploadPayload(entry)]);
      if (uploadPreviewId === entry.id) setUploadPreview(null);
      uploadEntries = uploadEntries.filter((e) => e.id !== entry.id);
      await load();
    } catch (e: any) {
      console.error(e);
      alert(String(e?.message ?? e));
    } finally {
      uploadingIds.delete(entry.id);
      renderUploadList();
    }
  };

  const addUploadFiles = (files: File[]) => {
    const existingKeys = new Set(uploadEntries.map((e) => `${e.file.name}:${e.file.size}`));
    const nextEntries: UploadEntry[] = [];

    const globalProject = (uploadProject?.value || "").trim();
    const globalCustomer = (uploadCustomer?.value || "").trim();
    const globalDate = (uploadDate?.value || "").trim();
    const globalMethod = (uploadMethod?.value || "").trim();

    files.forEach((file) => {
      const key = `${file.name}:${file.size}`;
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        toast(`Hopper over ${file.name}: ikke en PDF.`);
        return;
      }
      if (existingKeys.has(key)) return;

      const syncedCustomer = globalProject ? syncCustomerForProject(globalProject, globalCustomer) : globalCustomer;

      nextEntries.push({
        id: crypto.randomUUID(),
        file,
        title: globalProject,
        customer: syncedCustomer,
        reportDate: globalDate,
        methodId: globalMethod,
        welderIds: [],
        welderStats: new Map(),
      });
      existingKeys.add(key);
    });

    if (nextEntries.length === 0) return;
    uploadEntries = [...uploadEntries, ...nextEntries];
    renderUploadList();
  };

  const initUploadPanel = () => {
    uploadBody.innerHTML = renderUploadPanelBody();
    uploadProject = qs<HTMLSelectElement>(uploadBody, "[data-upload-project]");
    uploadCustomer = qs<HTMLSelectElement>(uploadBody, "[data-upload-customer]");
    uploadDate = qs<HTMLInputElement>(uploadBody, "[data-upload-date]");
    uploadMethod = qs<HTMLSelectElement>(uploadBody, "[data-upload-method]");
    uploadInput = qs<HTMLInputElement>(uploadBody, "[data-upload-files]");
    uploadList = qs<HTMLDivElement>(uploadBody, "[data-upload-list]");
    uploadDropzone = qs<HTMLDivElement>(uploadBody, "[data-upload-dropzone]");

    uploadProject.addEventListener(
      "change",
      () => {
        const nextProject = (uploadProject?.value || "").trim();
        const nextCustomer = nextProject ? syncCustomerForProject(nextProject, uploadCustomer?.value || "") : (uploadCustomer?.value || "");
        if (uploadCustomer) uploadCustomer.value = nextCustomer;
        uploadEntries = uploadEntries.map((entry) => ({
          ...entry,
          title: nextProject,
          customer: nextCustomer,
        }));
        renderUploadList();
      },
      { signal }
    );

    uploadCustomer.addEventListener(
      "change",
      () => {
        const nextCustomer = (uploadCustomer?.value || "").trim();
        uploadEntries = uploadEntries.map((entry) => ({ ...entry, customer: nextCustomer }));
        renderUploadList();
      },
      { signal }
    );

    uploadDate.addEventListener(
      "change",
      () => {
        const nextDate = (uploadDate?.value || "").trim();
        uploadEntries = uploadEntries.map((entry) => ({ ...entry, reportDate: nextDate }));
        renderUploadList();
      },
      { signal }
    );

    uploadMethod.addEventListener(
      "change",
      () => {
        const nextMethod = (uploadMethod?.value || "").trim();
        uploadEntries = uploadEntries.map((entry) => ({ ...entry, methodId: nextMethod }));
        renderUploadList();
      },
      { signal }
    );

    uploadInput.addEventListener(
      "change",
      () => {
        addUploadFiles(Array.from(uploadInput?.files ?? []));
        if (uploadInput) uploadInput.value = "";
      },
      { signal }
    );

    uploadDropzone.addEventListener(
      "dragover",
      (e) => {
        e.preventDefault();
        uploadDropzone?.classList.add("is-drag");
      },
      { signal }
    );

    uploadDropzone.addEventListener(
      "dragleave",
      () => {
        uploadDropzone?.classList.remove("is-drag");
      },
      { signal }
    );

    uploadDropzone.addEventListener(
      "drop",
      (e) => {
        e.preventDefault();
        uploadDropzone?.classList.remove("is-drag");
        const dt = e.dataTransfer;
        if (!dt?.files?.length) return;
        addUploadFiles(Array.from(dt.files));
      },
      { signal }
    );

    uploadList.addEventListener(
      "click",
      (e) => {
        const target = e.target as HTMLElement;
        const previewId = target.closest("[data-file-preview]")?.getAttribute("data-file-preview");
        if (previewId) {
          const entry = uploadEntries.find((f) => f.id === previewId) || null;
          setUploadPreview(entry);
          return;
        }

        const closePreview = target.closest("[data-preview-close]");
        if (closePreview) {
          setUploadPreview(null);
          return;
        }

        const removeId = target.closest("[data-file-remove]")?.getAttribute("data-file-remove");
        if (removeId) {
          uploadEntries = uploadEntries.filter((entry) => entry.id !== removeId);
          if (uploadPreviewId === removeId) setUploadPreview(null);
          renderUploadList();
          return;
        }

        const uploadId = target.closest("[data-file-upload]")?.getAttribute("data-file-upload");
        if (uploadId) {
          const entry = uploadEntries.find((f) => f.id === uploadId);
          if (entry) void uploadSingle(entry);
        }
      },
      { signal }
    );

    uploadList.addEventListener(
      "change",
      (e) => {
        const target = e.target as HTMLElement;
        const fileId = target.closest("[data-file-id]")?.getAttribute("data-file-id") || "";
        const entry = uploadEntries.find((f) => f.id === fileId);
        if (!entry) return;

        if (target.matches("[data-file-project]")) {
          const nextProject = (target as HTMLSelectElement).value || "";
          const nextCustomer = nextProject ? syncCustomerForProject(nextProject, entry.customer) : entry.customer;
          entry.title = nextProject;
          entry.customer = nextCustomer;
          renderUploadList();
          return;
        }

        if (target.matches("[data-file-customer]")) {
          entry.customer = (target as HTMLSelectElement).value || "";
          renderUploadList();
          return;
        }

        if (target.matches("[data-file-date]")) {
          entry.reportDate = (target as HTMLInputElement).value || "";
          renderUploadList();
          return;
        }

        if (target.matches("[data-file-method]")) {
          entry.methodId = (target as HTMLSelectElement).value || "";
          renderUploadList();
          return;
        }

        if (target.matches("[data-file-welder]")) {
          const input = target as HTMLInputElement;
          const welderId = input.value;
          if (input.checked) {
            if (!entry.welderIds.includes(welderId)) entry.welderIds.push(welderId);
          } else {
            entry.welderIds = entry.welderIds.filter((id) => id !== welderId);
            entry.welderStats.delete(welderId);
          }
          renderUploadList();
        }
      },
      { signal }
    );

    uploadList.addEventListener(
      "input",
      (e) => {
        const target = e.target as HTMLElement;
        if (target.matches("[data-file-welder-search]")) {
          const field = target as HTMLInputElement;
          const q = (field.value || "").trim().toLowerCase();
          const container = target.closest("[data-file-id]")?.querySelector<HTMLElement>("[data-file-welder-list]");
          if (!container) return;
          container.querySelectorAll<HTMLElement>(".welder-pill").forEach((pill) => {
            const label = (pill.dataset.welderLabel || "").toLowerCase();
            const match = !q || label.includes(q);
            pill.style.display = match ? "" : "none";
          });
          return;
        }

        if (target.matches("[data-file-weld-count], [data-file-defect-count]")) {
          const input = target as HTMLInputElement;
          const fileId = input.getAttribute("data-file-id") || "";
          const welderId = input.getAttribute("data-welder-id") || "";
          if (!fileId || !welderId) return;
          const entry = uploadEntries.find((f) => f.id === fileId);
          if (!entry) return;
          const current = entry.welderStats.get(welderId) ?? { weld_count: null, defect_count: null };
          const value = (input.value || "").trim();
          const numeric = value ? Number(value) : null;
          if (input.matches("[data-file-weld-count]")) {
            entry.welderStats.set(welderId, { ...current, weld_count: numeric });
          } else {
            entry.welderStats.set(welderId, { ...current, defect_count: numeric });
          }
        }
      },
      { signal }
    );

    renderUploadList();
  };

  const ensureUploadPanel = () => {
    if (uploadInitialized) return;
    initUploadPanel();
    uploadInitialized = true;
  };

  const refreshUploadSelects = () => {
    if (!uploadInitialized || !uploadProject || !uploadCustomer || !uploadMethod) return;
    const projectValue = uploadProject.value || "";
    const customerValue = uploadCustomer.value || "";
    const methodValue = uploadMethod.value || "";

    uploadProject.innerHTML = `<option value="">Velg prosjekt…</option>${buildProjectOptions(projectValue)}`;
    uploadCustomer.innerHTML = `<option value="">Velg kunde…</option>${buildCustomerOptions(customerValue)}`;
    uploadMethod.innerHTML = `<option value="">Velg metode…</option>${buildMethodOptions(methodValue)}`;

    uploadProject.value = projectValue;
    uploadCustomer.value = customerValue;
    uploadMethod.value = methodValue;
    renderUploadList();
  };

  function setLoading(isLoading: boolean) {
    state.loading = isLoading;
    refreshBtn.disabled = isLoading;
    openUploadBtn.disabled = isLoading || !state.isAdmin;
  }

  function renderFilters() {
    filterMethod.innerHTML = `
      <option value="">Alle metoder</option>
      ${state.methods.map((m) => `<option value="${m.id}">${m.label}</option>`).join("")}
    `;

    const projectOptions = state.projects
      .map((p) => ({ no: String(p.project_no), name: p.name }))
      .sort((a, b) => a.no.localeCompare(b.no, "nb-NO", { numeric: true }))
      .map((p) => `<option value="${p.no}">${p.no} - ${p.name}</option>`)
      .join("");
    filterProject.innerHTML = `
      <option value="">Alle prosjekter</option>
      ${projectOptions}
    `;

    const years = Array.from(
      new Set(
        state.reports
          .map((r) => r.report_date)
          .filter(Boolean)
          .map((d) => new Date(d as string).getFullYear())
          .filter((y) => !Number.isNaN(y))
      )
    ).sort((a, b) => b - a);
    filterYear.innerHTML = `
      <option value="">Alle år</option>
      ${years.map((y) => `<option value="${y}">${y}</option>`).join("")}
    `;
    filterYear.value = "";

    filterWelder.innerHTML = `
      <option value="">Alle sveisere</option>
      ${state.welders
        .map((w) => {
          const no = w.welder_no ? String(w.welder_no).padStart(3, "0") : "—";
          const name = (w.display_name || "Uten navn").trim();
          return `<option value="${w.id}">${no} – ${name}</option>`;
        })
        .join("")}
    `;

  }

  function applyFilters() {
    const methodId = (filterMethod.value || "").trim();
    const projectNo = (filterProject.value || "").trim();
    const year = (filterYear.value || "").trim();
    const welderId = (filterWelder.value || "").trim();
    const text = (filterText.value || "").trim().toLowerCase();
    const projectMap = new Map(state.projects.map((p) => [String(p.project_no), p]));

    return state.reports.filter((r) => {
      if (methodId && r.method_id !== methodId) return false;
      if (projectNo && (r.title || "").trim() !== projectNo) return false;
      if (year) {
        const y = r.report_date ? new Date(r.report_date).getFullYear() : NaN;
        if (String(y) !== year) return false;
      }
      if (welderId) {
        const hasWelder = (r.report_welders || []).some((rw) => rw.welder_id === welderId);
        if (!hasWelder) return false;
      }
      if (text) {
        const fileLabel = r.file?.label?.toLowerCase() ?? "";
        const projectNo = r.title?.toLowerCase() ?? "";
        const customer = r.customer?.toLowerCase() ?? "";
        const projectName = projectNo ? projectMap.get(projectNo)?.name?.toLowerCase() ?? "" : "";
        if (!fileLabel.includes(text) && !projectNo.includes(text) && !customer.includes(text) && !projectName.includes(text)) {
          return false;
        }
      }
      return true;
    });
  }

  function renderRtStats(rows: typeof state.reports) {
    const rtRows = rows.filter((r) => r.method?.code === "RT");
    if (rtRows.length === 0) {
      rtStats.innerHTML = `<div class="muted">Ingen RT-rapporter.</div>`;
      return;
    }

    const activeWelderId = (filterWelder.value || "").trim();

    const getRtCounts = (row: (typeof rtRows)[number]) => {
      const welderRows = row.report_welders || [];
      if (activeWelderId) {
        const matching = welderRows.filter((rw) => rw.welder_id === activeWelderId);
        if (matching.length === 0) return { welds: 0, defects: 0 };
        const hasPerWelder = matching.some((rw) => rw.weld_count != null || rw.defect_count != null);
        if (hasPerWelder) {
          return matching.reduce(
            (acc, rw) => {
              acc.welds += rw.weld_count ?? 0;
              acc.defects += rw.defect_count ?? 0;
              return acc;
            },
            { welds: 0, defects: 0 }
          );
        }
        if (welderRows.length === 1 && welderRows[0]?.welder_id === activeWelderId) {
          return { welds: row.weld_count ?? 0, defects: row.defect_count ?? 0 };
        }
        return { welds: 0, defects: 0 };
      }

      const hasPerWelder = welderRows.some((rw) => rw.weld_count != null || rw.defect_count != null);
      if (hasPerWelder) {
        return welderRows.reduce(
          (acc, rw) => {
            acc.welds += rw.weld_count ?? 0;
            acc.defects += rw.defect_count ?? 0;
            return acc;
          },
          { welds: 0, defects: 0 }
        );
      }
      return { welds: row.weld_count ?? 0, defects: row.defect_count ?? 0 };
    };

    const monthBuckets = new Map<number, Map<number, { welds: number; defects: number }>>();
    const yearTotals = new Map<number, { welds: number; defects: number }>();
    for (const r of rtRows) {
      if (!r.report_date) continue;
      const reportDate = new Date(r.report_date);
      const y = reportDate.getFullYear();
      if (Number.isNaN(y)) continue;
      const m = reportDate.getMonth() + 1; // 1-12
      if (!monthBuckets.has(y)) monthBuckets.set(y, new Map());
      const byMonth = monthBuckets.get(y)!;
      if (!byMonth.has(m)) byMonth.set(m, { welds: 0, defects: 0 });
      const v = byMonth.get(m)!;
      const counts = getRtCounts(r);
      v.welds += counts.welds;
      v.defects += counts.defects;
      if (!yearTotals.has(y)) yearTotals.set(y, { welds: 0, defects: 0 });
      const yt = yearTotals.get(y)!;
      yt.welds += counts.welds;
      yt.defects += counts.defects;
    }

    const years = Array.from(monthBuckets.keys()).sort((a, b) => b - a);
    if (years.length === 0) {
      rtStats.innerHTML = `<div class="muted">Manglende år på RT-rapporter.</div>`;
      return;
    }

    const series = years.map((y) => {
      const byMonth = monthBuckets.get(y)!;
      const points = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const v = byMonth.get(m);
        const rate = v && v.welds > 0 ? (v.defects / v.welds) * 100 : 0;
        return { month: m, rate };
      });
      return { year: y, points };
    });

    const maxReported = Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.rate)));
    const maxRate = maxReported > 0 ? maxReported : 1;
    const viewW = 720;
    const viewH = 240;
    const padL = 36;
    const padR = 16;
    const padT = 16;
    const padB = 28;
    const chartW = viewW - padL - padR;
    const chartH = viewH - padT - padB;

    const xFor = (month: number) => padL + ((month - 1) / 11) * chartW;
    const yFor = (rate: number) => padT + (1 - Math.min(rate, maxRate) / maxRate) * chartH;

    const colors = ["#5bd38f", "#5ea9ff", "#f3b54a", "#ff6b6b", "#b87bff"];

    const lines = series
      .map((s, idx) => {
        const pts = s.points.map((p) => `${xFor(p.month).toFixed(2)},${yFor(p.rate).toFixed(2)}`).join(" ");
        return `<polyline fill="none" stroke="${colors[idx % colors.length]}" stroke-width="2.5" points="${pts}" />`;
      })
      .join("");

    const targetY = yFor(2);
    const months = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
    const formatPercent = (value: number) => (value % 1 === 0 ? value.toFixed(0) : value.toFixed(1));
    const yearRates = new Map<number, number>();
    for (const [y, totals] of yearTotals.entries()) {
      const rate = totals.welds > 0 ? (totals.defects / totals.welds) * 100 : 0;
      yearRates.set(y, rate);
    }

    rtStats.innerHTML = `
      <div class="rt-linechart">
        <svg viewBox="0 0 ${viewW} ${viewH}" role="img" aria-label="Statistikk">
          <g class="rt-grid">
            ${[0, 0.5, 1].map((t) => {
  const y = padT + t * chartH;
  const value = (1 - t) * maxReported;

  return `
    <line x1="${padL}" y1="${y}" x2="${viewW - padR}" y2="${y}" />
    <text class="rt-axis-text" x="${padL - 8}" y="${y + 4}" text-anchor="end">${formatPercent(value)}%</text>
  `;
}).join("")}

            ${maxReported >= 2 ? `<line class="target" x1="${padL}" y1="${targetY}" x2="${viewW - padR}" y2="${targetY}" />` : ""}
          </g>
          <g class="rt-lines">${lines}</g>
          <g class="rt-axis">
            ${Array.from({ length: 12 }, (_, i) => {
              const m = i + 1;
              const x = xFor(m);
              return `<text x="${x}" y="${viewH - 8}" text-anchor="middle">${months[i]}</text>`;
            }).join("")}
          </g>
        </svg>
        <div class="rt-legend">
          ${series.map((s, idx) => {
            const rate = yearRates.get(s.year) ?? 0;
            const totals = yearTotals.get(s.year) ?? { welds: 0, defects: 0 };
            return `
            <span class="rt-legend-item"><span class="dot" style="background:${colors[idx % colors.length]}"></span>${s.year} (${formatPercent(rate)}%) · RT feil: ${totals.defects} · RT sveis: ${totals.welds}</span>
          `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderPager(totalPages: number) {
    pager.innerHTML = renderPagerButtons({ totalPages, currentPage: state.page });
  }

  function renderLists() {
    const rows = applyFilters();
    const projectMap = new Map(state.projects.map((p) => [String(p.project_no), p]));
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    const start = (state.page - 1) * state.pageSize;
    const pageRows = rows.slice(start, start + state.pageSize);

    reportCount.textContent = `${total} stk`;
    renderPager(totalPages);

    const activeMethod = (filterMethod.value || "").trim();
    const methodLabels = state.methods.map((m) => (m.code || m.label || "").trim()).filter(Boolean);
    const pillMap = buildTypePillMap(methodLabels);
    const getPillClass = (label: string) => typePillClass(label, pillMap);
    methodPills.innerHTML = state.methods
      .map((m) => {
        const label = (m.code || m.label || "?").trim();
        const baseClass = getPillClass(label);
        const active = activeMethod === m.id ? " is-active" : "";
        const muted = activeMethod && activeMethod !== m.id ? " is-muted" : "";
        return `<button type="button" class="${baseClass}${active}${muted}" data-method-id="${m.id}">${label}</button>`;
      })
      .join("");

    renderRtStats(rows);

    if (pageRows.length === 0) {
      reportBody.innerHTML = `<div class="muted">Ingen rapporter.</div>`;
      return;
    }

    reportBody.innerHTML = renderReportTable(pageRows, state.isAdmin, projectMap, getPillClass);
  }

  function requireAdmin() {
    if (!state.isAdmin) {
      toast("Du må være admin for å gjøre dette.");
      return false;
    }
    return true;
  }

  function updateAdminUi() {
    openUploadBtn.style.display = state.isAdmin ? "" : "none";
  }

  async function load() {
    const seq = ++state.loadSeq;

    setLoading(true);
    reportBody.innerHTML = `<div class="muted">Laster…</div>`;

    try {
      const [methods, reports, welders, projects, customers] = await Promise.all([
        fetchNdtMethods(),
        fetchNdtReports(),
        fetchWelders(),
        fetchProjects(),
        fetchCustomers(),
      ]);

      if (seq !== state.loadSeq) return;

      state.methods = methods;
      state.reports = reports;
      state.welders = welders;
      state.projects = projects;
      state.customers = customers;

      renderFilters();
      renderLists();
      refreshUploadSelects();
    } catch (e: any) {
      console.error(e);
      reportBody.innerHTML = `<div class="err">Feil: ${String(e?.message ?? e)}</div>`;
    } finally {
      if (seq === state.loadSeq) setLoading(false);
    }
  }

  const setUploadOpen = (open: boolean) => {
    uploadPanel.hidden = !open;
    uploadPanel.classList.toggle("is-open", open);
    if (open) {
      ensureUploadPanel();
      uploadPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  openUploadBtn.addEventListener(
    "click",
    () => {
      if (!requireAdmin()) return;
      setUploadOpen(true);
    },
    { signal }
  );

  uploadClose.addEventListener("click", () => setUploadOpen(false), { signal });

  uploadClear.addEventListener(
    "click",
    () => {
      uploadEntries = [];
      uploadingIds = new Set();
      setUploadPreview(null);
      renderUploadList();
    },
    { signal }
  );

  uploadSave.addEventListener(
    "click",
    async () => {
      if (!uploadInitialized) return;
      if (uploadEntries.length === 0) {
        toast("Velg minst en PDF.");
        return;
      }

      let entries: NdtUploadEntry[] = [];
      try {
        entries = uploadEntries.map((entry) => buildUploadPayload(entry));
      } catch (e: any) {
        toast(String(e?.message ?? e));
        return;
      }

      uploadSave.disabled = true;
      uploadSave.textContent = "Laster opp…";

      try {
        await uploadNdtBatchWithMeta(entries, (idx, total) => {
          if (uploadStatus) uploadStatus.textContent = `Laster opp ${idx}/${total}…`;
        });
        uploadEntries = [];
        renderUploadList();
        setUploadOpen(false);
        await load();
      } catch (e: any) {
        console.error(e);
        alert(String(e?.message ?? e));
      } finally {
        uploadSave.disabled = false;
        uploadSave.textContent = "Last opp";
      }
    },
    { signal }
  );

  refreshBtn.addEventListener("click", () => load(), { signal });
  const onFilterChange = () => {
    state.page = 1;
    renderLists();
  };

  filterMethod.addEventListener("change", onFilterChange, { signal });
  filterProject.addEventListener("change", onFilterChange, { signal });
  filterYear.addEventListener("change", onFilterChange, { signal });
  filterWelder.addEventListener("change", onFilterChange, { signal });
  filterText.addEventListener("input", onFilterChange, { signal });

  methodPills.addEventListener(
    "click",
    (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-method-id]");
      if (!target) return;
      const next = target.getAttribute("data-method-id") || "";
      const current = (filterMethod.value || "").trim();
      filterMethod.value = current === next ? "" : next;
      onFilterChange();
    },
    { signal }
  );

  pager.addEventListener(
    "click",
    (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-page]");
      if (!target) return;
      const next = Number(target.getAttribute("data-page"));
      if (!Number.isFinite(next) || next < 1) return;
      state.page = next;
      renderLists();
    },
    { signal }
  );

  reportBody.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;
      const openId = target.closest("[data-openpdf]")?.getAttribute("data-openpdf");
      if (openId) {
        try {
          await openPdf(openId);
        } catch (err) {
          console.error(err);
          alert("Klarte ikke å åpne PDF.");
        }
        return;
      }

      const printId = target.closest("[data-print]")?.getAttribute("data-print");
      if (printId) {
        const row = state.reports.find((r) => r.id === printId);
        if (!row?.file_id) {
          toast("Ingen PDF tilgjengelig for utskrift.");
          return;
        }
        try {
          await printNdtReportPdf(row.file_id);
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
        return;
      }

      const delId = target.closest("[data-del]")?.getAttribute("data-del");
      if (delId) {
        if (!requireAdmin()) return;
        const row = state.reports.find((r) => r.id === delId);
        if (!row) return;

        await openConfirmDelete(modalMount, signal, {
          title: "Slett rapport",
          messageHtml: "Dette sletter rapporten og PDF-filen.",
          onConfirm: async () => handleDeleteReport(row),
          onDone: load,
        });
      }

      const editId = target.closest("[data-edit]")?.getAttribute("data-edit");
      if (editId) {
        if (!requireAdmin()) return;
        const row = state.reports.find((r) => r.id === editId);
        if (!row) return;
        openNdtReportModal(
          modalMount,
          signal,
          state.methods,
          state.welders,
          state.projects,
          state.customers,
          "edit",
          row,
          load
        );
      }
    },
    { signal }
  );

  try {
    state.isAdmin = await getIsAdmin();
  } catch {}

  updateAdminUi();

  await load();
  setLoading(false);
}

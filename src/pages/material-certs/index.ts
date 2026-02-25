import { renderHeader, wireHeader } from "../../components/header";
import { getIsAdmin, getSession, getProfileAccess } from "../../app/auth";
import { toast } from "../../ui/toast";
import { Footer } from "../../components/footer";
import { esc, qs } from "../../utils/dom";
import { createUuid } from "../../utils/id";

import "../../styles/pages/material-certs.css";

import { fetchMaterialCertificates, type MaterialCertificateRow, type MaterialCertificateType } from "../../repo/materialCertificateRepo";
import { fetchMaterials } from "../../repo/materialRepo";
import { createSupplier, fetchSuppliers } from "../../repo/supplierRepo";
import { fetchTraceabilityOptions } from "../../repo/traceabilityRepo";
import {
  countNewFileInboxByTarget,
  deleteFileInboxEntryAndMaybeFile,
  fetchNewFileInboxByTarget,
  type FileInboxRow,
} from "../../repo/fileInboxRepo";
import { createState } from "./state";
import { renderMaterialCertTable } from "./templates";
import { openConfirmDelete } from "../../ui/confirm";
import { handleDelete, openEditModal, openPdf, uploadBatchWithMeta, type MaterialCertUploadEntry } from "./handlers";
import { renderPagerButtons } from "../../ui/pager";
import { iconSvg } from "../../ui/iconButton";

export async function renderMaterialCertsPage(app: HTMLElement) {
  const prev = (app as any).__material_certs_unmount as undefined | (() => void);
  if (prev) prev();

  const controller = new AbortController();
  const { signal } = controller;

  (app as any).__material_certs_unmount = () => {
    controller.abort();
    (app as any).__material_certs_unmount = undefined;
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
    <div class="shell page-material-certs">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">Materialsertifikater</h1>
            <p class="section-subtitle">Basket for materialsertifikater og sveisetilsett-sertifikater.</p>
          </div>
          <div class="section-actions">
            <button data-open-upload class="btn accent small" type="button">Legg til filer</button>
            <button data-refresh class="btn small">Oppdater</button>
          </div>
        </section>

        <section class="panel panel-upload upload-panel" data-upload-panel hidden>
          <div class="panel-head">
            <div>
              <div class="panel-title">Legg til filer</div>
              <div class="panel-meta">Legg til flere filer og fyll inn heat, material og leverandør.</div>
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

        <section class="panel">
          <div class="panel-head">
            <div class="panel-title">Material</div>
            <div class="panel-meta" data-material-count>—</div>
          </div>
          <div class="panel-body">
            <div data-material-body class="listmount"><div class="muted">Laster…</div></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div class="panel-title">Sveisetilsett</div>
            <div class="panel-meta" data-filler-count>—</div>
          </div>
          <div class="panel-body">
            <div data-filler-body class="listmount"><div class="muted">Laster…</div></div>
          </div>
        </section>

        <div data-modal-mount></div>
      </main>

      ${Footer()}
    </div>
  `;

  wireHeader(app);

  const pageRoot = qs<HTMLElement>(app, ".page-material-certs");

  const materialBody = qs<HTMLDivElement>(app, "[data-material-body]");
  const fillerBody = qs<HTMLDivElement>(app, "[data-filler-body]");
  const materialCount = qs<HTMLDivElement>(app, "[data-material-count]");
  const fillerCount = qs<HTMLDivElement>(app, "[data-filler-count]");
  const refreshBtn = qs<HTMLButtonElement>(app, "[data-refresh]");
  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");

  const openUploadBtn = qs<HTMLButtonElement>(app, "[data-open-upload]");
  const uploadPanel = qs<HTMLElement>(app, "[data-upload-panel]");
  const uploadBody = qs<HTMLDivElement>(app, "[data-upload-body]");
  const uploadStatus = qs<HTMLDivElement>(app, "[data-upload-status]");
  const uploadClose = qs<HTMLButtonElement>(app, "[data-upload-close]");
  const uploadClear = qs<HTMLButtonElement>(app, "[data-upload-clear]");
  const uploadSave = qs<HTMLButtonElement>(app, "[data-upload-save]");

  let filterMaterialId = "";
  let filterMaterialSupplier = "";
  let filterMaterialText = "";
  let filterFillerType = "";
  let filterFillerSupplier = "";
  let filterFillerText = "";

  const selectedIds = new Set<string>();
  const currentPageIdsByType: Record<MaterialCertificateType, string[]> = {
    material: [],
    filler: [],
  };

  type UploadEntrySource =
    | { kind: "local"; file: File }
    | { kind: "inbox"; inboxId: string; fileId: string; fileName: string };

  type UploadEntry = {
    id: string;
    source: UploadEntrySource;
    heatNumbers: string[];
    materialId: string | null;
    supplier: string | null;
    fillerType: string | null;
  };

  let uploadEntries: UploadEntry[] = [];
  let uploadInitialized = false;
  let uploadPreviewUrl: string | null = null;
  let uploadPreviewName: string | null = null;
  let uploadPreviewId: string | null = null;
  let uploadingIds = new Set<string>();

  let uploadType: HTMLSelectElement | null = null;
  let uploadCertType: HTMLSelectElement | null = null;
  let uploadSupplier: HTMLSelectElement | null = null;
  let uploadMaterial: HTMLSelectElement | null = null;
  let uploadMaterialField: HTMLElement | null = null;
  let uploadFiller: HTMLSelectElement | null = null;
  let uploadFillerField: HTMLElement | null = null;
  let uploadInput: HTMLInputElement | null = null;
  let uploadList: HTMLDivElement | null = null;
  let uploadDropzone: HTMLDivElement | null = null;
  let inboxNewCount = 0;
  const openUploadBtnBaseLabel = (openUploadBtn.textContent || "Legg til filer").trim();

  const pageSizeStorageKey = "materialCertsPageSize";
  state.pageSize = 20;
  localStorage.setItem(pageSizeStorageKey, "20");
  function setLoading(isLoading: boolean) {
    state.loading = isLoading;
    refreshBtn.disabled = isLoading;
    openUploadBtn.disabled = isLoading || !state.isAdmin;
  }

  function requireAdmin() {
    if (state.isAdmin) return true;
    toast("Kun admin har tilgang til dette.");
    return false;
  }

  function updateAdminUi() {
    if (!state.isAdmin) {
      openUploadBtn.style.display = "none";
      openUploadBtn.textContent = openUploadBtnBaseLabel;
      return;
    }
    openUploadBtn.style.display = "";
    updateOpenUploadButtonLabel();
  }

  function updateSelectionUi() {
    const selectAlls = Array.from(app.querySelectorAll<HTMLInputElement>("[data-select-all]"));
    if (selectAlls.length === 0) return;

    selectAlls.forEach((selectAll) => {
      const group = (selectAll.getAttribute("data-select-all") || "") as MaterialCertificateType | "";
      const groupIds = group ? currentPageIdsByType[group] ?? [] : [];
      if (groupIds.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        selectAll.disabled = true;
        return;
      }

      selectAll.disabled = false;
      const selectedOnPage = groupIds.filter((id) => selectedIds.has(id));
      selectAll.checked = selectedOnPage.length === groupIds.length;
      selectAll.indeterminate = selectedOnPage.length > 0 && selectedOnPage.length < groupIds.length;
    });

    const materialDeleteBtn = app.querySelector<HTMLButtonElement>("[data-bulk-delete-group=material]");
    const fillerDeleteBtn = app.querySelector<HTMLButtonElement>("[data-bulk-delete-group=filler]");

    if (materialDeleteBtn) {
      const materialSelected = state.rows.filter(
        (r) => r.certificate_type !== "filler" && selectedIds.has(r.id)
      ).length;
      const hasMaterialSelection = materialSelected > 0;
      materialDeleteBtn.disabled = !hasMaterialSelection;
      materialDeleteBtn.style.display = hasMaterialSelection ? "" : "none";
      if (hasMaterialSelection) materialDeleteBtn.textContent = `Slett (${materialSelected} stk)`;
      if (!state.isAdmin) materialDeleteBtn.style.display = "none";
    }

    if (fillerDeleteBtn) {
      const fillerSelected = state.rows.filter((r) => r.certificate_type === "filler" && selectedIds.has(r.id)).length;
      const hasFillerSelection = fillerSelected > 0;
      fillerDeleteBtn.disabled = !hasFillerSelection;
      fillerDeleteBtn.style.display = hasFillerSelection ? "" : "none";
      if (hasFillerSelection) fillerDeleteBtn.textContent = `Slett (${fillerSelected} stk)`;
      if (!state.isAdmin) fillerDeleteBtn.style.display = "none";
    }
  }

  function applyMaterialFilters() {
    const materialId = filterMaterialId.trim();
    const supplier = filterMaterialSupplier.trim().toLowerCase();
    const text = filterMaterialText.trim().toLowerCase();

    return state.rows.filter((r) => {
      if (r.certificate_type === "filler") return false;
      if (materialId && r.material_id !== materialId) return false;
      if (supplier) {
        const sup = (r.supplier ?? "").toLowerCase();
        if (!sup.includes(supplier)) return false;
      }
      if (text) {
        const fileLabel = r.file?.label?.toLowerCase() ?? "";
        const heat = (r.heat_numbers ?? []).join(" ").toLowerCase();
        const sup = (r.supplier ?? "").toLowerCase();
        const material = (r.material?.name ?? "").toLowerCase();
        if (!fileLabel.includes(text) && !heat.includes(text) && !sup.includes(text) && !material.includes(text)) {
          return false;
        }
      }
      return true;
    });
  }

  function applyFillerFilters() {
    const type = filterFillerType.trim();
    const supplier = filterFillerSupplier.trim().toLowerCase();
    const text = filterFillerText.trim().toLowerCase();

    return state.rows.filter((r) => {
      if (r.certificate_type !== "filler") return false;
      if (type && r.filler_type !== type) return false;
      if (supplier) {
        const sup = (r.supplier ?? "").toLowerCase();
        if (!sup.includes(supplier)) return false;
      }
      if (text) {
        const fileLabel = r.file?.label?.toLowerCase() ?? "";
        const heat = (r.heat_numbers ?? []).join(" ").toLowerCase();
        const sup = (r.supplier ?? "").toLowerCase();
        const filler = (r.filler_type ?? "").toLowerCase();
        if (!fileLabel.includes(text) && !heat.includes(text) && !sup.includes(text) && !filler.includes(text)) {
          return false;
        }
      }
      return true;
    });
  }

  function renderPagerGroup(group: MaterialCertificateType, totalPages: number, currentPage: number) {
    const buttons = renderPagerButtons({ totalPages, currentPage, dataAttrs: { group } });
    if (!buttons) return "";
    return `<div class="pager pager-bottom">${buttons}</div>`;
  }

  function renderUploadPanelBody() {
    const supplierOptions = state.suppliers
      .map((s) => `<option value="${s.name}">${s.name}</option>`)
      .join("");
    const materialOptions = state.materials
      .map((m) => `<option value="${m.id}">${m.name}</option>`)
      .join("");
    const fillerOptions = state.fillerOptions
      .map((o) => `<option value="${o.value}">${o.value}</option>`)
      .join("");
    return `
      <div class="upload-grid">
        <div class="field">
          <label>Type</label>
          <select data-upload-type class="select">
            <option value="material">Materialsertifikat</option>
            <option value="filler">Sveisetilsett</option>
          </select>
        </div>

        <div class="field">
          <label>Sertifikattype</label>
          <select data-upload-certtype class="select">
            <option value="2.1">2.1</option>
            <option value="2.2">2.2</option>
            <option value="3.1" selected>3.1</option>
            <option value="3.2">3.2</option>
          </select>
        </div>

      </div>

      <div class="upload-bulk">
        <div class="field" data-upload-filler-field hidden>
          <label>Sveisetilsett-type (for alle)</label>
          <select data-upload-filler class="select">
            <option value="">Velg type…</option>
            ${fillerOptions}
          </select>
        </div>
        <div class="field" data-upload-material-field>
          <label>Material (for alle)</label>
          <select data-upload-material class="select">
            <option value="">Ikke valgt</option>
            ${materialOptions}
          </select>
        </div>

        <div class="field">
          <label>Leverandør (for alle)</label>
          <select data-upload-supplier class="select">
            <option value="">Ikke valgt</option>
            ${supplierOptions}
            <option value="__new__">Ny leverandør…</option>
          </select>
        </div>
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <Label>PDF-filer</Label>
        <div class="dropzone" data-upload-dropzone>
          <div class="dropzone-title">Dra og slipp filer her</div>
          <div class="dropzone-sub">Støtter PDF-format</div>
          <input data-upload-files type="file" class="input" accept="application/pdf" multiple />
        </div>
        <div class="filelist" data-upload-list></div>
      </div>
    `;
  }

  const normalizeHeat = (value: string) => value.trim();

  const parseHeatNumbers = (value: string) =>
    value
      .split(/\n|,|;/)
      .map((v) => normalizeHeat(v))
      .filter(Boolean);

  const getUploadEntryName = (entry: UploadEntry) => {
    return entry.source.kind === "local" ? entry.source.file.name : entry.source.fileName;
  };

  const inferFileNameFromPath = (input: string) => {
    const normalized = input.replace(/\\/g, "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] || input;
  };

  const toStringOrEmpty = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const toStringArray = (value: unknown) => {
    if (Array.isArray(value)) return value.map((item) => toStringOrEmpty(item)).filter(Boolean);
    if (typeof value === "string") return parseHeatNumbers(value);
    return [] as string[];
  };

  const updateOpenUploadButtonLabel = () => {
    if (!state.isAdmin) return;
    openUploadBtn.textContent = inboxNewCount > 0 ? `${openUploadBtnBaseLabel} (${inboxNewCount} nye)` : openUploadBtnBaseLabel;
  };

  const syncInboxUploadEntries = (rows: FileInboxRow[]) => {
    const existingInbox = new Map<string, UploadEntry>();
    uploadEntries.forEach((entry) => {
      if (entry.source.kind !== "inbox") return;
      existingInbox.set(entry.source.inboxId, entry);
    });
    const localEntries = uploadEntries.filter((entry) => entry.source.kind === "local");

    const nextInboxEntries: UploadEntry[] = rows.map((row) => {
      const current = existingInbox.get(row.id);
      const meta = row.suggested_meta && typeof row.suggested_meta === "object"
        ? (row.suggested_meta as Record<string, unknown>)
        : {};

      return {
        id: current?.id ?? `inbox:${row.id}`,
        source: {
          kind: "inbox",
          inboxId: row.id,
          fileId: row.file_id,
          fileName: row.file?.label || inferFileNameFromPath(row.source_path),
        },
        heatNumbers: current?.heatNumbers ?? toStringArray(meta.heat_numbers),
        materialId: current?.materialId ?? (toStringOrEmpty(meta.material_id) || null),
        supplier: current?.supplier ?? (toStringOrEmpty(meta.supplier) || null),
        fillerType: current?.fillerType ?? (toStringOrEmpty(meta.filler_type) || null),
      };
    });

    uploadEntries = [...localEntries, ...nextInboxEntries];
    if (uploadPreviewId && !uploadEntries.some((entry) => entry.id === uploadPreviewId)) {
      uploadPreviewId = null;
      uploadPreviewName = null;
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl);
        uploadPreviewUrl = null;
      }
    }
    renderUploadList();
  };

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

    const type = (uploadType?.value || "material").trim();
    const showMaterial = type !== "filler";
    const buildMaterialOptions = (selectedId: string | null) =>
      state.materials
        .map(
          (m) =>
            `<option value="${esc(m.id)}" ${m.id === selectedId ? "selected" : ""}>${esc(m.name)}</option>`
        )
        .join("");
    const buildSupplierOptions = (selected: string | null) =>
      state.suppliers
        .map(
          (s) =>
            `<option value="${esc(s.name)}" ${s.name === (selected ?? "") ? "selected" : ""}>${esc(s.name)}</option>`
        )
        .join("");
    const buildFillerOptions = (selected: string | null) =>
      state.fillerOptions
        .map(
          (o) =>
            `<option value="${esc(o.value)}" ${o.value === (selected ?? "") ? "selected" : ""}>${esc(o.value)}</option>`
        )
        .join("");

    const previewPanel = uploadPreviewUrl
      ? `
        <div class="upload-preview-dock">
          <div class="upload-preview-head">
            <div class="upload-preview-title">${esc(uploadPreviewName || "Forhandsvisning")}</div>
            <button type="button" class="iconbtn btnlike" data-preview-close aria-label="Lukk" title="Lukk">
              ${iconSvg("x")}
            </button>
          </div>
          <iframe class="upload-preview-frame" src="${esc(uploadPreviewUrl)}" title="Forhandsvisning"></iframe>
        </div>
      `
      : "";

    uploadList.innerHTML = `
      <div class="upload-list-wrap">
        ${previewPanel}
        <div class="upload-file-list">
          ${uploadEntries
            .map((entry) => {
              const heatRows = entry.heatNumbers
                .map(
                  (h, idx) => `
                    <div class="heat-row" data-heat-row data-file-id="${esc(entry.id)}">
                      <input class="input" data-heat-input data-file-id="${esc(entry.id)}" data-heat-index="${idx}" value="${esc(h)}" />
                      <button type="button" class="btn tiny ghost" data-heat-remove data-file-id="${esc(entry.id)}" data-heat-index="${idx}">Fjern</button>
                    </div>
                  `
                )
                .join("");

              const isUploading = uploadingIds.has(entry.id);

              return `
                <div class="upload-file-card" data-file-id="${esc(entry.id)}">
                  <div class="upload-file-head">
                    <div>
                      <div class="upload-file-name">${esc(getUploadEntryName(entry))}</div>
                      <div class="upload-file-meta">${entry.source.kind === "inbox" ? "Ny i innboks" : "Klar"}</div>
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
                        <div class="field upload-heat-field">
                          <label>Heat no (en per linje)</label>
                          <div class="heat-list" data-heat-list data-file-id="${esc(entry.id)}">
                            ${heatRows || `<div class=\"muted\">Ingen heat nr lagt inn.</div>`}
                          </div>
                        </div>
                        <div class="field">
                          <label>Legg til heat nr</label>
                          <div class="heat-add upload-heat-add">
                            <input class="input" data-heat-new data-file-id="${esc(entry.id)}" placeholder="Skriv heat nr og trykk Legg til" />
                            <button type="button" class="iconbtn btnlike" data-heat-add data-file-id="${esc(entry.id)}" aria-label="Legg til" title="Legg til">
                              ${iconSvg("plus")}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div class="upload-col">
                        ${showMaterial ? `
                        <div class="field" data-file-material-field>
                          <label>Material</label>
                          <select class="select" data-file-material data-file-id="${esc(entry.id)}">
                            <option value="">Velg material…</option>
                            ${buildMaterialOptions(entry.materialId)}
                          </select>
                        </div>
                        ` : `
                        <div class="field" data-file-filler-field>
                          <label>Sveisetilsett-type</label>
                          <select class="select" data-file-filler data-file-id="${esc(entry.id)}">
                            <option value="">Velg type…</option>
                            ${buildFillerOptions(entry.fillerType)}
                          </select>
                        </div>
                        `}
                        <div class="field">
                          <label>Leverandør</label>
                          <select class="select" data-file-supplier data-file-id="${esc(entry.id)}">
                            <option value="">Velg leverandør…</option>
                            ${buildSupplierOptions(entry.supplier)}
                          </select>
                        </div>
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
    if (entry.source.kind !== "local") {
      renderUploadList();
      return;
    }
    uploadPreviewUrl = URL.createObjectURL(entry.source.file);
    uploadPreviewName = entry.source.file.name;
    uploadPreviewId = entry.id;
    renderUploadList();
  };

  const uploadSingle = async (entry: UploadEntry) => {
    if (uploadingIds.has(entry.id)) return;
    const type = (uploadType?.value || "material") as MaterialCertificateType;
    const certType = (uploadCertType?.value || "3.1").trim() || "3.1";

    if (type === "material" && !entry.materialId) {
      toast("Velg material for denne filen.");
      return;
    }

    if (type === "filler") {
      if (!entry.fillerType) {
        toast("Velg sveisetilsett-type for denne filen.");
        return;
      }
      if (!state.fillerOptions.some((o) => o.value === entry.fillerType)) {
        toast("Velg sveisetilsett-type fra listen.");
        return;
      }
    }

    const entries: MaterialCertUploadEntry[] = [
      {
        file: entry.source.kind === "local" ? entry.source.file : null,
        file_id: entry.source.kind === "inbox" ? entry.source.fileId : null,
        inbox_id: entry.source.kind === "inbox" ? entry.source.inboxId : null,
        source_name: getUploadEntryName(entry),
        certificate_type: type,
        cert_type: certType,
        supplier: entry.supplier,
        material_id: type === "material" ? entry.materialId : null,
        filler_type: type === "filler" ? entry.fillerType : null,
        heat_numbers: entry.heatNumbers,
      },
    ];

    uploadingIds.add(entry.id);
    renderUploadList();

    try {
      await uploadBatchWithMeta(entries, undefined, (file, existing) => {
        const label = existing.label ? `"${existing.label}"` : "den eksisterende filen";
        return window.confirm(
          `${file.name} finnes allerede i systemet som ${label}.\n\nVil du linke til eksisterende fil i stedet for å laste opp på nytt?`
        );
      });
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

  const refreshUploadSuppliers = (selected?: string) => {
    if (!uploadSupplier) return;
    const options = state.suppliers.map((s) => `<option value="${s.name}">${s.name}</option>`).join("");
    uploadSupplier.innerHTML = `
      <option value="">Ikke valgt</option>
      ${options}
      <option value="__new__">Ny leverandør…</option>
    `;
    if (selected) uploadSupplier.value = selected;
  };

  const refreshUploadMaterials = () => {
    if (!uploadMaterial) return;
    const options = state.materials.map((m) => `<option value="${m.id}">${m.name}</option>`).join("");
    uploadMaterial.innerHTML = `
      <option value="">Ikke valgt</option>
      ${options}
    `;
  };

  const refreshUploadFillers = () => {
    if (!uploadFiller) return;
    const options = state.fillerOptions.map((o) => `<option value="${o.value}">${o.value}</option>`).join("");
    uploadFiller.innerHTML = `
      <option value="">Velg type…</option>
      ${options}
    `;
  };

  const syncUploadType = () => {
    if (!uploadType || !uploadMaterialField || !uploadFillerField) return;
    const type = (uploadType.value || "material").trim();
    if (type === "filler") {
      uploadMaterialField.setAttribute("hidden", "");
      if (uploadMaterial) uploadMaterial.value = "";
      uploadFillerField.removeAttribute("hidden");
      const globalFiller = (uploadFiller?.value || "").trim() || null;
      uploadEntries = uploadEntries.map((entry) => ({ ...entry, materialId: null, fillerType: globalFiller }));
    } else {
      uploadMaterialField.removeAttribute("hidden");
      uploadFillerField.setAttribute("hidden", "");
      if (uploadFiller) uploadFiller.value = "";
      uploadEntries = uploadEntries.map((entry) => ({ ...entry, fillerType: null }));
    }
    renderUploadList();
  };

  const addUploadFiles = (files: File[]) => {
    const existingKeys = new Set(
      uploadEntries.map((e) => (e.source.kind === "local" ? `local:${e.source.file.name}:${e.source.file.size}` : `inbox:${e.source.fileId}`))
    );
    const nextEntries: UploadEntry[] = [];
    const type = (uploadType?.value || "material").trim();
    const globalMaterial = (uploadMaterial?.value || "").trim() || null;
    const globalSupplier = (uploadSupplier?.value || "").trim() || null;
    const globalFiller = (uploadFiller?.value || "").trim() || null;

    files.forEach((file) => {
      const key = `local:${file.name}:${file.size}`;
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        toast(`Hopper over ${file.name}: ikke en PDF.`);
        return;
      }
      if (existingKeys.has(key)) return;
      nextEntries.push({
        id: createUuid(),
        source: { kind: "local", file },
        heatNumbers: [],
        materialId: type === "material" ? globalMaterial : null,
        supplier: globalSupplier,
        fillerType: type === "filler" ? globalFiller : null,
      });
      existingKeys.add(key);
    });

    if (nextEntries.length === 0) return;
    uploadEntries = [...uploadEntries, ...nextEntries];
    renderUploadList();
  };

  const initUploadPanel = () => {
    uploadBody.innerHTML = renderUploadPanelBody();
    uploadType = qs<HTMLSelectElement>(uploadBody, "[data-upload-type]");
    uploadCertType = qs<HTMLSelectElement>(uploadBody, "[data-upload-certtype]");
    uploadSupplier = qs<HTMLSelectElement>(uploadBody, "[data-upload-supplier]");
    uploadMaterial = qs<HTMLSelectElement>(uploadBody, "[data-upload-material]");
    uploadMaterialField = qs<HTMLElement>(uploadBody, "[data-upload-material-field]");
    uploadFiller = qs<HTMLSelectElement>(uploadBody, "[data-upload-filler]");
    uploadFillerField = qs<HTMLElement>(uploadBody, "[data-upload-filler-field]");
    uploadInput = qs<HTMLInputElement>(uploadBody, "[data-upload-files]");
    uploadList = qs<HTMLDivElement>(uploadBody, "[data-upload-list]");
    uploadDropzone = qs<HTMLDivElement>(uploadBody, "[data-upload-dropzone]");

    refreshUploadSuppliers();
    refreshUploadMaterials();
    refreshUploadFillers();

    uploadSupplier.addEventListener(
      "change",
      async () => {
        if (!uploadSupplier) return;
        if (uploadSupplier.value === "__new__") {
          const name = window.prompt("Ny leverandør:", "");
          if (!name) {
            uploadSupplier.value = "";
            return;
          }
          const trimmed = name.trim();
          if (!trimmed) {
            uploadSupplier.value = "";
            return;
          }
          try {
            await createSupplier(trimmed);
            state.suppliers = await fetchSuppliers();
            renderList(true);
            refreshUploadSuppliers(trimmed);
          } catch (e: any) {
            console.error(e);
            alert(String(e?.message ?? e));
            uploadSupplier.value = "";
          }
        }

        const next = (uploadSupplier.value || "").trim() || null;
        uploadEntries = uploadEntries.map((entry) => ({ ...entry, supplier: next }));
        renderUploadList();
      },
      { signal }
    );

    uploadMaterial.addEventListener(
      "change",
      () => {
        const type = (uploadType?.value || "material").trim();
        if (type === "filler") return;
        const next = (uploadMaterial?.value || "").trim() || null;
        uploadEntries = uploadEntries.map((entry) => ({ ...entry, materialId: next }));
        renderUploadList();
      },
      { signal }
    );

    uploadFiller.addEventListener(
      "change",
      () => {
        const type = (uploadType?.value || "material").trim();
        if (type !== "filler") return;
        const next = (uploadFiller?.value || "").trim() || null;
        uploadEntries = uploadEntries.map((entry) => ({ ...entry, fillerType: next }));
        renderUploadList();
      },
      { signal }
    );

    uploadType.addEventListener("change", syncUploadType, { signal });
    syncUploadType();

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
        const dt = (e as DragEvent).dataTransfer;
        if (!dt) return;

        const filesFromList = dt.files ? Array.from(dt.files) : [];
        if (filesFromList.length > 0) {
          addUploadFiles(filesFromList);
          return;
        }

        const items = dt.items ? Array.from(dt.items) : [];
        const filesFromItems = items
          .filter((it) => it.kind === "file")
          .map((it) => it.getAsFile())
          .filter((f): f is File => !!f);

        if (filesFromItems.length > 0) {
          addUploadFiles(filesFromItems);
          return;
        }

        const hasOutlookLike = items.some((it) => it.kind === "string");
        if (hasOutlookLike) {
          toast("Fant ingen filer. Prøv å lagre vedlegget lokalt og dra det inn her.");
        }
      },
      { signal }
    );

    uploadList.addEventListener(
      "click",
      async (e) => {
        const target = e.target as HTMLElement;
        const closePreviewBtn = target.closest<HTMLButtonElement>("[data-preview-close]");
        if (closePreviewBtn) {
          setUploadPreview(null);
          return;
        }
        const previewBtn = target.closest<HTMLButtonElement>("[data-file-preview]");
        if (previewBtn) {
          const id = previewBtn.getAttribute("data-file-preview") || "";
          const entry = uploadEntries.find((item) => item.id === id);
          if (!entry) return;
          if (entry.source.kind === "inbox") {
            void openPdf(entry.source.fileId).catch((err) => {
              console.error(err);
              alert("Klarte ikke å åpne PDF.");
            });
            return;
          }
          setUploadPreview(entry);
          return;
        }
        const uploadBtn = target.closest<HTMLButtonElement>("[data-file-upload]");
        if (uploadBtn) {
          const id = uploadBtn.getAttribute("data-file-upload") || "";
          const entry = uploadEntries.find((item) => item.id === id);
          if (!entry) return;
          void uploadSingle(entry);
          return;
        }
        const removeBtn = target.closest<HTMLButtonElement>("[data-file-remove]");
        if (removeBtn) {
          const id = removeBtn.getAttribute("data-file-remove") || "";
          const entry = uploadEntries.find((item) => item.id === id);
          if (!entry) return;

          if (entry.source.kind === "inbox") {
            const ok = window.confirm("Slette filen fra innboks og lagring? Dette kan ikke angres.");
            if (!ok) return;
            try {
              await deleteFileInboxEntryAndMaybeFile(entry.source.inboxId);
              toast("Fil fjernet fra innboks.");
            } catch (err: any) {
              console.error(err);
              alert(String(err?.message ?? err));
            } finally {
              await load();
            }
            return;
          }

          if (uploadPreviewId && uploadPreviewId === id) setUploadPreview(null);
          uploadEntries = uploadEntries.filter((item) => item.id !== id);
          renderUploadList();
          return;
        }

        const addHeatBtn = target.closest<HTMLButtonElement>("[data-heat-add]");
        if (addHeatBtn) {
          const id = addHeatBtn.getAttribute("data-file-id") || "";
          const entry = uploadEntries.find((e) => e.id === id);
          if (!uploadList) return;
          const input = uploadList.querySelector<HTMLInputElement>(`[data-heat-new][data-file-id="${id}"]`);
          if (!entry || !input) return;
          const values = parseHeatNumbers(input.value || "");
          if (values.length === 0) return;
          const merged = new Set([...(entry.heatNumbers || []), ...values]);
          entry.heatNumbers = Array.from(merged);
          input.value = "";
          renderUploadList();
          return;
        }

        const removeHeatBtn = target.closest<HTMLButtonElement>("[data-heat-remove]");
        if (removeHeatBtn) {
          const id = removeHeatBtn.getAttribute("data-file-id") || "";
          const idx = Number(removeHeatBtn.getAttribute("data-heat-index"));
          const entry = uploadEntries.find((e) => e.id === id);
          if (!entry || !Number.isFinite(idx)) return;
          entry.heatNumbers = entry.heatNumbers.filter((_, i) => i !== idx);
          renderUploadList();
        }
      },
      { signal }
    );

    uploadList.addEventListener(
      "input",
      (e) => {
        const target = e.target as HTMLElement;
        const input = target.closest<HTMLInputElement>("[data-heat-input]");
        if (!input) return;
        const id = input.getAttribute("data-file-id") || "";
        const idx = Number(input.getAttribute("data-heat-index"));
        const entry = uploadEntries.find((item) => item.id === id);
        if (!entry || !Number.isFinite(idx)) return;
        const next = normalizeHeat(input.value || "");
        entry.heatNumbers = entry.heatNumbers.map((h, i) => (i === idx ? next : h)).filter(Boolean);
      },
      { signal }
    );

    uploadList.addEventListener(
      "change",
      (e) => {
        const target = e.target as HTMLElement;
        const materialSelect = target.closest<HTMLSelectElement>("[data-file-material]");
        if (materialSelect) {
          const id = materialSelect.getAttribute("data-file-id") || "";
          const entry = uploadEntries.find((item) => item.id === id);
          if (!entry) return;
          entry.materialId = (materialSelect.value || "").trim() || null;
          return;
        }

        const fillerSelect = target.closest<HTMLSelectElement>("[data-file-filler]");
        if (fillerSelect) {
          const id = fillerSelect.getAttribute("data-file-id") || "";
          const entry = uploadEntries.find((item) => item.id === id);
          if (!entry) return;
          entry.fillerType = (fillerSelect.value || "").trim() || null;
          return;
        }

        const supplierSelect = target.closest<HTMLSelectElement>("[data-file-supplier]");
        if (supplierSelect) {
          const id = supplierSelect.getAttribute("data-file-id") || "";
          const entry = uploadEntries.find((item) => item.id === id);
          if (!entry) return;
          entry.supplier = (supplierSelect.value || "").trim() || null;
        }
      },
      { signal }
    );

    uploadClear.addEventListener(
      "click",
      () => {
        setUploadPreview(null);
        uploadEntries = uploadEntries.filter((entry) => entry.source.kind === "inbox");
        renderUploadList();
      },
      { signal }
    );

    uploadInitialized = true;
    renderUploadList();
  };

  const ensureUploadPanel = () => {
    if (!uploadInitialized) {
      initUploadPanel();
    } else {
      refreshUploadSuppliers();
      refreshUploadMaterials();
      refreshUploadFillers();
      renderUploadList();
    }
  };

  function renderList(rebuildFilters = false) {
    const materialAll = applyMaterialFilters();
    const fillerAll = applyFillerFilters();
    materialCount.textContent = `${materialAll.length} stk`;
    fillerCount.textContent = `${fillerAll.length} stk`;

    const materialRows = state.rows.filter((r) => r.certificate_type !== "filler");
    const fillerRows = state.rows.filter((r) => r.certificate_type === "filler");

    const materialMap = new Map<string, string>();
    state.materials.forEach((m) => materialMap.set(m.id, m.name));
    materialRows.forEach((r) => {
      if (r.material_id && r.material?.name && !materialMap.has(r.material_id)) {
        materialMap.set(r.material_id, r.material.name);
      }
    });
    const materials = Array.from(materialMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "nb"));

    const materialSupplierNames = state.suppliers.map((s) => s.name).filter(Boolean);
    const materialRowSuppliers = materialRows.map((r) => (r.supplier ?? "").trim()).filter(Boolean);
    const materialSuppliers = Array.from(new Set([...materialSupplierNames, ...materialRowSuppliers])).sort((a, b) =>
      a.localeCompare(b, "nb")
    );

    const fillerTypeSet = new Set<string>();
    state.fillerOptions.forEach((o) => fillerTypeSet.add(o.value));
    fillerRows.forEach((r) => {
      if (r.filler_type) fillerTypeSet.add(r.filler_type);
    });
    const fillerTypes = Array.from(fillerTypeSet).sort((a, b) => a.localeCompare(b, "nb"));

    const fillerSupplierNames = state.suppliers.map((s) => s.name).filter(Boolean);
    const fillerRowSuppliers = fillerRows.map((r) => (r.supplier ?? "").trim()).filter(Boolean);
    const fillerSuppliers = Array.from(new Set([...fillerSupplierNames, ...fillerRowSuppliers])).sort((a, b) =>
      a.localeCompare(b, "nb")
    );

    const ensurePage = (group: MaterialCertificateType, length: number) => {
      const totalPages = Math.max(1, Math.ceil(length / state.pageSize));
      const current = state.pageByType[group] || 1;
      if (current > totalPages) state.pageByType[group] = totalPages;
      if (current < 1) state.pageByType[group] = 1;
      return totalPages;
    };

    const materialTotalPages = ensurePage("material", materialAll.length);
    const fillerTotalPages = ensurePage("filler", fillerAll.length);

    const materialStart = (state.pageByType.material - 1) * state.pageSize;
    const fillerStart = (state.pageByType.filler - 1) * state.pageSize;

    const materialPageRows = materialAll.slice(materialStart, materialStart + state.pageSize);
    const fillerPageRows = fillerAll.slice(fillerStart, fillerStart + state.pageSize);

    currentPageIdsByType.material = materialPageRows.map((r) => r.id);
    currentPageIdsByType.filler = fillerPageRows.map((r) => r.id);

    const renderGroupBody = (
      allRows: MaterialCertificateRow[],
      pageRows: MaterialCertificateRow[],
      groupKey: MaterialCertificateType,
      totalPages: number
    ) => {
      if (allRows.length === 0) {
        return `
          <div class="muted">Ingen data.</div>
        `;
      }

      return `
        ${renderMaterialCertTable(pageRows, state.isAdmin, selectedIds, groupKey)}
        ${
          state.isAdmin
            ? `
        <div class="table-actions-row">
          <button data-bulk-delete-group="${groupKey}" class="btn small danger" type="button" disabled>Slett valgte</button>
        </div>
        `
            : ""
        }
        <div class="cert-group-footer">
          ${renderPagerGroup(groupKey, totalPages, state.pageByType[groupKey])}
        </div>
      `;
    };

    const wrapGroupBody = (groupKey: MaterialCertificateType, bodyHtml: string) => {
      return `<div class="group-body" data-group-body="${groupKey}">${bodyHtml}</div>`;
    };

    const renderMaterialFilters = () => {
      const materialOptions = materials
        .map(
          (m) =>
            `<option value="${esc(m.id)}" ${m.id === filterMaterialId ? "selected" : ""}>${esc(m.name)}</option>`
        )
        .join("");
      const materialSupplierOptions = materialSuppliers
        .map(
          (s) => `<option value="${esc(s)}" ${s === filterMaterialSupplier ? "selected" : ""}>${esc(s)}</option>`
        )
        .join("");
      const extraMaterial =
        filterMaterialId && !materials.some((m) => m.id === filterMaterialId)
          ? `<option value="${esc(filterMaterialId)}" selected>${esc(filterMaterialId)}</option>`
          : "";
      const extraMaterialSupplier =
        filterMaterialSupplier && !materialSuppliers.includes(filterMaterialSupplier)
          ? `<option value="${esc(filterMaterialSupplier)}" selected>${esc(filterMaterialSupplier)}</option>`
          : "";

      return `
        <div class="panel-filters">
          <div class="filter-field">
            <label>Material</label>
            <select data-filter-material class="select">
              <option value="">Alle materialer</option>
              ${materialOptions}
              ${extraMaterial}
            </select>
          </div>
          <div class="filter-field">
            <label>Leverandør</label>
            <select data-filter-material-supplier class="select">
              <option value="">Alle leverandører</option>
              ${materialSupplierOptions}
              ${extraMaterialSupplier}
            </select>
          </div>
          <div class="filter-field">
            <label>Søk</label>
            <input data-filter-material-text class="input" placeholder="Filnavn, heat eller leverandør…" value="${esc(filterMaterialText)}" />
          </div>
          <div class="filter-field">
            <label>Per side</label>
            <select data-page-size-material class="select">
              <option value="10" ${state.pageSize === 10 ? "selected" : ""}>10</option>
              <option value="20" ${state.pageSize === 20 ? "selected" : ""}>20</option>
              <option value="50" ${state.pageSize === 50 ? "selected" : ""}>50</option>
              <option value="100" ${state.pageSize === 100 ? "selected" : ""}>100</option>
            </select>
          </div>
        </div>
      `;
    };

    const renderFillerFilters = () => {
      const fillerTypeOptions = fillerTypes
        .map((t) => `<option value="${esc(t)}" ${t === filterFillerType ? "selected" : ""}>${esc(t)}</option>`)
        .join("");
      const fillerSupplierOptions = fillerSuppliers
        .map(
          (s) => `<option value="${esc(s)}" ${s === filterFillerSupplier ? "selected" : ""}>${esc(s)}</option>`
        )
        .join("");
      const extraFillerType =
        filterFillerType && !fillerTypes.includes(filterFillerType)
          ? `<option value="${esc(filterFillerType)}" selected>${esc(filterFillerType)}</option>`
          : "";
      const extraFillerSupplier =
        filterFillerSupplier && !fillerSuppliers.includes(filterFillerSupplier)
          ? `<option value="${esc(filterFillerSupplier)}" selected>${esc(filterFillerSupplier)}</option>`
          : "";

      return `
        <div class="panel-filters">
          <div class="filter-field">
            <label>Type</label>
            <select data-filter-filler-type class="select">
              <option value="">Alle typer</option>
              ${fillerTypeOptions}
              ${extraFillerType}
            </select>
          </div>
          <div class="filter-field">
            <label>Leverandør</label>
            <select data-filter-filler-supplier class="select">
              <option value="">Alle leverandører</option>
              ${fillerSupplierOptions}
              ${extraFillerSupplier}
            </select>
          </div>
          <div class="filter-field">
            <label>Søk</label>
            <input data-filter-filler-text class="input" placeholder="Filnavn, heat eller leverandør…" value="${esc(filterFillerText)}" />
          </div>
          <div class="filter-field">
            <label>Per side</label>
            <select data-page-size-filler class="select">
              <option value="10" ${state.pageSize === 10 ? "selected" : ""}>10</option>
              <option value="20" ${state.pageSize === 20 ? "selected" : ""}>20</option>
              <option value="50" ${state.pageSize === 50 ? "selected" : ""}>50</option>
              <option value="100" ${state.pageSize === 100 ? "selected" : ""}>100</option>
            </select>
          </div>
        </div>
      `;
    };

    const materialBodyHtml = renderGroupBody(materialAll, materialPageRows, "material", materialTotalPages);
    const fillerBodyHtml = renderGroupBody(fillerAll, fillerPageRows, "filler", fillerTotalPages);

    if (rebuildFilters) {
      materialBody.innerHTML = `${renderMaterialFilters()}${wrapGroupBody("material", materialBodyHtml)}`;
      fillerBody.innerHTML = `${renderFillerFilters()}${wrapGroupBody("filler", fillerBodyHtml)}`;
    } else {
      const materialGroupBody = materialBody.querySelector<HTMLElement>("[data-group-body=material]");
      const fillerGroupBody = fillerBody.querySelector<HTMLElement>("[data-group-body=filler]");
      if (!materialGroupBody || !fillerGroupBody) {
        renderList(true);
        return;
      }
      materialGroupBody.innerHTML = materialBodyHtml;
      fillerGroupBody.innerHTML = fillerBodyHtml;
    }

    if (rebuildFilters) {
      const onPageSizeChange = (value: string) => {
        const next = Number(value);
        if (Number.isFinite(next) && next > 0) {
          state.pageSize = next;
          localStorage.setItem(pageSizeStorageKey, String(next));
          onFilterChange();
        }
      };

      const materialFilterEl = qs<HTMLSelectElement>(materialBody, "[data-filter-material]");
      const materialSupplierEl = qs<HTMLSelectElement>(materialBody, "[data-filter-material-supplier]");
      const materialTextEl = qs<HTMLInputElement>(materialBody, "[data-filter-material-text]");
      const materialPageSizeEl = qs<HTMLSelectElement>(materialBody, "[data-page-size-material]");

      const fillerTypeEl = qs<HTMLSelectElement>(fillerBody, "[data-filter-filler-type]");
      const fillerSupplierEl = qs<HTMLSelectElement>(fillerBody, "[data-filter-filler-supplier]");
      const fillerTextEl = qs<HTMLInputElement>(fillerBody, "[data-filter-filler-text]");
      const fillerPageSizeEl = qs<HTMLSelectElement>(fillerBody, "[data-page-size-filler]");

      materialFilterEl.addEventListener("change", () => {
        filterMaterialId = materialFilterEl.value || "";
        onFilterChange();
      }, { signal });
      materialSupplierEl.addEventListener("change", () => {
        filterMaterialSupplier = materialSupplierEl.value || "";
        onFilterChange();
      }, { signal });
      materialTextEl.addEventListener("input", () => {
        filterMaterialText = materialTextEl.value || "";
        onFilterChange();
      }, { signal });
      materialPageSizeEl.addEventListener("change", () => onPageSizeChange(materialPageSizeEl.value), { signal });

      fillerTypeEl.addEventListener("change", () => {
        filterFillerType = fillerTypeEl.value || "";
        onFilterChange();
      }, { signal });
      fillerSupplierEl.addEventListener("change", () => {
        filterFillerSupplier = fillerSupplierEl.value || "";
        onFilterChange();
      }, { signal });
      fillerTextEl.addEventListener("input", () => {
        filterFillerText = fillerTextEl.value || "";
        onFilterChange();
      }, { signal });
      fillerPageSizeEl.addEventListener("change", () => onPageSizeChange(fillerPageSizeEl.value), { signal });
    }

    updateSelectionUi();
  }

  async function load() {
    const seq = ++state.loadSeq;

    setLoading(true);
    materialBody.innerHTML = `<div class="muted">Laster…</div>`;
    fillerBody.innerHTML = `<div class="muted">Laster…</div>`;

    try {
      const [rows, suppliers, materials, fillerOptions, inboxRows, inboxCount] = await Promise.all([
        fetchMaterialCertificates(),
        fetchSuppliers(),
        fetchMaterials(),
        fetchTraceabilityOptions("filler_type"),
        state.isAdmin ? fetchNewFileInboxByTarget("material_certificate") : Promise.resolve([] as FileInboxRow[]),
        state.isAdmin ? countNewFileInboxByTarget("material_certificate") : Promise.resolve(0),
      ]);
      if (seq !== state.loadSeq) return;
      state.rows = rows;
      state.suppliers = suppliers;
      state.materials = materials;
      state.fillerOptions = fillerOptions;
      inboxNewCount = inboxCount;
      selectedIds.clear();
      renderList(true);
      syncInboxUploadEntries(inboxRows);
      updateOpenUploadButtonLabel();
      ensureUploadPanel();
    } catch (e: any) {
      console.error(e);
      materialBody.innerHTML = `<div class="err">Feil: ${String(e?.message ?? e)}</div>`;
      fillerBody.innerHTML = `<div class="err">Feil: ${String(e?.message ?? e)}</div>`;
    } finally {
      if (seq === state.loadSeq) setLoading(false);
    }
  }

  refreshBtn.addEventListener("click", () => load(), { signal });

  const onFilterChange = () => {
    state.pageByType.material = 1;
    state.pageByType.filler = 1;
    renderList(false);
  };

  const handleBulkDelete = async (group: MaterialCertificateType) => {
    if (!requireAdmin()) return;
    const selectedRows = state.rows.filter(
      (r) => (group === "material" ? r.certificate_type !== "filler" : r.certificate_type === "filler") && selectedIds.has(r.id)
    );
    if (selectedRows.length === 0) return;
    await openConfirmDelete(modalMount, signal, {
      title: "Slett valgte",
      messageHtml: `Dette sletter ${selectedRows.length} sertifikat og PDF-filer.`,
      onConfirm: async () => {
        for (const row of selectedRows) {
          await handleDelete(row);
        }
      },
      onDone: async () => {
        selectedRows.forEach((row) => selectedIds.delete(row.id));
        await load();
      },
    });
  };



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

  uploadSave.addEventListener(
    "click",
    async () => {
      if (!uploadInitialized) return;
      if (!uploadType || !uploadCertType || !uploadSupplier || !uploadMaterial || !uploadFiller) return;
      if (uploadEntries.length === 0) {
        toast("Velg minst én PDF.");
        return;
      }

      const type = (uploadType.value || "material") as MaterialCertificateType;
      const certType = (uploadCertType.value || "3.1").trim() || "3.1";

      if (type === "material") {
        const missing = uploadEntries.filter((entry) => !entry.materialId);
        if (missing.length > 0) {
          toast(`Velg material for ${missing.length} filer.`);
          return;
        }
      } else {
        const missing = uploadEntries.filter((entry) => !entry.fillerType);
        if (missing.length > 0) {
          toast(`Velg sveisetilsett-type for ${missing.length} filer.`);
          return;
        }
        const invalid = uploadEntries.some((entry) => entry.fillerType && !state.fillerOptions.some((o) => o.value === entry.fillerType));
        if (invalid) {
          toast("Velg sveisetilsett-type fra listen.");
          return;
        }
      }

      const entries: MaterialCertUploadEntry[] = uploadEntries.map((entry) => ({
        file: entry.source.kind === "local" ? entry.source.file : null,
        file_id: entry.source.kind === "inbox" ? entry.source.fileId : null,
        inbox_id: entry.source.kind === "inbox" ? entry.source.inboxId : null,
        source_name: getUploadEntryName(entry),
        certificate_type: type,
        cert_type: certType,
        supplier: entry.supplier,
        material_id: type === "material" ? entry.materialId : null,
        filler_type: type === "filler" ? entry.fillerType : null,
        heat_numbers: entry.heatNumbers,
      }));

      uploadSave.disabled = true;
      uploadSave.textContent = "Laster opp…";

      try {
        await uploadBatchWithMeta(entries, (idx, total) => {
          if (uploadStatus) uploadStatus.textContent = `Laster opp ${idx}/${total}…`;
        }, (file, existing) => {
          const label = existing.label ? `"${existing.label}"` : "den eksisterende filen";
          return window.confirm(
            `${file.name} finnes allerede i systemet som ${label}.\n\nVil du linke til eksisterende fil i stedet for å laste opp på nytt?`
          );
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

  pageRoot.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;
      const bulkBtn = target.closest<HTMLButtonElement>("[data-bulk-delete-group]");
      if (bulkBtn) {
        const group = (bulkBtn.getAttribute("data-bulk-delete-group") || "") as MaterialCertificateType | "";
        if (!group) return;
        await handleBulkDelete(group);
        return;
      }
      const pageBtn = target.closest<HTMLButtonElement>("[data-page][data-group]");
      if (pageBtn) {
        const group = (pageBtn.getAttribute("data-group") || "") as MaterialCertificateType | "";
        const next = Number(pageBtn.getAttribute("data-page"));
        if (!group || !Number.isFinite(next) || next < 1) return;
        state.pageByType[group] = next;
        renderList(false);
        return;
      }

      const selectAll = target.closest<HTMLInputElement>("[data-select-all]");
      if (selectAll) {
        const checked = selectAll.checked;
        const group = (selectAll.getAttribute("data-select-all") || "") as MaterialCertificateType | "";
        const groupIds = group ? currentPageIdsByType[group] ?? [] : [];
        groupIds.forEach((id) => {
          if (checked) selectedIds.add(id);
          else selectedIds.delete(id);
        });
        renderList(false);
        return;
      }

      const selectOne = target.closest<HTMLInputElement>("[data-select-id]");
      if (selectOne) {
        const id = selectOne.getAttribute("data-select-id");
        if (id) {
          if (selectOne.checked) selectedIds.add(id);
          else selectedIds.delete(id);
          updateSelectionUi();
        }
        return;
      }

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

      const editId = target.closest("[data-edit]")?.getAttribute("data-edit");
      if (editId) {
        if (!requireAdmin()) return;
        const row = state.rows.find((r) => r.id === editId);
        if (!row) return;
        openEditModal(modalMount, signal, row, state.suppliers, state.materials, state.fillerOptions, load);
        return;
      }

      const delId = target.closest("[data-del]")?.getAttribute("data-del");
      if (delId) {
        if (!requireAdmin()) return;
        const row = state.rows.find((r) => r.id === delId);
        if (!row) return;
        await openConfirmDelete(modalMount, signal, {
          title: "Slett sertifikat",
          messageHtml: "Dette sletter sertifikatet og PDF-filen.",
          onConfirm: async () => handleDelete(row),
          onDone: load,
        });
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

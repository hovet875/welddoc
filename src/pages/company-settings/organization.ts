import { renderHeader, wireHeader } from "../../components/header";
import { getSession, getProfileAccess } from "../../app/auth";
import { toast } from "../../ui/toast";
import { Footer } from "../../components/footer";
import { qs, esc } from "../../utils/dom";
import { openModal, modalSaveButton, renderModal } from "../../ui/modal";
import { openConfirmDelete } from "../../ui/confirm";
import { renderIconButton } from "../../ui/iconButton";
import {
  fetchJobTitles,
  createJobTitle,
  deleteJobTitle,
  updateJobTitle,
  type JobTitleRow,
} from "../../repo/jobTitleRepo";
import {
  fetchCustomers,
  createCustomer,
  deleteCustomer,
  updateCustomer,
  type CustomerRow,
} from "../../repo/customerRepo";
import {
  fetchSuppliers,
  createSupplier,
  deleteSupplier,
  updateSupplier,
  type SupplierRow,
} from "../../repo/supplierRepo";
import {
  fetchNdtSuppliers,
  createNdtSupplier,
  deleteNdtSupplier,
  updateNdtSupplier,
  fetchNdtInspectors,
  createNdtInspector,
  deleteNdtInspector,
  updateNdtInspector,
  type NdtSupplierRow,
  type NdtInspectorRow,
} from "../../repo/ndtSupplierRepo";

import "../../styles/pages/company-settings.css";

export async function renderCompanySettingsOrganization(app: HTMLElement) {
  const session = await getSession();
  let displayName = "Bruker";
  const email = session?.user?.email ?? "";
  let isAdmin = false;

  if (session?.user) {
    try {
      const access = await getProfileAccess(session.user);
      displayName = access.displayName;
      isAdmin = access.isAdmin;
    } catch (err) {
      console.warn("Feilet å hente profil", err);
    }
  }

  if (!isAdmin) {
    app.innerHTML = `
      <div class="shell page-company-settings">
        ${renderHeader(displayName, email)}
        <main class="main">
          <section class="section-header">
            <div>
              <h1 class="section-title">App-parametere – Organisasjon</h1>
              <p class="section-subtitle">Kun admin har tilgang.</p>
            </div>
            <div class="section-actions">
              <a class="btn small" href="#/company-settings">← App-parametere</a>
            </div>
          </section>
          <div class="muted" style="padding:16px;">Kun admin har tilgang.</div>
        </main>
        ${Footer()}
      </div>
    `;
    wireHeader(app);
    return;
  }

  function icon(name: "pencil" | "trash") {
    if (name === "pencil") {
      return `
        <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
          <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L8.25 18.463 3 19.5l1.037-5.25L16.862 3.487zM5.39 17.11l2.872-.566L18.98 5.826l-2.306-2.306L5.956 14.238l-.566 2.872z"/>
        </svg>
      `;
    }
    return `
      <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
        <path fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H5.5a1 1 0 1 0 0 2H6v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h.5a1 1 0 1 0 0-2H16V4a1 1 0 0 0-1-1H9zm1 2h4V4h-4v1zm-1 5a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1z"/>
      </svg>
    `;
  }

  app.innerHTML = `
    <div class="shell page-company-settings">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">App-parametere – Organisasjon</h1>
            <p class="section-subtitle">Stillinger, kunder, leverandører og NDT-kontrollører.</p>
          </div>
          <div class="section-actions">
            <a class="btn small" href="#/company-settings">← App-parametere</a>
          </div>

        </section>

        <section class="section-grid">
          <div class="panel panel-collapsible is-collapsed">
            <div class="panel-head">
              <div class="panel-title">Stillinger</div>
              <div class="panel-meta">Admin</div>
              <button class="panel-toggle" type="button" data-panel-toggle aria-expanded="false">Vis</button>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row inline">
                  <input id="jobTitleInput" class="input" type="text" placeholder="Ny stilling…" />
                  <button data-add-job class="btn primary small">Legg til</button>
                </div>
                <div class="muted" style="font-size:12px;">Stillinger brukes i brukerprofil.</div>
                <div data-job-list class="settings-list"><div class="muted">Laster…</div></div>
              </div>
            </div>
          </div>

          <div class="panel panel-collapsible is-collapsed">
            <div class="panel-head">
              <div class="panel-title">Kunder</div>
              <div class="panel-meta">Admin</div>
              <button class="panel-toggle" type="button" data-panel-toggle aria-expanded="false">Vis</button>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row inline">
                  <input id="customerInput" class="input" type="text" placeholder="Ny kunde…" />
                  <button data-add-customer class="btn primary small">Legg til</button>
                </div>
                <div data-customer-list class="settings-list"><div class="muted">Laster…</div></div>
              </div>
            </div>
          </div>

          <div class="panel panel-collapsible is-collapsed">
            <div class="panel-head">
              <div class="panel-title">Leverandører</div>
              <div class="panel-meta">Admin</div>
              <button class="panel-toggle" type="button" data-panel-toggle aria-expanded="false">Vis</button>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row inline">
                  <input id="supplierInput" class="input" type="text" placeholder="Ny leverandør…" />
                  <button data-add-supplier class="btn primary small">Legg til</button>
                </div>
                <div data-supplier-list class="settings-list"><div class="muted">Laster…</div></div>
              </div>
            </div>
          </div>
          <div class="panel panel-collapsible is-collapsed">
            <div class="panel-head">
              <div class="panel-title">NDT-leverandører og kontrollører</div>
              <div class="panel-meta">Admin</div>
              <button class="panel-toggle" type="button" data-panel-toggle aria-expanded="false">Vis</button>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row inline">
                  <input id="ndtSupplierInput" class="input" type="text" placeholder="Ny NDT-leverandør..." />
                  <button data-add-ndt-supplier class="btn primary small">Legg til leverandør</button>
                </div>
                <div class="settings-row inline">
                  <div class="settings-inputs" style="grid-template-columns: 1fr 1fr;">
                    <select id="ndtInspectorSupplierSelect" class="select">
                      <option value="">Velg leverandør...</option>
                    </select>
                    <input id="ndtInspectorInput" class="input" type="text" placeholder="Ny kontrollør..." />
                  </div>
                  <button data-add-ndt-inspector class="btn primary small">Legg til kontrollør</button>
                </div>
                <div data-ndt-supplier-list class="settings-list"><div class="muted">Laster...</div></div>
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

  const initPanelToggles = () => {
    const panels = Array.from(app.querySelectorAll<HTMLElement>(".panel-collapsible"));
    panels.forEach((panel) => {
      const btn = panel.querySelector<HTMLButtonElement>("[data-panel-toggle]");
      if (!btn) return;
      const sync = () => {
        const isCollapsed = panel.classList.contains("is-collapsed");
        btn.setAttribute("aria-expanded", String(!isCollapsed));
        btn.textContent = isCollapsed ? "Vis" : "Skjul";
      };
      sync();
      btn.addEventListener("click", () => {
        panel.classList.toggle("is-collapsed");
        sync();
      });
    });
  };

  initPanelToggles();

  const jobList = qs<HTMLDivElement>(app, "[data-job-list]");
  const addBtn = app.querySelector<HTMLButtonElement>("[data-add-job]");
  const jobInput = app.querySelector<HTMLInputElement>("#jobTitleInput");
  const customerList = qs<HTMLDivElement>(app, "[data-customer-list]");
  const addCustomerBtn = app.querySelector<HTMLButtonElement>("[data-add-customer]");
  const customerInput = app.querySelector<HTMLInputElement>("#customerInput");
  const supplierList = qs<HTMLDivElement>(app, "[data-supplier-list]");
  const addSupplierBtn = app.querySelector<HTMLButtonElement>("[data-add-supplier]");
  const supplierInput = app.querySelector<HTMLInputElement>("#supplierInput");
  const ndtSupplierList = qs<HTMLDivElement>(app, "[data-ndt-supplier-list]");
  const addNdtSupplierBtn = app.querySelector<HTMLButtonElement>("[data-add-ndt-supplier]");
  const ndtSupplierInput = app.querySelector<HTMLInputElement>("#ndtSupplierInput");
  const ndtInspectorSupplierSelect = app.querySelector<HTMLSelectElement>("#ndtInspectorSupplierSelect");
  const addNdtInspectorBtn = app.querySelector<HTMLButtonElement>("[data-add-ndt-inspector]");
  const ndtInspectorInput = app.querySelector<HTMLInputElement>("#ndtInspectorInput");
  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");
  const modalSignal = new AbortController();
  let ndtSuppliersCache: NdtSupplierRow[] = [];
  let ndtInspectorsCache: NdtInspectorRow[] = [];

  const renderJobTitles = (rows: JobTitleRow[]) => {
    if (rows.length === 0) {
      jobList.innerHTML = `<div class="muted">Ingen stillinger.</div>`;
      return;
    }

    jobList.innerHTML = rows
      .map((r) => {
        return `
          <div class="settings-item" data-id="${esc(r.id)}">
            <div class="settings-item__title">${esc(r.title)}</div>
            <div class="settings-item__meta"></div>
            <div class="settings-item__actions">
              ${renderIconButton({ dataKey: "edit", id: r.id, title: "Endre", icon: icon("pencil"), extraClass: "small" })}
              ${renderIconButton({ dataKey: "delete", id: r.id, title: "Slett", icon: icon("trash"), danger: true, extraClass: "small" })}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderCustomers = (rows: CustomerRow[]) => {
    if (rows.length === 0) {
      customerList.innerHTML = `<div class="muted">Ingen kunder.</div>`;
      return;
    }

    customerList.innerHTML = rows
      .map((r) => {
        return `
          <div class="settings-item" data-customer-id="${esc(r.id)}">
            <div class="settings-item__title">${esc(r.name)}</div>
            <div class="settings-item__meta"></div>
            <div class="settings-item__actions">
              ${renderIconButton({ dataKey: "customer-edit", id: r.id, title: "Endre", icon: icon("pencil"), extraClass: "small" })}
              ${renderIconButton({ dataKey: "customer-delete", id: r.id, title: "Slett", icon: icon("trash"), danger: true, extraClass: "small" })}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderSuppliers = (rows: SupplierRow[]) => {
    if (rows.length === 0) {
      supplierList.innerHTML = `<div class="muted">Ingen leverandører.</div>`;
      return;
    }

    supplierList.innerHTML = rows
      .map((r) => {
        return `
          <div class="settings-item" data-supplier-id="${esc(r.id)}">
            <div class="settings-item__title">${esc(r.name)}</div>
            <div class="settings-item__meta"></div>
            <div class="settings-item__actions">
              ${renderIconButton({ dataKey: "supplier-edit", id: r.id, title: "Endre", icon: icon("pencil"), extraClass: "small" })}
              ${renderIconButton({ dataKey: "supplier-delete", id: r.id, title: "Slett", icon: icon("trash"), danger: true, extraClass: "small" })}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderNdtSupplierSelectOptions = (selectedSupplierId = "") => {
    if (!ndtInspectorSupplierSelect) return;
    const rows = ndtSuppliersCache
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((row) => `<option value="${esc(row.id)}">${esc(row.name)}</option>`)
      .join("");
    ndtInspectorSupplierSelect.innerHTML = `<option value="">Velg leverandør...</option>${rows}`;
    if (selectedSupplierId && ndtSuppliersCache.some((row) => row.id === selectedSupplierId)) {
      ndtInspectorSupplierSelect.value = selectedSupplierId;
    } else {
      ndtInspectorSupplierSelect.value = "";
    }
  };

  const renderNdtSuppliersAndInspectors = () => {
    if (ndtSuppliersCache.length === 0) {
      ndtSupplierList.innerHTML = `<div class="muted">Ingen NDT-leverandører.</div>`;
      renderNdtSupplierSelectOptions();
      return;
    }

    const inspectorsBySupplier = new Map<string, NdtInspectorRow[]>();
    for (const supplier of ndtSuppliersCache) inspectorsBySupplier.set(supplier.id, []);
    for (const inspector of ndtInspectorsCache) {
      if (!inspectorsBySupplier.has(inspector.supplier_id)) continue;
      inspectorsBySupplier.get(inspector.supplier_id)!.push(inspector);
    }
    for (const rows of inspectorsBySupplier.values()) {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    }

    ndtSupplierList.innerHTML = ndtSuppliersCache
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((supplier) => {
        const inspectors = inspectorsBySupplier.get(supplier.id) ?? [];
        const inspectorsHtml =
          inspectors.length === 0
            ? `<div class="muted" style="font-size:12px;">Ingen kontrollører.</div>`
            : inspectors
                .map((inspector) => {
                  return `
                    <div class="settings-item settings-item--sub" data-ndt-inspector-id="${esc(inspector.id)}">
                      <div class="settings-item__title">${esc(inspector.name)}</div>
                      <div class="settings-item__meta">Kontrollør</div>
                      <div class="settings-item__actions">
                        ${renderIconButton({
                          dataKey: "ndt-inspector-edit",
                          id: inspector.id,
                          title: "Endre",
                          icon: icon("pencil"),
                          extraClass: "small",
                        })}
                        ${renderIconButton({
                          dataKey: "ndt-inspector-delete",
                          id: inspector.id,
                          title: "Slett",
                          icon: icon("trash"),
                          danger: true,
                          extraClass: "small",
                        })}
                      </div>
                    </div>
                  `;
                })
                .join("");

        return `
          <div class="settings-subgroup" data-ndt-supplier-id="${esc(supplier.id)}">
            <div class="settings-item">
              <div class="settings-item__title">${esc(supplier.name)}</div>
              <div class="settings-item__meta">${inspectors.length} kontrollører</div>
              <div class="settings-item__actions">
                ${renderIconButton({
                  dataKey: "ndt-supplier-edit",
                  id: supplier.id,
                  title: "Endre",
                  icon: icon("pencil"),
                  extraClass: "small",
                })}
                ${renderIconButton({
                  dataKey: "ndt-supplier-delete",
                  id: supplier.id,
                  title: "Slett",
                  icon: icon("trash"),
                  danger: true,
                  extraClass: "small",
                })}
              </div>
            </div>
            <div class="settings-sublist">${inspectorsHtml}</div>
          </div>
        `;
      })
      .join("");

    const current = ndtInspectorSupplierSelect?.value ?? "";
    renderNdtSupplierSelectOptions(current);
  };

  async function loadJobs() {
    jobList.innerHTML = `<div class="muted">Laster…</div>`;
    try {
      const rows = await fetchJobTitles();
      renderJobTitles(rows);
    } catch (err: any) {
      console.error(err);
      jobList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
    }
  }

  async function loadCustomers() {
    customerList.innerHTML = `<div class="muted">Laster…</div>`;
    try {
      const rows = await fetchCustomers({ includeInactive: true });
      renderCustomers(rows);
    } catch (err: any) {
      console.error(err);
      customerList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
    }
  }

  async function loadSuppliers() {
    supplierList.innerHTML = `<div class="muted">Laster…</div>`;
    try {
      const rows = await fetchSuppliers({ includeInactive: true });
      renderSuppliers(rows);
    } catch (err: any) {
      console.error(err);
      supplierList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
    }
  }

  async function loadNdtSuppliersAndInspectors() {
    ndtSupplierList.innerHTML = `<div class="muted">Laster...</div>`;
    try {
      const [suppliers, inspectors] = await Promise.all([
        fetchNdtSuppliers({ includeInactive: true }),
        fetchNdtInspectors({ includeInactive: true }),
      ]);
      ndtSuppliersCache = suppliers;
      ndtInspectorsCache = inspectors;
      renderNdtSuppliersAndInspectors();
    } catch (err: any) {
      console.error(err);
      ndtSupplierList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
      renderNdtSupplierSelectOptions();
    }
  }

  addBtn?.addEventListener("click", async () => {
    if (!isAdmin) return toast("Kun admin kan endre.");
    const title = (jobInput?.value ?? "").trim();
    if (!title) return toast("Skriv inn stilling.");
    try {
      await createJobTitle(title);
      if (jobInput) jobInput.value = "";
      await loadJobs();
    } catch (err: any) {
      console.error(err);
      toast("Kunne ikke legge til.");
    }
  });

  addCustomerBtn?.addEventListener("click", async () => {
    if (!isAdmin) return toast("Kun admin kan endre.");
    const name = (customerInput?.value ?? "").trim();
    if (!name) return toast("Skriv inn kundenavn.");
    try {
      await createCustomer(name);
      if (customerInput) customerInput.value = "";
      await loadCustomers();
    } catch (err: any) {
      console.error(err);
      toast("Kunne ikke legge til.");
    }
  });

  addSupplierBtn?.addEventListener("click", async () => {
    if (!isAdmin) return toast("Kun admin kan endre.");
    const name = (supplierInput?.value ?? "").trim();
    if (!name) return toast("Skriv inn leverandørnavn.");
    try {
      await createSupplier(name);
      if (supplierInput) supplierInput.value = "";
      await loadSuppliers();
    } catch (err: any) {
      console.error(err);
      toast("Kunne ikke legge til.");
    }
  });

  addNdtSupplierBtn?.addEventListener("click", async () => {
    if (!isAdmin) return toast("Kun admin kan endre.");
    const name = (ndtSupplierInput?.value ?? "").trim();
    if (!name) return toast("Skriv inn NDT-leverandør.");
    try {
      await createNdtSupplier(name);
      if (ndtSupplierInput) ndtSupplierInput.value = "";
      await loadNdtSuppliersAndInspectors();
    } catch (err: any) {
      console.error(err);
      toast(String(err?.message ?? err));
    }
  });

  addNdtInspectorBtn?.addEventListener("click", async () => {
    if (!isAdmin) return toast("Kun admin kan endre.");
    const supplierId = (ndtInspectorSupplierSelect?.value ?? "").trim();
    const name = (ndtInspectorInput?.value ?? "").trim();
    if (!supplierId) return toast("Velg NDT-leverandør.");
    if (!name) return toast("Skriv inn kontrollør.");
    try {
      await createNdtInspector({ supplier_id: supplierId, name });
      if (ndtInspectorInput) ndtInspectorInput.value = "";
      if (ndtInspectorSupplierSelect) ndtInspectorSupplierSelect.value = supplierId;
      await loadNdtSuppliersAndInspectors();
    } catch (err: any) {
      console.error(err);
      toast(String(err?.message ?? err));
    }
  });

  jobList.addEventListener("click", async (e) => {
    if (!isAdmin) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const item = target.closest<HTMLElement>(".settings-item");
    if (!item) return;
    const id = item.getAttribute("data-id") || "";
    if (!id) return;

    if (target.closest("[data-delete]")) {
      const label = item.querySelector(".settings-item__title")?.textContent?.trim() || "stillingen";
      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett stilling",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => {
          await deleteJobTitle(id);
        },
        onDone: async () => {
          await loadJobs();
        },
      });
      return;
    }

    if (target.closest("[data-edit]")) {
      const current = item.querySelector(".settings-item__title")?.textContent?.trim() ?? "";
      const modalHtml = renderModal(
        "Endre stilling",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Stilling</label>
              <input data-f="title" class="input" type="text" value="${esc(current)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);

      save.addEventListener("click", async () => {
        const title = (h.root.querySelector<HTMLInputElement>("[data-f=title]")?.value ?? "").trim();
        if (!title) return toast("Skriv inn stilling.");
        try {
          await updateJobTitle(id, title);
          h.close();
          await loadJobs();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast("Kunne ikke oppdatere.");
        }
      });
    }
  });

  customerList.addEventListener("click", async (e) => {
    if (!isAdmin) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const item = target.closest<HTMLElement>("[data-customer-id]");
    if (!item) return;
    const id = item.getAttribute("data-customer-id") || "";
    if (!id) return;

    if (target.closest("[data-customer-delete]")) {
      const label = item.querySelector(".settings-item__title")?.textContent?.trim() || "kunden";
      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett kunde",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => {
          await deleteCustomer(id);
        },
        onDone: async () => {
          await loadCustomers();
        },
      });
      return;
    }

    if (target.closest("[data-customer-edit]")) {
      const current = item.querySelector(".settings-item__title")?.textContent?.trim() ?? "";
      const modalHtml = renderModal(
        "Endre kunde",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Kunde</label>
              <input data-f="name" class="input" type="text" value="${esc(current)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);

      save.addEventListener("click", async () => {
        const name = (h.root.querySelector<HTMLInputElement>("[data-f=name]")?.value ?? "").trim();
        if (!name) return toast("Skriv inn kundenavn.");
        try {
          await updateCustomer(id, name);
          h.close();
          await loadCustomers();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast("Kunne ikke oppdatere.");
        }
      });
    }
  });

  supplierList.addEventListener("click", async (e) => {
    if (!isAdmin) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const item = target.closest<HTMLElement>("[data-supplier-id]");
    if (!item) return;
    const id = item.getAttribute("data-supplier-id") || "";
    if (!id) return;

    if (target.closest("[data-supplier-delete]")) {
      const label = item.querySelector(".settings-item__title")?.textContent?.trim() || "leverandøren";
      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett leverandør",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => {
          await deleteSupplier(id);
        },
        onDone: async () => {
          await loadSuppliers();
        },
      });
      return;
    }

    if (target.closest("[data-supplier-edit]")) {
      const current = item.querySelector(".settings-item__title")?.textContent?.trim() ?? "";
      const modalHtml = renderModal(
        "Endre leverandør",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Leverandør</label>
              <input data-f="name" class="input" type="text" value="${esc(current)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);

      save.addEventListener("click", async () => {
        const name = (h.root.querySelector<HTMLInputElement>("[data-f=name]")?.value ?? "").trim();
        if (!name) return toast("Skriv inn leverandørnavn.");
        try {
          await updateSupplier(id, name);
          h.close();
          await loadSuppliers();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast("Kunne ikke oppdatere.");
        }
      });
    }
  });

  ndtSupplierList.addEventListener("click", async (e) => {
    if (!isAdmin) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const supplierItem = target.closest<HTMLElement>("[data-ndt-supplier-id]");
    const inspectorItem = target.closest<HTMLElement>("[data-ndt-inspector-id]");

    if (supplierItem && target.closest("[data-ndt-supplier-delete]")) {
      const id = supplierItem.getAttribute("data-ndt-supplier-id") || "";
      if (!id) return;
      const label = supplierItem.querySelector(".settings-item__title")?.textContent?.trim() || "leverandøren";
      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett NDT-leverandør",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>? kontrollører blir også slettet.`,
        onConfirm: async () => {
          await deleteNdtSupplier(id);
        },
        onDone: async () => {
          await loadNdtSuppliersAndInspectors();
        },
      });
      return;
    }

    if (supplierItem && target.closest("[data-ndt-supplier-edit]")) {
      const id = supplierItem.getAttribute("data-ndt-supplier-id") || "";
      if (!id) return;
      const current = supplierItem.querySelector(".settings-item__title")?.textContent?.trim() ?? "";
      const modalHtml = renderModal(
        "Endre NDT-leverandør",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>NDT-leverandør</label>
              <input data-f="name" class="input" type="text" value="${esc(current)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);

      save.addEventListener("click", async () => {
        const name = (h.root.querySelector<HTMLInputElement>("[data-f=name]")?.value ?? "").trim();
        if (!name) return toast("Skriv inn NDT-leverandør.");
        try {
          await updateNdtSupplier(id, name);
          h.close();
          await loadNdtSuppliersAndInspectors();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
      });
      return;
    }

    if (inspectorItem && target.closest("[data-ndt-inspector-delete]")) {
      const id = inspectorItem.getAttribute("data-ndt-inspector-id") || "";
      if (!id) return;
      const label = inspectorItem.querySelector(".settings-item__title")?.textContent?.trim() || "kontrolløren";
      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett kontrollør",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => {
          await deleteNdtInspector(id);
        },
        onDone: async () => {
          await loadNdtSuppliersAndInspectors();
        },
      });
      return;
    }

    if (inspectorItem && target.closest("[data-ndt-inspector-edit]")) {
      const id = inspectorItem.getAttribute("data-ndt-inspector-id") || "";
      if (!id) return;
      const current = ndtInspectorsCache.find((row) => row.id === id);
      if (!current) return;

      const supplierOptions = ndtSuppliersCache
        .map((row) => {
          const selected = row.id === current.supplier_id ? "selected" : "";
          return `<option value="${esc(row.id)}" ${selected}>${esc(row.name)}</option>`;
        })
        .join("");

      const modalHtml = renderModal(
        "Endre kontrollør",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Leverandør</label>
              <select data-f="supplier_id" class="select">
                <option value="">Velg leverandør...</option>
                ${supplierOptions}
              </select>
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Kontrollør</label>
              <input data-f="name" class="input" type="text" value="${esc(current.name)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);

      save.addEventListener("click", async () => {
        const supplier_id = (h.root.querySelector<HTMLSelectElement>("[data-f=supplier_id]")?.value ?? "").trim();
        const name = (h.root.querySelector<HTMLInputElement>("[data-f=name]")?.value ?? "").trim();
        if (!supplier_id) return toast("Velg leverandør.");
        if (!name) return toast("Skriv inn kontrollør.");
        try {
          await updateNdtInspector(id, { supplier_id, name });
          h.close();
          if (ndtInspectorSupplierSelect) ndtInspectorSupplierSelect.value = supplier_id;
          await loadNdtSuppliersAndInspectors();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
      });
    }
  });

  await loadJobs();
  await loadCustomers();
  await loadSuppliers();
  await loadNdtSuppliersAndInspectors();
}

import { renderHeader, wireHeader } from "../../components/header";
import { getSession, getProfileAccess } from "../../app/auth";
import { Footer } from "../../components/footer";
import { esc, qs } from "../../utils/dom";
import { toast } from "../../ui/toast";
import { openConfirmDelete } from "../../ui/confirm";
import { openModal, modalSaveButton, renderModal } from "../../ui/modal";
import { iconSvg, renderIconButton } from "../../ui/iconButton";
import { createCustomer, fetchCustomers, type CustomerRow } from "../../repo/customerRepo";
import { createProject, deleteProject, fetchProjects, updateProject } from "../../repo/projectRepo";

import "../../styles/pages/projects.css";

function actionBtn(kind: "edit" | "del", id: string, label: string) {
  const danger = kind === "del";
  const svg = danger ? iconSvg("trash") : iconSvg("pencil");
  const title = danger ? "Slett" : "Endre";
  const dataKey = danger ? "del" : "edit";
  return renderIconButton({ dataKey, id, title, icon: svg, danger, label });
}

function renderProjectForm(customers: CustomerRow[]) {
  const customerOptions = customers.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
  return `
    <div class="modalgrid">
      <div class="field">
        <label>Prosjektnr</label>
        <input data-f="project_no" type="number" min="1" max="10000" step="1" class="input" placeholder="1" />
      </div>
      <div class="field">
        <label>Arbeidsordre</label>
        <input data-f="work_order" class="input" placeholder="AO-nummer" />
      </div>
      <div class="field">
        <label>Navn</label>
        <input data-f="name" class="input" placeholder="Prosjektnavn" />
      </div>
      <div class="field">
        <label>Kunde</label>
        <select data-f="customer" class="select">
          <option value="">Velg kunde…</option>
          ${customerOptions}
          <option value="__new__">Ny kunde…</option>
        </select>
      </div>
      <div class="field">
        <label>Status</label>
        <select data-f="is_active" class="select">
          <option value="true">Aktiv</option>
          <option value="false">Inaktiv</option>
        </select>
      </div>
    </div>
  `;
}

export async function renderProjectsPage(app: HTMLElement) {
  const prev = (app as any).__projects_unmount as undefined | (() => void);
  if (prev) prev();

  const controller = new AbortController();
  const { signal } = controller;

  (app as any).__projects_unmount = () => {
    controller.abort();
    (app as any).__projects_unmount = undefined;
  };

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

  app.innerHTML = `
    <div class="shell page-projects">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">Prosjekter</h1>
            <p class="section-subtitle">Oversikt over aktive og inaktive prosjekter.</p>
          </div>
          <div class="section-actions">
            <button data-new-project class="btn accent small">Nytt prosjekt</button>
            <button data-refresh class="btn small">Oppdater</button>
          </div>
        </section>

        <section class="filters">
          <div class="field" data-filter-status-field>
            <label>Status</label>
            <select data-filter-status class="select">
              <option value="">Alle</option>
              <option value="active">Aktive</option>
              <option value="inactive">Inaktive</option>
            </select>
          </div>
          <div class="field">
            <label>Kunde</label>
            <select data-filter-customer class="select">
              <option value="">Alle kunder</option>
            </select>
          </div>
          <div class="field">
            <label>Søk</label>
            <input data-filter-text class="input" placeholder="Prosjektnr, navn, kunde eller AO…" />
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div class="panel-title">Prosjekter</div>
            <div data-project-count class="panel-meta">—</div>
          </div>
          <div class="panel-body">
            <div class="table-scroll">
              <table class="data-table project-table">
                <thead>
                  <tr>
                    <th>Prosjektnr</th>
                    <th>Arbeidsordre</th>
                    <th>Navn</th>
                    <th>Kunde</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody data-project-body>
                  <tr><td colspan="6" class="muted">Laster…</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div data-modal-mount></div>
      </main>

      ${Footer()}
    </div>
  `;

  wireHeader(app);

  const projectBody = qs<HTMLTableSectionElement>(app, "[data-project-body]");
  const projectCount = qs<HTMLDivElement>(app, "[data-project-count]");
  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");

  const refreshBtn = qs<HTMLButtonElement>(app, "[data-refresh]");
  const newBtn = qs<HTMLButtonElement>(app, "[data-new-project]");
  const filterStatusField = qs<HTMLDivElement>(app, "[data-filter-status-field]");
  const filterStatus = qs<HTMLSelectElement>(app, "[data-filter-status]");
  const filterCustomer = qs<HTMLSelectElement>(app, "[data-filter-customer]");
  const filterText = qs<HTMLInputElement>(app, "[data-filter-text]");

  let projects: Awaited<ReturnType<typeof fetchProjects>> = [];
  let customers: Awaited<ReturnType<typeof fetchCustomers>> = [];
  let loadSeq = 0;

  const setLoading = (isLoading: boolean) => {
    refreshBtn.disabled = isLoading;
    newBtn.disabled = isLoading;
  };

  const updateAdminUi = () => {
    newBtn.style.display = isAdmin ? "" : "none";
    filterStatus.disabled = !isAdmin;
    filterStatusField.style.display = isAdmin ? "" : "none";
    if (!isAdmin) {
      filterStatus.value = "active";
    }
  };

  const requireAdmin = () => {
    if (!isAdmin) {
      toast("Du må være admin for å gjøre dette.");
      return false;
    }
    return true;
  };

  const applyFilters = () => {
    const status = (filterStatus.value || "").trim();
    const customer = (filterCustomer.value || "").trim().toLowerCase();
    const text = (filterText.value || "").trim().toLowerCase();

    return projects.filter((p) => {
      if (!isAdmin && !p.is_active) return false;
      if (status === "active" && !p.is_active) return false;
      if (status === "inactive" && p.is_active) return false;
      if (customer) {
        const cust = (p.customer || "").trim().toLowerCase();
        if (cust !== customer) return false;
      }
      if (text) {
        const hay = `${p.project_no} ${p.work_order} ${p.customer} ${p.name}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  };

  const renderCustomerFilter = () => {
    const selected = (filterCustomer.value || "").trim();
    const names = Array.from(new Set(customers.map((c) => c.name).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    filterCustomer.innerHTML = `
      <option value="">Alle kunder</option>
      ${names.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}
    `;
    if (selected && !names.includes(selected)) {
      const opt = document.createElement("option");
      opt.value = selected;
      opt.textContent = selected;
      filterCustomer.appendChild(opt);
    }
    filterCustomer.value = selected;
  };

  const renderList = () => {
    const rows = applyFilters().sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      const aTime = Date.parse(a.created_at) || 0;
      const bTime = Date.parse(b.created_at) || 0;
      return bTime - aTime;
    });
    projectCount.textContent = `${rows.length} stk`;

    if (rows.length === 0) {
      projectBody.innerHTML = `<tr><td colspan="6" class="muted">Ingen prosjekter.</td></tr>`;
      return;
    }

    projectBody.innerHTML = rows
      .map((p) => {
        const statusLabel = p.is_active ? "Aktiv" : "Inaktiv";
        const statusClass = p.is_active ? "status-pill ok" : "status-pill fault";
        return `
          <tr>
            <td data-label="Prosjektnr"><a class="type-pill pill-other linkbtn" href="#/prosjekter/${esc(p.id)}">${esc(String(p.project_no))}</a></td>
            <td data-label="Arbeidsordre">${esc(p.work_order)}</td>
            <td data-label="Navn">${esc(p.name)}</td>
            <td data-label="Kunde">${esc(p.customer)}</td>
            <td data-label="Status"><span class="${statusClass}">${statusLabel}</span></td>
            <td class="actcell">
              ${isAdmin ? actionBtn("edit", p.id, String(p.project_no)) : ""}
              ${isAdmin ? actionBtn("del", p.id, String(p.project_no)) : ""}
            </td>
          </tr>
        `;
      })
      .join("");
  };

  const openProjectModal = (mode: "new" | "edit", row: (typeof projects)[number] | null) => {
    const title = mode === "new" ? "Nytt prosjekt" : "Endre prosjekt";
    const saveLabel = mode === "new" ? "Lagre" : "Oppdater";
    const modalHtml = renderModal(title, renderProjectForm(customers), saveLabel);
    const h = openModal(modalMount, modalHtml, signal);

    const projectNo = qs<HTMLInputElement>(h.root, "[data-f=project_no]");
    const workOrder = qs<HTMLInputElement>(h.root, "[data-f=work_order]");
    const customer = qs<HTMLSelectElement>(h.root, "[data-f=customer]");
    const name = qs<HTMLInputElement>(h.root, "[data-f=name]");
    const isActive = qs<HTMLSelectElement>(h.root, "[data-f=is_active]");

    const setCustomerOptions = (selectedValue?: string) => {
      const options = customers.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
      customer.innerHTML = `
        <option value="">Velg kunde…</option>
        ${options}
        <option value="__new__">Ny kunde…</option>
      `;
      if (selectedValue) {
        const hasOption = Array.from(customer.options).some((opt) => opt.value === selectedValue);
        if (selectedValue && !hasOption) {
          const opt = document.createElement("option");
          opt.value = selectedValue;
          opt.textContent = selectedValue;
          customer.appendChild(opt);
        }
        customer.value = selectedValue;
      }
    };

    const handleNewCustomer = async () => {
      const nameValue = (window.prompt("Ny kunde:", "") || "").trim();
      if (!nameValue) {
        customer.value = "";
        return;
      }
      try {
        await createCustomer(nameValue);
        customers = await fetchCustomers();
        renderCustomerFilter();
        setCustomerOptions(nameValue);
      } catch (e: any) {
        console.error(e);
        toast(String(e?.message ?? e));
        customer.value = "";
      }
    };

    if (row) {
      projectNo.value = String(row.project_no);
      workOrder.value = row.work_order;
      name.value = row.name;
      const currentCustomer = row.customer ?? "";
      setCustomerOptions(currentCustomer);
      isActive.value = row.is_active ? "true" : "false";
    } else {
      setCustomerOptions();
    }

    customer.addEventListener(
      "change",
      async () => {
        if (customer.value === "__new__") {
          await handleNewCustomer();
        }
      },
      { signal }
    );

    const save = modalSaveButton(h.root);
    save.addEventListener(
      "click",
      async () => {
        save.disabled = true;
        save.textContent = "Lagrer…";
        try {
          const project_no = projectNo.value.trim();
          const project_no_value = project_no ? Number(project_no) : null;
          const work_order = workOrder.value.trim();
          const customerValue = customer.value.trim();
          const nameValue = name.value.trim();
          const is_active = isActive.value === "true";

          if (!project_no || project_no_value == null || Number.isNaN(project_no_value)) {
            throw new Error("Prosjektnr må være et tall.");
          }
          if (project_no_value < 1 || project_no_value > 10000) {
            throw new Error("Prosjektnr må være mellom 1 og 10000.");
          }
          if (!work_order || !customerValue || !nameValue) {
            throw new Error("Fyll inn prosjektnr, arbeidsordre, kunde og navn.");
          }
          if (customerValue === "__new__") {
            throw new Error("Velg en kunde.");
          }

          if (mode === "new") {
            await createProject({ project_no: project_no_value, work_order, customer: customerValue, name: nameValue, is_active });
          } else if (row) {
            await updateProject(row.id, { project_no: project_no_value, work_order, customer: customerValue, name: nameValue, is_active });
          }

          h.close();
          await load();
        } catch (e: any) {
          console.error(e);
          toast(String(e?.message ?? e));
        } finally {
          save.disabled = false;
          save.textContent = saveLabel;
        }
      },
      { signal }
    );
  };

  const load = async () => {
    const seq = ++loadSeq;
    setLoading(true);
    projectBody.innerHTML = `<tr><td colspan="6" class="muted">Laster…</td></tr>`;

    try {
      const [proj, cust] = await Promise.all([fetchProjects(), fetchCustomers()]);
      if (seq !== loadSeq) return;
      projects = proj;
      customers = cust;
      renderCustomerFilter();
      renderList();
    } catch (e: any) {
      console.error(e);
      projectBody.innerHTML = `<tr><td colspan="6" class="err">Feil: ${String(e?.message ?? e)}</td></tr>`;
    } finally {
      if (seq === loadSeq) setLoading(false);
    }
  };

  refreshBtn.addEventListener("click", load, { signal });
  newBtn.addEventListener(
    "click",
    () => {
      if (!requireAdmin()) return;
      openProjectModal("new", null);
    },
    { signal }
  );
  filterStatus.addEventListener("change", renderList, { signal });
  filterCustomer.addEventListener("change", renderList, { signal });
  filterText.addEventListener("input", renderList, { signal });

  projectBody.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;
      const editId = target.closest("[data-edit]")?.getAttribute("data-edit");
      if (editId) {
        if (!requireAdmin()) return;
        const row = projects.find((p) => p.id === editId) || null;
        if (row) openProjectModal("edit", row);
        return;
      }

      const delId = target.closest("[data-del]")?.getAttribute("data-del");
      if (delId) {
        if (!requireAdmin()) return;
        const row = projects.find((p) => p.id === delId) || null;
        if (!row) return;
        await openConfirmDelete(modalMount, signal, {
          title: "Slett prosjekt",
          messageHtml: `Dette sletter prosjektet <strong>${row.project_no}</strong>.`,
          onConfirm: async () => deleteProject(row.id),
          onDone: load,
        });
      }
    },
    { signal }
  );

  updateAdminUi();
  await load();
}

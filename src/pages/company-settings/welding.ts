import { renderHeader, wireHeader } from "../../components/header";
import { getSession, getProfileAccess } from "../../app/auth";
import { toast } from "../../ui/toast";
import { Footer } from "../../components/footer";
import { qs, esc } from "../../utils/dom";
import { openModal, modalSaveButton, renderModal } from "../../ui/modal";
import { openConfirmDelete } from "../../ui/confirm";
import { renderIconButton } from "../../ui/iconButton";
import { supabase } from "../../services/supabaseClient";

import {
  fetchMaterials,
  createMaterial,
  deleteMaterial,
  updateMaterial,
  type MaterialRow,
} from "../../repo/materialRepo";
import {
  fetchStandards,
  createStandard,
  updateStandard,
  deleteStandard,
  fetchStandardFmGroups,
  createStandardFmGroup,
  updateStandardFmGroup,
  deleteStandardFmGroup,
  type StandardRow,
  type StandardFmGroupRow,
} from "../../repo/standardRepo";
import {
  fetchNdtMethods,
  createNdtMethod,
  updateNdtMethod,
  deleteNdtMethod,
  type NdtMethodRow,
} from "../../repo/ndtReportRepo";
import {
  fetchWeldingProcesses,
  createWeldingProcess,
  updateWeldingProcess,
  deleteWeldingProcess,
  type WeldingProcessRow,
} from "../../repo/weldingProcessRepo";
import {
  fetchWeldJointTypes,
  createWeldJointType,
  updateWeldJointType,
  deleteWeldJointType,
  type WeldJointTypeRow,
} from "../../repo/weldJointTypeRepo";
import {
  fetchTraceabilityTypes,
  upsertTraceabilityType,
  deleteTraceabilityType,
  fetchTraceabilityOptions,
  createTraceabilityOption,
  deleteTraceabilityOption,
  setDefaultTraceabilityOption,
  type TraceabilityTypeRow,
} from "../../repo/traceabilityRepo";

import "../../styles/pages/company-settings.css";

export async function renderCompanySettingsWelding(app: HTMLElement) {
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
              <h1 class="section-title">App-parametere – Teknisk / Sveising</h1>
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

  const yearNow = new Date().getFullYear();
  const yearOptionsHtml = [
    `<option value="">Ingen revisjon</option>`,
    ...Array.from({ length: 31 }, (_, i) => {
      const y = String(yearNow - i);
      return `<option value="${esc(y)}">${esc(y)}</option>`;
    }),
  ].join("");

  const STANDARD_TYPES = [
    "Sveisesertifisering",
    "Sveiseprosedyreprøving",
    "Sveiseprosedyrespesifikasjon",
    "Material/typestandard",
    "Utførelse",
    "Inspeksjon",
    "Annet",
  ] as const;

  const renderTypeOptions = (selected?: string | null) => {
    const rows = [`<option value="">Velg type…</option>`];
    for (const t of STANDARD_TYPES) {
      rows.push(`<option value="${esc(t)}" ${selected === t ? "selected" : ""}>${esc(t)}</option>`);
    }
    if (selected && !STANDARD_TYPES.includes(selected as any)) {
      rows.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
    }
    return rows.join("");
  };

  app.innerHTML = `
    <div class="shell page-company-settings">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">App-parametere – Teknisk / Sveising</h1>
            <p class="section-subtitle">Materialer, standarder, NDT-metoder, sveiseprosesser og sveisefuger.</p>
          </div>
          <div class="section-actions">
            <a class="btn small" href="#/company-settings">← App-parametere</a>
          </div>
        </section>

        <section class="section-grid">
          <div class="panel panel-collapsible is-collapsed">
            <div class="panel-head">
              <div class="panel-title">Materialer</div>
              <div class="panel-meta">Admin</div>
              <button class="panel-toggle" type="button" data-panel-toggle aria-expanded="false">Vis</button>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row inline">
                  <div class="settings-inputs">
                    <input id="materialName" class="input" type="text" placeholder="Materialnavn…" />
                    <input id="materialCode" class="input" type="text" placeholder="Materialkode…" />
                    <input id="materialGroup" class="input" type="text" placeholder="Materialgruppe…" />
                  </div>
                  <button data-add-material class="btn primary small">Legg til</button>
                </div>
                <div class="muted" style="font-size:12px;">Vises som «Navn (kode) - gruppe».</div>
                <div data-material-list class="settings-list"><div class="muted">Laster…</div></div>
              </div>
            </div>
          </div>

          <div class="panel panel-collapsible is-collapsed">
            <div class="panel-head">
              <div class="panel-title">Standarder</div>
              <div class="panel-meta">Admin</div>
              <button class="panel-toggle" type="button" data-panel-toggle aria-expanded="false">Vis</button>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row inline">
                  <div class="settings-inputs">
                    <select id="standardType" class="select">
                      ${renderTypeOptions(null)}
                    </select>
                    <input id="standardLabel" class="input" type="text" placeholder="Standardnavn… (f.eks NS-ISO 9606-1)" />
                    <input id="standardDescription" class="input" type="text" placeholder="Beskrivelse…" />
                    <select id="standardRevision" class="select">
                      ${yearOptionsHtml}
                    </select>
                  </div>
                  <div class="settings-row" style="gap:12px;align-items:center;">
                    <button data-add-standard class="btn primary small">Legg til</button>
                  </div>
                </div>
                <div data-standard-list class="settings-list"><div class="muted">Laster…</div></div>
              </div>
            </div>
          </div>

          <div class="panel panel-collapsible is-collapsed">
            <div class="panel-head">
              <div class="panel-title">NDT-metoder</div>
              <div class="panel-meta">Admin</div>
              <button class="panel-toggle" type="button" data-panel-toggle aria-expanded="false">Vis</button>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row inline">
                  <div class="settings-inputs">
                    <input id="ndtMethodCode" class="input" type="text" placeholder="Kode… (f.eks RT)" />
                    <input id="ndtMethodLabel" class="input" type="text" placeholder="Navn…" />
                    <input id="ndtMethodDescription" class="input" type="text" placeholder="Beskrivelse…" />
                    <select id="ndtMethodStandard" class="select">
                      <option value="">Standard (valgfritt)…</option>
                    </select>
                  </div>
                  <button data-add-ndt-method class="btn primary small">Legg til</button>
                </div>
                <div class="muted" style="font-size:12px;">NDT-metoder brukes i sertifikater og rapporter.</div>
                <div data-ndt-method-list class="settings-list"><div class="muted">Laster…</div></div>
              </div>
            </div>
          </div>

          <div class="panel panel-collapsible is-collapsed">
            <div class="panel-head">
              <div class="panel-title">Sveiseprosesser</div>
              <div class="panel-meta">Admin</div>
              <button class="panel-toggle" type="button" data-panel-toggle aria-expanded="false">Vis</button>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row inline">
                  <input id="processInput" class="input" type="text" placeholder="Ny prosess… (f.eks 141 - TIG)" />
                  <button data-add-process class="btn primary small">Legg til</button>
                </div>
                <div data-process-list class="settings-list"><div class="muted">Laster…</div></div>
              </div>
            </div>
          </div>

          <div class="panel panel-collapsible is-collapsed">
            <div class="panel-head">
              <div class="panel-title">Sveisefuger</div>
              <div class="panel-meta">Admin</div>
              <button class="panel-toggle" type="button" data-panel-toggle aria-expanded="false">Vis</button>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row inline">
                  <input id="jointTypeInput" class="input" type="text" placeholder="Ny fugetype… (f.eks BW eller FW)" />
                  <button data-add-joint-type class="btn primary small">Legg til</button>
                </div>
                <div class="muted" style="font-size:12px;">Brukes i dropdown for fugetype i WPS/WPQR.</div>
                <div data-joint-type-list class="settings-list"><div class="muted">Laster…</div></div>
              </div>
            </div>
          </div>

          <div class="panel panel-collapsible is-collapsed">
            <div class="panel-head">
              <div class="panel-title">Materialsporbarhet</div>
              <div class="panel-meta">Admin</div>
              <button class="panel-toggle" type="button" data-panel-toggle aria-expanded="false">Vis</button>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row inline" style="align-items:flex-end;">
                  <div class="settings-inputs" style="grid-template-columns: 90px 1fr;">
                    <input id="traceTypeCode" class="input" type="text" placeholder="Kode" />
                    <input id="traceTypeLabel" class="input" type="text" placeholder="Beskrivelse" />
                  </div>
                  <button data-add-trace-type class="btn primary small">Legg til</button>
                </div>

                <div class="settings-row" style="gap:10px;flex-wrap:wrap;">
                  <label class="chip"><input id="traceTypeDn" type="checkbox" /> DN</label>
                  <label class="chip"><input id="traceTypeDn2" type="checkbox" /> DN2</label>
                  <label class="chip"><input id="traceTypeSch" type="checkbox" /> SCH</label>
                  <label class="chip"><input id="traceTypePn" type="checkbox" /> PN</label>
                  <label class="chip"><input id="traceTypeThickness" type="checkbox" /> Tykkelse</label>
                  <label class="chip"><input id="traceTypeFiller" type="checkbox" /> Sveisetilsett-type</label>
                  <input id="traceTypeDefaultSch" class="input" type="text" placeholder="Default SCH (valgfritt)" style="max-width:160px;" />
                  <input id="traceTypeDefaultPn" class="input" type="text" placeholder="Default PN (valgfritt)" style="max-width:160px;" />
                </div>

                <div data-trace-type-list class="settings-list"><div class="muted">Laster…</div></div>

                <div class="settings-row" style="margin-top:14px;">
                  <div class="settings-item__title">Valg for DN / SCH / PN / Sveisetilsett</div>
                </div>

                <div class="settings-row inline" style="align-items:flex-end;">
                  <input id="traceDnInput" class="input" type="text" placeholder="Ny DN…" />
                  <button data-add-trace-dn class="btn primary small">Legg til DN</button>
                </div>
                <div data-trace-dn-list class="settings-list"><div class="muted">Laster…</div></div>

                <div class="settings-row inline" style="align-items:flex-end; margin-top:10px;">
                  <input id="traceSchInput" class="input" type="text" placeholder="Ny SCH…" />
                  <button data-add-trace-sch class="btn primary small">Legg til SCH</button>
                </div>
                <div data-trace-sch-list class="settings-list"><div class="muted">Laster…</div></div>

                <div class="settings-row inline" style="align-items:flex-end; margin-top:10px;">
                  <input id="tracePnInput" class="input" type="text" placeholder="Ny PN…" />
                  <button data-add-trace-pn class="btn primary small">Legg til PN</button>
                </div>
                <div data-trace-pn-list class="settings-list"><div class="muted">Laster…</div></div>

                <div class="settings-row inline" style="align-items:flex-end; margin-top:10px;">
                  <input id="traceFillerInput" class="input" type="text" placeholder="Ny sveisetilsett-type…" />
                  <button data-add-trace-filler class="btn primary small">Legg til type</button>
                </div>
                <div data-trace-filler-list class="settings-list"><div class="muted">Laster…</div></div>
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

  const materialList = qs<HTMLDivElement>(app, "[data-material-list]");
  const addMaterialBtn = app.querySelector<HTMLButtonElement>("[data-add-material]");
  const materialName = app.querySelector<HTMLInputElement>("#materialName");
  const materialCode = app.querySelector<HTMLInputElement>("#materialCode");
  const materialGroup = app.querySelector<HTMLInputElement>("#materialGroup");

  const standardList = qs<HTMLDivElement>(app, "[data-standard-list]");
  const addStandardBtn = app.querySelector<HTMLButtonElement>("[data-add-standard]");
  const standardLabel = app.querySelector<HTMLInputElement>("#standardLabel");
  const standardDescription = app.querySelector<HTMLInputElement>("#standardDescription");
  const standardType = app.querySelector<HTMLSelectElement>("#standardType");
  const standardRevision = app.querySelector<HTMLInputElement>("#standardRevision");

  const ndtMethodList = qs<HTMLDivElement>(app, "[data-ndt-method-list]");
  const addNdtMethodBtn = app.querySelector<HTMLButtonElement>("[data-add-ndt-method]");
  const ndtMethodCode = app.querySelector<HTMLInputElement>("#ndtMethodCode");
  const ndtMethodLabel = app.querySelector<HTMLInputElement>("#ndtMethodLabel");
  const ndtMethodDescription = app.querySelector<HTMLInputElement>("#ndtMethodDescription");
  const ndtMethodStandard = app.querySelector<HTMLSelectElement>("#ndtMethodStandard");

  const processList = qs<HTMLDivElement>(app, "[data-process-list]");
  const addProcessBtn = app.querySelector<HTMLButtonElement>("[data-add-process]");
  const processInput = app.querySelector<HTMLInputElement>("#processInput");
  const jointTypeList = qs<HTMLDivElement>(app, "[data-joint-type-list]");
  const addJointTypeBtn = app.querySelector<HTMLButtonElement>("[data-add-joint-type]");
  const jointTypeInput = app.querySelector<HTMLInputElement>("#jointTypeInput");

  const traceTypeList = qs<HTMLDivElement>(app, "[data-trace-type-list]");
  const traceTypeCode = app.querySelector<HTMLInputElement>("#traceTypeCode");
  const traceTypeLabel = app.querySelector<HTMLInputElement>("#traceTypeLabel");
  const traceTypeDn = app.querySelector<HTMLInputElement>("#traceTypeDn");
  const traceTypeDn2 = app.querySelector<HTMLInputElement>("#traceTypeDn2");
  const traceTypeSch = app.querySelector<HTMLInputElement>("#traceTypeSch");
  const traceTypePn = app.querySelector<HTMLInputElement>("#traceTypePn");
  const traceTypeThickness = app.querySelector<HTMLInputElement>("#traceTypeThickness");
  const traceTypeFiller = app.querySelector<HTMLInputElement>("#traceTypeFiller");
  const traceTypeDefaultSch = app.querySelector<HTMLInputElement>("#traceTypeDefaultSch");
  const traceTypeDefaultPn = app.querySelector<HTMLInputElement>("#traceTypeDefaultPn");

  const traceDnInput = app.querySelector<HTMLInputElement>("#traceDnInput");
  const traceSchInput = app.querySelector<HTMLInputElement>("#traceSchInput");
  const tracePnInput = app.querySelector<HTMLInputElement>("#tracePnInput");
  const traceFillerInput = app.querySelector<HTMLInputElement>("#traceFillerInput");

  const traceDnList = qs<HTMLDivElement>(app, "[data-trace-dn-list]");
  const traceSchList = qs<HTMLDivElement>(app, "[data-trace-sch-list]");
  const tracePnList = qs<HTMLDivElement>(app, "[data-trace-pn-list]");
  const traceFillerList = qs<HTMLDivElement>(app, "[data-trace-filler-list]");

  const addTraceTypeBtn = app.querySelector<HTMLButtonElement>("[data-add-trace-type]");
  const addTraceDnBtn = app.querySelector<HTMLButtonElement>("[data-add-trace-dn]");
  const addTraceSchBtn = app.querySelector<HTMLButtonElement>("[data-add-trace-sch]");
  const addTracePnBtn = app.querySelector<HTMLButtonElement>("[data-add-trace-pn]");
  const addTraceFillerBtn = app.querySelector<HTMLButtonElement>("[data-add-trace-filler]");

  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");
  const modalSignal = new AbortController();

  const materialLabel = (m: MaterialRow) => `${m.name} (${m.material_code}) - ${m.material_group}`;
  const standardLabelText = (s: StandardRow) => (s.revision ? `${s.label} (${s.revision})` : s.label);
  const standardRefLabel = (s?: { label: string; revision: number | null } | null) =>
    s ? (s.revision ? `${s.label} (${s.revision})` : s.label) : "";

  let cachedStandards: StandardRow[] = [];

  const renderNdtStandardOptions = (selected?: string | null) => {
    const rows = [`<option value="">Standard (valgfritt)…</option>`];
    for (const s of cachedStandards) {
      const isSelected = selected && selected === s.id;
      rows.push(`<option value="${esc(s.id)}" ${isSelected ? "selected" : ""}>${esc(standardLabelText(s))}</option>`);
    }
    if (selected && !cachedStandards.some((s) => s.id === selected)) {
      rows.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
    }
    return rows.join("");
  };

  const renderYearOptions = (selected?: number | null) => {
    const y = new Date().getFullYear();
    const rows = [`<option value="">Ingen revisjon</option>`];
    for (let i = 0; i <= 30; i++) {
      const year = String(y - i);
      rows.push(
        `<option value="${esc(year)}" ${selected === Number(year) ? "selected" : ""}>${esc(year)}</option>`
      );
    }
    if (selected != null && !rows.some((r) => r.includes(`value=\"${selected}\"`))) {
      rows.push(`<option value="${esc(String(selected))}" selected>${esc(String(selected))}</option>`);
    }
    return rows.join("");
  };

  const renderMaterials = (rows: MaterialRow[]) => {
    if (rows.length === 0) {
      materialList.innerHTML = `<div class="muted">Ingen materialer.</div>`;
      return;
    }

    materialList.innerHTML = rows
      .map((r) => {
        return `
          <div class="settings-item" data-material-id="${esc(r.id)}">
            <div class="settings-item__title">${esc(materialLabel(r))}</div>
            <div class="settings-item__meta"></div>
            <div class="settings-item__actions">
              ${renderIconButton({ dataKey: "material-edit", id: r.id, title: "Endre", icon: icon("pencil"), extraClass: "small" })}
              ${renderIconButton({ dataKey: "material-delete", id: r.id, title: "Slett", icon: icon("trash"), danger: true, extraClass: "small" })}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderStandards = (rows: StandardRow[]) => {
    if (rows.length === 0) {
      standardList.innerHTML = `<div class="muted">Ingen standarder.</div>`;
      return;
    }

    standardList.innerHTML = rows
      .map((r) => {
        return `
          <div class="settings-item" data-standard-id="${esc(r.id)}">
            <div class="settings-item__title">${esc(standardLabelText(r))}</div>
            <div class="settings-item__meta">${esc([r.type, r.description].filter(Boolean).join(" • "))}</div>
            <div class="settings-item__actions">
              ${r.has_fm_group ? `<button class="btn small" data-fm-manage>FM-grupper</button>` : ""}
              ${renderIconButton({ dataKey: "standard-edit", id: r.id, title: "Endre", icon: icon("pencil"), extraClass: "small" })}
              ${renderIconButton({ dataKey: "standard-delete", id: r.id, title: "Slett", icon: icon("trash"), danger: true, extraClass: "small" })}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderNdtMethods = (rows: NdtMethodRow[]) => {
    if (rows.length === 0) {
      ndtMethodList.innerHTML = `<div class="muted">Ingen NDT-metoder.</div>`;
      return;
    }

    ndtMethodList.innerHTML = rows
      .map((r) => {
        const metaParts = [r.description, r.standard ? standardRefLabel(r.standard) : null]
          .filter(Boolean)
          .join(" • ");
        return `
          <div class="settings-item" data-ndt-method-id="${esc(r.id)}">
            <div class="settings-item__title">${esc(r.code)} – ${esc(r.label)}</div>
            <div class="settings-item__meta">${esc(metaParts)}</div>
            <div class="settings-item__actions">
              ${renderIconButton({ dataKey: "ndt-method-edit", id: r.id, title: "Endre", icon: icon("pencil"), extraClass: "small" })}
              ${renderIconButton({ dataKey: "ndt-method-delete", id: r.id, title: "Slett", icon: icon("trash"), danger: true, extraClass: "small" })}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderProcesses = (rows: WeldingProcessRow[]) => {
    if (rows.length === 0) {
      processList.innerHTML = `<div class="muted">Ingen sveiseprosesser.</div>`;
      return;
    }

    processList.innerHTML = rows
      .map((r) => {
        return `
          <div class="settings-item" data-process-id="${esc(r.id)}">
            <div class="settings-item__title">${esc(r.label)}</div>
            <div class="settings-item__meta"></div>
            <div class="settings-item__actions">
              ${renderIconButton({ dataKey: "process-edit", id: r.id, title: "Endre", icon: icon("pencil"), extraClass: "small" })}
              ${renderIconButton({ dataKey: "process-delete", id: r.id, title: "Slett", icon: icon("trash"), danger: true, extraClass: "small" })}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderJointTypes = (rows: WeldJointTypeRow[]) => {
    if (rows.length === 0) {
      jointTypeList.innerHTML = `<div class="muted">Ingen sveisefuger.</div>`;
      return;
    }

    jointTypeList.innerHTML = rows
      .map((r) => {
        return `
          <div class="settings-item" data-joint-type-id="${esc(r.id)}">
            <div class="settings-item__title">${esc(r.label)}</div>
            <div class="settings-item__meta"></div>
            <div class="settings-item__actions">
              ${renderIconButton({ dataKey: "joint-type-edit", id: r.id, title: "Endre", icon: icon("pencil"), extraClass: "small" })}
              ${renderIconButton({ dataKey: "joint-type-delete", id: r.id, title: "Slett", icon: icon("trash"), danger: true, extraClass: "small" })}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderTraceTypes = (rows: TraceabilityTypeRow[]) => {
    if (rows.length === 0) {
      traceTypeList.innerHTML = `<div class="muted">Ingen typer.</div>`;
      return;
    }

    traceTypeList.innerHTML = rows
      .map((r) => {
        const tags = [
          r.use_dn ? "DN" : "",
          r.use_dn2 ? "DN2" : "",
          r.use_sch ? "SCH" : "",
          r.use_pressure ? "PN" : "",
          r.use_thickness ? "Tykkelse" : "",
          r.use_filler_type ? "Tilsett" : "",
        ].filter(Boolean);
        const meta = [
          r.default_sch ? `SCH: ${r.default_sch}` : "",
          r.default_pressure ? `PN: ${r.default_pressure}` : "",
          tags.length ? tags.join(", ") : "",
        ]
          .filter(Boolean)
          .join(" • ");
        return `
          <div class="settings-item" data-trace-type-code="${esc(r.code)}">
            <div class="settings-item__title">${esc(r.code)} – ${esc(r.label)}</div>
            <div class="settings-item__meta">${esc(meta)}</div>
            <div class="settings-item__actions">
              ${renderIconButton({ dataKey: "trace-type-edit", id: r.code, title: "Endre", icon: icon("pencil"), extraClass: "small" })}
              ${renderIconButton({ dataKey: "trace-type-delete", id: r.code, title: "Slett", icon: icon("trash"), danger: true, extraClass: "small" })}
            </div>
          </div>
        `;
      })
      .join("");
  };

  const renderTraceOptions = (rows: { id: string; value: string; is_default: boolean }[], target: HTMLElement, groupKey: string) => {
    if (rows.length === 0) {
      target.innerHTML = `<div class="muted">Ingen valg.</div>`;
      return;
    }

    target.innerHTML = rows
      .map((r) => {
        return `
          <div class="settings-item" data-trace-opt-id="${esc(r.id)}" data-trace-opt-group="${esc(groupKey)}">
            <div class="settings-item__title">${esc(r.value)}</div>
            <div class="settings-item__meta">${r.is_default ? "Standard" : ""}</div>
            <div class="settings-item__actions">
              ${renderIconButton({ dataKey: "trace-opt-default", id: r.id, title: "Sett standard", icon: "★", extraClass: "small" })}
              ${renderIconButton({ dataKey: "trace-opt-delete", id: r.id, title: "Slett", icon: icon("trash"), danger: true, extraClass: "small" })}
            </div>
          </div>
        `;
      })
      .join("");
  };

  async function loadMaterials() {
    materialList.innerHTML = `<div class="muted">Laster…</div>`;
    try {
      const rows = await fetchMaterials({ includeInactive: true });
      renderMaterials(rows);
    } catch (err: any) {
      console.error(err);
      materialList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
    }
  }

  async function loadStandards() {
    standardList.innerHTML = `<div class="muted">Laster…</div>`;
    try {
      const rows = await fetchStandards();
      cachedStandards = rows;
      renderStandards(rows);
      if (ndtMethodStandard) ndtMethodStandard.innerHTML = renderNdtStandardOptions(null);
    } catch (err: any) {
      console.error(err);
      standardList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
    }
  }

  async function loadNdtMethods() {
    ndtMethodList.innerHTML = `<div class="muted">Laster…</div>`;
    try {
      const rows = await fetchNdtMethods({ includeInactive: true });
      renderNdtMethods(rows);
    } catch (err: any) {
      console.error(err);
      ndtMethodList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
    }
  }

  async function loadProcesses() {
    processList.innerHTML = `<div class="muted">Laster…</div>`;
    try {
      const rows = await fetchWeldingProcesses({ includeInactive: true });
      renderProcesses(rows);
    } catch (err: any) {
      console.error(err);
      processList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
    }
  }

  async function loadJointTypes() {
    jointTypeList.innerHTML = `<div class="muted">Lasterâ€¦</div>`;
    try {
      const rows = await fetchWeldJointTypes({ includeInactive: true });
      renderJointTypes(rows);
    } catch (err: any) {
      console.error(err);
      jointTypeList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
    }
  }

  async function loadTraceability() {
    traceTypeList.innerHTML = `<div class="muted">Laster…</div>`;
    traceDnList.innerHTML = `<div class="muted">Laster…</div>`;
    traceSchList.innerHTML = `<div class="muted">Laster…</div>`;
    tracePnList.innerHTML = `<div class="muted">Laster…</div>`;
    traceFillerList.innerHTML = `<div class="muted">Laster…</div>`;
    try {
      const [types, dn, sch, pn, filler] = await Promise.all([
        fetchTraceabilityTypes(),
        fetchTraceabilityOptions("dn"),
        fetchTraceabilityOptions("sch"),
        fetchTraceabilityOptions("pn"),
        fetchTraceabilityOptions("filler_type"),
      ]);
      renderTraceTypes(types);
      renderTraceOptions(dn, traceDnList, "dn");
      renderTraceOptions(sch, traceSchList, "sch");
      renderTraceOptions(pn, tracePnList, "pn");
      renderTraceOptions(filler, traceFillerList, "filler_type");
    } catch (err: any) {
      console.error(err);
      traceTypeList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
    }
  }

  addMaterialBtn?.addEventListener("click", async () => {
    const name = (materialName?.value ?? "").trim();
    const code = (materialCode?.value ?? "").trim();
    const group = (materialGroup?.value ?? "").trim();
    if (!name || !code || !group) return toast("Fyll inn navn, kode og gruppe.");
    try {
      await createMaterial({ name, material_code: code, material_group: group });
      if (materialName) materialName.value = "";
      if (materialCode) materialCode.value = "";
      if (materialGroup) materialGroup.value = "";
      await loadMaterials();
      toast("Materiale lagt til.");
    } catch (err: any) {
      console.error(err);
      toast(String(err?.message ?? err));
    }
  });

  addStandardBtn?.addEventListener("click", async () => {
    const label = (standardLabel?.value ?? "").trim();
    const description = (standardDescription?.value ?? "").trim();
    const type = (standardType?.value ?? "").trim();
    const revisionRaw = (standardRevision?.value ?? "").trim();
    const revision = revisionRaw ? Number.parseInt(revisionRaw, 10) : null;
    if (!label) return toast("Fyll inn navn.");
    try {
      await createStandard({
        label,
        description: description || null,
        revision: revision || null,
        type: type || null,
      });
      if (standardLabel) standardLabel.value = "";
      if (standardDescription) standardDescription.value = "";
      if (standardType) standardType.value = "";
      if (standardRevision) standardRevision.value = "";
      await loadStandards();
      toast("Standard lagt til.");
    } catch (err: any) {
      console.error(err);
      toast(String(err?.message ?? err));
    }
  });

  addNdtMethodBtn?.addEventListener("click", async () => {
    const code = (ndtMethodCode?.value ?? "").trim().toUpperCase();
    const label = (ndtMethodLabel?.value ?? "").trim();
    const description = (ndtMethodDescription?.value ?? "").trim();
    const standard_id = (ndtMethodStandard?.value ?? "").trim() || null;
    if (!code || !label) return toast("Fyll inn kode og navn.");
    try {
      await createNdtMethod({
        code,
        label,
        description: description || null,
        standard_id,
      });
      if (ndtMethodCode) ndtMethodCode.value = "";
      if (ndtMethodLabel) ndtMethodLabel.value = "";
      if (ndtMethodDescription) ndtMethodDescription.value = "";
      if (ndtMethodStandard) ndtMethodStandard.value = "";
      await loadNdtMethods();
      toast("NDT-metode lagt til.");
    } catch (err: any) {
      console.error(err);
      toast(String(err?.message ?? err));
    }
  });

  addProcessBtn?.addEventListener("click", async () => {
    const label = (processInput?.value ?? "").trim();
    if (!label) return toast("Skriv inn prosess.");
    try {
      await createWeldingProcess(label);
      if (processInput) processInput.value = "";
      await loadProcesses();
      toast("Sveiseprosess lagt til.");
    } catch (err: any) {
      console.error(err);
      toast(String(err?.message ?? err));
    }
  });

  addJointTypeBtn?.addEventListener("click", async () => {
    const label = (jointTypeInput?.value ?? "").trim().toUpperCase();
    if (!label) return toast("Skriv inn fugetype.");
    try {
      await createWeldJointType(label);
      if (jointTypeInput) jointTypeInput.value = "";
      await loadJointTypes();
      toast("Sveisefuge lagt til.");
    } catch (err: any) {
      console.error(err);
      toast(String(err?.message ?? err));
    }
  });

  addTraceTypeBtn?.addEventListener("click", async () => {
    const code = (traceTypeCode?.value ?? "").trim().toUpperCase();
    const label = (traceTypeLabel?.value ?? "").trim();
    if (!code || !label) return toast("Fyll inn kode og beskrivelse.");
    try {
      await upsertTraceabilityType({
        code,
        label,
        use_dn: traceTypeDn?.checked ?? false,
        use_dn2: traceTypeDn2?.checked ?? false,
        use_sch: traceTypeSch?.checked ?? false,
        use_pressure: traceTypePn?.checked ?? false,
        use_thickness: traceTypeThickness?.checked ?? false,
        use_filler_type: traceTypeFiller?.checked ?? false,
        default_sch: (traceTypeDefaultSch?.value ?? "").trim() || null,
        default_pressure: (traceTypeDefaultPn?.value ?? "").trim() || null,
      });
      if (traceTypeCode) traceTypeCode.value = "";
      if (traceTypeLabel) traceTypeLabel.value = "";
      if (traceTypeDefaultSch) traceTypeDefaultSch.value = "";
      if (traceTypeDefaultPn) traceTypeDefaultPn.value = "";
      if (traceTypeDn) traceTypeDn.checked = false;
      if (traceTypeDn2) traceTypeDn2.checked = false;
      if (traceTypeSch) traceTypeSch.checked = false;
      if (traceTypePn) traceTypePn.checked = false;
      if (traceTypeThickness) traceTypeThickness.checked = false;
      if (traceTypeFiller) traceTypeFiller.checked = false;
      await loadTraceability();
      toast("Type lagt til.");
    } catch (err: any) {
      console.error(err);
      toast(String(err?.message ?? err));
    }
  });

  const addTraceOption = async (groupKey: string, input: HTMLInputElement | null) => {
    const value = (input?.value ?? "").trim();
    if (!value) return toast("Skriv inn verdi.");
    try {
      await createTraceabilityOption({ group_key: groupKey, value });
      if (input) input.value = "";
      await loadTraceability();
    } catch (err: any) {
      console.error(err);
      toast(String(err?.message ?? err));
    }
  };

  addTraceDnBtn?.addEventListener("click", async () => addTraceOption("dn", traceDnInput));
  addTraceSchBtn?.addEventListener("click", async () => addTraceOption("sch", traceSchInput));
  addTracePnBtn?.addEventListener("click", async () => addTraceOption("pn", tracePnInput));
  addTraceFillerBtn?.addEventListener("click", async () => addTraceOption("filler_type", traceFillerInput));

  traceTypeList.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const item = target.closest<HTMLElement>("[data-trace-type-code]");
    if (!item) return;
    const code = item.getAttribute("data-trace-type-code") || "";
    if (!code) return;

    if (target.closest("[data-trace-type-delete]")) {
      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett type",
        messageHtml: `Slett ${esc(code)}?`,
        onConfirm: async () => deleteTraceabilityType(code),
        onDone: async () => {
          await loadTraceability();
          toast("Type slettet.");
        },
      });
      return;
    }

    if (target.closest("[data-trace-type-edit]")) {
      const rows = await fetchTraceabilityTypes();
      const current = rows.find((r) => r.code === code);
      if (!current) return;

      const modalHtml = renderModal(
        "Endre type",
        `
          <div class="modalgrid">
            <div class="field">
              <label>Kode</label>
              <input data-f="code" class="input" value="${esc(current.code)}" />
            </div>
            <div class="field">
              <label>Beskrivelse</label>
              <input data-f="label" class="input" value="${esc(current.label)}" />
            </div>
            <div class="field" style="grid-column:1 / -1; display:flex; flex-wrap:wrap; gap:10px;">
              <label class="chip"><input data-f="use_dn" type="checkbox" ${current.use_dn ? "checked" : ""}/> DN</label>
              <label class="chip"><input data-f="use_dn2" type="checkbox" ${current.use_dn2 ? "checked" : ""}/> DN2</label>
              <label class="chip"><input data-f="use_sch" type="checkbox" ${current.use_sch ? "checked" : ""}/> SCH</label>
              <label class="chip"><input data-f="use_pressure" type="checkbox" ${current.use_pressure ? "checked" : ""}/> PN</label>
              <label class="chip"><input data-f="use_thickness" type="checkbox" ${current.use_thickness ? "checked" : ""}/> Tykkelse</label>
              <label class="chip"><input data-f="use_filler_type" type="checkbox" ${current.use_filler_type ? "checked" : ""}/> Sveisetilsett-type</label>
            </div>
            <div class="field">
              <label>Default SCH</label>
              <input data-f="default_sch" class="input" value="${esc(current.default_sch ?? "")}" />
            </div>
            <div class="field">
              <label>Default PN</label>
              <input data-f="default_pressure" class="input" value="${esc(current.default_pressure ?? "")}" />
            </div>
          </div>
        `,
        "Oppdater"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);
      save.addEventListener("click", async () => {
        const nextCode = (qs<HTMLInputElement>(h.root, "[data-f=code]").value || "").trim().toUpperCase();
        const nextLabel = (qs<HTMLInputElement>(h.root, "[data-f=label]").value || "").trim();
        if (!nextCode || !nextLabel) return toast("Fyll inn kode og beskrivelse.");

        try {
          await upsertTraceabilityType({
            code: nextCode,
            label: nextLabel,
            use_dn: qs<HTMLInputElement>(h.root, "[data-f=use_dn]").checked,
            use_dn2: qs<HTMLInputElement>(h.root, "[data-f=use_dn2]").checked,
            use_sch: qs<HTMLInputElement>(h.root, "[data-f=use_sch]").checked,
            use_pressure: qs<HTMLInputElement>(h.root, "[data-f=use_pressure]").checked,
            use_thickness: qs<HTMLInputElement>(h.root, "[data-f=use_thickness]").checked,
            use_filler_type: qs<HTMLInputElement>(h.root, "[data-f=use_filler_type]").checked,
            default_sch: (qs<HTMLInputElement>(h.root, "[data-f=default_sch]").value || "").trim() || null,
            default_pressure: (qs<HTMLInputElement>(h.root, "[data-f=default_pressure]").value || "").trim() || null,
          });
          h.close();
          await loadTraceability();
          toast("Type oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
      });
    }
  });

  const handleOptionList = (list: HTMLElement) => {
    list.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const item = target.closest<HTMLElement>("[data-trace-opt-id]");
      if (!item) return;
      const id = item.getAttribute("data-trace-opt-id") || "";
      const groupKey = item.getAttribute("data-trace-opt-group") || "";
      if (!id || !groupKey) return;

      if (target.closest("[data-trace-opt-delete]")) {
        await openConfirmDelete(modalMount, modalSignal.signal, {
          title: "Slett valg",
          messageHtml: `Slett ${esc(item.querySelector(".settings-item__title")?.textContent || "valg")}?`,
          onConfirm: async () => deleteTraceabilityOption(id),
          onDone: async () => loadTraceability(),
        });
        return;
      }

      if (target.closest("[data-trace-opt-default]")) {
        try {
          await setDefaultTraceabilityOption(groupKey, id);
          await loadTraceability();
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
      }
    });
  };

  handleOptionList(traceDnList);
  handleOptionList(traceSchList);
  handleOptionList(tracePnList);
  handleOptionList(traceFillerList);

  materialList.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const item = target.closest<HTMLElement>("[data-material-id]");
    if (!item) return;
    const id = item.getAttribute("data-material-id") || "";
    if (!id) return;

    if (target.closest("[data-material-delete]")) {
      const [wpsRef, wpqrRef] = await Promise.all([
        supabase.from("wps").select("id", { count: "exact", head: true }).eq("material_id", id),
        supabase.from("wpqr").select("id", { count: "exact", head: true }).eq("material_id", id),
      ]);
      const wpsCount = wpsRef.count ?? 0;
      const wpqrCount = wpqrRef.count ?? 0;
      if (wpsCount > 0 || wpqrCount > 0) {
        toast("Kan ikke slette: materialet brukes i WPS/WPQR.");
        return;
      }

      const label = item.querySelector(".settings-item__title")?.textContent?.trim() || "materialet";
      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett materiale",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => {
          await deleteMaterial(id);
        },
        onDone: async () => {
          await loadMaterials();
          toast("Materiale slettet.");
        },
      });
      return;
    }

    if (target.closest("[data-material-edit]")) {
      const rows = await fetchMaterials({ includeInactive: true });
      const current = rows.find((r) => r.id === id);
      if (!current) return;

      const modalHtml = renderModal(
        "Endre materiale",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Materialnavn</label>
              <input data-f="name" class="input" type="text" value="${esc(current.name)}" />
            </div>
            <div class="field">
              <label>Materialkode</label>
              <input data-f="code" class="input" type="text" value="${esc(current.material_code)}" />
            </div>
            <div class="field">
              <label>Materialgruppe</label>
              <input data-f="group" class="input" type="text" value="${esc(current.material_group)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);

      save.addEventListener("click", async () => {
        const name = (h.root.querySelector<HTMLInputElement>("[data-f=name]")?.value ?? "").trim();
        const code = (h.root.querySelector<HTMLInputElement>("[data-f=code]")?.value ?? "").trim();
        const group = (h.root.querySelector<HTMLInputElement>("[data-f=group]")?.value ?? "").trim();
        if (!name || !code || !group) return toast("Fyll inn navn, kode og gruppe.");
        try {
          await updateMaterial(id, { name, material_code: code, material_group: group });
          h.close();
          await loadMaterials();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
      });
    }
  });

  async function openFmGroupsModal(standard: StandardRow) {
    const modalHtml = renderModal(
      `FM-grupper – ${esc(standard.label)}`,
      `
        <div class="settings-form">
          <div class="settings-row inline">
            <input data-fm-input class="input" type="text" placeholder="Ny FM-gruppe…" />
            <button data-fm-add class="btn primary small">Legg til</button>
          </div>
          <div data-fm-list class="settings-list"><div class="muted">Laster…</div></div>
        </div>
      `,
      "Ferdig"
    );

    const h = openModal(modalMount, modalHtml, modalSignal.signal);
    const fmList = qs<HTMLDivElement>(h.root, "[data-fm-list]");
    const fmInput = qs<HTMLInputElement>(h.root, "[data-fm-input]");
    const fmAddBtn = qs<HTMLButtonElement>(h.root, "[data-fm-add]");
    const doneBtn = modalSaveButton(h.root);

    doneBtn.addEventListener("click", () => h.close(), { signal: modalSignal.signal });

    const renderFmGroups = (rows: StandardFmGroupRow[]) => {
      if (rows.length === 0) {
        fmList.innerHTML = `<div class="muted">Ingen FM-grupper.</div>`;
        return;
      }

      fmList.innerHTML = rows
        .map((r) => {
          return `
            <div class="settings-item" data-fm-id="${esc(r.id)}">
              <div class="settings-item__title">${esc(r.label)}</div>
              <div class="settings-item__meta"></div>
              <div class="settings-item__actions">
                <button class="iconbtn small" data-fm-edit aria-label="Endre" title="Endre">
                  ${icon("pencil")}
                </button>
                <button class="iconbtn small danger" data-fm-delete aria-label="Slett" title="Slett">
                  ${icon("trash")}
                </button>
              </div>
            </div>
          `;
        })
        .join("");
    };

    async function loadFm() {
      fmList.innerHTML = `<div class="muted">Laster…</div>`;
      try {
        const rows = await fetchStandardFmGroups(standard.id);
        renderFmGroups(rows);
      } catch (err: any) {
        console.error(err);
        fmList.innerHTML = `<div class="err">Feil: ${esc(err?.message ?? err)}</div>`;
      }
    }

    fmAddBtn.addEventListener(
      "click",
      async () => {
        const label = (fmInput.value || "").trim();
        if (!label) return toast("Skriv inn FM-gruppe.");
        try {
          await createStandardFmGroup({ standard_id: standard.id, label });
          fmInput.value = "";
          await loadFm();
          toast("FM-gruppe lagt til.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
      },
      { signal: modalSignal.signal }
    );

    fmList.addEventListener(
      "click",
      async (e) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const item = target.closest<HTMLElement>("[data-fm-id]");
        if (!item) return;
        const id = item.getAttribute("data-fm-id") || "";
        if (!id) return;

        if (target.closest("[data-fm-delete]")) {
          const label = item.querySelector(".settings-item__title")?.textContent?.trim() || "FM-gruppen";
          const ok = window.confirm(`Slette ${label}?`);
          if (!ok) return;
          try {
            await deleteStandardFmGroup(id);
            await loadFm();
            toast("FM-gruppe slettet.");
          } catch (err: any) {
            console.error(err);
            toast(String(err?.message ?? err));
          }
          return;
        }

        if (target.closest("[data-fm-edit]")) {
          const current = item.querySelector(".settings-item__title")?.textContent?.trim() ?? "";
          const next = window.prompt("Endre FM-gruppe", current) ?? "";
          const label = next.trim();
          if (!label || label === current) return;
          try {
            await updateStandardFmGroup(id, { label });
            await loadFm();
            toast("Oppdatert.");
          } catch (err: any) {
            console.error(err);
            toast(String(err?.message ?? err));
          }
        }
      },
      { signal: modalSignal.signal }
    );

    await loadFm();
  }

  standardList.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const item = target.closest<HTMLElement>("[data-standard-id]");
    if (!item) return;
    const id = item.getAttribute("data-standard-id") || "";
    if (!id) return;

    if (target.closest("[data-standard-delete]")) {
      const rows = await fetchStandards();
      const current = rows.find((r) => r.id === id);
      if (!current) return;

      const ref = await supabase
        .from("welder_certificates")
        .select("id", { count: "exact", head: true })
        .eq("standard", current.label);

      const count = ref.count ?? 0;
      if (count > 0) {
        toast("Kan ikke slette: standarden brukes i sertifikater.");
        return;
      }

      const label = item.querySelector(".settings-item__title")?.textContent?.trim() || "standarden";
      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett standard",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => {
          await deleteStandard(id);
        },
        onDone: async () => {
          await loadStandards();
          toast("Standard slettet.");
        },
      });
      return;
    }

    if (target.closest("[data-standard-edit]")) {
      const rows = await fetchStandards();
      const current = rows.find((r) => r.id === id);
      if (!current) return;

      const modalHtml = renderModal(
        "Endre standard",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Standardnavn</label>
              <input data-f="label" class="input" type="text" value="${esc(current.label)}" />
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Beskrivelse</label>
              <input data-f="description" class="input" type="text" value="${esc(current.description ?? "")}" />
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Type</label>
              <select data-f="type" class="select">
                ${renderTypeOptions(current.type ?? null)}
              </select>
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Revisjon</label>
              <select data-f="revision" class="select">
                ${renderYearOptions(current.revision ?? null)}
              </select>
            </div>
          </div>
        `,
        "Lagre"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);

      save.addEventListener("click", async () => {
        const label = (h.root.querySelector<HTMLInputElement>("[data-f=label]")?.value ?? "").trim();
        const description = (h.root.querySelector<HTMLInputElement>("[data-f=description]")?.value ?? "").trim();
        const type = (h.root.querySelector<HTMLSelectElement>("[data-f=type]")?.value ?? "").trim();
        const revisionRaw = (h.root.querySelector<HTMLSelectElement>("[data-f=revision]")?.value ?? "").trim();
        const revision = revisionRaw ? Number.parseInt(revisionRaw, 10) : null;
        if (!label) return toast("Fyll inn navn.");
        try {
          await updateStandard(id, {
            label,
            description: description || null,
            revision: revision || null,
            type: type || null,
          });
          h.close();
          await loadStandards();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
      });
      return;
    }

    if (target.closest("[data-fm-manage]")) {
      const rows = await fetchStandards();
      const current = rows.find((r) => r.id === id);
      if (!current) return;
      await openFmGroupsModal(current);
      return;
    }
  });

  ndtMethodList.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const item = target.closest<HTMLElement>("[data-ndt-method-id]");
    if (!item) return;
    const id = item.getAttribute("data-ndt-method-id") || "";
    if (!id) return;

    if (target.closest("[data-ndt-method-delete]")) {
      const ref = await supabase
        .from("ndt_reports")
        .select("id", { count: "exact", head: true })
        .eq("method_id", id);

      const count = ref.count ?? 0;
      if (count > 0) {
        toast("Kan ikke slette: metoden brukes i rapporter.");
        return;
      }

      const label = item.querySelector(".settings-item__title")?.textContent?.trim() || "metoden";
      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett NDT-metode",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => {
          await deleteNdtMethod(id);
        },
        onDone: async () => {
          await loadNdtMethods();
          toast("NDT-metode slettet.");
        },
      });
      return;
    }

    if (target.closest("[data-ndt-method-edit]")) {
      const rows = await fetchNdtMethods({ includeInactive: true });
      const current = rows.find((r) => r.id === id);
      if (!current) return;

      const modalHtml = renderModal(
        "Endre NDT-metode",
        `
          <div class="modalgrid">
            <div class="field">
              <label>Kode</label>
              <input data-f="code" class="input" type="text" value="${esc(current.code)}" />
            </div>
            <div class="field">
              <label>Navn</label>
              <input data-f="label" class="input" type="text" value="${esc(current.label)}" />
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Beskrivelse</label>
              <input data-f="description" class="input" type="text" value="${esc(current.description ?? "")}" />
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Standard (valgfritt)</label>
              <select data-f="standard_id" class="select">
                ${renderNdtStandardOptions(current.standard_id ?? null)}
              </select>
            </div>
          </div>
        `,
        "Lagre"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);

      save.addEventListener("click", async () => {
        const code = (h.root.querySelector<HTMLInputElement>("[data-f=code]")?.value ?? "").trim().toUpperCase();
        const label = (h.root.querySelector<HTMLInputElement>("[data-f=label]")?.value ?? "").trim();
        const description = (h.root.querySelector<HTMLInputElement>("[data-f=description]")?.value ?? "").trim();
        const standard_id = (h.root.querySelector<HTMLSelectElement>("[data-f=standard_id]")?.value ?? "").trim() || null;
        if (!code || !label) return toast("Fyll inn kode og navn.");
        try {
          await updateNdtMethod(id, {
            code,
            label,
            description: description || null,
            standard_id,
          });
          h.close();
          await loadNdtMethods();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
      });
    }
  });

  processList.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const item = target.closest<HTMLElement>("[data-process-id]");
    if (!item) return;
    const id = item.getAttribute("data-process-id") || "";
    if (!id) return;

    if (target.closest("[data-process-delete]")) {
      const label = item.querySelector(".settings-item__title")?.textContent?.trim() || "prosessen";
      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett sveiseprosess",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => {
          await deleteWeldingProcess(id);
        },
        onDone: async () => {
          await loadProcesses();
          toast("Sveiseprosess slettet.");
        },
      });
      return;
    }

    if (target.closest("[data-process-edit]")) {
      const current = item.querySelector(".settings-item__title")?.textContent?.trim() ?? "";
      const modalHtml = renderModal(
        "Endre sveiseprosess",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Prosess</label>
              <input data-f="label" class="input" type="text" value="${esc(current)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);

      save.addEventListener("click", async () => {
        const label = (h.root.querySelector<HTMLInputElement>("[data-f=label]")?.value ?? "").trim();
        if (!label) return toast("Skriv inn prosess.");
        try {
          await updateWeldingProcess(id, label);
          h.close();
          await loadProcesses();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
      });
    }
  });

  jointTypeList.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const item = target.closest<HTMLElement>("[data-joint-type-id]");
    if (!item) return;
    const id = item.getAttribute("data-joint-type-id") || "";
    if (!id) return;

    if (target.closest("[data-joint-type-delete]")) {
      const label = item.querySelector(".settings-item__title")?.textContent?.trim() || "fugetypen";
      const [wpsRef, wpqrRef] = await Promise.all([
        supabase.from("wps").select("id", { count: "exact", head: true }).eq("fuge", label),
        supabase.from("wpqr").select("id", { count: "exact", head: true }).eq("fuge", label),
      ]);
      const wpsCount = wpsRef.count ?? 0;
      const wpqrCount = wpqrRef.count ?? 0;
      if (wpsCount > 0 || wpqrCount > 0) {
        toast("Kan ikke slette: sveisefugen brukes i WPS/WPQR.");
        return;
      }

      await openConfirmDelete(modalMount, modalSignal.signal, {
        title: "Slett sveisefuge",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => {
          await deleteWeldJointType(id);
        },
        onDone: async () => {
          await loadJointTypes();
          toast("Sveisefuge slettet.");
        },
      });
      return;
    }

    if (target.closest("[data-joint-type-edit]")) {
      const current = item.querySelector(".settings-item__title")?.textContent?.trim() ?? "";
      const modalHtml = renderModal(
        "Endre sveisefuge",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Fugetype</label>
              <input data-f="label" class="input" type="text" value="${esc(current)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const h = openModal(modalMount, modalHtml, modalSignal.signal);
      const save = modalSaveButton(h.root);

      save.addEventListener("click", async () => {
        const label = (h.root.querySelector<HTMLInputElement>("[data-f=label]")?.value ?? "").trim().toUpperCase();
        if (!label) return toast("Skriv inn fugetype.");
        try {
          await updateWeldJointType(id, label);
          h.close();
          await loadJointTypes();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        }
      });
    }
  });

  await loadMaterials();
  await loadStandards();
  await loadNdtMethods();
  await loadProcesses();
  await loadJointTypes();
  await loadTraceability();
}

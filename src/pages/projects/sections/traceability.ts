import type { ProjectRow } from "../../../repo/projectRepo";
import type { MaterialCertificateRow } from "../../../repo/materialCertificateRepo";
import type { MaterialRow } from "../../../repo/materialRepo";
import type { TraceabilityOptionRow, TraceabilityTypeRow, ProjectTraceabilityRow } from "../../../repo/traceabilityRepo";

import { esc, qs } from "../../../utils/dom";
import { openConfirmDelete } from "../../../ui/confirm";
import { openModal, modalSaveButton, renderModal } from "../../../ui/modal";
import { toast } from "../../../ui/toast";
import { iconSvg, renderIconButton } from "../../../ui/iconButton";
import {
  createProjectTraceability,
  deleteProjectTraceability,
  fetchProjectTraceability,
  fetchTraceabilityOptions,
  fetchTraceabilityTypes,
  updateProjectTraceability,
} from "../../../repo/traceabilityRepo";
import { fetchMaterialCertificates } from "../../../repo/materialCertificateRepo";
import { fetchMaterials } from "../../../repo/materialRepo";
import { createSignedUrlForFileRef } from "../../../repo/fileRepo";
import { openPdfPreview } from "../../../ui/pdfPreview";

export async function renderProjectTraceabilitySection(opts: {
  app: HTMLElement;
  mount: HTMLElement;
  modalMount: HTMLElement;
  project: ProjectRow;
  isAdmin: boolean;
  signal: AbortSignal;
}) {
  const { app, mount, modalMount, project, isAdmin, signal } = opts;

  mount.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">Materialsporbarhet</div>
        <div class="panel-actions">
          ${renderIconButton({ dataKey: "trace-print", id: "trace-print", title: "Skriv ut", icon: iconSvg("print") })}
        </div>
      </div>
      <div class="panel-body">
        <div class="table-scroll">
          <table class="data-table trace-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Komponent</th>
                <th>Material/type</th>
                <th>Dimensjon</th>
                <th>Heat</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody data-trace-body>
              <tr><td colspan="7" class="muted">Laster…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  const traceBody = qs<HTMLTableSectionElement>(mount, "[data-trace-body]");
  const openAddBtn = app.querySelector<HTMLButtonElement>("[data-open-trace-add]");
  const printBtn = mount.querySelector<HTMLButtonElement>("[data-trace-print]");

  let types: TraceabilityTypeRow[] = [];
  let optionsDn: TraceabilityOptionRow[] = [];
  let optionsSch: TraceabilityOptionRow[] = [];
  let optionsPn: TraceabilityOptionRow[] = [];
  let optionsFiller: TraceabilityOptionRow[] = [];
  let certs: MaterialCertificateRow[] = [];
  let rows: ProjectTraceabilityRow[] = [];
  let materials: MaterialRow[] = [];

  const lookupType = (code: string) => types.find((t) => t.code === code) || null;

  const firstDefault = (items: TraceabilityOptionRow[], fallback = "") => {
    const def = items.find((i) => i.is_default);
    if (def) return def.value;
    return items[0]?.value ?? fallback;
  };

  const renderDimension = (row: ProjectTraceabilityRow) => {
    const parts: string[] = [];
    if (row.dn) parts.push(`DN${row.dn}`);
    if (row.dn2) parts.push(`DN${row.dn2}`);
    if (row.sch) parts.push(`SCH${row.sch}`);
    if (row.pressure_class) parts.push(String(row.pressure_class));
    if (row.thickness) parts.push(`${row.thickness} mm`);
    if (row.filler_type) parts.push(row.filler_type);
    return parts.join(" · ") || "—";
  };

  const renderStatus = (row: ProjectTraceabilityRow) => {
    if (row.material_certificate_id && row.cert?.file_id) {
      return `<button type="button" class="status-pill ok" style="cursor:pointer" data-open-cert="${esc(row.cert.file_id)}">Klar</button>`;
    }
    return `<span class="status-pill warn">Mangel</span>`;
  };

  const renderCert = (row: ProjectTraceabilityRow) => {
    if (!row.cert) return `<span class="muted">Ikke valgt</span>`;
    const selected = (row.heat_number || "").trim();
    if (selected) return esc(selected);
    const heat = (row.cert.heat_numbers ?? []).filter(Boolean).join(", ");
    return heat ? esc(heat) : `<span class="muted">—</span>`;
  };

  const sortedRows = () =>
    [...rows].sort((a, b) => {
      const codeA = (a.type_code ?? "").toLowerCase();
      const codeB = (b.type_code ?? "").toLowerCase();
      const codeCompare = codeA.localeCompare(codeB, "nb", { numeric: true, sensitivity: "base" });
      if (codeCompare !== 0) return codeCompare;
      const idxA = a.code_index ?? 0;
      const idxB = b.code_index ?? 0;
      if (idxA !== idxB) return idxA - idxB;
      return String(a.id).localeCompare(String(b.id));
    });

  const renderRows = () => {
    if (rows.length === 0) {
      traceBody.innerHTML = `<tr><td colspan="7" class="muted">Ingen sporbarhet registrert.</td></tr>`;
      return;
    }

    const seqByType = new Map<string, number>();
    const nextSeq = (code: string) => {
      const prev = seqByType.get(code) ?? 0;
      const next = prev + 1;
      seqByType.set(code, next);
      return next;
    };

    traceBody.innerHTML = sortedRows()
      .map((r) => {
        const type = r.type ?? lookupType(r.type_code);
        const idx = r.code_index ?? nextSeq(r.type_code);
        const codeLabel = `${r.type_code}${idx}`;
        const typeLabel = type?.use_filler_type ? (r.filler_type ?? "") : (r.material?.name ?? "");
        return `
          <tr>
            <td data-label="Kode"><span class="trace-code">${esc(codeLabel)}</span></td>
            <td data-label="Komponent">${esc(type?.label ?? "")}</td>
            <td data-label="Material/type">${esc(typeLabel || "—")}</td>
            <td data-label="Dimensjon">${esc(renderDimension(r))}</td>
            <td data-label="Sertifikat">${renderCert(r)}</td>
            <td data-label="Status">${renderStatus(r)}</td>
            <td class="actcell">
              ${isAdmin ? renderIconButton({ dataKey: "trace-edit", id: r.id, title: "Endre", icon: iconSvg("pencil") }) : ""}
              ${isAdmin ? renderIconButton({ dataKey: "trace-del", id: r.id, title: "Slett", icon: iconSvg("trash"), danger: true }) : ""}
            </td>
          </tr>
        `;
      })
      .join("");
  };

const printTable = async () => {
  // 4-kolonne oppsett som i skjemaet
  const header = ["Kode", "Dimensjon/type", "Materialkvalitet", "Heat nr."];

  const bodyRows = sortedRows().map((r) => {
    const type = r.type ?? lookupType(r.type_code);
    const idx = r.code_index ?? 0;

    const codeLabel = `${r.type_code}${idx || ""}`;

    const dimBase = renderDimension(r);
    const dimLabel = `${dimBase}${type?.label ? ` ${type.label.toLowerCase()}` : ""}`.trim();

    const materialLabel = type?.use_filler_type ? (r.filler_type ?? "—") : (r.material?.name ?? "—");

    const heatLabel = (r.heat_number || "").trim() || (r.cert?.heat_numbers ?? []).filter(Boolean).join(", ") || "—";

    return [codeLabel, dimLabel || "—", materialLabel, heatLabel];
  });

  const projectNo = project.project_no == null ? "" : String(project.project_no).trim();
  const projectName = (project.name ?? "").trim();
  const projectLabel = esc(projectNo || projectName);
  const projectMeta = esc(projectName && projectNo ? projectName : "");
  const logoSrc = "/images/titech-logo.png";

  const html = `
    <div class="msl-page">
      <header class="msl-header">
        <div class="msl-brand">
          <div class="msl-logo">
            ${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : ""}
          </div>
          <div class="msl-titles">
            <div class="msl-kicker">Materialsporbarhet</div>
            <h1 class="msl-title">Sporbarhetsliste</h1>
          </div>
        </div>
        <div class="msl-project-card">
          <div class="msl-project-label">Prosjekt</div>
          <div class="msl-project-value">${projectLabel}</div>
          ${projectMeta ? `<div class="msl-project-meta">${projectMeta}</div>` : ""}
        </div>
      </header>

      <div class="msl-table-wrap">
        <table class="msl-table">
          <thead>
            <tr class="msl-head">
              ${header.map((h) => `<th>${h}</th>`).join("")}
            </tr>
          </thead>

          <tbody>
            ${bodyRows
              .map((row) => `<tr>${row.map((c) => `<td>${esc(String(c ?? ""))}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const existing = document.querySelector(".trace-print-sheet");
  if (existing) existing.remove();

  const sheet = document.createElement("div");
  sheet.className = "trace-print-sheet";
  sheet.innerHTML = html;
  document.body.appendChild(sheet);
  document.body.classList.add("print-traceability");

  const waitForImages = () =>
    Promise.all(
      Array.from(sheet.querySelectorAll("img")).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((res) => {
          img.onload = img.onerror = () => res();
        });
      })
    );

  await waitForImages();
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

  const cleanup = () => {
    sheet.remove();
    document.body.classList.remove("print-traceability");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  window.print();
};

  const buildOptionList = (items: TraceabilityOptionRow[], selected: string | null | undefined, placeholder: string) => {
    const rows = [`<option value="">${esc(placeholder)}</option>`];
    for (const opt of items) {
      rows.push(`<option value="${esc(opt.value)}"${selected === opt.value ? " selected" : ""}>${esc(opt.value)}</option>`);
    }
    return rows.join("");
  };

  const defaultType = () => types[0] ?? null;

  const fieldLabelForDn2 = (code: string) => {
    if (code === "TR") return "DN gren";
    if (code === "RC" || code === "RE") return "DN liten";
    return "DN2";
  };

  const renderDynamicFields = (type: TraceabilityTypeRow, values: Partial<ProjectTraceabilityRow> = {}) => {
    const dn = values.dn ?? "";
    const dn2 = values.dn2 ?? "";
    const sch = values.sch ?? type.default_sch ?? firstDefault(optionsSch);
    const pn = values.pressure_class ?? type.default_pressure ?? firstDefault(optionsPn);
    const thickness = values.thickness ?? "";
    const fillerType = values.filler_type ?? firstDefault(optionsFiller);

    const blocks: string[] = [];

    if (type.use_dn) {
      blocks.push(`
        <div class="field">
          <label>DN</label>
          <select data-f="dn" class="select">
            ${buildOptionList(optionsDn, dn || null, "Velg DN…")}
          </select>
        </div>
      `);
    }

    if (type.use_dn2) {
      blocks.push(`
        <div class="field">
          <label>${esc(fieldLabelForDn2(type.code))}</label>
          <select data-f="dn2" class="select">
            ${buildOptionList(optionsDn, dn2 || null, "Velg DN…")}
          </select>
        </div>
      `);
    }

    if (type.use_sch) {
      blocks.push(`
        <div class="field">
          <label>SCH</label>
          <select data-f="sch" class="select">
            ${buildOptionList(optionsSch, sch || null, "Velg SCH…")}
          </select>
        </div>
      `);
    }

    if (type.use_pressure) {
      blocks.push(`
        <div class="field">
          <label>Trykklasse</label>
          <select data-f="pressure_class" class="select">
            ${buildOptionList(optionsPn, pn || null, "Velg PN…")}
          </select>
        </div>
      `);
    }

    if (type.use_thickness) {
      blocks.push(`
        <div class="field">
          <label>Tykkelse (mm)</label>
          <input data-f="thickness" class="input" value="${esc(thickness)}" placeholder="f.eks 8" />
        </div>
      `);
    }

    if (type.use_filler_type) {
      blocks.push(`
        <div class="field">
          <label>Sveisetilsett type</label>
          <select data-f="filler_type" class="select">
            ${buildOptionList(optionsFiller, fillerType || null, "Velg type…")}
          </select>
        </div>
      `);
    }

    if (!type.use_filler_type) {
      const selectedMaterialId = values.material_id ?? values.material?.id ?? "";
      const materialOptions = materials
        .map((m) => `<option value="${esc(m.id)}"${m.id === selectedMaterialId ? " selected" : ""}>${esc(m.name)}</option>`)
        .join("");
      blocks.push(`
        <div class="field">
          <label>Material</label>
          <select data-f="material_id" class="select">
            <option value="">Velg material…</option>
            ${materialOptions}
          </select>
        </div>
      `);
    }

    return blocks.join("");
  };

  const certLabel = (c: MaterialCertificateRow) => c.file?.label ?? c.id;

  const buildSearchText = (c: MaterialCertificateRow) => {
    const label = certLabel(c).toLowerCase();
    const supplier = (c.supplier ?? "").toLowerCase();
    const heat = (c.heat_numbers ?? []).join(" ").toLowerCase();
    const materialName = (c.material?.name ?? "").toLowerCase();
    const filler = (c.filler_type ?? "").toLowerCase();
    return `${label} ${supplier} ${heat} ${materialName} ${filler}`.trim();
  };

  const getFilteredCerts = (
    type: TraceabilityTypeRow,
    materialId: string | null,
    fillerType: string | null,
    query: string
  ) => {
    const targetType = type.use_filler_type ? "filler" : "material";
    let list = certs.filter((c) => c.certificate_type === targetType);

    if (type.use_filler_type) {
      if (!fillerType) return { list: [], reason: "Velg sveisetilsett-type først." };
      list = list.filter((c) => (c.filler_type ?? "") === fillerType);
    } else {
      if (!materialId) return { list: [], reason: "Velg material først." };
      list = list.filter((c) => c.material_id === materialId);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => buildSearchText(c).includes(q));
    }

    return { list, reason: list.length === 0 ? "Ingen treff." : "" };
  };

  const openEditModal = (row?: ProjectTraceabilityRow) => {
    const mode = row ? "Endre" : "Ny";
    const initialType = row?.type ?? (row?.type_code ? lookupType(row.type_code) : null) ?? defaultType();
    if (!initialType) {
      toast("Mangler type-oppsett i app-parametre.");
      return;
    }

    const modalHtml = renderModal(
      `${mode} sporbarhet`,
      `
        <div class="modalgrid">
          <div class="field">
            <label>Kode</label>
            <select data-f="type_code" class="select">
              ${types
                .map((t) => `<option value="${esc(t.code)}"${t.code === initialType.code ? " selected" : ""}>${esc(t.code)} – ${esc(t.label)}</option>`)
                .join("")}
            </select>
          </div>
          <div class="trace-dynamic" data-dynamic-fields>
            ${renderDynamicFields(initialType, row ?? {})}
          </div>
          <div class="field" style="grid-column:1 / -1;">
            <label>Sertifikat</label>
            <input data-f="cert_search" class="input" placeholder="Søk på filnavn, heat, material eller tilsett…" />
            <input data-f="material_certificate_id" type="hidden" value="${esc(row?.material_certificate_id ?? "")}" />
            <input data-f="heat_number" type="hidden" value="${esc(row?.heat_number ?? "")}" />
            <div class="trace-cert-meta" data-cert-meta></div>
            <div class="trace-heat" data-heat-row></div>
            <div class="trace-cert-list" data-cert-list></div>
          </div>
        </div>
      `,
      "Lagre"
    );

    const h = openModal(modalMount, modalHtml, signal);
    const save = modalSaveButton(h.root);
    const typeSelect = qs<HTMLSelectElement>(h.root, "[data-f=type_code]");
    const dynamicField = qs<HTMLDivElement>(h.root, "[data-dynamic-fields]");
    const certSearch = qs<HTMLInputElement>(h.root, "[data-f=cert_search]");
    const certIdInput = qs<HTMLInputElement>(h.root, "[data-f=material_certificate_id]");
    const heatInput = qs<HTMLInputElement>(h.root, "[data-f=heat_number]");
    const certList = qs<HTMLDivElement>(h.root, "[data-cert-list]");
    const certMeta = qs<HTMLDivElement>(h.root, "[data-cert-meta]");
    const heatRow = qs<HTMLDivElement>(h.root, "[data-heat-row]");

    const renderCertMeta = (id: string | null) => {
      if (!id) {
        certMeta.textContent = "Ikke valgt";
        return;
      }
      const cert = certs.find((c) => c.id === id);
      if (!cert) {
        certMeta.textContent = "Ikke valgt";
        return;
      }
      certMeta.textContent = `Valgt: ${certLabel(cert)}`;
    };

    const renderHeatOptions = (id: string | null) => {
      if (!id) {
        heatRow.innerHTML = "";
        heatInput.value = "";
        return;
      }
      const cert = certs.find((c) => c.id === id) ?? null;
      const heatList = (cert?.heat_numbers ?? []).filter(Boolean);
      if (heatList.length === 0) {
        heatRow.innerHTML = `<div class="muted" style="font-size:12px;">Ingen heat nr i sertifikatet.</div>`;
        heatInput.value = "";
        return;
      }

      if (!heatList.includes(heatInput.value)) {
        heatInput.value = heatList[0] ?? "";
      }

      heatRow.innerHTML = `
        <label>Heat nr</label>
        <select class="select" data-heat-select>
          ${heatList.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join("")}
        </select>
      `;

      const select = qs<HTMLSelectElement>(heatRow, "[data-heat-select]");
      select.value = heatInput.value || "";
      select.addEventListener(
        "change",
        () => {
          heatInput.value = select.value;
        },
        { signal }
      );
    };

    const readSelectedMaterialId = () => {
      const materialSelect = h.root.querySelector<HTMLSelectElement>("[data-f=material_id]");
      const materialValue = (materialSelect?.value || "").trim();
      return materialValue || null;
    };

    const readSelectedFillerType = () => {
      const fillerValue = (h.root.querySelector<HTMLSelectElement>("[data-f=filler_type]")?.value || "").trim();
      return fillerValue || null;
    };

    const renderCertList = () => {
      const type = types.find((t) => t.code === typeSelect.value) ?? initialType;
      const { list, reason } = getFilteredCerts(type, readSelectedMaterialId(), readSelectedFillerType(), certSearch.value || "");

      if (list.length === 0) {
        certList.innerHTML = `<div class="muted">${esc(reason)}</div>`;
        return;
      }

      certList.innerHTML = list
        .map((c) => {
          const isSelected = certIdInput.value === c.id ? " is-selected" : "";
          return `
            <button type="button" class="trace-cert-item${isSelected}" data-cert-id="${esc(c.id)}">
              <div>
                <div class="trace-cert-title">${esc(certLabel(c))}</div>
                <div class="trace-cert-sub">${esc((c.heat_numbers ?? []).join(", ") || c.supplier || "")}</div>
              </div>
              <span class="trace-cert-match">✓ Match</span>
            </button>
          `;
        })
        .join("");
    };

    const wireDynamicFields = (currentType: TraceabilityTypeRow) => {
      const materialSelect = h.root.querySelector<HTMLSelectElement>("[data-f=material_id]");
      if (materialSelect) {
        if (row?.material_id) materialSelect.value = row.material_id;
        materialSelect.addEventListener("change", renderCertList, { signal });
      }

      const fillerSelect = h.root.querySelector<HTMLSelectElement>("[data-f=filler_type]");
      if (fillerSelect) {
        fillerSelect.addEventListener("change", renderCertList, { signal });
      }

      if (currentType.use_filler_type && certSearch.value && !row) {
        certSearch.value = "";
      }
    };

    const updateDynamic = () => {
      const currentType = types.find((t) => t.code === typeSelect.value) ?? initialType;
      dynamicField.innerHTML = renderDynamicFields(currentType, row ?? {});
      wireDynamicFields(currentType);
      renderCertList();
    };

    typeSelect.addEventListener("change", updateDynamic, { signal });

    certSearch.addEventListener("input", renderCertList, { signal });
    certSearch.addEventListener("focus", renderCertList, { signal });
    certList.addEventListener(
      "click",
      (e) => {
        const target = e.target as HTMLElement;
        const btn = target.closest<HTMLElement>("[data-cert-id]");
        if (!btn) return;
        const id = btn.getAttribute("data-cert-id");
        if (!id) return;
        certIdInput.value = id;
        heatInput.value = "";
        renderCertMeta(id);
        renderHeatOptions(id);
        renderCertList();
      },
      { signal }
    );

    renderCertMeta(certIdInput.value || null);
    renderHeatOptions(certIdInput.value || null);
    wireDynamicFields(initialType);
    renderCertList();

    save.addEventListener(
      "click",
      async () => {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }

        const type = types.find((t) => t.code === typeSelect.value) ?? initialType;
        const dn = (h.root.querySelector<HTMLSelectElement | HTMLInputElement>("[data-f=dn]")?.value || "").trim();
        const dn2 = (h.root.querySelector<HTMLSelectElement | HTMLInputElement>("[data-f=dn2]")?.value || "").trim();
        const sch = (h.root.querySelector<HTMLSelectElement | HTMLInputElement>("[data-f=sch]")?.value || "").trim();
        const pressure = (h.root.querySelector<HTMLSelectElement | HTMLInputElement>("[data-f=pressure_class]")?.value || "").trim();
        const thickness = (h.root.querySelector<HTMLInputElement>("[data-f=thickness]")?.value || "").trim();
        const fillerType = (h.root.querySelector<HTMLSelectElement | HTMLInputElement>("[data-f=filler_type]")?.value || "").trim();
        const certId = (certIdInput.value || "").trim() || null;
        const heatNumber = (heatInput.value || "").trim() || null;

        const materialSelect = h.root.querySelector<HTMLSelectElement>("[data-f=material_id]");
        const materialId = (materialSelect?.value || "").trim();
        const material = materialId ? materials.find((m) => m.id === materialId) : null;
        if (!type.use_filler_type && !material) {
          return toast("Velg material fra listen.");
        }

        const selectedCert = certId ? certs.find((c) => c.id === certId) : null;
        if (selectedCert) {
          const certHeatList = (selectedCert.heat_numbers ?? []).filter(Boolean);
          if (certHeatList.length > 0 && !heatNumber) {
            return toast("Velg ett heat nr fra sertifikatet.");
          }
          if (heatNumber && certHeatList.length > 0 && !certHeatList.includes(heatNumber)) {
            return toast("Heat nr må være fra valgt sertifikat.");
          }
          if (type.use_filler_type) {
            if (selectedCert.certificate_type !== "filler" || (selectedCert.filler_type ?? "") !== fillerType) {
              return toast("Sertifikatet må matche valgt sveisetilsett-type.");
            }
          } else {
            if (selectedCert.certificate_type !== "material" || selectedCert.material_id !== material?.id) {
              return toast("Sertifikatet må matche valgt material.");
            }
          }
        }

        if (type.use_dn && !dn) return toast("Velg DN.");
        if (type.use_dn2 && !dn2) return toast("Velg DN2.");
        if (type.use_sch && !sch) return toast("Velg SCH.");
        if (type.use_pressure && !pressure) return toast("Velg trykklasse.");
        if (type.use_thickness && !thickness) return toast("Fyll inn tykkelse.");
        if (type.use_filler_type && !fillerType) return toast("Velg sveisetilsett type.");

        save.disabled = true;
        save.textContent = "Lagrer…";
        try {
          if (row) {
            await updateProjectTraceability(row.id, {
              type_code: type.code,
              dn: dn || null,
              dn2: dn2 || null,
              sch: sch || null,
              pressure_class: pressure || null,
              thickness: thickness || null,
              filler_type: fillerType || null,
              material_id: material?.id ?? null,
              material_certificate_id: certId,
              heat_number: heatNumber,
            });
          } else {
            await createProjectTraceability({
              project_id: project.id,
              type_code: type.code,
              dn: dn || null,
              dn2: dn2 || null,
              sch: sch || null,
              pressure_class: pressure || null,
              thickness: thickness || null,
              filler_type: fillerType || null,
              material_id: material?.id ?? null,
              material_certificate_id: certId,
              heat_number: heatNumber,
            });
          }

          if (!certId) {
            toast("Mangler sertifikat på denne linjen.");
          }

          h.close();
          rows = await fetchProjectTraceability(project.id);
          renderRows();
        } catch (e: any) {
          console.error(e);
          toast(String(e?.message ?? e));
        } finally {
          save.disabled = false;
          save.textContent = "Lagre";
        }
      },
      { signal }
    );
  };

  traceBody.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;
      const openCert = target.closest("[data-open-cert]")?.getAttribute("data-open-cert");
      if (openCert) {
        const url = await createSignedUrlForFileRef(openCert, { expiresSeconds: 120 });
        openPdfPreview({ url, title: "Materialsertifikat" });
        return;
      }
      const editId = target.closest("[data-trace-edit]")?.getAttribute("data-trace-edit");
      if (editId) {
        const row = rows.find((r) => r.id === editId);
        if (row) openEditModal(row);
        return;
      }
      const delId = target.closest("[data-trace-del]")?.getAttribute("data-trace-del");
      if (delId) {
        const row = rows.find((r) => r.id === delId);
        if (!row) return;
        await openConfirmDelete(modalMount, signal, {
          title: "Slett sporbarhet",
          messageHtml: `Slett ${esc(row.type_code)}?`,
          onConfirm: async () => deleteProjectTraceability(row.id),
          onDone: async () => {
            rows = await fetchProjectTraceability(project.id);
            renderRows();
          },
        });
      }
    },
    { signal }
  );

  if (openAddBtn) {
    openAddBtn.addEventListener(
      "click",
      () => {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        openEditModal();
      },
      { signal }
    );
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => printTable(), { signal });
  }

  const load = async () => {
    traceBody.innerHTML = `<tr><td colspan="7" class="muted">Laster…</td></tr>`;
    try {
      const [t, dn, sch, pn, filler, certRows, traceRows, materialRows] = await Promise.all([
        fetchTraceabilityTypes(),
        fetchTraceabilityOptions("dn"),
        fetchTraceabilityOptions("sch"),
        fetchTraceabilityOptions("pn"),
        fetchTraceabilityOptions("filler_type"),
        fetchMaterialCertificates(),
        fetchProjectTraceability(project.id),
        fetchMaterials(),
      ]);
      types = t;
      optionsDn = dn;
      optionsSch = sch;
      optionsPn = pn;
      optionsFiller = filler;
      certs = certRows;
      rows = traceRows;
      materials = materialRows;
      renderRows();
    } catch (e: any) {
      console.error(e);
      traceBody.innerHTML = `<tr><td colspan="6" class="err">Feil: ${esc(String(e?.message ?? e))}</td></tr>`;
    }
  };

  await load();
}

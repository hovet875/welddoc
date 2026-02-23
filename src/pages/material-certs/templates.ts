import type { MaterialCertificateRow } from "../../repo/materialCertificateRepo";
import type { SupplierRow } from "../../repo/supplierRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import type { TraceabilityOptionRow } from "../../repo/traceabilityRepo";
import { esc } from "../../utils/dom";
import { truncateLabel } from "../../utils/format";
import { renderIconButton } from "../../ui/iconButton";

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

function actionBtn(kind: "edit" | "del", id: string, label: string) {
  const danger = kind === "del";
  const svg = danger ? icon("trash") : icon("pencil");
  const title = danger ? "Slett" : "Endre";
  const dataKey = danger ? "del" : "edit";
  return renderIconButton({ dataKey, id, title, icon: svg, danger, label });
}

function statusFromRow(row: MaterialCertificateRow) {
  const hasSupplier = (row.supplier ?? "").trim().length > 0;
  const heatCount = (row.heat_numbers ?? []).filter(Boolean).length;
  if (hasSupplier && heatCount > 0) {
    return { label: "Klar", cls: "status-pill ok" };
  }
  return { label: "Mangel", cls: "status-pill warn" };
}

export function renderMaterialCertTable(
  rows: MaterialCertificateRow[],
  showActions: boolean,
  selectedIds: Set<string>,
  groupKey?: "material" | "filler"
) {
  const selectAllAttr = groupKey ? `data-select-all="${esc(groupKey)}"` : "data-select-all";
  return `
    <div class="table-scroll">
      <table class="data-table material-cert-table">
        <thead>
          <tr>
            <th class="select-col">${
              showActions
                ? `<input type="checkbox" ${selectAllAttr} aria-label="Velg alle" />`
                : ""
            }</th>
            <th>Filnavn</th>
            <th>Sertifikat</th>
            <th>Material</th>
            <th>Leverandør</th>
            <th>Heat nr.</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const fileLabel = r.file?.label || "Sertifikat";
              const fileBase = fileLabel.replace(/\.pdf$/i, "");
              const fileFinish = truncateLabel(fileBase, 20);
              const heatList = (r.heat_numbers ?? []).filter(Boolean).join(", ") || "—";
              const status = statusFromRow(r);
              const certType = r.cert_type || "3.1";
              const isChecked = selectedIds.has(r.id);
              const materialName = r.material?.name ?? "";
              const fillerType = r.filler_type ?? "";
              const productLabel = r.certificate_type === "filler" ? fillerType : materialName;

              return `
                <tr>
                  <td class="select-col">
                    ${
                      showActions
                        ? `<input type="checkbox" data-select-id="${esc(r.id)}" ${isChecked ? "checked" : ""} />`
                        : ""
                    }
                  </td>
                  <td data-label="Filnavn">
                    <div class="filecell">
                      ${r.file_id
                        ? `<button type="button" class="file-pill" data-openpdf="${esc(r.file_id)}" title="${esc(fileBase)}">${esc(fileFinish)}</button>`
                        : `<span class="file-pill" title="${esc(fileBase)}">${esc(fileFinish)}</span>`}
                    </div>
                  </td>
                  <td data-label="Sertifikat">${esc(certType)}</td>
                  <td data-label="Material">${esc(productLabel || "—")}</td>
                  <td data-label="Leverandør">${esc(r.supplier ?? "")}</td>
                  <td data-label="Heat nr.">${esc(heatList)}</td>
                  <td data-label="Status"><span class="${status.cls}">${status.label}</span></td>
                  <td class="actcell">
                    ${showActions ? `${actionBtn("edit", r.id, fileBase)}${actionBtn("del", r.id, fileBase)}` : ""}
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function editMaterialCertForm(
  row: MaterialCertificateRow,
  suppliers: SupplierRow[],
  materials: MaterialRow[],
  fillerOptions: TraceabilityOptionRow[]
) {
  const supplierOptions = suppliers
    .map((s) => `<option value="${esc(s.name)}" ${s.name === row.supplier ? "selected" : ""}>${esc(s.name)}</option>`)
    .join("");
  const materialOptions = materials
    .map((m) => `<option value="${esc(m.id)}" ${m.id === row.material_id ? "selected" : ""}>${esc(m.name)}</option>`)
    .join("");
  const heatRows = (row.heat_numbers ?? [])
    .filter(Boolean)
    .map(
      (h) => `
        <div class="heat-row" data-heat-row>
          <input class="input" data-heat-input value="${esc(h)}" />
          <button type="button" class="btn tiny ghost" data-heat-remove>Fjern</button>
        </div>
      `
    )
    .join("");
  const materialName = row.material?.name ?? "";
  const fillerValue = row.filler_type ?? "";
  const fillerHidden = row.certificate_type !== "filler" ? "hidden" : "";
  const materialHidden = row.certificate_type === "filler" ? "hidden" : "";
  const fillerValues = fillerOptions.map((o) => o.value).filter(Boolean);
  const hasCurrentFiller = fillerValue ? fillerValues.includes(fillerValue) : false;
  const fillerSelectOptions = [
    `<option value="">Velg type…</option>`,
    ...fillerValues.map((value) => `<option value="${esc(value)}" ${value === fillerValue ? "selected" : ""}>${esc(value)}</option>`),
    ...(!hasCurrentFiller && fillerValue
      ? [`<option value="${esc(fillerValue)}" selected>${esc(fillerValue)}</option>`]
      : []),
  ].join("");

  return `
    <div class="modalgrid">
      <div class="field">
        <label>Type</label>
        <select data-f="certificate_type" class="select">
          <option value="material" ${row.certificate_type === "material" ? "selected" : ""}>Material</option>
          <option value="filler" ${row.certificate_type === "filler" ? "selected" : ""}>Sveisetilsett</option>
        </select>
      </div>

      <div class="field">
        <label>Sertifikattype</label>
        <select data-f="cert_type" class="select">
          <option value="2.1" ${row.cert_type === "2.1" ? "selected" : ""}>2.1</option>
          <option value="2.2" ${row.cert_type === "2.2" ? "selected" : ""}>2.2</option>
          <option value="3.1" ${!row.cert_type || row.cert_type === "3.1" ? "selected" : ""}>3.1</option>
          <option value="3.2" ${row.cert_type === "3.2" ? "selected" : ""}>3.2</option>
        </select>
      </div>

      <div class="field" data-material-field ${materialHidden}>
        <label>Material</label>
        <select data-f="material_id" class="select">
          <option value="">Velg material…</option>
          ${materialOptions}
        </select>
        ${materialName ? `<div class="muted" style="font-size:12px;">Valgt: ${esc(materialName)}</div>` : ""}
      </div>

      <div class="field" data-filler-field ${fillerHidden}>
        <label>Sveisetilsett-type</label>
        <select data-f="filler_type" class="select">
          ${fillerSelectOptions}
        </select>
      </div>

      <div class="field">
        <label>Leverandør</label>
        <select data-f="supplier" class="select">
          <option value="">Velg leverandør…</option>
          ${supplierOptions}
          <option value="__new__">Ny leverandør…</option>
        </select>
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>Heat no (én per linje)</label>
        <div class="heat-list" data-f="heat_list">
          ${heatRows || `<div class=\"muted\">Ingen heat nr. er lagt inn.</div>`}
        </div>
        <div class="heat-add">
          <input class="input" data-f="heat_new" placeholder="Skriv heat nr. og legg til" />
          <button type="button" class="btn small" data-heat-add>Legg til</button>
        </div>
      </div>

      <div class="field" style="grid-column:1 / -1;">
        <label>PDF</label>
        <div class="muted" style="font-size:12px;">${row.file_id ? "Eksisterende PDF vises i listen." : "Ingen PDF registrert."}</div>
      </div>
    </div>
  `;
}

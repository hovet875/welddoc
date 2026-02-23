import type { MaterialCertificateRow, MaterialCertificateType } from "../../repo/materialCertificateRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import type { TraceabilityOptionRow } from "../../repo/traceabilityRepo";
import type { SupplierRow } from "../../repo/supplierRepo";

import {
  createMaterialCertificateWithFile,
  createMaterialCertificateWithExistingFile,
  deleteMaterialCertificate,
  updateMaterialCertificate,
} from "../../repo/materialCertificateRepo";
import { createSupplier, fetchSuppliers } from "../../repo/supplierRepo";
import { markFileInboxProcessed } from "../../repo/fileInboxRepo";

import { computeFileSha256, findFileBySha256, createSignedUrlForFileRef } from "../../repo/fileRepo";
import { qs } from "../../utils/dom";
import { validatePdfFile } from "../../utils/format";
import { openModal, modalSaveButton, renderModal } from "../../ui/modal";
import { openPdfPreview } from "../../ui/pdfPreview";
import { editMaterialCertForm } from "./templates";

function getField<T extends Element>(modalRoot: HTMLElement, key: string) {
  return qs<T>(modalRoot, `[data-f="${key}"]`);
}

function disableSave(btn: HTMLButtonElement, text: string) {
  btn.disabled = true;
  btn.textContent = text;
}
function enableSave(btn: HTMLButtonElement, text: string) {
  btn.disabled = false;
  btn.textContent = text;
}

export async function openPdf(ref: string) {
  const url = await createSignedUrlForFileRef(ref, { expiresSeconds: 120 });
  openPdfPreview({ url, title: "Materialsertifikat" });
}

export async function handleDelete(row: MaterialCertificateRow) {
  await deleteMaterialCertificate(row.id, row.file_id);
}

export async function uploadBatch(
  files: File[],
  certificateType: MaterialCertificateType,
  certType: string,
  supplier: string | null,
  materialId: string | null,
  fillerType: string | null,
  onProgress?: (idx: number, total: number) => void,
  onDuplicate?: (file: File, existing: { id: string; label: string | null }) => Promise<boolean> | boolean
) {
  const duplicates = new Set<string>();
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const err = validatePdfFile(file, 25);
    if (err) throw new Error(err);
    onProgress?.(i + 1, files.length);
    try {
      const sha256 = await computeFileSha256(file);
      const existing = await findFileBySha256(sha256);
      if (existing) {
        const shouldLink = onDuplicate ? await onDuplicate(file, existing) : false;
        if (shouldLink) {
          await createMaterialCertificateWithExistingFile({
            certificate_type: certificateType,
            cert_type: certType,
            supplier,
            material_id: materialId,
            filler_type: fillerType,
            file_id: existing.id,
          });
        } else {
          duplicates.add(file.name);
        }
        continue;
      }

      await createMaterialCertificateWithFile({
        certificate_type: certificateType,
        cert_type: certType,
        supplier,
        material_id: materialId,
        filler_type: fillerType,
        file,
      });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.toLowerCase().includes("finnes allerede i systemet")) {
        duplicates.add(file.name);
        continue;
      }
      throw e;
    }
  }
  if (duplicates.size > 0) {
    const list = Array.from(duplicates).join(", ");
    throw new Error(`Følgende filer finnes allerede i systemet: ${list}`);
  }
}

export type MaterialCertUploadEntry = {
  file: File | null;
  file_id: string | null;
  inbox_id?: string | null;
  source_name?: string | null;
  certificate_type: MaterialCertificateType;
  cert_type: string;
  supplier: string | null;
  material_id: string | null;
  filler_type: string | null;
  heat_numbers: string[];
};

export async function uploadBatchWithMeta(
  entries: MaterialCertUploadEntry[],
  onProgress?: (idx: number, total: number) => void,
  onDuplicate?: (file: File, existing: { id: string; label: string | null }) => Promise<boolean> | boolean
) {
  const duplicates = new Set<string>();

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry.file && !entry.file_id) {
      throw new Error("Manglende filreferanse for opplasting.");
    }
    if (entry.file) {
      const err = validatePdfFile(entry.file, 25);
      if (err) throw new Error(err);
    }
    onProgress?.(i + 1, entries.length);

    try {
      let certId: string | null = null;

      if (entry.file) {
        const sha256 = await computeFileSha256(entry.file);
        const existing = await findFileBySha256(sha256);
        if (existing) {
          const shouldLink = onDuplicate ? await onDuplicate(entry.file, existing) : false;
          if (shouldLink) {
            certId = await createMaterialCertificateWithExistingFile({
              certificate_type: entry.certificate_type,
              cert_type: entry.cert_type,
              supplier: entry.supplier,
              material_id: entry.material_id,
              filler_type: entry.filler_type,
              file_id: existing.id,
            });
          } else {
            duplicates.add(entry.file.name);
          }
        } else {
          certId = await createMaterialCertificateWithFile({
            certificate_type: entry.certificate_type,
            cert_type: entry.cert_type,
            supplier: entry.supplier,
            material_id: entry.material_id,
            filler_type: entry.filler_type,
            file: entry.file,
          });
        }
      } else {
        certId = await createMaterialCertificateWithExistingFile({
          certificate_type: entry.certificate_type,
          cert_type: entry.cert_type,
          supplier: entry.supplier,
          material_id: entry.material_id,
          filler_type: entry.filler_type,
          file_id: entry.file_id!,
        });
      }

      if (certId && entry.heat_numbers.length > 0) {
        await updateMaterialCertificate(certId, { heat_numbers: entry.heat_numbers });
      }
      if (certId && entry.inbox_id) {
        await markFileInboxProcessed(entry.inbox_id);
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.toLowerCase().includes("finnes allerede i systemet")) {
        duplicates.add(entry.file?.name || entry.source_name || "ukjent fil");
        continue;
      }
      throw e;
    }
  }

  if (duplicates.size > 0) {
    const list = Array.from(duplicates).join(", ");
    throw new Error(`Følgende filer finnes allerede i systemet: ${list}`);
  }
}

export function openEditModal(
  mount: HTMLElement,
  signal: AbortSignal,
  row: MaterialCertificateRow,
  suppliers: SupplierRow[],
  materials: MaterialRow[],
  fillerOptions: TraceabilityOptionRow[],
  onDone: () => Promise<void>
) {
  const modalHtml = renderModal(
    "Endre materialsertifikat",
    editMaterialCertForm(row, suppliers, materials, fillerOptions),
    "Oppdater"
  );
  const h = openModal(mount, modalHtml, signal);

  const heatList = getField<HTMLDivElement>(h.root, "heat_list");
  const heatNew = getField<HTMLInputElement>(h.root, "heat_new");
  const heatAdd = qs<HTMLButtonElement>(h.root, "[data-heat-add]");
  const supplierSelect = getField<HTMLSelectElement>(h.root, "supplier");
  const typeSelect = getField<HTMLSelectElement>(h.root, "certificate_type");
  const materialSelect = getField<HTMLSelectElement>(h.root, "material_id");
  const materialField = qs<HTMLElement>(h.root, "[data-material-field]");
  const fillerField = qs<HTMLElement>(h.root, "[data-filler-field]");
  const fillerSelect = getField<HTMLSelectElement>(h.root, "filler_type");

  const normalizeHeat = (val: string) => val.trim();

  const refreshSupplierOptions = (selected?: string) => {
    const options = suppliers
      .map((s) => `<option value="${s.name}" ${s.name === (selected ?? row.supplier) ? "selected" : ""}>${s.name}</option>`)
      .join("");
    supplierSelect.innerHTML = `
      <option value="">Velg leverandør…</option>
      ${options}
      <option value="__new__">Ny leverandør…</option>
    `;
    if (selected) supplierSelect.value = selected;
  };

  const addSupplier = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createSupplier(trimmed);
    const updated = await fetchSuppliers();
    suppliers.splice(0, suppliers.length, ...updated);
    refreshSupplierOptions(trimmed);
  };

  const syncFillerVisibility = () => {
    const type = (typeSelect.value || "material").trim();
    if (type === "filler") {
      fillerField.removeAttribute("hidden");
      materialField.setAttribute("hidden", "");
      materialSelect.value = "";
    } else {
      fillerField.setAttribute("hidden", "");
      fillerSelect.value = "";
      materialField.removeAttribute("hidden");
    }
  };

  typeSelect.addEventListener("change", syncFillerVisibility, { signal });
  syncFillerVisibility();

  const addHeatRow = (value: string) => {
    const clean = normalizeHeat(value);
    if (!clean) return;
    const rowEl = document.createElement("div");
    rowEl.className = "heat-row";
    rowEl.setAttribute("data-heat-row", "");
    rowEl.innerHTML = `
      <input class="input" data-heat-input value="${clean}" />
      <button type="button" class="btn tiny ghost" data-heat-remove>Fjern</button>
    `;

    const empty = heatList.querySelector(".muted");
    if (empty) empty.remove();
    heatList.appendChild(rowEl);
  };

  heatAdd.addEventListener(
    "click",
    () => {
      const raw = heatNew.value || "";
      raw
        .split(/\n|,|;/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((h) => addHeatRow(h));
      heatNew.value = "";
      heatNew.focus();
    },
    { signal }
  );

  heatList.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLButtonElement>("[data-heat-remove]");
      if (!btn) return;
      const rowEl = btn.closest<HTMLElement>("[data-heat-row]");
      if (!rowEl) return;
      rowEl.remove();
      if (heatList.querySelectorAll("[data-heat-row]").length === 0) {
        heatList.innerHTML = `<div class="muted">Ingen heat nr lagt inn.</div>`;
      }
    },
    { signal }
  );

  supplierSelect.addEventListener(
    "change",
    async () => {
      if (supplierSelect.value !== "__new__") return;
      const name = window.prompt("Ny leverandør:", "");
      if (!name) {
        supplierSelect.value = "";
        return;
      }
      try {
        await addSupplier(name);
      } catch (e: any) {
        console.error(e);
        alert(String(e?.message ?? e));
        supplierSelect.value = "";
      }
    },
    { signal }
  );

  const save = modalSaveButton(h.root);

  save.addEventListener(
    "click",
    async () => {
      disableSave(save, "Oppdaterer…");

      try {
        const supplier = (supplierSelect.value || "").trim() || null;
        const type = (typeSelect.value || "material").trim();
        const certType = (getField<HTMLSelectElement>(h.root, "cert_type").value || "3.1").trim();
        const heatNumbers = Array.from(heatList.querySelectorAll<HTMLInputElement>("[data-heat-input]"))
          .map((el) => normalizeHeat(el.value || ""))
          .filter(Boolean);

        const materialId = (materialSelect.value || "").trim() || null;
        if (type === "material" && !materialId) {
          throw new Error("Velg material fra listen.");
        }

        const fillerValue = (fillerSelect.value || "").trim();
        let fillerType: string | null = null;
        if (type === "filler") {
          if (!fillerValue) {
            throw new Error("Velg sveisetilsett-type.");
          }
          const option = fillerOptions.find((o) => o.value === fillerValue);
          if (!option) {
            throw new Error("Velg sveisetilsett-type fra forslagene.");
          }
          fillerType = fillerValue;
        } else if (fillerValue) {
          const option = fillerOptions.find((o) => o.value === fillerValue);
          if (!option) {
            throw new Error("Velg sveisetilsett-type fra forslagene.");
          }
          fillerType = fillerValue;
        }

        await updateMaterialCertificate(row.id, {
          supplier,
          heat_numbers: heatNumbers,
          certificate_type: type === "filler" ? "filler" : "material",
          cert_type: certType || "3.1",
          material_id: materialId,
          filler_type: fillerType,
        });

        h.close();
        await onDone();
      } catch (e: any) {
        console.error(e);
        alert(String(e?.message ?? e));
      } finally {
        enableSave(save, "Oppdater");
      }
    },
    { signal }
  );
}

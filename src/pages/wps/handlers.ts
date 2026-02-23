import type { WpsPageState } from "./state";
import type { StandardRow } from "../../repo/standardRepo";
import type { WPQRRow, WPSRow } from "../../repo/wpsRepo";

import {
  createPdfSignedUrl,
  createWpqrWithOptionalPdf,
  createWpsWithOptionalPdf,
  deleteWpqr,
  deleteWps,
  updateWpqrWithPdf,
  updateWpsWithPdf,
} from "../../repo/wpsRepo";

import { esc, qs } from "../../utils/dom";
import { normalizeDocNo, validatePdfFile } from "../../utils/format";
import { openModal, modalSaveButton, renderModal } from "../../ui/modal";
import { openPdfPreview } from "../../ui/pdfPreview";
import { wireDatePickers } from "../../ui/datePicker";
import {
  currentPdfMeta,
  wpqrFormBody,
  wpsFormBody,
  toThicknessInput,
  formatMaterialLabel,
  processCode,
  resolveProcessValue,
} from "./templates";

export async function openPdf(path: string) {
  const url = await createPdfSignedUrl(path, 120);
  openPdfPreview({ url, title: "PDF" });
}

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

function currentDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(value: string | null | undefined, fallback?: string | null | undefined) {
  const primary = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(primary)) return primary;
  if (/^\d{4}-\d{2}-\d{2}T/.test(primary)) return primary.slice(0, 10);

  const secondary = String(fallback ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(secondary)) return secondary;
  if (/^\d{4}-\d{2}-\d{2}T/.test(secondary)) return secondary.slice(0, 10);

  return currentDateInputValue();
}

function isPdfFile(file: File) {
  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

type ModalPdfUploadHandle = {
  getSelectedFile: () => File | null;
};

function wireModalPdfUploadField(modalRoot: HTMLElement, signal: AbortSignal): ModalPdfUploadHandle {
  const input = modalRoot.querySelector<HTMLInputElement>("[data-f=pdf]");
  const dropzone = modalRoot.querySelector<HTMLElement>("[data-f=pdf_dropzone]");
  const previewMount = modalRoot.querySelector<HTMLDivElement>("[data-f=pdf_preview]");
  const removePdfInput = modalRoot.querySelector<HTMLInputElement>("[data-f=remove_pdf]");
  let selectedFile: File | null = input?.files?.[0] ?? null;
  let previewUrl: string | null = null;

  const clearPreviewUrl = () => {
    if (!previewUrl) return;
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  };

  const syncRemoveCheckbox = () => {
    if (!removePdfInput) return;
    removePdfInput.disabled = Boolean(selectedFile);
    if (selectedFile) removePdfInput.checked = false;
  };

  const renderPreview = () => {
    if (!previewMount) return;
    clearPreviewUrl();
    if (!selectedFile) {
      previewMount.innerHTML = `<div class="muted">Ingen ny PDF valgt.</div>`;
      return;
    }
    previewUrl = URL.createObjectURL(selectedFile);
    previewMount.innerHTML = `
      <div class="wps-upload-preview">
        <div class="wps-upload-preview-head">
          <div class="wps-upload-preview-title">${esc(selectedFile.name)}</div>
          <button type="button" class="btn small" data-pdf-preview-clear>Fjern</button>
        </div>
        <iframe class="wps-upload-preview-frame" src="${esc(previewUrl)}" title="Forhåndsvisning"></iframe>
      </div>
    `;
  };

  const setSelectedFile = (next: File | null, opts?: { clearInput?: boolean }) => {
    selectedFile = next;
    if (opts?.clearInput && input) input.value = "";
    syncRemoveCheckbox();
    renderPreview();
  };

  const pickDroppedFile = (files: File[]) => {
    const pdf = files.find((file) => isPdfFile(file)) ?? null;
    if (!pdf) {
      alert("Kun PDF-filer er tillatt.");
      return;
    }
    setSelectedFile(pdf, { clearInput: true });
  };

  input?.addEventListener(
    "change",
    () => {
      const file = input.files?.[0] ?? null;
      if (file && !isPdfFile(file)) {
        input.value = "";
        alert("Kun PDF-filer er tillatt.");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    },
    { signal }
  );

  dropzone?.addEventListener(
    "dragover",
    (e) => {
      e.preventDefault();
      dropzone.classList.add("is-drag");
    },
    { signal }
  );

  dropzone?.addEventListener(
    "dragleave",
    () => {
      dropzone.classList.remove("is-drag");
    },
    { signal }
  );

  dropzone?.addEventListener(
    "drop",
    (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-drag");
      const dt = (e as DragEvent).dataTransfer;
      const files = dt?.files ? Array.from(dt.files) : [];
      if (!files.length) return;
      pickDroppedFile(files);
    },
    { signal }
  );

  previewMount?.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-pdf-preview-clear]")) return;
      setSelectedFile(null, { clearInput: true });
    },
    { signal }
  );

  signal.addEventListener("abort", clearPreviewUrl, { once: true });
  syncRemoveCheckbox();
  renderPreview();

  return {
    getSelectedFile: () => selectedFile,
  };
}

function wireExistingPdfPreview(modalRoot: HTMLElement, signal: AbortSignal) {
  const openBtn = modalRoot.querySelector<HTMLButtonElement>("[data-open-existing-pdf]");
  if (!openBtn) return;

  openBtn.addEventListener(
    "click",
    () => {
      const ref = (openBtn.getAttribute("data-open-existing-pdf") || "").trim();
      if (!ref) return;
      void openPdf(ref).catch((err) => {
        console.error(err);
        alert("Klarte ikke å åpne PDF.");
      });
    },
    { signal }
  );
}

function readCommonForm(modalRoot: HTMLElement, materials: WpsPageState["materials"]) {
  const doc_no_raw = (getField<HTMLInputElement>(modalRoot, "doc_no").value || "").trim();
  const doc_date = (getField<HTMLInputElement>(modalRoot, "doc_date").value || "").trim();
  const standard_id = (getField<HTMLSelectElement>(modalRoot, "standard_id").value || "").trim();
  const process = (getField<HTMLSelectElement>(modalRoot, "process").value || "").trim();
  const materialId = (getField<HTMLSelectElement>(modalRoot, "material_id").value || "").trim();
  const material = materials.find((m) => m.id === materialId);
  if (materialId && !material) {
    throw new Error("Velg materiale fra listen.");
  }
  const material_id = material?.id ?? "";
  const material_label = material ? formatMaterialLabel(material) : "";
  const fuge = (getField<HTMLSelectElement>(modalRoot, "fuge").value || "").trim();
  const thicknessInput = modalRoot.querySelector<HTMLInputElement>("[data-f=tykkelse]");
  const tykkelse = (thicknessInput?.value || "").trim();

  return {
    doc_no: normalizeDocNo(doc_no_raw),
    doc_date,
    standard_id,
    process,
    material_id,
    materiale: material_label,
    fuge,
    tykkelse: tykkelse,
  };
}

function requireFields(base: ReturnType<typeof readCommonForm>, extraMsg = "") {
  if (!base.doc_no || !base.doc_date || !base.standard_id || !base.process || !base.material_id || !base.fuge || !base.tykkelse) {
    throw new Error(`Fyll ut alle felter.${extraMsg ? " " + extraMsg : ""}`);
  }
}

export function fillWpqrDropdownByProcess(
  modalRoot: HTMLElement,
  state: WpsPageState,
  process: string,
  selectedId: string | null
) {
  const sel = getField<HTMLSelectElement>(modalRoot, "wpqr_id");
  const processValue = resolveProcessValue(process, state.processes);
  const processKey = processCode(processValue);

  if (!processKey) {
    sel.innerHTML = `<option value="">Velg metode først…</option>`;
    sel.disabled = true;
    return;
  }

  sel.disabled = false;

  const list = state.wpqrAll
    .filter((w) => processCode(resolveProcessValue(w.process, state.processes)) === processKey)
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  sel.innerHTML =
    `<option value="">Ikke koblet</option>` +
    list
      .map((w) => {
        const materialLabel = formatMaterialLabel(w.material, w.materiale);
        return `<option value="${esc(w.id)}">${esc(w.doc_no)} • ${esc(materialLabel)} • ${esc(w.tykkelse)}</option>`;
      })
      .join("");

  sel.value = selectedId ?? "";
}

export async function openConfirmDelete(
  mount: HTMLElement,
  signal: AbortSignal,
  opts: { title: string; messageHtml: string; onConfirm: () => Promise<void>; onDone: () => Promise<void> }
) {
  const modalHtml = renderModal(
    opts.title,
    `
      <div style="display:grid; gap:10px;">
        <div>${opts.messageHtml}</div>
        <div class="muted" style="font-size:13px;">Dette kan ikke angres.</div>
      </div>
    `,
    "Slett"
  );

  const h = openModal(mount, modalHtml, signal);
  const save = modalSaveButton(h.root);
  save.classList.add("danger");

  save.addEventListener(
    "click",
    async () => {
      disableSave(save, "Sletter…");
      try {
        await opts.onConfirm();
        h.close();
        await opts.onDone();
      } catch (e: any) {
        console.error(e);
        alert(`Feil ved sletting: ${String(e?.message ?? e)}`);
        enableSave(save, "Slett");
      }
    },
    { signal }
  );
}

/** ---------- WPQR MODAL (NEW/EDIT) ---------- */
export function openWpqrModal(
  mount: HTMLElement,
  signal: AbortSignal,
  mode: "new" | "edit",
  row: WPQRRow | null,
  materials: WpsPageState["materials"],
  standards: StandardRow[],
  processes: WpsPageState["processes"],
  jointTypes: string[],
  onDone: () => Promise<void>
) {
  const selectableStandards = standards.filter((s) => s.type === "Sveiseprosedyreprøving");
  const title = mode === "new" ? "Ny WPQR" : "Endre WPQR";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";

  const modalHtml = renderModal(title, wpqrFormBody(selectableStandards, processes, materials, jointTypes), saveLabel);
  const h = openModal(mount, modalHtml, signal);
  wireDatePickers(h.root, signal);

  // prefill
  if (row) {
    getField<HTMLInputElement>(h.root, "doc_no").value = row.doc_no;
    getField<HTMLInputElement>(h.root, "doc_date").value = toDateInputValue(row.doc_date, row.created_at);
    getField<HTMLSelectElement>(h.root, "standard_id").value = row.standard_id || "";
    const processSelect = getField<HTMLSelectElement>(h.root, "process");
    const resolvedProcess = resolveProcessValue(row.process, processes);
    processSelect.value = resolvedProcess;
    if (resolvedProcess && !Array.from(processSelect.options).some((opt) => opt.value === resolvedProcess)) {
      const opt = document.createElement("option");
      opt.value = resolvedProcess;
      opt.textContent = resolvedProcess;
      processSelect.appendChild(opt);
      processSelect.value = resolvedProcess;
    }
    const materialSelect = getField<HTMLSelectElement>(h.root, "material_id");
    if (row.material_id) {
      const hasOption = Array.from(materialSelect.options).some((opt) => opt.value === row.material_id);
      if (!hasOption) {
        const opt = document.createElement("option");
        opt.value = row.material_id;
        opt.textContent = row.materiale || row.material_id;
        materialSelect.appendChild(opt);
      }
      materialSelect.value = row.material_id;
    } else if (row.materiale) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = row.materiale;
      materialSelect.appendChild(opt);
      materialSelect.value = "";
    }
    getField<HTMLSelectElement>(h.root, "fuge").value = row.fuge || "";
    const thicknessInput = h.root.querySelector<HTMLInputElement>("[data-f=tykkelse]");
    if (thicknessInput) thicknessInput.value = toThicknessInput(row.tykkelse);

    const meta = getField<HTMLDivElement>(h.root, "pdfMeta");
    meta.innerHTML = currentPdfMeta(row?.file_id ?? null);
  } else {
    getField<HTMLInputElement>(h.root, "doc_date").value = currentDateInputValue();
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(null);
  }
  wireExistingPdfPreview(h.root, signal);
  const wpqrPdfUpload = wireModalPdfUploadField(h.root, signal);

  // optional: live uppercase
  const doc = getField<HTMLInputElement>(h.root, "doc_no");
  doc.addEventListener("input", () => (doc.value = doc.value.toUpperCase()), { signal });

  const save = modalSaveButton(h.root);

  save.addEventListener(
    "click",
    async () => {
      disableSave(save, mode === "new" ? "Lagrer…" : "Oppdaterer…");

      try {
        const base = readCommonForm(h.root, materials);
        requireFields(base, "(PDF er valgfri.)");

        const pdfFile = wpqrPdfUpload.getSelectedFile();
        let removePdf =
          (h.root.querySelector<HTMLInputElement>(`[data-f="remove_pdf"]`)?.checked ?? false) === true;
        if (pdfFile) removePdf = false;

        if (pdfFile) {
          const err = validatePdfFile(pdfFile, 25);
          if (err) throw new Error(err);
        }

        if (mode === "new") {
          await createWpqrWithOptionalPdf(base, pdfFile);
        } else {
          await updateWpqrWithPdf(row!.id, base, { pdfFile, removePdf });
        }

        h.close();
        await onDone();
      } catch (e: any) {
        console.error(e);
        alert(String(e?.message ?? e));
      } finally {
        enableSave(save, saveLabel);
      }
    },
    { signal }
  );
}

/** ---------- WPS MODAL (NEW/EDIT) ---------- */
export function openWpsModal(
  mount: HTMLElement,
  signal: AbortSignal,
  state: WpsPageState,
  mode: "new" | "edit",
  row: WPSRow | null,
  onDone: () => Promise<void>
) {
  const selectableStandards = state.standards.filter((s) => s.type === "Sveiseprosedyrespesifikasjon");
  const title = mode === "new" ? "Ny WPS" : "Endre WPS";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";

  const modalHtml = renderModal(
    title,
    wpsFormBody(
      selectableStandards,
      state.processes,
      state.materials,
      state.jointTypes.map((j) => j.label)
    ),
    saveLabel
  );
  const h = openModal(mount, modalHtml, signal);
  wireDatePickers(h.root, signal);

  const processSel = getField<HTMLSelectElement>(h.root, "process");

  // prefill
  if (row) {
    getField<HTMLInputElement>(h.root, "doc_no").value = row.doc_no;
    getField<HTMLInputElement>(h.root, "doc_date").value = toDateInputValue(row.doc_date, row.created_at);
    getField<HTMLSelectElement>(h.root, "standard_id").value = row.standard_id || "";
    const resolvedProcess = resolveProcessValue(row.process, state.processes);
    processSel.value = resolvedProcess;
    if (resolvedProcess && !Array.from(processSel.options).some((opt) => opt.value === resolvedProcess)) {
      const opt = document.createElement("option");
      opt.value = resolvedProcess;
      opt.textContent = resolvedProcess;
      processSel.appendChild(opt);
      processSel.value = resolvedProcess;
    }
    const materialSelect = getField<HTMLSelectElement>(h.root, "material_id");
    if (row.material_id) {
      const hasOption = Array.from(materialSelect.options).some((opt) => opt.value === row.material_id);
      if (!hasOption) {
        const opt = document.createElement("option");
        opt.value = row.material_id;
        opt.textContent = row.materiale || row.material_id;
        materialSelect.appendChild(opt);
      }
      materialSelect.value = row.material_id;
    } else if (row.materiale) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = row.materiale;
      materialSelect.appendChild(opt);
      materialSelect.value = "";
    }
    getField<HTMLSelectElement>(h.root, "fuge").value = row.fuge || "";
    const thicknessInput = h.root.querySelector<HTMLInputElement>("[data-f=tykkelse]");
    if (thicknessInput) thicknessInput.value = toThicknessInput(row.tykkelse);

    const meta = getField<HTMLDivElement>(h.root, "pdfMeta");
    meta.innerHTML = currentPdfMeta(row?.file_id ?? null);
  } else {
    getField<HTMLInputElement>(h.root, "doc_date").value = currentDateInputValue();
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(null);
  }
  wireExistingPdfPreview(h.root, signal);
  const wpsPdfUpload = wireModalPdfUploadField(h.root, signal);

  // optional: live uppercase
  const doc = getField<HTMLInputElement>(h.root, "doc_no");
  doc.addEventListener("input", () => (doc.value = doc.value.toUpperCase()), { signal });

  // WPQR dropdown
  fillWpqrDropdownByProcess(h.root, state, processSel.value, row?.wpqr_id ?? null);

  processSel.addEventListener(
    "change",
    () => {
      fillWpqrDropdownByProcess(h.root, state, processSel.value, row?.wpqr_id ?? null);
    },
    { signal }
  );

  const save = modalSaveButton(h.root);

  save.addEventListener(
    "click",
    async () => {
      disableSave(save, mode === "new" ? "Lagrer…" : "Oppdaterer…");

      try {
        const base = readCommonForm(h.root, state.materials);
        requireFields(base, "(WPQR/PDF er valgfritt.)");

        const wpqr_id = (getField<HTMLSelectElement>(h.root, "wpqr_id").value || "").trim() || null;

        const pdfFile = wpsPdfUpload.getSelectedFile();
        let removePdf =
          (h.root.querySelector<HTMLInputElement>(`[data-f="remove_pdf"]`)?.checked ?? false) === true;
        if (pdfFile) removePdf = false;

        if (pdfFile) {
          const err = validatePdfFile(pdfFile, 25);
          if (err) throw new Error(err);
        }

        const payload = { ...base, wpqr_id };

        if (mode === "new") {
          await createWpsWithOptionalPdf(payload, pdfFile);
        } else {
          await updateWpsWithPdf(row!.id, payload, { pdfFile, removePdf });
        }

        h.close();
        await onDone();
      } catch (e: any) {
        console.error(e);
        alert(String(e?.message ?? e));
      } finally {
        enableSave(save, saveLabel);
      }
    },
    { signal }
  );
}

/** Delete wrappers */
export async function handleDeleteWpqr(id: string) {
  await deleteWpqr(id);
}
export async function handleDeleteWps(id: string) {
  await deleteWps(id);
}

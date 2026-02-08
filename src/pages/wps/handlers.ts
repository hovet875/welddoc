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
import { currentPdfMeta, wpqrFormBody, wpsFormBody, toThicknessInput, formatMaterialLabel } from "./templates";

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

function readCommonForm(modalRoot: HTMLElement, materials: WpsPageState["materials"]) {
  const doc_no_raw = (getField<HTMLInputElement>(modalRoot, "doc_no").value || "").trim();
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
  const thicknessSingle = modalRoot.querySelector<HTMLSelectElement>("[data-f=tykkelse]");
  const thicknessFrom = modalRoot.querySelector<HTMLSelectElement>("[data-f=tykkelse_from]");
  const thicknessTo = modalRoot.querySelector<HTMLSelectElement>("[data-f=tykkelse_to]");
  const wpqrSelect = modalRoot.querySelector<HTMLSelectElement>("[data-f=wpqr_id]");

  let tykkelse = "";
  if (thicknessSingle) {
    tykkelse = (thicknessSingle.value || "").trim();
  } else if (thicknessFrom && thicknessTo) {
    const from = (thicknessFrom.value || "").trim();
    const to = (thicknessTo.value || "").trim();
    if (from && to) {
      const isWpqr = !wpqrSelect;
      if (from === to) {
        tykkelse = from;
      } else {
        tykkelse = isWpqr ? `${from} mot ${to}` : `${from}-${to}`;
      }
    } else {
      tykkelse = "";
    }
  }

  return {
    doc_no: normalizeDocNo(doc_no_raw),
    standard_id,
    process,
    material_id,
    materiale: material_label,
    fuge,
    tykkelse: tykkelse,
  };
}

function requireFields(base: ReturnType<typeof readCommonForm>, extraMsg = "") {
  if (!base.doc_no || !base.standard_id || !base.process || !base.material_id || !base.fuge || !base.tykkelse) {
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
  const p = (process || "").trim();

  if (!p) {
    sel.innerHTML = `<option value="">Velg metode først…</option>`;
    sel.disabled = true;
    return;
  }

  sel.disabled = false;

  const list = state.wpqrAll
    .filter((w) => w.process === p)
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  sel.innerHTML =
    `<option value="">Ikke koblet</option>` +
    list
      .map((w) => {
        const materialLabel = formatMaterialLabel(w.material, w.materiale);
        return `<option value="${esc(w.id)}">${esc(w.doc_no)} • ${esc(materialLabel)} • ${esc(w.tykkelse)} mm</option>`;
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
  onDone: () => Promise<void>
) {
  const selectableStandards = standards.filter((s) => s.type === "Sveiseprosedyreprøving");
  const title = mode === "new" ? "Ny WPQR" : "Endre WPQR";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";

  const modalHtml = renderModal(title, wpqrFormBody(selectableStandards, processes, materials), saveLabel);
  const h = openModal(mount, modalHtml, signal);

  // prefill
  if (row) {
    getField<HTMLInputElement>(h.root, "doc_no").value = row.doc_no;
    getField<HTMLSelectElement>(h.root, "standard_id").value = row.standard_id || "";
    getField<HTMLSelectElement>(h.root, "process").value = row.process || "";
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
    const thicknessFrom = h.root.querySelector<HTMLSelectElement>("[data-f=tykkelse_from]");
    const thicknessTo = h.root.querySelector<HTMLSelectElement>("[data-f=tykkelse_to]");
    if (thicknessFrom && thicknessTo) {
      const raw = toThicknessInput(row.tykkelse);
      const parts = raw.includes(" mot ") ? raw.split(" mot ") : raw.split("-");
      const [fromRaw, toRaw] = parts.length === 2 ? parts : [raw, raw];
      thicknessFrom.value = (fromRaw || "").trim();
      thicknessTo.value = (toRaw || "").trim();
    }

    const meta = getField<HTMLDivElement>(h.root, "pdfMeta");
    meta.innerHTML = currentPdfMeta(row?.file_id ?? null);
  } else {
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(null);
  }

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

        const pdfInput = getField<HTMLInputElement>(h.root, "pdf");
        const pdfFile = pdfInput.files?.[0] ?? null;

        const removePdf =
          (h.root.querySelector<HTMLInputElement>(`[data-f="remove_pdf"]`)?.checked ?? false) === true;

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
    wpsFormBody(selectableStandards, state.processes, state.materials),
    saveLabel
  );
  const h = openModal(mount, modalHtml, signal);

  const processSel = getField<HTMLSelectElement>(h.root, "process");

  // prefill
  if (row) {
    getField<HTMLInputElement>(h.root, "doc_no").value = row.doc_no;
    getField<HTMLSelectElement>(h.root, "standard_id").value = row.standard_id || "";
    processSel.value = row.process || "";
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
    const toValue = toThicknessInput(row.tykkelse);
    const [fromRaw, toRaw] = toValue.includes("-") ? toValue.split("-") : [toValue, toValue];
    const thicknessFrom = h.root.querySelector<HTMLSelectElement>("[data-f=tykkelse_from]");
    const thicknessTo = h.root.querySelector<HTMLSelectElement>("[data-f=tykkelse_to]");
    if (thicknessFrom) thicknessFrom.value = (fromRaw || "").trim();
    if (thicknessTo) thicknessTo.value = (toRaw || "").trim();

    const meta = getField<HTMLDivElement>(h.root, "pdfMeta");
    meta.innerHTML = currentPdfMeta(row?.file_id ?? null);
  } else {
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(null);
  }

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

        const pdfInput = getField<HTMLInputElement>(h.root, "pdf");
        const pdfFile = pdfInput.files?.[0] ?? null;

        const removePdf =
          (h.root.querySelector<HTMLInputElement>(`[data-f="remove_pdf"]`)?.checked ?? false) === true;

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

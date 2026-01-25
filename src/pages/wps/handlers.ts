import type { WpsPageState } from "./state";
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
import { normalizeDocNo, stripMm, validatePdfFile } from "../../utils/format";
import { openModal, modalSaveButton, renderModal } from "../../ui/modal";
import { currentPdfMeta, wpqrFormBody, wpsFormBody, toThicknessInput } from "./templates";

export async function openPdf(path: string) {
  const url = await createPdfSignedUrl(path, 120);
  window.open(url, "_blank", "noopener,noreferrer");
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

function readCommonForm(modalRoot: HTMLElement) {
  const doc_no_raw = (getField<HTMLInputElement>(modalRoot, "doc_no").value || "").trim();
  const process = (getField<HTMLSelectElement>(modalRoot, "process").value || "").trim();
  const materiale = (getField<HTMLSelectElement>(modalRoot, "materiale").value || "").trim();
  const sammenfoyning = (getField<HTMLSelectElement>(modalRoot, "sammenfoyning").value || "").trim();
  const tykkelse_raw = getField<HTMLInputElement>(modalRoot, "tykkelse").value || "";

  return {
    doc_no: normalizeDocNo(doc_no_raw),
    process,
    materiale,
    sammenfoyning,
    tykkelse: stripMm(tykkelse_raw),
  };
}

function requireFields(base: ReturnType<typeof readCommonForm>, extraMsg = "") {
  if (!base.doc_no || !base.process || !base.materiale || !base.sammenfoyning || !base.tykkelse) {
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
      .map((w) => `<option value="${esc(w.id)}">${esc(w.doc_no)} • ${esc(w.materiale)} • ${esc(w.tykkelse)} mm</option>`)
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
  state: WpsPageState,
  mode: "new" | "edit",
  row: WPQRRow | null,
  onDone: () => Promise<void>
) {
  const title = mode === "new" ? "Ny WPQR" : "Endre WPQR";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";

  const modalHtml = renderModal(title, wpqrFormBody(), saveLabel);
  const h = openModal(mount, modalHtml, signal);

  // prefill
  if (row) {
    getField<HTMLInputElement>(h.root, "doc_no").value = row.doc_no;
    getField<HTMLSelectElement>(h.root, "process").value = row.process || "";
    getField<HTMLSelectElement>(h.root, "materiale").value = row.materiale || "";
    getField<HTMLSelectElement>(h.root, "sammenfoyning").value = row.sammenfoyning || "";
    getField<HTMLInputElement>(h.root, "tykkelse").value = toThicknessInput(row.tykkelse);

    const meta = getField<HTMLDivElement>(h.root, "pdfMeta");
    meta.innerHTML = currentPdfMeta(!!row.pdf_path);
  } else {
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(false);
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
        const base = readCommonForm(h.root);
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
  const title = mode === "new" ? "Ny WPS" : "Endre WPS";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";

  const modalHtml = renderModal(title, wpsFormBody(), saveLabel);
  const h = openModal(mount, modalHtml, signal);

  const processSel = getField<HTMLSelectElement>(h.root, "process");

  // prefill
  if (row) {
    getField<HTMLInputElement>(h.root, "doc_no").value = row.doc_no;
    processSel.value = row.process || "";
    getField<HTMLSelectElement>(h.root, "materiale").value = row.materiale || "";
    getField<HTMLSelectElement>(h.root, "sammenfoyning").value = row.sammenfoyning || "";
    getField<HTMLInputElement>(h.root, "tykkelse").value = toThicknessInput(row.tykkelse);

    const meta = getField<HTMLDivElement>(h.root, "pdfMeta");

  if (row?.pdf_path) {
      meta.innerHTML = currentPdfMeta(true);
    } else {
      meta.innerHTML = ""; // 👈 tomt
  }

  } else {
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = "";
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
        const base = readCommonForm(h.root);
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

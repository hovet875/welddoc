import type { WelderCertRow, NdtCertRow, ProfileWelderRow } from "../../repo/certRepo";

import {
  createCertPdfSignedUrl,
  createWelderCertWithPdf,
  updateWelderCertWithPdf,
  deleteWelderCert,
  createNdtCertWithPdf,
  updateNdtCertWithPdf,
  deleteNdtCert,
} from "../../repo/certRepo";

import { qs } from "../../utils/dom";
import { validatePdfFile } from "../../utils/format";
import { openModal, modalSaveButton, renderModal } from "../../ui/modal";
import { currentPdfMeta, welderCertFormBody, ndtCertFormBody } from "./templates";
import type { CertsPageState } from "./state";

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

export async function openWelderPdf(path: string) {
  const url = await createCertPdfSignedUrl("welder", path, 120);
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openNdtPdf(path: string) {
  const url = await createCertPdfSignedUrl("ndt", path, 120);
  window.open(url, "_blank", "noopener,noreferrer");
}

/** ---------- WELDER CERT MODAL ---------- */
export function openWelderCertModal(
  mount: HTMLElement,
  signal: AbortSignal,
  welders: ProfileWelderRow[],
  mode: "new" | "edit",
  row: WelderCertRow | null,
  onDone: () => Promise<void>
) {
  const title = mode === "new" ? "Nytt sveisesertifikat" : "Endre sveisesertifikat";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";

  const modalHtml = renderModal(title, welderCertFormBody(welders), saveLabel);
  const h = openModal(mount, modalHtml, signal);

  // prefill
  if (row) {
    getField<HTMLSelectElement>(h.root, "profile_id").value = row.profile_id;
    getField<HTMLInputElement>(h.root, "certificate_no").value = row.certificate_no ?? "";
    getField<HTMLInputElement>(h.root, "standard").value = row.standard ?? "";
    getField<HTMLInputElement>(h.root, "coverage_joint_type").value = row.coverage_joint_type ?? "";
    getField<HTMLInputElement>(h.root, "coverage_thickness").value = row.coverage_thickness ?? "";
    getField<HTMLInputElement>(h.root, "expires_at").value = row.expires_at ?? "";

    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(!!row.pdf_path);
  } else {
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(false);
  }

  const save = modalSaveButton(h.root);

  save.addEventListener(
    "click",
    async () => {
      disableSave(save, mode === "new" ? "Lagrer…" : "Oppdaterer…");

      try {
        const profile_id = (getField<HTMLSelectElement>(h.root, "profile_id").value || "").trim();
        const certificate_no = (getField<HTMLInputElement>(h.root, "certificate_no").value || "").trim();
        const standard = (getField<HTMLInputElement>(h.root, "standard").value || "").trim();
        const coverage_joint_type = (getField<HTMLInputElement>(h.root, "coverage_joint_type").value || "").trim() || null;
        const coverage_thickness = (getField<HTMLInputElement>(h.root, "coverage_thickness").value || "").trim() || null;
        const expires_at = (getField<HTMLInputElement>(h.root, "expires_at").value || "").trim() || null;

        if (!profile_id || !certificate_no || !standard) {
          throw new Error("Fyll ut Sveiser, Sertifikatnr og Standard. (PDF er valgfri.)");
        }

        const pdfInput = getField<HTMLInputElement>(h.root, "pdf");
        const pdfFile = pdfInput.files?.[0] ?? null;
        const removePdf =
          (h.root.querySelector<HTMLInputElement>(`[data-f="remove_pdf"]`)?.checked ?? false) === true;

        if (pdfFile) {
          const err = validatePdfFile(pdfFile, 25);
          if (err) throw new Error(err);
        }

        const payload = { profile_id, certificate_no, standard, coverage_joint_type, coverage_thickness, expires_at };

        if (mode === "new") {
          if (!pdfFile) throw new Error("PDF må lastes opp for å opprette sertifikat.");
          await createWelderCertWithPdf(payload, pdfFile);
        } else {
          await updateWelderCertWithPdf(row!.id, payload, { pdfFile, removePdf });
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

/** ---------- NDT CERT MODAL ---------- */
export function openNdtCertModal(
  mount: HTMLElement,
  signal: AbortSignal,
  mode: "new" | "edit",
  row: NdtCertRow | null,
  onDone: () => Promise<void>
) {
  const title = mode === "new" ? "Nytt NDT-sertifikat" : "Endre NDT-sertifikat";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";

  const modalHtml = renderModal(title, ndtCertFormBody(), saveLabel);
  const h = openModal(mount, modalHtml, signal);

  if (row) {
    getField<HTMLInputElement>(h.root, "personnel_name").value = row.personnel_name ?? "";
    getField<HTMLInputElement>(h.root, "certificate_no").value = row.certificate_no ?? "";
    getField<HTMLInputElement>(h.root, "ndt_method").value = row.ndt_method ?? "";
    getField<HTMLInputElement>(h.root, "expires_at").value = row.expires_at ?? "";
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(!!row.pdf_path);
  } else {
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(false);
  }

  const save = modalSaveButton(h.root);

  save.addEventListener(
    "click",
    async () => {
      disableSave(save, mode === "new" ? "Lagrer…" : "Oppdaterer…");

      try {
        const personnel_name = (getField<HTMLInputElement>(h.root, "personnel_name").value || "").trim();
        const certificate_no = (getField<HTMLInputElement>(h.root, "certificate_no").value || "").trim();
        const ndt_method = (getField<HTMLInputElement>(h.root, "ndt_method").value || "").trim();
        const expires_at = (getField<HTMLInputElement>(h.root, "expires_at").value || "").trim() || null;

        if (!personnel_name || !certificate_no || !ndt_method) {
          throw new Error("Fyll ut Navn, Sertifikatnr og NDT metode. (PDF er valgfri.)");
        }

        const pdfInput = getField<HTMLInputElement>(h.root, "pdf");
        const pdfFile = pdfInput.files?.[0] ?? null;
        const removePdf =
          (h.root.querySelector<HTMLInputElement>(`[data-f="remove_pdf"]`)?.checked ?? false) === true;

        if (pdfFile) {
          const err = validatePdfFile(pdfFile, 25);
          if (err) throw new Error(err);
        }

        const payload = { personnel_name, certificate_no, ndt_method, expires_at };

        if (mode === "new") {
          if (!pdfFile) throw new Error("PDF må lastes opp for å opprette sertifikat.");
          await createNdtCertWithPdf(payload, pdfFile);
        } else {
          await updateNdtCertWithPdf(row!.id, payload, { pdfFile, removePdf });
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
export async function handleDeleteWelderCert(id: string) {
  await deleteWelderCert(id);
}
export async function handleDeleteNdtCert(id: string) {
  await deleteNdtCert(id);
}

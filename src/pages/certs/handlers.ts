import type { WelderCertRow, NdtCertRow, ProfileWelderRow } from "../../repo/certRepo";
import type { StandardRow, StandardFmGroupRow } from "../../repo/standardRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import type { NdtMethodRow } from "../../repo/ndtReportRepo";
import type { NdtSupplierRow, NdtInspectorRow } from "../../repo/ndtSupplierRepo";
import type { WeldingProcessRow } from "../../repo/weldingProcessRepo";

import {
  createCertPdfSignedUrl,
  createWelderCertWithPdf,
  updateWelderCertWithPdf,
  deleteWelderCert,
  createNdtCertWithPdf,
  updateNdtCertWithPdf,
  deleteNdtCert,
} from "../../repo/certRepo";

import { esc, qs, renderOptions } from "../../utils/dom";
import { validatePdfFile } from "../../utils/format";
import { openModal, modalSaveButton, renderModal } from "../../ui/modal";
import { openPdfPreview } from "../../ui/pdfPreview";
import { currentPdfMeta, welderCertFormBody, ndtCertFormBody, materialLabel } from "./templates";
import { printPdfUrl } from "../../utils/print";
import { renderDatePickerInput, wireDatePickers } from "../../ui/datePicker";

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

const THICKNESS_INFINITE = "\u221E";

function isInfiniteThicknessPart(value: string | null | undefined) {
  const v = (value || "").trim().toLowerCase();
  return v === THICKNESS_INFINITE || v === "inf" || v === "infinite" || v === "ubegrenset";
}

function normalizeThicknessPart(raw: string) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(?:\.\d)?$/.test(normalized)) return null;
  return normalized.replace(".", ",");
}

function thicknessPartToNumber(part: string) {
  return Number(part.replace(",", "."));
}

function normalizeThicknessNote(raw: string) {
  let value = (raw || "").trim();
  if (!value) return null;
  if (value.startsWith("(") && value.endsWith(")") && value.length > 2) {
    value = value.slice(1, -1).trim();
  }
  value = value.replace(/\s+/g, " ").trim();
  return value || null;
}

function splitCoverageThickness(raw: string | null | undefined) {
  const source = (raw || "").trim();
  if (!source) return { base: "", note: "" };

  let base = source;
  let note = "";
  if (source.endsWith(")")) {
    const start = source.lastIndexOf("(");
    if (start > 0) {
      const maybeBase = source.slice(0, start).trim();
      const maybeNote = source.slice(start + 1, -1).trim();
      if (maybeBase && maybeNote) {
        base = maybeBase;
        note = maybeNote;
      }
    }
  }

  base = base.replace(/\s*mm$/i, "").trim();
  return { base, note };
}

function splitThicknessRange(rawBase: string) {
  const value = (rawBase || "").trim();
  if (!value) return { fromRaw: "", toRaw: "" };
  const dashIndex = value.indexOf("-");
  if (dashIndex === -1) return { fromRaw: value, toRaw: value };
  return {
    fromRaw: value.slice(0, dashIndex).trim(),
    toRaw: value.slice(dashIndex + 1).trim(),
  };
}

function isPdfFile(file: File) {
  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

type CertPdfUploadHandle = {
  getSelectedFile: () => File | null;
};

function wireCertPdfUploadField(modalRoot: HTMLElement, signal: AbortSignal): CertPdfUploadHandle {
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
      <div class="cert-upload-preview">
        <div class="cert-upload-preview-head">
          <div class="cert-upload-preview-title">${esc(selectedFile.name)}</div>
          <button type="button" class="btn small" data-pdf-preview-clear>Fjern</button>
        </div>
        <iframe class="cert-upload-preview-frame" src="${esc(previewUrl)}" title="Forhåndsvisning"></iframe>
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

function wireExistingPdfPreview(
  modalRoot: HTMLElement,
  signal: AbortSignal,
  openExistingPdf: (ref: string) => Promise<void>
) {
  const button = modalRoot.querySelector<HTMLButtonElement>("[data-open-existing-pdf]");
  if (!button) return;

  button.addEventListener(
    "click",
    () => {
      const ref = (button.getAttribute("data-open-existing-pdf") || "").trim();
      if (!ref) return;
      void openExistingPdf(ref).catch((err) => {
        console.error(err);
        alert("Klarte ikke å åpne PDF.");
      });
    },
    { signal }
  );
}

export async function openWelderPdf(ref: string) {
  const url = await createCertPdfSignedUrl("welder", ref, 120);
  openPdfPreview({ url, title: "Sveisesertifikat" });
}

export async function openNdtPdf(ref: string) {
  const url = await createCertPdfSignedUrl("ndt", ref, 120);
  openPdfPreview({ url, title: "NDT-sertifikat" });
}

export async function printWelderPdf(ref: string) {
  const url = await createCertPdfSignedUrl("welder", ref, 120);
  await printPdfUrl(url);
}

export async function printNdtPdf(ref: string) {
  const url = await createCertPdfSignedUrl("ndt", ref, 120);
  await printPdfUrl(url);
}

export function openWelderCertRenewModal(
  mount: HTMLElement,
  signal: AbortSignal,
  row: WelderCertRow,
  onDone: () => Promise<void>
) {
  const body = `
    <div class="modalgrid">
      <div class="field" style="grid-column:1 / -1;">
        <label>Sertifikat</label>
        <input data-f="certificate_no_read" class="input" disabled />
      </div>
      <div class="field">
        <label>Ny utløpsdato</label>
        ${renderDatePickerInput({
          inputAttrs: `data-f="expires_at" class="input" min="2000-01-01" max="2099-12-31"`,
          openLabel: "Velg utlopsdato",
        })}
      </div>
      <div class="field" style="grid-column:1 / -1;">
        <label>Ny PDF</label>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
        <div class="muted" style="font-size:12px;">Kun utløpsdato og PDF oppdateres.</div>
      </div>
    </div>
  `;

  const h = openModal(mount, renderModal("Oppdater sveisesertifikat", body, "Oppdater"), signal);
  wireDatePickers(h.root, signal);
  getField<HTMLInputElement>(h.root, "certificate_no_read").value = row.certificate_no ?? "";
  getField<HTMLInputElement>(h.root, "expires_at").value = row.expires_at ?? "";

  const save = modalSaveButton(h.root);
  save.addEventListener(
    "click",
    async () => {
      disableSave(save, "Oppdaterer…");

      try {
        const expires_at = (getField<HTMLInputElement>(h.root, "expires_at").value || "").trim() || null;
        if (!expires_at) {
          throw new Error("Velg ny utløpsdato.");
        }

        const pdfInput = getField<HTMLInputElement>(h.root, "pdf");
        const pdfFile = pdfInput.files?.[0] ?? null;
        if (!pdfFile) {
          throw new Error("Velg ny PDF.");
        }

        const err = validatePdfFile(pdfFile, 25);
        if (err) throw new Error(err);

        await updateWelderCertWithPdf(
          row.id,
          {
            profile_id: row.profile_id,
            certificate_no: row.certificate_no ?? "",
            standard: row.standard ?? "",
            welding_process_code: row.welding_process_code ?? null,
            base_material_id: row.base_material_id ?? null,
            coverage_joint_type: row.coverage_joint_type ?? null,
            coverage_thickness: row.coverage_thickness ?? null,
            expires_at,
            fm_group: row.fm_group ?? null,
            file_id: row.file_id ?? null,
          },
          { pdfFile, removePdf: false }
        );

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

export function openNdtCertRenewModal(
  mount: HTMLElement,
  signal: AbortSignal,
  row: NdtCertRow,
  onDone: () => Promise<void>
) {
  const body = `
    <div class="modalgrid">
      <div class="field" style="grid-column:1 / -1;">
        <label>Sertifikat</label>
        <input data-f="certificate_no_read" class="input" disabled />
      </div>
      <div class="field">
        <label>Ny utlopsdato</label>
        ${renderDatePickerInput({
          inputAttrs: `data-f="expires_at" class="input" min="2000-01-01" max="2099-12-31"`,
          openLabel: "Velg utlopsdato",
        })}
      </div>
      <div class="field" style="grid-column:1 / -1;">
        <label>Ny PDF</label>
        <input data-f="pdf" class="input" type="file" accept="application/pdf" />
        <div class="muted" style="font-size:12px;">Kun utlopsdato og PDF oppdateres.</div>
      </div>
    </div>
  `;

  const h = openModal(mount, renderModal("Oppdater NDT-sertifikat", body, "Oppdater"), signal);
  wireDatePickers(h.root, signal);
  getField<HTMLInputElement>(h.root, "certificate_no_read").value = row.certificate_no ?? "";
  getField<HTMLInputElement>(h.root, "expires_at").value = row.expires_at ?? "";

  const save = modalSaveButton(h.root);
  save.addEventListener(
    "click",
    async () => {
      disableSave(save, "Oppdaterer...");

      try {
        const expires_at = (getField<HTMLInputElement>(h.root, "expires_at").value || "").trim() || null;
        if (!expires_at) {
          throw new Error("Velg ny utlopsdato.");
        }

        const pdfInput = getField<HTMLInputElement>(h.root, "pdf");
        const pdfFile = pdfInput.files?.[0] ?? null;
        if (!pdfFile) {
          throw new Error("Velg ny PDF.");
        }

        const err = validatePdfFile(pdfFile, 25);
        if (err) throw new Error(err);

        await updateNdtCertWithPdf(
          row.id,
          {
            personnel_name: row.personnel_name,
            company: row.company,
            certificate_no: row.certificate_no ?? "",
            ndt_method: row.ndt_method ?? "",
            expires_at,
            file_id: row.file_id ?? null,
          },
          { pdfFile, removePdf: false }
        );

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

/** ---------- WELDER CERT MODAL ---------- */
export function openWelderCertModal(
  mount: HTMLElement,
  signal: AbortSignal,
  welders: ProfileWelderRow[],
  standards: StandardRow[],
  fmGroups: StandardFmGroupRow[],
  materials: MaterialRow[],
  weldingProcesses: WeldingProcessRow[],
  jointTypes: string[],
  mode: "new" | "edit",
  row: WelderCertRow | null,
  onDone: () => Promise<void>
) {
  const selectableStandards = standards.filter((s) => s.type === "Sveisesertifisering");
  const title = mode === "new" ? "Legg til sveisesertifikat" : "Endre sveisesertifikat";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";
  const jointTypeSet = new Set(jointTypes.map((j) => (j || "").trim()).filter(Boolean));
  (row?.coverage_joint_type || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((value) => jointTypeSet.add(value));
  const jointTypeOptions = Array.from(jointTypeSet);

  const modalHtml = renderModal(
    title,
    welderCertFormBody(welders, selectableStandards, materials, weldingProcesses, jointTypeOptions),
    saveLabel
  );
  const h = openModal(mount, modalHtml, signal);
  wireDatePickers(h.root, signal);
  const thicknessFromInput = h.root.querySelector<HTMLInputElement>("[data-f=coverage_thickness_from]");
  const thicknessToInput = h.root.querySelector<HTMLInputElement>("[data-f=coverage_thickness_to]");
  const thicknessToInfiniteInput = h.root.querySelector<HTMLInputElement>("[data-f=coverage_thickness_to_infinite]");

  const syncThicknessToInputState = () => {
    if (!thicknessToInput || !thicknessToInfiniteInput) return;
    thicknessToInput.disabled = thicknessToInfiniteInput.checked;
    if (thicknessToInfiniteInput.checked) thicknessToInput.value = "";
  };

  thicknessToInfiniteInput?.addEventListener("change", syncThicknessToInputState, { signal });

  // prefill
  if (row) {
    getField<HTMLSelectElement>(h.root, "profile_id").value = row.profile_id;
    getField<HTMLInputElement>(h.root, "certificate_no").value = row.certificate_no ?? "";
    getField<HTMLInputElement>(h.root, "standard").value = row.standard ?? "";
    const processSelect = getField<HTMLSelectElement>(h.root, "welding_process_code");
    processSelect.value = row.welding_process_code ?? "";
    if (row.welding_process_code && !Array.from(processSelect.options).some((opt) => opt.value === row.welding_process_code)) {
      const opt = document.createElement("option");
      opt.value = row.welding_process_code;
      opt.textContent = row.welding_process_code;
      processSelect.appendChild(opt);
      processSelect.value = row.welding_process_code;
    }
    const materialSelect = getField<HTMLSelectElement>(h.root, "base_material_id");
    if (row.base_material_id) {
      const hasOption = Array.from(materialSelect.options).some((opt) => opt.value === row.base_material_id);
      if (!hasOption) {
        const mat = materials.find((m) => m.id === row.base_material_id);
        const opt = document.createElement("option");
        opt.value = row.base_material_id;
        opt.textContent = mat ? materialLabel(mat) : row.base_material_id;
        materialSelect.appendChild(opt);
      }
      materialSelect.value = row.base_material_id;
    }
    
    const selectedJointTypes = new Set(
      (row.coverage_joint_type ?? "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    );
    const jointTypeEls = h.root.querySelectorAll<HTMLInputElement>("[data-f=coverage_joint_type]");
    jointTypeEls.forEach((el) => {
      el.checked = selectedJointTypes.has((el.value || "").trim().toUpperCase());
    });
    
    const { base: thicknessBase, note: thicknessNote } = splitCoverageThickness(row.coverage_thickness);
    const { fromRaw, toRaw } = splitThicknessRange(thicknessBase);
    const fromPart = (fromRaw || "").trim().replace(".", ",");
    const toPart = (toRaw || "").trim().replace(".", ",");
    const toIsInfinite = isInfiniteThicknessPart(toPart);
    if (thicknessFromInput) thicknessFromInput.value = fromPart;
    if (thicknessToInfiniteInput) thicknessToInfiniteInput.checked = toIsInfinite;
    if (thicknessToInput && !toIsInfinite) thicknessToInput.value = toPart;
    const noteInput = h.root.querySelector<HTMLInputElement>("[data-f=coverage_thickness_note]");
    if (noteInput) noteInput.value = thicknessNote;
    getField<HTMLInputElement>(h.root, "expires_at").value = row.expires_at ?? "";

    const existingPdfRef = row.file_id || row.pdf_path || null;
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(existingPdfRef);
  } else {
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(null);
  }
  wireExistingPdfPreview(h.root, signal, openWelderPdf);
  const welderPdfUpload = wireCertPdfUploadField(h.root, signal);
  syncThicknessToInputState();

  // Set up FM group dropdown based on standard selection
  const standardSelect = getField<HTMLSelectElement>(h.root, "standard");
  const fmGroupSelect = getField<HTMLSelectElement>(h.root, "fm_group");
  function updateFmGroupOptions() {
    const selectedValue = standardSelect.value.trim();
    const selectedStandard = selectableStandards.find((s) => s.label === selectedValue);

    if (selectedStandard) {
      const options = fmGroups.filter((g) => g.standard_id === selectedStandard.id);
      if (options.length > 0) {
        fmGroupSelect.innerHTML = `
          <option value="">Velg FM gruppe…</option>
          ${options.map((fm) => `<option value="${fm.label}">${fm.label}</option>`).join("")}
        `;
        fmGroupSelect.disabled = false;
      } else {
        fmGroupSelect.innerHTML = `<option value="">Ingen FM-grupper registrert</option>`;
        fmGroupSelect.disabled = true;
        fmGroupSelect.value = "";
      }
    } else {
      // Reset and disable FM group dropdown
      fmGroupSelect.innerHTML = `<option value="">Velg standard først…</option>`;
      fmGroupSelect.disabled = true;
      fmGroupSelect.value = "";
    }
  }

  // Listen to standard selection changes
  standardSelect.addEventListener("change", updateFmGroupOptions);

  // If editing and standard has FM groups, populate FM group dropdown
  if (row && row.standard) {
    updateFmGroupOptions();
    if (row.fm_group) {
      fmGroupSelect.value = row.fm_group;
    }
  }

  // If editing and standard is not in list, add it as an option
  if (row?.standard && !selectableStandards.some((s) => s.label === row.standard)) {
    const opt = document.createElement("option");
    opt.value = row.standard;
    opt.textContent = row.standard;
    standardSelect.appendChild(opt);
    standardSelect.value = row.standard;
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
        const welding_process_code =
          (getField<HTMLSelectElement>(h.root, "welding_process_code").value || "").trim() || null;
        
        const selectedJointTypes = Array.from(
          h.root.querySelectorAll<HTMLInputElement>("[data-f=coverage_joint_type]:checked")
        )
          .map((el) => (el.value || "").trim())
          .filter(Boolean);
        const coverage_joint_type = selectedJointTypes.length > 0 ? selectedJointTypes.join(",") : null;
        
        const base_material_id = (getField<HTMLSelectElement>(h.root, "base_material_id").value || "").trim() || null;
        const thicknessFromRaw = (h.root.querySelector<HTMLInputElement>("[data-f=coverage_thickness_from]")?.value || "").trim();
        const thicknessToRaw = (h.root.querySelector<HTMLInputElement>("[data-f=coverage_thickness_to]")?.value || "").trim();
        const thicknessNoteRaw =
          (h.root.querySelector<HTMLInputElement>("[data-f=coverage_thickness_note]")?.value || "").trim();
        const thicknessNote = normalizeThicknessNote(thicknessNoteRaw);
        const thicknessToInfinite =
          (h.root.querySelector<HTMLInputElement>("[data-f=coverage_thickness_to_infinite]")?.checked ?? false) ===
          true;
        const normalizedFrom = normalizeThicknessPart(thicknessFromRaw);
        const normalizedTo = normalizeThicknessPart(thicknessToRaw);
        let coverage_thickness: string | null = null;
        if (thicknessToInfinite) {
          if (!thicknessFromRaw) {
            throw new Error("Fyll ut tykkelse fra når øvre grense er ubegrenset.");
          }
          if (!normalizedFrom) {
            throw new Error("Tykkelse fra må være et tall med maks 1 desimal (f.eks. 2,8).");
          }
          coverage_thickness = `${normalizedFrom}-${THICKNESS_INFINITE}`;
        } else if (thicknessFromRaw || thicknessToRaw) {
          if (!thicknessFromRaw || !thicknessToRaw) {
            throw new Error("Fyll ut både fra og til i tykkelsesområdet, eller velg ubegrenset øvre grense.");
          }
          if (!normalizedFrom || !normalizedTo) {
            throw new Error("Tykkelsesområde må være tall med maks 1 desimal (f.eks. 2,8-5,6).");
          }
          const fromNum = thicknessPartToNumber(normalizedFrom);
          const toNum = thicknessPartToNumber(normalizedTo);
          if (fromNum > toNum) {
            throw new Error("Tykkelse fra kan ikke være større enn tykkelse til.");
          }
          coverage_thickness = `${normalizedFrom}-${normalizedTo}`;
        }
        if (!coverage_thickness && thicknessNote) {
          throw new Error("Fyll ut tykkelsesområde før du legger til notat.");
        }
        if (coverage_thickness && thicknessNote) {
          coverage_thickness = `${coverage_thickness} (${thicknessNote})`;
        }
        const expires_at = (getField<HTMLInputElement>(h.root, "expires_at").value || "").trim() || null;
        let fm_group = (getField<HTMLSelectElement>(h.root, "fm_group").value || "").trim() || null;

        const standardRow = selectableStandards.find((s) => s.label === standard);
        if (standardRow) {
          const available = fmGroups.filter((g) => g.standard_id === standardRow.id);
          if (available.length > 0 && !fm_group) {
            throw new Error("Velg FM-gruppe.");
          }
          if (available.length === 0 && !fm_group) {
            fm_group = "N/A";
          }
        }

        if (!profile_id || !certificate_no || !standard || !welding_process_code) {
          throw new Error("Fyll ut Sveiser, Sertifikatnr, Standard og Sveisemetode. (PDF er valgfri.)");
        }

        const pdfFile = welderPdfUpload.getSelectedFile();
        let removePdf =
          (h.root.querySelector<HTMLInputElement>(`[data-f="remove_pdf"]`)?.checked ?? false) === true;
        if (pdfFile) removePdf = false;

        if (pdfFile) {
          const err = validatePdfFile(pdfFile, 25);
          if (err) throw new Error(err);
        }

        const payload = {
          profile_id,
          certificate_no,
          standard,
          welding_process_code,
          base_material_id,
          coverage_joint_type,
          coverage_thickness,
          expires_at,
          fm_group,
        };

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
  methods: NdtMethodRow[],
  suppliers: NdtSupplierRow[],
  inspectors: NdtInspectorRow[],
  mode: "new" | "edit",
  row: NdtCertRow | null,
  onDone: () => Promise<void>
) {
  const title = mode === "new" ? "Legg til NDT-personell sertifikat" : "Endre NDT-sertifikat";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";

  const modalHtml = renderModal(title, ndtCertFormBody(methods, suppliers, inspectors), saveLabel);
  const h = openModal(mount, modalHtml, signal);
  wireDatePickers(h.root, signal);

  const companySelect = getField<HTMLSelectElement>(h.root, "company");
  const inspectorSelect = getField<HTMLSelectElement>(h.root, "personnel_name");
  const supplierIdByName = new Map(
    suppliers.map((supplier) => [supplier.name.trim(), supplier.id] as const)
  );

  function updateInspectorOptions(companyName: string, selectedInspector = "") {
    const supplierId = supplierIdByName.get(companyName.trim()) ?? null;
    const inspectorNames = (supplierId
      ? inspectors.filter((inspector) => inspector.supplier_id === supplierId).map((inspector) => inspector.name)
      : []
    ).sort((a, b) => a.localeCompare(b));

    const placeholder = supplierId ? "Velg kontrollør..." : "Velg firma først...";
    inspectorSelect.innerHTML = renderOptions(inspectorNames, placeholder);

    if (selectedInspector && inspectorNames.includes(selectedInspector)) {
      inspectorSelect.value = selectedInspector;
      return;
    }

    if (selectedInspector) {
      const opt = document.createElement("option");
      opt.value = selectedInspector;
      opt.textContent = selectedInspector;
      inspectorSelect.appendChild(opt);
      inspectorSelect.value = selectedInspector;
      return;
    }

    inspectorSelect.value = "";
  }

  companySelect.addEventListener(
    "change",
    () => {
      updateInspectorOptions(companySelect.value);
    },
    { signal }
  );

  if (row) {
    companySelect.value = row.company ?? "";
    if (row.company && !suppliers.some((supplier) => supplier.name === row.company)) {
      const opt = document.createElement("option");
      opt.value = row.company;
      opt.textContent = row.company;
      companySelect.appendChild(opt);
      companySelect.value = row.company;
    }
    updateInspectorOptions(companySelect.value, row.personnel_name ?? "");
    getField<HTMLInputElement>(h.root, "certificate_no").value = row.certificate_no ?? "";
    const methodSelect = getField<HTMLSelectElement>(h.root, "ndt_method");
    methodSelect.value = row.ndt_method ?? "";
    if (row.ndt_method && !methods.some((m) => m.label === row.ndt_method)) {
      const opt = document.createElement("option");
      opt.value = row.ndt_method;
      opt.textContent = row.ndt_method;
      methodSelect.appendChild(opt);
      methodSelect.value = row.ndt_method;
    }
    getField<HTMLInputElement>(h.root, "expires_at").value = row.expires_at ?? "";
    const existingPdfRef = row.file_id || row.pdf_path || null;
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(existingPdfRef);
  } else {
    updateInspectorOptions(companySelect.value);
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(null);
  }
  wireExistingPdfPreview(h.root, signal, openNdtPdf);
  const ndtPdfUpload = wireCertPdfUploadField(h.root, signal);

  const save = modalSaveButton(h.root);

  save.addEventListener(
    "click",
    async () => {
      disableSave(save, mode === "new" ? "Lagrer…" : "Oppdaterer…");

      try {
        const personnel_name = (getField<HTMLSelectElement>(h.root, "personnel_name").value || "").trim();
        const company = (getField<HTMLSelectElement>(h.root, "company").value || "").trim();
        const certificate_no = (getField<HTMLInputElement>(h.root, "certificate_no").value || "").trim();
        const ndt_method = (getField<HTMLSelectElement>(h.root, "ndt_method").value || "").trim();
        const expires_at = (getField<HTMLInputElement>(h.root, "expires_at").value || "").trim() || null;

        if (!personnel_name || !company || !certificate_no || !ndt_method) {
          throw new Error("Fyll ut kontrollør, firma, sertifikatnr og NDT-metode. (PDF er valgfri.)");
        }

        const pdfFile = ndtPdfUpload.getSelectedFile();
        let removePdf =
          (h.root.querySelector<HTMLInputElement>(`[data-f="remove_pdf"]`)?.checked ?? false) === true;
        if (pdfFile) removePdf = false;

        if (pdfFile) {
          const err = validatePdfFile(pdfFile, 25);
          if (err) throw new Error(err);
        }

        const payload = { personnel_name, company, certificate_no, ndt_method, expires_at };

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



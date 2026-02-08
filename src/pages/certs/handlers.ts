import type { WelderCertRow, NdtCertRow, ProfileWelderRow } from "../../repo/certRepo";
import type { StandardRow, StandardFmGroupRow } from "../../repo/standardRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import type { NdtMethodRow } from "../../repo/ndtReportRepo";

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
import { openPdfPreview } from "../../ui/pdfPreview";
import { currentPdfMeta, welderCertFormBody, ndtCertFormBody, materialLabel } from "./templates";
import { printPdfUrl } from "../../utils/print";

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

/** ---------- WELDER CERT MODAL ---------- */
export function openWelderCertModal(
  mount: HTMLElement,
  signal: AbortSignal,
  welders: ProfileWelderRow[],
  standards: StandardRow[],
  fmGroups: StandardFmGroupRow[],
  materials: MaterialRow[],
  mode: "new" | "edit",
  row: WelderCertRow | null,
  onDone: () => Promise<void>
) {
  const selectableStandards = standards.filter((s) => s.type === "Sveisesertifisering");
  const title = mode === "new" ? "Legg til sveisesertifikat" : "Endre sveisesertifikat";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";

  const modalHtml = renderModal(title, welderCertFormBody(welders, selectableStandards, materials), saveLabel);
  const h = openModal(mount, modalHtml, signal);

  // prefill
  if (row) {
    getField<HTMLSelectElement>(h.root, "profile_id").value = row.profile_id;
    getField<HTMLInputElement>(h.root, "certificate_no").value = row.certificate_no ?? "";
    getField<HTMLInputElement>(h.root, "standard").value = row.standard ?? "";
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
    
    // Parse coverage_joint_type string into checkboxes
    const jointTypes = (row.coverage_joint_type ?? "").split(",").map(s => s.trim());
    if (jointTypes.includes("FW")) {
      getField<HTMLInputElement>(h.root, "coverage_joint_type_fw").checked = true;
    }
    if (jointTypes.includes("BW")) {
      getField<HTMLInputElement>(h.root, "coverage_joint_type_bw").checked = true;
    }
    
    const thicknessVal = row.coverage_thickness ?? "";
    const [fromRaw, toRaw] = thicknessVal.includes("-") ? thicknessVal.split("-") : [thicknessVal, thicknessVal];
    const thicknessFrom = h.root.querySelector<HTMLSelectElement>("[data-f=coverage_thickness_from]");
    const thicknessTo = h.root.querySelector<HTMLSelectElement>("[data-f=coverage_thickness_to]");
    if (thicknessFrom) thicknessFrom.value = (fromRaw || "").trim();
    if (thicknessTo) thicknessTo.value = (toRaw || "").trim();
    getField<HTMLInputElement>(h.root, "expires_at").value = row.expires_at ?? "";

    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(!!row.pdf_path);
  } else {
    getField<HTMLDivElement>(h.root, "pdfMeta").innerHTML = currentPdfMeta(false);
  }

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
        
        // Build coverage_joint_type from checkboxes
        const jointTypes: string[] = [];
        if (getField<HTMLInputElement>(h.root, "coverage_joint_type_fw").checked) {
          jointTypes.push("FW");
        }
        if (getField<HTMLInputElement>(h.root, "coverage_joint_type_bw").checked) {
          jointTypes.push("BW");
        }
        const coverage_joint_type = jointTypes.length > 0 ? jointTypes.join(",") : null;
        
        const base_material_id = (getField<HTMLSelectElement>(h.root, "base_material_id").value || "").trim() || null;
        const thicknessFrom = (h.root.querySelector<HTMLSelectElement>("[data-f=coverage_thickness_from]")?.value || "").trim();
        const thicknessTo = (h.root.querySelector<HTMLSelectElement>("[data-f=coverage_thickness_to]")?.value || "").trim();
        const coverage_thickness = thicknessFrom && thicknessTo ? `${thicknessFrom}-${thicknessTo}` : null;
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

        const payload = {
          profile_id,
          certificate_no,
          standard,
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
  mode: "new" | "edit",
  row: NdtCertRow | null,
  onDone: () => Promise<void>
) {
  const title = mode === "new" ? "Legg til NDT-personell sertifikat" : "Endre NDT-sertifikat";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";

  const modalHtml = renderModal(title, ndtCertFormBody(methods), saveLabel);
  const h = openModal(mount, modalHtml, signal);

  if (row) {
    getField<HTMLInputElement>(h.root, "personnel_name").value = row.personnel_name ?? "";
    getField<HTMLInputElement>(h.root, "company").value = row.company ?? "";
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
        const company = (getField<HTMLInputElement>(h.root, "company").value || "").trim();
        const certificate_no = (getField<HTMLInputElement>(h.root, "certificate_no").value || "").trim();
        const ndt_method = (getField<HTMLInputElement>(h.root, "ndt_method").value || "").trim();
        const expires_at = (getField<HTMLInputElement>(h.root, "expires_at").value || "").trim() || null;

        if (!personnel_name || !company || !certificate_no || !ndt_method) {
          throw new Error("Fyll ut Navn, Firma, Sertifikatnr og NDT metode. (PDF er valgfri.)");
        }

        const pdfInput = getField<HTMLInputElement>(h.root, "pdf");
        const pdfFile = pdfInput.files?.[0] ?? null;
        const removePdf =
          (h.root.querySelector<HTMLInputElement>(`[data-f="remove_pdf"]`)?.checked ?? false) === true;

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

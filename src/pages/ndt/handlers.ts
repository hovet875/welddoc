import type { ProfileWelderRow } from "../../repo/certRepo";
import type { ProjectRow } from "../../repo/projectRepo";
import type { CustomerRow } from "../../repo/customerRepo";
import type { NdtMethodRow, NdtReportRow } from "../../repo/ndtReportRepo";

import {
  createNdtReportWithFile,
  updateNdtReport,
  updateNdtReportFile,
  deleteNdtReport,
} from "../../repo/ndtReportRepo";
import { createSignedUrlForFileRef } from "../../repo/fileRepo";

import { esc, qs, qsa } from "../../utils/dom";
import { printPdfUrl } from "../../utils/print";
import { validatePdfFile } from "../../utils/format";
import { openModal, modalSaveButton, renderModal } from "../../ui/modal";
import { openPdfPreview } from "../../ui/pdfPreview";
import { wireDatePickers } from "../../ui/datePicker";
import { currentPdfMeta, ndtReportFormBody } from "./templates";

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

function formatWelderLabel(w: ProfileWelderRow) {
  const no = w.welder_no ? String(w.welder_no).padStart(3, "0") : "—";
  const name = (w.display_name || "Uten navn").trim();
  return `${no} – ${name}`;
}

export async function openPdf(ref: string) {
  const url = await createSignedUrlForFileRef(ref, { expiresSeconds: 120 });
  openPdfPreview({ url, title: "NDT-rapport" });
}

export async function printNdtReportPdf(ref: string) {
  const url = await createSignedUrlForFileRef(ref, { expiresSeconds: 120 });
  await printPdfUrl(url);
}

export async function handleDeleteReport(row: NdtReportRow) {
  await deleteNdtReport(row.id, row.file_id);
}

export type NdtUploadEntry = {
  file: File;
  method_id: string;
  weld_count: number | null;
  defect_count: number | null;
  title: string;
  customer: string;
  report_date: string;
  welder_stats: Array<{ welder_id: string; weld_count: number | null; defect_count: number | null }>;
};

export async function uploadNdtBatchWithMeta(entries: NdtUploadEntry[], onProgress?: (idx: number, total: number) => void) {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const err = validatePdfFile(entry.file, 25);
    if (err) throw new Error(err);
    onProgress?.(i + 1, entries.length);
    await createNdtReportWithFile(entry);
  }
}

export function openNdtReportModal(
  mount: HTMLElement,
  signal: AbortSignal,
  methods: NdtMethodRow[],
  welders: ProfileWelderRow[],
  projects: ProjectRow[],
  customers: CustomerRow[],
  mode: "new" | "edit",
  row: NdtReportRow | null,
  onDone: () => Promise<void>
) {
  const title = mode === "new" ? "Ny NDT-rapport" : "Endre NDT-rapport";
  const saveLabel = mode === "new" ? "Lagre" : "Oppdater";
  const modalHtml = renderModal(
    title,
    ndtReportFormBody(methods, welders, projects, customers, { showReplaceFile: mode === "edit" }),
    saveLabel
  );
  const h = openModal(mount, modalHtml, signal);
  wireDatePickers(h.root, signal);

  const methodSelect = getField<HTMLSelectElement>(h.root, "method_id");
  const customerSelect = getField<HTMLSelectElement>(h.root, "customer");
  const projectSelect = getField<HTMLSelectElement>(h.root, "title");
  const rtFields = qsa<HTMLElement>(h.root, "[data-rt-only]");
  const fileInput = getField<HTMLInputElement>(h.root, "pdf");
  const pdfMeta = getField<HTMLDivElement>(h.root, "pdfMeta");
  const welderList = getField<HTMLDivElement>(h.root, "welder_list");
  const welderCounts = getField<HTMLDivElement>(h.root, "welder_counts");
  const welderSearch = getField<HTMLInputElement>(h.root, "welder_search");
  const projectMap = new Map(projects.map((p) => [String(p.project_no), p]));
  const welderLabelMap = new Map(welders.map((w) => [w.id, formatWelderLabel(w)]));

  let selectedFile: File | null = null;

  const renderPdfMeta = () => {
    const fileRef = row?.file_id ?? null;
    const label = row?.file?.label ?? "Rapport";
    pdfMeta.innerHTML = currentPdfMeta(fileRef, label);

    if (selectedFile) {
      const chosen = document.createElement("div");
      chosen.className = "pdfmeta muted";
      chosen.style.fontSize = "12px";
      chosen.textContent = `Valgt fil: ${selectedFile.name}`;
      pdfMeta.appendChild(chosen);
    }
  };

  const getSelectedWelderIds = () =>
    qsa<HTMLInputElement>(welderList, "input[type=checkbox]").filter((el) => el.checked).map((el) => el.value);

  const getWelderCountValues = () => {
    const map = new Map<string, { weld_count: number | null; defect_count: number | null }>();
    qsa<HTMLElement>(welderCounts, "[data-welder-id]").forEach((row) => {
      const id = row.dataset.welderId || "";
      if (!id) return;
      const weldInput = qs<HTMLInputElement>(row, "[data-weld-count]");
      const defectInput = qs<HTMLInputElement>(row, "[data-defect-count]");
      const weldRaw = (weldInput.value || "").trim();
      const defectRaw = (defectInput.value || "").trim();
      map.set(id, {
        weld_count: weldRaw ? Number(weldRaw) : null,
        defect_count: defectRaw ? Number(defectRaw) : null,
      });
    });
    return map;
  };

  const renderWelderCounts = (seed?: Map<string, { weld_count: number | null; defect_count: number | null }>) => {
    const current = seed ?? getWelderCountValues();
    const selected = getSelectedWelderIds();

    if (selected.length === 0) {
      welderCounts.innerHTML = `<div class="muted">Ingen sveisere valgt.</div>`;
      return;
    }

    welderCounts.innerHTML = selected
      .map((id) => {
        const label = welderLabelMap.get(id) || id;
        const values = current.get(id);
        const weldValue = values?.weld_count ?? "";
        const defectValue = values?.defect_count ?? "";
        return `
          <div class="welder-count-row" data-welder-id="${esc(id)}">
            <div class="welder-count-label">${esc(label)}</div>
            <input class="input" data-weld-count type="number" min="0" step="1" placeholder="Antall sveis" value="${esc(String(weldValue))}" />
            <input class="input" data-defect-count type="number" min="0" step="1" placeholder="Antall feil" value="${esc(String(defectValue))}" />
          </div>
        `;
      })
      .join("");
  };

  const setRtVisible = () => {
    const selectedId = (methodSelect.value || "").trim();
    const method = methods.find((m) => m.id === selectedId);
    const isRt = method?.code === "RT";
    rtFields.forEach((el) => {
      el.style.display = isRt ? "" : "none";
    });
    if (isRt) renderWelderCounts();
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    selectedFile = files[0] ?? null;
    renderPdfMeta();
  };

  const syncCustomerFromProject = () => {
    const projectNo = (projectSelect.value || "").trim();
    const project = projectMap.get(projectNo);
    const nextCustomer = project?.customer ?? (row?.customer ?? "");
    const hasOption = Array.from(customerSelect.options).some((opt) => opt.value === nextCustomer);
    if (nextCustomer && !hasOption) {
      const opt = document.createElement("option");
      opt.value = nextCustomer;
      opt.textContent = nextCustomer;
      customerSelect.appendChild(opt);
    }
    customerSelect.value = nextCustomer;
  };

  methodSelect.addEventListener("change", setRtVisible, { signal });
  projectSelect.addEventListener("change", syncCustomerFromProject, { signal });
  welderList.addEventListener(
    "change",
    () => {
      renderWelderCounts();
    },
    { signal }
  );
  welderSearch.addEventListener(
    "input",
    () => {
      const q = (welderSearch.value || "").trim().toLowerCase();
      qsa<HTMLElement>(welderList, ".welder-pill").forEach((pill) => {
        const label = (pill.dataset.welderLabel || "").toLowerCase();
        const match = !q || label.includes(q);
        pill.style.display = match ? "" : "none";
      });
    },
    { signal }
  );

  fileInput.addEventListener(
    "change",
    () => {
      addFiles(fileInput.files);
      fileInput.value = "";
    },
    { signal }
  );

  setRtVisible();
  renderPdfMeta();
  syncCustomerFromProject();
  renderWelderCounts();

  h.root.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;
      const openId = target.closest("[data-openpdf]")?.getAttribute("data-openpdf");
      if (!openId) return;
      try {
        const url = await createSignedUrlForFileRef(openId, { expiresSeconds: 120 });
        const label = row?.file?.label ?? "NDT-rapport";
        openPdfPreview({ url, title: label });
      } catch (err) {
        console.error(err);
        alert("Klarte ikke å åpne PDF.");
      }
    },
    { signal }
  );

  if (row) {
    const projectValue = row.title ?? "";
    if (projectValue) {
      const hasOption = Array.from(projectSelect.options).some((opt) => opt.value === projectValue);
      if (!hasOption) {
        const opt = document.createElement("option");
        opt.value = projectValue;
        opt.textContent = projectValue;
        projectSelect.appendChild(opt);
      }
    }
    projectSelect.value = projectValue;
    syncCustomerFromProject();
    if (row.customer) {
      const hasOption = Array.from(customerSelect.options).some((opt) => opt.value === row.customer);
      if (!hasOption) {
        const opt = document.createElement("option");
        opt.value = row.customer;
        opt.textContent = row.customer;
        customerSelect.appendChild(opt);
      }
      customerSelect.value = row.customer;
    }
    getField<HTMLInputElement>(h.root, "report_date").value = (row.report_date ?? row.created_at).slice(0, 10);
    methodSelect.value = row.method_id ?? "";
    const selected = new Set((row.report_welders || []).map((rw) => rw.welder_id));
    qsa<HTMLInputElement>(welderList, "input[type=checkbox]").forEach((el) => {
      el.checked = selected.has(el.value);
    });
    const seed = new Map(
      (row.report_welders || []).map((rw) => [rw.welder_id, { weld_count: rw.weld_count, defect_count: rw.defect_count }])
    );
    renderWelderCounts(seed);
    setRtVisible();
  }

  const save = modalSaveButton(h.root);
  save.addEventListener(
    "click",
    async () => {
      disableSave(save, "Lagrer…");

      try {
        const title = (projectSelect.value || "").trim();
        const customer = (customerSelect.value || "").trim();
        const report_date = (getField<HTMLInputElement>(h.root, "report_date").value || "").trim();
        if (!title || !customer || !report_date) {
          throw new Error("Velg prosjektnr, kunde og dato.");
        }

        const method_id = (methodSelect.value || "").trim();
        if (!method_id) throw new Error("Velg NDT-metode.");

        if (mode === "new" && !selectedFile) throw new Error("Velg én PDF.");

        if (selectedFile) {
          const err = validatePdfFile(selectedFile, 25);
          if (err) throw new Error(err);
        }

        const method = methods.find((m) => m.id === method_id);
        const isRt = method?.code === "RT";

        const welderIds = getSelectedWelderIds();
        let welderStats: Array<{ welder_id: string; weld_count: number | null; defect_count: number | null }> =
          welderIds.map((welder_id) => ({ welder_id, weld_count: null, defect_count: null }));

        if (isRt) {
          if (welderIds.length === 0) {
            throw new Error("Velg minst én sveiser for RT.");
          }
          const countMap = getWelderCountValues();
          welderStats = welderIds.map((welder_id) => {
            const v = countMap.get(welder_id);
            return { welder_id, weld_count: v?.weld_count ?? null, defect_count: v?.defect_count ?? null };
          });

          if (welderStats.length > 0) {
            const missing = welderStats.some(
              (s) => s.weld_count == null || Number.isNaN(s.weld_count) || s.defect_count == null || Number.isNaN(s.defect_count)
            );
            if (missing) {
              throw new Error("Oppgi antall sveis og feil per sveiser for RT.");
            }
          }

          const totalWelds = welderStats.reduce((sum, s) => sum + (s.weld_count ?? 0), 0);
          if (totalWelds <= 0) throw new Error("Antall sveis må være større enn 0 for RT.");
        }

        const statsTotalWelds = welderStats.length > 0 ? welderStats.reduce((sum, s) => sum + (s.weld_count ?? 0), 0) : null;
        const statsTotalDefects = welderStats.length > 0 ? welderStats.reduce((sum, s) => sum + (s.defect_count ?? 0), 0) : null;
        const reportWelds = isRt ? statsTotalWelds : null;
        const reportDefects = isRt ? statsTotalDefects : null;

        if (mode === "new") {
          await createNdtReportWithFile({
            method_id,
            weld_count: reportWelds,
            defect_count: reportDefects,
            title,
            customer,
            report_date,
            welder_stats: welderStats,
            file: selectedFile!,
          });
        } else {
          await updateNdtReport(row!.id, {
            method_id,
            weld_count: reportWelds,
            defect_count: reportDefects,
            title,
            customer,
            report_date,
            welder_stats: welderStats,
          });

          if (selectedFile && row?.file_id) {
            await updateNdtReportFile(row.file_id, selectedFile);
          }
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

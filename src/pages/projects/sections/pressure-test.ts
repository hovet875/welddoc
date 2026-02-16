import type { ProjectRow } from "../../../repo/projectRepo";
import type { ProjectDrawingRow } from "../../../repo/projectDrawingRepo";
import type {
  PressureTestType,
  PressureTestPerformerOption,
  ProjectPressureTestItemRow,
  ProjectPressureTestRow,
} from "../../../repo/projectPressureTestRepo";

import { fetchProjectDrawings } from "../../../repo/projectDrawingRepo";
import {
  createProjectPressureTestRow,
  createProjectPressureTestRows,
  deleteProjectPressureTestRow,
  fetchProjectPressureTest,
  fetchProjectPressureTestRows,
  listPressureTestPerformers,
  removePressureGaugeCertificate,
  saveProjectPressureTestMeta,
  updateProjectPressureTestRow,
  upsertPressureGaugeCertificate,
} from "../../../repo/projectPressureTestRepo";
import { createSignedUrlForFileRef } from "../../../repo/fileRepo";
import { openConfirmDelete } from "../../../ui/confirm";
import { renderDatePickerInput, wireDatePickers } from "../../../ui/datePicker";
import { modalSaveButton, openModal, renderModal } from "../../../ui/modal";
import { openPdfPreview } from "../../../ui/pdfPreview";
import { toast } from "../../../ui/toast";
import { esc, qs } from "../../../utils/dom";
import { formatErrorMessage } from "../../../utils/error";
import { validatePdfFile } from "../../../utils/format";

const lineNo = (row: ProjectPressureTestItemRow) => {
  const line = Number(row.line_no ?? 0);
  return Number.isFinite(line) && line > 0 ? line : 0;
};

const sortRowsByLine = (rows: ProjectPressureTestItemRow[]) => {
  return [...rows].sort((a, b) => {
    const aLine = lineNo(a);
    const bLine = lineNo(b);
    if (aLine !== bLine) return aLine - bLine;
    return String(a.id).localeCompare(String(b.id));
  });
};

const readText = (root: ParentNode, selector: string) => {
  const element = root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
  return String(element?.value ?? "").trim();
};

const textOrNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const resultOptions = [
  { value: "", label: "Velg" },
  { value: "godkjent", label: "Godkjent" },
  { value: "ikke_godkjent", label: "Ikke godkjent" },
];

export async function renderProjectPressureTestSection(opts: {
  mount: HTMLElement;
  modalMount: HTMLElement;
  project: ProjectRow;
  isAdmin: boolean;
  signal: AbortSignal;
}) {
  const { mount, modalMount, project, isAdmin, signal } = opts;

  let meta: ProjectPressureTestRow | null = null;
  let rows: ProjectPressureTestItemRow[] = [];
  let performers: PressureTestPerformerOption[] = [];
  let drawings: ProjectDrawingRow[] = [];
  let busy = false;

  const loadRowsOnly = async () => {
    rows = sortRowsByLine(await fetchProjectPressureTestRows(project.id));
  };

  const loadAll = async () => {
    const [bundle, performerRows, drawingRows] = await Promise.all([
      fetchProjectPressureTest(project.id),
      listPressureTestPerformers(),
      fetchProjectDrawings(project.id),
    ]);
    meta = bundle.meta;
    rows = sortRowsByLine(bundle.rows);
    performers = performerRows;
    drawings = drawingRows;
  };

  const testType = () => ((meta?.test_type ?? "pressure") === "leak" ? "leak" : "pressure");

  const render = () => {
    const disabledAttr = isAdmin ? "" : " disabled";
    const savedById = String(meta?.performed_by ?? "").trim();
    const certificateName = String(meta?.gauge_file?.label ?? "").trim();
    const certificateFileId = String(meta?.gauge_cert_file_id ?? "").trim();
    const drawingValues = Array.from(
      new Set(
        drawings
          .map((drawing) => String(drawing.drawing_no ?? "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base", numeric: true }))
      )
    );

    mount.innerHTML = `
      <section class="panel pressure-test-panel">
        <div class="panel-head">
          <div class="panel-title">Trykk- og lekkasjetestprotokoll</div>
          <div class="panel-meta">${rows.length} rader</div>
        </div>
        <div class="panel-body">
          <div class="pressure-test-grid">
            <div class="field">
              <label>Testtype</label>
              <select class="select" data-pt-meta="test_type"${disabledAttr}>
                <option value="pressure"${testType() === "pressure" ? " selected" : ""}>Trykktest</option>
                <option value="leak"${testType() === "leak" ? " selected" : ""}>Lekkasjetest</option>
              </select>
            </div>
            <div class="field">
              <label>Dato</label>
              ${renderDatePickerInput({
                value: String(meta?.test_date ?? "").trim(),
                inputAttrs: `data-pt-meta="test_date"${disabledAttr}`,
              })}
            </div>
            <div class="field">
              <label>Sted</label>
              <input class="input" data-pt-meta="test_location" value="${esc(String(meta?.test_location ?? "").trim())}"${disabledAttr} />
            </div>
            <div class="field">
              <label>Testen er utført av</label>
              <select class="select" data-pt-meta="performed_by"${disabledAttr}>
                <option value="">Velg bruker</option>
                ${performers
                  .map((performer) => {
                    const selected = savedById === performer.id ? " selected" : "";
                    return `<option value="${esc(performer.id)}"${selected}>${esc(performer.label)}</option>`;
                  })
                  .join("")}
              </select>
            </div>
            <div class="field">
              <label>Kunde</label>
              <input class="input" value="${esc(String(project.customer ?? ""))}" disabled />
            </div>
            <div class="field">
              <label>Arbeidsordre</label>
              <input class="input" value="${esc(String(project.work_order ?? ""))}" disabled />
            </div>
            <div class="field">
              <label>Prosjekt nummer</label>
              <input class="input" value="${esc(String(project.project_no ?? ""))}" disabled />
            </div>
            <div class="field">
              <label>Testutstyr</label>
              <input class="input" data-pt-meta="test_equipment" value="${esc(String(meta?.test_equipment ?? "").trim())}"${disabledAttr} />
            </div>
            <div class="field">
              <label>Kalibrert manometer ID</label>
              <input class="input" data-pt-meta="gauge_id" value="${esc(String(meta?.gauge_id ?? "").trim())}"${disabledAttr} />
            </div>
            <div class="field field-span-2">
              <label>Kommentar</label>
              <textarea class="input pressure-test-comment" data-pt-meta="comments"${disabledAttr}>${esc(
                String(meta?.comments ?? "").trim()
              )}</textarea>
            </div>
            <div class="pressure-test-cert field-span-2">
              <div>
                <div class="pressure-test-cert-title">Manometer-sertifikat (PDF)</div>
                <div class="pressure-test-cert-meta">${
                  certificateName ? esc(certificateName) : "Ingen sertifikat lastet opp."
                }</div>
              </div>
              <div class="pressure-test-cert-actions">
                ${
                  certificateFileId
                    ? `<button class="btn small" type="button" data-pt-cert-open>Åpne</button>`
                    : ""
                }
                ${
                  isAdmin
                    ? `<button class="btn small" type="button" data-pt-cert-upload>${certificateFileId ? "Bytt PDF" : "Last opp PDF"}</button>`
                    : ""
                }
                ${
                  isAdmin && certificateFileId
                    ? `<button class="btn small danger" type="button" data-pt-cert-remove>Fjern</button>`
                    : ""
                }
              </div>
            </div>
          </div>

          ${
            isAdmin
              ? `
                <div class="pressure-test-actions">
                  <button class="btn accent" type="button" data-pt-save${busy ? " disabled" : ""}>
                    ${busy ? "Lagrer..." : "Lagre protokoll"}
                  </button>
                </div>
              `
              : ""
          }

          <div class="pressure-test-table-head">
            <strong>Testlinjer</strong>
            ${
              isAdmin
                ? `
                  <div class="pressure-test-table-head-actions">
                    <button class="btn small" type="button" data-pt-row-add>Ny rad</button>
                    <button class="btn small" type="button" data-pt-row-add-12>Legg til 12 rader</button>
                  </div>
                `
                : ""
            }
          </div>

          <datalist id="pressure-test-drawing-options">
            ${drawingValues.map((value) => `<option value="${esc(value)}"></option>`).join("")}
          </datalist>

          <div class="table-scroll pressure-test-table-wrap">
            <table class="data-table pressure-test-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tegningsnummer</th>
                  <th>Beskrivelse</th>
                  <th>Testmedie</th>
                  <th>Arbeidstrykk</th>
                  <th>Testtrykk</th>
                  <th>Holdetid</th>
                  <th>Resultat</th>
                  ${isAdmin ? `<th></th>` : ""}
                </tr>
              </thead>
              <tbody>
                ${
                  rows.length
                    ? rows
                        .map((row) => {
                          const rowId = esc(row.id);
                          const resultValue = String(row.result ?? "").trim().toLowerCase();
                          return `
                            <tr data-pt-row-id="${rowId}">
                              <td>${lineNo(row)}</td>
                              <td><input class="input" data-row-field="drawing_no" list="pressure-test-drawing-options" value="${esc(
                                String(row.drawing_no ?? "")
                              )}"${disabledAttr} /></td>
                              <td><input class="input" data-row-field="description" value="${esc(String(row.description ?? ""))}"${disabledAttr} /></td>
                              <td><input class="input" data-row-field="test_medium" value="${esc(String(row.test_medium ?? ""))}"${disabledAttr} /></td>
                              <td><input class="input" data-row-field="working_pressure" value="${esc(
                                String(row.working_pressure ?? "")
                              )}"${disabledAttr} /></td>
                              <td><input class="input" data-row-field="test_pressure" value="${esc(
                                String(row.test_pressure ?? "")
                              )}"${disabledAttr} /></td>
                              <td><input class="input" data-row-field="hold_time" value="${esc(String(row.hold_time ?? ""))}"${disabledAttr} /></td>
                              <td>
                                <select class="select" data-row-field="result"${disabledAttr}>
                                  ${resultOptions
                                    .map((option) => {
                                      const selected = option.value === resultValue ? " selected" : "";
                                      return `<option value="${esc(option.value)}"${selected}>${esc(option.label)}</option>`;
                                    })
                                    .join("")}
                                </select>
                              </td>
                              ${
                                isAdmin
                                  ? `
                                    <td class="actcell pressure-test-row-actions">
                                      <button class="btn small" type="button" data-pt-row-save="${rowId}">Lagre</button>
                                      <button class="btn small danger" type="button" data-pt-row-delete="${rowId}">Slett</button>
                                    </td>
                                  `
                                  : ""
                              }
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan="${isAdmin ? "9" : "8"}" class="muted">Ingen testlinjer enda.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  };

  const openUploadModal = () => {
    if (!isAdmin) {
      toast("Du må være admin for å gjøre dette.");
      return;
    }
    const modalHtml = renderModal(
      "Last opp manometer-sertifikat",
      `
        <div class="modalgrid">
          <div class="field" style="grid-column: 1 / -1;">
            <label>PDF</label>
            <input data-f="file" class="input" type="file" accept="application/pdf" />
          </div>
        </div>
      `,
      "Lagre"
    );
    const h = openModal(modalMount, modalHtml, signal);
    const save = modalSaveButton(h.root);
    save.addEventListener(
      "click",
      async () => {
        const file = qs<HTMLInputElement>(h.root, "[data-f=file]").files?.[0] ?? null;
        if (!file) return;
        const fileErr = validatePdfFile(file, 25);
        if (fileErr) {
          toast(fileErr);
          return;
        }
        save.disabled = true;
        save.textContent = "Lagrer...";
        try {
          meta = await upsertPressureGaugeCertificate(project.id, file);
          h.close();
          render();
        } catch (error: any) {
          console.error(error);
          toast(formatErrorMessage(error));
        } finally {
          save.disabled = false;
          save.textContent = "Lagre";
        }
      },
      { signal }
    );
  };

  const saveMeta = async () => {
    if (!isAdmin) {
      toast("Du må være admin for å gjøre dette.");
      return;
    }
    busy = true;
    render();
    try {
      const typeRaw = readText(mount, "[data-pt-meta='test_type']");
      const testType: PressureTestType = typeRaw === "leak" ? "leak" : "pressure";
      const patch = {
        test_type: testType,
        test_date: textOrNull(readText(mount, "[data-pt-meta='test_date']")),
        test_location: textOrNull(readText(mount, "[data-pt-meta='test_location']")),
        performed_by: textOrNull(readText(mount, "[data-pt-meta='performed_by']")),
        test_equipment: textOrNull(readText(mount, "[data-pt-meta='test_equipment']")),
        gauge_id: textOrNull(readText(mount, "[data-pt-meta='gauge_id']")),
        comments: textOrNull(readText(mount, "[data-pt-meta='comments']")),
      };
      meta = await saveProjectPressureTestMeta(project.id, patch);
      toast("Protokoll lagret.");
    } catch (error: any) {
      console.error(error);
      toast(formatErrorMessage(error));
    } finally {
      busy = false;
      render();
    }
  };

  const saveRow = async (rowId: string) => {
    if (!isAdmin) {
      toast("Du må være admin for å gjøre dette.");
      return;
    }
    const rowEl = mount.querySelector<HTMLElement>(`[data-pt-row-id="${rowId}"]`);
    if (!rowEl) return;
    try {
      await updateProjectPressureTestRow(rowId, {
        drawing_no: textOrNull(readText(rowEl, "[data-row-field='drawing_no']")),
        description: textOrNull(readText(rowEl, "[data-row-field='description']")),
        test_medium: textOrNull(readText(rowEl, "[data-row-field='test_medium']")),
        working_pressure: textOrNull(readText(rowEl, "[data-row-field='working_pressure']")),
        test_pressure: textOrNull(readText(rowEl, "[data-row-field='test_pressure']")),
        hold_time: textOrNull(readText(rowEl, "[data-row-field='hold_time']")),
        result: textOrNull(readText(rowEl, "[data-row-field='result']")),
      });
      await loadRowsOnly();
      render();
      toast("Rad lagret.");
    } catch (error: any) {
      console.error(error);
      toast(formatErrorMessage(error));
    }
  };

  mount.addEventListener(
    "click",
    async (event) => {
      const target = event.target as HTMLElement;

      const saveBtn = target.closest<HTMLElement>("[data-pt-save]");
      if (saveBtn) {
        await saveMeta();
        return;
      }

      const addRowBtn = target.closest<HTMLElement>("[data-pt-row-add]");
      if (addRowBtn) {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        try {
          await createProjectPressureTestRow({ project_id: project.id });
          await loadRowsOnly();
          render();
        } catch (error: any) {
          console.error(error);
          toast(formatErrorMessage(error));
        }
        return;
      }

      const add12Btn = target.closest<HTMLElement>("[data-pt-row-add-12]");
      if (add12Btn) {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        try {
          const added = await createProjectPressureTestRows({ project_id: project.id, count: 12 });
          await loadRowsOnly();
          render();
          toast(`La til ${added.count} rader (${added.firstLineNo}-${added.lastLineNo}).`);
        } catch (error: any) {
          console.error(error);
          toast(formatErrorMessage(error));
        }
        return;
      }

      const saveRowBtn = target.closest<HTMLElement>("[data-pt-row-save]");
      if (saveRowBtn) {
        const rowId = saveRowBtn.getAttribute("data-pt-row-save") || "";
        if (rowId) await saveRow(rowId);
        return;
      }

      const deleteRowBtn = target.closest<HTMLElement>("[data-pt-row-delete]");
      if (deleteRowBtn) {
        const rowId = deleteRowBtn.getAttribute("data-pt-row-delete") || "";
        if (!rowId) return;
        const row = rows.find((entry) => entry.id === rowId);
        const label = row ? `rad ${lineNo(row)}` : "rad";
        await openConfirmDelete(modalMount, signal, {
          title: "Slett testrad",
          messageHtml: `Slett ${esc(label)}?`,
          onConfirm: async () => deleteProjectPressureTestRow(rowId),
          onDone: async () => {
            await loadRowsOnly();
            render();
          },
        });
        return;
      }

      const openCertBtn = target.closest<HTMLElement>("[data-pt-cert-open]");
      if (openCertBtn) {
        const fileId = String(meta?.gauge_cert_file_id ?? "").trim();
        if (!fileId) return;
        try {
          const url = await createSignedUrlForFileRef(fileId, { expiresSeconds: 120 });
          const title = String(meta?.gauge_file?.label ?? "Manometer-sertifikat").trim() || "Manometer-sertifikat";
          openPdfPreview({ url, title });
        } catch (error: any) {
          console.error(error);
          toast(formatErrorMessage(error));
        }
        return;
      }

      const uploadCertBtn = target.closest<HTMLElement>("[data-pt-cert-upload]");
      if (uploadCertBtn) {
        openUploadModal();
        return;
      }

      const removeCertBtn = target.closest<HTMLElement>("[data-pt-cert-remove]");
      if (removeCertBtn) {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        await openConfirmDelete(modalMount, signal, {
          title: "Fjern manometer-sertifikat",
          messageHtml: "Fjern tilknyttet PDF-sertifikat?",
          onConfirm: async () => {
            await removePressureGaugeCertificate(project.id);
            meta = await fetchProjectPressureTest(project.id).then((bundle) => bundle.meta);
          },
          onDone: async () => {
            render();
          },
        });
      }
    },
    { signal }
  );

  mount.addEventListener(
    "change",
    async (event) => {
      const target = event.target as HTMLElement;
      if (!isAdmin) return;

      const resultField = target.closest<HTMLSelectElement>("[data-row-field='result']");
      if (!resultField) return;
      const row = resultField.closest<HTMLElement>("[data-pt-row-id]");
      const rowId = row?.getAttribute("data-pt-row-id") || "";
      if (!rowId) return;
      await saveRow(rowId);
    },
    { signal }
  );

  try {
    await loadAll();
    render();
    wireDatePickers(mount, signal);
  } catch (error: any) {
    console.error(error);
    mount.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">Trykk- og lekkasjetestprotokoll</div>
          <div class="panel-meta">Feil</div>
        </div>
        <div class="panel-body">
          <div class="err">${esc(formatErrorMessage(error))}</div>
        </div>
      </section>
    `;
    toast(formatErrorMessage(error));
    return;
  }

  if (!isAdmin) return;

  mount.addEventListener(
    "keydown",
    async (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      const row = event.target.closest<HTMLElement>("[data-pt-row-id]");
      if (!row) return;
      const rowId = row.getAttribute("data-pt-row-id") || "";
      if (!rowId) return;
      event.preventDefault();
      await saveRow(rowId);
    },
    { signal }
  );
}

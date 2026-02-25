import type { ProjectRow } from "../../../repo/projectRepo";

import { esc, qs } from "../../../utils/dom";
import { openConfirmDelete } from "../../../ui/confirm";
import { openModal, modalSaveButton, renderModal } from "../../../ui/modal";
import { toast } from "../../../ui/toast";
import { renderIconButton, iconSvg } from "../../../ui/iconButton";
import { fmtDate, truncateLabel, validatePdfFile } from "../../../utils/format";
import { createUuid } from "../../../utils/id";
import { createSignedUrlForFileRef } from "../../../repo/fileRepo";
import { PDFDocument } from "pdf-lib";
import { printPdfUrl, printBlobUrl } from "../../../utils/print";
import { openPdfPreview } from "../../../ui/pdfPreview";
import {
  createProjectDrawingWithFile,
  deleteProjectDrawing,
  fetchProjectDrawings,
  updateProjectDrawing,
  updateProjectDrawingFile,
} from "../../../repo/projectDrawingRepo";

export async function renderProjectDrawingsSection(opts: {
  app: HTMLElement;
  mount: HTMLElement;
  modalMount: HTMLElement;
  project: ProjectRow;
  isAdmin: boolean;
  signal: AbortSignal;
}) {
  const { app, mount, modalMount, project, isAdmin, signal } = opts;

  mount.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">Tegninger</div>
        <div class="panel-meta">Oversikt over tegninger tilhørende prosjekt.</div>
      </div>
      <div class="panel-body">
        <div class="table-scroll">
          <table class="data-table drawing-table drawing-table-list">
            <thead>
              <tr>
                <th>
                  ${isAdmin ? `<input type="checkbox" data-select-all />` : ""}
                </th>
                <th>Tegningsnr.</th>
                <th>Filnavn</th>
                <th>Dato</th>
                <th>Revisjon</th>
                <th class="drawing-actions-col"></th>
              </tr>
            </thead>
            <tbody data-drawings-body>
              <tr><td colspan="7" class="muted">Laster…</td></tr>
            </tbody>
          </table>
        </div>
        ${isAdmin ? `
          <div class="drawing-actions">
            <button data-drawing-print-selected class="btn small">
              ${iconSvg("print")}
              Skriv ut valgte
            </button>
            <button data-drawing-delete-selected class="btn small danger">Slett valgte</button>
          </div>
        ` : ""}
      </div>
    </section>
  `;

  const drawingsBody = qs<HTMLTableSectionElement>(mount, "[data-drawings-body]");
  const openUploadBtn = app.querySelector<HTMLButtonElement>("[data-open-drawing-upload]");
  const selectAll = mount.querySelector<HTMLInputElement>("[data-select-all]");
  const deleteSelectedBtn = mount.querySelector<HTMLButtonElement>("[data-drawing-delete-selected]");
  const printSelectedBtn = mount.querySelector<HTMLButtonElement>("[data-drawing-print-selected]");

  type Pending = { id: string; file: File; drawingNo: string; revision: string };
  let pending: Pending[] = [];
  let drawings: Awaited<ReturnType<typeof fetchProjectDrawings>> = [];
  let selected = new Set<string>();
  let loadSeq = 0;
  const printSelectedDefaultLabel = "Skriv ut valgte";

  const setPrintSelectedLabel = (label: string) => {
    if (!printSelectedBtn) return;
    printSelectedBtn.innerHTML = `${iconSvg("print")} ${label}`;
  };


const revisionClass = (rev: string) => {
  if (rev === "-") return "type-pill pill-neutral";

  if (!rev || rev.length === 0) return "type-pill pill-other";

  const letter = rev[0].toUpperCase();
  const num = letter.charCodeAt(0) - 64; // A = 1

  if (num >= 1 && num <= 10) {
    return `type-pill pill-${num}`;
  }

  return "type-pill pill-other";
};

  const renderPending = (targetBody: HTMLElement | null) => {
    if (!targetBody) return;
    if (pending.length === 0) {
      targetBody.innerHTML = `<tr><td colspan="4" class="muted">Ingen filer valgt.</td></tr>`;
      return;
    }
    targetBody.innerHTML = pending
      .map((p) => {
        return `
          <tr data-pending-id="${esc(p.id)}">
            <td data-label="Filnavn">${esc(p.file.name)}</td>
            <td data-label="Tegningsnr."><input class="input" data-field="drawingNo" value="${esc(p.drawingNo)}" /></td>
            <td data-label="Revisjon">
              <select class="select" data-field="revision">
                ${["-", "A", "B", "C", "D", "E", "F"]
                  .map((r) => `<option value="${r}"${p.revision === r ? " selected" : ""}>${r}</option>`)
                  .join("")}
              </select>
            </td>
            <td class="actcell"><button class="iconbtn danger" data-remove type="button">✕</button></td>
          </tr>
        `;
      })
      .join("");
  };

  const renderDrawings = () => {
    if (drawings.length === 0) {
      drawingsBody.innerHTML = `<tr><td colspan="7" class="muted">Ingen tegninger.</td></tr>`;
      if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = true;
        deleteSelectedBtn.style.display = "none";
      }
      if (printSelectedBtn) {
        printSelectedBtn.disabled = true;
        printSelectedBtn.style.display = "none";
      }
      if (selectAll) selectAll.checked = false;
      return;
    }

    drawingsBody.innerHTML = drawings
      .map((d) => {
        const fileLabel = d.file?.label ?? "Tegning";
        const truncatedFileLabel = truncateLabel(fileLabel, 60);
        const rev = (d.revision || "-").trim().toUpperCase() || "-";
        const revClass = revisionClass(rev);
        const checked = selected.has(d.id) ? "checked" : "";
        return `
          <tr>
            <td data-label="Valg">
              ${isAdmin ? `<input type="checkbox" data-select="${esc(d.id)}" ${checked} />` : ""}
            </td>
            <td data-label="Tegningsnr."><button title="${esc(fileLabel)}" class="type-pill pill-other linkbtn" data-openpdf="${esc(d.file_id)}">${esc(d.drawing_no)}</button></td>
            <td data-label="Filnavn">
              <button title="${esc(fileLabel)}" class="linkbtn" data-openpdf="${esc(d.file_id)}">${esc(truncatedFileLabel)}</button>
            </td>
            <td data-label="Dato">${esc(fmtDate(d.created_at))}</td>
            <td data-label="Rev"><span class="${revClass}" style="cursor: default;">${esc(rev)}</span></td>
            <td class="actcell drawing-actions-cell">
              ${renderIconButton({ dataKey: "print", id: d.id, title: "Skriv ut", icon: iconSvg("print") })}
              ${isAdmin ? renderIconButton({ dataKey: "edit", id: d.id, title: "Endre", icon: iconSvg("pencil") }) : ""}
              ${isAdmin ? renderIconButton({ dataKey: "del", id: d.id, title: "Slett", icon: iconSvg("trash"), danger: true }) : ""}
            </td>
          </tr>
        `;
      })
      .join("");

    if (deleteSelectedBtn) {
      const hasSelection = selected.size > 0;
      deleteSelectedBtn.disabled = !hasSelection;
      deleteSelectedBtn.style.display = hasSelection ? "" : "none";
    }
    if (printSelectedBtn) {
      const hasSelection = selected.size > 0;
      printSelectedBtn.disabled = !hasSelection;
      printSelectedBtn.style.display = hasSelection ? "" : "none";
    }
    if (selectAll) {
      selectAll.checked = selected.size > 0 && selected.size === drawings.length;
    }
  };

  const loadDrawings = async () => {
    const seq = ++loadSeq;
    drawingsBody.innerHTML = `<tr><td colspan="6" class="muted">Laster…</td></tr>`;
    try {
      const rows = await fetchProjectDrawings(project.id);
      if (seq !== loadSeq) return;
      drawings = rows;
      selected = new Set(Array.from(selected).filter((id) => drawings.some((d) => d.id === id)));
      renderDrawings();
    } catch (e: any) {
      console.error(e);
      drawingsBody.innerHTML = `<tr><td colspan="6" class="err">Feil: ${esc(String(e?.message ?? e))}</td></tr>`;
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      const base = f.name.replace(/\.[^/.]+$/, "");
      pending.push({
        id: createUuid(),
        file: f,
        drawingNo: base,
        revision: "A",
      });
    }
    renderPending(null);
  };

  const clearPending = () => {
    pending = [];
    renderPending(null);
  };

  const openUploadModal = () => {
    const modalHtml = renderModal(
      "Last opp tegninger",
      `
        <div class="drawing-upload">
          <div class="dropzone" data-drawing-dropzone>
            <div class="dropzone-title">Legg til filer</div>
            <div class="dropzone-sub">Dra og slipp PDF her, eller velg filer</div>
            <input class="input" data-drawing-files type="file" accept="application/pdf" multiple />
          </div>
          <div class="table-scroll drawing-pending">
            <table class="data-table drawing-table drawing-table-pending">
              <thead>
                <tr>
                  <th>Fil</th>
                  <th>Tegningsnr.</th>
                  <th>Rev</th>
                  <th></th>
                </tr>
              </thead>
              <tbody data-drawing-pending>
                <tr><td colspan="4" class="muted">Ingen filer valgt.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `,
      "Last opp"
    );

    const h = openModal(modalMount, modalHtml, signal);
    const pendingBody = qs<HTMLTableSectionElement>(h.root, "[data-drawing-pending]");
    const dropzone = qs<HTMLDivElement>(h.root, "[data-drawing-dropzone]");
    const fileInput = qs<HTMLInputElement>(h.root, "[data-drawing-files]");
    const saveBtn = modalSaveButton(h.root);

    renderPending(pendingBody);

    dropzone.addEventListener(
      "dragover",
      (e) => {
        e.preventDefault();
        dropzone.classList.add("is-drag");
      },
      { signal }
    );

    dropzone.addEventListener(
      "dragleave",
      () => {
        dropzone.classList.remove("is-drag");
      },
      { signal }
    );

    dropzone.addEventListener(
      "drop",
      (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-drag");
        const files = (e as DragEvent).dataTransfer?.files ?? null;
        if (!files || files.length === 0) {
          toast("Dra inn filer fra filsystem (Explorer). Outlook-støtte mangler.");
          return;
        }
        addFiles(files);
        renderPending(pendingBody);
      },
      { signal }
    );

    fileInput.addEventListener(
      "change",
      () => {
        addFiles(fileInput.files);
        fileInput.value = "";
        renderPending(pendingBody);
      },
      { signal }
    );

    pendingBody.addEventListener(
      "input",
      (e) => {
        const target = e.target as HTMLInputElement;
        const row = target.closest("[data-pending-id]") as HTMLElement | null;
        if (!row) return;
        const id = row.getAttribute("data-pending-id") || "";
        const item = pending.find((p) => p.id === id);
        if (!item) return;
        if (target.dataset.field === "drawingNo") item.drawingNo = target.value;
        if (target.dataset.field === "revision") item.revision = target.value;
      },
      { signal }
    );

    pendingBody.addEventListener(
      "click",
      (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-remove]")) return;
        const row = target.closest("[data-pending-id]") as HTMLElement | null;
        const id = row?.getAttribute("data-pending-id") || "";
        pending = pending.filter((p) => p.id !== id);
        renderPending(pendingBody);
      },
      { signal }
    );

    saveBtn.addEventListener(
      "click",
      async () => {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        if (pending.length === 0) return;

        const totalUploads = pending.length;
        let uploadIdx = 0;
        saveBtn.disabled = true;
        saveBtn.textContent = `Laster opp ${uploadIdx}/${totalUploads}…`;
        try {
          const duplicates = new Set<string>();
          const remaining: Pending[] = [];
          for (const p of pending) {
            uploadIdx += 1;
            saveBtn.textContent = `Laster opp ${uploadIdx}/${totalUploads}…`;
            const drawingNo = p.drawingNo.trim();
            const revision = (p.revision || "A").trim() || "A";
            if (!drawingNo) throw new Error("Tegningsnr kan ikke være tomt.");
            const err = validatePdfFile(p.file, 25);
            if (err) throw new Error(err);

            try {
              await createProjectDrawingWithFile({
                project_id: project.id,
                drawing_no: drawingNo,
                revision,
                file: p.file,
              });
            } catch (e: any) {
              const msg = String(e?.message ?? e);
              if (msg.toLowerCase().includes("finnes allerede i systemet")) {
                duplicates.add(p.file.name);
                remaining.push(p);
                continue;
              }
              throw e;
            }
          }
          pending = remaining;
          renderPending(pendingBody);

          if (duplicates.size > 0) {
            const list = Array.from(duplicates).join(", ");
            toast(`Følgende filer finnes allerede i systemet: ${list}`);
            return;
          }

          clearPending();
          h.close();
          await loadDrawings();
        } catch (e: any) {
          console.error(e);
          toast(String(e?.message ?? e));
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Last opp";
        }
      },
      { signal }
    );
  };

  if (openUploadBtn) {
    openUploadBtn.addEventListener(
      "click",
      () => {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        openUploadModal();
      },
      { signal }
    );
  }

  drawingsBody.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;
      const selectId = (target as HTMLInputElement).getAttribute?.("data-select");
      if (selectId && target instanceof HTMLInputElement) {
        if (target.checked) selected.add(selectId);
        else selected.delete(selectId);
        if (deleteSelectedBtn) {
          const hasSelection = selected.size > 0;
          deleteSelectedBtn.disabled = !hasSelection;
          deleteSelectedBtn.style.display = hasSelection ? "" : "none";
        }
        if (printSelectedBtn) {
          const hasSelection = selected.size > 0;
          printSelectedBtn.disabled = !hasSelection;
          printSelectedBtn.style.display = hasSelection ? "" : "none";
        }
        if (selectAll) selectAll.checked = selected.size > 0 && selected.size === drawings.length;
        return;
      }
      const openId = target.closest("[data-openpdf]")?.getAttribute("data-openpdf");
      if (openId) {
        const row = drawings.find((d) => d.file_id === openId);
        const label = row?.file?.label || row?.drawing_no || "Tegning";
        const url = await createSignedUrlForFileRef(openId, { expiresSeconds: 120 });
        openPdfPreview({ url, title: label });
        return;
      }

      const editId = target.closest("[data-edit]")?.getAttribute("data-edit");
      if (editId) {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        const row = drawings.find((d) => d.id === editId);
        if (!row) return;

        const modalHtml = renderModal(
          "Endre tegning",
          `
            <div class="modalgrid">
              <div class="field">
                <label>Tegningsnr</label>
                <input data-f="drawing_no" class="input" value="${esc(row.drawing_no)}" />
              </div>
              <div class="field">
                <label>Revisjon</label>
                <select data-f="revision" class="select">
                  ${["-", "A", "B", "C", "D", "E", "F"]
                    .map((r) => `<option value="${r}"${row.revision === r ? " selected" : ""}>${r}</option>`)
                    .join("")}
                </select>
              </div>
              <div class="field" style="grid-column:1 / -1;">
                <label>Erstatt fil (valgfritt)</label>
                <input class="input" data-f="file" type="file" accept="application/pdf" />
              </div>
            </div>
          `,
          "Oppdater"
        );

        const h = openModal(modalMount, modalHtml, signal);
        const save = modalSaveButton(h.root);
        save.addEventListener(
          "click",
          async () => {
            save.disabled = true;
            save.textContent = "Lagrer…";
            try {
              const drawingNo = (qs<HTMLInputElement>(h.root, "[data-f=drawing_no]").value || "").trim();
              const revision = (qs<HTMLInputElement>(h.root, "[data-f=revision]").value || "A").trim();
              const file = qs<HTMLInputElement>(h.root, "[data-f=file]").files?.[0] ?? null;

              if (!drawingNo) throw new Error("Tegningsnr kan ikke være tomt.");
              await updateProjectDrawing(row.id, { drawing_no: drawingNo, revision: revision || "A" });

              if (file && row.file_id) {
                const err = validatePdfFile(file, 25);
                if (err) throw new Error(err);
                await updateProjectDrawingFile(row.file_id, file);
              }

              h.close();
              await loadDrawings();
            } catch (e: any) {
              console.error(e);
              toast(String(e?.message ?? e));
              save.disabled = false;
              save.textContent = "Oppdater";
            }
          },
          { signal }
        );
        return;
      }

      const printId = target.closest("[data-print]")?.getAttribute("data-print");
      if (printId) {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        const row = drawings.find((d) => d.id === printId);
        if (!row?.file_id) return;
        try {
          const url = await createSignedUrlForFileRef(row.file_id, { expiresSeconds: 120 });
          await printPdfUrl(url);
        } catch (e: any) {
          console.error(e);
          toast(String(e?.message ?? e));
        }
        return;
      }

      const delId = target.closest("[data-del]")?.getAttribute("data-del");
      if (delId) {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        const row = drawings.find((d) => d.id === delId);
        if (!row) return;
        await openConfirmDelete(modalMount, signal, {
          title: "Slett tegning",
          messageHtml: `Slett ${esc(row.drawing_no)}?`,
          onConfirm: async () => deleteProjectDrawing(row.id, row.file_id),
          onDone: loadDrawings,
        });
      }
    },
    { signal }
  );

  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener(
      "click",
      async () => {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        if (selected.size === 0) return;

        const ids = Array.from(selected);
        await openConfirmDelete(modalMount, signal, {
          title: "Slett tegninger",
          messageHtml: `Slett ${ids.length} tegning(er)?`,
          onConfirm: async () => {
            for (const id of ids) {
              const row = drawings.find((d) => d.id === id);
              if (row) await deleteProjectDrawing(row.id, row.file_id);
            }
          },
          onDone: async () => {
            selected.clear();
            await loadDrawings();
          },
        });
      },
      { signal }
    );
  }

  if (printSelectedBtn) {
    printSelectedBtn.addEventListener(
      "click",
      async () => {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        if (selected.size === 0) return;

        const rows = Array.from(selected)
          .map((id) => drawings.find((d) => d.id === id))
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
        if (rows.length === 0) return;

        const totalPrints = rows.length;
        let printIdx = 0;
        printSelectedBtn.disabled = true;
        setPrintSelectedLabel(`Skriver ut ${printIdx}/${totalPrints}…`);

        const fetchArrayBuffer = async (url: string) => {
          const res = await fetch(url, { credentials: "omit" });
          if (!res.ok) throw new Error("Klarte ikke å hente PDF for utskrift.");
          return res.arrayBuffer();
        };

        try {
          const merged = await PDFDocument.create();
          for (const row of rows) {
            printIdx += 1;
            setPrintSelectedLabel(`Skriver ut ${printIdx}/${totalPrints}…`);
            if (!row.file_id) continue;
            const url = await createSignedUrlForFileRef(row.file_id, { expiresSeconds: 120 });
            const buffer = await fetchArrayBuffer(url);
            const doc = await PDFDocument.load(buffer);
            const pages = await merged.copyPages(doc, doc.getPageIndices());
            pages.forEach((p) => merged.addPage(p));
          }

          if (merged.getPageCount() === 0) {
            toast("Fant ingen PDF-er å skrive ut.");
            return;
          }

          const bytes = await merged.save();
          const safeBytes = new Uint8Array(bytes);
          const blobUrl = URL.createObjectURL(new Blob([safeBytes.buffer], { type: "application/pdf" }));
          await printBlobUrl(blobUrl, () => URL.revokeObjectURL(blobUrl));

        } catch (e: any) {
          console.error(e);
          toast(String(e?.message ?? e));
        } finally {
          setPrintSelectedLabel(printSelectedDefaultLabel);
          printSelectedBtn.disabled = selected.size === 0;
        }
      },
      { signal }
    );
  }

  mount.addEventListener(
    "change",
    (e) => {
      const target = e.target as HTMLInputElement;
      if (!target || !target.matches("[data-select-all]")) return;
      if (target.checked) {
        selected = new Set(drawings.map((d) => d.id));
      } else {
        selected.clear();
      }
      renderDrawings();
    },
    { signal }
  );

  await loadDrawings();
}

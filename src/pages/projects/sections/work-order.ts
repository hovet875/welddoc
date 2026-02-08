import type { ProjectRow } from "../../../repo/projectRepo";

import { esc, qs } from "../../../utils/dom";
import { openConfirmDelete } from "../../../ui/confirm";
import { openModal, modalSaveButton, renderModal } from "../../../ui/modal";
import { toast } from "../../../ui/toast";
import { printPdfUrl } from "../../../utils/print";
import { iconSvg } from "../../../ui/iconButton";
import { createSignedUrlForFileRef } from "../../../repo/fileRepo";
import { fmtDate, validatePdfFile } from "../../../utils/format";
import {
  deleteProjectWorkOrder,
  fetchProjectWorkOrder,
  openProjectWorkOrderPdf,
  upsertProjectWorkOrder,
} from "../../../repo/projectWorkOrderRepo";

export async function renderProjectWorkOrderSection(opts: {
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
        <div class="panel-title">Arbeidsordre</div>
        <div class="panel-meta">Én PDF per prosjekt.</div>
      </div>
      <div class="panel-body">
        <div data-workorder-body></div>
      </div>
    </section>
  `;

  const body = qs<HTMLDivElement>(mount, "[data-workorder-body]");
  const openUploadBtn = app.querySelector<HTMLButtonElement>("[data-open-workorder-upload]");

  const formatSize = (bytes?: number | null) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  let current = await fetchProjectWorkOrder(project.id);

  const render = () => {
    if (!current) {
      body.innerHTML = `
        <div class="workorder-empty">
          <div>
            <div class="workorder-title">Ingen arbeidsordre lastet opp.</div>
            <div class="workorder-meta">Last opp PDF for arbeidsordre når den er klar.</div>
          </div>
          ${isAdmin ? `<button class="btn accent small" data-workorder-upload>Last opp</button>` : ""}
        </div>
      `;
      return;
    }

    const label = current.file?.label ?? "Arbeidsordre.pdf";
    const metaParts = [
      fmtDate(current.created_at),
      current.file?.size_bytes != null ? formatSize(current.file.size_bytes) : "",
    ].filter(Boolean);

    body.innerHTML = `
      <div class="workorder-card">
        <div>
          <div class="workorder-title">${esc(label)}</div>
          <div class="workorder-meta">${esc(metaParts.join(" · "))}</div>
        </div>
        <div class="workorder-actions">
          <button class="btn small" data-workorder-print>${iconSvg("print")}</button>
          <button class="btn small" data-workorder-open>Åpne</button>
          ${isAdmin ? `<button class="btn small" data-workorder-replace>Erstatt fil</button>` : ""}
          ${isAdmin ? `<button class="btn small danger" data-workorder-delete>Slett</button>` : ""}
        </div>
      </div>
    `;
  };

  const openUploadModal = (title: string) => {
    const modalHtml = renderModal(
      title,
      `
        <div class="modalgrid">
          <div class="field" style="grid-column:1 / -1;">
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
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        const file = qs<HTMLInputElement>(h.root, "[data-f=file]").files?.[0] ?? null;
        if (!file) return;
        const err = validatePdfFile(file, 25);
        if (err) {
          toast(err);
          return;
        }

        save.disabled = true;
        save.textContent = "Lagrer…";
        try {
          current = await upsertProjectWorkOrder(project.id, file);
          h.close();
          render();
        } catch (e: any) {
          console.error(e);
          toast(String(e?.message ?? e));
        } finally {
          save.disabled = false;
          save.textContent = "Lagre";
        }
      },
      { signal }
    );
  };

  body.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-workorder-upload]")) {
        openUploadModal("Last opp arbeidsordre");
        return;
      }
      if (target.closest("[data-workorder-open]")) {
        if (current?.file_id) await openProjectWorkOrderPdf(current.file_id);
        return;
      }
      if (target.closest("[data-workorder-print]")) {
        if (!current?.file_id) return;
        try {
          const url = await createSignedUrlForFileRef(current.file_id, { expiresSeconds: 120 });
          await printPdfUrl(url);
        } catch (e: any) {
          console.error(e);
          toast(String(e?.message ?? e));
        }
        return;
      }
      if (target.closest("[data-workorder-replace]")) {
        openUploadModal("Bytt arbeidsordre");
        return;
      }
      if (target.closest("[data-workorder-delete]")) {
        if (!current?.file_id) return;
        await openConfirmDelete(modalMount, signal, {
          title: "Slett arbeidsordre",
          messageHtml: `Slett ${esc(current.file?.label ?? "Arbeidsordre")}?`,
          onConfirm: async () => deleteProjectWorkOrder(project.id, current!.file_id),
          onDone: async () => {
            current = await fetchProjectWorkOrder(project.id);
            render();
          },
        });
      }
    },
    { signal }
  );

  if (openUploadBtn) {
    openUploadBtn.addEventListener(
      "click",
      () => {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        openUploadModal(current ? "Bytt arbeidsordre" : "Last opp arbeidsordre");
      },
      { signal }
    );
  }

  render();
}

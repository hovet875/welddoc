import { openModal, modalSaveButton, renderModal } from "./modal";

function disableSave(btn: HTMLButtonElement, text: string) {
  btn.disabled = true;
  btn.textContent = text;
}
function enableSave(btn: HTMLButtonElement, text: string) {
  btn.disabled = false;
  btn.textContent = text;
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

export async function openConfirm(
  mount: HTMLElement,
  signal: AbortSignal,
  opts: {
    title: string;
    messageHtml: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void>;
    onDone?: () => Promise<void>;
  }
) {
  const modalHtml = renderModal(
    opts.title,
    `
      <div style="display:grid; gap:10px;">
        <div>${opts.messageHtml}</div>
      </div>
    `,
    opts.confirmLabel ?? "Bekreft"
  );

  const h = openModal(mount, modalHtml, signal);
  const save = modalSaveButton(h.root);

  save.addEventListener(
    "click",
    async () => {
      disableSave(save, "Utfører…");
      try {
        await opts.onConfirm();
        h.close();
        if (opts.onDone) await opts.onDone();
      } catch (e: any) {
        console.error(e);
        alert(`Feil: ${String(e?.message ?? e)}`);
        enableSave(save, opts.confirmLabel ?? "Bekreft");
      }
    },
    { signal }
  );
}

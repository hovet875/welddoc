import { esc, qs } from "../utils/dom";

export type ModalHandle = {
  close: () => void;
  root: HTMLElement;
};

let openModalCount = 0;

function lockBodyForModal() {
  openModalCount += 1;
  document.body.classList.add("has-modal-open");
}

function unlockBodyForModal() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    document.body.classList.remove("has-modal-open");
  }
}

export function renderModal(title: string, bodyHtml: string, saveLabel = "Lagre") {
  return `
    <div class="modalbackdrop" data-modal-backdrop>
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modalhead">
          <div class="modaltitle">${esc(title)}</div>
        </div>
        <div class="modalbody">${bodyHtml}</div>
        <div class="modalftr">
          <button class="btn" data-modal-cancel>Avbryt</button>
          <button class="btn accent" data-modal-save>${esc(saveLabel)}</button>
        </div>
      </div>
    </div>
  `;
}

export function openModal(mount: HTMLElement, html: string, signal: AbortSignal): ModalHandle {
  // Keep API stable: `mount` is intentionally unused after we moved to a body portal.
  void mount;

  const portal = document.createElement("div");
  portal.className = "modalportal";
  portal.innerHTML = html;
  document.body.appendChild(portal);
  lockBodyForModal();

  const backdrop = qs<HTMLElement>(portal, "[data-modal-backdrop]");
  const modal = qs<HTMLElement>(portal, ".modal");
  const cancel = qs<HTMLButtonElement>(portal, "[data-modal-cancel]");
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    portal.remove();
    unlockBodyForModal();
  };

  signal.addEventListener("abort", close, { once: true });

  cancel.addEventListener("click", close, { signal });

  backdrop.addEventListener(
    "click",
    (e) => {
      if (e.target === backdrop) close();
    },
    { signal }
  );

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") close();
    },
    { signal }
  );

  return { close, root: modal };
}

export function modalSaveButton(modalRoot: HTMLElement) {
  return qs<HTMLButtonElement>(modalRoot, "[data-modal-save]");
}

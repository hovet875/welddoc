import { esc, qs } from "../utils/dom";

export type ModalHandle = {
  close: () => void;
  root: HTMLElement;
};

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
  mount.innerHTML = html;

  const backdrop = qs<HTMLElement>(mount, "[data-modal-backdrop]");
  const modal = qs<HTMLElement>(mount, ".modal");
  const cancel = qs<HTMLButtonElement>(mount, "[data-modal-cancel]");

  const close = () => (mount.innerHTML = "");

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

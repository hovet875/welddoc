import { esc, qs } from "../utils/dom";

type PdfPreviewOptions = {
  url: string;
  title?: string | null;
  signal?: AbortSignal;
};

type PdfPreviewHandle = {
  close: () => void;
  root: HTMLElement;
};

export function openPdfPreview(opts: PdfPreviewOptions): PdfPreviewHandle {
  const mount = document.createElement("div");
  mount.className = "pdfpreview-mount";
  document.body.appendChild(mount);

  const title = (opts.title || "PDF").trim() || "PDF";

  mount.innerHTML = `
    <div class="modalbackdrop pdfpreview-backdrop" data-pdf-backdrop>
      <div class="modal pdfpreview-modal" role="dialog" aria-modal="true">
        <div class="modalhead">
          <div class="modaltitle">${esc(title)}</div>
          <button class="xbtn" type="button" data-pdf-close>Lukk</button>
        </div>
        <div class="modalbody pdfpreview-body">
          <iframe class="pdfpreview-frame" src="${esc(opts.url)}" title="${esc(title)}"></iframe>
        </div>
      </div>
    </div>
  `;

  const backdrop = qs<HTMLElement>(mount, "[data-pdf-backdrop]");
  const closeBtn = qs<HTMLButtonElement>(mount, "[data-pdf-close]");
  const root = qs<HTMLElement>(mount, ".modal");

  const close = () => {
    mount.remove();
    window.removeEventListener("keydown", onKey);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };

  closeBtn.addEventListener("click", close, opts.signal ? { signal: opts.signal } : undefined);
  backdrop.addEventListener(
    "click",
    (e) => {
      if (e.target === backdrop) close();
    },
    opts.signal ? { signal: opts.signal } : undefined
  );
  window.addEventListener("keydown", onKey);

  if (opts.signal) {
    opts.signal.addEventListener("abort", close, { once: true });
  }

  return { close, root };
}

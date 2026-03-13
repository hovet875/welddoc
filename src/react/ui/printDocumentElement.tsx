import type { ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { cloneDocumentStyles, waitForImages, waitForNextPaint } from "./documentWindowSupport";

type PrintDocumentElementArgs = {
  title: string;
  element: ReactElement;
};

export async function printDocumentElement({ title, element }: PrintDocumentElementArgs) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "1280px";
  iframe.style.height = "900px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const targetWindow = iframe.contentWindow;
  const targetDocument = iframe.contentDocument;
  if (!targetWindow || !targetDocument) {
    iframe.remove();
    throw new Error("Klarte ikke å opprette utskriftsvindu.");
  }

  targetDocument.open();
  targetDocument.write(
    `<!DOCTYPE html><html><head><title>${title}</title></head><body class="document-window-body"><div id="document-window-root" class="document-window-root"></div></body></html>`
  );
  targetDocument.close();
  await cloneDocumentStyles(targetDocument);

  const scheme = document.documentElement.getAttribute("data-mantine-color-scheme");
  if (scheme) {
    targetDocument.documentElement.setAttribute("data-mantine-color-scheme", scheme);
  }

  const mountNode = targetDocument.getElementById("document-window-root");
  if (!mountNode) {
    iframe.remove();
    throw new Error("Klarte ikke å opprette utskriftsinnhold.");
  }

  const root = createRoot(mountNode);
  flushSync(() => {
    root.render(element);
  });

  await waitForImages(targetDocument);
  await waitForNextPaint(targetWindow);

  await new Promise<void>((resolve) => {
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      root.unmount();
      iframe.remove();
      resolve();
    };

    targetWindow.addEventListener("afterprint", cleanup, { once: true });
    targetWindow.focus();
    targetWindow.print();

    window.setTimeout(cleanup, 60000);
  });
}

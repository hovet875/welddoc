import type { ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { cloneDocumentStyles, waitForImages, waitForNextPaint } from "./documentWindowSupport";

type OpenDocumentWindowArgs = {
  title: string;
  element: ReactElement;
  autoPrint?: boolean;
  closeAfterPrint?: boolean;
};

export async function openDocumentWindow({ title, element, autoPrint = false, closeAfterPrint = false }: OpenDocumentWindowArgs) {
  const popup = window.open("", "_blank", "width=1280,height=900");
  if (!popup) {
    throw new Error("Nettleseren blokkerte dokumentvinduet. Tillat popup-vinduer og prov igjen.");
  }

  popup.document.open();
  popup.document.write(`<!DOCTYPE html><html><head><title>${title}</title></head><body class="document-window-body"><div id="document-window-root" class="document-window-root"></div></body></html>`);
  popup.document.close();
  await cloneDocumentStyles(popup.document);

  const scheme = document.documentElement.getAttribute("data-mantine-color-scheme");
  if (scheme) {
    popup.document.documentElement.setAttribute("data-mantine-color-scheme", scheme);
  }

  const mountNode = popup.document.getElementById("document-window-root");
  if (!mountNode) {
    popup.close();
    throw new Error("Klarte ikke å opprette dokumentvindu.");
  }

  const root = createRoot(mountNode);
  flushSync(() => {
    root.render(element);
  });

  popup.addEventListener(
    "beforeunload",
    () => {
      root.unmount();
    },
    { once: true }
  );

  popup.focus();

  if (autoPrint) {
    void (async () => {
      await waitForImages(popup.document);
      await waitForNextPaint(popup);

      if (closeAfterPrint) {
        popup.addEventListener(
          "afterprint",
          () => {
            popup.close();
          },
          { once: true }
        );
      }

      popup.focus();
      popup.print();
    })();
  }

  return popup;
}

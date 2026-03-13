function waitForStylesheets(targetDocument: Document) {
  const links = Array.from(targetDocument.head.querySelectorAll('link[rel="stylesheet"]'));
  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          const stylesheet = link as HTMLLinkElement;
          if (stylesheet.sheet) {
            resolve();
            return;
          }

          const cleanup = () => {
            stylesheet.removeEventListener("load", handleLoad);
            stylesheet.removeEventListener("error", handleError);
          };

          const handleLoad = () => {
            cleanup();
            resolve();
          };

          const handleError = () => {
            cleanup();
            resolve();
          };

          stylesheet.addEventListener("load", handleLoad, { once: true });
          stylesheet.addEventListener("error", handleError, { once: true });
        })
    )
  );
}

function waitForFonts(targetDocument: Document) {
  if (!("fonts" in targetDocument)) {
    return Promise.resolve();
  }

  return (targetDocument as Document & { fonts: FontFaceSet }).fonts.ready.catch(() => undefined);
}

export async function cloneDocumentStyles(targetDocument: Document) {
  const headNodes = document.head.querySelectorAll('style, link[rel="stylesheet"]');
  headNodes.forEach((node) => {
    targetDocument.head.appendChild(node.cloneNode(true));
  });

  await waitForStylesheets(targetDocument);
  await waitForFonts(targetDocument);
}

const DEFAULT_IMAGE_TIMEOUT_MS = 15000;

function waitForSingleImage(targetDocument: Document, image: HTMLImageElement, timeoutMs: number) {
  if (image.complete) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const timerHost = targetDocument.defaultView ?? window;
    let settled = false;
    let timerId: number | null = null;

    const cleanup = () => {
      image.removeEventListener("load", handleDone);
      image.removeEventListener("error", handleDone);
      if (timerId !== null) {
        timerHost.clearTimeout(timerId);
      }
    };

    const handleDone = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    image.addEventListener("load", handleDone, { once: true });
    image.addEventListener("error", handleDone, { once: true });

    if (timeoutMs > 0) {
      timerId = timerHost.setTimeout(handleDone, timeoutMs);
    }
  });
}

export function waitForImages(targetDocument: Document, options: { timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS;

  return Promise.all(
    Array.from(targetDocument.images).map((image) => {
      return waitForSingleImage(targetDocument, image, timeoutMs);
    })
  );
}

export function waitForNextPaint(targetWindow: Window) {
  return new Promise<void>((resolve) => {
    targetWindow.requestAnimationFrame(() => {
      targetWindow.requestAnimationFrame(() => resolve());
    });
  });
}

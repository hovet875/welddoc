function isIosDevice() {
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs = /Macintosh/.test(ua) && "ontouchend" in document;
  return isAppleMobile || isIpadOs;
}

function printWithIframe(url: string, onCleanup?: () => void) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  const cleanup = () => {
    iframe.remove();
    if (onCleanup) onCleanup();
  };

  window.addEventListener("afterprint", cleanup, { once: true });

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
      cleanup();
    }
  };

  iframe.src = url;
  document.body.appendChild(iframe);

  setTimeout(cleanup, 15000);
}

export async function printBlobUrl(url: string, onCleanup?: () => void) {
  if (isIosDevice()) {
    window.open(url, "_blank", "noopener,noreferrer");
    if (onCleanup) setTimeout(onCleanup, 30000);
    return;
  }
  printWithIframe(url, onCleanup);
}

export async function printPdfUrl(url: string) {
  if (isIosDevice()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error("Klarte ikke å hente PDF for utskrift.");
  const buffer = await res.arrayBuffer();
  const blobUrl = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));

  printWithIframe(blobUrl, () => URL.revokeObjectURL(blobUrl));
}

import "./styles/index.css";
import { formatErrorMessage } from "./utils/error";

function fatal(err: unknown) {
  const base = formatErrorMessage(err, "Ukjent feil");
  const stack = err instanceof Error ? `\n\n${err.stack ?? ""}` : "";
  const msg = `${base}${stack}`;
  document.body.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">FATAL:\n${msg}</pre>`;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  });
}

try {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("Missing #app in index.html");

  window.addEventListener("error", (e) => {
    const reason = (e as any).error ?? (e as any).message;
    app.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">ERROR:\n${formatErrorMessage(reason)}</pre>`;
  });

  window.addEventListener("unhandledrejection", (e: any) => {
    app.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">PROMISE ERROR:\n${formatErrorMessage(
      e.reason
    )}</pre>`;
  });

  registerServiceWorker();

  const { mountReactApp } = await import("./react/app/mount");
  mountReactApp(app);
} catch (err) {
  fatal(err);
}

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/dropzone/styles.css";
import "./styles/index.css";
import { formatErrorMessage } from "./utils/error";

const IS_DEV = Boolean(import.meta.env.DEV);

function fatal(err: unknown) {
  const base = formatErrorMessage(err, "Ukjent feil");
  const stack = err instanceof Error ? `\n\n${err.stack ?? ""}` : "";
  const msg = `${base}${stack}`;
  document.body.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">FATAL:\n${msg}</pre>`;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (IS_DEV) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
    });
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  });
}

const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS kan rapportere som Mac
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

if (isIOS) {
  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );

  // ekstra for eldre Safari-varianter
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
  document.addEventListener("gestureend", (e) => e.preventDefault());
}

try {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("Missing #app in index.html");

  if (!IS_DEV) {
    window.addEventListener("error", (e) => {
      const reason = (e as any).error ?? (e as any).message;
      app.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">ERROR:\n${formatErrorMessage(reason)}</pre>`;
    });

    window.addEventListener("unhandledrejection", (e: any) => {
      app.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">PROMISE ERROR:\n${formatErrorMessage(
        e.reason
      )}</pre>`;
    });
  }

  registerServiceWorker();

  const { mountReactApp } = await import("./react/app/mount");
  document.getElementById("boot-loader")?.remove();
  mountReactApp(app);
} catch (err) {
  fatal(err);
}

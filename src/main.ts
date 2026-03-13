import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/dropzone/styles.css";
import "./styles/index.css";
import { registerSW } from "virtual:pwa-register";
import { ROUTES } from "./react/router/routes";
import { formatErrorMessage } from "./utils/error";
import { PWA_NEED_REFRESH_EVENT, PWA_OFFLINE_READY_EVENT } from "./pwa/events";

const IS_DEV = Boolean(import.meta.env.DEV);
const IGNORED_BOOT_ERROR_PATTERNS = [
  /resizeobserver loop (completed with undelivered notifications|limit exceeded)/i,
  /message channel closed before a response was received/i,
  /listener indicated an asynchronous response by returning true/i,
  /navigation preload request was cancelled before 'preloadresponse' settled/i,
];

function fatal(err: unknown) {
  const base = formatErrorMessage(err, "Ukjent feil");
  const stack = err instanceof Error ? `\n\n${err.stack ?? ""}` : "";
  const msg = `${base}${stack}`;
  document.body.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">FATAL:\n${msg}</pre>`;
}

function shouldIgnoreBootError(reason: unknown) {
  const message = formatErrorMessage(reason, "").trim();
  if (!message) return false;
  return IGNORED_BOOT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function normalizeAppPath(pathname: string) {
  const normalizedPath = String(pathname || "/").trim() || "/";
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

  if (basePath !== "/" && normalizedPath.startsWith(basePath)) {
    const trimmedPath = normalizedPath.slice(basePath.length);
    return trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
  }

  return normalizedPath;
}

function isWorkerDocumentPackageRenderPath(pathname: string) {
  return normalizeAppPath(pathname) === ROUTES.workerDocumentPackageRender;
}

function installBootErrorScreen(app: HTMLDivElement) {
  if (IS_DEV) return () => undefined;

  const renderError = (title: string, reason: unknown) => {
    if (shouldIgnoreBootError(reason)) return;
    app.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">${title}:\n${formatErrorMessage(reason)}</pre>`;
  };

  const onError = (event: ErrorEvent) => {
    renderError("ERROR", (event as any).error ?? event.message);
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    renderError("PROMISE ERROR", event.reason);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
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
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        window.dispatchEvent(
          new CustomEvent(PWA_NEED_REFRESH_EVENT, {
            detail: { updateServiceWorker },
          })
        );
      },
      onOfflineReady() {
        window.dispatchEvent(new Event(PWA_OFFLINE_READY_EVENT));
      },
      onRegisterError(error) {
        console.warn("Service worker registration failed", error);
      },
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

  const removeBootErrorScreen = installBootErrorScreen(app);

  try {
    const isWorkerRenderRoute = isWorkerDocumentPackageRenderPath(window.location.pathname);

    if (!isWorkerRenderRoute) {
      registerServiceWorker();

      const { preloadRouteForPath } = await import("./react/router/routePreload");
      void preloadRouteForPath(window.location.pathname);
    }

    document.getElementById("boot-loader")?.remove();

    if (isWorkerRenderRoute) {
      const { mountWorkerDocumentPackageRenderApp } = await import("./react/app/mountWorkerDocumentPackageRenderApp");
      mountWorkerDocumentPackageRenderApp(app);
    } else {
      const { mountReactApp } = await import("./react/app/mount");
      mountReactApp(app);
    }
  } finally {
    removeBootErrorScreen();
  }
} catch (err) {
  fatal(err);
}

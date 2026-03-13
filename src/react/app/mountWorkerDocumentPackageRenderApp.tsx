import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { WorkerDocumentPackageRenderPage } from "@/react/features/worker/WorkerDocumentPackageRenderPage";
import {
  clearDocumentPackageRenderStatus,
  setDocumentPackageRenderStatus,
} from "@/react/features/worker/documentPackageRenderRuntime";
import { mantineTheme } from "../ui/mantineTheme";
import { ReactErrorBoundary } from "./ReactErrorBoundary";

const SCHEME = "dark" as const;

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Ukjent renderfeil.";
}

function installWorkerRuntimeErrorHandlers() {
  const onError = (event: ErrorEvent) => {
    setDocumentPackageRenderStatus("error", readErrorMessage((event as ErrorEvent & { error?: unknown }).error ?? event.message));
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    setDocumentPackageRenderStatus("error", readErrorMessage(event.reason));
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}

export function mountWorkerDocumentPackageRenderApp(host: HTMLElement) {
  host.classList.add("react-root");
  document.documentElement.setAttribute("data-mantine-color-scheme", SCHEME);
  host.setAttribute("data-mantine-color-scheme", SCHEME);

  const removeWorkerRuntimeErrorHandlers = installWorkerRuntimeErrorHandlers();
  const root = createRoot(host);

  root.render(
    <StrictMode>
      <MantineProvider theme={mantineTheme} forceColorScheme={SCHEME} cssVariablesSelector=".react-root">
        <ReactErrorBoundary onError={(error) => setDocumentPackageRenderStatus("error", readErrorMessage(error))}>
          <WorkerDocumentPackageRenderPage />
        </ReactErrorBoundary>
      </MantineProvider>
    </StrictMode>
  );

  return () => {
    removeWorkerRuntimeErrorHandlers();
    clearDocumentPackageRenderStatus();
    root.unmount();
  };
}
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ReactApp } from "./App";
import { ReactErrorBoundary } from "./ReactErrorBoundary";
import { PwaUpdateNotifier } from "./PwaUpdateNotifier";
import { MantineProvider } from "@mantine/core";
import { mantineTheme } from "../ui/mantineTheme";
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";

const SCHEME = "dark" as const;
const APP_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export function mountReactApp(host: HTMLElement) {
  host.classList.add("react-root");
  document.documentElement.setAttribute("data-mantine-color-scheme", SCHEME);
  host.setAttribute("data-mantine-color-scheme", SCHEME);

  const root = createRoot(host);
  root.render(
    <StrictMode>
      <MantineProvider theme={mantineTheme} forceColorScheme={SCHEME} cssVariablesSelector=".react-root">
        <Notifications position="top-right" zIndex={10000} limit={4} />
        <PwaUpdateNotifier />
        <ReactErrorBoundary>
          <BrowserRouter basename={APP_BASENAME}>
            <ReactApp />
          </BrowserRouter>
        </ReactErrorBoundary>
      </MantineProvider>
    </StrictMode>
  );

  return () => root.unmount();
}

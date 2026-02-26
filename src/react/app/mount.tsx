import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ReactApp } from "./App";

export function mountReactApp(host: HTMLElement) {
  const root = createRoot(host);
  root.render(
    <StrictMode>
      <HashRouter>
        <ReactApp />
      </HashRouter>
    </StrictMode>
  );

  return () => {
    root.unmount();
  };
}

import "./styles/index.css";

function fatal(err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err);
  document.body.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">FATAL:\n${msg}</pre>`;
}

try {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("Missing #app in index.html");

  // Først etter vi vet at app finnes:
  window.addEventListener("error", (e) => {
    app.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">ERROR:\n${String(
      (e as any).error || (e as any).message
    )}</pre>`;
  });

  window.addEventListener("unhandledrejection", (e: any) => {
    app.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">PROMISE ERROR:\n${String(
      e.reason
    )}</pre>`;
  });

  // IMPORTS etter at app finnes (viktig ved debugging)
  const { getSession } = await import("./app/auth");
  const { renderLogin } = await import("./pages/login");
  const { renderHome } = await import("./pages/home");
  const { renderWpsPage } = await import("./pages/wps");
  const { renderCertsPage } = await import("./pages/certs");

  function getRoute() {
    const h = location.hash || "#/";
    return h.replace(/^#/, "");
  }

  let currentUnmount: null | (() => void) = null;
  let navSeq = 0;

  async function renderRoute() {
    const seq = ++navSeq;

    try {
      currentUnmount?.();
    } catch {}
    currentUnmount = null;

    app.innerHTML = `<div style="padding:16px" class="muted">Laster…</div>`;

    const session = await getSession();
    if (seq !== navSeq) return;

    if (!session) {
      currentUnmount = (renderLogin as any)(app) ?? null;
      return;
    }

    if (!location.hash || location.hash === "#") {
      location.hash = "#/";
      return;
    }

    const route = getRoute();

    switch (route) {
      case "/":
        currentUnmount = (renderHome as any)(app) ?? null;
        break;

      case "/wps":
        currentUnmount = renderWpsPage(app) ?? null;
        break;

      case "/certs":
        currentUnmount = renderCertsPage(app) ?? null;
        break;

      default:
        currentUnmount = (renderHome as any)(app) ?? null;
        break;
    }
  }

  window.addEventListener("hashchange", renderRoute);
  renderRoute();
} catch (err) {
  fatal(err);
}

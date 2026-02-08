import "./styles/index.css";

function fatal(err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err);
  document.body.innerHTML = `<pre style="padding:16px;white-space:pre-wrap">FATAL:\n${msg}</pre>`;
}

try {
  const appEl = document.querySelector<HTMLDivElement>("#app");
  if (!appEl) throw new Error("Missing #app in index.html");

  let app: HTMLDivElement = appEl;

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
  const { getSession, getProfileAccess, signOut } = await import("./app/auth");
  const { renderLogin } = await import("./pages/login");
  const { renderHome } = await import("./pages/home");
  const { renderWpsPage } = await import("./pages/wps");
  const { renderCertsPage } = await import("./pages/certs");
  const { renderSettingsPage } = await import("./pages/settings");
  const { renderUsersPage } = await import("./pages/users");
  const { renderCompanySettingsPage } = await import("./pages/company-settings");
  const { renderCompanySettingsOrganization } = await import("./pages/company-settings/organization");
  const { renderCompanySettingsWelding } = await import("./pages/company-settings/welding");
  const { renderCompanySettingsSystem } = await import("./pages/company-settings/system");
  const { renderNdtPage } = await import("./pages/ndt");
  const { renderProjectsPage } = await import("./pages/projects");
  const { renderProjectDetail } = await import("./pages/projects/detail");
  const { renderMaterialCertsPage } = await import("./pages/material-certs");




  // Global logout handler - works on all pages
  document.addEventListener("click", async (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === "logout" || target.closest("#logout")) {
      await signOut();
      location.reload();
    }
  });

  function getRoute() {
    const h = location.hash || "#/";
    return h.replace(/^#/, "");
  }

  let currentUnmount: null | (() => void) = null;
  let navSeq = 0;

  const resetAppRoot = () => {
    const nextApp = app.cloneNode(false) as HTMLDivElement;
    app.replaceWith(nextApp);
    app = nextApp;
  };

  async function renderRoute() {
    const seq = ++navSeq;

    try {
      currentUnmount?.();
    } catch {}
    currentUnmount = null;
    resetAppRoot();

    let showLoader = true;
    const loaderTimer = window.setTimeout(() => {
      if (seq !== navSeq || !showLoader) return;
      app.innerHTML = `<div style="padding:16px" class="muted">Laster…</div>`;
    }, 180);

    const route = getRoute();

    let session = null;
    try {
      session = await getSession();
    } catch (err) {
      console.warn("getSession failed, treating as logged out", err);
      session = null;
    }
    showLoader = false;
    window.clearTimeout(loaderTimer);
    if (seq !== navSeq) return;

    if (!session) {
      currentUnmount = (renderLogin as any)(app) ?? null;
      return;
    }

    try {
      const access = await getProfileAccess(session.user);
      if (!access.loginEnabled) {
        try {
          await signOut();
        } catch {}
        currentUnmount = (renderLogin as any)(app) ?? null;
        const err = app.querySelector<HTMLElement>("#err");
        if (err) err.textContent = "Tilgangen din er deaktivert. Kontakt admin.";
        return;
      }
    } catch (err) {
      console.warn("Profile access check failed", err);
    }

    if (!location.hash || location.hash === "#") {
      location.hash = "#/";
      return;
    }

    switch (route) {
      case "/":
        await renderHome(app);
        currentUnmount = null;
        break;

      case "/prosjekter":
        await renderProjectsPage(app);
        currentUnmount = null;
        break;

      case "/wps":
        await renderWpsPage(app);
        currentUnmount = null;
        break;

      case "/certs":
        await renderCertsPage(app);
        currentUnmount = null;
        break;

      case "/ndt":
        await renderNdtPage(app);
        currentUnmount = null;
        break;

      case "/materialsertifikater":
        await renderMaterialCertsPage(app);
        currentUnmount = null;
        break;

      case "/settings":
        await renderSettingsPage(app);
        currentUnmount = null;
        break;

      case "/users":
        await renderUsersPage(app);
        currentUnmount = null;
        break;

      case "/company-settings":
        await renderCompanySettingsPage(app);
        currentUnmount = null;
        break;

      case "/company-settings/organization":
        await renderCompanySettingsOrganization(app);
        currentUnmount = null;
        break;

      case "/company-settings/welding":
        await renderCompanySettingsWelding(app);
        currentUnmount = null;
        break;

      case "/company-settings/system":
        await renderCompanySettingsSystem(app);
        currentUnmount = null;
        break;

      default:
        if (route.startsWith("/prosjekter/")) {
          const parts = route.split("/").filter(Boolean);
          const projectId = parts[1] || "";
          const section = parts[2] || null;
          if (projectId) {
            await renderProjectDetail(app, projectId, section);
            currentUnmount = null;
            break;
          }
        }
        await renderHome(app);
        currentUnmount = null;
        break;
    }
  }

  window.addEventListener("hashchange", renderRoute);
  renderRoute();
} catch (err) {
  fatal(err);
}

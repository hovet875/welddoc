import { renderHeader, wireHeader } from "../../components/header";
import { getSession, getProfileAccess } from "../../app/auth";
import { Footer } from "../../components/footer";

import "../../styles/pages/company-settings.css";

export async function renderCompanySettingsSystem(app: HTMLElement) {
  const session = await getSession();
  let displayName = "Bruker";
  const email = session?.user?.email ?? "";
  let isAdmin = false;

  if (session?.user) {
    try {
      const access = await getProfileAccess(session.user);
      displayName = access.displayName;
      isAdmin = access.isAdmin;
    } catch (err) {
      console.warn("Feilet å hente profil", err);
    }
  }

  if (!isAdmin) {
    app.innerHTML = `
      <div class="shell page-company-settings">
        ${renderHeader(displayName, email)}
        <main class="main">
          <section class="section-header">
            <div>
              <h1 class="section-title">App-parametere – System</h1>
              <p class="section-subtitle">Kun admin har tilgang.</p>
            </div>
            <div class="section-actions">
              <a class="btn small" href="#/company-settings">← App-parametere</a>
            </div>
          </section>
          <div class="muted" style="padding:16px;">Kun admin har tilgang.</div>
        </main>
        ${Footer()}
      </div>
    `;
    wireHeader(app);
    return;
  }

  app.innerHTML = `
    <div class="shell page-company-settings">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">App-parametere – System</h1>
            <p class="section-subtitle">Roller, rettigheter og app-konfigurasjon.</p>
          </div>
          <div class="section-actions">
            <a class="btn small" href="#/company-settings">← App-parametere</a>
          </div>
        </section>

        <section class="section-grid">
          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">Roller / Rettigheter</div>
              <div class="panel-meta">Kommer</div>
            </div>
            <div class="panel-body">
              <div class="settings-placeholder muted">Rolle- og rettighetsstyring kommer.</div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">App-konfig</div>
              <div class="panel-meta">Kommer</div>
            </div>
            <div class="panel-body">
              <div class="settings-placeholder muted">App-konfigurasjon kommer.</div>
            </div>
          </div>
        </section>

        <div data-modal-mount></div>
      </main>

      ${Footer()}
    </div>
  `;

  wireHeader(app);
}

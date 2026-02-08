import { renderHeader, wireHeader } from "../../components/header";
import { getSession, getProfileAccess } from "../../app/auth";
import { Footer } from "../../components/footer";

import "../../styles/pages/company-settings.css";

export async function renderCompanySettingsPage(app: HTMLElement) {
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
              <h1 class="section-title">App-parametere</h1>
              <p class="section-subtitle">Kun admin har tilgang.</p>
            </div>
            <div class="section-actions">
              <a class="btn small" href="#/settings">← Tilbake</a>
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
            <h1 class="section-title">App-parametere</h1>
            <p class="section-subtitle">Velg kategori for å administrere parametere.</p>
          </div>
          <div class="section-actions">
            <a class="btn small" href="#/settings">← Tilbake</a>
          </div>
        </section>

        <section class="menu-grid">
          <a class="menu-card" href="#/company-settings/organization">
            <div class="menu-card__title">Organisasjon</div>
            <div class="menu-card__meta">Stillinger, kunder, leverandører</div>
          </a>
          <a class="menu-card" href="#/company-settings/welding">
            <div class="menu-card__title">Teknisk / Sveising</div>
            <div class="menu-card__meta">Materialer, standarder, NDT-metoder</div>
          </a>
          <a class="menu-card" href="#/company-settings/system">
            <div class="menu-card__title">System</div>
            <div class="menu-card__meta">Roller, rettigheter, app-konfig</div>
          </a>
        </section>
      </main>

      ${Footer()}
    </div>
  `;

  wireHeader(app);
}

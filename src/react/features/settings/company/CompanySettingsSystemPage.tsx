import { useAuth } from "../../../auth/AuthProvider";
import { AppFooter } from "../../../layout/AppFooter";
import { AppHeader } from "../../../layout/AppHeader";
import { CompanySettingsHeader } from "./components/CompanySettingsHeader";

export function CompanySettingsSystemPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;

  if (!isAdmin) {
    return (
      <div className="shell page-company-settings">
        <AppHeader displayName={displayName} email={email} />
        <main className="main">
          <CompanySettingsHeader
            title="App-parametere - System"
            subtitle="Kun admin har tilgang."
            backTo="/settings/company"
            backLabel="← App-parametere"
          />
          <div className="muted" style={{ padding: 16 }}>
            Kun admin har tilgang.
          </div>
        </main>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="shell page-company-settings">
      <AppHeader displayName={displayName} email={email} />

      <main className="main">
        <CompanySettingsHeader
          title="App-parametere - System"
          subtitle="Roller, rettigheter og app-konfigurasjon."
          backTo="/settings/company"
          backLabel="← App-parametere"
        />

        <section className="section-grid">
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Roller / Rettigheter</div>
              <div className="panel-meta">Kommer</div>
            </div>
            <div className="panel-body">
              <div className="settings-placeholder muted">Rolle- og rettighetsstyring kommer.</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">App-konfig</div>
              <div className="panel-meta">Kommer</div>
            </div>
            <div className="panel-body">
              <div className="settings-placeholder muted">App-konfigurasjon kommer.</div>
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}

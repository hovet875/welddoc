import { useAuth } from "../../../auth/AuthProvider";
import { AppFooter } from "../../../layout/AppFooter";
import { AppHeader } from "../../../layout/AppHeader";
import { CompanySettingsHeader } from "./components/CompanySettingsHeader";
import { CompanySettingsMenu } from "./components/CompanySettingsMenu";
import type { CompanySettingsMenuItem } from "./company-settings.types";

const COMPANY_SETTINGS_MENU_ITEMS: CompanySettingsMenuItem[] = [
  {
    to: "/settings/company/organization",
    title: "Organisasjon",
    meta: "Stillinger, kunder, leverandører",
  },
  {
    to: "/settings/company/welding",
    title: "Teknisk / Sveising",
    meta: "Materialer, standarder, NDT-metoder",
  },
  {
    to: "/settings/company/system",
    title: "System",
    meta: "Roller, rettigheter, app-konfig",
  },
];

export function CompanySettingsPage() {
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
            title="App-parametere"
            subtitle="Kun admin har tilgang."
            backTo="/settings"
            backLabel="← Tilbake"
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
          title="App-parametere"
          subtitle="Velg kategori for å administrere parametere."
          backTo="/settings"
          backLabel="← Tilbake"
        />
        <CompanySettingsMenu items={COMPANY_SETTINGS_MENU_ITEMS} />
      </main>

      <AppFooter />
    </div>
  );
}

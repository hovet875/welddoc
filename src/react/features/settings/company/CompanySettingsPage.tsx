import { Alert } from "@mantine/core";
import { useAuth } from "../../../auth/AuthProvider";
import { AppPageLayout } from "../../../layout/AppPageLayout";
import { CompanySettingsHeader } from "./components/CompanySettingsHeader";
import { CompanySettingsMenu } from "./components/CompanySettingsMenu";
import type { CompanySettingsMenuItem } from "./company-settings.types";
import { ROUTES } from "@react/router/routes";

const COMPANY_SETTINGS_MENU_ITEMS: CompanySettingsMenuItem[] = [
  {
    to: ROUTES.settingsCompanyOrganization,
    title: "Organisasjon",
    meta: "Stillinger, kunder, leverandører",
  },
  {
    to: ROUTES.settingsCompanyWelding,
    title: "Teknisk / Sveising",
    meta: "Materialer, standarder, NDT-metoder",
  },
  {
    to: ROUTES.settingsCompanySystem,
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
      <AppPageLayout pageClassName="page-company-settings" displayName={displayName} email={email}>
        <CompanySettingsHeader
          title="App-parametere"
          subtitle="Kun admin har tilgang."
          backTo={ROUTES.settings}
          backLabel="<- Tilbake"
        />
        <Alert color="gray" variant="light">
          Kun admin har tilgang.
        </Alert>
      </AppPageLayout>
    );
  }

  return (
    <AppPageLayout pageClassName="page-company-settings" displayName={displayName} email={email}>
      <CompanySettingsHeader
        title="App-parametere"
        subtitle="Velg kategori for å administrere parametere."
        backTo={ROUTES.settings}
        backLabel="Tilbake"
      />
      <CompanySettingsMenu items={COMPANY_SETTINGS_MENU_ITEMS} />
    </AppPageLayout>
  );
}

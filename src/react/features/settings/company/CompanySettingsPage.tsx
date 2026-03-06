import { Alert } from "@mantine/core";
import { useAuth } from "../../../auth/AuthProvider";
import { AppPageLayout } from "../../../layout/AppPageLayout";
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
      <AppPageLayout pageClassName="page-company-settings" displayName={displayName} email={email}>
        <CompanySettingsHeader
          title="App-parametere"
          subtitle="Kun admin har tilgang."
          backTo="/settings"
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
        backTo="/settings"
        backLabel="<- Tilbake"
      />
      <CompanySettingsMenu items={COMPANY_SETTINGS_MENU_ITEMS} />
    </AppPageLayout>
  );
}

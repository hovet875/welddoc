import { Alert, SimpleGrid } from "@mantine/core";
import { useAuth } from "../../../auth/AuthProvider";
import { AppPageLayout } from "../../../layout/AppPageLayout";
import { AppPanel } from "../../../ui/AppPanel";
import { CompanySettingsHeader } from "./components/CompanySettingsHeader";
import { CompanySystemAppConfigPanel } from "./system/components/CompanySystemAppConfigPanel";
import { CompanySystemRolesPanel } from "./system/components/CompanySystemRolesPanel";

export function CompanySettingsSystemPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;

  if (!isAdmin) {
    return (
      <AppPageLayout pageClassName="page-company-settings" displayName={displayName} email={email}>
        <CompanySettingsHeader
          title="App-parametere - System"
          subtitle="Kun admin har tilgang."
          backTo="/settings/company"
          backLabel="<- App-parametere"
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
        title="App-parametere - System"
        subtitle="Roller, rettigheter og app-konfigurasjon."
        backTo="/settings/company"
        backLabel="<- App-parametere"
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <AppPanel title="Roller / Rettigheter" meta="Planlagt">
          <CompanySystemRolesPanel />
        </AppPanel>

        <AppPanel title="Database" meta="Supabase-bruk">
          <CompanySystemAppConfigPanel />
        </AppPanel>
      </SimpleGrid>
    </AppPageLayout>
  );
}

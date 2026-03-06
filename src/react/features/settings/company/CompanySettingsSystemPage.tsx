import { Alert, SimpleGrid, Text } from "@mantine/core";
import { useAuth } from "../../../auth/AuthProvider";
import { AppPageLayout } from "../../../layout/AppPageLayout";
import { AppPanel } from "../../../ui/AppPanel";
import { CompanySettingsHeader } from "./components/CompanySettingsHeader";

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
        <AppPanel title="Roller / Rettigheter" meta="Kommer">
          <Text c="dimmed">Rolle- og rettighetsstyring kommer.</Text>
        </AppPanel>

        <AppPanel title="App-konfig" meta="Kommer">
          <Text c="dimmed">App-konfigurasjon kommer.</Text>
        </AppPanel>
      </SimpleGrid>
    </AppPageLayout>
  );
}

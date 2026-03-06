import { Text } from "@mantine/core";
import { useAuth } from "@react/auth/AuthProvider";
import { AppPageLayout } from "@react/layout/AppPageLayout";
import { AppPanel } from "@react/ui/AppPanel";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";

type MigrationPlaceholderPageProps = {
  title: string;
  subtitle: string;
};

export function MigrationPlaceholderPage({ title, subtitle }: MigrationPlaceholderPageProps) {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";

  return (
    <AppPageLayout displayName={displayName} email={email}>
      <AppSectionHeader
        title={title}
        subtitle={subtitle}
      />

        <AppPanel title="Under migrering">
          <Text c="dimmed" size="sm">
            Denne siden er midlertidig deaktivert mens vi bygger ny React/Mantine-versjon.
          </Text>
        </AppPanel>
    </AppPageLayout>
  );
}

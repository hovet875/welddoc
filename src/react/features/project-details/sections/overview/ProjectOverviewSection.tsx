import { Text } from "@mantine/core";
import { AppPanel } from "@react/ui/AppPanel";
import { AppLinkButton } from "@react/ui/AppLinkButton";
import { routePath } from "@react/router/routes";

type ProjectOverviewSectionProps = {
  projectId: string;
};

export function ProjectOverviewSection({ projectId }: ProjectOverviewSectionProps) {
  return (
    <AppPanel
      title="Prosjektoversikt"
      meta="Bygges ut videre"
      actions={
        <AppLinkButton to={routePath.projectDetailsSection(projectId, "arbeidsordre")} size="sm">
          Åpne arbeidsordre
        </AppLinkButton>
      }
    >
      <Text c="dimmed">Her kommer prosjektstatistikk og nøkkelinformasjon.</Text>
    </AppPanel>
  );
}

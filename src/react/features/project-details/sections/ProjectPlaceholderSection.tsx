import { Text } from "@mantine/core";
import { AppPanel } from "@react/ui/AppPanel";

type ProjectPlaceholderSectionProps = {
  title: string;
};

export function ProjectPlaceholderSection({ title }: ProjectPlaceholderSectionProps) {
  return (
    <AppPanel title={title} meta="Under migrering">
      <Text c="dimmed">Denne delen migreres nå til React/Mantine og blir tilgjengelig fortløpende.</Text>
    </AppPanel>
  );
}

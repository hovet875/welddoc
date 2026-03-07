import { List, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconShield } from "@tabler/icons-react";

export function CompanySystemRolesPanel() {
  return (
    <Stack gap="xs">
      <Text c="dimmed" size="sm">
        Rolle- og rettighetsstyring bygges ut i neste steg.
      </Text>
      <List
        spacing="xs"
        size="sm"
        icon={
          <ThemeIcon variant="light" color="gray" size={18} radius="xl">
            <IconShield size={12} />
          </ThemeIcon>
        }
      >
        <List.Item>Detaljert rollefordeling per bruker</List.Item>
        <List.Item>Kontrollpanel for tilgang til moduler</List.Item>
        <List.Item>Audit-spor for endringer i rettigheter</List.Item>
      </List>
    </Stack>
  );
}

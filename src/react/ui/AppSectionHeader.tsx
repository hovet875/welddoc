import type { ReactNode } from "react";
import { Group, Paper, Stack, Text, Title } from "@mantine/core";

type AppSectionHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function AppSectionHeader({ title, subtitle, actions }: AppSectionHeaderProps) {
  return (
    <Paper withBorder radius="xl" shadow="md" p="lg" className="app-section-header">
      <Group justify="space-between" align="center" gap="md" wrap="wrap">
        <Stack gap={4} className="app-section-header__content">
          <Title order={2} className="app-section-header__title">
            {title}
          </Title>
          {subtitle != null ? <Text c="dimmed">{subtitle}</Text> : null}
        </Stack>

        {actions != null ? (
          <Group gap="sm" wrap="wrap" justify="flex-end" className="app-section-header__actions">
            {actions}
          </Group>
        ) : null}
      </Group>
    </Paper>
  );
}

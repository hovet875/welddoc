import type { ReactNode } from "react";
import { Group, Paper, Stack, Text } from "@mantine/core";

type OrganizationListItemProps = {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function OrganizationListItem({ title, meta, actions }: OrganizationListItemProps) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Text fw={600} truncate>
            {title}
          </Text>
          {meta ? (
            <Text c="dimmed" size="sm">
              {meta}
            </Text>
          ) : null}
        </Stack>
        {actions}
      </Group>
    </Paper>
  );
}

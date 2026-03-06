import type { ReactNode } from "react";
import { Group, Paper, Stack, Text } from "@mantine/core";

type WeldingListItemProps = {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function WeldingListItem({ title, meta, actions }: WeldingListItemProps) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Text fw={600}>{title}</Text>
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

import type { ReactNode } from "react";
import { Group, Paper, Stack, Table, Text } from "@mantine/core";
import { AppMethodBadge } from "@react/ui/AppMethodBadge";
import { AppPanel } from "@react/ui/AppPanel";
import { AppAsyncState } from "@react/ui/AppAsyncState";

type ProcessGroupedTableGroup<T extends { id: string }> = {
  key: string;
  label: string;
  rows: T[];
};

type ProcessGroupedTablePanelProps<T extends { id: string }> = {
  title: string;
  totalCount: number;
  loading: boolean;
  error: string | null;
  groups: ProcessGroupedTableGroup<T>[];
  groupKeyPrefix: string;
  minWidth: number;
  headers: ReactNode[];
  renderRowCells: (row: T) => ReactNode;
  emptyLabel?: string;
};

export function ProcessGroupedTablePanel<T extends { id: string }>({
  title,
  totalCount,
  loading,
  error,
  groups,
  groupKeyPrefix,
  minWidth,
  headers,
  renderRowCells,
  emptyLabel = "Ingen data.",
}: ProcessGroupedTablePanelProps<T>) {
  return (
    <AppPanel title={title} meta={`${totalCount} stk`}>
      <AppAsyncState
        loading={loading}
        error={error}
        isEmpty={groups.length === 0}
        emptyMessage={emptyLabel}
      >
        <Stack gap="sm">
          {groups.map((group) => (
            <Paper
              key={`${groupKeyPrefix}-${group.key}`}
              withBorder
              radius="lg"
              p={0}
              style={{ overflow: "hidden" }}
            >
              <Group
                justify="space-between"
                gap="xs"
                px="md"
                py="sm"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <Group gap="xs">
                  <Text size="sm" fw={500}>Sveisemetode</Text>
                  <AppMethodBadge methodKey={group.key} label={group.label} />
                </Group>
                <Text c="dimmed" size="sm">
                  {group.rows.length} stk
                </Text>
              </Group>

              <Table.ScrollContainer minWidth={minWidth}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      {headers.map((header, index) => (
                        <Table.Th key={`header-${index}`}>{header}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {group.rows.map((row) => (
                      <Table.Tr key={row.id}>{renderRowCells(row)}</Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          ))}
        </Stack>
      </AppAsyncState>
    </AppPanel>
  );
}
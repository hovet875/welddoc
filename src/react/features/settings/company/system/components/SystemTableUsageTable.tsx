import { Table, Text } from "@mantine/core";
import { AppCollapsiblePanel } from "@react/ui/AppCollapsiblePanel";
import type { SystemUsageTableStat } from "@/repo/systemUsageRepo";
import { formatBytes, formatCount, prettifyTableName } from "../lib/systemUsageFormat";

type SystemTableUsageTableProps = {
  rows: SystemUsageTableStat[];
};

export function SystemTableUsageTable({ rows }: SystemTableUsageTableProps) {
  if (rows.length === 0) {
    return (
      <AppCollapsiblePanel title="Tabelloversikt" meta="Ingen data" defaultCollapsed>
        <Text c="dimmed" size="sm">
          Ingen tabell-data tilgjengelig.
        </Text>
      </AppCollapsiblePanel>
    );
  }

  return (
    <AppCollapsiblePanel title="Tabelloversikt" meta={`${rows.length} tabeller`} defaultCollapsed>
      <Table.ScrollContainer minWidth={460}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tabell</Table.Th>
              <Table.Th ta="right">Est. rader</Table.Th>
              <Table.Th ta="right">Størrelse</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.tableName}>
                <Table.Td>{prettifyTableName(row.tableName)}</Table.Td>
                <Table.Td ta="right">{formatCount(row.rowEstimate)}</Table.Td>
                <Table.Td ta="right">{formatBytes(row.totalBytes)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </AppCollapsiblePanel>
  );
}

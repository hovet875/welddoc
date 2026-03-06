import { useMemo } from "react";
import { Group, ScrollArea, Stack, Table, Text, Tooltip, UnstyledButton } from "@mantine/core";
import type { ProjectTraceabilityRow, TraceabilityTypeRow } from "@/repo/traceabilityRepo";
import { AppActionsMenu, createDeleteAction, createEditAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";
import {
  lookupType,
  renderDimension,
  renderHeatLabel,
  sortedTraceabilityRows,
  statusForTraceabilityRow,
} from "../lib/traceabilityUtils";

type TraceabilityTableProps = {
  rows: ProjectTraceabilityRow[];
  types: TraceabilityTypeRow[];
  isAdmin: boolean;
  onEdit: (row: ProjectTraceabilityRow) => void;
  onDelete: (row: ProjectTraceabilityRow) => void;
  onOpenCertificate: (fileId: string) => void;
};

export function TraceabilityTable({ rows, types, isAdmin, onEdit, onDelete, onOpenCertificate }: TraceabilityTableProps) {
  const sortedRows = useMemo(() => sortedTraceabilityRows(rows), [rows]);

  return (
    <ScrollArea type="auto" offsetScrollbars>
      <Table highlightOnHover withRowBorders={false}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Kode</Table.Th>
            <Table.Th>Komponent</Table.Th>
            <Table.Th>Material/type</Table.Th>
            <Table.Th>Dimensjon</Table.Th>
            <Table.Th>Heat</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th w={70}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sortedRows.map((row) => {
            const type = row.type ?? lookupType(types, row.type_code);
            const indexSuffix = row.code_index ?? "";
            const codeLabel = `${row.type_code}${indexSuffix}`;
            const typeLabel = type?.use_filler_type ? row.filler_type ?? "" : row.material?.name ?? "";
            const status = statusForTraceabilityRow(row);

            const menuItems: AppActionsMenuItem[] = [];
            if (isAdmin) {
              menuItems.push(
                createEditAction({
                  onClick: () => onEdit(row),
                }),
                createDeleteAction({
                  onClick: () => onDelete(row),
                })
              );
            }

            return (
              <Table.Tr key={row.id}>
                <Table.Td>
                  <AppStatusBadge tone="info">
                    {codeLabel}
                  </AppStatusBadge>
                </Table.Td>
                <Table.Td>{type?.label ?? ""}</Table.Td>
                <Table.Td>{typeLabel || "—"}</Table.Td>
                <Table.Td>{renderDimension(row)}</Table.Td>
                <Table.Td>{renderHeatLabel(row)}</Table.Td>
                <Table.Td>
                  {status.openable && row.cert?.file_id ? (
                    <Tooltip label="Åpne sertifikat">
                      <UnstyledButton 
                        onClick={() => onOpenCertificate(row.cert?.file_id as string)}>
                        <AppStatusBadge tone="success">{status.label}</AppStatusBadge>
                      </UnstyledButton>
                    </Tooltip>
                  ) : (
                    <Tooltip label={status.hint} disabled={!status.hint}>
                      <span>
                        <AppStatusBadge
                          tone={status.tone === "success" ? "success" : status.tone === "warning" ? "warning" : "danger"}
                        >
                          {status.label}
                        </AppStatusBadge>
                      </span>
                    </Tooltip>
                  )}
                </Table.Td>
                <Table.Td>
                  {menuItems.length > 0 ? (
                    <Group justify="flex-end" wrap="nowrap">
                      <AppActionsMenu title="Sporbarhet handlinger" items={menuItems} size={30} />
                    </Group>
                  ) : (
                    <Stack gap={0} align="flex-end">
                      <Text size="xs" c="dimmed">
                        —
                      </Text>
                    </Stack>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

import { Checkbox, Group, Table, Text } from "@mantine/core";
import { fmtDate, truncateLabel } from "@/utils/format";
import {
  AppActionsMenu,
  createDeleteAction,
  createEditAction,
  createPrintAction,
  type AppActionsMenuItem,
} from "@react/ui/AppActionsMenu";
import { AppButton } from "@react/ui/AppButton";
import type { ProjectDrawingRow } from "../types";
import { formatFileSize } from "../lib/drawingsUtils";

type DrawingsTableProps = {
  rows: ProjectDrawingRow[];
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (rowId: string, checked: boolean) => void;
  onOpenPdf: (row: ProjectDrawingRow) => void;
  onPrint: (row: ProjectDrawingRow) => void;
  onEdit: (row: ProjectDrawingRow) => void;
  onDelete: (row: ProjectDrawingRow) => void;
};

export function DrawingsTable({
  rows,
  loading,
  error,
  isAdmin,
  selectedIds,
  allSelected,
  onToggleAll,
  onToggleOne,
  onOpenPdf,
  onPrint,
  onEdit,
  onDelete,
}: DrawingsTableProps) {
  return (
    <Table.ScrollContainer minWidth={900}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 44 }}>
              {isAdmin ? (
                <Checkbox
                  checked={allSelected}
                  indeterminate={selectedIds.size > 0 && !allSelected}
                  onChange={(event) => onToggleAll(event.currentTarget.checked)}
                  aria-label="Velg alle tegninger"
                />
              ) : null}
            </Table.Th>
            <Table.Th>Tegningsnr.</Table.Th>
            <Table.Th>Filnavn</Table.Th>
            <Table.Th>Dato</Table.Th>
            <Table.Th>Revisjon</Table.Th>
            <Table.Th style={{ width: 48 }} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed">Laster tegninger...</Text>
              </Table.Td>
            </Table.Tr>
          ) : error ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="red">{error}</Text>
              </Table.Td>
            </Table.Tr>
          ) : rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed">Ingen tegninger.</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => {
              const actionItems: AppActionsMenuItem[] = [
                {
                  key: `open-${row.id}`,
                  label: "Åpne",
                  onClick: () => onOpenPdf(row),
                },
                {
                  ...createPrintAction({
                    key: `print-${row.id}`,
                    onClick: () => onPrint(row),
                  }),
                },
              ];

              if (isAdmin) {
                actionItems.push(
                  createEditAction({
                    key: `edit-${row.id}`,
                    onClick: () => onEdit(row),
                  }),
                  createDeleteAction({
                    key: `delete-${row.id}`,
                    onClick: () => onDelete(row),
                  })
                );
              }

              return (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    {isAdmin ? (
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        onChange={(event) => onToggleOne(row.id, event.currentTarget.checked)}
                        aria-label={`Velg tegning ${row.drawing_no}`}
                      />
                    ) : null}
                  </Table.Td>
                  <Table.Td>
                    <AppButton tone="neutral" size="xs" onClick={() => onOpenPdf(row)}>
                      {row.drawing_no}
                    </AppButton>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{truncateLabel(row.file?.label || "Tegning", 60)}</Text>
                    {row.file?.size_bytes ? (
                      <Text size="xs" c="dimmed">
                        {formatFileSize(row.file.size_bytes)}
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td>{fmtDate(row.created_at)}</Table.Td>
                  <Table.Td>{(row.revision || "-").trim() || "-"}</Table.Td>
                  <Table.Td>
                    <Group justify="flex-end">
                      <AppActionsMenu title={`Handlinger for ${row.drawing_no}`} items={actionItems} />
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

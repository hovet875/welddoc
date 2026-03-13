import { Badge, Checkbox, Group, Table, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { ProjectDrawingProgress } from "@/repo/projectDrawingRepo";
import { fmtDate, truncateLabel } from "@/utils/format";
import {
  AppActionsMenu,
  createDeleteAction,
  createEditAction,
  createPrintAction,
  type AppActionsMenuItem,
} from "@react/ui/AppActionsMenu";
import { AppButton } from "@react/ui/AppButton";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";
import type { ProjectDrawingRow } from "../types";
import { drawingStatusLabel, drawingStatusTone, formatFileSize, resolveDrawingStatus } from "../lib/drawingsUtils";

type DrawingsTableProps = {
  rows: ProjectDrawingRow[];
  progressByDrawingId: Map<string, ProjectDrawingProgress>;
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
  progressByDrawingId,
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
    <Table.ScrollContainer minWidth={1080}>
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
            <Table.Th>Buttsveiser</Table.Th>
            <Table.Th>Dato</Table.Th>
            <Table.Th>Revisjon</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th style={{ width: 48 }} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text c="dimmed">Laster tegninger...</Text>
              </Table.Td>
            </Table.Tr>
          ) : error ? (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text c="red">{error}</Text>
              </Table.Td>
            </Table.Tr>
          ) : rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text c="dimmed">Ingen tegninger.</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => {
              const buttWeldCount = Number(row.butt_weld_count ?? 0);
              const normalizedButtWeldCount =
                Number.isFinite(buttWeldCount) && buttWeldCount >= 0 ? Math.trunc(buttWeldCount) : null;
              const revision = (row.revision || "-").trim() || "-";
              const progress = progressByDrawingId.get(row.id);
              const status = resolveDrawingStatus({
                buttWeldCount: normalizedButtWeldCount,
                progress,
              });
              const progressLabel =
                progress && progress.totalWelds > 0
                  ? `${progress.completedWelds}/${Math.max(progress.totalWelds, normalizedButtWeldCount ?? 0)} ferdig`
                  : null;

              const actionItems: AppActionsMenuItem[] = [
                {
                  key: `open-${row.id}`,
                  label: "Åpne PDF",
                  icon: <IconEye size={16} />,
                  disabled: !row.file_id,
                  onClick: () => onOpenPdf(row),
                },
                {
                  ...createPrintAction({
                    key: `print-${row.id}`,
                    onClick: () => onPrint(row),
                  }),
                  disabled: !row.file_id,
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
                    <AppButton tone="neutral" size="xs" onClick={() => onOpenPdf(row)} disabled={!row.file_id}>
                      {row.drawing_no}
                    </AppButton>
                  </Table.Td>
                  <Table.Td>
                    {row.is_placeholder ? (
                      <>
                        <Badge variant="light" color="yellow" radius="xl">
                          Midlertidig
                        </Badge>
                        <Text size="xs" c="dimmed" mt={4}>
                          Ingen PDF lastet opp ennå.
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text size="sm">{truncateLabel(row.file?.label || "Tegning", 60)}</Text>
                        {row.file?.size_bytes ? (
                          <Text size="xs" c="dimmed">
                            {formatFileSize(row.file.size_bytes)}
                          </Text>
                        ) : null}
                      </>
                    )}
                  </Table.Td>
                  <Table.Td>{normalizedButtWeldCount ?? "-"}</Table.Td>
                  <Table.Td>{fmtDate(row.created_at)}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="gray" radius="xl">
                      {revision}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <AppStatusBadge tone={drawingStatusTone(status)}>{drawingStatusLabel(status)}</AppStatusBadge>
                      {progressLabel ? (
                        <Text size="xs" c="dimmed">
                          {progressLabel}
                        </Text>
                      ) : null}
                    </Group>
                  </Table.Td>
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

import { IconEye } from "@tabler/icons-react";
import { Group, Table, Text } from "@mantine/core";
import type { WPQRRow } from "@/repo/wpsRepo";
import type { ProcessGroup } from "@react/features/wps/lib/wpsView";
import { materialDisplay, rowDateLabel, standardDisplay } from "@react/features/wps/lib/wpsView";
import { AppActionsMenu, createDeleteAction, createEditAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppButton } from "@react/ui/AppButton";
import { ProcessGroupedTablePanel } from "./ProcessGroupedTablePanel";

type WpqrTablePanelProps = {
  loading: boolean;
  error: string | null;
  groups: ProcessGroup<WPQRRow>[];
  totalCount: number;
  isAdmin: boolean;
  onOpenPdfPreview: (fileId: string | null, title: string) => void;
  onEdit: (row: WPQRRow) => void;
  onDelete: (row: WPQRRow) => void;
};

const WPQR_HEADERS = ["WPQR nr.", "Standard", "Materiale", "Fuge", "Tykkelse", "Dato lagt opp", ""];

export function WpqrTablePanel({
  loading,
  error,
  groups,
  totalCount,
  isAdmin,
  onOpenPdfPreview,
  onEdit,
  onDelete,
}: WpqrTablePanelProps) {
  return (
    <ProcessGroupedTablePanel
      title="WPQR"
      totalCount={totalCount}
      loading={loading}
      error={error}
      groups={groups}
      groupKeyPrefix="wpqr"
      minWidth={900}
      headers={WPQR_HEADERS}
      renderRowCells={(row) => {
        const actionItems: AppActionsMenuItem[] = [
          {
            key: `open-pdf-${row.id}`,
            label: "Åpne PDF",
            icon: <IconEye size={16} />,
            disabled: !row.file_id,
            onClick: () => {
              onOpenPdfPreview(row.file_id, row.doc_no || "WPQR PDF");
            },
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

        const hasAvailableActions = actionItems.some((item) => item.disabled !== true);

        return (
          <>
            <Table.Td>
              <AppButton
                tone="neutral"
                size="xs"
                disabled={!row.file_id}
                title={row.file_id ? "Åpne PDF" : "Ingen PDF"}
                onClick={() => onOpenPdfPreview(row.file_id, row.doc_no || "WPQR PDF")}
              >
                {row.doc_no}
              </AppButton>
            </Table.Td>
            <Table.Td>{standardDisplay(row) || "-"}</Table.Td>
            <Table.Td>{materialDisplay(row) || "-"}</Table.Td>
            <Table.Td>{row.fuge || "-"}</Table.Td>
            <Table.Td>{row.tykkelse || "-"}</Table.Td>
            <Table.Td>{rowDateLabel(row)}</Table.Td>
            <Table.Td>
              <Group justify="flex-end" wrap="nowrap">
                {hasAvailableActions ? (
                  <AppActionsMenu title={`Handlinger for ${row.doc_no}`} items={actionItems} />
                ) : (
                  <Text c="dimmed" size="sm">
                    -
                  </Text>
                )}
              </Group>
            </Table.Td>
          </>
        );
      }}
    />
  );
}

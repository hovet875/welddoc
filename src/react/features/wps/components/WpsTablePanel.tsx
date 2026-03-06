import { IconEye } from "@tabler/icons-react";
import { Group, Table, Text } from "@mantine/core";
import type { WPSRow } from "@/repo/wpsRepo";
import type { ProcessGroup } from "@react/features/wps/lib/wpsView";
import { materialDisplay, rowDateLabel, standardDisplay } from "@react/features/wps/lib/wpsView";
import { AppActionsMenu, createDeleteAction, createEditAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppButton } from "@react/ui/AppButton";
import { ProcessGroupedTablePanel } from "./ProcessGroupedTablePanel";

type WpsTablePanelProps = {
  loading: boolean;
  error: string | null;
  groups: ProcessGroup<WPSRow>[];
  totalCount: number;
  isAdmin: boolean;
  onOpenPdfPreview: (fileId: string | null, title: string) => void;
  onEdit: (row: WPSRow) => void;
  onDelete: (row: WPSRow) => void;
};

const WPS_HEADERS = ["WPS nr.", "Standard", "Materiale", "Fuge", "Tykkelse", "Knyttet WPQR", "Dato lagt opp", ""];

export function WpsTablePanel({
  loading,
  error,
  groups,
  totalCount,
  isAdmin,
  onOpenPdfPreview,
  onEdit,
  onDelete,
}: WpsTablePanelProps) {
  return (
    <ProcessGroupedTablePanel
      title="WPS"
      totalCount={totalCount}
      loading={loading}
      error={error}
      groups={groups}
      groupKeyPrefix="wps"
      minWidth={940}
      headers={WPS_HEADERS}
      renderRowCells={(row) => {
        const actionItems: AppActionsMenuItem[] = [
          {
            key: `open-pdf-${row.id}`,
            label: "Åpne PDF",
            icon: <IconEye size={16} />,
            disabled: !row.file_id,
            onClick: () => {
              onOpenPdfPreview(row.file_id, row.doc_no || "WPS PDF");
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
                onClick={() => onOpenPdfPreview(row.file_id, row.doc_no || "WPS PDF")}
              >
                {row.doc_no}
              </AppButton>
            </Table.Td>
            <Table.Td>{standardDisplay(row) || "-"}</Table.Td>
            <Table.Td>{materialDisplay(row) || "-"}</Table.Td>
            <Table.Td>{row.fuge || "-"}</Table.Td>
            <Table.Td>{row.tykkelse || "-"}</Table.Td>
            <Table.Td>{row.wpqr?.doc_no || "Ikke koblet"}</Table.Td>
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

import { Group, Stack, Table, Text } from "@mantine/core";
import { IconEye, IconRefresh } from "@tabler/icons-react";
import type { WelderCertRow } from "@/repo/certRepo";
import { fmtDate } from "@/utils/format";
import { materialLabel, getCertStatus, statusTone, type WelderCertFilters, type SelectOption } from "@react/features/certs/lib/certsView";
import { WelderCertFiltersBar } from "@react/features/certs/components/WelderCertFiltersBar";
import { AppActionsMenu, createDeleteAction, createEditAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppButton } from "@react/ui/AppButton";
import { AppPanel } from "@react/ui/AppPanel";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";

type WelderCertPanelProps = {
  filters: WelderCertFilters;
  onChangeFilters: (next: WelderCertFilters) => void;
  welderFilterOptions: SelectOption[];
  materialFilterOptions: SelectOption[];
  jointTypeFilterOptions: SelectOption[];
  groups: Array<[string, WelderCertRow[]]>;
  loading: boolean;
  error: string | null;
  meta: string;
  hasFilters: boolean;
  isAdmin: boolean;
  standardsByLabel: Map<string, string>;
  onOpenPdf: (ref: string | null, title: string) => void;
  onEdit: (row: WelderCertRow) => void;
  onRenew: (row: WelderCertRow) => void;
  onDelete: (row: WelderCertRow) => void;
};

export function WelderCertPanel({
  filters,
  onChangeFilters,
  welderFilterOptions,
  materialFilterOptions,
  jointTypeFilterOptions,
  groups,
  loading,
  error,
  meta,
  hasFilters,
  isAdmin,
  standardsByLabel,
  onOpenPdf,
  onEdit,
  onRenew,
  onDelete,
}: WelderCertPanelProps) {
  return (
    <AppPanel title="Sveisesertifikater" meta={meta}>
      <Stack gap="sm">
        <WelderCertFiltersBar
          filters={filters}
          onChangeFilters={onChangeFilters}
          welderFilterOptions={welderFilterOptions}
          materialFilterOptions={materialFilterOptions}
          jointTypeFilterOptions={jointTypeFilterOptions}
        />

        <AppAsyncState
          error={error}
          loading={loading}
          isEmpty={groups.length === 0}
          emptyMessage={hasFilters ? "Ingen treff for valgte filtre." : "Ingen sveisesertifikater registrert."}
        >
          {groups.map(([groupTitle, rows]) => (
            <AppPanel key={groupTitle} title={groupTitle} meta={`${rows.length} stk`}>
              <Table.ScrollContainer minWidth={1160}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Sertifikatnummer</Table.Th>
                      <Table.Th>Sveisemetode</Table.Th>
                      <Table.Th>Standard</Table.Th>
                      <Table.Th>Grunnmaterial</Table.Th>
                      <Table.Th>FM-gruppe</Table.Th>
                      <Table.Th>Fugetype</Table.Th>
                      <Table.Th>Tykkelsesområde</Table.Th>
                      <Table.Th>Utløpsdato</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row) => {
                      const status = getCertStatus(row.expires_at);
                      const dateLabel = row.expires_at ? fmtDate(row.expires_at) : "-";
                      const fileRef = row.file_id || row.pdf_path || null;
                      const actionItems: AppActionsMenuItem[] = [
                        {
                          key: `open-pdf-${row.id}`,
                          label: fileRef ? "Åpne PDF" : "Åpne PDF (mangler fil)",
                          icon: <IconEye size={16} />,
                          disabled: !fileRef,
                          onClick: () => {
                            onOpenPdf(fileRef, "Sveisesertifikat");
                          },
                        },
                      ];

                      if (isAdmin) {
                        actionItems.push(
                          {
                            key: `renew-${row.id}`,
                            label: "Forny sertifikat",
                            icon: <IconRefresh size={16} />,
                            onClick: () => onRenew(row),
                          },
                          createEditAction({
                            key: `edit-${row.id}`,
                            label: "Endre sertifikat",
                            onClick: () => onEdit(row),
                          }),
                          createDeleteAction({ key: `delete-${row.id}`, onClick: () => onDelete(row) })
                        );
                      }

                      const hasAvailableActions = actionItems.some((item) => item.disabled !== true);

                      return (
                        <Table.Tr key={row.id}>
                          <Table.Td>
                            <AppButton
                              tone="neutral"
                              size="xs"
                              disabled={!fileRef}
                              title={fileRef ? "Åpne PDF" : "Ingen PDF"}
                              onClick={() => onOpenPdf(fileRef, "Sveisesertifikat")}
                            >
                              {row.certificate_no}
                            </AppButton>
                          </Table.Td>
                          <Table.Td>{row.welding_process_code || "-"}</Table.Td>
                          <Table.Td>{standardsByLabel.get(row.standard) ?? row.standard}</Table.Td>
                          <Table.Td>{materialLabel(row) || "-"}</Table.Td>
                          <Table.Td>{row.fm_group || "-"}</Table.Td>
                          <Table.Td>{row.coverage_joint_type || "-"}</Table.Td>
                          <Table.Td>{row.coverage_thickness || "-"}</Table.Td>
                          <Table.Td>
                            {row.expires_at ? (
                              <AppStatusBadge tone={statusTone(status)}>{dateLabel}</AppStatusBadge>
                            ) : (
                              <Text c="dimmed" size="sm">
                                -
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Group justify="flex-end" wrap="nowrap">
                              {hasAvailableActions ? (
                                <AppActionsMenu title={`Handlinger for ${row.certificate_no}`} items={actionItems} />
                              ) : (
                                <Text c="dimmed" size="sm">
                                  Mangler PDF
                                </Text>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </AppPanel>
          ))}
        </AppAsyncState>
      </Stack>
    </AppPanel>
  );
}

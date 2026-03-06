import { Group, Stack, Table, Text } from "@mantine/core";
import { IconEye, IconRefresh } from "@tabler/icons-react";
import type { NdtCertRow } from "@/repo/certRepo";
import { fmtDate } from "@/utils/format";
import { getCertStatus, statusTone, type NdtCertFilters, type SelectOption } from "@react/features/certs/lib/certsView";
import { NdtCertFiltersBar } from "@react/features/certs/components/NdtCertFiltersBar";
import { AppActionsMenu, createDeleteAction, createEditAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppButton } from "@react/ui/AppButton";
import { AppPanel } from "@react/ui/AppPanel";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";

type NdtCertPanelProps = {
  filters: NdtCertFilters;
  onChangeFilters: (next: NdtCertFilters) => void;
  companyOptions: SelectOption[];
  methodOptions: SelectOption[];
  groups: Array<[string, NdtCertRow[]]>;
  loading: boolean;
  error: string | null;
  meta: string;
  hasFilters: boolean;
  isAdmin: boolean;
  onOpenPdf: (ref: string | null, title: string) => void;
  onEdit: (row: NdtCertRow) => void;
  onRenew: (row: NdtCertRow) => void;
  onDelete: (row: NdtCertRow) => void;
};

export function NdtCertPanel({
  filters,
  onChangeFilters,
  companyOptions,
  methodOptions,
  groups,
  loading,
  error,
  meta,
  hasFilters,
  isAdmin,
  onOpenPdf,
  onEdit,
  onRenew,
  onDelete,
}: NdtCertPanelProps) {
  return (
    <AppPanel title="NDT-personell sertifikater" meta={meta}>
      <Stack gap="sm">
        <NdtCertFiltersBar
          filters={filters}
          onChangeFilters={onChangeFilters}
          companyOptions={companyOptions}
          methodOptions={methodOptions}
        />

        <AppAsyncState
          error={error}
          loading={loading}
          isEmpty={groups.length === 0}
          emptyMessage={hasFilters ? "Ingen treff for valgte filtre." : "Ingen NDT-sertifikater registrert."}
        >
          {groups.map(([company, rows]) => (
            <AppPanel key={company} title={`Firma: ${company}`} meta={`${rows.length} stk`}>
              <Table.ScrollContainer minWidth={940}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Sertifikatnummer</Table.Th>
                      <Table.Th>NDT-metode</Table.Th>
                      <Table.Th>NDT-kontrollør</Table.Th>
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
                            onOpenPdf(fileRef, "NDT-sertifikat");
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
                              onClick={() => onOpenPdf(fileRef, "NDT-sertifikat")}
                            >
                              {row.certificate_no}
                            </AppButton>
                          </Table.Td>
                          <Table.Td>{row.ndt_method || "-"}</Table.Td>
                          <Table.Td>{row.personnel_name || "-"}</Table.Td>
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

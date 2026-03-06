import { memo, useEffect, useMemo, useState } from "react";
import { Checkbox, Group, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { MaterialCertificateRow, MaterialCertificateType } from "@/repo/materialCertificateRepo";
import { truncateLabel } from "@/utils/format";
import { AppActionsMenu, createDeleteAction, createEditAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppAutocomplete } from "@react/ui/AppAutocomplete";
import { AppButton } from "@react/ui/AppButton";
import { AppPanel } from "@react/ui/AppPanel";
import { AppPaginationToolbar } from "@react/ui/AppPaginationToolbar";
import { AppSelect } from "@react/ui/AppSelect";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";
import { AppTextInput } from "@react/ui/AppTextInput";
import type { MaterialCertPanelFilters, SelectOption } from "../lib/materialCertsView";
import {
  materialCertFileTitle,
  materialCertProductLabel,
  materialCertStatus,
  trimOrEmpty,
} from "../lib/materialCertsView";

type MaterialCertsPanelProps = {
  type: MaterialCertificateType;
  title: string;
  meta: string;
  filters: MaterialCertPanelFilters;
  onChangeFilters: (next: MaterialCertPanelFilters) => void;
  materialOptions: SelectOption[];
  fillerTypeOptions: SelectOption[];
  supplierSuggestions: string[];
  rows: MaterialCertificateRow[];
  loading: boolean;
  error: string | null;
  hasFilters: boolean;
  isAdmin: boolean;
  page: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
  onOpenPdf: (ref: string | null, title: string) => void;
  onEdit: (row: MaterialCertificateRow) => void;
  onDelete: (row: MaterialCertificateRow) => void;
  onBulkDelete: (rows: MaterialCertificateRow[]) => void;
};

export const MaterialCertsPanel = memo(function MaterialCertsPanel({
  type,
  title,
  meta,
  filters,
  onChangeFilters,
  materialOptions,
  fillerTypeOptions,
  supplierSuggestions,
  rows,
  loading,
  error,
  hasFilters,
  isAdmin,
  page,
  totalRows,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onOpenPdf,
  onEdit,
  onDelete,
  onBulkDelete,
}: MaterialCertsPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => rows.some((row) => row.id === id)));
  }, [rows]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds]
  );
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  const partiallySelected = selectedRows.length > 0 && !allSelected;

  const setFilter = <K extends keyof MaterialCertPanelFilters>(key: K, value: MaterialCertPanelFilters[K]) => {
    onChangeFilters({ ...filters, [key]: value });
  };

  return (
    <AppPanel
      title={title}
      meta={meta}
      actions={
        isAdmin && selectedRows.length > 0 ? (
          <AppButton
            tone="danger"
            size="sm"
            onClick={() => {
              onBulkDelete(selectedRows);
              setSelectedIds([]);
            }}
          >
            Slett valgte ({selectedRows.length})
          </AppButton>
        ) : null
      }
    >
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
          {type === "material" ? (
            <AppSelect
              value={filters.materialId}
              onChange={(value) => setFilter("materialId", value)}
              data={materialOptions}
              placeholder="Alle materialer"
              clearable
              searchable
            />
          ) : (
            <AppSelect
              value={filters.fillerType}
              onChange={(value) => setFilter("fillerType", value)}
              data={fillerTypeOptions}
              placeholder="Alle typer"
              clearable
              searchable
            />
          )}
          <AppAutocomplete
            value={filters.supplier}
            onChange={(value) => setFilter("supplier", value)}
            data={supplierSuggestions}
            placeholder="Leverandør"
            mobileSearchable
          />
          <AppTextInput
            value={filters.query}
            onChange={(value) => setFilter("query", value)}
            placeholder="Søk cert type, leverandør eller heat..."
          />
        </SimpleGrid>

        <AppAsyncState
          loading={loading}
          error={error}
          isEmpty={rows.length === 0}
          emptyMessage={
            hasFilters
              ? "Ingen sertifikater matcher valgte filtre."
              : "Ingen sertifikater registrert."
          }
        >
          <Table.ScrollContainer minWidth={980}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    {isAdmin ? (
                      <Checkbox
                        checked={allSelected}
                        indeterminate={partiallySelected}
                        aria-label="Velg alle på siden"
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setSelectedIds(checked ? rows.map((row) => row.id) : []);
                        }}
                      />
                    ) : null}
                  </Table.Th>
                  <Table.Th>Fil</Table.Th>
                  <Table.Th>Sertifikat</Table.Th>
                  <Table.Th>{type === "material" ? "Material" : "Sveisetilsett"}</Table.Th>
                  <Table.Th>Leverandør</Table.Th>
                  <Table.Th>Heat nr.</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => {
                  const status = materialCertStatus(row);
                  const fileTitle = materialCertFileTitle(row);
                  const actionItems: AppActionsMenuItem[] = [
                    {
                      key: `open-${row.id}`,
                      label: row.file_id ? "Åpne PDF" : "Åpne PDF (mangler fil)",
                      icon: <IconEye size={16} />,
                      disabled: !row.file_id,
                      onClick: () => onOpenPdf(row.file_id, row.file?.label ?? "Materialsertifikat"),
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
                            checked={selectedIds.includes(row.id)}
                            aria-label={`Velg ${fileTitle}`}
                            onChange={(event) => {
                              const checked = event.currentTarget.checked;
                              setSelectedIds((current) =>
                                checked
                                  ? [...current, row.id]
                                  : current.filter((id) => id !== row.id)
                              )
                            }}
                          />
                        ) : null}
                      </Table.Td>
                      <Table.Td>
                        <AppButton
                          tone="neutral"
                          size="xs"
                          disabled={!row.file_id}
                          title={row.file_id ? fileTitle : "Ingen PDF"}
                          onClick={() => onOpenPdf(row.file_id, row.file?.label ?? "Materialsertifikat")}
                        >
                          {truncateLabel(fileTitle, 18)}
                        </AppButton>
                      </Table.Td>
                      <Table.Td>{trimOrEmpty(row.cert_type) || "3.1"}</Table.Td>
                      <Table.Td>{materialCertProductLabel(row)}</Table.Td>
                      <Table.Td>{trimOrEmpty(row.supplier) || "-"}</Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {(row.heat_numbers ?? []).filter(Boolean).join(", ") || "-"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <AppStatusBadge tone={status.tone}>{status.label}</AppStatusBadge>
                      </Table.Td>
                      <Table.Td>
                        <Group justify="flex-end">
                          <AppActionsMenu title="Handlinger" items={actionItems} />
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <AppPaginationToolbar
            page={page}
            pageSize={pageSize}
            total={totalRows}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </AppAsyncState>
      </Stack>
    </AppPanel>
  );
});

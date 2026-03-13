import { Group, SimpleGrid, Stack, Table } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { NdtReportRow } from "@/repo/ndtReportRepo";
import { fmtDate, truncateLabel } from "@/utils/format";
import { AppActionsMenu, createDeleteAction, createEditAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppButton } from "@react/ui/AppButton";
import { AppMethodBadge } from "@react/ui/AppMethodBadge";
import { AppPanel } from "@react/ui/AppPanel";
import { AppPaginationToolbar } from "@react/ui/AppPaginationToolbar";
import { AppSelect } from "@react/ui/AppSelect";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";
import { AppTextInput } from "@react/ui/AppTextInput";
import {
  NDT_RESULT_OPTIONS,
  formatReportWelderList,
  isFaultReport,
  type NdtReportFilters,
  type SelectOption,
  trimOrEmpty,
} from "../lib/ndtView";

type NdtReportsPanelProps = {
  filters: NdtReportFilters;
  onChangeFilters: (next: NdtReportFilters) => void;
  methodOptions: SelectOption[];
  projectOptions: SelectOption[];
  yearOptions: SelectOption[];
  welderOptions: SelectOption[];
  rows: NdtReportRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  meta: string;
  hasFilters: boolean;
  isAdmin: boolean;
  page: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  projectNameByNo: Map<string, string>;
  onOpenPdf: (ref: string | null, title: string) => void;
  onEdit: (row: NdtReportRow) => void;
  onDelete: (row: NdtReportRow) => void;
};

export function NdtReportsPanel({
  filters,
  onChangeFilters,
  methodOptions,
  projectOptions,
  yearOptions,
  welderOptions,
  rows,
  loading,
  error,
  onRetry,
  meta,
  hasFilters,
  isAdmin,
  page,
  totalRows,
  pageSize,
  onPageChange,
  onPageSizeChange,
  projectNameByNo,
  onOpenPdf,
  onEdit,
  onDelete,
}: NdtReportsPanelProps) {
  const setFilter = <K extends keyof NdtReportFilters>(key: K, value: NdtReportFilters[K]) => {
    onChangeFilters({ ...filters, [key]: value });
  };

  return (
    <AppPanel title="Rapporter" meta={meta}>
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          <AppSelect
            value={filters.methodId}
            onChange={(value) => setFilter("methodId", value)}
            data={methodOptions}
            placeholder="Alle metoder"
            clearable
            searchable
          />
          <AppSelect
            value={filters.projectNo}
            onChange={(value) => setFilter("projectNo", value)}
            data={projectOptions}
            placeholder="Alle prosjekter"
            clearable
            searchable
          />
          <AppSelect
            value={filters.year}
            onChange={(value) => setFilter("year", value)}
            data={yearOptions}
            placeholder="Alle år"
            clearable
          />
          <AppSelect
            value={filters.welderId}
            onChange={(value) => setFilter("welderId", value)}
            data={welderOptions}
            placeholder="Alle sveisere"
            clearable
            searchable
          />
          <AppSelect
            value={filters.result}
            onChange={(value) => setFilter("result", value === "ok" || value === "fault" ? value : "")}
            data={NDT_RESULT_OPTIONS}
            placeholder="Alle resultater"
            clearable
          />
          <AppTextInput
            value={filters.query}
            onChange={(value) => setFilter("query", value)}
            placeholder="Søk fil, prosjekt, kunde, kontrollør..."
          />
        </SimpleGrid>

        <AppAsyncState
          error={error}
          loading={loading}
          isEmpty={rows.length === 0}
          onRetry={onRetry}
          emptyMessage={hasFilters ? "Ingen rapporter matcher valgte filtre." : "Ingen NDT-rapporter registrert."}
        >
          <Table.ScrollContainer minWidth={1160}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Fil</Table.Th>
                  <Table.Th>Metode</Table.Th>
                  <Table.Th>Prosjekt</Table.Th>
                  <Table.Th>Kunde</Table.Th>
                  <Table.Th>NDT-firma</Table.Th>
                  <Table.Th>Kontrollør</Table.Th>
                  <Table.Th>Sveisere</Table.Th>
                  <Table.Th>Rapportdato</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => {
                  const fileRef = row.file_id;
                  const fileLabel = trimOrEmpty(row.file?.label) || "Rapport";
                  const fileTitle = fileLabel.replace(/\.pdf$/i, "");
                  const projectNo = trimOrEmpty(row.title);
                  const projectName = projectNameByNo.get(projectNo) ?? "";
                  const projectLabel = projectName ? `${projectNo} - ${projectName}` : projectNo || "-";
                  const methodLabel = trimOrEmpty(row.method?.code) || trimOrEmpty(row.method?.label) || "Ukjent";
                  const isFault = isFaultReport(row);
                  const actionItems: AppActionsMenuItem[] = [
                    {
                      key: `open-pdf-${row.id}`,
                      label: fileRef ? "Åpne PDF" : "Åpne PDF (mangler fil)",
                      icon: <IconEye size={16} />,
                      disabled: !fileRef,
                      onClick: () => onOpenPdf(fileRef, fileLabel),
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
                        <AppButton
                          tone="neutral"
                          size="xs"
                          disabled={!fileRef}
                          title={fileRef ? fileTitle : "Ingen PDF"}
                          onClick={() => onOpenPdf(fileRef, fileLabel)}
                        >
                          {truncateLabel(fileTitle || "Rapport", 16)}
                        </AppButton>
                      </Table.Td>
                      <Table.Td>
                        <AppMethodBadge methodKey={methodLabel} label={methodLabel} />
                      </Table.Td>
                      <Table.Td>{projectLabel}</Table.Td>
                      <Table.Td>{trimOrEmpty(row.customer) || "-"}</Table.Td>
                      <Table.Td>{trimOrEmpty(row.ndt_supplier?.name) || "-"}</Table.Td>
                      <Table.Td>{trimOrEmpty(row.ndt_inspector?.name) || "-"}</Table.Td>
                      <Table.Td>{formatReportWelderList(row.report_welders || [])}</Table.Td>
                      <Table.Td>{fmtDate(row.report_date ?? row.created_at)}</Table.Td>
                      <Table.Td>
                        <AppStatusBadge tone={isFault ? "danger" : "success"}>
                          {isFault ? "Avvist" : "Godkjent"}
                        </AppStatusBadge>
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
}

import { Group, Table } from "@mantine/core";
import { AppActionsMenu, createDeleteAction, createEditAction } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppLinkButton } from "@react/ui/AppLinkButton";
import { AppPaginationToolbar } from "@react/ui/AppPaginationToolbar";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";
import { routePath } from "@react/router/routes";
import type { ProjectRow } from "../projects.types";

type ProjectsTableProps = {
  rows: ProjectRow[];
  loading: boolean;
  error: string | null;
  hasFilters: boolean;
  isAdmin: boolean;
  page: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEdit: (row: ProjectRow) => void;
  onDelete: (row: ProjectRow) => void;
};

export function ProjectsTable({
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
  onEdit,
  onDelete,
}: ProjectsTableProps) {
  return (
    <AppAsyncState
      loading={loading}
      error={error}
      isEmpty={rows.length === 0}
      emptyMessage={hasFilters ? "Ingen prosjekter matcher valgte filtre." : "Ingen prosjekter."}
    >
      <Table.ScrollContainer minWidth={980}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Prosjektnr</Table.Th>
              <Table.Th>Arbeidsordre</Table.Th>
              <Table.Th>Navn</Table.Th>
              <Table.Th>Kunde</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>
                  <AppLinkButton to={routePath.projectDetails(row.id)} size="xs">
                    {row.project_no}
                  </AppLinkButton>
                </Table.Td>
                <Table.Td>{row.work_order || "-"}</Table.Td>
                <Table.Td>{row.name || "-"}</Table.Td>
                <Table.Td>{row.customer || "-"}</Table.Td>
                <Table.Td>
                  <AppStatusBadge tone={row.is_active ? "success" : "warning"}>
                    {row.is_active ? "Aktiv" : "Inaktiv"}
                  </AppStatusBadge>
                </Table.Td>
                <Table.Td>
                  {isAdmin ? (
                    <Group justify="flex-end" wrap="nowrap">
                      <AppActionsMenu
                        title={`Handlinger for prosjekt ${row.project_no}`}
                        items={[
                          createEditAction({ onClick: () => onEdit(row), label: "Endre" }),
                          createDeleteAction({ onClick: () => onDelete(row), label: "Slett" }),
                        ]}
                      />
                    </Group>
                  ) : null}
                </Table.Td>
              </Table.Tr>
            ))}
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
  );
}

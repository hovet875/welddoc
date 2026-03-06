import type { UserRow } from "../users.types";
import { Alert, Group, Table, Text } from "@mantine/core";
import { AppActionsMenu, createActivateAction, createDeactivateAction, createEditAction } from "@react/ui/AppActionsMenu";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";

type UsersTableProps = {
  rows: UserRow[];
  loading: boolean;
  error: string | null;
  currentUserId: string | null;
  onEdit: (user: UserRow) => void;
  onToggle: (user: UserRow) => void;
};

export function UsersTable({ rows, loading, error, currentUserId, onEdit, onToggle }: UsersTableProps) {
  if (loading) return <Text c="dimmed">Laster...</Text>;
  if (error) return <Alert color="red" variant="light" title="Feil">{error}</Alert>;
  if (rows.length === 0) return <Text c="dimmed">Ingen brukere.</Text>;

  return (
    <Table.ScrollContainer minWidth={920}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Visningsnavn</Table.Th>
            <Table.Th>E-post</Table.Th>
            <Table.Th>Stilling</Table.Th>
            <Table.Th>Sveiser ID</Table.Th>
            <Table.Th>Rolle</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {rows.map((row) => {
            const isInactive = row.login_enabled === false;
            const isSelf = currentUserId === row.id;
            const statusLabel = isInactive ? "Inaktiv" : "Aktiv";
            return (
              <Table.Tr key={row.id}>
                <Table.Td>{row.display_name ?? ""}</Table.Td>
                <Table.Td>{row.email ?? ""}</Table.Td>
                <Table.Td>{row.job_title ?? ""}</Table.Td>
                <Table.Td>{row.welder_no ?? ""}</Table.Td>
                <Table.Td>{row.role ?? ""}</Table.Td>
                <Table.Td>
                  <AppStatusBadge tone={isInactive ? "warning" : "success"}>{statusLabel}</AppStatusBadge>
                </Table.Td>
                <Table.Td>
                  <Group justify="flex-end" wrap="nowrap">
                    <AppActionsMenu
                      title={`Handlinger for ${row.display_name ?? row.email ?? "Bruker"}`}
                      items={[
                        createEditAction({
                          onClick: () => onEdit(row),
                        }),
                        isInactive
                          ? createActivateAction({
                              key: "toggle",
                              disabled: isSelf,
                              onClick: () => onToggle(row),
                            })
                          : createDeactivateAction({
                              key: "toggle",
                              disabled: isSelf,
                              onClick: () => onToggle(row),
                            }),
                      ]}
                    />
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

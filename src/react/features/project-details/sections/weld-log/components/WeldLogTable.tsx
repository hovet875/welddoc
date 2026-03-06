import { useMemo } from "react";
import { Group, ScrollArea, Table, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { ProjectWeldRow } from "@/repo/weldLogRepo";
import { AppActionsMenu, createDeleteAction, createEditAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppCheckbox } from "@react/ui/AppCheckbox";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";
import { formatNorDate, sortRowsByWeldNo, statusLabel } from "../lib/weldLogUtils";

type WeldLogTableProps = {
  rows: ProjectWeldRow[];
  isAdmin: boolean;
  welderCertNoById: Map<string, string>;
  selectedIds: Set<string>;
  onToggleAll: (checked: boolean) => void;
  onToggleRow: (rowId: string, checked: boolean) => void;
  onOpenInfo: (row: ProjectWeldRow) => void;
  onOpenEdit: (row: ProjectWeldRow) => void;
  onDelete: (row: ProjectWeldRow) => void;
};

function traceCode(typeCode: string | null | undefined, codeIndex: number | null | undefined) {
  const base = String(typeCode ?? "").trim();
  if (!base) return "";
  return `${base}${codeIndex ?? ""}`;
}

function renderComponentPair(row: ProjectWeldRow) {
  const left = traceCode(row.component_a?.type_code, row.component_a?.code_index);
  const right = traceCode(row.component_b?.type_code, row.component_b?.code_index);
  if (left && right) return `${left} ↔ ${right}`;
  return left || right || "—";
}

function renderFiller(row: ProjectWeldRow) {
  const filler = traceCode(row.filler?.type_code, row.filler?.code_index);
  return filler || "—";
}

function certIndicator(row: ProjectWeldRow, welderCertNoById: Map<string, string>) {
  if (row.welder_cert_id) {
    return <AppStatusBadge tone="success">{welderCertNoById.get(row.welder_cert_id) || row.welder_cert_id}</AppStatusBadge>;
  }
  if (row.welder_id) {
    return <AppStatusBadge tone="warning">Mangler</AppStatusBadge>;
  }
  return <AppStatusBadge tone="danger">Ingen sveiser</AppStatusBadge>;
}

function wpsIndicator(row: ProjectWeldRow) {
  if (row.wps_id || row.wps?.doc_no) {
    return <AppStatusBadge tone="success">{row.wps?.doc_no || row.wps_id || "WPS"}</AppStatusBadge>;
  }
  return <AppStatusBadge tone="danger">Mangler</AppStatusBadge>;
}

function ndtStatus(row: ProjectWeldRow) {
  const hasVt = Boolean(row.visual_report_id || row.visual_inspector);
  const hasPt = Boolean(row.crack_report_id);
  const hasVol = Boolean(row.volumetric_report_id);
  const readyCount = [hasVt, hasPt, hasVol].filter(Boolean).length;

  if (readyCount === 3) {
    return {
      tone: "success" as const,
      label: "Komplett",
      hint: "VT, PT/MT og VOL er registrert.",
    };
  }

  if (readyCount === 0) {
    return {
      tone: "neutral" as const,
      label: "Ingen",
      hint: "Ingen NDT-data registrert.",
    };
  }

  return {
    tone: "warning" as const,
    label: `Delvis (${readyCount}/3)`,
    hint: `VT: ${hasVt ? "Klar" : "Mangler"} · PT: ${hasPt ? "Klar" : "Mangler"} · VOL: ${hasVol ? "Klar" : "Mangler"}`,
  };
}

export function WeldLogTable({
  rows,
  isAdmin,
  welderCertNoById,
  selectedIds,
  onToggleAll,
  onToggleRow,
  onOpenInfo,
  onOpenEdit,
  onDelete,
}: WeldLogTableProps) {
  const sortedRows = useMemo(() => sortRowsByWeldNo(rows), [rows]);
  const allChecked = sortedRows.length > 0 && sortedRows.every((row) => selectedIds.has(row.id));

  return (
    <ScrollArea type="auto" offsetScrollbars>
      <Table highlightOnHover withRowBorders={false} stickyHeader stickyHeaderOffset={0} miw={1180}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={42}>
              <AppCheckbox checked={allChecked} onChange={onToggleAll} />
            </Table.Th>
            <Table.Th>
              <Group gap={6} wrap="nowrap">
                Sveis ID
              </Group>
            </Table.Th>
            <Table.Th>
              <Group gap={6} wrap="nowrap">
                Fuge
              </Group>
            </Table.Th>
            <Table.Th>Komponent</Table.Th>
            <Table.Th>
              <Group gap={6} wrap="nowrap">
                Sveiser
              </Group>
            </Table.Th>
            <Table.Th>
              <Group gap={6} wrap="nowrap">
                Sertifikat
              </Group>
            </Table.Th>
            <Table.Th>
              <Group gap={6} wrap="nowrap">
                WPS
              </Group>
            </Table.Th>
            <Table.Th>
              <Group gap={6} wrap="nowrap">
                Dato
              </Group>
            </Table.Th>
            <Table.Th>
              <Group gap={6} wrap="nowrap">
                Tilsett
              </Group>
            </Table.Th>
            <Table.Th>NDT</Table.Th>
            <Table.Th>
              <Group gap={6} wrap="nowrap">
                Status
              </Group>
            </Table.Th>
            <Table.Th w={70}></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sortedRows.map((row) => {
            const selected = selectedIds.has(row.id);
            const ndt = ndtStatus(row);

            const menuItems: AppActionsMenuItem[] = [
              {
                key: "info",
                label: "Info",
                icon: <IconEye size={16} />,
                onClick: () => onOpenInfo(row),
              },
            ];

            if (isAdmin) {
              menuItems.push(
                createEditAction({
                  onClick: () => onOpenEdit(row),
                }),
                createDeleteAction({
                  onClick: () => onDelete(row),
                })
              );
            }

            return (
              <Table.Tr key={row.id}>
                <Table.Td>
                  <AppCheckbox checked={selected} onChange={(checked) => onToggleRow(row.id, checked)} />
                </Table.Td>
                <Table.Td>
                  <UnstyledButton onClick={() => onOpenEdit(row)}>{row.weld_no}</UnstyledButton>
                </Table.Td>
                <Table.Td>{row.joint_type || "—"}</Table.Td>
                <Table.Td>
                  <Text size="sm" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
                    {renderComponentPair(row)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
                    {row.welder ? [row.welder.welder_no, row.welder.display_name].filter(Boolean).join(" - ") : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>{certIndicator(row, welderCertNoById)}</Table.Td>
                <Table.Td>
                  <Group gap={6}>{wpsIndicator(row)}</Group>
                </Table.Td>
                <Table.Td>{formatNorDate(row.weld_date)}</Table.Td>
                <Table.Td>{renderFiller(row)}</Table.Td>
                <Table.Td>
                  <Tooltip label={ndt.hint}>
                    <span>
                      <AppStatusBadge tone={ndt.tone}>{ndt.label}</AppStatusBadge>
                    </span>
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <AppStatusBadge tone={row.status ? "success" : "warning"}>{statusLabel(row.status)}</AppStatusBadge>
                </Table.Td>
                <Table.Td>
                  <Group justify="flex-end" wrap="nowrap">
                    <AppActionsMenu title="Sveis handlinger" items={menuItems} size={30} />
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

import { Divider, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import {
  IconCalendarEvent,
  IconChecklist,
  IconFlask,
  IconGitBranch,
  IconProgressCheck,
  IconRadar,
  IconUser,
} from "@tabler/icons-react";
import type { ProjectWeldRow } from "@/repo/weldLogRepo";
import { AppModal } from "@react/ui/AppModal";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";
import { formatNorDate, statusLabel } from "../lib/weldLogUtils";

type WeldLogInfoModalProps = {
  opened: boolean;
  row: ProjectWeldRow | null;
  onClose: () => void;
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <Stack gap={2}>
    <Text size="xs" c="dimmed">
      {label}
    </Text>
    <Text size="sm">{value || "—"}</Text>
  </Stack>
);

type InfoSectionProps = {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
};

function InfoSection({ icon, title, children }: InfoSectionProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group gap="xs" align="center">
          {icon}
          <Text size="sm" c="dimmed">
            {title}
          </Text>
        </Group>
        <Divider />
        {children}
      </Stack>
    </Paper>
  );
}

export function WeldLogInfoModal({ opened, row, onClose }: WeldLogInfoModalProps) {
  const status = row ? statusLabel(row.status) : "";
  const componentValue = row
    ? [
        `${row.component_a?.type_code ?? ""}${row.component_a?.code_index ?? ""}`,
        `${row.component_b?.type_code ?? ""}${row.component_b?.code_index ?? ""}`,
      ]
        .filter((part) => part.trim())
        .join(" ↔ ")
    : "";
  const welderValue = [row?.welder?.welder_no, row?.welder?.display_name].filter(Boolean).join(" - ");
  const fillerValue = `${row?.filler?.type_code ?? ""}${row?.filler?.code_index ?? ""}`;

  return (
    <AppModal opened={opened} onClose={onClose} title={row ? `Sveis ${row.weld_no}` : "Sveisdetaljer"} size="xl">
      <Stack gap="md">
        {row ? (
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              Detaljvisning for valgt sveis
            </Text>
            <AppStatusBadge tone={row.status ? "success" : "warning"}>{status}</AppStatusBadge>
          </Group>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" verticalSpacing="md">
          <InfoSection icon={<IconChecklist size={14} />} title="Sveisdata">
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" verticalSpacing="sm">
              <InfoRow label="Status" value={status} />
              <InfoRow label="Dato" value={formatNorDate(row?.weld_date)} />
              <InfoRow label="Fuge" value={row?.joint_type ?? ""} />
              <InfoRow label="Komponent" value={componentValue} />
            </SimpleGrid>
          </InfoSection>

          <InfoSection icon={<IconUser size={14} />} title="Produksjon">
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" verticalSpacing="sm">
              <InfoRow label="Sveiser" value={welderValue} />
              <InfoRow label="WPS" value={row?.wps?.doc_no ?? ""} />
              <InfoRow label="Tilsett" value={fillerValue} />
            </SimpleGrid>
          </InfoSection>

          <InfoSection icon={<IconRadar size={14} />} title="Kontroll og NDT">
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" verticalSpacing="sm">
              <InfoRow label="VT" value={row?.visual_report?.file?.label ?? row?.visual_inspector ?? ""} />
              <InfoRow label="PT" value={row?.crack_report?.file?.label ?? ""} />
              <InfoRow label="VOL" value={row?.volumetric_report?.file?.label ?? ""} />
            </SimpleGrid>
          </InfoSection>

          <InfoSection icon={<IconProgressCheck size={14} />} title="Hurtigstatus">
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm" verticalSpacing="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  <IconChecklist size={12} />
                  <Text size="xs">WPS</Text>
                </Group>
                <AppStatusBadge tone={row?.wps_id ? "success" : "danger"}>{row?.wps_id ? "Valgt" : "Mangler"}</AppStatusBadge>
              </Group>

              <Group justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  <IconGitBranch size={12} />
                  <Text size="xs">Fuge</Text>
                </Group>
                <AppStatusBadge tone={row?.joint_type ? "success" : "danger"}>{row?.joint_type ? "Satt" : "Mangler"}</AppStatusBadge>
              </Group>

              <Group justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  <IconFlask size={12} />
                  <Text size="xs">Tilsett</Text>
                </Group>
                <AppStatusBadge tone={row?.filler_traceability_id ? "success" : "neutral"}>{row?.filler_traceability_id ? "Satt" : "Ikke satt"}</AppStatusBadge>
              </Group>

              <Group justify="space-between" wrap="nowrap">
                <Group gap={6} wrap="nowrap">
                  <IconCalendarEvent size={12} />
                  <Text size="xs">Dato</Text>
                </Group>
                <AppStatusBadge tone={row?.weld_date ? "success" : "danger"}>{row?.weld_date ? "Satt" : "Mangler"}</AppStatusBadge>
              </Group>
            </SimpleGrid>
          </InfoSection>
        </SimpleGrid>
      </Stack>
    </AppModal>
  );
}

import { SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { AppTextInput } from "@react/ui/AppTextInput";
import type { NdtWelderStatsDraft } from "../lib/ndtForm";

type NdtRtWelderStatsFieldsProps = {
  welderIds: string[];
  welderLabelById: Map<string, string>;
  welderStats: NdtWelderStatsDraft;
  onChangeStat: (welderId: string, key: "weldCount" | "defectCount", value: string) => void;
  variant?: "table" | "grid";
  title?: string;
  emptyMessage?: string;
  helperText?: string;
};

export function NdtRtWelderStatsFields({
  welderIds,
  welderLabelById,
  welderStats,
  onChangeStat,
  variant = "table",
  title = "Fordeling pr sveiser (RT)",
  emptyMessage = "Velg minst en sveiser for RT.",
  helperText = "For RT er antall sveis og feil per sveiser påkrevd.",
}: NdtRtWelderStatsFieldsProps) {
  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        {title}
      </Text>

      {welderIds.length === 0 ? (
        <Text c="dimmed" size="sm">
          {emptyMessage}
        </Text>
      ) : variant === "table" ? (
        <Table.ScrollContainer minWidth={560}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Sveiser</Table.Th>
                <Table.Th>Antall sveis</Table.Th>
                <Table.Th>Antall feil</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {welderIds.map((welderId) => {
                const draft = welderStats[welderId] ?? { weldCount: "", defectCount: "" };
                const welderLabel = welderLabelById.get(welderId) ?? welderId;

                return (
                  <Table.Tr key={welderId}>
                    <Table.Td>{welderLabel}</Table.Td>
                    <Table.Td>
                      <AppTextInput
                        value={draft.weldCount}
                        onChange={(value) => onChangeStat(welderId, "weldCount", value)}
                        type="number"
                        min={0}
                        step={1}
                        placeholder="0"
                      />
                    </Table.Td>
                    <Table.Td>
                      <AppTextInput
                        value={draft.defectCount}
                        onChange={(value) => onChangeStat(welderId, "defectCount", value)}
                        type="number"
                        min={0}
                        step={1}
                        placeholder="0"
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        welderIds.map((welderId) => {
          const draft = welderStats[welderId] ?? { weldCount: "", defectCount: "" };
          const welderLabel = welderLabelById.get(welderId) ?? welderId;

          return (
            <SimpleGrid key={welderId} cols={{ base: 1, md: 3 }} spacing="xs">
              <Text size="sm" c="dimmed" mt={6}>
                {welderLabel}
              </Text>
              <AppTextInput
                type="number"
                min={0}
                step={1}
                placeholder="Antall sveis"
                value={draft.weldCount}
                onChange={(value) => onChangeStat(welderId, "weldCount", value)}
              />
              <AppTextInput
                type="number"
                min={0}
                step={1}
                placeholder="Antall feil"
                value={draft.defectCount}
                onChange={(value) => onChangeStat(welderId, "defectCount", value)}
              />
            </SimpleGrid>
          );
        })
      )}

      <Text c="dimmed" size="sm">
        {helperText}
      </Text>
    </Stack>
  );
}

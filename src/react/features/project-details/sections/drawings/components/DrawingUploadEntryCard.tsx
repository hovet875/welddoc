import { Badge, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconEye, IconTrash } from "@tabler/icons-react";
import { AppButton } from "@react/ui/AppButton";
import { AppNumberInput } from "@react/ui/AppNumberInput";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import { normalizeButtWeldCountInput, REVISION_OPTIONS } from "../lib/drawingsUtils";
import type { UploadEntry } from "../types";

type DrawingUploadEntryCardProps = {
  entry: UploadEntry;
  disabled?: boolean;
  onChangeDrawingNo: (entryId: string, drawingNo: string) => void;
  onChangeRevision: (entryId: string, revision: string) => void;
  onChangeButtWeldCount: (entryId: string, buttWeldCount: string) => void;
  onPreview: (entry: UploadEntry) => void;
  onRemove: (entryId: string) => void;
};

export function DrawingUploadEntryCard({
  entry,
  disabled = false,
  onChangeDrawingNo,
  onChangeRevision,
  onChangeButtWeldCount,
  onPreview,
  onRemove,
}: DrawingUploadEntryCardProps) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Badge variant="light" color="gray" radius="xl">
              Lokal
            </Badge>
            <Text fw={600}>{entry.file.name}</Text>
          </Stack>

          <Group gap="xs">
            <AppButton
              tone="neutral"
              size="sm"
              leftSection={<IconEye size={14} />}
              onClick={() => onPreview(entry)}
              disabled={disabled}
            >
              Forhåndsvis
            </AppButton>
            <AppButton
              tone="danger"
              size="sm"
              leftSection={<IconTrash size={14} />}
              onClick={() => onRemove(entry.id)}
              disabled={disabled}
            >
              Fjern
            </AppButton>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
          <AppTextInput
            label="Tegningsnr."
            value={entry.drawingNo}
            onChange={(value) => onChangeDrawingNo(entry.id, value)}
            placeholder="f.eks. 100-0101"
            disabled={disabled}
          />
          <AppSelect
            label="Revisjon"
            value={entry.revision}
            onChange={(value) => onChangeRevision(entry.id, value)}
            data={REVISION_OPTIONS.map((option) => ({ value: option, label: option }))}
            searchable={false}
            allowDeselect={false}
            disabled={disabled}
          />
          <AppNumberInput
            label="Buttsveiser"
            value={entry.buttWeldCount}
            onChange={(value) => onChangeButtWeldCount(entry.id, normalizeButtWeldCountInput(value))}
            min={0}
            placeholder="f.eks. 12"
            disabled={disabled}
          />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

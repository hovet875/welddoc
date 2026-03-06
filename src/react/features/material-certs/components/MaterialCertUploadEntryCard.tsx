import { memo } from "react";
import { Badge, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import type { MaterialCertificateType } from "@/repo/materialCertificateRepo";
import { AppAutocomplete } from "@react/ui/AppAutocomplete";
import { AppButton } from "@react/ui/AppButton";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTagsInput } from "@react/ui/AppTagsInput";
import { normalizeHeatNumbers, type SelectOption } from "../lib/materialCertsView";
import { uploadEntryFileName, type MaterialCertUploadEntryDraft } from "../lib/materialCertsUpload";
import { withCurrentOption } from "../lib/materialCertsView";

type MaterialCertUploadEntryCardProps = {
  entry: MaterialCertUploadEntryDraft;
  certificateType: MaterialCertificateType;
  materialOptions: SelectOption[];
  fillerTypeOptions: SelectOption[];
  supplierSuggestions: string[];
  disabled?: boolean;
  onChange: (entryId: string, patch: Partial<MaterialCertUploadEntryDraft>) => void;
  onPreview: (entry: MaterialCertUploadEntryDraft) => void;
  onRemove: (entry: MaterialCertUploadEntryDraft) => void;
};

export const MaterialCertUploadEntryCard = memo(function MaterialCertUploadEntryCard({
  entry,
  certificateType,
  materialOptions,
  fillerTypeOptions,
  supplierSuggestions,
  disabled = false,
  onChange,
  onPreview,
  onRemove,
}: MaterialCertUploadEntryCardProps) {
  const effectiveFillerOptions = withCurrentOption(fillerTypeOptions, entry.fillerType);
  const sourceLabel = entry.source.kind === "inbox" ? "Inbox" : "Lokal";

  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Group gap="xs">
              <Badge variant="light" color={entry.source.kind === "inbox" ? "blue" : "gray"} radius="xl">
                {sourceLabel}
              </Badge>
            </Group>
            <Text fw={600}>{uploadEntryFileName(entry)}</Text>
          </Stack>

          <Group gap="xs">
            <AppButton tone="neutral" size="sm" onClick={() => onPreview(entry)} disabled={disabled}>
              Forhåndsvis
            </AppButton>
            <AppButton tone="danger" size="sm" onClick={() => onRemove(entry)} disabled={disabled}>
              Fjern
            </AppButton>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {certificateType === "material" ? (
            <AppSelect
              label="Material"
              value={entry.materialId}
              onChange={(value) => onChange(entry.id, { materialId: value })}
              data={materialOptions}
              placeholder="Velg material..."
              searchable
              disabled={disabled}
            />
          ) : (
            <AppSelect
              label="Sveisetilsett-type"
              value={entry.fillerType}
              onChange={(value) => onChange(entry.id, { fillerType: value })}
              data={effectiveFillerOptions}
              placeholder="Velg type..."
              searchable
              disabled={disabled}
            />
          )}
          <AppAutocomplete
            label="Leverandør"
            value={entry.supplier}
            onChange={(value) => onChange(entry.id, { supplier: value })}
            data={supplierSuggestions}
            placeholder="Leverandør"
            disabled={disabled}
            mobileSearchable
          />
        </SimpleGrid>

        <AppTagsInput
          label="Heat nr."
          description="Trykk Enter, komma eller lim inn flere verdier. Hver verdi blir eget heat."
          value={entry.heatNumbers}
          onChange={(value) => onChange(entry.id, { heatNumbers: normalizeHeatNumbers(value) })}
          placeholder="Legg til heat nr."
          disabled={disabled}
        />
      </Stack>
    </Paper>
  );
});

import { Alert, Badge, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconEye, IconTrash, IconUpload } from "@tabler/icons-react";
import type { NdtInspectorRow } from "@/repo/ndtSupplierRepo";
import type { NdtMethodRow, NdtReportRow } from "@/repo/ndtReportRepo";
import { AppButton } from "@react/ui/AppButton";
import { AppDateInput } from "@react/ui/AppDateInput";
import { AppMultiSelect } from "@react/ui/AppMultiSelect";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import { withCurrentOption } from "../lib/ndtOptions";
import { type NdtUploadEntryDraft, findPotentialDuplicateReport, looksWeakSourceName } from "../lib/ndtUpload";
import { trimOrEmpty, type SelectOption } from "../lib/ndtView";
import { NdtRtWelderStatsFields } from "./NdtRtWelderStatsFields";

type NdtUploadEntryCardProps = {
  entry: NdtUploadEntryDraft;
  reports: NdtReportRow[];
  methodById: Map<string, NdtMethodRow>;
  methodOptionsBase: SelectOption[];
  projectOptionsBase: SelectOption[];
  customerOptionsBase: SelectOption[];
  supplierOptionsBase: SelectOption[];
  welderOptionsBase: SelectOption[];
  welderLabelById: Map<string, string>;
  projectCustomerByNo: Map<string, string>;
  ndtInspectors: NdtInspectorRow[];
  isUploading: boolean;
  uploadingAll: boolean;
  onUpdateEntry: (entryId: string, updater: (entry: NdtUploadEntryDraft) => NdtUploadEntryDraft) => void;
  onPreview: (entry: NdtUploadEntryDraft) => void;
  onUpload: (entry: NdtUploadEntryDraft) => void;
  onRemove: (entry: NdtUploadEntryDraft) => void;
};

function entryName(entry: NdtUploadEntryDraft) {
  return entry.source.kind === "local" ? entry.source.file.name : entry.source.fileName;
}

export function NdtUploadEntryCard({
  entry,
  reports,
  methodById,
  methodOptionsBase,
  projectOptionsBase,
  customerOptionsBase,
  supplierOptionsBase,
  welderOptionsBase,
  welderLabelById,
  projectCustomerByNo,
  ndtInspectors,
  isUploading,
  uploadingAll,
  onUpdateEntry,
  onPreview,
  onUpload,
  onRemove,
}: NdtUploadEntryCardProps) {
  const fileName = entryName(entry);
  const duplicate = findPotentialDuplicateReport(reports, entry.sourceName);
  const duplicateLabel = trimOrEmpty(duplicate?.file?.label);
  const methodCode = trimOrEmpty(methodById.get(entry.methodId)?.code).toUpperCase();
  const isRtMethod = methodCode === "RT";

  const inspectorOptionsBase = entry.supplierId
    ? ndtInspectors
        .filter((inspector) => inspector.supplier_id === entry.supplierId)
        .map((inspector) => ({
          value: inspector.id,
          label: trimOrEmpty(inspector.name) || inspector.id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }))
    : [];

  const methodOptions = withCurrentOption(methodOptionsBase, entry.methodId, entry.methodId);
  const projectOptions = withCurrentOption(projectOptionsBase, entry.title, entry.title);
  const customerOptions = withCurrentOption(customerOptionsBase, entry.customer, entry.customer);
  const supplierOptions = withCurrentOption(supplierOptionsBase, entry.supplierId, entry.supplierId);
  const inspectorOptions = withCurrentOption(inspectorOptionsBase, entry.inspectorId, entry.inspectorId);

  const existingWelderIds = new Set(welderOptionsBase.map((option) => option.value));
  const missingWelders = entry.welderIds
    .filter((welderId) => !existingWelderIds.has(welderId))
    .map((welderId) => ({ value: welderId, label: welderId }));
  const welderOptions = [...welderOptionsBase, ...missingWelders];

  return (
    <Paper withBorder radius="md" p="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="sm" wrap="wrap">
          <Stack gap={4}>
            <Text fw={600}>{fileName}</Text>
            <Group gap={6}>
              <Badge variant="light" color={entry.source.kind === "inbox" ? "yellow" : "brand"}>
                {entry.source.kind === "inbox" ? "Inbox" : "Lokal"}
              </Badge>
              {looksWeakSourceName(entry.sourceName) ? (
                <Badge variant="light" color="red">
                  Sjekk rapportnr
                </Badge>
              ) : null}
            </Group>
          </Stack>

          <Group gap="xs">
            <AppButton
              tone="neutral"
              size="xs"
              leftSection={<IconEye size={14} />}
              onClick={() => onPreview(entry)}
              disabled={isUploading || uploadingAll}
            >
              Vis
            </AppButton>
            <AppButton
              tone="primary"
              size="xs"
              leftSection={<IconUpload size={14} />}
              onClick={() => onUpload(entry)}
              loading={isUploading}
              disabled={uploadingAll}
            >
              Last opp
            </AppButton>
            <AppButton
              tone="danger"
              size="xs"
              leftSection={<IconTrash size={14} />}
              onClick={() => onRemove(entry)}
              disabled={isUploading || uploadingAll}
            >
              Fjern
            </AppButton>
          </Group>
        </Group>

        {duplicate ? (
          <Alert color="yellow" variant="light">
            Mulig duplikat i registeret{duplicateLabel ? `: ${duplicateLabel}` : "."}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <AppTextInput
            label="Rapportnr"
            value={entry.sourceName}
            onChange={(value) => onUpdateEntry(entry.id, (current) => ({ ...current, sourceName: value }))}
            placeholder="f.eks. MT-25-1754"
          />
          <AppSelect
            label="Prosjektnr"
            value={entry.title}
            onChange={(value) =>
              onUpdateEntry(entry.id, (current) => ({
                ...current,
                title: value,
                customer: projectCustomerByNo.get(value) || current.customer,
              }))
            }
            data={projectOptions}
            placeholder="Velg prosjekt..."
            searchable
          />
          <AppSelect
            label="Kunde"
            value={entry.customer}
            onChange={(value) => onUpdateEntry(entry.id, (current) => ({ ...current, customer: value }))}
            data={customerOptions}
            placeholder="Velg kunde..."
            searchable
          />
          <AppDateInput
            label="Rapportdato"
            value={entry.reportDate}
            onChange={(value) => onUpdateEntry(entry.id, (current) => ({ ...current, reportDate: value }))}
          />
          <AppSelect
            label="NDT-metode"
            value={entry.methodId}
            onChange={(value) => onUpdateEntry(entry.id, (current) => ({ ...current, methodId: value }))}
            data={methodOptions}
            placeholder="Velg metode..."
            searchable
          />
          <AppSelect
            label="NDT-firma"
            value={entry.supplierId}
            onChange={(value) =>
              onUpdateEntry(entry.id, (current) => {
                const inspectorStillValid = ndtInspectors.some(
                  (inspector) => inspector.id === current.inspectorId && inspector.supplier_id === value
                );
                return {
                  ...current,
                  supplierId: value,
                  inspectorId: inspectorStillValid ? current.inspectorId : "",
                };
              })
            }
            data={supplierOptions}
            placeholder="Velg firma..."
            searchable
            clearable
          />
          <AppSelect
            label="NDT-kontrollør"
            value={entry.inspectorId}
            onChange={(value) => onUpdateEntry(entry.id, (current) => ({ ...current, inspectorId: value }))}
            data={inspectorOptions}
            placeholder={entry.supplierId ? "Velg kontrollør..." : "Velg firma først"}
            searchable
            clearable
            disabled={!entry.supplierId}
          />
          <AppMultiSelect
            label="Sveisere"
            value={entry.welderIds}
            onChange={(nextWelderIds) =>
              onUpdateEntry(entry.id, (current) => {
                const nextStats: Record<string, { weldCount: string; defectCount: string }> = {};
                for (const welderId of nextWelderIds) {
                  nextStats[welderId] = current.welderStats[welderId] ?? { weldCount: "", defectCount: "" };
                }
                return {
                  ...current,
                  welderIds: nextWelderIds,
                  welderStats: nextStats,
                };
              })
            }
            data={welderOptions}
            placeholder="Velg en eller flere sveisere..."
            searchable
            clearable
            nothingFoundMessage="Ingen treff"
          />
        </SimpleGrid>

        {isRtMethod ? (
          <NdtRtWelderStatsFields
            welderIds={entry.welderIds}
            welderLabelById={welderLabelById}
            welderStats={entry.welderStats}
            onChangeStat={(welderId, key, value) =>
              onUpdateEntry(entry.id, (current) => ({
                ...current,
                welderStats: {
                  ...current.welderStats,
                  [welderId]: {
                    weldCount:
                      key === "weldCount" ? value : current.welderStats[welderId]?.weldCount ?? "",
                    defectCount:
                      key === "defectCount" ? value : current.welderStats[welderId]?.defectCount ?? "",
                  },
                },
              }))
            }
            variant="grid"
            helperText="For RT må antall sveis og feil per sveiser fylles ut."
          />
        ) : null}
      </Stack>
    </Paper>
  );
}

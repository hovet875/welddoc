import { useCallback, useMemo } from "react";
import { Alert, Collapse, Group, Stack, Text } from "@mantine/core";
import { IconRefresh, IconUpload } from "@tabler/icons-react";
import type { ProfileWelderRow } from "@/repo/certRepo";
import type { CustomerRow } from "@/repo/customerRepo";
import type { NdtMethodRow, NdtReportRow } from "@/repo/ndtReportRepo";
import type { NdtInspectorRow, NdtSupplierRow } from "@/repo/ndtSupplierRepo";
import type { ProjectRow } from "@/repo/projectRepo";
import { esc } from "@/utils/dom";
import { AppButton } from "@react/ui/AppButton";
import { AppPanel } from "@react/ui/AppPanel";
import { AppPdfDropzone } from "@react/ui/AppPdfDropzone";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import {
  buildCustomerOptions,
  buildMethodById,
  buildMethodOptions,
  buildProjectCustomerByNo,
  buildProjectOptions,
  buildSupplierOptions,
  buildWelderLabelById,
  buildWelderOptions,
} from "../lib/ndtOptions";
import type { NdtUploadEntryDraft } from "../lib/ndtUpload";
import { useNdtUploadQueue } from "../hooks/useNdtUploadQueue";
import { NdtUploadEntryCard } from "./NdtUploadEntryCard";

type NdtUploadPanelProps = {
  opened: boolean;
  reports: NdtReportRow[];
  methods: NdtMethodRow[];
  welders: ProfileWelderRow[];
  projects: ProjectRow[];
  customers: CustomerRow[];
  ndtSuppliers: NdtSupplierRow[];
  ndtInspectors: NdtInspectorRow[];
  onOpenPdf: (ref: string, title: string) => void;
  onUploaded: () => Promise<void>;
  onInboxCountChange?: (count: number) => void;
};

export function NdtUploadPanel({
  opened,
  reports,
  methods,
  welders,
  projects,
  customers,
  ndtSuppliers,
  ndtInspectors,
  onOpenPdf,
  onUploaded,
  onInboxCountChange,
}: NdtUploadPanelProps) {
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();
  const projectCustomerByNo = useMemo(() => buildProjectCustomerByNo(projects), [projects]);
  const methodById = useMemo(() => buildMethodById(methods), [methods]);
  const methodOptionsBase = useMemo(() => buildMethodOptions(methods), [methods]);
  const projectOptionsBase = useMemo(() => buildProjectOptions(projects), [projects]);
  const customerOptionsBase = useMemo(() => buildCustomerOptions(customers), [customers]);
  const supplierOptionsBase = useMemo(() => buildSupplierOptions(ndtSuppliers), [ndtSuppliers]);
  const welderOptionsBase = useMemo(() => buildWelderOptions(welders), [welders]);
  const welderLabelById = useMemo(() => buildWelderLabelById(welderOptionsBase), [welderOptionsBase]);

  const {
    entries,
    loadingInbox,
    uploadingAll,
    uploadingIds,
    error,
    duplicateCount,
    refreshInbox,
    updateEntry,
    handleDrop,
    handlePreviewEntry,
    handleRemoveEntry,
    handleUploadEntry,
    handleUploadAll,
    clearLocalEntries,
  } = useNdtUploadQueue({
    opened,
    reports,
    methods,
    ndtInspectors,
    onOpenPdf,
    onUploaded,
    onInboxCountChange,
  });

  const requestRemoveEntry = useCallback(
    (entry: NdtUploadEntryDraft) => {
      if (entry.source.kind !== "inbox") {
        void handleRemoveEntry(entry);
        return;
      }

      const label = entry.source.fileName;

      confirmDelete({
        title: "Slett innboksfil",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b> fra innboks og lagring?`,
        warningText: "Dette kan ikke angres.",
        onConfirm: async () => {
          await handleRemoveEntry(entry);
        },
      });
    },
    [confirmDelete, handleRemoveEntry]
  );

  return (
    <Collapse in={opened}>
      <AppPanel
        title="Filopplasting"
        meta={
          duplicateCount > 0
            ? `${entries.length} filer (${duplicateCount} mulig duplikat)`
            : `${entries.length} filer`
        }
        actions={
          <Group gap="xs" wrap="wrap">
            <AppButton
              tone="neutral"
              size="sm"
              leftSection={<IconRefresh size={14} />}
              onClick={() => void refreshInbox()}
              disabled={loadingInbox || uploadingAll}
            >
              Synk inbox
            </AppButton>
            <AppButton
              tone="neutral"
              size="sm"
              onClick={clearLocalEntries}
              disabled={entries.length === 0 || uploadingAll}
            >
              Tøm
            </AppButton>
            <AppButton
              tone="primary"
              size="sm"
              leftSection={<IconUpload size={14} />}
              onClick={() => void handleUploadAll()}
              disabled={entries.length === 0}
              loading={uploadingAll}
            >
              Last opp alle
            </AppButton>
          </Group>
        }
      >
        <Stack gap="sm">
          <AppPdfDropzone onDrop={handleDrop} disabled={uploadingAll} />

          {error ? (
            <Alert color="red" variant="light" title="Feil">
              {error}
            </Alert>
          ) : null}

          {entries.length === 0 ? <Text c="dimmed">Ingen filer i kø. Legg til PDF eller synk inbox.</Text> : null}

          {entries.map((entry) => (
            <NdtUploadEntryCard
              key={entry.id}
              entry={entry}
              reports={reports}
              methodById={methodById}
              methodOptionsBase={methodOptionsBase}
              projectOptionsBase={projectOptionsBase}
              customerOptionsBase={customerOptionsBase}
              supplierOptionsBase={supplierOptionsBase}
              welderOptionsBase={welderOptionsBase}
              welderLabelById={welderLabelById}
              projectCustomerByNo={projectCustomerByNo}
              ndtInspectors={ndtInspectors}
              isUploading={uploadingIds.has(entry.id)}
              uploadingAll={uploadingAll}
              onUpdateEntry={updateEntry}
              onPreview={handlePreviewEntry}
              onUpload={(nextEntry) => {
                void handleUploadEntry(nextEntry);
              }}
              onRemove={(nextEntry) => {
                requestRemoveEntry(nextEntry);
              }}
            />
          ))}
        </Stack>
      </AppPanel>
      {deleteConfirmModal}
    </Collapse>
  );
}


import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Group, Stack, Text } from "@mantine/core";
import { IconEye, IconTrash, IconUpload } from "@tabler/icons-react";
import { createSignedUrlForFileRef } from "@/repo/fileRepo";
import { deleteProjectWorkOrder, fetchProjectWorkOrder, type ProjectWorkOrderRow, upsertProjectWorkOrder } from "@/repo/projectWorkOrderRepo";
import { esc } from "@/utils/dom";
import { fmtDate, validatePdfFile } from "@/utils/format";
import { printPdfUrl } from "@/utils/print";
import { AppActionsMenu, createPrintAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppButton } from "@react/ui/AppButton";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppPanel } from "@react/ui/AppPanel";
import { AppPdfDropzone } from "@react/ui/AppPdfDropzone";
import { AppPdfPreviewModal, type AppPdfPreviewState } from "@react/ui/AppPdfPreviewModal";
import { notifyError, notifySuccess } from "@react/ui/notify";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";

type ProjectWorkOrderSectionProps = {
  projectId: string;
  isAdmin: boolean;
};

function formatBytes(sizeBytes: number | null | undefined) {
  if (sizeBytes == null) return "";
  if (sizeBytes < 1024) return `${sizeBytes} B`;

  const kb = sizeBytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function createPdfPreviewState(): AppPdfPreviewState {
  return {
    opened: false,
    title: "Arbeidsordre",
    url: null,
    loading: false,
    error: null,
  };
}

export function ProjectWorkOrderSection({ projectId, isAdmin }: ProjectWorkOrderSectionProps) {
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();

  const [row, setRow] = useState<ProjectWorkOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [pdfPreview, setPdfPreview] = useState<AppPdfPreviewState>(() => createPdfPreviewState());

  const readCurrent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchProjectWorkOrder(projectId);
      setRow(next);
    } catch (err) {
      console.error(err);
      setError("Klarte ikke å hente arbeidsordre.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void readCurrent();
  }, [readCurrent]);

  const fileMeta = useMemo(() => {
    if (!row) return "";
    const parts = [fmtDate(row.created_at), formatBytes(row.file?.size_bytes ?? null)].filter(Boolean);
    return parts.join(" · ");
  }, [row]);

  const openUploadModal = useCallback(() => {
    if (!isAdmin) return;
    setSelectedFile(null);
    setUploadOpen(true);
  }, [isAdmin]);

  const closeUploadModal = useCallback(() => {
    if (uploading) return;
    setUploadOpen(false);
    setSelectedFile(null);
  }, [uploading]);

  const handleDrop = useCallback((files: File[]) => {
    const file = files[0] ?? null;
    if (!file) return;
    const validationError = validatePdfFile(file, 25);
    if (validationError) {
      notifyError(validationError);
      return;
    }
    setSelectedFile(file);
  }, []);

  const submitUpload = useCallback(async () => {
    if (!selectedFile) {
      notifyError("Velg en PDF-fil først.");
      return;
    }

    try {
      setUploading(true);
      const next = await upsertProjectWorkOrder(projectId, selectedFile);
      setRow(next);
      setUploadOpen(false);
      setSelectedFile(null);
      notifySuccess("Arbeidsordre lagret.");
    } catch (err) {
      console.error(err);
      notifyError(err instanceof Error ? err.message : "Klarte ikke å lagre arbeidsordre.");
    } finally {
      setUploading(false);
    }
  }, [projectId, selectedFile]);

  const openPdfPreview = useCallback(async () => {
    if (!row?.file_id) return;

    const title = row.file?.label || "Arbeidsordre";

    setPdfPreview({
      opened: true,
      title,
      url: null,
      loading: true,
      error: null,
    });

    try {
      const url = await createSignedUrlForFileRef(row.file_id, { expiresSeconds: 120 });
      setPdfPreview({
        opened: true,
        title,
        url,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error(err);
      setPdfPreview({
        opened: true,
        title,
        url: null,
        loading: false,
        error: err instanceof Error ? err.message : "Klarte ikke å åpne PDF-forhåndsvisning.",
      });
    }
  }, [row]);

  const closePdfPreview = useCallback(() => {
    setPdfPreview((prev) => ({
      ...prev,
      opened: false,
      loading: false,
      error: null,
      url: null,
    }));
  }, []);

  const printFile = useCallback(async () => {
    if (!row?.file_id) return;
    try {
      const url = await createSignedUrlForFileRef(row.file_id, { expiresSeconds: 120 });
      await printPdfUrl(url);
    } catch (err) {
      console.error(err);
      notifyError(err instanceof Error ? err.message : "Klarte ikke å skrive ut arbeidsordre.");
    }
  }, [row?.file_id]);

  const requestDelete = useCallback(() => {
    if (!isAdmin || !row?.file_id) return;

    const label = row.file?.label ?? "Arbeidsordre";

    confirmDelete({
      title: "Slett arbeidsordre",
      messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
      onConfirm: async () => {
        await deleteProjectWorkOrder(projectId, row.file_id);
      },
      onDone: async () => {
        await readCurrent();
        notifySuccess("Arbeidsordre slettet.");
      },
    });
  }, [confirmDelete, isAdmin, projectId, readCurrent, row]);

  const actionItems = useMemo<AppActionsMenuItem[]>(() => {
    if (!row) return [];

    const items: AppActionsMenuItem[] = [
      {
        key: "open",
        label: "Åpne",
        icon: <IconEye size={16} />,
        onClick: () => {
          void openPdfPreview();
        },
      },
      {
        ...createPrintAction({
          onClick: () => {
            void printFile();
          },
        }),
      },
    ];

    if (isAdmin) {
      items.push(
        {
          key: "replace",
          label: "Erstatt fil",
          icon: <IconUpload size={16} />,
          onClick: openUploadModal,
        },
        {
          key: "delete",
          label: "Slett",
          icon: <IconTrash size={16} />,
          color: "red",
          onClick: requestDelete,
        }
      );
    }

    return items;
  }, [isAdmin, openPdfPreview, openUploadModal, printFile, requestDelete, row]);

  return (
    <>
      <AppPanel
        title="Arbeidsordre"
        meta="Én PDF per prosjekt"
        actions={
          !row && isAdmin ? (
            <AppButton tone="primary" size="sm" onClick={openUploadModal}>
              Last opp
            </AppButton>
          ) : null
        }
      >
        <Stack gap="sm">
          {loading ? <Text c="dimmed">Laster arbeidsordre...</Text> : null}

          {!loading && error ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}

          {!loading && !error && !row ? (
            <Text c="dimmed">Ingen arbeidsordre lastet opp.</Text>
          ) : null}

          {!loading && !error && row ? (
            <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
              <Stack gap={2}>
                <Text fw={600}>{row.file?.label ?? "Arbeidsordre.pdf"}</Text>
                {fileMeta ? (
                  <Text size="sm" c="dimmed">
                    {fileMeta}
                  </Text>
                ) : null}
              </Stack>
              <Group justify="flex-end" align="center" wrap="nowrap">
                <AppActionsMenu title="Arbeidsordre handlinger" items={actionItems} />
              </Group>
            </Group>
          ) : null}
        </Stack>
      </AppPanel>

      <AppModal
        opened={uploadOpen}
        onClose={closeUploadModal}
        busy={uploading}
        title={row ? "Bytt arbeidsordre" : "Last opp arbeidsordre"}
        size="lg"
      >
        <Stack gap="md">
          <AppPdfDropzone
            multiple={false}
            disabled={uploading}
            onDrop={handleDrop}
            onReject={() => notifyError("Kun PDF er tillatt, maks 25 MB.")}
          />

          {selectedFile ? (
            <Text size="sm" c="dimmed">
              Valgt fil: {selectedFile.name} ({formatBytes(selectedFile.size)})
            </Text>
          ) : null}

          <AppModalActions
            cancelLabel="Avbryt"
            confirmLabel={row ? "Erstatt" : "Last opp"}
            onCancel={closeUploadModal}
            onConfirm={() => void submitUpload()}
            confirmDisabled={!selectedFile}
            confirmLoading={uploading}
          />
        </Stack>
      </AppModal>

      <AppPdfPreviewModal preview={pdfPreview} onClose={closePdfPreview} />

      {deleteConfirmModal}
    </>
  );
}

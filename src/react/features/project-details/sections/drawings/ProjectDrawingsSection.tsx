import { useCallback, useState } from "react";
import { Group, Text } from "@mantine/core";
import { PDFDocument } from "pdf-lib";
import { createSignedUrlForFileRef } from "@/repo/fileRepo";
import {
  createProjectDrawingWithFile,
  deleteProjectDrawing,
  updateProjectDrawing,
  updateProjectDrawingFile,
} from "@/repo/projectDrawingRepo";
import { esc } from "@/utils/dom";
import { validatePdfFile } from "@/utils/format";
import { createUuid } from "@/utils/id";
import { printBlobUrl, printPdfUrl } from "@/utils/print";
import { AppButton } from "@react/ui/AppButton";
import { AppPanel } from "@react/ui/AppPanel";
import { AppPdfPreviewModal, type AppPdfPreviewState } from "@react/ui/AppPdfPreviewModal";
import { notifyError, notifySuccess, toast } from "@react/ui/notify";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import { DrawingsTable } from "./components/DrawingsTable";
import { DrawingsUploadModal } from "./components/DrawingsUploadModal";
import { DrawingEditModal } from "./components/DrawingEditModal";
import { useProjectDrawingsData } from "./hooks/useProjectDrawingsData";
import { createPdfPreviewState, readError } from "./lib/drawingsUtils";
import type { ProjectDrawingRow, UploadEntry } from "./types";

type ProjectDrawingsSectionProps = {
  projectId: string;
  isAdmin: boolean;
};

export function ProjectDrawingsSection({ projectId, isAdmin }: ProjectDrawingsSectionProps) {
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();
  const { rows, loading, error, selectedIds, selectedRows, allSelected, setSelectedIds, loadRows, toggleAll, toggleOne } =
    useProjectDrawingsData(projectId);

  const [pdfPreview, setPdfPreview] = useState<AppPdfPreviewState>(() => createPdfPreviewState());

  const [uploadOpened, setUploadOpened] = useState(false);
  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  const [editOpened, setEditOpened] = useState(false);
  const [editRow, setEditRow] = useState<ProjectDrawingRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [printingBulk, setPrintingBulk] = useState(false);

  const closePdfPreview = useCallback(() => {
    setPdfPreview(createPdfPreviewState());
  }, []);

  const openPdfPreview = useCallback(async (fileId: string | null, title: string) => {
    if (!fileId) {
      toast("Ingen PDF er koblet til denne tegningen.");
      return;
    }

    setPdfPreview({
      opened: true,
      title,
      url: null,
      loading: true,
      error: null,
    });

    try {
      const url = await createSignedUrlForFileRef(fileId, { expiresSeconds: 120 });
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
        error: readError(err, "Kunne ikke åpne PDF."),
      });
    }
  }, []);

  const printSingle = useCallback(async (row: ProjectDrawingRow) => {
    if (!row.file_id) return;
    try {
      const url = await createSignedUrlForFileRef(row.file_id, { expiresSeconds: 120 });
      await printPdfUrl(url);
    } catch (err) {
      console.error(err);
      notifyError(readError(err, "Klarte ikke å skrive ut tegning."));
    }
  }, []);

  const printSelected = useCallback(async () => {
    if (selectedRows.length === 0) return;
    try {
      setPrintingBulk(true);
      const merged = await PDFDocument.create();

      for (const row of selectedRows) {
        if (!row.file_id) continue;
        const url = await createSignedUrlForFileRef(row.file_id, { expiresSeconds: 120 });
        const response = await fetch(url, { credentials: "omit" });
        if (!response.ok) throw new Error("Klarte ikke å hente PDF for utskrift.");
        const buffer = await response.arrayBuffer();
        const doc = await PDFDocument.load(buffer);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }

      if (merged.getPageCount() === 0) {
        notifyError("Fant ingen PDF-er å skrive ut.");
        return;
      }

      const bytes = await merged.save();
      const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      await printBlobUrl(blobUrl, () => URL.revokeObjectURL(blobUrl));
    } catch (err) {
      console.error(err);
      notifyError(readError(err, "Klarte ikke å skrive ut valgte tegninger."));
    } finally {
      setPrintingBulk(false);
    }
  }, [selectedRows]);

  const requestDelete = useCallback(
    (row: ProjectDrawingRow) => {
      if (!isAdmin) return;

      confirmDelete({
        title: "Slett tegning",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(row.drawing_no)}</b>?`,
        onConfirm: async () => {
          await deleteProjectDrawing(row.id, row.file_id);
        },
        onDone: async () => {
          await loadRows();
          notifySuccess("Tegning slettet.");
        },
      });
    },
    [confirmDelete, isAdmin, loadRows]
  );

  const requestDeleteSelected = useCallback(() => {
    if (!isAdmin || selectedRows.length === 0) return;

    confirmDelete({
      title: "Slett tegninger",
      messageHtml: `Er du sikker på at du vil slette <b>${selectedRows.length}</b> tegning(er)?`,
      onConfirm: async () => {
        for (const row of selectedRows) {
          await deleteProjectDrawing(row.id, row.file_id);
        }
      },
      onDone: async () => {
        setSelectedIds(new Set());
        await loadRows();
        notifySuccess("Tegninger slettet.");
      },
    });
  }, [confirmDelete, isAdmin, loadRows, selectedRows]);

  const openEditModal = useCallback((row: ProjectDrawingRow) => {
    setEditRow(row);
    setEditOpened(true);
  }, []);

  const closeEditModal = useCallback(() => {
    if (savingEdit) return;
    setEditOpened(false);
    setEditRow(null);
  }, [savingEdit]);

  const submitEdit = useCallback(async (values: { drawingNo: string; revision: string; file: File | null }) => {
    if (!editRow) return;

    try {
      setSavingEdit(true);
      await updateProjectDrawing(editRow.id, {
        drawing_no: values.drawingNo,
        revision: values.revision,
      });
      if (values.file && editRow.file_id) {
        await updateProjectDrawingFile(editRow.file_id, values.file);
      }
      setEditOpened(false);
      setEditRow(null);
      await loadRows();
      notifySuccess("Tegning oppdatert.");
    } catch (err) {
      console.error(err);
      notifyError(readError(err, "Klarte ikke å oppdatere tegning."));
    } finally {
      setSavingEdit(false);
    }
  }, [editRow, loadRows]);

  const closeUploadModal = useCallback(() => {
    if (uploading) return;
    setUploadOpened(false);
    setUploadEntries([]);
  }, [uploading]);

  const addFilesToQueue = useCallback((files: File[]) => {
    const additions: UploadEntry[] = [];

    for (const file of files) {
      const validationError = validatePdfFile(file, 25);
      if (validationError) {
        notifyError(`${file.name}: ${validationError}`);
        continue;
      }

      const base = file.name.replace(/\.[^/.]+$/, "");
      additions.push({
        id: createUuid(),
        file,
        drawingNo: base,
        revision: "A",
      });
    }

    if (additions.length === 0) return;
    setUploadEntries((prev) => [...prev, ...additions]);
  }, []);

  const submitUpload = useCallback(async () => {
    if (uploadEntries.length === 0) {
      notifyError("Legg til minst én PDF før opplasting.");
      return;
    }

    try {
      setUploading(true);
      const duplicateFiles: string[] = [];

      for (const entry of uploadEntries) {
        const drawingNo = entry.drawingNo.trim();
        if (!drawingNo) {
          throw new Error("Tegningsnr kan ikke være tomt.");
        }

        try {
          await createProjectDrawingWithFile({
            project_id: projectId,
            drawing_no: drawingNo,
            revision: (entry.revision || "A").trim() || "A",
            file: entry.file,
          });
        } catch (err) {
          const message = readError(err, "Klarte ikke å laste opp tegning.");
          if (message.toLowerCase().includes("finnes allerede i systemet")) {
            duplicateFiles.push(entry.file.name);
            continue;
          }
          throw err;
        }
      }

      if (duplicateFiles.length > 0) {
        notifyError(`Følgende filer finnes allerede i systemet: ${duplicateFiles.join(", ")}`);
      }

      await loadRows();
      setUploadOpened(false);
      setUploadEntries([]);
      notifySuccess("Tegninger lastet opp.");
    } catch (err) {
      console.error(err);
      notifyError(readError(err, "Klarte ikke å laste opp tegninger."));
    } finally {
      setUploading(false);
    }
  }, [loadRows, projectId, uploadEntries]);

  const handleChangeUploadDrawingNo = useCallback((entryId: string, drawingNo: string) => {
    setUploadEntries((prev) => prev.map((item) => (item.id === entryId ? { ...item, drawingNo } : item)));
  }, []);

  const handleChangeUploadRevision = useCallback((entryId: string, revision: string) => {
    setUploadEntries((prev) => prev.map((item) => (item.id === entryId ? { ...item, revision: revision as UploadEntry["revision"] } : item)));
  }, []);

  const handleRemoveUploadEntry = useCallback((entryId: string) => {
    setUploadEntries((prev) => prev.filter((item) => item.id !== entryId));
  }, []);

  return (
    <>
      <AppPanel
        title="Tegninger"
        meta="Oversikt over tegninger tilhørende prosjekt"
        actions={
          isAdmin ? (
            <AppButton tone="primary" size="sm" onClick={() => setUploadOpened(true)}>
              Last opp tegninger
            </AppButton>
          ) : null
        }
      >
        <Group justify="space-between" mb="sm">
          <Text size="sm" c="dimmed">
            {rows.length} tegning(er)
          </Text>
          {isAdmin && selectedIds.size > 0 ? (
            <Group gap="xs">
              <AppButton tone="neutral" onClick={() => void printSelected()} loading={printingBulk}>
                Skriv ut valgte
              </AppButton>
              <AppButton tone="danger" onClick={requestDeleteSelected}>
                Slett valgte
              </AppButton>
            </Group>
          ) : null}
        </Group>

        <DrawingsTable
          rows={rows}
          loading={loading}
          error={error}
          isAdmin={isAdmin}
          selectedIds={selectedIds}
          allSelected={allSelected}
          onToggleAll={toggleAll}
          onToggleOne={toggleOne}
          onOpenPdf={(row) => {
            void openPdfPreview(row.file_id, row.file?.label || row.drawing_no || "Tegning");
          }}
          onPrint={(row) => {
            void printSingle(row);
          }}
          onEdit={openEditModal}
          onDelete={requestDelete}
        />
      </AppPanel>

      <DrawingsUploadModal
        opened={uploadOpened}
        uploading={uploading}
        entries={uploadEntries}
        onClose={closeUploadModal}
        onDrop={addFilesToQueue}
        onReject={() => notifyError("Kun PDF er tillatt, maks 25 MB.")}
        onChangeDrawingNo={handleChangeUploadDrawingNo}
        onChangeRevision={handleChangeUploadRevision}
        onRemove={handleRemoveUploadEntry}
        onSubmit={() => {
          void submitUpload();
        }}
      />

      <DrawingEditModal
        opened={editOpened}
        row={editRow}
        saving={savingEdit}
        onClose={closeEditModal}
        onSubmit={submitEdit}
      />

      <AppPdfPreviewModal preview={pdfPreview} onClose={closePdfPreview} />
      {deleteConfirmModal}
    </>
  );
}

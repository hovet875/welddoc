import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Text } from "@mantine/core";
import { createSignedUrlForFileRef } from "@/repo/fileRepo";
import {
  createProjectDrawingWithFile,
  createPlaceholderProjectDrawing,
  deleteProjectDrawing,
  saveProjectDrawingFile,
  updateProjectDrawing,
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
import { DrawingsUploadPanel } from "./components/DrawingsUploadPanel";
import { DrawingEditModal } from "./components/DrawingEditModal";
import { DrawingPlaceholderModal } from "./components/DrawingPlaceholderModal";
import { useProjectDrawingsData } from "./hooks/useProjectDrawingsData";
import { createPdfPreviewState, normalizeButtWeldCountInput, parseButtWeldCount, readError } from "./lib/drawingsUtils";
import type { ProjectDrawingRow, UploadEntry } from "./types";

type ProjectDrawingsSectionProps = {
  projectId: string;
  isAdmin: boolean;
};

export function ProjectDrawingsSection({ projectId, isAdmin }: ProjectDrawingsSectionProps) {
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();
  const { rows, progressByDrawingId, loading, error, selectedIds, selectedRows, allSelected, setSelectedIds, loadRows, toggleAll, toggleOne } =
    useProjectDrawingsData(projectId);

  const [pdfPreview, setPdfPreview] = useState<AppPdfPreviewState>(() => createPdfPreviewState());
  const localPreviewUrlRef = useRef<string | null>(null);

  const [uploadOpened, setUploadOpened] = useState(false);
  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [editOpened, setEditOpened] = useState(false);
  const [editRow, setEditRow] = useState<ProjectDrawingRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [placeholderOpened, setPlaceholderOpened] = useState(false);
  const [savingPlaceholder, setSavingPlaceholder] = useState(false);

  const [printingBulk, setPrintingBulk] = useState(false);

  const clearLocalPreviewUrl = useCallback(() => {
    if (!localPreviewUrlRef.current) return;
    URL.revokeObjectURL(localPreviewUrlRef.current);
    localPreviewUrlRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearLocalPreviewUrl();
    };
  }, [clearLocalPreviewUrl]);

  const closePdfPreview = useCallback(() => {
    clearLocalPreviewUrl();
    setPdfPreview(createPdfPreviewState());
  }, [clearLocalPreviewUrl]);

  const openPdfPreview = useCallback(async (refOrUrl: string | null, title: string) => {
    if (!refOrUrl) {
      toast("Ingen PDF er koblet til denne tegningen.");
      return;
    }

    if (refOrUrl.startsWith("blob:")) {
      clearLocalPreviewUrl();
      localPreviewUrlRef.current = refOrUrl;
      setPdfPreview({
        opened: true,
        title,
        url: refOrUrl,
        loading: false,
        error: null,
      });
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
      clearLocalPreviewUrl();
      const url = await createSignedUrlForFileRef(refOrUrl, { expiresSeconds: 120 });
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
  }, [clearLocalPreviewUrl]);

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
      const { PDFDocument } = await import("pdf-lib");
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

  const submitEdit = useCallback(async (values: { drawingNo: string; revision: string; buttWeldCount: number; file: File | null }) => {
    if (!editRow) return;

    try {
      setSavingEdit(true);
      await updateProjectDrawing(editRow.id, {
        drawing_no: values.drawingNo,
        revision: values.revision,
        butt_weld_count: values.buttWeldCount,
      });
      if (values.file) {
        await saveProjectDrawingFile({
          drawingId: editRow.id,
          currentFileId: editRow.file_id,
          file: values.file,
        });
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

  const clearUploadQueue = useCallback(() => {
    if (uploading) return;
    setUploadEntries([]);
    setUploadError(null);
  }, [uploading]);

  const addFilesToQueue = useCallback((files: File[]) => {
    setUploadError(null);
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
        buttWeldCount: "0",
      });
    }

    if (additions.length === 0) return;
    setUploadEntries((prev) => [...prev, ...additions]);
  }, []);

  const submitPlaceholder = useCallback(
    async (values: { drawingNo: string; revision: string; buttWeldCount: number }) => {
      try {
        setSavingPlaceholder(true);
        await createPlaceholderProjectDrawing({
          project_id: projectId,
          drawing_no: values.drawingNo,
          revision: values.revision,
          butt_weld_count: values.buttWeldCount,
        });
        setPlaceholderOpened(false);
        await loadRows();
        notifySuccess("Midlertidig tegning opprettet.");
      } catch (err) {
        console.error(err);
        notifyError(readError(err, "Klarte ikke å opprette midlertidig tegning."));
      } finally {
        setSavingPlaceholder(false);
      }
    },
    [loadRows, projectId]
  );

  const findMatchingPlaceholder = useCallback(
    (drawingNo: string) => {
      const normalizedDrawingNo = drawingNo.trim().toLocaleUpperCase("nb-NO");
      return rows.filter(
        (row) =>
          row.is_placeholder &&
          String(row.drawing_no ?? "").trim().toLocaleUpperCase("nb-NO") === normalizedDrawingNo
      );
    },
    [rows]
  );

  const submitUpload = useCallback(async () => {
    if (uploadEntries.length === 0) {
      const message = "Legg til minst én PDF før opplasting.";
      setUploadError(message);
      notifyError(message);
      return;
    }

    try {
      setUploadError(null);
      setUploading(true);
      const duplicateFiles: string[] = [];
      const consumedPlaceholderIds = new Set<string>();
      let uploadedCount = 0;
      let convertedCount = 0;

      for (const entry of uploadEntries) {
        const drawingNo = entry.drawingNo.trim();
        if (!drawingNo) {
          throw new Error("Tegningsnr kan ikke være tomt.");
        }
        const buttWeldCount = parseButtWeldCount(entry.buttWeldCount);
        if (buttWeldCount == null) {
          throw new Error(`Buttsveiser for ${entry.file.name} må være et heltall lik eller større enn 0.`);
        }

        try {
          const revision = (entry.revision || "A").trim() || "A";
          const matchingPlaceholders = findMatchingPlaceholder(drawingNo).filter(
            (row) => !consumedPlaceholderIds.has(row.id)
          );
          if (matchingPlaceholders.length > 1) {
            throw new Error(
              `Fant flere midlertidige tegninger med tegningsnr ${drawingNo}. Last opp PDF manuelt fra riktig tegningsrad.`
            );
          }

          const placeholder = matchingPlaceholders[0] ?? null;
          if (placeholder) {
            await saveProjectDrawingFile({
              drawingId: placeholder.id,
              currentFileId: placeholder.file_id,
              file: entry.file,
            });
            await updateProjectDrawing(placeholder.id, {
              drawing_no: drawingNo,
              revision,
              butt_weld_count: buttWeldCount,
            });
            consumedPlaceholderIds.add(placeholder.id);
            uploadedCount += 1;
            convertedCount += 1;
            continue;
          }

          await createProjectDrawingWithFile({
            project_id: projectId,
            drawing_no: drawingNo,
            revision,
            butt_weld_count: buttWeldCount,
            file: entry.file,
          });
          uploadedCount += 1;
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
        const duplicateMessage = `Følgende filer finnes allerede i systemet: ${duplicateFiles.join(", ")}`;
        setUploadError(duplicateMessage);
        notifyError(duplicateMessage);
      }

      await loadRows();
      setUploadOpened(false);
      setUploadEntries([]);
      if (uploadedCount > 0) {
        notifySuccess(
          convertedCount > 0
            ? `${uploadedCount} tegning(er) behandlet. ${convertedCount} midlertidig(e) tegning(er) ble koblet til PDF.`
            : `${uploadedCount} tegning(er) lastet opp.`
        );
      }
    } catch (err) {
      console.error(err);
      const message = readError(err, "Klarte ikke å laste opp tegninger.");
      setUploadError(message);
      notifyError(message);
    } finally {
      setUploading(false);
    }
  }, [findMatchingPlaceholder, loadRows, projectId, uploadEntries]);

  const handleChangeUploadDrawingNo = useCallback((entryId: string, drawingNo: string) => {
    setUploadEntries((prev) => prev.map((item) => (item.id === entryId ? { ...item, drawingNo } : item)));
  }, []);

  const handleChangeUploadRevision = useCallback((entryId: string, revision: string) => {
    setUploadEntries((prev) => prev.map((item) => (item.id === entryId ? { ...item, revision: revision as UploadEntry["revision"] } : item)));
  }, []);

  const handleChangeUploadButtWeldCount = useCallback((entryId: string, buttWeldCount: string) => {
    const normalized = normalizeButtWeldCountInput(buttWeldCount);
    setUploadEntries((prev) => prev.map((item) => (item.id === entryId ? { ...item, buttWeldCount: normalized } : item)));
  }, []);

  const handleRemoveUploadEntry = useCallback((entryId: string) => {
    setUploadEntries((prev) => prev.filter((item) => item.id !== entryId));
  }, []);

  const previewUploadEntry = useCallback((entry: UploadEntry) => {
    const url = URL.createObjectURL(entry.file);
    void openPdfPreview(url, entry.file.name);
  }, [openPdfPreview]);

  return (
    <>
      {isAdmin ? (
        <DrawingsUploadPanel
          opened={uploadOpened}
          uploading={uploading}
          entries={uploadEntries}
          error={uploadError}
          onDrop={addFilesToQueue}
          onReject={() => notifyError("Kun PDF er tillatt, maks 25 MB.")}
          onPreview={previewUploadEntry}
          onChangeDrawingNo={handleChangeUploadDrawingNo}
          onChangeRevision={handleChangeUploadRevision}
          onChangeButtWeldCount={handleChangeUploadButtWeldCount}
          onRemove={handleRemoveUploadEntry}
          onClear={clearUploadQueue}
          onSubmit={() => {
            void submitUpload();
          }}
        />
      ) : null}

      <AppPanel
        title="Tegninger"
        meta="Oversikt over tegninger tilhørende prosjekt"
        actions={
          isAdmin ? (
            <Group gap="xs" wrap="wrap">
              <AppButton tone="neutral" size="sm" onClick={() => setPlaceholderOpened(true)}>
                Ny midlertidig tegning
              </AppButton>
              <AppButton tone="primary" size="sm" onClick={() => setUploadOpened((current) => !current)}>
                {uploadOpened
                  ? "Skjul opplasting"
                  : uploadEntries.length > 0
                    ? `Legg til filer (${uploadEntries.length} i kø)`
                    : "Legg til filer"}
              </AppButton>
            </Group>
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
          progressByDrawingId={progressByDrawingId}
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

      <DrawingEditModal
        opened={editOpened}
        row={editRow}
        saving={savingEdit}
        onClose={closeEditModal}
        onSubmit={submitEdit}
      />

      <DrawingPlaceholderModal
        opened={placeholderOpened}
        saving={savingPlaceholder}
        onClose={() => {
          if (savingPlaceholder) return;
          setPlaceholderOpened(false);
        }}
        onSubmit={submitPlaceholder}
      />

      <AppPdfPreviewModal preview={pdfPreview} onClose={closePdfPreview} />
      {deleteConfirmModal}
    </>
  );
}

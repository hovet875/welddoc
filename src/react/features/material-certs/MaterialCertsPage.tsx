import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { useAuth } from "@react/auth/AuthProvider";
import { AppPageLayout } from "@react/layout/AppPageLayout";
import { AppPdfPreviewModal, type AppPdfPreviewState } from "@react/ui/AppPdfPreviewModal";
import { AppRefreshIconButton } from "@react/ui/AppRefreshIconButton";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";
import { notifySuccess, toast } from "@react/ui/notify";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import { AppButton } from "@react/ui/AppButton";
import { createSignedUrlForFileRef } from "@/repo/fileRepo";
import {
  deleteMaterialCertificate,
  updateMaterialCertificate,
  updateMaterialCertificateFile,
  type MaterialCertificateRow,
} from "@/repo/materialCertificateRepo";
import { ensureSupplierExists } from "@/repo/supplierRepo";
import { esc } from "@/utils/dom";
import { MaterialCertModal, type MaterialCertModalSubmit } from "./components/MaterialCertModal";
import { MaterialCertUploadPanel } from "./components/MaterialCertUploadPanel";
import { MaterialCertsPanel } from "./components/MaterialCertsPanel";
import { useMaterialCertList } from "./hooks/useMaterialCertList";
import { useMaterialCertsMeta } from "./hooks/useMaterialCertsMeta";
import {
  buildMaterialOptions,
  buildSimpleOptions,
  formatMaterialCertCount,
  hasMaterialCertFilters,
  INITIAL_MATERIAL_CERT_FILTERS,
  type MaterialCertPanelFilters,
} from "./lib/materialCertsView";

function createPdfPreviewState(): AppPdfPreviewState {
  return {
    opened: false,
    title: "PDF",
    url: null,
    loading: false,
    error: null,
  };
}

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function MaterialCertsPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;
  const meta = useMaterialCertsMeta(isAdmin);
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();

  const [materialFilters, setMaterialFilters] = useState<MaterialCertPanelFilters>(INITIAL_MATERIAL_CERT_FILTERS);
  const [fillerFilters, setFillerFilters] = useState<MaterialCertPanelFilters>(INITIAL_MATERIAL_CERT_FILTERS);
  const [materialPage, setMaterialPage] = useState(1);
  const [fillerPage, setFillerPage] = useState(1);
  const [materialPageSize, setMaterialPageSize] = useState(25);
  const [fillerPageSize, setFillerPageSize] = useState(25);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editRow, setEditRow] = useState<MaterialCertificateRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<AppPdfPreviewState>(() => createPdfPreviewState());
  const localPreviewUrlRef = useRef<string | null>(null);

  const [materialSupplier] = useDebouncedValue(materialFilters.supplier, 200);
  const [materialQuery] = useDebouncedValue(materialFilters.query, 200);
  const [fillerSupplier] = useDebouncedValue(fillerFilters.supplier, 200);
  const [fillerQuery] = useDebouncedValue(fillerFilters.query, 200);

  const materialServerFilters = useMemo(
    () => ({
      certificateType: "material" as const,
      materialId: materialFilters.materialId,
      supplier: materialSupplier,
      query: materialQuery,
    }),
    [materialFilters.materialId, materialQuery, materialSupplier]
  );
  const fillerServerFilters = useMemo(
    () => ({
      certificateType: "filler" as const,
      fillerType: fillerFilters.fillerType,
      supplier: fillerSupplier,
      query: fillerQuery,
    }),
    [fillerFilters.fillerType, fillerQuery, fillerSupplier]
  );

  const materialList = useMaterialCertList({
    page: materialPage,
    pageSize: materialPageSize,
    filters: materialServerFilters,
  });
  const fillerList = useMaterialCertList({
    page: fillerPage,
    pageSize: fillerPageSize,
    filters: fillerServerFilters,
  });

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(materialList.total / materialPageSize));
    if (materialList.total > 0 && materialPage > totalPages) {
      setMaterialPage(totalPages);
    }
  }, [materialList.total, materialPage, materialPageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(fillerList.total / fillerPageSize));
    if (fillerList.total > 0 && fillerPage > totalPages) {
      setFillerPage(totalPages);
    }
  }, [fillerList.total, fillerPage, fillerPageSize]);

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
    setPdfPreview(createPdfPreviewState());
  }, []);

  const openPdfPreview = useCallback(
    async (refOrUrl: string | null, title: string) => {
      if (!refOrUrl) {
        toast("Ingen PDF er koblet til denne raden.");
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
          error: readErrorMessage(err, "Kunne ikke åpne PDF."),
        });
      }
    },
    [clearLocalPreviewUrl]
  );

  const reloadAll = useCallback(async () => {
    await Promise.all([meta.reload(), materialList.reload(), fillerList.reload()]);
  }, [fillerList, materialList, meta]);

  const requestDeleteRows = useCallback(
    (rows: MaterialCertificateRow[]) => {
      if (rows.length === 0) return;

      const isBulk = rows.length > 1;
      const firstLabel = rows[0]?.file?.label || "sertifikatet";

      confirmDelete({
        title: isBulk ? "Slett materialsertifikater" : "Slett materialsertifikat",
        messageHtml: isBulk
          ? `Er du sikker på at du vil slette <b>${rows.length} sertifikater</b> med tilhørende filkoblinger?`
          : `Er du sikker på at du vil slette <b>${esc(firstLabel)}</b>?`,
        onConfirm: async () => {
          for (const row of rows) {
            await deleteMaterialCertificate(row.id, row.file_id);
          }
        },
        onDone: async () => {
          await reloadAll();
          notifySuccess(isBulk ? "Materialsertifikater slettet." : "Materialsertifikat slettet.");
        },
      });
    },
    [confirmDelete, reloadAll]
  );

  const openEditModal = useCallback((row: MaterialCertificateRow) => {
    setEditRow(row);
    setEditOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditOpen(false);
    setEditRow(null);
  }, []);

  const submitEdit = useCallback(
    async (submission: MaterialCertModalSubmit) => {
      if (submission.patch.supplier) {
        await ensureSupplierExists(submission.patch.supplier);
      }

      await updateMaterialCertificate(submission.rowId, submission.patch);

      if (submission.pdfFile) {
        const currentFileId = editRow?.id === submission.rowId ? editRow.file_id : null;
        if (!currentFileId) {
          throw new Error("Kan ikke erstatte PDF fordi sertifikatet mangler filkobling.");
        }
        await updateMaterialCertificateFile(currentFileId, submission.pdfFile);
      }

      await reloadAll();
      closeEditModal();
      notifySuccess("Materialsertifikat oppdatert.");
    },
    [closeEditModal, editRow?.file_id, editRow?.id, reloadAll]
  );

  const materialHasFilters = hasMaterialCertFilters("material", materialFilters);
  const fillerHasFilters = hasMaterialCertFilters("filler", fillerFilters);
  const materialMeta = materialList.loading && materialList.total === 0
    ? "Laster..."
    : formatMaterialCertCount(materialList.total, materialHasFilters);
  const fillerMeta = fillerList.loading && fillerList.total === 0
    ? "Laster..."
    : formatMaterialCertCount(fillerList.total, fillerHasFilters);

  const materialOptions = useMemo(() => buildMaterialOptions(meta.materials), [meta.materials]);
  const fillerTypeOptions = useMemo(() => buildSimpleOptions(meta.fillerTypeNames), [meta.fillerTypeNames]);

  return (
    <AppPageLayout pageClassName="page-material-certs-react" displayName={displayName} email={email}>
      <AppSectionHeader
        title="Materialsertifikater"
        subtitle="Bibliotek for materialsertifikater og sveisetilsett-sertifikater."
        actions={
          <>
            {isAdmin ? (
              <AppButton tone="primary" size="sm" onClick={() => setUploadOpen((current) => !current)}>
                {uploadOpen
                  ? "Skjul opplasting"
                  : meta.inboxNewCount > 0
                    ? `Legg til filer (${meta.inboxNewCount} nye)`
                    : "Legg til filer"}
              </AppButton>
            ) : null}
            <AppRefreshIconButton
              onClick={() => void reloadAll()}
              disabled={meta.loading || materialList.loading || fillerList.loading}
              loading={meta.refreshing}
            />
          </>
        }
      />

      {isAdmin ? (
        <MaterialCertUploadPanel
          opened={uploadOpen}
          materials={meta.materials}
          supplierSuggestions={meta.supplierNames}
          fillerTypeOptions={fillerTypeOptions}
          onOpenPdf={(refOrUrl, title) => {
            void openPdfPreview(refOrUrl, title);
          }}
          onUploaded={reloadAll}
          onInboxCountChange={meta.reload}
        />
      ) : null}

      <MaterialCertsPanel
        type="material"
        title="Material"
        meta={materialMeta}
        filters={materialFilters}
        onChangeFilters={(next) => {
          startTransition(() => {
            setMaterialFilters(next);
            setMaterialPage(1);
          });
        }}
        materialOptions={materialOptions}
        fillerTypeOptions={fillerTypeOptions}
        supplierSuggestions={meta.supplierNames}
        rows={materialList.rows}
        loading={meta.loading || materialList.loading}
        error={meta.error || materialList.error}
        hasFilters={materialHasFilters}
        isAdmin={isAdmin}
        page={materialPage}
        totalRows={materialList.total}
        pageSize={materialPageSize}
        onPageChange={(nextPage) => {
          startTransition(() => {
            setMaterialPage(nextPage);
          });
        }}
        onPageSizeChange={(nextPageSize) => {
          startTransition(() => {
            setMaterialPageSize(nextPageSize);
            setMaterialPage(1);
          });
        }}
        onOpenPdf={(ref, title) => {
          void openPdfPreview(ref, title);
        }}
        onEdit={openEditModal}
        onDelete={(row) => requestDeleteRows([row])}
        onBulkDelete={requestDeleteRows}
      />

      <MaterialCertsPanel
        type="filler"
        title="Sveisetilsett"
        meta={fillerMeta}
        filters={fillerFilters}
        onChangeFilters={(next) => {
          startTransition(() => {
            setFillerFilters(next);
            setFillerPage(1);
          });
        }}
        materialOptions={materialOptions}
        fillerTypeOptions={fillerTypeOptions}
        supplierSuggestions={meta.supplierNames}
        rows={fillerList.rows}
        loading={meta.loading || fillerList.loading}
        error={meta.error || fillerList.error}
        hasFilters={fillerHasFilters}
        isAdmin={isAdmin}
        page={fillerPage}
        totalRows={fillerList.total}
        pageSize={fillerPageSize}
        onPageChange={(nextPage) => {
          startTransition(() => {
            setFillerPage(nextPage);
          });
        }}
        onPageSizeChange={(nextPageSize) => {
          startTransition(() => {
            setFillerPageSize(nextPageSize);
            setFillerPage(1);
          });
        }}
        onOpenPdf={(ref, title) => {
          void openPdfPreview(ref, title);
        }}
        onEdit={openEditModal}
        onDelete={(row) => requestDeleteRows([row])}
        onBulkDelete={requestDeleteRows}
      />

      <MaterialCertModal
        opened={editOpen}
        row={editRow}
        materials={meta.materials}
        supplierSuggestions={meta.supplierNames}
        fillerTypeNames={meta.fillerTypeNames}
        onClose={closeEditModal}
        onSubmit={submitEdit}
        onOpenExistingPdf={(ref, title) => {
          void openPdfPreview(ref, title);
        }}
      />
      <AppPdfPreviewModal preview={pdfPreview} onClose={closePdfPreview} />
      {deleteConfirmModal}
    </AppPageLayout>
  );
}

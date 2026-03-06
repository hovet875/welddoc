import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { countNewFileInboxByTarget } from "@/repo/fileInboxRepo";
import {
  countNdtReports,
  deleteNdtReport,
  fetchNdtReportPage,
  fetchNdtReports,
  fetchNdtReportYears,
  fetchNdtRtStatsRows,
  updateNdtReport,
  updateNdtReportFile,
  type NdtReportListFilters,
  type NdtReportRow,
  type NdtRtStatsRow,
} from "@/repo/ndtReportRepo";
import { createSignedUrlForFileRef } from "@/repo/fileRepo";
import { esc } from "@/utils/dom";
import { toast } from "@react/ui/notify";
import { useAuth } from "@react/auth/AuthProvider";
import { NdtReportModal, type NdtReportModalSubmit } from "@react/features/ndt/components/NdtReportModal";
import { NdtReportsPanel } from "@react/features/ndt/components/NdtReportsPanel";
import { NdtRtStatsPanel } from "@react/features/ndt/components/NdtRtStatsPanel";
import { NdtUploadPanel } from "@react/features/ndt/components/NdtUploadPanel";
import { useNdtData } from "@react/features/ndt/hooks/useNdtData";
import {
  INITIAL_NDT_REPORT_FILTERS,
  buildYearFilterOptionsFromValues,
  buildMethodFilterOptions,
  buildProjectFilterOptions,
  buildWelderFilterOptions,
  formatCount,
  hasNdtReportFilters,
  type NdtReportFilters,
} from "@react/features/ndt/lib/ndtView";
import { AppPageLayout } from "@react/layout/AppPageLayout";
import { AppButton } from "@react/ui/AppButton";
import { AppPdfPreviewModal, type AppPdfPreviewState } from "@react/ui/AppPdfPreviewModal";
import { AppRefreshIconButton } from "@react/ui/AppRefreshIconButton";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";

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

export function NdtPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;

  const { methods, welders, projects, customers, ndtSuppliers, ndtInspectors, loading, refreshing, error, reload } =
    useNdtData();
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();

  const [filters, setFilters] = useState<NdtReportFilters>(INITIAL_NDT_REPORT_FILTERS);
  const [debouncedQuery] = useDebouncedValue(filters.query, 150);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<NdtReportRow[]>([]);
  const [statsRows, setStatsRows] = useState<NdtRtStatsRow[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [years, setYears] = useState<string[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [uploadReports, setUploadReports] = useState<NdtReportRow[]>([]);
  const [pdfPreview, setPdfPreview] = useState<AppPdfPreviewState>(() => createPdfPreviewState());
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [inboxNewCount, setInboxNewCount] = useState(0);
  const [editRow, setEditRow] = useState<NdtReportRow | null>(null);
  const [editOpened, setEditOpened] = useState(false);
  const localPreviewUrlRef = useRef<string | null>(null);
  const querySeqRef = useRef(0);

  const effectiveFilters = useMemo(() => ({ ...filters, query: debouncedQuery }), [debouncedQuery, filters]);
  const hasFilters = hasNdtReportFilters(filters);

  const projectNameByNo = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of projects) {
      map.set(String(row.project_no), row.name);
    }
    return map;
  }, [projects]);

  const methodFilterOptions = useMemo(() => buildMethodFilterOptions(methods), [methods]);
  const projectFilterOptions = useMemo(() => buildProjectFilterOptions(projects), [projects]);
  const yearFilterOptions = useMemo(() => buildYearFilterOptionsFromValues(years), [years]);
  const welderFilterOptions = useMemo(() => buildWelderFilterOptions(welders), [welders]);

  const serverFilters = useMemo<NdtReportListFilters>(
    () => ({
      methodId: effectiveFilters.methodId,
      projectNo: effectiveFilters.projectNo,
      year: effectiveFilters.year,
      welderId: effectiveFilters.welderId,
      result: effectiveFilters.result,
      query: effectiveFilters.query,
    }),
    [effectiveFilters]
  );

  const loadRowsAndStats = useCallback(async () => {
    const seq = querySeqRef.current + 1;
    querySeqRef.current = seq;
    setRowsLoading(true);
    setRowsError(null);

    try {
      const [pageResult, rtRows] = await Promise.all([
        fetchNdtReportPage({
          page,
          pageSize,
          filters: serverFilters,
        }),
        fetchNdtRtStatsRows(serverFilters),
      ]);

      if (querySeqRef.current !== seq) return;

      const totalPages = Math.max(1, Math.ceil(pageResult.total / pageResult.pageSize));
      if (pageResult.total > 0 && page > totalPages) {
        setPage(totalPages);
        return;
      }

      setRows(pageResult.items);
      setRowsTotal(pageResult.total);
      setStatsRows(rtRows);
    } catch (err) {
      if (querySeqRef.current !== seq) return;
      console.error(err);
      setRows([]);
      setRowsTotal(0);
      setStatsRows([]);
      setRowsError(readErrorMessage(err, "Kunne ikke hente NDT-data."));
    } finally {
      if (querySeqRef.current === seq) {
        setRowsLoading(false);
      }
    }
  }, [page, pageSize, serverFilters]);

  const reloadMeta = useCallback(async () => {
    const [total, yearValues] = await Promise.all([countNdtReports(), fetchNdtReportYears()]);
    setReportsTotal(total);
    setYears(yearValues);
  }, []);

  const refreshUploadReports = useCallback(async () => {
    if (!isAdmin || !uploadPanelOpen) return;
    try {
      const rows = await fetchNdtReports();
      setUploadReports(rows);
    } catch (err) {
      console.error(err);
    }
  }, [isAdmin, uploadPanelOpen]);

  const loadInboxCount = useCallback(async () => {
    if (!isAdmin) {
      setInboxNewCount(0);
      return;
    }

    try {
      const count = await countNewFileInboxByTarget("ndt_report");
      setInboxNewCount(count);
    } catch (err) {
      console.error(err);
    }
  }, [isAdmin]);

  const reloadAll = useCallback(async () => {
    await Promise.all([reload(), loadInboxCount(), reloadMeta(), loadRowsAndStats(), refreshUploadReports()]);
  }, [loadInboxCount, loadRowsAndStats, refreshUploadReports, reload, reloadMeta]);

  const clearLocalPreviewUrl = useCallback(() => {
    if (!localPreviewUrlRef.current) return;
    URL.revokeObjectURL(localPreviewUrlRef.current);
    localPreviewUrlRef.current = null;
  }, []);

  const closePdfPreview = useCallback(() => {
    setPdfPreview(createPdfPreviewState());
  }, []);

  useEffect(() => {
    void loadInboxCount();
  }, [loadInboxCount]);

  useEffect(() => {
    void reloadMeta();
  }, [reloadMeta]);

  useEffect(() => {
    void loadRowsAndStats();
  }, [loadRowsAndStats]);

  useEffect(() => {
    if (!uploadPanelOpen || !isAdmin) return;
    void refreshUploadReports();
  }, [uploadPanelOpen, isAdmin, refreshUploadReports]);

  useEffect(() => {
    return () => {
      clearLocalPreviewUrl();
    };
  }, [clearLocalPreviewUrl]);

  const openPdfPreview = useCallback(async (ref: string | null, title: string) => {
    if (!ref) {
      toast("Ingen PDF er koblet til denne raden.");
      return;
    }

    if (ref.startsWith("blob:")) {
      clearLocalPreviewUrl();
      localPreviewUrlRef.current = ref;
      setPdfPreview({
        opened: true,
        title,
        url: ref,
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
      const url = await createSignedUrlForFileRef(ref, { expiresSeconds: 120 });
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
  }, [clearLocalPreviewUrl]);

  const requestDelete = useCallback(
    (row: NdtReportRow) => {
      const label = row.file?.label || row.title || "rapport";
      confirmDelete({
        title: "Slett NDT-rapport",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => {
          await deleteNdtReport(row.id, row.file_id);
        },
        onDone: async () => {
          await reloadAll();
          toast("NDT-rapport slettet.");
        },
      });
    },
    [confirmDelete, reloadAll]
  );

  const requestEdit = useCallback((row: NdtReportRow) => {
    setEditRow(row);
    setEditOpened(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditOpened(false);
    setEditRow(null);
  }, []);

  const submitEdit = useCallback(
    async (submission: NdtReportModalSubmit) => {
      if (submission.mode !== "edit" || !submission.rowId) {
        throw new Error("Ugyldig redigeringskall for NDT-rapport.");
      }

      await updateNdtReport(submission.rowId, submission.payload);

      if (submission.pdfFile) {
        const currentFileId = editRow?.id === submission.rowId ? editRow.file_id : null;
        if (!currentFileId) {
          throw new Error("Kan ikke erstatte PDF fordi rapporten mangler eksisterende filkobling.");
        }
        await updateNdtReportFile(currentFileId, submission.pdfFile);
      }

      await reloadAll();
      closeEditModal();
      toast("NDT-rapport oppdatert.");
    },
    [closeEditModal, editRow?.file_id, editRow?.id, reloadAll]
  );

  const handleChangeFilters = useCallback((next: NdtReportFilters) => {
    setFilters(next);
    setPage(1);
  }, []);

  const handleChangePageSize = useCallback((nextPageSize: number) => {
    if (!Number.isFinite(nextPageSize) || nextPageSize < 1) return;
    setPageSize(nextPageSize);
    setPage(1);
  }, []);

  return (
    <AppPageLayout pageClassName="page-ndt-react" displayName={displayName} email={email}>
      <AppSectionHeader
        title="NDT"
        subtitle="Oversikt over alle NDT-rapporter med filtrering, statistikk og PDF-visning."
        actions={
          <>
            {isAdmin ? (
              <AppButton tone="primary" size="sm" onClick={() => setUploadPanelOpen((prev) => !prev)}>
                {uploadPanelOpen
                  ? "Skjul opplasting"
                  : inboxNewCount > 0
                    ? `Legg til filer (${inboxNewCount} nye)`
                    : "Legg til filer"}
              </AppButton>
            ) : null}
            <AppRefreshIconButton onClick={() => void reloadAll()} disabled={loading || refreshing} loading={refreshing} />
          </>
        }
      />

        {isAdmin ? (
          <NdtUploadPanel
            opened={uploadPanelOpen}
            reports={uploadReports}
            methods={methods}
            welders={welders}
            projects={projects}
            customers={customers}
            ndtSuppliers={ndtSuppliers}
            ndtInspectors={ndtInspectors}
            onOpenPdf={(ref, title) => {
              void openPdfPreview(ref, title);
            }}
            onUploaded={reloadAll}
            onInboxCountChange={setInboxNewCount}
          />
        ) : null}

        <NdtRtStatsPanel rows={statsRows} activeWelderId={effectiveFilters.welderId} />

        <NdtReportsPanel
          filters={filters}
          onChangeFilters={handleChangeFilters}
          methodOptions={methodFilterOptions}
          projectOptions={projectFilterOptions}
          yearOptions={yearFilterOptions}
          welderOptions={welderFilterOptions}
          rows={rows}
          loading={loading || rowsLoading}
          error={error || rowsError}
          meta={formatCount(rowsTotal, reportsTotal, hasFilters)}
          hasFilters={hasFilters}
          isAdmin={isAdmin}
          page={page}
          totalRows={rowsTotal}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handleChangePageSize}
          projectNameByNo={projectNameByNo}
          onOpenPdf={(ref, title) => {
            void openPdfPreview(ref, title);
          }}
          onEdit={requestEdit}
          onDelete={requestDelete}
        />

      <AppPdfPreviewModal preview={pdfPreview} onClose={closePdfPreview} />
      <NdtReportModal
        opened={editOpened}
        mode="edit"
        row={editRow}
        methods={methods}
        welders={welders}
        projects={projects}
        customers={customers}
        ndtSuppliers={ndtSuppliers}
        ndtInspectors={ndtInspectors}
        onClose={closeEditModal}
        onSubmit={submitEdit}
        onOpenExistingPdf={(ref, title) => {
          void openPdfPreview(ref, title);
        }}
      />
      {deleteConfirmModal}
    </AppPageLayout>
  );
}

import { useCallback, useMemo, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { createPdfSignedUrl, deleteWpqr, deleteWps, type WPQRRow, type WPSRow } from "@/repo/wpsRepo";
import { notifySuccess, notifyError } from "@react/ui/notify";
import { esc } from "@/utils/dom";
import { useAuth } from "@react/auth/AuthProvider";
import { WpsEditorModal } from "@react/features/wps/components/WpsEditorModal";
import { WpsFiltersPanel } from "@react/features/wps/components/WpsFiltersPanel";
import { WpsTablePanel } from "@react/features/wps/components/WpsTablePanel";
import { WpqrTablePanel } from "@react/features/wps/components/WpqrTablePanel";
import { useWpsData } from "@react/features/wps/hooks/useWpsData";
import { useWpsEditor } from "@react/features/wps/hooks/useWpsEditor";
import { isSameProcess, isStandardType, materialLabelFromOption } from "@react/features/wps/lib/wpsHelpers";
import {
  buildJointTypeFilterOptions,
  buildMaterialFilterOptions,
  buildMethodFilterOptions,
  buildProcessDictionary,
  filterWpsRows,
  filterWpqrRows,
  groupRowsByProcess,
  materialDisplay,
  type WpsFilters,
} from "@react/features/wps/lib/wpsView";
import { AppPageLayout } from "@react/layout/AppPageLayout";
import { AppButton } from "@react/ui/AppButton";
import { AppPdfPreviewModal, type AppPdfPreviewState } from "@react/ui/AppPdfPreviewModal";
import { AppRefreshIconButton } from "@react/ui/AppRefreshIconButton";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";

const INITIAL_FILTERS: WpsFilters = {
  method: "",
  material: "",
  jointType: "",
  query: "",
};

const STANDARD_TYPE_WPQR = "Sveiseprosedyreprøving";
const STANDARD_TYPE_WPS = "Sveiseprosedyrespesifikasjon";

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function WpsPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;

  const { wpsRows, wpqrRows, processes, materials, standards, jointTypes, loading, refreshing, error, reload } =
    useWpsData();
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();

  const [filters, setFilters] = useState<WpsFilters>(INITIAL_FILTERS);
  const [debouncedQuery] = useDebouncedValue(filters.query, 150);
  const [pdfPreview, setPdfPreview] = useState<AppPdfPreviewState>({
    opened: false,
    title: "PDF",
    url: null,
    loading: false,
    error: null,
  });

  const processDictionary = useMemo(() => buildProcessDictionary(processes), [processes]);

  const {
    editor,
    savingEditor,
    localPdfPreviewUrl,
    openCreateModal,
    openWpqrEditModal,
    openWpsEditModal,
    closeEditor,
    setEditorField,
    handleEditorProcessChange,
    handlePdfFileChange,
    submitEditor,
  } = useWpsEditor({
    processDictionary,
    materials,
    wpsRows,
    wpqrRows,
    reload,
  });

  const allRows = useMemo(() => [...wpsRows, ...wpqrRows], [wpsRows, wpqrRows]);

  const methodOptions = useMemo(
    () => buildMethodFilterOptions(allRows, processDictionary),
    [allRows, processDictionary]
  );
  const materialOptions = useMemo(() => buildMaterialFilterOptions(allRows), [allRows]);
  const jointTypeOptions = useMemo(() => buildJointTypeFilterOptions(allRows), [allRows]);

  const processSelectOptions = useMemo(
    () => methodOptions.map((option) => ({ value: option.value, label: option.label })),
    [methodOptions]
  );

  const materialSelectOptions = useMemo(() => {
    return materials.map((row) => ({
      value: row.id,
      label: materialLabelFromOption(row),
    }));
  }, [materials]);

  const baseJointTypeOptions = useMemo(() => {
    const unique = new Set<string>();

    for (const row of jointTypes) {
      const label = String(row.label ?? "").trim();
      if (label) unique.add(label);
    }

    for (const row of allRows) {
      const label = String(row.fuge ?? "").trim();
      if (label) unique.add(label);
    }

    return Array.from(unique)
      .sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }))
      .map((value) => ({ value, label: value }));
  }, [allRows, jointTypes]);

  const standardOptionsWpqrBase = useMemo(() => {
    return standards
      .filter((row) => isStandardType(row.type, STANDARD_TYPE_WPQR))
      .map((row) => ({
        value: row.id,
        label: row.revision ? `${row.label}:${row.revision}` : row.label,
      }));
  }, [standards]);

  const standardOptionsWpsBase = useMemo(() => {
    return standards
      .filter((row) => isStandardType(row.type, STANDARD_TYPE_WPS))
      .map((row) => ({
        value: row.id,
        label: row.revision ? `${row.label}:${row.revision}` : row.label,
      }));
  }, [standards]);

  const standardOptionsForEditor = useMemo(() => {
    if (!editor) return [];
    const base = editor.kind === "wps" ? standardOptionsWpsBase : standardOptionsWpqrBase;
    if (!editor.standardId || base.some((option) => option.value === editor.standardId)) return base;
    return [...base, { value: editor.standardId, label: `${editor.standardId} (ukjent)` }];
  }, [editor, standardOptionsWpqrBase, standardOptionsWpsBase]);

  const materialOptionsForEditor = useMemo(() => {
    if (!editor) return materialSelectOptions;
    if (!editor.materialId || materialSelectOptions.some((option) => option.value === editor.materialId)) {
      return materialSelectOptions;
    }
    return [...materialSelectOptions, { value: editor.materialId, label: `${editor.materialId} (ukjent)` }];
  }, [editor, materialSelectOptions]);

  const jointTypeOptionsForEditor = useMemo(() => {
    if (!editor) return baseJointTypeOptions;
    if (!editor.fuge || baseJointTypeOptions.some((option) => option.value === editor.fuge)) return baseJointTypeOptions;
    return [...baseJointTypeOptions, { value: editor.fuge, label: `${editor.fuge} (ukjent)` }];
  }, [baseJointTypeOptions, editor]);

  const processOptionsForEditor = useMemo(() => {
    if (!editor) return processSelectOptions;
    if (!editor.process || processSelectOptions.some((option) => option.value === editor.process)) {
      return processSelectOptions;
    }
    return [...processSelectOptions, { value: editor.process, label: `${editor.process} (ukjent)` }];
  }, [editor, processSelectOptions]);

  const wpqrOptionsForEditor = useMemo(() => {
    if (!editor || editor.kind !== "wps") return [];

    const rows = wpqrRows
      .filter((row) => {
        if (!editor.process) return true;
        return isSameProcess(row.process, editor.process, processDictionary);
      })
      .sort((a, b) => a.doc_no.localeCompare(b.doc_no, "nb", { sensitivity: "base" }))
      .map((row) => ({
        value: row.id,
        label: `${row.doc_no} - ${materialDisplay(row) || "Ukjent materiale"} - ${row.tykkelse || "-"}`,
      }));

    if (!editor.wpqrId || rows.some((option) => option.value === editor.wpqrId)) return rows;
    return [...rows, { value: editor.wpqrId, label: `${editor.wpqrId} (ukjent)` }];
  }, [editor, processDictionary, wpqrRows]);

  const filteredWpsRows = useMemo(
    () => filterWpsRows(wpsRows, { ...filters, query: debouncedQuery }, processDictionary),
    [debouncedQuery, filters, processDictionary, wpsRows]
  );
  const filteredWpqrRows = useMemo(
    () => filterWpqrRows(wpqrRows, { ...filters, query: debouncedQuery }, processDictionary),
    [debouncedQuery, filters, processDictionary, wpqrRows]
  );

  const groupedWpsRows = useMemo(
    () => groupRowsByProcess(filteredWpsRows, processDictionary),
    [filteredWpsRows, processDictionary]
  );
  const groupedWpqrRows = useMemo(
    () => groupRowsByProcess(filteredWpqrRows, processDictionary),
    [filteredWpqrRows, processDictionary]
  );

  const openPdfPreview = useCallback(async (fileId: string | null, title = "PDF") => {
    if (!fileId) {
      notifyError("Ingen PDF er koblet til denne raden.");
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
      const url = await createPdfSignedUrl(fileId, 120);
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
  }, []);

  const closePdfPreview = useCallback(() => {
    setPdfPreview({
      opened: false,
      title: "PDF",
      url: null,
      loading: false,
      error: null,
    });
  }, []);

  const requestDeleteWpqr = useCallback(
    (row: WPQRRow) => {
      confirmDelete({
        title: "Slett WPQR",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(row.doc_no)}</b>?<br/>WPS som er koblet til denne blir automatisk frakoblet.`,
        onConfirm: async () => {
          await deleteWpqr(row.id);
        },
        onDone: async () => {
          await reload();
          notifySuccess("WPQR slettet.");
        },
      });
    },
    [confirmDelete, reload]
  );

  const requestDeleteWps = useCallback(
    (row: WPSRow) => {
      confirmDelete({
        title: "Slett WPS",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(row.doc_no)}</b>?`,
        onConfirm: async () => {
          await deleteWps(row.id);
        },
        onDone: async () => {
          await reload();
          notifySuccess("WPS slettet.");
        },
      });
    },
    [confirmDelete, reload]
  );

  return (
    <AppPageLayout pageClassName="page-wps" displayName={displayName} email={email}>
      <AppSectionHeader
        title="Sveiseprosedyrer"
        subtitle="Bibliotek for gyldige WPS og WPQR."
        actions={
          <>
            {isAdmin ? (
              <AppButton tone="primary" size="sm" onClick={() => openCreateModal("wps")}>
                Last opp WPS
              </AppButton>
            ) : null}
            {isAdmin ? (
              <AppButton tone="primary" size="sm" onClick={() => openCreateModal("wpqr")}>
                Last opp WPQR
              </AppButton>
            ) : null}
            <AppRefreshIconButton onClick={() => void reload()} disabled={loading || refreshing} loading={refreshing} />
          </>
        }
      />

        <WpsFiltersPanel
          filters={filters}
          methodOptions={methodOptions}
          materialOptions={materialOptions}
          jointTypeOptions={jointTypeOptions}
          onChange={setFilters}
        />

        <WpsTablePanel
          loading={loading}
          error={error}
          groups={groupedWpsRows}
          totalCount={filteredWpsRows.length}
          isAdmin={isAdmin}
          onOpenPdfPreview={(fileId, title) => {
            void openPdfPreview(fileId, title);
          }}
          onEdit={openWpsEditModal}
          onDelete={requestDeleteWps}
        />

        <WpqrTablePanel
          loading={loading}
          error={error}
          groups={groupedWpqrRows}
          totalCount={filteredWpqrRows.length}
          isAdmin={isAdmin}
          onOpenPdfPreview={(fileId, title) => {
            void openPdfPreview(fileId, title);
          }}
          onEdit={openWpqrEditModal}
          onDelete={requestDeleteWpqr}
        />

      <WpsEditorModal
        editor={editor}
        saving={savingEditor}
        standardOptions={standardOptionsForEditor}
        processOptions={processOptionsForEditor}
        materialOptions={materialOptionsForEditor}
        jointTypeOptions={jointTypeOptionsForEditor}
        wpqrOptions={wpqrOptionsForEditor}
        localPdfPreviewUrl={localPdfPreviewUrl}
        onClose={closeEditor}
        onSubmit={submitEditor}
        onFieldChange={setEditorField}
        onProcessChange={handleEditorProcessChange}
        onPdfFileChange={handlePdfFileChange}
        onOpenPdfPreview={(fileId, title) => {
          void openPdfPreview(fileId, title);
        }}
      />

      <AppPdfPreviewModal preview={pdfPreview} onClose={closePdfPreview} />

      {deleteConfirmModal}
    </AppPageLayout>
  );
}

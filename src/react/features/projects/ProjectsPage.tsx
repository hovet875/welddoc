import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { deleteProject, fetchProjectPage } from "@/repo/projectRepo";
import { useAuth } from "@react/auth/AuthProvider";
import { AppPageLayout } from "@react/layout/AppPageLayout";
import { AppPanel } from "@react/ui/AppPanel";
import { toast } from "@react/ui/notify";
import { useConfirmModal } from "@react/ui/useConfirmModal";
import { ProjectFormModal } from "./components/ProjectFormModal";
import { ProjectsFilters } from "./components/ProjectsFilters";
import { ProjectsHeader } from "./components/ProjectsHeader";
import { ProjectsTable } from "./components/ProjectsTable";
import { useProjectsData } from "./hooks/useProjectsData";
import { buildCustomerFilterOptions } from "./lib/projectFilters";
import type { ProjectRow, ProjectsModalMode, ProjectStatusFilter } from "./projects.types";

type ProjectsModalState = {
  opened: boolean;
  mode: ProjectsModalMode;
  row: ProjectRow | null;
};

const INITIAL_MODAL_STATE: ProjectsModalState = {
  opened: false,
  mode: "new",
  row: null,
};

export function ProjectsPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;

  const { customers, loading, refreshing, error, reload } = useProjectsData();

  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [rowsReloadKey, setRowsReloadKey] = useState(0);
  const [modalState, setModalState] = useState<ProjectsModalState>(INITIAL_MODAL_STATE);
  const { openConfirmModal, confirmModal } = useConfirmModal();
  const [debouncedTextFilter] = useDebouncedValue(textFilter, 150);

  const effectiveStatusFilter: ProjectStatusFilter = isAdmin ? statusFilter : "active";

  const customerFilterOptions = useMemo(
    () => buildCustomerFilterOptions(customers, customerFilter),
    [customers, customerFilter]
  );

  const hasFilters = Boolean(effectiveStatusFilter || customerFilter || textFilter);
  const panelMeta = hasFilters ? `${totalRows} treff` : `${totalRows} stk`;

  useEffect(() => {
    setPage(1);
  }, [effectiveStatusFilter, customerFilter, debouncedTextFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      setRowsLoading(true);
      setRowsError(null);

      try {
        const result = await fetchProjectPage({
          page,
          pageSize,
          filters: {
            status: effectiveStatusFilter,
            customer: customerFilter,
            text: debouncedTextFilter,
            isAdmin,
          },
        });
        if (cancelled) return;

        const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (result.total > 0 && page > totalPages) {
          setPage(totalPages);
          return;
        }

        setRows(result.items);
        setTotalRows(result.total);
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setTotalRows(0);
        setRowsError(err instanceof Error && err.message ? err.message : "Kunne ikke laste prosjekter.");
      } finally {
        if (!cancelled) {
          setRowsLoading(false);
        }
      }
    }

    void loadRows();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, effectiveStatusFilter, customerFilter, debouncedTextFilter, isAdmin, rowsReloadKey]);

  const refreshAll = useCallback(async () => {
    await reload();
    setRowsReloadKey((current) => current + 1);
  }, [reload]);

  const openNewModal = () => {
    if (!isAdmin) {
      toast("Du må være admin for å gjøre dette.");
      return;
    }

    setModalState({ opened: true, mode: "new", row: null });
  };

  const openEditModal = (row: ProjectRow) => {
    if (!isAdmin) {
      toast("Du må være admin for å gjøre dette.");
      return;
    }

    setModalState({ opened: true, mode: "edit", row });
  };

  const closeModal = () => {
    setModalState(INITIAL_MODAL_STATE);
  };

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    if (!Number.isFinite(nextPageSize) || nextPageSize < 1) return;
    setPageSize(nextPageSize);
    setPage(1);
  }, []);

  const requestDelete = (row: ProjectRow) => {
    if (!isAdmin) {
      toast("Du må være admin for å gjøre dette.");
      return;
    }

    openConfirmModal({
      title: "Slett prosjekt",
      messageHtml: `Dette sletter prosjektet <strong>${row.project_no}</strong>.`,
      confirmLabel: "Slett",
      confirmTone: "danger",
      onConfirm: async () => {
        await deleteProject(row.id);
      },
      onDone: async () => {
        await refreshAll();
        setPage(1);
        toast("Prosjekt slettet.");
      },
    });
  };

  return (
    <AppPageLayout pageClassName="page-projects-react" displayName={displayName} email={email}>
      <ProjectsHeader
        isAdmin={isAdmin}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => void refreshAll()}
        onAddProject={openNewModal}
      />

      <ProjectsFilters
        isAdmin={isAdmin}
        status={effectiveStatusFilter}
        customer={customerFilter}
        text={textFilter}
        customerOptions={customerFilterOptions}
        onStatusChange={setStatusFilter}
        onCustomerChange={setCustomerFilter}
        onTextChange={setTextFilter}
      />

      <AppPanel title="Prosjekter" meta={panelMeta}>
        <ProjectsTable
          rows={rows}
          loading={loading || rowsLoading}
          error={error || rowsError}
          hasFilters={hasFilters}
          isAdmin={isAdmin}
          page={page}
          totalRows={totalRows}
          pageSize={pageSize}
          onPageChange={(nextPage) => {
            startTransition(() => {
              setPage(nextPage);
            });
          }}
          onPageSizeChange={handlePageSizeChange}
          onEdit={openEditModal}
          onDelete={requestDelete}
        />
      </AppPanel>

      <ProjectFormModal
        opened={modalState.opened}
        mode={modalState.mode}
        row={modalState.row}
        customers={customers}
        onClose={closeModal}
        onSaved={async () => {
          await refreshAll();
          setPage(1);
        }}
        onCustomersRefresh={reload}
      />

      {confirmModal}
    </AppPageLayout>
  );
}

import { startTransition, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import type {
  ProjectRow,
  ProjectsFilters as ProjectsFilterState,
  ProjectsModalMode,
  ProjectStatusFilter,
} from "./projects.types";

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

type ProjectsQueryState = ProjectsFilterState & {
  page: number;
  pageSize: number;
  reloadKey: number;
};

type ProjectsQueryAction =
  | { type: "setStatus"; value: ProjectStatusFilter }
  | { type: "setCustomer"; value: string }
  | { type: "setText"; value: string }
  | { type: "setPage"; value: number }
  | { type: "setPageSize"; value: number }
  | { type: "reload" }
  | { type: "reloadFromFirstPage" };

const INITIAL_QUERY_STATE: ProjectsQueryState = {
  status: "",
  customer: "",
  text: "",
  page: 1,
  pageSize: 10,
  reloadKey: 0,
};

function projectsQueryReducer(state: ProjectsQueryState, action: ProjectsQueryAction): ProjectsQueryState {
  switch (action.type) {
    case "setStatus":
      if (state.status === action.value && state.page === 1) return state;
      return { ...state, status: action.value, page: 1 };
    case "setCustomer":
      if (state.customer === action.value && state.page === 1) return state;
      return { ...state, customer: action.value, page: 1 };
    case "setText":
      if (state.text === action.value && state.page === 1) return state;
      return { ...state, text: action.value, page: 1 };
    case "setPage": {
      const nextPage = Number.isFinite(action.value) ? Math.max(1, Math.trunc(action.value)) : state.page;
      if (nextPage === state.page) return state;
      return { ...state, page: nextPage };
    }
    case "setPageSize": {
      const nextPageSize = Number.isFinite(action.value) ? Math.max(1, Math.trunc(action.value)) : state.pageSize;
      if (nextPageSize === state.pageSize && state.page === 1) return state;
      return { ...state, pageSize: nextPageSize, page: 1 };
    }
    case "reload":
      return { ...state, reloadKey: state.reloadKey + 1 };
    case "reloadFromFirstPage":
      return { ...state, page: 1, reloadKey: state.reloadKey + 1 };
    default:
      return state;
  }
}

export function ProjectsPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;

  const { customers, loading, refreshing, error, reload } = useProjectsData();

  const [queryState, dispatchQuery] = useReducer(projectsQueryReducer, INITIAL_QUERY_STATE);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ProjectsModalState>(INITIAL_MODAL_STATE);
  const { openConfirmModal, confirmModal } = useConfirmModal();
  const [debouncedTextFilter] = useDebouncedValue(queryState.text, 150);
  const rowsRequestRef = useRef(0);

  const effectiveStatusFilter: ProjectStatusFilter = isAdmin ? queryState.status : "active";

  const customerFilterOptions = useMemo(
    () => buildCustomerFilterOptions(customers, queryState.customer),
    [customers, queryState.customer]
  );

  const hasFilters = Boolean(effectiveStatusFilter || queryState.customer || queryState.text);
  const panelMeta = hasFilters ? `${totalRows} treff` : `${totalRows} stk`;

  useEffect(() => {
    let cancelled = false;
    const requestId = ++rowsRequestRef.current;

    if (queryState.text !== debouncedTextFilter) {
      return () => {
        cancelled = true;
      };
    }

    async function loadRows() {
      setRowsLoading(true);
      setRowsError(null);

      try {
        const result = await fetchProjectPage({
          page: queryState.page,
          pageSize: queryState.pageSize,
          filters: {
            status: effectiveStatusFilter,
            customer: queryState.customer,
            text: debouncedTextFilter,
            isAdmin,
          },
        });
        if (cancelled || requestId !== rowsRequestRef.current) return;

        const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (result.total > 0 && queryState.page > totalPages) {
          dispatchQuery({ type: "setPage", value: totalPages });
          return;
        }

        setRows(result.items);
        setTotalRows(result.total);
      } catch (err) {
        if (cancelled || requestId !== rowsRequestRef.current) return;
        setRows([]);
        setTotalRows(0);
        setRowsError(err instanceof Error && err.message ? err.message : "Kunne ikke laste prosjekter.");
      } finally {
        if (!cancelled && requestId === rowsRequestRef.current) {
          setRowsLoading(false);
        }
      }
    }

    void loadRows();
    return () => {
      cancelled = true;
    };
  }, [
    queryState.page,
    queryState.pageSize,
    queryState.customer,
    queryState.reloadKey,
    queryState.text,
    effectiveStatusFilter,
    debouncedTextFilter,
    isAdmin,
  ]);

  const refreshAll = useCallback(async (options?: { resetPage?: boolean }) => {
    await reload();
    dispatchQuery({ type: options?.resetPage ? "reloadFromFirstPage" : "reload" });
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
    dispatchQuery({ type: "setPageSize", value: nextPageSize });
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
        customer={queryState.customer}
        text={queryState.text}
        customerOptions={customerFilterOptions}
        onStatusChange={(value) => dispatchQuery({ type: "setStatus", value })}
        onCustomerChange={(value) => dispatchQuery({ type: "setCustomer", value })}
        onTextChange={(value) => dispatchQuery({ type: "setText", value })}
      />

      <AppPanel title="Prosjekter" meta={panelMeta}>
        <ProjectsTable
          rows={rows}
          loading={loading || rowsLoading}
          error={error || rowsError}
          hasFilters={hasFilters}
          isAdmin={isAdmin}
          page={queryState.page}
          totalRows={totalRows}
          pageSize={queryState.pageSize}
          onPageChange={(nextPage) => {
            startTransition(() => {
              dispatchQuery({ type: "setPage", value: nextPage });
            });
          }}
          onPageSizeChange={handlePageSizeChange}
          onRetry={() => {
            void refreshAll();
          }}
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
          await refreshAll({ resetPage: true });
        }}
        onCustomersRefresh={reload}
      />

      {confirmModal}
    </AppPageLayout>
  );
}

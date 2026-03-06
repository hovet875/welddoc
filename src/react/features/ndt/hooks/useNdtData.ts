import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWelders, type ProfileWelderRow } from "@/repo/certRepo";
import { fetchCustomers, type CustomerRow } from "@/repo/customerRepo";
import { fetchNdtMethods, type NdtMethodRow } from "@/repo/ndtReportRepo";
import { fetchNdtInspectors, fetchNdtSuppliers, type NdtInspectorRow, type NdtSupplierRow } from "@/repo/ndtSupplierRepo";
import { fetchProjects, type ProjectRow } from "@/repo/projectRepo";

type NdtDataState = {
  methods: NdtMethodRow[];
  welders: ProfileWelderRow[];
  projects: ProjectRow[];
  customers: CustomerRow[];
  ndtSuppliers: NdtSupplierRow[];
  ndtInspectors: NdtInspectorRow[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

type NdtDataResult = NdtDataState & {
  reload: () => Promise<void>;
};

const INITIAL_STATE: NdtDataState = {
  methods: [],
  welders: [],
  projects: [],
  customers: [],
  ndtSuppliers: [],
  ndtInspectors: [],
  loading: true,
  refreshing: false,
  error: null,
};

function readErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return "Ukjent feil ved lasting av NDT-data.";
}

export function useNdtData(): NdtDataResult {
  const [state, setState] = useState<NdtDataState>(INITIAL_STATE);
  const loadSeqRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const isInitialLoad = !hasLoadedRef.current;

    setState((prev) => ({
      ...prev,
      loading: isInitialLoad,
      refreshing: !isInitialLoad,
      error: null,
    }));

    try {
      const [methods, welders, projects, customers, ndtSuppliers, ndtInspectors] = await Promise.all([
        fetchNdtMethods(),
        fetchWelders(),
        fetchProjects(),
        fetchCustomers(),
        fetchNdtSuppliers({ includeInactive: true }),
        fetchNdtInspectors({ includeInactive: true }),
      ]);
      if (seq !== loadSeqRef.current) return;

      hasLoadedRef.current = true;
      setState({
        methods,
        welders,
        projects,
        customers,
        ndtSuppliers,
        ndtInspectors,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (err) {
      if (seq !== loadSeqRef.current) return;

      hasLoadedRef.current = true;
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: readErrorMessage(err),
      }));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    ...state,
    reload,
  };
}

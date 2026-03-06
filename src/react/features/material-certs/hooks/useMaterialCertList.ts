import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMaterialCertificatePage,
  type MaterialCertificateListFilters,
  type MaterialCertificateRow,
} from "@/repo/materialCertificateRepo";

type MaterialCertListState = {
  rows: MaterialCertificateRow[];
  total: number;
  loading: boolean;
  error: string | null;
};

type UseMaterialCertListArgs = {
  page: number;
  pageSize: number;
  filters: MaterialCertificateListFilters;
};

type UseMaterialCertListResult = MaterialCertListState & {
  reload: () => Promise<void>;
};

const INITIAL_STATE: MaterialCertListState = {
  rows: [],
  total: 0,
  loading: true,
  error: null,
};

function readErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return "Kunne ikke hente materialsertifikater.";
}

export function useMaterialCertList({ page, pageSize, filters }: UseMaterialCertListArgs): UseMaterialCertListResult {
  const [state, setState] = useState<MaterialCertListState>(INITIAL_STATE);
  const querySeqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = querySeqRef.current + 1;
    querySeqRef.current = seq;

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const result = await fetchMaterialCertificatePage({
        page,
        pageSize,
        filters,
      });

      if (querySeqRef.current !== seq) return;

      setState({
        rows: result.items,
        total: result.total,
        loading: false,
        error: null,
      });
    } catch (err) {
      if (querySeqRef.current !== seq) return;

      setState({
        rows: [],
        total: 0,
        loading: false,
        error: readErrorMessage(err),
      });
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    ...state,
    reload,
  };
}

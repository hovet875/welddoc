import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchCustomers, type CustomerRow } from "../../../../../../repo/customerRepo";
import { fetchJobTitles, type JobTitleRow } from "../../../../../../repo/jobTitleRepo";
import { fetchNdtInspectors, fetchNdtSuppliers, type NdtInspectorRow, type NdtSupplierRow } from "../../../../../../repo/ndtSupplierRepo";
import { fetchSuppliers, type SupplierRow } from "../../../../../../repo/supplierRepo";
import type { OrganizationDataState, OrganizationListState } from "../organization.types";

type UseOrganizationDataArgs = {
  enabled: boolean;
};

type UseOrganizationDataResult = OrganizationDataState & {
  reloadAll: () => Promise<void>;
  reloadJobTitles: () => Promise<void>;
  reloadCustomers: () => Promise<void>;
  reloadSuppliers: () => Promise<void>;
  reloadNdt: () => Promise<void>;
};

const EMPTY_JOB_TITLE_STATE: OrganizationListState<JobTitleRow> = {
  loading: false,
  error: null,
  rows: [],
};

const EMPTY_CUSTOMER_STATE: OrganizationListState<CustomerRow> = {
  loading: false,
  error: null,
  rows: [],
};

const EMPTY_SUPPLIER_STATE: OrganizationListState<SupplierRow> = {
  loading: false,
  error: null,
  rows: [],
};

const EMPTY_NDT_SUPPLIER_STATE: OrganizationListState<NdtSupplierRow> = {
  loading: false,
  error: null,
  rows: [],
};

const EMPTY_NDT_INSPECTOR_STATE: OrganizationListState<NdtInspectorRow> = {
  loading: false,
  error: null,
  rows: [],
};

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useOrganizationData({ enabled }: UseOrganizationDataArgs): UseOrganizationDataResult {
  const [jobTitles, setJobTitles] = useState<OrganizationListState<JobTitleRow>>(EMPTY_JOB_TITLE_STATE);
  const [customers, setCustomers] = useState<OrganizationListState<CustomerRow>>(EMPTY_CUSTOMER_STATE);
  const [suppliers, setSuppliers] = useState<OrganizationListState<SupplierRow>>(EMPTY_SUPPLIER_STATE);
  const [ndtSuppliers, setNdtSuppliers] = useState<OrganizationListState<NdtSupplierRow>>(EMPTY_NDT_SUPPLIER_STATE);
  const [ndtInspectors, setNdtInspectors] = useState<OrganizationListState<NdtInspectorRow>>(EMPTY_NDT_INSPECTOR_STATE);

  const loadSeqRef = useRef({
    jobTitles: 0,
    customers: 0,
    suppliers: 0,
    ndt: 0,
  });

  const reloadJobTitles = useCallback(async () => {
    if (!enabled) {
      setJobTitles(EMPTY_JOB_TITLE_STATE);
      return;
    }

    const seq = ++loadSeqRef.current.jobTitles;
    setJobTitles((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const rows = await fetchJobTitles();
      if (seq !== loadSeqRef.current.jobTitles) return;
      setJobTitles({ loading: false, error: null, rows });
    } catch (err) {
      if (seq !== loadSeqRef.current.jobTitles) return;
      setJobTitles({
        loading: false,
        error: readErrorMessage(err, "Kunne ikke hente stillinger."),
        rows: [],
      });
    }
  }, [enabled]);

  const reloadCustomers = useCallback(async () => {
    if (!enabled) {
      setCustomers(EMPTY_CUSTOMER_STATE);
      return;
    }

    const seq = ++loadSeqRef.current.customers;
    setCustomers((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const rows = await fetchCustomers({ includeInactive: true });
      if (seq !== loadSeqRef.current.customers) return;
      setCustomers({ loading: false, error: null, rows });
    } catch (err) {
      if (seq !== loadSeqRef.current.customers) return;
      setCustomers({
        loading: false,
        error: readErrorMessage(err, "Kunne ikke hente kunder."),
        rows: [],
      });
    }
  }, [enabled]);

  const reloadSuppliers = useCallback(async () => {
    if (!enabled) {
      setSuppliers(EMPTY_SUPPLIER_STATE);
      return;
    }

    const seq = ++loadSeqRef.current.suppliers;
    setSuppliers((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const rows = await fetchSuppliers({ includeInactive: true });
      if (seq !== loadSeqRef.current.suppliers) return;
      setSuppliers({ loading: false, error: null, rows });
    } catch (err) {
      if (seq !== loadSeqRef.current.suppliers) return;
      setSuppliers({
        loading: false,
        error: readErrorMessage(err, "Kunne ikke hente leverandører."),
        rows: [],
      });
    }
  }, [enabled]);

  const reloadNdt = useCallback(async () => {
    if (!enabled) {
      setNdtSuppliers(EMPTY_NDT_SUPPLIER_STATE);
      setNdtInspectors(EMPTY_NDT_INSPECTOR_STATE);
      return;
    }

    const seq = ++loadSeqRef.current.ndt;
    setNdtSuppliers((prev) => ({ ...prev, loading: true, error: null }));
    setNdtInspectors((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [suppliersRows, inspectorsRows] = await Promise.all([
        fetchNdtSuppliers({ includeInactive: true }),
        fetchNdtInspectors({ includeInactive: true }),
      ]);
      if (seq !== loadSeqRef.current.ndt) return;

      setNdtSuppliers({ loading: false, error: null, rows: suppliersRows });
      setNdtInspectors({ loading: false, error: null, rows: inspectorsRows });
    } catch (err) {
      if (seq !== loadSeqRef.current.ndt) return;

      const message = readErrorMessage(err, "Kunne ikke hente NDT-data.");
      setNdtSuppliers({ loading: false, error: message, rows: [] });
      setNdtInspectors({ loading: false, error: message, rows: [] });
    }
  }, [enabled]);

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadJobTitles(), reloadCustomers(), reloadSuppliers(), reloadNdt()]);
  }, [reloadCustomers, reloadJobTitles, reloadNdt, reloadSuppliers]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  return useMemo(
    () => ({
      jobTitles,
      customers,
      suppliers,
      ndtSuppliers,
      ndtInspectors,
      reloadAll,
      reloadJobTitles,
      reloadCustomers,
      reloadSuppliers,
      reloadNdt,
    }),
    [
      jobTitles,
      customers,
      suppliers,
      ndtSuppliers,
      ndtInspectors,
      reloadAll,
      reloadJobTitles,
      reloadCustomers,
      reloadSuppliers,
      reloadNdt,
    ]
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCustomers, type CustomerRow } from "@/repo/customerRepo";

function readErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return "Kunne ikke laste prosjektdata.";
}

export function useProjectsData() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    const firstLoad = customers.length === 0;

    if (firstLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const nextCustomers = await fetchCustomers();
      if (requestId !== requestRef.current) return;
      setCustomers(nextCustomers);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(readErrorMessage(err));
    } finally {
      if (requestId !== requestRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [customers.length]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    customers,
    loading,
    refreshing,
    error,
    reload,
  };
}

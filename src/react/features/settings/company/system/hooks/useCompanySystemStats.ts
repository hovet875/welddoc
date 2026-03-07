import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSystemUsageStats, type SystemUsageStats } from "@/repo/systemUsageRepo";

type UseCompanySystemStatsArgs = {
  enabled: boolean;
};

type UseCompanySystemStatsResult = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  stats: SystemUsageStats | null;
  reload: () => Promise<void>;
};

function readError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useCompanySystemStats({ enabled }: UseCompanySystemStatsArgs): UseCompanySystemStatsResult {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SystemUsageStats | null>(null);
  const seqRef = useRef(0);
  const statsRef = useRef<SystemUsageStats | null>(null);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setRefreshing(false);
      setError(null);
      setStats(null);
      statsRef.current = null;
      return;
    }

    const seq = ++seqRef.current;
    const hasStats = statsRef.current !== null;
    if (hasStats) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const next = await fetchSystemUsageStats();
      if (seq !== seqRef.current) return;
      setStats(next);
      statsRef.current = next;
      setError(null);
    } catch (err) {
      if (seq !== seqRef.current) return;
      setError(readError(err, "Kunne ikke hente systemstatistikk."));
    } finally {
      if (seq !== seqRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    loading,
    refreshing,
    error,
    stats,
    reload,
  };
}

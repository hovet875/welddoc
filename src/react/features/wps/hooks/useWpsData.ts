import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMaterials, type MaterialRow } from "@/repo/materialRepo";
import { fetchStandards, type StandardRow } from "@/repo/standardRepo";
import { fetchWeldingProcesses, type WeldingProcessRow } from "@/repo/weldingProcessRepo";
import { fetchWeldJointTypes, type WeldJointTypeRow } from "@/repo/weldJointTypeRepo";
import { fetchWpsData, type WPQRRow, type WPSRow } from "@/repo/wpsRepo";

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useWpsData() {
  const [wpsRows, setWpsRows] = useState<WPSRow[]>([]);
  const [wpqrRows, setWpqrRows] = useState<WPQRRow[]>([]);
  const [processes, setProcesses] = useState<WeldingProcessRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [standards, setStandards] = useState<StandardRow[]>([]);
  const [jointTypes, setJointTypes] = useState<WeldJointTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const [wpsData, processData, materialData, standardData, jointTypeData] = await Promise.all([
        fetchWpsData(),
        fetchWeldingProcesses(),
        fetchMaterials(),
        fetchStandards(),
        fetchWeldJointTypes(),
      ]);
      if (!mountedRef.current) return;

      setWpsRows(wpsData.wps);
      setWpqrRows(wpsData.wpqr);
      setProcesses(processData);
      setMaterials(materialData);
      setStandards(standardData);
      setJointTypes(jointTypeData);
      hasLoadedRef.current = true;
    } catch (err) {
      if (!mountedRef.current) return;
      setError(readErrorMessage(err, "Kunne ikke laste WPS/WPQR."));
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void reload();

    return () => {
      mountedRef.current = false;
    };
  }, [reload]);

  return {
    wpsRows,
    wpqrRows,
    processes,
    materials,
    standards,
    jointTypes,
    loading,
    refreshing,
    error,
    reload,
  };
}

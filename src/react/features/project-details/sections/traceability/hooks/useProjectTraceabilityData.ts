import { useCallback, useEffect, useState } from "react";
import { fetchMaterials, type MaterialRow } from "@/repo/materialRepo";
import {
  fetchProjectTraceability,
  fetchTraceabilityOptions,
  fetchTraceabilityTypes,
  type ProjectTraceabilityRow,
  type TraceabilityTypeRow,
} from "@/repo/traceabilityRepo";
import type { TraceabilityOptionsByGroup } from "../types";

const EMPTY_OPTIONS: TraceabilityOptionsByGroup = {
  dn: [],
  sch: [],
  pn: [],
  filler: [],
};

type UseProjectTraceabilityDataResult = {
  loading: boolean;          // initial / full load
  error: string | null;

  rows: ProjectTraceabilityRow[];
  types: TraceabilityTypeRow[];
  options: TraceabilityOptionsByGroup;
  materials: MaterialRow[];

  reloadAll: () => Promise<void>;   // static + rows
  reloadRows: () => Promise<void>;  // only rows (fast after CRUD)
};

export function useProjectTraceabilityData(projectId: string): UseProjectTraceabilityDataResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<ProjectTraceabilityRow[]>([]);
  const [types, setTypes] = useState<TraceabilityTypeRow[]>([]);
  const [options, setOptions] = useState<TraceabilityOptionsByGroup>(EMPTY_OPTIONS);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);

  const loadStatic = useCallback(async () => {
    const [typeRows, dnRows, schRows, pnRows, fillerRows, materialRows] = await Promise.all([
      fetchTraceabilityTypes(),
      fetchTraceabilityOptions("dn"),
      fetchTraceabilityOptions("sch"),
      fetchTraceabilityOptions("pn"),
      fetchTraceabilityOptions("filler_type"),
      fetchMaterials(),
    ]);

    setTypes(typeRows);
    setOptions({
      dn: dnRows,
      sch: schRows,
      pn: pnRows,
      filler: fillerRows,
    });
    setMaterials(materialRows);
  }, []);

  const loadRows = useCallback(async () => {
    const traceRows = await fetchProjectTraceability(projectId);
    setRows(traceRows);
  }, [projectId]);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadStatic(), loadRows()]);
    } catch (err) {
      console.error(err);
      setError("Klarte ikke å hente materialsporbarhet.");
    } finally {
      setLoading(false);
    }
  }, [loadStatic, loadRows]);

  const reloadRows = useCallback(async () => {
    setError(null);
    try {
      await loadRows();
    } catch (err) {
      console.error(err);
      setError("Klarte ikke å hente materialsporbarhet.");
    }
  }, [loadRows]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  return {
    loading,
    error,
    rows,
    types,
    options,
    materials,
    reloadAll,
    reloadRows,
  };
}
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchProjectDrawingProgress,
  fetchProjectDrawings,
  type ProjectDrawingProgress,
  type ProjectDrawingRow,
} from "@/repo/projectDrawingRepo";

export function useProjectDrawingsData(projectId: string) {
  const [rows, setRows] = useState<ProjectDrawingRow[]>([]);
  const [progressByDrawingId, setProgressByDrawingId] = useState<Map<string, ProjectDrawingProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRows, nextProgressByDrawingId] = await Promise.all([
        fetchProjectDrawings(projectId),
        fetchProjectDrawingProgress(projectId),
      ]);
      setRows(nextRows);
      setProgressByDrawingId(nextProgressByDrawingId);
      setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => nextRows.some((row) => row.id === id))));
    } catch (err) {
      console.error(err);
      setProgressByDrawingId(new Map());
      setError("Klarte ikke å hente tegninger.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.has(row.id)), [rows, selectedIds]);
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(rows.map((row) => row.id)) : new Set());
    },
    [rows]
  );

  const toggleOne = useCallback((rowId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }, []);

  return {
    rows,
    progressByDrawingId,
    loading,
    error,
    selectedIds,
    selectedRows,
    allSelected,
    setSelectedIds,
    loadRows,
    toggleAll,
    toggleOne,
  };
}

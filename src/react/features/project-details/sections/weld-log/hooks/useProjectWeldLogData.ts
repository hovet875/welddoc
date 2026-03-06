import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWelders, fetchWelderCerts } from "@/repo/certRepo";
import { createPlaceholderProjectDrawing, fetchProjectDrawings } from "@/repo/projectDrawingRepo";
import { fetchProjectTraceability } from "@/repo/traceabilityRepo";
import {
  ensureProjectWeldLog,
  fetchProjectWeldLogs,
  fetchWeldEmployees,
  fetchWeldNdtReports,
  type ProjectWeldLogRow,
} from "@/repo/weldLogRepo";
import { fetchWelderCertScopes } from "@/repo/welderCertScopeRepo";
import { fetchWpsData } from "@/repo/wpsRepo";
import { drawingLabel, toTraceabilityOption } from "../lib/weldLogUtils";
import type { WeldLogDataBundle, WeldLogWpsOption } from "../types";

type UseProjectWeldLogDataResult = {
  loading: boolean;
  error: string | null;
  data: WeldLogDataBundle;
  drawingOptions: Array<{ value: string; label: string }>;
  drawingById: Map<string, { drawing_no: string; revision: string | null }>;
  logByDrawingId: Map<string, ProjectWeldLogRow>;
  reloadAll: () => Promise<void>;
  ensureLogIdForDrawing: (drawingId: string) => Promise<string>;
};

const EMPTY_DATA: WeldLogDataBundle = {
  drawings: [],
  logs: [],
  rows: [],
  reports: [],
  employees: [],
  welders: [],
  welderCerts: [],
  welderScopes: [],
  componentOptions: [],
  fillerOptions: [],
  wpsOptions: [],
  jointTypes: [],
};

export function useProjectWeldLogData(projectId: string, projectNo: number): UseProjectWeldLogDataResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeldLogDataBundle>(EMPTY_DATA);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const scopePromise = fetchWelderCertScopes().catch(() => []);
      const [
        drawingsRaw,
        logs,
        reports,
        employees,
        welders,
        welderCerts,
        welderScopes,
        traceRows,
        wpsData,
      ] = await Promise.all([
        fetchProjectDrawings(projectId),
        fetchProjectWeldLogs(projectId),
        fetchWeldNdtReports(String(projectNo ?? "").trim()),
        fetchWeldEmployees(),
        fetchWelders(),
        fetchWelderCerts(),
        scopePromise,
        fetchProjectTraceability(projectId),
        fetchWpsData(),
      ]);

      let drawings = drawingsRaw;
      if (!drawings.length) {
        const normalizedProjectNo = String(projectNo ?? "").trim();
        const defaultBase = normalizedProjectNo || "PROSJEKT";
        await createPlaceholderProjectDrawing({
          project_id: projectId,
          drawing_no: `${defaultBase}001`,
          revision: "-",
        });
        drawings = await fetchProjectDrawings(projectId);
      }

      const componentRows = traceRows.filter((row) => row.cert?.certificate_type !== "filler" && !row.type?.use_filler_type);
      const fillerRows = traceRows.filter(
        (row) =>
          row.cert?.certificate_type === "filler" || row.type?.use_filler_type || Boolean(String(row.filler_type ?? "").trim())
      );

      const sortOption = (a: { label: string }, b: { label: string }) =>
        a.label.localeCompare(b.label, "nb", { sensitivity: "base", numeric: true });

      const wpsOptions: WeldLogWpsOption[] = wpsData.wps
        .map((row) => ({
          id: row.id,
          doc_no: row.doc_no,
          process: row.process ?? null,
          standard_label: row.standard?.label ?? null,
          material_id: row.material_id ?? row.material?.id ?? null,
          joint_type: row.fuge ?? "",
          label: row.doc_no,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base", numeric: true }));

      const jointTypeSet = new Set<string>();
      welderCerts.forEach((cert) => {
        String(cert.coverage_joint_type ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .forEach((value) => jointTypeSet.add(value));
      });

      setData({
        drawings,
        logs,
        rows: [],
        reports,
        employees,
        welders,
        welderCerts,
        welderScopes,
        componentOptions: componentRows.map(toTraceabilityOption).sort(sortOption),
        fillerOptions: fillerRows.map(toTraceabilityOption).sort(sortOption),
        wpsOptions,
        jointTypes: Array.from(jointTypeSet).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" })),
      });
    } catch (err) {
      console.error(err);
      setError("Klarte ikke å hente sveiselogg-data.");
    } finally {
      setLoading(false);
    }
  }, [projectId, projectNo]);

  useEffect(() => {
    void load();
  }, [load]);

  const drawingById = useMemo(
    () =>
      new Map(
        data.drawings.map((drawing) => [drawing.id, { drawing_no: drawing.drawing_no, revision: drawing.revision }])
      ),
    [data.drawings]
  );

  const logByDrawingId = useMemo(
    () => new Map(data.logs.map((row) => [row.drawing_id, row])),
    [data.logs]
  );

  const drawingOptions = useMemo(
    () =>
      data.drawings.map((drawing) => ({
        value: drawing.id,
        label: drawingLabel(drawing.drawing_no, drawing.revision),
      })),
    [data.drawings]
  );

  const ensureLogIdForDrawing = useCallback(
    async (drawingId: string) => {
      const existing = logByDrawingId.get(drawingId);
      if (existing) return existing.id;
      return ensureProjectWeldLog(projectId, drawingId);
    },
    [logByDrawingId, projectId]
  );

  return {
    loading,
    error,
    data,
    drawingOptions,
    drawingById,
    logByDrawingId,
    reloadAll: load,
    ensureLogIdForDrawing,
  };
}

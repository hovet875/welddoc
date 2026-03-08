import type { ProjectDrawingProgress } from "@/repo/projectDrawingRepo";
import type { AppPdfPreviewState, DrawingRevision, DrawingStatus } from "../types";

export const REVISION_OPTIONS: DrawingRevision[] = ["-", "A", "B", "C", "D", "E", "F"];

export function createPdfPreviewState(): AppPdfPreviewState {
  return {
    opened: false,
    title: "Tegning",
    url: null,
    loading: false,
    error: null,
  };
}

export function formatFileSize(sizeBytes: number | null | undefined) {
  if (sizeBytes == null) return "";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const kb = sizeBytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function readError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function normalizeButtWeldCountInput(value: string) {
  return String(value ?? "").replace(/[^\d]/g, "");
}

export function parseButtWeldCount(value: string) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function resolveDrawingStatus(input: {
  buttWeldCount: number | null | undefined;
  progress: ProjectDrawingProgress | undefined;
}): DrawingStatus {
  const totalWelds = input.progress?.totalWelds ?? 0;
  const completedWelds = input.progress?.completedWelds ?? 0;

  if (totalWelds === 0) return "notStarted";

  const targetCount = Number(input.buttWeldCount ?? 0);
  const normalizedTarget = Number.isFinite(targetCount) && targetCount >= 0 ? Math.trunc(targetCount) : null;

  if (normalizedTarget != null && normalizedTarget > 0) {
    return completedWelds >= normalizedTarget ? "done" : "inProgress";
  }

  return completedWelds >= totalWelds ? "done" : "inProgress";
}

export function drawingStatusLabel(status: DrawingStatus) {
  if (status === "done") return "Ferdig";
  if (status === "inProgress") return "Under produksjon";
  return "Ikke startet";
}

export function drawingStatusTone(status: DrawingStatus): "neutral" | "info" | "success" {
  if (status === "done") return "success";
  if (status === "inProgress") return "info";
  return "neutral";
}

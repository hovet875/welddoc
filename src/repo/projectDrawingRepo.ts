import { supabase } from "../services/supabaseClient";
import { createUuid } from "../utils/id";
import {
  createFileRecord,
  createFileLink,
  createSignedUrlForFileRef,
  deleteFileRecord,
  uploadFileToIdPath,
} from "./fileRepo";

export type ProjectDrawingRow = {
  id: string;
  project_id: string;
  file_id: string;
  drawing_no: string;
  revision: string;
  butt_weld_count: number;
  created_by: string | null;
  created_at: string;
  file: { id: string; label: string | null; mime_type: string | null; size_bytes: number | null } | null;
};

export type ProjectDrawingProgress = {
  totalWelds: number;
  completedWelds: number;
};

export async function fetchProjectDrawings(projectId: string) {
  const { data, error } = await supabase
    .from("project_drawings")
    .select(
      `
      id,
      project_id,
      file_id,
      drawing_no,
      revision,
      butt_weld_count,
      created_by,
      created_at,
      file:file_id (
        id,
        label,
        mime_type,
        size_bytes
      )
    `
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ProjectDrawingRow[];
}

export async function createProjectDrawingWithFile(input: {
  project_id: string;
  drawing_no: string;
  revision: string;
  butt_weld_count: number;
  file: File;
}) {
  const fileId = createUuid();
  const drawingId = createUuid();
  let inserted = false;

  try {
    const { bucket, path, sha256 } = await uploadFileToIdPath("project_drawing", fileId, input.file);
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "project_drawing",
      label: input.file.name,
      mime_type: input.file.type || "application/pdf",
      size_bytes: input.file.size,
      sha256,
    });

    const { error } = await supabase.from("project_drawings").insert({
      id: drawingId,
      project_id: input.project_id,
      file_id: fileId,
      drawing_no: input.drawing_no,
      revision: input.revision,
      butt_weld_count: input.butt_weld_count,
    });
    if (error) throw error;
    inserted = true;

    await createFileLink(fileId, "project_drawing", drawingId);

    return drawingId;
  } catch (e) {
    if (inserted) {
      try {
        await supabase.from("project_drawings").delete().eq("id", drawingId);
      } catch {}
    }
    try {
      await deleteFileRecord(fileId);
    } catch {}
    throw e;
  }
}

export async function createPlaceholderProjectDrawing(input: {
  project_id: string;
  drawing_no: string;
  revision?: string | null;
  butt_weld_count?: number | null;
}) {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.addPage([595.28, 841.89]);
  const bytes = await pdf.save();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const file = new File([blob], `${input.drawing_no}.pdf`, { type: "application/pdf" });

  return createProjectDrawingWithFile({
    project_id: input.project_id,
    drawing_no: input.drawing_no,
    revision: input.revision ?? "-",
    butt_weld_count: Math.max(0, Math.trunc(Number(input.butt_weld_count ?? 0) || 0)),
    file,
  });
}

export async function updateProjectDrawing(
  drawingId: string,
  patch: { drawing_no: string; revision: string; butt_weld_count: number }
) {
  const { error } = await supabase
    .from("project_drawings")
    .update({
      drawing_no: patch.drawing_no,
      revision: patch.revision,
      butt_weld_count: patch.butt_weld_count,
    })
    .eq("id", drawingId);
  if (error) throw error;
}

export async function updateProjectDrawingFile(fileId: string, file: File) {
  const { bucket, path, sha256 } = await uploadFileToIdPath("project_drawing", fileId, file, {
    allowExistingFileId: fileId,
  });
  const { error } = await supabase
    .from("files")
    .update({
      bucket,
      path,
      label: file.name,
      mime_type: file.type || "application/pdf",
      size_bytes: file.size,
      sha256,
    })
    .eq("id", fileId);
  if (error) throw error;
}

export async function deleteProjectDrawing(drawingId: string, fileId: string | null) {
  const { error } = await supabase.from("project_drawings").delete().eq("id", drawingId);
  if (error) throw error;
  if (fileId) {
    await deleteFileRecord(fileId);
  }
}

export async function fetchProjectDrawingProgress(projectId: string) {
  const { data: logsData, error: logsError } = await supabase
    .from("project_weld_logs")
    .select("id, drawing_id")
    .eq("project_id", projectId);
  if (logsError) throw logsError;

  const logs = (logsData ?? []) as Array<{ id: string; drawing_id: string }>;
  if (logs.length === 0) return new Map<string, ProjectDrawingProgress>();

  const logIdToDrawingId = new Map(logs.map((row) => [row.id, row.drawing_id]));
  const progressByDrawingId = new Map<string, ProjectDrawingProgress>();

  for (const row of logs) {
    if (!progressByDrawingId.has(row.drawing_id)) {
      progressByDrawingId.set(row.drawing_id, { totalWelds: 0, completedWelds: 0 });
    }
  }

  const logIds = logs.map((row) => row.id);
  const { data: weldData, error: weldError } = await supabase
    .from("project_welds")
    .select("log_id, status")
    .in("log_id", logIds);
  if (weldError) throw weldError;

  const weldRows = (weldData ?? []) as Array<{ log_id: string; status: boolean | null }>;
  for (const weld of weldRows) {
    const drawingId = logIdToDrawingId.get(weld.log_id);
    if (!drawingId) continue;
    const current = progressByDrawingId.get(drawingId) ?? { totalWelds: 0, completedWelds: 0 };
    current.totalWelds += 1;
    if (weld.status === true) current.completedWelds += 1;
    progressByDrawingId.set(drawingId, current);
  }

  return progressByDrawingId;
}

export async function openProjectDrawingPdf(ref: string) {
  const url = await createSignedUrlForFileRef(ref, { expiresSeconds: 120 });
  window.open(url, "_blank", "noopener,noreferrer");
}

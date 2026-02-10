import { supabase } from "../services/supabaseClient";
import { PDFDocument } from "pdf-lib";
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
  created_by: string | null;
  created_at: string;
  file: { id: string; label: string | null; mime_type: string | null; size_bytes: number | null } | null;
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
  file: File;
}) {
  const fileId = crypto.randomUUID();
  const drawingId = crypto.randomUUID();
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
}) {
  const pdf = await PDFDocument.create();
  pdf.addPage([595.28, 841.89]);
  const bytes = await pdf.save();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const file = new File([blob], `${input.drawing_no}.pdf`, { type: "application/pdf" });

  return createProjectDrawingWithFile({
    project_id: input.project_id,
    drawing_no: input.drawing_no,
    revision: input.revision ?? "-",
    file,
  });
}

export async function updateProjectDrawing(
  drawingId: string,
  patch: { drawing_no: string; revision: string }
) {
  const { error } = await supabase
    .from("project_drawings")
    .update({ drawing_no: patch.drawing_no, revision: patch.revision })
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

export async function openProjectDrawingPdf(ref: string) {
  const url = await createSignedUrlForFileRef(ref, { expiresSeconds: 120 });
  window.open(url, "_blank", "noopener,noreferrer");
}

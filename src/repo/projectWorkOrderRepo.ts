import { supabase } from "../services/supabaseClient";
import {
  createFileRecord,
  createFileLink,
  createSignedUrlForFileRef,
  deleteFileRecord,
  uploadFileToIdPath,
} from "./fileRepo";

export type ProjectWorkOrderRow = {
  link_id: string;
  entity_id: string;
  file_id: string;
  created_at: string;
  file: { id: string; label: string | null; mime_type: string | null; size_bytes: number | null } | null;
};

export async function fetchProjectWorkOrder(projectId: string) {
  const { data, error } = await supabase
    .from("file_links")
    .select(
      `
      id,
      entity_id,
      file_id,
      created_at,
      file:file_id (
        id,
        label,
        mime_type,
        size_bytes
      )
    `
    )
    .eq("entity_type", "project_work_order")
    .eq("entity_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as ProjectWorkOrderRow | null;
}

export async function upsertProjectWorkOrder(projectId: string, file: File) {
  const existing = await fetchProjectWorkOrder(projectId);
  if (existing?.file_id) {
    const { bucket, path, sha256 } = await uploadFileToIdPath("project_work_order", existing.file_id, file, {
      allowExistingFileId: existing.file_id,
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
      .eq("id", existing.file_id);
    if (error) throw error;
    return existing;
  }

  const fileId = crypto.randomUUID();
  const { bucket, path, sha256 } = await uploadFileToIdPath("project_work_order", fileId, file);
  await createFileRecord({
    id: fileId,
    bucket,
    path,
    type: "project_work_order",
    label: file.name,
    mime_type: file.type || "application/pdf",
    size_bytes: file.size,
    sha256,
  });
  await createFileLink(fileId, "project_work_order", projectId);
  return await fetchProjectWorkOrder(projectId);
}

export async function deleteProjectWorkOrder(projectId: string, fileId: string) {
  const { error } = await supabase
    .from("file_links")
    .delete()
    .eq("entity_type", "project_work_order")
    .eq("entity_id", projectId)
    .eq("file_id", fileId);
  if (error) throw error;
  await deleteFileRecord(fileId);
}

export async function openProjectWorkOrderPdf(ref: string) {
  const url = await createSignedUrlForFileRef(ref, { expiresSeconds: 120 });
  window.open(url, "_blank", "noopener,noreferrer");
}

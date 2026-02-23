import { supabase } from "../services/supabaseClient";
import { countFileLinks, deleteFileRecord } from "./fileRepo";

export type FileInboxTarget = "ndt_report" | "material_certificate";
export type FileInboxStatus = "new" | "processed" | "error";

export type FileInboxRow = {
  id: string;
  file_id: string;
  target: FileInboxTarget;
  status: FileInboxStatus;
  source_folder: string;
  source_path: string;
  suggested_meta: Record<string, unknown>;
  error_message: string | null;
  received_at: string;
  processed_at: string | null;
  file: { id: string; label: string | null; mime_type: string | null; size_bytes: number | null } | null;
};

export async function countNewFileInboxByTarget(target: FileInboxTarget) {
  const { count, error } = await supabase
    .from("file_inbox")
    .select("id", { count: "exact", head: true })
    .eq("target", target)
    .eq("status", "new");
  if (error) throw error;
  return count ?? 0;
}

export async function fetchNewFileInboxByTarget(target: FileInboxTarget, opts?: { limit?: number }) {
  const q = supabase
    .from("file_inbox")
    .select(
      `
      id,
      file_id,
      target,
      status,
      source_folder,
      source_path,
      suggested_meta,
      error_message,
      received_at,
      processed_at,
      file:file_id (
        id,
        label,
        mime_type,
        size_bytes
      )
    `
    )
    .eq("target", target)
    .eq("status", "new")
    .order("received_at", { ascending: false });

  const maxRows = opts?.limit ?? 200;
  const { data, error } = await q.limit(maxRows);
  if (error) throw error;
  return (data ?? []) as unknown as FileInboxRow[];
}

export async function markFileInboxProcessed(id: string) {
  const { error } = await supabase
    .from("file_inbox")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function markFileInboxError(id: string, message: string) {
  const { error } = await supabase
    .from("file_inbox")
    .update({
      status: "error",
      error_message: message,
      processed_at: null,
    })
    .eq("id", id);
  if (error) throw error;
}

async function countInboxRowsByFile(fileId: string) {
  const { count, error } = await supabase
    .from("file_inbox")
    .select("id", { count: "exact", head: true })
    .eq("file_id", fileId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteFileInboxEntryAndMaybeFile(id: string) {
  const { data: row, error: rowErr } = await supabase
    .from("file_inbox")
    .select("id, file_id")
    .eq("id", id)
    .maybeSingle();
  if (rowErr) throw rowErr;
  if (!row?.id || !row.file_id) return;

  const fileId = String(row.file_id);

  const { error: delInboxErr } = await supabase
    .from("file_inbox")
    .delete()
    .eq("id", id);
  if (delInboxErr) throw delInboxErr;

  const [linkCount, inboxCount] = await Promise.all([
    countFileLinks(fileId),
    countInboxRowsByFile(fileId),
  ]);

  if (linkCount === 0 && inboxCount === 0) {
    try {
      await deleteFileRecord(fileId);
    } catch (err) {
      console.warn("File inbox deleted, but orphan file cleanup failed", err);
    }
  }
}

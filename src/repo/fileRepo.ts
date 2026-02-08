import { supabase } from "../services/supabaseClient";

export type FileRow = {
  id: string;
  bucket: string;
  path: string;
  type: string;
  label: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  sha256: string | null;
  created_by: string | null;
  created_at: string;
};

export type FileLinkRow = {
  id: string;
  file_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
};

const BUCKET_FILES = "files";

export function buildFilePath(type: string, id: string, ext = "pdf") {
  return `${type}/${id}.${ext}`;
}

function arrayBufferToHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeFileSha256(file: File) {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return arrayBufferToHex(hash);
}

export async function findFileBySha256(sha256: string) {
  const { data, error } = await supabase
    .from("files")
    .select("id, label")
    .eq("sha256", sha256)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; label: string | null } | null;
}

export async function uploadFileToIdPath(
  type: string,
  id: string,
  file: File,
  opts?: { allowExistingFileId?: string }
) {
  const sha256 = await computeFileSha256(file);
  const existing = await findFileBySha256(sha256);
  if (existing && existing.id !== opts?.allowExistingFileId) {
    throw new Error("Denne filen finnes allerede i systemet.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = buildFilePath(type, id, ext);
  const { error } = await supabase.storage.from(BUCKET_FILES).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (error) throw error;
  return { bucket: BUCKET_FILES, path, sha256 };
}

export async function createFileRecord(input: {
  id: string;
  bucket: string;
  path: string;
  type: string;
  label?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  sha256?: string | null;
}) {
  const { error } = await supabase.from("files").insert({
    id: input.id,
    bucket: input.bucket,
    path: input.path,
    type: input.type,
    label: input.label ?? null,
    mime_type: input.mime_type ?? null,
    size_bytes: input.size_bytes ?? null,
    sha256: input.sha256 ?? null,
  });
  if (error) throw error;
}

export async function createFileLink(fileId: string, entityType: string, entityId: string) {
  const { error } = await supabase.from("file_links").insert({
    file_id: fileId,
    entity_type: entityType,
    entity_id: entityId,
  });
  if (error) throw error;
}

export async function deleteFileLink(entityType: string, entityId: string) {
  const { error } = await supabase.from("file_links").delete().eq("entity_type", entityType).eq("entity_id", entityId);
  if (error) throw error;
}

export async function countFileLinks(fileId: string) {
  const { count, error } = await supabase
    .from("file_links")
    .select("id", { count: "exact", head: true })
    .eq("file_id", fileId);
  if (error) throw error;
  return count ?? 0;
}

export async function getFileMeta(fileId: string) {
  const { data, error } = await supabase
    .from("files")
    .select("bucket, path")
    .eq("id", fileId)
    .single();
  if (error) throw error;
  return data as { bucket: string; path: string };
}

export async function deleteFileRecord(fileId: string) {
  const meta = await getFileMeta(fileId);
  await supabase.storage.from(meta.bucket).remove([meta.path]);
  const { error } = await supabase.from("files").delete().eq("id", fileId);
  if (error) throw error;
}

export async function deleteFileRecordIfOrphan(fileId: string) {
  const linkCount = await countFileLinks(fileId);
  if (linkCount > 0) return;
  await deleteFileRecord(fileId);
}

export async function createSignedUrlForFileRef(
  ref: string,
  opts?: { legacyBucket?: string; expiresSeconds?: number }
) {
  const expiresSeconds = opts?.expiresSeconds ?? 120;

  if (ref.includes("/")) {
    const bucket = opts?.legacyBucket ?? BUCKET_FILES;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(ref, expiresSeconds);
    if (error) throw error;
    return data.signedUrl;
  }

  const { bucket, path } = await getFileMeta(ref);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSeconds);
  if (error) throw error;
  return data.signedUrl;
}

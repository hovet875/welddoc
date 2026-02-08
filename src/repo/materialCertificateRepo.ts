import { supabase } from "../services/supabaseClient";
import {
  createFileRecord,
  createFileLink,
  createSignedUrlForFileRef,
  deleteFileLink,
  deleteFileRecord,
  deleteFileRecordIfOrphan,
  uploadFileToIdPath,
} from "./fileRepo";

export type MaterialCertificateType = "material" | "filler";

export type MaterialCertificateRow = {
  id: string;
  certificate_type: MaterialCertificateType;
  cert_type: string;
  material_id: string | null;
  filler_type: string | null;
  supplier: string | null;
  heat_numbers: string[] | null;
  file_id: string | null;
  created_by: string | null;
  created_at: string;
  material: { id: string; name: string } | null;
  file: { id: string; label: string | null; mime_type: string | null; size_bytes: number | null } | null;
};

export async function fetchMaterialCertificates() {
  const { data, error } = await supabase
    .from("material_certificates")
    .select(
      `
      id,
      certificate_type,
      cert_type,
      material_id,
      filler_type,
      supplier,
      heat_numbers,
      file_id,
      created_by,
      created_at,
      material:material_id (
        id,
        name
      ),
      file:file_id (
        id,
        label,
        mime_type,
        size_bytes
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as MaterialCertificateRow[];
}

export async function createMaterialCertificateWithFile(input: {
  certificate_type: MaterialCertificateType;
  cert_type: string;
  material_id?: string | null;
  filler_type?: string | null;
  supplier?: string | null;
  file: File;
}) {
  const fileId = crypto.randomUUID();
  const certId = crypto.randomUUID();
  let certInserted = false;

  try {
    const { bucket, path, sha256 } = await uploadFileToIdPath("material_certificate", fileId, input.file);
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "material_certificate",
      label: input.file.name,
      mime_type: input.file.type || "application/pdf",
      size_bytes: input.file.size,
      sha256,
    });

    const { error } = await supabase.from("material_certificates").insert({
      id: certId,
      certificate_type: input.certificate_type,
      cert_type: input.cert_type,
      material_id: input.material_id ?? null,
      filler_type: input.filler_type ?? null,
      supplier: input.supplier ?? null,
      heat_numbers: [],
      file_id: fileId,
    });
    if (error) throw error;
    certInserted = true;

    await createFileLink(fileId, "material_certificate", certId);

    return certId;
  } catch (e) {
    if (certInserted) {
      try {
        await supabase.from("material_certificates").delete().eq("id", certId);
      } catch {}
    }
    try {
      await deleteFileRecord(fileId);
    } catch {}
    throw e;
  }
}

export async function createMaterialCertificateWithExistingFile(input: {
  certificate_type: MaterialCertificateType;
  cert_type: string;
  material_id?: string | null;
  filler_type?: string | null;
  supplier?: string | null;
  file_id: string;
}) {
  const certId = crypto.randomUUID();
  let certInserted = false;

  try {
    const { error } = await supabase.from("material_certificates").insert({
      id: certId,
      certificate_type: input.certificate_type,
      cert_type: input.cert_type,
      material_id: input.material_id ?? null,
      filler_type: input.filler_type ?? null,
      supplier: input.supplier ?? null,
      heat_numbers: [],
      file_id: input.file_id,
    });
    if (error) throw error;
    certInserted = true;

    await createFileLink(input.file_id, "material_certificate", certId);

    return certId;
  } catch (e) {
    if (certInserted) {
      try {
        await supabase.from("material_certificates").delete().eq("id", certId);
      } catch {}
    }
    throw e;
  }
}

export async function updateMaterialCertificate(
  id: string,
  patch: Partial<Pick<MaterialCertificateRow, "supplier" | "heat_numbers" | "certificate_type" | "cert_type" | "material_id" | "filler_type">>
) {
  const { error } = await supabase.from("material_certificates").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteMaterialCertificate(id: string, fileId: string | null) {
  const { error } = await supabase.from("material_certificates").delete().eq("id", id);
  if (error) throw error;
  await deleteFileLink("material_certificate", id);
  if (fileId) {
    await deleteFileRecordIfOrphan(fileId);
  }
}

export async function openMaterialCertificatePdf(ref: string) {
  const url = await createSignedUrlForFileRef(ref, { expiresSeconds: 120 });
  window.open(url, "_blank", "noopener,noreferrer");
}

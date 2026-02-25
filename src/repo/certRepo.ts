import { supabase } from "../services/supabaseClient";
import { createUuid } from "../utils/id";

export type ProfileWelderRow = {
  id: string;
  display_name: string | null;
  welder_no: string | null;
};

export type WelderCertRow = {
  id: string;
  profile_id: string;
  certificate_no: string;
  standard: string;
  welding_process_code: string | null;
  base_material_id: string | null;
  coverage_joint_type: string | null;
  coverage_thickness: string | null;
  expires_at: string | null; // date -> string
  fm_group: string | null;
  pdf_path: string;
  file_id: string | null;
  created_at: string;

  // join
  profile: { id: string; display_name: string | null; welder_no: string | null } | null;
  base_material?: { id: string; name: string; material_code: string; material_group: string } | null;
};

export type WelderCertLookupRow = Pick<
  WelderCertRow,
  | "id"
  | "profile_id"
  | "certificate_no"
  | "standard"
  | "welding_process_code"
  | "base_material_id"
  | "coverage_joint_type"
  | "fm_group"
  | "expires_at"
  | "created_at"
>;

export type NdtCertRow = {
  id: string;
  personnel_name: string;
  company: string;
  certificate_no: string;
  ndt_method: string;
  expires_at: string | null;
  pdf_path: string;
  file_id: string | null;
  created_at: string;
};

export type CertFetchResult = {
  welders: ProfileWelderRow[];        // for admin dropdown
  welderCerts: WelderCertRow[];
  ndtCerts: NdtCertRow[];
};

export async function fetchWelders(): Promise<ProfileWelderRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, welder_no")
    .not("welder_no", "is", null)
    .neq("welder_no", "")
    .order("welder_no", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProfileWelderRow[];
}

export async function fetchWelderCerts(): Promise<WelderCertLookupRow[]> {
  const { data, error } = await supabase
    .from("welder_certificates")
    .select(
      "id, profile_id, certificate_no, standard, welding_process_code, base_material_id, coverage_joint_type, fm_group, expires_at, created_at"
    )
    .order("certificate_no", { ascending: true })
    .order("expires_at", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as WelderCertLookupRow[];
}

export type UpsertWelderCertInput = {
  profile_id: string;
  certificate_no: string;
  standard: string;
  welding_process_code: string | null;
  base_material_id: string | null;
  coverage_joint_type: string | null;
  coverage_thickness: string | null;
  expires_at: string | null; // "YYYY-MM-DD" eller null
  fm_group: string | null;
  file_id?: string | null;
};

export type UpsertNdtCertInput = {
  personnel_name: string;
  company: string;
  certificate_no: string;
  ndt_method: string;
  expires_at: string | null;
  file_id?: string | null;
};

const BUCKET_WELDER = "welder-certs";
const BUCKET_NDT = "ndt-certs";
const BUCKET_FILES = "files";

/** ---- Fetch ---- */
export async function fetchCertData(): Promise<CertFetchResult> {
  const [weldersRes, welderCertsRes, ndtRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, welder_no")
      .not("welder_no", "is", null)
      .neq("welder_no", "")
      .order("welder_no", { ascending: true }),

    supabase
      .from("welder_certificates")
      .select(`
        id,
        profile_id,
        certificate_no,
        standard,
        welding_process_code,
        base_material_id,
        coverage_joint_type,
        coverage_thickness,
        expires_at,
        fm_group,
        pdf_path,
        file_id,
        created_at,
        profile:profile_id (
          id,
          display_name,
          welder_no
        ),
        base_material:base_material_id (
          id,
          name,
          material_code,
          material_group
        )
      `)
      .order("created_at", { ascending: false }),

    supabase
      .from("ndt_certificates")
      .select("id, personnel_name, company, certificate_no, ndt_method, expires_at, pdf_path, file_id, created_at")
      .order("ndt_method", { ascending: true })
      .order("expires_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  if (weldersRes.error) throw weldersRes.error;
  if (welderCertsRes.error) throw welderCertsRes.error;
  if (ndtRes.error) throw ndtRes.error;

  return {
    welders: (weldersRes.data ?? []) as ProfileWelderRow[],
    welderCerts: ((welderCertsRes.data ?? []) as unknown as WelderCertRow[]),
    ndtCerts: (ndtRes.data ?? []) as NdtCertRow[],
  };
}

/** ---- Storage ---- */
export async function createCertPdfSignedUrl(kind: "welder" | "ndt", ref: string, expiresSeconds = 120) {
  // ref can be legacy path (contains "/") or file_id (UUID)
  if (ref.includes("/")) {
    const bucket = kind === "welder" ? BUCKET_WELDER : BUCKET_NDT;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(ref, expiresSeconds);
    if (error) throw error;
    return data.signedUrl;
  }

  const { data: fileRow, error } = await supabase
    .from("files")
    .select("bucket, path")
    .eq("id", ref)
    .single();

  if (error) throw error;
  const { data, error: urlErr } = await supabase.storage
    .from(fileRow.bucket)
    .createSignedUrl(fileRow.path, expiresSeconds);
  if (urlErr) throw urlErr;
  return data.signedUrl;
}

function filePath(type: string, id: string) {
  return `${type}/${id}.pdf`;
}

function arrayBufferToHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function computeFileSha256(file: File) {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return arrayBufferToHex(hash);
}

async function findFileBySha256(sha256: string) {
  const { data, error } = await supabase
    .from("files")
    .select("id, label")
    .eq("sha256", sha256)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; label: string | null } | null;
}

async function uploadFileToIdPath(
  type: string,
  id: string,
  file: File,
  opts?: { allowExistingFileId?: string | null }
) {
  const sha256 = await computeFileSha256(file);
  const existing = await findFileBySha256(sha256);
  const allowedId = opts?.allowExistingFileId ?? null;
  if (existing && existing.id !== allowedId) {
    throw new Error("Denne filen finnes allerede i systemet.");
  }
  const path = filePath(type, id);
  const { error } = await supabase.storage.from(BUCKET_FILES).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (error) throw error;
  return { bucket: BUCKET_FILES, path, sha256 };
}

async function createFileRecord(input: {
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

async function updateFileRecordById(
  id: string,
  input: {
    bucket: string;
    path: string;
    type: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    sha256?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("files")
    .update({
      bucket: input.bucket,
      path: input.path,
      type: input.type,
      mime_type: input.mime_type ?? null,
      size_bytes: input.size_bytes ?? null,
      sha256: input.sha256 ?? null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (data) return;

  await createFileRecord({
    id,
    bucket: input.bucket,
    path: input.path,
    type: input.type,
    mime_type: input.mime_type ?? null,
    size_bytes: input.size_bytes ?? null,
    sha256: input.sha256 ?? null,
  });
}

async function getFileMeta(fileId: string) {
  const { data, error } = await supabase
    .from("files")
    .select("bucket, path")
    .eq("id", fileId)
    .single();
  if (error) throw error;
  return data as { bucket: string; path: string };
}

async function deleteFileRecord(fileId: string) {
  const meta = await getFileMeta(fileId);
  await supabase.storage.from(meta.bucket).remove([meta.path]);
  const { error } = await supabase.from("files").delete().eq("id", fileId);
  if (error) throw error;
}

async function deletePdfIfExists(kind: "welder" | "ndt", pdf_path: string | null) {
  if (!pdf_path) return;
  const bucket = kind === "welder" ? BUCKET_WELDER : BUCKET_NDT;
  const { error } = await supabase.storage.from(bucket).remove([pdf_path]);
  if (error) console.warn("Klarte ikke å slette PDF:", error);
}

/** ---- CRUD: Welder certificates ---- */
export async function insertWelderCert(base: UpsertWelderCertInput) {
  const { data, error } = await supabase
    .from("welder_certificates")
    .insert({ ...base, pdf_path: "" }) // legacy
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateWelderCert(id: string, base: Partial<UpsertWelderCertInput> & { pdf_path?: string | null }) {
  const { error } = await supabase.from("welder_certificates").update(base).eq("id", id);
  if (error) throw error;
}

export async function getWelderCertPdfPath(id: string) {
  const { data, error } = await supabase
    .from("welder_certificates")
    .select("pdf_path, file_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    pdf_path: (data?.pdf_path ?? null) as string | null,
    file_id: (data?.file_id ?? null) as string | null,
  };
}

export async function createWelderCertWithPdf(base: UpsertWelderCertInput, pdfFile: File) {
  const fileId = createUuid();
  const certId = await insertWelderCert({ ...base, file_id: null });
  let uploadedPath: string | null = null;
  let fileRecordCreated = false;

  try {
    const { bucket, path, sha256 } = await uploadFileToIdPath("welder_certificate", fileId, pdfFile);
    uploadedPath = path;
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "welder_certificate",
      mime_type: pdfFile.type || "application/pdf",
      size_bytes: pdfFile.size,
      sha256,
    });
    fileRecordCreated = true;
    await updateWelderCert(certId, { file_id: fileId });
    return certId;
  } catch (e) {
    try {
      if (fileRecordCreated) {
        await deleteFileRecord(fileId);
      } else if (uploadedPath) {
        await supabase.storage.from(BUCKET_FILES).remove([uploadedPath]);
      }
    } catch {}
    try {
      await supabase.from("welder_certificates").delete().eq("id", certId);
    } catch {}
    throw e;
  }
}

export async function updateWelderCertWithPdf(
  id: string,
  base: UpsertWelderCertInput,
  opts: { pdfFile: File | null; removePdf: boolean }
) {
  const current = await getWelderCertPdfPath(id);

  await updateWelderCert(id, base);

  if (opts.removePdf) {
    if (current.file_id) {
      await updateWelderCert(id, { file_id: null });
      await deleteFileRecord(current.file_id);
    }
    if (current.pdf_path) {
      await updateWelderCert(id, { pdf_path: null });
      await deletePdfIfExists("welder", current.pdf_path);
    }
    return;
  }

  if (opts.pdfFile) {
    if (current.file_id) {
      const { bucket, path, sha256 } = await uploadFileToIdPath("welder_certificate", current.file_id, opts.pdfFile, {
        allowExistingFileId: current.file_id,
      });
      await updateFileRecordById(current.file_id, {
        bucket,
        path,
        type: "welder_certificate",
        mime_type: opts.pdfFile.type || "application/pdf",
        size_bytes: opts.pdfFile.size,
        sha256,
      });
      if (current.pdf_path) await deletePdfIfExists("welder", current.pdf_path);
      return;
    }

    const fileId = createUuid();
    const { bucket, path, sha256 } = await uploadFileToIdPath("welder_certificate", fileId, opts.pdfFile);
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "welder_certificate",
      mime_type: opts.pdfFile.type || "application/pdf",
      size_bytes: opts.pdfFile.size,
      sha256,
    });

    await updateWelderCert(id, { file_id: fileId });

    if (current.file_id) await deleteFileRecord(current.file_id);
    if (current.pdf_path) await deletePdfIfExists("welder", current.pdf_path);
  }
}

export async function deleteWelderCert(id: string) {
  const pdf = await getWelderCertPdfPath(id);
  const { error: delErr } = await supabase.from("welder_certificates").delete().eq("id", id);
  if (delErr) throw delErr;
  if (pdf.file_id) await deleteFileRecord(pdf.file_id);
  if (pdf.pdf_path) await deletePdfIfExists("welder", pdf.pdf_path);
}

/** ---- CRUD: NDT certificates ---- */
export async function insertNdtCert(base: UpsertNdtCertInput) {
  const { data, error } = await supabase
    .from("ndt_certificates")
    .insert({ ...base, pdf_path: "" })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateNdtCert(id: string, base: Partial<UpsertNdtCertInput> & { pdf_path?: string | null }) {
  const { error } = await supabase.from("ndt_certificates").update(base).eq("id", id);
  if (error) throw error;
}

export async function getNdtCertPdfPath(id: string) {
  const { data, error } = await supabase
    .from("ndt_certificates")
    .select("pdf_path, file_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    pdf_path: (data?.pdf_path ?? null) as string | null,
    file_id: (data?.file_id ?? null) as string | null,
  };
}

export async function createNdtCertWithPdf(base: UpsertNdtCertInput, pdfFile: File) {
  const fileId = createUuid();
  const certId = await insertNdtCert({ ...base, file_id: null });
  let uploadedPath: string | null = null;
  let fileRecordCreated = false;

  try {
    const { bucket, path, sha256 } = await uploadFileToIdPath("ndt_report", fileId, pdfFile);
    uploadedPath = path;
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "ndt_report",
      mime_type: pdfFile.type || "application/pdf",
      size_bytes: pdfFile.size,
      sha256,
    });
    fileRecordCreated = true;
    await updateNdtCert(certId, { file_id: fileId });
    return certId;
  } catch (e) {
    try {
      if (fileRecordCreated) {
        await deleteFileRecord(fileId);
      } else if (uploadedPath) {
        await supabase.storage.from(BUCKET_FILES).remove([uploadedPath]);
      }
    } catch {}
    try {
      await supabase.from("ndt_certificates").delete().eq("id", certId);
    } catch {}
    throw e;
  }
}

export async function updateNdtCertWithPdf(
  id: string,
  base: UpsertNdtCertInput,
  opts: { pdfFile: File | null; removePdf: boolean }
) {
  const current = await getNdtCertPdfPath(id);

  await updateNdtCert(id, base);

  if (opts.removePdf) {
    if (current.file_id) {
      await updateNdtCert(id, { file_id: null });
      await deleteFileRecord(current.file_id);
    }
    if (current.pdf_path) {
      await updateNdtCert(id, { pdf_path: null });
      await deletePdfIfExists("ndt", current.pdf_path);
    }
    return;
  }

  if (opts.pdfFile) {
    if (current.file_id) {
      const { bucket, path, sha256 } = await uploadFileToIdPath("ndt_report", current.file_id, opts.pdfFile, {
        allowExistingFileId: current.file_id,
      });
      await updateFileRecordById(current.file_id, {
        bucket,
        path,
        type: "ndt_report",
        mime_type: opts.pdfFile.type || "application/pdf",
        size_bytes: opts.pdfFile.size,
        sha256,
      });
      if (current.pdf_path) await deletePdfIfExists("ndt", current.pdf_path);
      return;
    }

    const fileId = createUuid();
    const { bucket, path, sha256 } = await uploadFileToIdPath("ndt_report", fileId, opts.pdfFile);
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "ndt_report",
      mime_type: opts.pdfFile.type || "application/pdf",
      size_bytes: opts.pdfFile.size,
      sha256,
    });

    await updateNdtCert(id, { file_id: fileId });

    if (current.file_id) await deleteFileRecord(current.file_id);
    if (current.pdf_path) await deletePdfIfExists("ndt", current.pdf_path);
  }
}

export async function deleteNdtCert(id: string) {
  const pdf = await getNdtCertPdfPath(id);
  const { error: delErr } = await supabase.from("ndt_certificates").delete().eq("id", id);
  if (delErr) throw delErr;
  if (pdf.file_id) await deleteFileRecord(pdf.file_id);
  if (pdf.pdf_path) await deletePdfIfExists("ndt", pdf.pdf_path);
}

import { supabase } from "../services/supabaseClient";

export type ProfileWelderRow = {
  id: string;
  display_name: string | null;
  welder_no: number | null;
};

export type WelderCertRow = {
  id: string;
  profile_id: string;
  certificate_no: string;
  standard: string;
  coverage_joint_type: string | null;
  coverage_thickness: string | null;
  expires_at: string | null; // date -> string
  pdf_path: string;
  created_at: string;

  // join
  profile?: { id: string; display_name: string | null; welder_no: number | null } | null;
};

export type NdtCertRow = {
  id: string;
  personnel_name: string;
  certificate_no: string;
  ndt_method: string;
  expires_at: string | null;
  pdf_path: string;
  created_at: string;
};

export type CertFetchResult = {
  welders: ProfileWelderRow[];        // for admin dropdown
  welderCerts: WelderCertRow[];
  ndtCerts: NdtCertRow[];
};

export type UpsertWelderCertInput = {
  profile_id: string;
  certificate_no: string;
  standard: string;
  coverage_joint_type: string | null;
  coverage_thickness: string | null;
  expires_at: string | null; // "YYYY-MM-DD" eller null
};

export type UpsertNdtCertInput = {
  personnel_name: string;
  certificate_no: string;
  ndt_method: string;
  expires_at: string | null;
};

const BUCKET_WELDER = "welder-certs";
const BUCKET_NDT = "ndt-certs";

/** ---- Fetch ---- */
export async function fetchCertData(): Promise<CertFetchResult> {
  const [weldersRes, welderCertsRes, ndtRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, welder_no")
      .not("welder_no", "is", null)
      .order("welder_no", { ascending: true }),

    supabase
      .from("welder_certificates")
      .select(`
        id,
        profile_id,
        certificate_no,
        standard,
        coverage_joint_type,
        coverage_thickness,
        expires_at,
        pdf_path,
        created_at,
        profile:profile_id (
          id,
          display_name,
          welder_no
        )
      `)
      .order("created_at", { ascending: false }),

    supabase
      .from("ndt_certificates")
      .select("id, personnel_name, certificate_no, ndt_method, expires_at, pdf_path, created_at")
      .order("ndt_method", { ascending: true })
      .order("expires_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  if (weldersRes.error) throw weldersRes.error;
  if (welderCertsRes.error) throw welderCertsRes.error;
  if (ndtRes.error) throw ndtRes.error;

  return {
    welders: (weldersRes.data ?? []) as ProfileWelderRow[],
    welderCerts: (welderCertsRes.data ?? []) as WelderCertRow[],
    ndtCerts: (ndtRes.data ?? []) as NdtCertRow[],
  };
}

/** ---- Storage ---- */
export async function createCertPdfSignedUrl(kind: "welder" | "ndt", path: string, expiresSeconds = 120) {
  const bucket = kind === "welder" ? BUCKET_WELDER : BUCKET_NDT;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSeconds);
  if (error) throw error;
  return data.signedUrl;
}

function pdfPath(kind: "welder" | "ndt", id: string) {
  return `${kind}/${id}.pdf`;
}

async function uploadPdfToIdPath(kind: "welder" | "ndt", id: string, file: File) {
  const bucket = kind === "welder" ? BUCKET_WELDER : BUCKET_NDT;
  const path = pdfPath(kind, id);

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) throw error;
  return path;
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
    .insert({ ...base, pdf_path: "" }) // settes etter upload
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateWelderCert(id: string, base: UpsertWelderCertInput & { pdf_path?: string }) {
  const { error } = await supabase.from("welder_certificates").update(base).eq("id", id);
  if (error) throw error;
}

export async function getWelderCertPdfPath(id: string) {
  const { data, error } = await supabase.from("welder_certificates").select("pdf_path").eq("id", id).single();
  if (error) throw error;
  return (data?.pdf_path ?? null) as string | null;
}

export async function createWelderCertWithPdf(base: UpsertWelderCertInput, pdfFile: File) {
  const id = await insertWelderCert(base);

  try {
    const path = await uploadPdfToIdPath("welder", id, pdfFile);
    await updateWelderCert(id, { pdf_path: path });
    return id;
  } catch (e) {
    try {
      await deletePdfIfExists("welder", pdfPath("welder", id));
    } catch {}
    try {
      await supabase.from("welder_certificates").delete().eq("id", id);
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
    // pdf_path er not null i tabellen din? hvis ja: sett til id-path tom streng er ikke bra.
    // anbefaling: tillat null i pdf_path, men hvis du vil beholde NOT NULL: behold current.
    await updateWelderCert(id, { pdf_path: current ?? "" });
    if (current) await deletePdfIfExists("welder", current);
    return;
  }

  if (opts.pdfFile) {
    const newPath = await uploadPdfToIdPath("welder", id, opts.pdfFile);
    await updateWelderCert(id, { pdf_path: newPath });
    if (current && current !== newPath) await deletePdfIfExists("welder", current);
  }
}

export async function deleteWelderCert(id: string) {
  const pdf = await getWelderCertPdfPath(id);
  const { error: delErr } = await supabase.from("welder_certificates").delete().eq("id", id);
  if (delErr) throw delErr;
  if (pdf) await deletePdfIfExists("welder", pdf);
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

export async function updateNdtCert(id: string, base: UpsertNdtCertInput & { pdf_path?: string }) {
  const { error } = await supabase.from("ndt_certificates").update(base).eq("id", id);
  if (error) throw error;
}

export async function getNdtCertPdfPath(id: string) {
  const { data, error } = await supabase.from("ndt_certificates").select("pdf_path").eq("id", id).single();
  if (error) throw error;
  return (data?.pdf_path ?? null) as string | null;
}

export async function createNdtCertWithPdf(base: UpsertNdtCertInput, pdfFile: File) {
  const id = await insertNdtCert(base);

  try {
    const path = await uploadPdfToIdPath("ndt", id, pdfFile);
    await updateNdtCert(id, { pdf_path: path });
    return id;
  } catch (e) {
    try {
      await deletePdfIfExists("ndt", pdfPath("ndt", id));
    } catch {}
    try {
      await supabase.from("ndt_certificates").delete().eq("id", id);
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
    await updateNdtCert(id, { pdf_path: current ?? "" });
    if (current) await deletePdfIfExists("ndt", current);
    return;
  }

  if (opts.pdfFile) {
    const newPath = await uploadPdfToIdPath("ndt", id, opts.pdfFile);
    await updateNdtCert(id, { pdf_path: newPath });
    if (current && current !== newPath) await deletePdfIfExists("ndt", current);
  }
}

export async function deleteNdtCert(id: string) {
  const pdf = await getNdtCertPdfPath(id);
  const { error: delErr } = await supabase.from("ndt_certificates").delete().eq("id", id);
  if (delErr) throw delErr;
  if (pdf) await deletePdfIfExists("ndt", pdf);
}

import { supabase } from "../services/supabaseClient";
import {
  createFileRecord,
  createFileLink,
  createSignedUrlForFileRef,
  deleteFileRecord,
  uploadFileToIdPath,
} from "./fileRepo";

export type MaterialRef = {
  id: string;
  name: string;
  material_code: string;
  material_group: string;
};

export type WPQRRow = {
  id: string;
  doc_no: string;
  doc_date: string | null;
  standard_id: string | null;
  material_id: string | null;
  materiale: string | null;
  material: MaterialRef | null;
  fuge: string;
  tykkelse: string;
  process: string;
  file_id: string | null;
  created_at: string;
  standard?: { id: string; label: string; revision: number | null; type: string | null } | null;
};

export type WPSRow = {
  id: string;
  doc_no: string;
  doc_date: string | null;
  standard_id: string | null;
  material_id: string | null;
  materiale: string | null;
  material: MaterialRef | null;
  fuge: string;
  tykkelse: string;
  process: string;
  file_id: string | null;
  created_at: string;
  wpqr_id: string | null;
  wpqr: { id: string; doc_no: string; file_id: string | null; material_id: string | null; materiale: string | null; material: MaterialRef | null; tykkelse: string } | null;
  standard?: { id: string; label: string; revision: number | null; type: string | null } | null;
};

export type WpsFetchResult = {
  wpqr: WPQRRow[];
  wps: WPSRow[];
};

export type UpsertWPQRInput = {
  doc_no: string;
  doc_date: string;
  standard_id: string;
  process: string;
  material_id: string;
  materiale: string;
  fuge: string;
  tykkelse: string;
  file_id?: string | null;
};

export type UpsertWPSInput = UpsertWPQRInput & {
  wpqr_id: string | null;
};


/** ---- Fetch ---- */
export async function fetchWpsData(): Promise<WpsFetchResult> {
  const [wpqrRes, wpsRes] = await Promise.all([
    supabase
      .from("wpqr")
      .select(`
        id,
        doc_no,
        doc_date,
        standard_id,
        material_id,
        materiale,
        fuge,
        tykkelse,
        process,
        file_id,
        created_at,
        standard:standard_id (
          id,
          label,
          revision,
          type
        ),
        material:material_id (
          id,
          name,
          material_code,
          material_group
        )
      `)
      .order("process", { ascending: true })
      .order("created_at", { ascending: false }),

    supabase
      .from("wps")
      .select(`
        id,
        doc_no,
        doc_date,
        standard_id,
        material_id,
        materiale,
        fuge,
        tykkelse,
        process,
        file_id,
        created_at,
        standard:standard_id (
          id,
          label,
          revision,
          type
        ),
        material:material_id (
          id,
          name,
          material_code,
          material_group
        ),
        wpqr_id,
        wpqr:wpqr_id (
          id,
          doc_no,
          file_id,
          material_id,
          materiale,
          tykkelse,
          material:material_id (
            id,
            name,
            material_code,
            material_group
          )
        )
      `)
      .order("process", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (wpqrRes.error) throw wpqrRes.error;
  if (wpsRes.error) throw wpsRes.error;

  const normalizeMaterial = (row: any) => ({
    ...row,
    material: Array.isArray(row?.material) ? row.material[0] ?? null : row?.material ?? null,
    standard: Array.isArray(row?.standard) ? row.standard[0] ?? null : row?.standard ?? null,
  });

  const normalizeWpqr = (row: any) => normalizeMaterial(row);
  const normalizeWps = (row: any) => ({
    ...normalizeMaterial(row),
    wpqr: row?.wpqr
      ? {
          ...normalizeMaterial(row.wpqr),
        }
      : null,
  });

  return {
    wpqr: (wpqrRes.data ?? []).map(normalizeWpqr) as WPQRRow[],
    wps: (wpsRes.data ?? []).map(normalizeWps) as WPSRow[],
  };
}

/** ---- Storage ---- */
export async function createPdfSignedUrl(fileId: string, expiresSeconds = 120) {
  return createSignedUrlForFileRef(fileId, { expiresSeconds });
}

/** ---- CRUD WPQR ---- */
export async function insertWpqr(base: UpsertWPQRInput) {
  const { data, error } = await supabase
    .from("wpqr")
    .insert({ ...base })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateWpqr(id: string, base: Partial<UpsertWPQRInput>) {
  const { error } = await supabase.from("wpqr").update(base).eq("id", id);
  if (error) throw error;
}

export async function getWpqrPdfPath(id: string) {
  const { data, error } = await supabase
    .from("wpqr")
    .select("file_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    file_id: (data?.file_id ?? null) as string | null,
  };
}

/**
 * Stabil, “best possible” insert:
 * 1) insert row -> id
 * 2) upload pdf -> id-basert path
 * 3) update row.pdf_path
 * Ved feil: rydd opp best effort
 */
export async function createWpqrWithOptionalPdf(base: UpsertWPQRInput, pdfFile: File | null) {
  const id = await insertWpqr(base);

  if (!pdfFile) return id;

  try {
    const fileId = crypto.randomUUID();
    const { bucket, path, sha256 } = await uploadFileToIdPath("wpqr", fileId, pdfFile);
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "wpqr",
      mime_type: pdfFile.type || "application/pdf",
      size_bytes: pdfFile.size,
      sha256,
    });
    await createFileLink(fileId, "wpqr", id);
    await updateWpqr(id, { file_id: fileId });
    return id;
  } catch (e) {
    // cleanup: forsøk å slette fil + rad
    try {
      // best effort
    } catch {}
    try {
      await supabase.from("wpqr").delete().eq("id", id);
    } catch {}
    throw e;
  }
}

/**
 * Stabil update:
 * - removePdf: sett file_id=null, slett fil best effort
 * - new pdf: upload til id-path (upsert), sett file_id
 */
export async function updateWpqrWithPdf(
  id: string,
  base: UpsertWPQRInput,
  opts: { pdfFile: File | null; removePdf: boolean }
) {
  const current = await getWpqrPdfPath(id);

  // først oppdater feltene (doc_no osv)
  await updateWpqr(id, base);

  if (opts.removePdf) {
    await updateWpqr(id, { file_id: null });
    if (current.file_id) await deleteFileRecord(current.file_id);
    return;
  }

  if (opts.pdfFile) {
    const fileId = crypto.randomUUID();
    const { bucket, path, sha256 } = await uploadFileToIdPath("wpqr", fileId, opts.pdfFile);
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "wpqr",
      mime_type: opts.pdfFile.type || "application/pdf",
      size_bytes: opts.pdfFile.size,
      sha256,
    });
    await createFileLink(fileId, "wpqr", id);
    await updateWpqr(id, { file_id: fileId });

    if (current.file_id) await deleteFileRecord(current.file_id);
  }
}

export async function deleteWpqr(id: string) {
  const pdf = await getWpqrPdfPath(id);

  // DB tar seg av wpqr_id -> null via ON DELETE SET NULL
  const { error: delErr } = await supabase.from("wpqr").delete().eq("id", id);
  if (delErr) throw delErr;

  if (pdf.file_id) await deleteFileRecord(pdf.file_id);
}

/** ---- CRUD WPS ---- */
export async function insertWps(base: UpsertWPSInput) {
  const { data, error } = await supabase
    .from("wps")
    .insert({ ...base })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateWps(id: string, base: Partial<UpsertWPSInput>) {
  const { error } = await supabase.from("wps").update(base).eq("id", id);
  if (error) throw error;
}

export async function getWpsPdfPath(id: string) {
  const { data, error } = await supabase
    .from("wps")
    .select("file_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    file_id: (data?.file_id ?? null) as string | null,
  };
}

export async function createWpsWithOptionalPdf(base: UpsertWPSInput, pdfFile: File | null) {
  const id = await insertWps(base);

  if (!pdfFile) return id;

  try {
    const fileId = crypto.randomUUID();
    const { bucket, path, sha256 } = await uploadFileToIdPath("wps", fileId, pdfFile);
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "wps",
      mime_type: pdfFile.type || "application/pdf",
      size_bytes: pdfFile.size,
      sha256,
    });
    await createFileLink(fileId, "wps", id);
    await updateWps(id, { file_id: fileId });
    return id;
  } catch (e) {
    try {
      // best effort
    } catch {}
    try {
      await supabase.from("wps").delete().eq("id", id);
    } catch {}
    throw e;
  }
}

export async function updateWpsWithPdf(
  id: string,
  base: UpsertWPSInput,
  opts: { pdfFile: File | null; removePdf: boolean }
) {
  const current = await getWpsPdfPath(id);

  await updateWps(id, base);

  if (opts.removePdf) {
    await updateWps(id, { file_id: null });
    if (current.file_id) await deleteFileRecord(current.file_id);
    return;
  }

  if (opts.pdfFile) {
    const fileId = crypto.randomUUID();
    const { bucket, path, sha256 } = await uploadFileToIdPath("wps", fileId, opts.pdfFile);
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "wps",
      mime_type: opts.pdfFile.type || "application/pdf",
      size_bytes: opts.pdfFile.size,
      sha256,
    });
    await createFileLink(fileId, "wps", id);
    await updateWps(id, { file_id: fileId });

    if (current.file_id) await deleteFileRecord(current.file_id);
  }
}

export async function deleteWps(id: string) {
  const pdf = await getWpsPdfPath(id);

  const { error: delErr } = await supabase.from("wps").delete().eq("id", id);
  if (delErr) throw delErr;

  if (pdf.file_id) await deleteFileRecord(pdf.file_id);
}

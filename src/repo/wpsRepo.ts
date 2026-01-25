import { supabase } from "../services/supabaseClient";

export type WPQRRow = {
  id: string;
  doc_no: string;
  materiale: string;
  sammenfoyning: string;
  tykkelse: string;
  process: string;
  pdf_path: string | null;
  created_at: string;
};

export type WPSRow = {
  id: string;
  doc_no: string;
  materiale: string;
  sammenfoyning: string;
  tykkelse: string;
  process: string;
  pdf_path: string | null;
  created_at: string;
  wpqr_id: string | null;
  wpqr?: { id: string; doc_no: string } | null;
};

export type WpsFetchResult = {
  wpqr: WPQRRow[];
  wps: WPSRow[];
};

export type UpsertWPQRInput = {
  doc_no: string;
  process: string;
  materiale: string;
  sammenfoyning: string;
  tykkelse: string;
};

export type UpsertWPSInput = UpsertWPQRInput & {
  wpqr_id: string | null;
};

const BUCKET = "docs";

/** ---- Fetch ---- */
export async function fetchWpsData(): Promise<WpsFetchResult> {
  const [wpqrRes, wpsRes] = await Promise.all([
    supabase
      .from("wpqr")
      .select("id, doc_no, materiale, sammenfoyning, tykkelse, process, pdf_path, created_at")
      .order("process", { ascending: true })
      .order("created_at", { ascending: false }),

    supabase
      .from("wps")
      .select(`
        id,
        doc_no,
        materiale,
        sammenfoyning,
        tykkelse,
        process,
        pdf_path,
        created_at,
        wpqr_id,
        wpqr:wpqr_id (
          id,
          doc_no
        )
      `)
      .order("process", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (wpqrRes.error) throw wpqrRes.error;
  if (wpsRes.error) throw wpsRes.error;

  return {
    wpqr: (wpqrRes.data ?? []) as WPQRRow[],
    wps: (wpsRes.data ?? []) as WPSRow[],
  };
}

/** ---- Storage ---- */
export async function createPdfSignedUrl(path: string, expiresSeconds = 120) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresSeconds);
  if (error) throw error;
  return data.signedUrl;
}

function pdfPath(kind: "wpqr" | "wps", id: string) {
  // Stabilt: endring av doc_no påvirker ikke filnavn
  return `${kind}/${id}.pdf`;
}

export async function uploadPdfToIdPath(kind: "wpqr" | "wps", id: string, file: File) {
  const path = pdfPath(kind, id);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) throw error;
  return path;
}

export async function deletePdfIfExists(pdf_path: string | null) {
  if (!pdf_path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([pdf_path]);
  if (error) console.warn("Klarte ikke å slette PDF:", error);
}

/** ---- CRUD WPQR ---- */
export async function insertWpqr(base: UpsertWPQRInput) {
  const { data, error } = await supabase
    .from("wpqr")
    .insert({ ...base, pdf_path: null })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateWpqr(id: string, base: UpsertWPQRInput & { pdf_path?: string | null }) {
  const { error } = await supabase.from("wpqr").update(base).eq("id", id);
  if (error) throw error;
}

export async function getWpqrPdfPath(id: string) {
  const { data, error } = await supabase.from("wpqr").select("pdf_path").eq("id", id).single();
  if (error) throw error;
  return (data?.pdf_path ?? null) as string | null;
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
    const path = await uploadPdfToIdPath("wpqr", id, pdfFile);
    await updateWpqr(id, { pdf_path: path });
    return id;
  } catch (e) {
    // cleanup: forsøk å slette fil + rad
    try {
      await deletePdfIfExists(pdfPath("wpqr", id));
    } catch {}
    try {
      await supabase.from("wpqr").delete().eq("id", id);
    } catch {}
    throw e;
  }
}

/**
 * Stabil update:
 * - removePdf: sett pdf_path=null, slett fil best effort
 * - new pdf: upload til id-path (upsert), sett pdf_path=id-path, slett evt gammel “legacy path” best effort
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
    // fjern kobling først, så slett fil
    await updateWpqr(id, { pdf_path: null });
    await deletePdfIfExists(current);
    return;
  }

  if (opts.pdfFile) {
    const newPath = await uploadPdfToIdPath("wpqr", id, opts.pdfFile);
    await updateWpqr(id, { pdf_path: newPath });

    // hvis du hadde gammel doc_no-basert path, slett den best effort
    if (current && current !== newPath) await deletePdfIfExists(current);
  }
}

export async function deleteWpqr(id: string) {
  const pdf = await getWpqrPdfPath(id);

  // DB tar seg av wpqr_id -> null via ON DELETE SET NULL
  const { error: delErr } = await supabase.from("wpqr").delete().eq("id", id);
  if (delErr) throw delErr;

  await deletePdfIfExists(pdf);
}

/** ---- CRUD WPS ---- */
export async function insertWps(base: UpsertWPSInput) {
  const { data, error } = await supabase
    .from("wps")
    .insert({ ...base, pdf_path: null })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateWps(id: string, base: UpsertWPSInput & { pdf_path?: string | null }) {
  const { error } = await supabase.from("wps").update(base).eq("id", id);
  if (error) throw error;
}

export async function getWpsPdfPath(id: string) {
  const { data, error } = await supabase.from("wps").select("pdf_path").eq("id", id).single();
  if (error) throw error;
  return (data?.pdf_path ?? null) as string | null;
}

export async function createWpsWithOptionalPdf(base: UpsertWPSInput, pdfFile: File | null) {
  const id = await insertWps(base);

  if (!pdfFile) return id;

  try {
    const path = await uploadPdfToIdPath("wps", id, pdfFile);
    await updateWps(id, { pdf_path: path });
    return id;
  } catch (e) {
    try {
      await deletePdfIfExists(pdfPath("wps", id));
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
    await updateWps(id, { pdf_path: null });
    await deletePdfIfExists(current);
    return;
  }

  if (opts.pdfFile) {
    const newPath = await uploadPdfToIdPath("wps", id, opts.pdfFile);
    await updateWps(id, { pdf_path: newPath });
    if (current && current !== newPath) await deletePdfIfExists(current);
  }
}

export async function deleteWps(id: string) {
  const pdf = await getWpsPdfPath(id);

  const { error: delErr } = await supabase.from("wps").delete().eq("id", id);
  if (delErr) throw delErr;

  await deletePdfIfExists(pdf);
}

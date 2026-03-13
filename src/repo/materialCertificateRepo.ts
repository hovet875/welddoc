import { supabase } from "../services/supabaseClient";
import { createUuid } from "../utils/id";
import { validatePdfFile } from "../utils/format";
import { getRangeFromPage, normalizePageRequest, type PageResult } from "./pagination";
import {
  computeFileSha256,
  createFileRecord,
  createFileLink,
  createSignedUrlForFileRef,
  deleteFileLink,
  deleteFileRecord,
  deleteFileRecordIfOrphan,
  findFileBySha256,
  uploadFileToIdPath,
} from "./fileRepo";
import { markFileInboxProcessed } from "./fileInboxRepo";

export type MaterialCertificateType = "material" | "filler";

export type MaterialCertificateRow = {
  id: string;
  certificate_type: MaterialCertificateType;
  cert_type: string;
  material_id: string | null;
  filler_manufacturer: string | null;
  filler_type: string | null;
  filler_diameter: string | null;
  supplier: string | null;
  heat_numbers: string[] | null;
  file_id: string | null;
  created_by: string | null;
  created_at: string;
  material: { id: string; name: string } | null;
  file: { id: string; label: string | null; mime_type: string | null; size_bytes: number | null } | null;
};

export type MaterialCertificateListFilters = {
  certificateType: MaterialCertificateType;
  materialId?: string | null;
  fillerManufacturer?: string | null;
  fillerType?: string | null;
  fillerDiameter?: string | null;
  supplier?: string | null;
  query?: string | null;
};

function escapeLikeValue(value: string) {
  return value.replace(/[%_,]/g, (match) => `\\${match}`);
}

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

async function resolveMaterialCertificateIdsForQuery(filters: MaterialCertificateListFilters) {
  const textQuery = String(filters.query ?? "").trim();
  if (!textQuery) return null;

  const escaped = escapeLikeValue(textQuery);
  const pattern = `%${escaped}%`;

  const [baseResult, heatResult] = await Promise.all([
    supabase
      .from("material_certificates")
      .select("id")
      .eq("certificate_type", filters.certificateType)
      .or(
        [
          `supplier.ilike.${pattern}`,
          `filler_manufacturer.ilike.${pattern}`,
          `filler_type.ilike.${pattern}`,
          `filler_diameter.ilike.${pattern}`,
          `cert_type.ilike.${pattern}`,
        ].join(",")
      ),
    supabase
      .from("material_certificate_heats")
      .select("certificate_id")
      .eq("certificate_type", filters.certificateType)
      .ilike("heat_number", pattern),
  ]);

  if (baseResult.error) throw baseResult.error;
  if (heatResult.error) throw heatResult.error;

  return uniqueIds([
    ...(baseResult.data ?? []).map((row: any) => row.id),
    ...(heatResult.data ?? []).map((row: any) => row.certificate_id),
  ]);
}

function applyMaterialCertificateFilters(query: any, filters: MaterialCertificateListFilters) {
  let nextQuery = query.eq("certificate_type", filters.certificateType);

  const materialId = String(filters.materialId ?? "").trim();
  const fillerManufacturer = String(filters.fillerManufacturer ?? "").trim();
  const fillerType = String(filters.fillerType ?? "").trim();
  const fillerDiameter = String(filters.fillerDiameter ?? "").trim();
  const supplier = String(filters.supplier ?? "").trim();

  if (materialId) {
    nextQuery = nextQuery.eq("material_id", materialId);
  }

  if (fillerManufacturer) {
    nextQuery = nextQuery.eq("filler_manufacturer", fillerManufacturer);
  }

  if (fillerType) {
    nextQuery = nextQuery.eq("filler_type", fillerType);
  }

  if (fillerDiameter) {
    nextQuery = nextQuery.eq("filler_diameter", fillerDiameter);
  }

  if (supplier) {
    nextQuery = nextQuery.ilike("supplier", `%${escapeLikeValue(supplier)}%`);
  }

  return nextQuery;
}

export async function fetchMaterialCertificates() {
  const { data, error } = await supabase
    .from("material_certificates")
    .select(
      `
      id,
      certificate_type,
      cert_type,
      material_id,
      filler_manufacturer,
      filler_type,
      filler_diameter,
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

export async function fetchMaterialCertificatePage(input: {
  page?: number;
  pageSize?: number;
  filters: MaterialCertificateListFilters;
}): Promise<PageResult<MaterialCertificateRow>> {
  const { page, pageSize } = normalizePageRequest(input, { page: 1, pageSize: 25 });
  const { from, to } = getRangeFromPage(page, pageSize);
  const queryCertificateIds = await resolveMaterialCertificateIdsForQuery(input.filters);
  if (String(input.filters.query ?? "").trim() && queryCertificateIds && queryCertificateIds.length === 0) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
    };
  }

  let query = applyMaterialCertificateFilters(
    supabase
      .from("material_certificates")
      .select(
        `
        id,
        certificate_type,
        cert_type,
        material_id,
        filler_manufacturer,
        filler_type,
        filler_diameter,
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
      `,
        { count: "exact" }
      ),
    input.filters
  )
    .order("created_at", { ascending: false });

  if (queryCertificateIds && queryCertificateIds.length > 0) {
    query = query.in("id", queryCertificateIds);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    items: (data ?? []) as unknown as MaterialCertificateRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function fetchMaterialCertificateSupplierNames() {
  const { data, error } = await supabase
    .from("material_certificates")
    .select("supplier")
    .not("supplier", "is", null)
    .order("supplier", { ascending: true });
  if (error) throw error;

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => String(row.supplier ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
}

export async function fetchMaterialCertificateFillerTypes() {
  const { data, error } = await supabase
    .from("material_certificates")
    .select("filler_type")
    .eq("certificate_type", "filler")
    .not("filler_type", "is", null)
    .order("filler_type", { ascending: true });
  if (error) throw error;

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => String(row.filler_type ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
}

export async function fetchMaterialCertificateFillerManufacturers() {
  const { data, error } = await supabase
    .from("material_certificates")
    .select("filler_manufacturer")
    .eq("certificate_type", "filler")
    .not("filler_manufacturer", "is", null)
    .order("filler_manufacturer", { ascending: true });
  if (error) throw error;

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => String(row.filler_manufacturer ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
}

export async function fetchMaterialCertificateFillerDiameters() {
  const { data, error } = await supabase
    .from("material_certificates")
    .select("filler_diameter")
    .eq("certificate_type", "filler")
    .not("filler_diameter", "is", null)
    .order("filler_diameter", { ascending: true });
  if (error) throw error;

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => String(row.filler_diameter ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base", numeric: true }));
}

export async function createMaterialCertificateWithFile(input: {
  certificate_type: MaterialCertificateType;
  cert_type: string;
  material_id?: string | null;
  filler_manufacturer?: string | null;
  filler_type?: string | null;
  filler_diameter?: string | null;
  supplier?: string | null;
  file: File;
}) {
  const fileId = createUuid();
  const certId = createUuid();
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
      filler_manufacturer: input.filler_manufacturer ?? null,
      filler_type: input.filler_type ?? null,
      filler_diameter: input.filler_diameter ?? null,
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
  filler_manufacturer?: string | null;
  filler_type?: string | null;
  filler_diameter?: string | null;
  supplier?: string | null;
  file_id: string;
}) {
  const certId = createUuid();
  let certInserted = false;

  try {
    const { error } = await supabase.from("material_certificates").insert({
      id: certId,
      certificate_type: input.certificate_type,
      cert_type: input.cert_type,
      material_id: input.material_id ?? null,
      filler_manufacturer: input.filler_manufacturer ?? null,
      filler_type: input.filler_type ?? null,
      filler_diameter: input.filler_diameter ?? null,
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

export type MaterialCertUploadEntry = {
  file: File | null;
  file_id: string | null;
  inbox_id?: string | null;
  source_name?: string | null;
  certificate_type: MaterialCertificateType;
  cert_type: string;
  supplier: string | null;
  material_id: string | null;
  filler_manufacturer: string | null;
  filler_type: string | null;
  filler_diameter: string | null;
  heat_numbers: string[];
};

export async function uploadBatchWithMeta(
  entries: MaterialCertUploadEntry[],
  onProgress?: (index: number, total: number) => void,
  onDuplicate?: (file: File, existing: { id: string; label: string | null }) => Promise<boolean> | boolean
) {
  const duplicates = new Set<string>();

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry.file && !entry.file_id) {
      throw new Error("Manglende filreferanse for opplasting.");
    }
    if (entry.file) {
      const pdfError = validatePdfFile(entry.file, 25);
      if (pdfError) throw new Error(pdfError);
    }
    onProgress?.(i + 1, entries.length);

    try {
      let certId: string | null = null;

      if (entry.file) {
        const sha256 = await computeFileSha256(entry.file);
        const existing = await findFileBySha256(sha256);
        if (existing) {
          const shouldLink = onDuplicate ? await onDuplicate(entry.file, existing) : false;
          if (shouldLink) {
            certId = await createMaterialCertificateWithExistingFile({
              certificate_type: entry.certificate_type,
              cert_type: entry.cert_type,
              supplier: entry.supplier,
              material_id: entry.material_id,
              filler_manufacturer: entry.filler_manufacturer,
              filler_type: entry.filler_type,
              filler_diameter: entry.filler_diameter,
              file_id: existing.id,
            });
          } else {
            duplicates.add(entry.file.name);
          }
        } else {
          certId = await createMaterialCertificateWithFile({
            certificate_type: entry.certificate_type,
            cert_type: entry.cert_type,
            supplier: entry.supplier,
            material_id: entry.material_id,
            filler_manufacturer: entry.filler_manufacturer,
            filler_type: entry.filler_type,
            filler_diameter: entry.filler_diameter,
            file: entry.file,
          });
        }
      } else {
        const existingFileId = entry.file_id;
        if (!existingFileId) {
          throw new Error("Manglende eksisterende filreferanse for opplasting.");
        }
        certId = await createMaterialCertificateWithExistingFile({
          certificate_type: entry.certificate_type,
          cert_type: entry.cert_type,
          supplier: entry.supplier,
          material_id: entry.material_id,
          filler_manufacturer: entry.filler_manufacturer,
          filler_type: entry.filler_type,
          filler_diameter: entry.filler_diameter,
          file_id: existingFileId,
        });
      }

      if (certId && entry.heat_numbers.length > 0) {
        await updateMaterialCertificate(certId, { heat_numbers: entry.heat_numbers });
      }
      if (certId && entry.inbox_id) {
        await markFileInboxProcessed(entry.inbox_id);
      }
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      if (message.toLowerCase().includes("finnes allerede i systemet")) {
        duplicates.add(entry.file?.name || entry.source_name || "ukjent fil");
        continue;
      }
      throw error;
    }
  }

  if (duplicates.size > 0) {
    const list = Array.from(duplicates).join(", ");
    throw new Error(`Følgende filer finnes allerede i systemet: ${list}`);
  }
}

export async function updateMaterialCertificate(
  id: string,
  patch: Partial<
    Pick<
      MaterialCertificateRow,
      | "supplier"
      | "heat_numbers"
      | "certificate_type"
      | "cert_type"
      | "material_id"
      | "filler_manufacturer"
      | "filler_type"
      | "filler_diameter"
    >
  >
) {
  const { error } = await supabase.from("material_certificates").update(patch).eq("id", id);
  if (error) throw error;
}

export async function updateMaterialCertificateFile(fileId: string, file: File) {
  const { bucket, path, sha256 } = await uploadFileToIdPath("material_certificate", fileId, file, {
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

export type MaterialCertificateHeatHit = {
  certificate_id: string;
  heat_number: string;
  certificate_type: MaterialCertificateType;
  material_id: string | null;
  filler_manufacturer: string | null;
  filler_type: string | null;
  filler_diameter: string | null;
  file_id: string | null;
  file_label: string | null;
  created_at: string;
};

export async function searchCertificateHeats(params: {
  heat: string;
  certificate_type: MaterialCertificateType;
  material_id?: string | null;
  filler_manufacturer?: string | null;
  filler_type?: string | null;
  filler_diameter?: string | null;
  limit?: number;
}) {
  const { heat, certificate_type, material_id, filler_manufacturer, filler_type, filler_diameter, limit = 30 } = params;

  const q = heat.trim();
  if (!q) return [];

  // Må ha "material_id" eller "filler_type" for å snevre inn (som du ønsket)
  if (certificate_type === "material" && !material_id) return [];
  if (certificate_type === "filler" && !filler_type) return [];

  let query = supabase
    .from("material_certificate_heats")
    .select(
      "certificate_id, heat_number, certificate_type, material_id, filler_manufacturer, filler_type, filler_diameter, file_id, file_label, created_at"
    )
    .eq("certificate_type", certificate_type)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (certificate_type === "material") {
    query = query.eq("material_id", material_id as string);
  } else {
    query = query.eq("filler_type", filler_type as string);
    const manufacturer = String(filler_manufacturer ?? "").trim();
    const diameter = String(filler_diameter ?? "").trim();
    if (manufacturer) query = query.eq("filler_manufacturer", manufacturer);
    if (diameter) query = query.eq("filler_diameter", diameter);
  }

  query = query.ilike("heat_number", `%${q}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MaterialCertificateHeatHit[];
}

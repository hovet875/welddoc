import { supabase } from "../services/supabaseClient";
import { createUuid } from "../utils/id";
import { getRangeFromPage, normalizePageRequest, type PageResult } from "./pagination";
import {
  createFileRecord,
  createFileLink,
  createSignedUrlForFileRef,
  deleteFileLink,
  deleteFileRecord,
  uploadFileToIdPath,
} from "./fileRepo";

export type NdtMethodRow = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  standard_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  standard?: { id: string; label: string; revision: number | null } | null;
};

export type NdtReportWelderRow = {
  welder_id: string;
  weld_count: number | null;
  defect_count: number | null;
  welder: { id: string; display_name: string | null; welder_no: string | null } | null;
};

export type NdtReportRow = {
  id: string;
  file_id: string | null;
  method_id: string | null;
  ndt_supplier_id: string | null;
  ndt_inspector_id: string | null;
  weld_count: number | null;
  defect_count: number | null;
  title: string | null;
  customer: string | null;
  report_date: string | null;
  created_by: string | null;
  created_at: string;
  method: { id: string; code: string; label: string } | null;
  ndt_supplier: { id: string; name: string } | null;
  ndt_inspector: { id: string; supplier_id: string; name: string } | null;
  file: { id: string; label: string | null; mime_type: string | null; size_bytes: number | null } | null;
  report_welders: NdtReportWelderRow[];
};

export type NdtReportListFilters = {
  methodId?: string;
  projectNo?: string;
  year?: string;
  welderId?: string;
  result?: "" | "ok" | "fault";
  query?: string;
};

export type NdtRtStatsRow = Pick<
  NdtReportRow,
  "id" | "report_date" | "created_at" | "weld_count" | "defect_count" | "report_welders"
>;

function ndtReportSelect() {
  return `
      id,
      file_id,
      method_id,
      ndt_supplier_id,
      ndt_inspector_id,
      weld_count,
      defect_count,
      title,
      customer,
      report_date,
      created_by,
      created_at,
      method:method_id (
        id,
        code,
        label
      ),
      ndt_supplier:ndt_supplier_id (
        id,
        name
      ),
      ndt_inspector:ndt_inspector_id (
        id,
        supplier_id,
        name
      ),
      file:file_id (
        id,
        label,
        mime_type,
        size_bytes
      ),
      report_welders:ndt_report_welders (
        welder_id,
        weld_count,
        defect_count,
        welder:welder_id (
          id,
          display_name,
          welder_no
        )
      )
    `;
}

function normalizeNdtFilters(filters?: NdtReportListFilters) {
  return {
    methodId: String(filters?.methodId ?? "").trim(),
    projectNo: String(filters?.projectNo ?? "").trim(),
    year: String(filters?.year ?? "").trim(),
    welderId: String(filters?.welderId ?? "").trim(),
    result: (filters?.result ?? "") as "" | "ok" | "fault",
    query: String(filters?.query ?? "").trim(),
  };
}

async function resolveReportIdsForWelder(welderId: string) {
  if (!welderId) return null;
  const { data, error } = await supabase
    .from("ndt_report_welders")
    .select("report_id")
    .eq("welder_id", welderId);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row: any) => String(row.report_id ?? "").trim()).filter(Boolean)));
}

function applyNdtReportFilters(query: any, filters: ReturnType<typeof normalizeNdtFilters>) {
  let next = query;

  if (filters.methodId) next = next.eq("method_id", filters.methodId);
  if (filters.projectNo) next = next.eq("title", filters.projectNo);

  if (filters.year) {
    const year = Number(filters.year);
    if (Number.isFinite(year) && year > 1900) {
      const start = `${year}-01-01`;
      const end = `${year + 1}-01-01`;
      next = next.or(`and(report_date.gte.${start},report_date.lt.${end}),and(report_date.is.null,created_at.gte.${start},created_at.lt.${end})`);
    }
  }

  if (filters.result === "ok") {
    next = next.lte("defect_count", 0);
  } else if (filters.result === "fault") {
    next = next.gt("defect_count", 0);
  }

  if (filters.query) {
    const escaped = filters.query.replace(/[%,]/g, " ").trim();
    if (escaped) {
      next = next.or(`title.ilike.%${escaped}%,customer.ilike.%${escaped}%`);
    }
  }

  return next;
}

export async function fetchNdtReportPage(input: {
  page: number;
  pageSize: number;
  filters?: NdtReportListFilters;
}): Promise<PageResult<NdtReportRow>> {
  const filters = normalizeNdtFilters(input.filters);
  const { page, pageSize } = normalizePageRequest({ page: input.page, pageSize: input.pageSize }, { page: 1, pageSize: 25 });
  const { from, to } = getRangeFromPage(page, pageSize);

  const welderReportIds = await resolveReportIdsForWelder(filters.welderId);
  if (filters.welderId && welderReportIds && welderReportIds.length === 0) {
    return { items: [], total: 0, page, pageSize };
  }

  let query = supabase
    .from("ndt_reports")
    .select(ndtReportSelect(), { count: "exact" })
    .order("report_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  query = applyNdtReportFilters(query, filters);
  if (welderReportIds && welderReportIds.length > 0) {
    query = query.in("id", welderReportIds);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    items: (data ?? []) as unknown as NdtReportRow[],
    total: Number(count ?? 0),
    page,
    pageSize,
  };
}

export async function countNdtReports(filters?: NdtReportListFilters) {
  const normalized = normalizeNdtFilters(filters);
  const welderReportIds = await resolveReportIdsForWelder(normalized.welderId);
  if (normalized.welderId && welderReportIds && welderReportIds.length === 0) return 0;

  let query = supabase.from("ndt_reports").select("id", { count: "exact", head: true });
  query = applyNdtReportFilters(query, normalized);
  if (welderReportIds && welderReportIds.length > 0) {
    query = query.in("id", welderReportIds);
  }

  const { error, count } = await query;
  if (error) throw error;
  return Number(count ?? 0);
}

export async function fetchNdtReportYears() {
  const { data, error } = await supabase.from("ndt_reports").select("report_date, created_at");
  if (error) throw error;

  const years = new Set<string>();
  for (const row of data ?? []) {
    const source = String((row as any).report_date ?? (row as any).created_at ?? "").trim();
    if (!source) continue;
    const year = new Date(source).getFullYear();
    if (!Number.isFinite(year)) continue;
    years.add(String(year));
  }

  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

export async function fetchNdtRtStatsRows(filters?: NdtReportListFilters): Promise<NdtRtStatsRow[]> {
  const normalized = normalizeNdtFilters(filters);
  const welderReportIds = await resolveReportIdsForWelder(normalized.welderId);
  if (normalized.welderId && welderReportIds && welderReportIds.length === 0) return [];

  const { data: rtMethods, error: methodError } = await supabase
    .from("parameter_ndt_methods")
    .select("id")
    .eq("code", "RT");
  if (methodError) throw methodError;
  const rtMethodIds = (rtMethods ?? []).map((row: any) => String(row.id ?? "").trim()).filter(Boolean);
  if (!rtMethodIds.length) return [];

  let query = supabase
    .from("ndt_reports")
    .select(
      `
      id,
      report_date,
      created_at,
      weld_count,
      defect_count,
      report_welders:ndt_report_welders (
        welder_id,
        weld_count,
        defect_count
      )
    `
    )
    .in("method_id", rtMethodIds)
    .order("report_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  query = applyNdtReportFilters(query, { ...normalized, methodId: "", result: normalized.result, query: "" });
  if (welderReportIds && welderReportIds.length > 0) {
    query = query.in("id", welderReportIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as NdtRtStatsRow[];
}

export async function fetchNdtMethods(opts?: { includeInactive?: boolean }) {
  let q = supabase
    .from("parameter_ndt_methods")
    .select(`
      id,
      code,
      label,
      description,
      standard_id,
      sort_order,
      is_active,
      created_at,
      standard:standard_id (
        id,
        label,
        revision
      )
    `)
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });

  if (!opts?.includeInactive) {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as NdtMethodRow[];
}

export async function createNdtMethod(input: {
  code: string;
  label: string;
  description?: string | null;
  standard_id?: string | null;
  sort_order?: number | null;
}) {
  const { error } = await supabase.from("parameter_ndt_methods").insert({
    code: input.code,
    label: input.label,
    description: input.description ?? null,
    standard_id: input.standard_id ?? null,
    sort_order: input.sort_order ?? 0,
  });
  if (error) throw error;
}

export async function updateNdtMethod(
  id: string,
  patch: Partial<Pick<NdtMethodRow, "code" | "label" | "description" | "standard_id" | "sort_order" | "is_active">>
) {
  const { error } = await supabase.from("parameter_ndt_methods").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteNdtMethod(id: string) {
  const { error } = await supabase.from("parameter_ndt_methods").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchNdtReports() {
  const { data, error } = await supabase
    .from("ndt_reports")
    .select(`
      id,
      file_id,
      method_id,
      ndt_supplier_id,
      ndt_inspector_id,
      weld_count,
      defect_count,
      title,
      customer,
      report_date,
      created_by,
      created_at,
      method:method_id (
        id,
        code,
        label
      ),
      ndt_supplier:ndt_supplier_id (
        id,
        name
      ),
      ndt_inspector:ndt_inspector_id (
        id,
        supplier_id,
        name
      ),
      file:file_id (
        id,
        label,
        mime_type,
        size_bytes
      ),
      report_welders:ndt_report_welders (
        welder_id,
        weld_count,
        defect_count,
        welder:welder_id (
          id,
          display_name,
          welder_no
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as NdtReportRow[];
}

type NdtReportCreateInput = {
  source_name?: string | null;
  method_id: string;
  ndt_supplier_id: string | null;
  ndt_inspector_id: string | null;
  weld_count: number | null;
  defect_count: number | null;
  title: string | null;
  customer: string | null;
  report_date: string | null;
  welder_stats: Array<{ welder_id: string; weld_count: number | null; defect_count: number | null }>;
};

export async function createNdtReportWithFile(input: NdtReportCreateInput & { file: File }) {
  const fileId = createUuid();
  const reportId = createUuid();
  let reportInserted = false;
  let linkInserted = false;

  try {
    const fileLabel = (input.source_name || "").trim() || input.file.name;
    const { bucket, path, sha256 } = await uploadFileToIdPath("ndt_report", fileId, input.file);
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "ndt_report",
      label: fileLabel,
      mime_type: input.file.type || "application/pdf",
      size_bytes: input.file.size,
      sha256,
    });

    const { error } = await supabase.from("ndt_reports").insert({
      id: reportId,
      file_id: fileId,
      method_id: input.method_id,
      ndt_supplier_id: input.ndt_supplier_id,
      ndt_inspector_id: input.ndt_inspector_id,
      weld_count: input.weld_count,
      defect_count: input.defect_count,
      title: input.title,
      customer: input.customer,
      report_date: input.report_date,
    });
    if (error) throw error;
    reportInserted = true;

    await createFileLink(fileId, "ndt_report", reportId);
    linkInserted = true;

    if (input.welder_stats.length > 0) {
      const rows = input.welder_stats.map((s) => ({
        report_id: reportId,
        welder_id: s.welder_id,
        weld_count: s.weld_count,
        defect_count: s.defect_count,
      }));
      const { error: linkErr } = await supabase.from("ndt_report_welders").insert(rows);
      if (linkErr) throw linkErr;
    }

    return reportId;
  } catch (e) {
    if (linkInserted) {
      try {
        await deleteFileLink("ndt_report", reportId);
      } catch {}
    }
    if (reportInserted) {
      try {
        await supabase.from("ndt_reports").delete().eq("id", reportId);
      } catch {}
    }
    try {
      await deleteFileRecord(fileId);
    } catch {}
    throw e;
  }
}

export async function createNdtReportWithExistingFile(input: NdtReportCreateInput & { file_id: string }) {
  const reportId = createUuid();
  let reportInserted = false;
  let linkInserted = false;

  try {
    const { error } = await supabase.from("ndt_reports").insert({
      id: reportId,
      file_id: input.file_id,
      method_id: input.method_id,
      ndt_supplier_id: input.ndt_supplier_id,
      ndt_inspector_id: input.ndt_inspector_id,
      weld_count: input.weld_count,
      defect_count: input.defect_count,
      title: input.title,
      customer: input.customer,
      report_date: input.report_date,
    });
    if (error) throw error;
    reportInserted = true;

    await createFileLink(input.file_id, "ndt_report", reportId);
    linkInserted = true;

    const fileLabel = (input.source_name || "").trim();
    if (fileLabel) {
      const { error: fileUpdateErr } = await supabase
        .from("files")
        .update({ label: fileLabel })
        .eq("id", input.file_id);
      if (fileUpdateErr) throw fileUpdateErr;
    }

    if (input.welder_stats.length > 0) {
      const rows = input.welder_stats.map((s) => ({
        report_id: reportId,
        welder_id: s.welder_id,
        weld_count: s.weld_count,
        defect_count: s.defect_count,
      }));
      const { error: linkErr } = await supabase.from("ndt_report_welders").insert(rows);
      if (linkErr) throw linkErr;
    }

    return reportId;
  } catch (e) {
    if (linkInserted) {
      try {
        await deleteFileLink("ndt_report", reportId);
      } catch {}
    }
    if (reportInserted) {
      try {
        await supabase.from("ndt_reports").delete().eq("id", reportId);
      } catch {}
    }
    throw e;
  }
}

export async function updateNdtReport(
  reportId: string,
  patch: {
    method_id: string;
    ndt_supplier_id: string | null;
    ndt_inspector_id: string | null;
    weld_count: number | null;
    defect_count: number | null;
    title: string;
    customer: string;
    report_date: string;
    welder_stats: Array<{ welder_id: string; weld_count: number | null; defect_count: number | null }>;
  }
) {
  const { error } = await supabase
    .from("ndt_reports")
    .update({
      method_id: patch.method_id,
      ndt_supplier_id: patch.ndt_supplier_id,
      ndt_inspector_id: patch.ndt_inspector_id,
      weld_count: patch.weld_count,
      defect_count: patch.defect_count,
      title: patch.title,
      customer: patch.customer,
      report_date: patch.report_date,
    })
    .eq("id", reportId);
  if (error) throw error;

  const { error: delErr } = await supabase.from("ndt_report_welders").delete().eq("report_id", reportId);
  if (delErr) throw delErr;

  if (patch.welder_stats.length > 0) {
    const rows = patch.welder_stats.map((s) => ({
      report_id: reportId,
      welder_id: s.welder_id,
      weld_count: s.weld_count,
      defect_count: s.defect_count,
    }));
    const { error: linkErr } = await supabase.from("ndt_report_welders").insert(rows);
    if (linkErr) throw linkErr;
  }
}

export async function updateNdtReportFile(fileId: string, file: File) {
  const { bucket, path, sha256 } = await uploadFileToIdPath("ndt_report", fileId, file, {
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

export async function deleteNdtReport(reportId: string, fileId: string | null) {
  const { error } = await supabase.from("ndt_reports").delete().eq("id", reportId);
  if (error) throw error;
  if (fileId) {
    await deleteFileRecord(fileId);
  }
}

export async function openNdtReportPdf(ref: string) {
  const url = await createSignedUrlForFileRef(ref, { expiresSeconds: 120 });
  window.open(url, "_blank", "noopener,noreferrer");
}

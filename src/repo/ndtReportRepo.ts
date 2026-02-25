import { supabase } from "../services/supabaseClient";
import { createUuid } from "../utils/id";
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

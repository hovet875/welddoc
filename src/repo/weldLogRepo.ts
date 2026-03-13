import { supabase } from "../services/supabaseClient";
import { createUuid } from "../utils/id";
import { getRangeFromPage, normalizePageRequest, type PageResult } from "./pagination";

export type WeldStatusFilter = "all" | "ready" | "pending";
export type WeldQuickFilter = "all" | "missingWps" | "missingCert" | "missingNdt";

export type ProjectWeldLogRow = {
  id: string;
  project_id: string;
  drawing_id: string;
  created_by: string | null;
  created_at: string;
  drawing?: {
    id: string;
    drawing_no: string;
    revision: string;
    file_id: string | null;
    file?: { id: string; label: string | null; mime_type: string | null; size_bytes: number | null } | null;
  } | null;
};

export type ProjectWeldRow = {
  id: string;
  log_id: string;
  weld_no: number;
  joint_type: string | null;
  component_a_id: string | null;
  component_b_id: string | null;
  welder_id: string | null;
  welder_cert_id: string | null;
  wps_id: string | null;
  weld_date: string | null;
  filler_traceability_id: string | null;
  visual_report_id: string | null;
  visual_inspector: string | null;
  crack_inspector: string | null;
  crack_report_id: string | null;
  crack_report_no: string | null;
  volumetric_inspector: string | null;
  volumetric_report_id: string | null;
  volumetric_report_no: string | null;
  status: boolean;
  created_by: string | null;
  created_at: string;

  log?: ProjectWeldLogRow | null;
  component_a?: { id: string; type_code: string; code_index: number | null; filler_type: string | null; material?: { id: string; name: string } | null } | null;
  component_b?: { id: string; type_code: string; code_index: number | null; filler_type: string | null; material?: { id: string; name: string } | null } | null;
  filler?: { id: string; type_code: string; code_index: number | null; filler_type: string | null } | null;
  welder?: { id: string; display_name: string | null; welder_no: string | null } | null;
  wps?: { id: string; doc_no: string; process: string } | null;
  visual_report?: { id: string; file_id: string | null; report_date: string | null; method?: { id: string; code: string; label: string } | null; file?: { id: string; label: string | null } | null } | null;
  crack_report?: { id: string; file_id: string | null; report_date: string | null; method?: { id: string; code: string; label: string } | null; file?: { id: string; label: string | null } | null } | null;
  volumetric_report?: { id: string; file_id: string | null; report_date: string | null; method?: { id: string; code: string; label: string } | null; file?: { id: string; label: string | null } | null } | null;
};

export async function fetchProjectWeldLogs(projectId: string) {
  const { data, error } = await supabase
    .from("project_weld_logs")
    .select(
      `
      id,
      project_id,
      drawing_id,
      created_by,
      created_at,
      drawing:drawing_id (
        id,
        drawing_no,
        revision,
        file_id,
        file:file_id (
          id,
          label,
          mime_type,
          size_bytes
        )
      )
    `
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ProjectWeldLogRow[];
}

export async function ensureProjectWeldLog(projectId: string, drawingId: string) {
  const { data: existing, error: existingErr } = await supabase
    .from("project_weld_logs")
    .select("id")
    .eq("project_id", projectId)
    .eq("drawing_id", drawingId)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("project_weld_logs")
    .insert({ project_id: projectId, drawing_id: drawingId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function fetchProjectWeldLogId(projectId: string, drawingId: string) {
  const normalizedProjectId = String(projectId ?? "").trim();
  const normalizedDrawingId = String(drawingId ?? "").trim();
  if (!normalizedProjectId || !normalizedDrawingId) return null;

  const { data, error } = await supabase
    .from("project_weld_logs")
    .select("id")
    .eq("project_id", normalizedProjectId)
    .eq("drawing_id", normalizedDrawingId)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

export async function fetchNextProjectWeldNo(logId: string) {
  const normalizedLogId = String(logId ?? "").trim();
  if (!normalizedLogId) return 1;

  const { data, error } = await supabase
    .from("project_welds")
    .select("weld_no")
    .eq("log_id", normalizedLogId)
    .order("weld_no", { ascending: false })
    .limit(1);
  if (error) throw error;

  const latest = Number((data ?? [])[0]?.weld_no ?? 0);
  if (!Number.isFinite(latest) || latest < 1) return 1;
  return latest + 1;
}

export async function fetchProjectWelds(projectId: string) {
  const logs = await fetchProjectWeldLogs(projectId);
  const logIds = logs.map((l) => l.id);
  if (logIds.length === 0) return { logs, welds: [] as ProjectWeldRow[] };

  const { data, error } = await supabase
    .from("project_welds")
    .select(
      `
      id,
      log_id,
      weld_no,
      joint_type,
      component_a_id,
      component_b_id,
      welder_id,
      welder_cert_id,
      wps_id,
      weld_date,
      filler_traceability_id,
      visual_report_id,
      visual_inspector,
      crack_inspector,
      crack_report_id,
      crack_report_no,
      volumetric_inspector,
      volumetric_report_id,
      volumetric_report_no,
      status,
      created_by,
      created_at,
      log:log_id (
        id,
        project_id,
        drawing_id,
        created_by,
        created_at,
        drawing:drawing_id (
          id,
          drawing_no,
          revision,
          file_id,
          file:file_id (
            id,
            label,
            mime_type,
            size_bytes
          )
        )
      ),
      component_a:component_a_id (
        id,
        type_code,
        code_index,
        filler_type,
        material:material_id (
          id,
          name
        )
      ),
      component_b:component_b_id (
        id,
        type_code,
        code_index,
        filler_type,
        material:material_id (
          id,
          name
        )
      ),
      filler:filler_traceability_id (
        id,
        type_code,
        code_index,
        filler_type
      ),
      welder:welder_id (
        id,
        display_name,
        welder_no
      ),
      wps:wps_id (
        id,
        doc_no,
        process
      ),
      visual_report:visual_report_id (
        id,
        file_id,
        report_date,
        method:method_id (
          id,
          code,
          label
        ),
        file:file_id (
          id,
          label
        )
      ),
      crack_report:crack_report_id (
        id,
        file_id,
        report_date,
        method:method_id (
          id,
          code,
          label
        ),
        file:file_id (
          id,
          label
        )
      ),
      volumetric_report:volumetric_report_id (
        id,
        file_id,
        report_date,
        method:method_id (
          id,
          code,
          label
        ),
        file:file_id (
          id,
          label
        )
      )
    `
    )
    .in("log_id", logIds)
    .order("weld_no", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return { logs, welds: (data ?? []) as unknown as ProjectWeldRow[] };
}

type FetchProjectWeldPageInput = {
  logId: string;
  page: number;
  pageSize: number;
  statusFilter?: WeldStatusFilter;
  quickFilter?: WeldQuickFilter;
};

function baseProjectWeldSelect() {
  return `
      id,
      log_id,
      weld_no,
      joint_type,
      component_a_id,
      component_b_id,
      welder_id,
      welder_cert_id,
      wps_id,
      weld_date,
      filler_traceability_id,
      visual_report_id,
      visual_inspector,
      crack_inspector,
      crack_report_id,
      crack_report_no,
      volumetric_inspector,
      volumetric_report_id,
      volumetric_report_no,
      status,
      created_by,
      created_at,
      log:log_id (
        id,
        project_id,
        drawing_id,
        created_by,
        created_at,
        drawing:drawing_id (
          id,
          drawing_no,
          revision,
          file_id,
          file:file_id (
            id,
            label,
            mime_type,
            size_bytes
          )
        )
      ),
      component_a:component_a_id (
        id,
        type_code,
        code_index,
        filler_type,
        material:material_id (
          id,
          name
        )
      ),
      component_b:component_b_id (
        id,
        type_code,
        code_index,
        filler_type,
        material:material_id (
          id,
          name
        )
      ),
      filler:filler_traceability_id (
        id,
        type_code,
        code_index,
        filler_type
      ),
      welder:welder_id (
        id,
        display_name,
        welder_no
      ),
      wps:wps_id (
        id,
        doc_no,
        process
      ),
      visual_report:visual_report_id (
        id,
        file_id,
        report_date,
        method:method_id (
          id,
          code,
          label
        ),
        file:file_id (
          id,
          label
        )
      ),
      crack_report:crack_report_id (
        id,
        file_id,
        report_date,
        method:method_id (
          id,
          code,
          label
        ),
        file:file_id (
          id,
          label
        )
      ),
      volumetric_report:volumetric_report_id (
        id,
        file_id,
        report_date,
        method:method_id (
          id,
          code,
          label
        ),
        file:file_id (
          id,
          label
        )
      )
    `;
}

function applyWeldRowFilters(query: any, input: { statusFilter?: WeldStatusFilter; quickFilter?: WeldQuickFilter }) {
  const statusFilter = input.statusFilter ?? "all";
  const quickFilter = input.quickFilter ?? "all";

  let next = query;

  if (statusFilter === "ready") {
    next = next.eq("status", true);
  } else if (statusFilter === "pending") {
    next = next.eq("status", false);
  }

  if (quickFilter === "missingWps") {
    next = next.is("wps_id", null);
  } else if (quickFilter === "missingCert") {
    next = next.is("welder_cert_id", null);
  } else if (quickFilter === "missingNdt") {
    next = next
      .is("visual_report_id", null)
      .is("visual_inspector", null)
      .is("crack_report_id", null)
      .is("volumetric_report_id", null);
  }

  return next;
}

export async function fetchProjectWeldPage(input: FetchProjectWeldPageInput): Promise<PageResult<ProjectWeldRow>> {
  const logId = String(input.logId ?? "").trim();
  if (!logId) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    };
  }

  const { page, pageSize } = normalizePageRequest({ page: input.page, pageSize: input.pageSize }, { page: 1, pageSize: 50 });
  const { from, to } = getRangeFromPage(page, pageSize);

  let query = supabase
    .from("project_welds")
    .select(baseProjectWeldSelect(), { count: "exact" })
    .eq("log_id", logId)
    .order("weld_no", { ascending: true })
    .order("created_at", { ascending: true })
    .range(from, to);

  query = applyWeldRowFilters(query, {
    statusFilter: input.statusFilter,
    quickFilter: input.quickFilter,
  });

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    items: (data ?? []) as unknown as ProjectWeldRow[],
    total: Number(count ?? 0),
    page,
    pageSize,
  };
}

export async function fetchProjectWeldRowsForLog(input: {
  logId: string;
  statusFilter?: WeldStatusFilter;
  quickFilter?: WeldQuickFilter;
}) {
  const logId = String(input.logId ?? "").trim();
  if (!logId) return [] as ProjectWeldRow[];

  let query = supabase
    .from("project_welds")
    .select(baseProjectWeldSelect())
    .eq("log_id", logId)
    .order("weld_no", { ascending: true })
    .order("created_at", { ascending: true });

  query = applyWeldRowFilters(query, {
    statusFilter: input.statusFilter,
    quickFilter: input.quickFilter,
  });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ProjectWeldRow[];
}

export async function createProjectWeld(input: {
  log_id: string;
  weld_no: number;
  joint_type?: string | null;
  component_a_id?: string | null;
  component_b_id?: string | null;
  welder_id?: string | null;
  welder_cert_id?: string | null;
  wps_id?: string | null;
  weld_date?: string | null;
  filler_traceability_id?: string | null;
  visual_report_id?: string | null;
  visual_inspector?: string | null;
  crack_inspector?: string | null;
  crack_report_id?: string | null;
  crack_report_no?: string | null;
  volumetric_inspector?: string | null;
  volumetric_report_id?: string | null;
  volumetric_report_no?: string | null;
  status?: boolean | null;
}) {
  const payload = {
    id: createUuid(),
    log_id: input.log_id,
    weld_no: input.weld_no,
    joint_type: input.joint_type ?? null,
    component_a_id: input.component_a_id ?? null,
    component_b_id: input.component_b_id ?? null,
    welder_id: input.welder_id ?? null,
    welder_cert_id: input.welder_cert_id ?? null,
    wps_id: input.wps_id ?? null,
    weld_date: input.weld_date ?? null,
    filler_traceability_id: input.filler_traceability_id ?? null,
    visual_report_id: input.visual_report_id ?? null,
    visual_inspector: input.visual_inspector ?? null,
    crack_inspector: input.crack_inspector ?? null,
    crack_report_id: input.crack_report_id ?? null,
    crack_report_no: input.crack_report_no ?? null,
    volumetric_inspector: input.volumetric_inspector ?? null,
    volumetric_report_id: input.volumetric_report_id ?? null,
    volumetric_report_no: input.volumetric_report_no ?? null,
    status: input.status ?? false,
  };

  const { error } = await supabase.from("project_welds").insert(payload);
  if (error) throw error;
  return payload.id as string;
}

export async function updateProjectWeld(
  id: string,
  patch: Partial<Pick<ProjectWeldRow, "weld_no" | "joint_type" | "component_a_id" | "component_b_id" | "welder_id" | "welder_cert_id" | "wps_id" | "weld_date" | "filler_traceability_id" | "visual_report_id" | "visual_inspector" | "crack_inspector" | "crack_report_id" | "crack_report_no" | "volumetric_inspector" | "volumetric_report_id" | "volumetric_report_no" | "status">>
) {
  const { error } = await supabase.from("project_welds").update(patch).eq("id", id);
  if (error) throw error;
}

export async function bulkUpdateProjectWelds(
  ids: string[],
  patch: Partial<
    Pick<
      ProjectWeldRow,
      | "joint_type"
      | "component_a_id"
      | "component_b_id"
      | "welder_id"
      | "welder_cert_id"
      | "wps_id"
      | "weld_date"
      | "filler_traceability_id"
      | "visual_report_id"
      | "visual_inspector"
      | "crack_report_id"
      | "volumetric_report_id"
      | "status"
    >
  >
) {
  if (!ids.length) return;
  const { error } = await supabase.from("project_welds").update(patch).in("id", ids);
  if (error) throw error;
}

export async function deleteProjectWelds(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from("project_welds").delete().in("id", ids);
  if (error) throw error;
}

export async function deleteProjectWeld(id: string) {
  const { error } = await supabase.from("project_welds").delete().eq("id", id);
  if (error) throw error;
}

export type WeldEmployeeOption = {
  id: string;
  welder_no: string | null;
  display_name: string | null;
  label: string;
  displayLabel: string;
};

export type WeldNdtReportOption = {
  id: string;
  method: string | null;
  report_no: string | null;
  date: string | null;
};

export async function fetchWeldEmployees(): Promise<WeldEmployeeOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, welder_no")
    .order("display_name", { ascending: true, nullsFirst: false })
    .order("welder_no", { ascending: true, nullsFirst: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const name = String(row.display_name ?? "").trim();
    const no = String(row.welder_no ?? "").trim();
    const displayLabel = name || no || String(row.id);
    return {
      id: String(row.id),
      display_name: name || null,
      welder_no: no || null,
      label: [no, name].filter(Boolean).join(" - ") || displayLabel,
      displayLabel,
    };
  });
}

export async function fetchWeldNdtReports(projectNo?: string | null): Promise<WeldNdtReportOption[]> {
  let query = supabase
    .from("ndt_reports")
    .select(
      `
      id,
      report_date,
      method:method_id (
        code
      ),
      file:file_id (
        label
      )
    `
    )
    .order("report_date", { ascending: false, nullsFirst: false })
    .limit(400);

  const normalizedProjectNo = String(projectNo ?? "").trim();
  if (normalizedProjectNo) {
    query = query.eq("title", normalizedProjectNo);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    method: String(row.method?.code ?? "").trim() || null,
    report_no: row.file?.label ? String(row.file.label).replace(/\.pdf$/i, "") : null,
    date: String(row.report_date ?? "").trim() || null,
  }));
}

export async function createEmptyProjectWeldRows(input: { logId: string; count: number }) {
  const logId = String(input.logId || "").trim();
  if (!logId) throw new Error("Logg mangler.");

  const count = Math.max(1, Math.min(200, Math.trunc(Number(input.count) || 0)));
  if (!count) throw new Error("Ugyldig antall.");

  const { data: latestRows, error: latestError } = await supabase
    .from("project_welds")
    .select("weld_no")
    .eq("log_id", logId)
    .order("weld_no", { ascending: false })
    .limit(1);
  if (latestError) throw latestError;

  const latest = Number((latestRows ?? [])[0]?.weld_no ?? 0);
  const startNo = Number.isFinite(latest) ? latest + 1 : 1;

  const payload = Array.from({ length: count }, (_, idx) => ({
    id: createUuid(),
    log_id: logId,
    weld_no: startNo + idx,
    status: false,
  }));

  const { error } = await supabase.from("project_welds").insert(payload);
  if (error) throw error;

  return {
    count,
    firstWeldNo: startNo,
    lastWeldNo: startNo + count - 1,
  };
}

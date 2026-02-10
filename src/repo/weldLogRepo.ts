import { supabase } from "../services/supabaseClient";

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
  visual_inspector: string | null;
  crack_inspector: string | null;
  crack_report_id: string | null;
  crack_report_no: string | null;
  volumetric_inspector: string | null;
  volumetric_report_id: string | null;
  volumetric_report_no: string | null;
  status: string;
  created_by: string | null;
  created_at: string;

  log?: ProjectWeldLogRow | null;
  component_a?: { id: string; type_code: string; code_index: number | null; filler_type: string | null; material?: { id: string; name: string } | null } | null;
  component_b?: { id: string; type_code: string; code_index: number | null; filler_type: string | null; material?: { id: string; name: string } | null } | null;
  filler?: { id: string; type_code: string; code_index: number | null; filler_type: string | null } | null;
  welder?: { id: string; display_name: string | null; welder_no: string | null } | null;
  wps?: { id: string; doc_no: string; process: string } | null;
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
  visual_inspector?: string | null;
  crack_inspector?: string | null;
  crack_report_id?: string | null;
  crack_report_no?: string | null;
  volumetric_inspector?: string | null;
  volumetric_report_id?: string | null;
  volumetric_report_no?: string | null;
  status?: string | null;
}) {
  const payload = {
    id: crypto.randomUUID(),
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
    visual_inspector: input.visual_inspector ?? null,
    crack_inspector: input.crack_inspector ?? null,
    crack_report_id: input.crack_report_id ?? null,
    crack_report_no: input.crack_report_no ?? null,
    volumetric_inspector: input.volumetric_inspector ?? null,
    volumetric_report_id: input.volumetric_report_id ?? null,
    volumetric_report_no: input.volumetric_report_no ?? null,
    status: input.status ?? "kontroll",
  };

  const { error } = await supabase.from("project_welds").insert(payload);
  if (error) throw error;
  return payload.id as string;
}

export async function updateProjectWeld(
  id: string,
  patch: Partial<Pick<ProjectWeldRow, "weld_no" | "joint_type" | "component_a_id" | "component_b_id" | "welder_id" | "welder_cert_id" | "wps_id" | "weld_date" | "filler_traceability_id" | "visual_inspector" | "crack_inspector" | "crack_report_id" | "crack_report_no" | "volumetric_inspector" | "volumetric_report_id" | "volumetric_report_no" | "status">>
) {
  const { error } = await supabase.from("project_welds").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProjectWeld(id: string) {
  const { error } = await supabase.from("project_welds").delete().eq("id", id);
  if (error) throw error;
}

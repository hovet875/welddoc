import { supabase } from "../services/supabaseClient";

export type TraceabilityTypeRow = {
  code: string;
  label: string;
  use_dn: boolean;
  use_dn2: boolean;
  use_sch: boolean;
  use_pressure: boolean;
  use_thickness: boolean;
  use_filler_type: boolean;
  default_sch: string | null;
  default_pressure: string | null;
  created_at: string;
};

export type TraceabilityOptionRow = {
  id: string;
  group_key: string;
  value: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
};

export type ProjectTraceabilityRow = {
  id: string;
  project_id: string;
  type_code: string;
  code_index: number | null;
  dn: string | null;
  dn2: string | null;
  sch: string | null;
  pressure_class: string | null;
  thickness: string | null;
  filler_type: string | null;
  material_id: string | null;
  material_certificate_id: string | null;
  heat_number: string | null;
  created_at: string;
  type?: TraceabilityTypeRow | null;
  material?: { id: string; name: string } | null;
  cert?: {
    id: string;
    certificate_type: "material" | "filler";
    cert_type: string;
    supplier: string | null;
    heat_numbers: string[] | null;
    file_id: string | null;
    created_at: string;
    file: { id: string; label: string | null; mime_type: string | null; size_bytes: number | null } | null;
  } | null;
};

export async function fetchTraceabilityTypes() {
  const { data, error } = await supabase.from("parameter_traceability_types").select("*").order("code");
  if (error) throw error;
  return (data ?? []) as TraceabilityTypeRow[];
}

export async function upsertTraceabilityType(row: Omit<TraceabilityTypeRow, "created_at">) {
  const { error } = await supabase.from("parameter_traceability_types").upsert(row);
  if (error) throw error;
}

export async function deleteTraceabilityType(code: string) {
  const { error } = await supabase.from("parameter_traceability_types").delete().eq("code", code);
  if (error) throw error;
}

export async function fetchTraceabilityOptions(groupKey: string) {
  const { data, error } = await supabase
    .from("parameter_traceability_options")
    .select("*")
    .eq("group_key", groupKey)
    .order("sort_order", { ascending: true })
    .order("value", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as TraceabilityOptionRow[];
  if (groupKey === "dn" || groupKey === "dn2" || groupKey === "sch" || groupKey === "pn") {
    const parseNum = (value: string) => {
      const match = value.match(/-?\d+(?:[.,]\d+)?/);
      if (!match) return Number.NaN;
      return Number.parseFloat(match[0].replace(",", "."));
    };
    rows.sort((a, b) => {
      const aNum = parseNum(a.value);
      const bNum = parseNum(b.value);
      const aIsNum = Number.isFinite(aNum);
      const bIsNum = Number.isFinite(bNum);
      if (aIsNum && bIsNum) {
        if (aNum !== bNum) return aNum - bNum;
        return a.value.localeCompare(b.value, "nb", { numeric: true });
      }
      if (aIsNum && !bIsNum) return -1;
      if (!aIsNum && bIsNum) return 1;
      return a.value.localeCompare(b.value, "nb", { numeric: true });
    });
  }
  return rows;
}

export async function createTraceabilityOption(input: {
  group_key: string;
  value: string;
  is_default?: boolean;
  sort_order?: number;
}) {
  const { error } = await supabase.from("parameter_traceability_options").insert({
    group_key: input.group_key,
    value: input.value,
    is_default: input.is_default ?? false,
    sort_order: input.sort_order ?? 0,
  });
  if (error) throw error;
}

export async function updateTraceabilityOption(id: string, patch: Partial<Pick<TraceabilityOptionRow, "value" | "is_default" | "sort_order">>) {
  const { error } = await supabase.from("parameter_traceability_options").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTraceabilityOption(id: string) {
  const { error } = await supabase.from("parameter_traceability_options").delete().eq("id", id);
  if (error) throw error;
}

export async function setDefaultTraceabilityOption(groupKey: string, id: string) {
  const { error: clearErr } = await supabase
    .from("parameter_traceability_options")
    .update({ is_default: false })
    .eq("group_key", groupKey);
  if (clearErr) throw clearErr;

  const { error } = await supabase.from("parameter_traceability_options").update({ is_default: true }).eq("id", id);
  if (error) throw error;
}

export async function fetchProjectTraceability(projectId: string) {
  const { data, error } = await supabase
    .from("project_traceability")
    .select(
      `
      id,
      project_id,
      type_code,
      code_index,
      dn,
      dn2,
      sch,
      pressure_class,
      thickness,
      filler_type,
      material_id,
      material_certificate_id,
      heat_number,
      created_at,
      type:parameter_traceability_types (
        code,
        label,
        use_dn,
        use_dn2,
        use_sch,
        use_pressure,
        use_thickness,
        use_filler_type,
        default_sch,
        default_pressure,
        created_at
      ),
      material:material_id (
        id,
        name
      ),
      cert:material_certificate_id (
        id,
        certificate_type,
        cert_type,
        supplier,
        heat_numbers,
        file_id,
        created_at,
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
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProjectTraceabilityRow[];
}

export async function createProjectTraceability(input: {
  project_id: string;
  type_code: string;
  dn?: string | null;
  dn2?: string | null;
  sch?: string | null;
  pressure_class?: string | null;
  thickness?: string | null;
  filler_type?: string | null;
  material_id?: string | null;
  material_certificate_id?: string | null;
  heat_number?: string | null;
}) {
  const { data: latest, error: latestError } = await supabase
    .from("project_traceability")
    .select("code_index")
    .eq("project_id", input.project_id)
    .eq("type_code", input.type_code)
    .not("code_index", "is", null)
    .order("code_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;

  let nextIndex = (latest?.code_index ?? 0) + 1;
  if (!latest?.code_index) {
    const { count, error: countError } = await supabase
      .from("project_traceability")
      .select("id", { count: "exact", head: true })
      .eq("project_id", input.project_id)
      .eq("type_code", input.type_code);
    if (countError) throw countError;
    nextIndex = (count ?? 0) + 1;
  }

  const payload = {
    id: crypto.randomUUID(),
    project_id: input.project_id,
    type_code: input.type_code,
    code_index: nextIndex,
    dn: input.dn ?? null,
    dn2: input.dn2 ?? null,
    sch: input.sch ?? null,
    pressure_class: input.pressure_class ?? null,
    thickness: input.thickness ?? null,
    filler_type: input.filler_type ?? null,
    material_id: input.material_id ?? null,
    material_certificate_id: input.material_certificate_id ?? null,
    heat_number: input.heat_number ?? null,
  };
  const { error } = await supabase.from("project_traceability").insert(payload);
  if (error) throw error;
  return payload.id as string;
}

export async function updateProjectTraceability(
  id: string,
  patch: Partial<Pick<ProjectTraceabilityRow, "type_code" | "dn" | "dn2" | "sch" | "pressure_class" | "thickness" | "filler_type" | "material_id" | "material_certificate_id" | "heat_number" | "code_index">>
) {
  const { error } = await supabase.from("project_traceability").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProjectTraceability(id: string) {
  const { error } = await supabase.from("project_traceability").delete().eq("id", id);
  if (error) throw error;
}

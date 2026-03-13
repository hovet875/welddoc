import { supabase } from "../services/supabaseClient";

export type TraceabilityProfileFieldKey =
  | "dn"
  | "dn2"
  | "od"
  | "od2"
  | "sch"
  | "pressure_class"
  | "thickness"
  | "filler_manufacturer"
  | "filler_type"
  | "filler_diameter"
  | "description"
  | "custom_dimension";

export type TraceabilityProfileFieldInputMode = "option" | "text" | "number";

export type TraceabilityProfileFieldRow = {
  id: string;
  profile_id: string;
  field_key: TraceabilityProfileFieldKey;
  label: string;
  input_mode: TraceabilityProfileFieldInputMode;
  option_group_key: string | null;
  required: boolean;
  sort_order: number;
  default_value: string | null;
  created_at: string;
};

export type TraceabilityProfileRow = {
  id: string;
  type_code: string;
  code: string;
  label: string;
  certificate_type: "material" | "filler";
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  fields?: TraceabilityProfileFieldRow[] | null;
};

export type TraceabilityProfileUpsertInput = {
  id?: string;
  type_code: string;
  code: string;
  label: string;
  certificate_type: "material" | "filler";
  is_default?: boolean;
  is_active?: boolean;
  sort_order?: number;
};

export type TraceabilityProfileFieldUpsertInput = {
  field_key: TraceabilityProfileFieldKey;
  label: string;
  input_mode: TraceabilityProfileFieldInputMode;
  option_group_key?: string | null;
  required?: boolean;
  sort_order?: number;
  default_value?: string | null;
};

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
  profile_id: string | null;
  code_index: number | null;
  dn: string | null;
  dn2: string | null;
  od: string | null;
  od2: string | null;
  sch: string | null;
  pressure_class: string | null;
  thickness: string | null;
  filler_manufacturer: string | null;
  filler_type: string | null;
  filler_diameter: string | null;
  description: string | null;
  custom_dimension: string | null;
  material_id: string | null;
  material_certificate_id: string | null;
  heat_number: string | null;
  created_at: string;
  type?: TraceabilityTypeRow | null;
  profile?: TraceabilityProfileRow | null;
  material?: { id: string; name: string; material_code: string | null } | null;
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

function sortProfileFields(rows: TraceabilityProfileFieldRow[]) {
  return [...rows].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.field_key.localeCompare(b.field_key);
  });
}

function asNonNegativeInteger(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : fallback;
}

export async function fetchTraceabilityTypes() {
  const { data, error } = await supabase.from("parameter_traceability_types").select("*").order("code");
  if (error) throw error;
  return (data ?? []) as TraceabilityTypeRow[];
}

async function ensureDefaultProfileForTypeRow(row: Omit<TraceabilityTypeRow, "created_at">) {
  const typeCode = row.code.trim().toUpperCase();
  if (!typeCode) return;

  const { data: profileData, error: profileError } = await supabase
    .from("parameter_traceability_profiles")
    .upsert(
      {
        type_code: typeCode,
        code: "DEFAULT",
        label: "Standard",
        certificate_type: row.use_filler_type ? "filler" : "material",
        is_default: true,
        is_active: true,
        sort_order: 0,
      },
      { onConflict: "type_code,code" }
    )
    .select("id")
    .single();
  if (profileError) throw profileError;

  const profileId = String(profileData.id);
  const nextFields: Array<Omit<TraceabilityProfileFieldRow, "id" | "created_at">> = [];
  if (row.use_dn) {
    nextFields.push({
      profile_id: profileId,
      field_key: "dn",
      label: "DN",
      input_mode: "option",
      option_group_key: "dn",
      required: true,
      sort_order: 10,
      default_value: null,
    });
  }
  if (row.use_dn2) {
    nextFields.push({
      profile_id: profileId,
      field_key: "dn2",
      label: "DN2",
      input_mode: "option",
      option_group_key: "dn",
      required: true,
      sort_order: 20,
      default_value: null,
    });
  }
  if (row.use_sch) {
    nextFields.push({
      profile_id: profileId,
      field_key: "sch",
      label: "SCH",
      input_mode: "option",
      option_group_key: "sch",
      required: true,
      sort_order: 30,
      default_value: row.default_sch ?? null,
    });
  }
  if (row.use_pressure) {
    nextFields.push({
      profile_id: profileId,
      field_key: "pressure_class",
      label: "Trykklasse",
      input_mode: "option",
      option_group_key: "pn",
      required: true,
      sort_order: 40,
      default_value: row.default_pressure ?? null,
    });
  }
  if (row.use_thickness) {
    nextFields.push({
      profile_id: profileId,
      field_key: "thickness",
      label: "Tykkelse (mm)",
      input_mode: "number",
      option_group_key: null,
      required: true,
      sort_order: 50,
      default_value: null,
    });
  }
  if (row.use_filler_type) {
    nextFields.push({
      profile_id: profileId,
      field_key: "filler_manufacturer",
      label: "Produsent",
      input_mode: "option",
      option_group_key: "filler_manufacturer",
      required: true,
      sort_order: 55,
      default_value: null,
    });
    nextFields.push({
      profile_id: profileId,
      field_key: "filler_type",
      label: "Sveisetilsett type",
      input_mode: "option",
      option_group_key: "filler_type",
      required: true,
      sort_order: 60,
      default_value: null,
    });
    nextFields.push({
      profile_id: profileId,
      field_key: "filler_diameter",
      label: "Diameter (mm)",
      input_mode: "option",
      option_group_key: "filler_diameter",
      required: true,
      sort_order: 65,
      default_value: null,
    });
  }

  const { data: existingFields, error: existingFieldError } = await supabase
    .from("parameter_traceability_profile_fields")
    .select("id, field_key")
    .eq("profile_id", profileId);
  if (existingFieldError) throw existingFieldError;

  const keepKeys = new Set(nextFields.map((field) => field.field_key));
  const removeIds = (existingFields ?? [])
    .filter((field: { id: string; field_key: string }) => !keepKeys.has(field.field_key as TraceabilityProfileFieldKey))
    .map((field: { id: string }) => field.id);

  if (removeIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("parameter_traceability_profile_fields")
      .delete()
      .in("id", removeIds);
    if (deleteError) throw deleteError;
  }

  if (nextFields.length > 0) {
    const { error: fieldUpsertError } = await supabase
      .from("parameter_traceability_profile_fields")
      .upsert(nextFields, { onConflict: "profile_id,field_key" });
    if (fieldUpsertError) throw fieldUpsertError;
  }
}

export async function fetchTraceabilityProfiles(typeCode?: string) {
  let query = supabase
    .from("parameter_traceability_profiles")
    .select("*")
    .order("type_code", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const normalizedTypeCode = String(typeCode ?? "").trim();
  if (normalizedTypeCode) {
    query = query.eq("type_code", normalizedTypeCode);
  }

  const { data: profileData, error: profileError } = await query;
  if (profileError) throw profileError;

  const profiles = (profileData ?? []) as TraceabilityProfileRow[];
  if (!profiles.length) return [];

  const profileIds = profiles.map((row) => row.id);
  const { data: fieldData, error: fieldError } = await supabase
    .from("parameter_traceability_profile_fields")
    .select("*")
    .in("profile_id", profileIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (fieldError) throw fieldError;

  const fields = (fieldData ?? []) as TraceabilityProfileFieldRow[];
  const fieldsByProfileId = new Map<string, TraceabilityProfileFieldRow[]>();

  fields.forEach((row) => {
    const list = fieldsByProfileId.get(row.profile_id) ?? [];
    list.push(row);
    fieldsByProfileId.set(row.profile_id, list);
  });

  return profiles.map((profile) => ({
    ...profile,
    fields: sortProfileFields(fieldsByProfileId.get(profile.id) ?? []),
  }));
}

export async function upsertTraceabilityProfile(input: TraceabilityProfileUpsertInput) {
  const normalizedId = String(input.id ?? "").trim();
  const typeCode = String(input.type_code ?? "").trim().toUpperCase();
  const code = String(input.code ?? "").trim().toUpperCase();
  const label = String(input.label ?? "").trim();

  if (!typeCode) throw new Error("type_code er påkrevd.");
  if (!code) throw new Error("profile code er påkrevd.");
  if (!label) throw new Error("profile label er påkrevd.");

  const certificateType = input.certificate_type === "filler" ? "filler" : "material";
  const payload = {
    type_code: typeCode,
    code,
    label,
    certificate_type: certificateType,
    is_default: input.is_default ?? false,
    is_active: input.is_active ?? true,
    sort_order: asNonNegativeInteger(input.sort_order, 0),
  } as const;

  if (payload.is_default) {
    let clearDefaultsQuery = supabase
      .from("parameter_traceability_profiles")
      .update({ is_default: false })
      .eq("type_code", typeCode);

    if (normalizedId) {
      clearDefaultsQuery = clearDefaultsQuery.neq("id", normalizedId);
    }

    const { error: clearDefaultsError } = await clearDefaultsQuery;
    if (clearDefaultsError) throw clearDefaultsError;
  }

  if (normalizedId) {
    const { data, error } = await supabase
      .from("parameter_traceability_profiles")
      .update(payload)
      .eq("id", normalizedId)
      .select("*")
      .single();
    if (error) throw error;
    return data as TraceabilityProfileRow;
  }

  const { data, error } = await supabase
    .from("parameter_traceability_profiles")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as TraceabilityProfileRow;
}

export async function deleteTraceabilityProfile(id: string) {
  const profileId = String(id ?? "").trim();
  if (!profileId) throw new Error("profile id er påkrevd.");
  const { error } = await supabase.from("parameter_traceability_profiles").delete().eq("id", profileId);
  if (error) throw error;
}

export async function setDefaultTraceabilityProfile(typeCode: string, profileId: string) {
  const normalizedTypeCode = String(typeCode ?? "").trim().toUpperCase();
  const normalizedProfileId = String(profileId ?? "").trim();
  if (!normalizedTypeCode || !normalizedProfileId) {
    throw new Error("type_code og profile_id er påkrevd.");
  }

  const { error: clearErr } = await supabase
    .from("parameter_traceability_profiles")
    .update({ is_default: false })
    .eq("type_code", normalizedTypeCode);
  if (clearErr) throw clearErr;

  const { error } = await supabase
    .from("parameter_traceability_profiles")
    .update({ is_default: true })
    .eq("id", normalizedProfileId)
    .eq("type_code", normalizedTypeCode);
  if (error) throw error;
}

export async function replaceTraceabilityProfileFields(profileId: string, fields: TraceabilityProfileFieldUpsertInput[]) {
  const normalizedProfileId = String(profileId ?? "").trim();
  if (!normalizedProfileId) throw new Error("profile_id er påkrevd.");

  const byFieldKey = new Map<TraceabilityProfileFieldKey, TraceabilityProfileFieldUpsertInput>();
  for (const row of fields) {
    const label = String(row.label ?? "").trim();
    byFieldKey.set(row.field_key, {
      field_key: row.field_key,
      label: label || row.field_key,
      input_mode: row.input_mode,
      option_group_key: row.input_mode === "option" ? String(row.option_group_key ?? "").trim() || null : null,
      required: row.required ?? true,
      sort_order: asNonNegativeInteger(row.sort_order, 0),
      default_value: String(row.default_value ?? "").trim() || null,
    });
  }

  const nextFields = Array.from(byFieldKey.values()).map((row) => ({
    profile_id: normalizedProfileId,
    field_key: row.field_key,
    label: row.label,
    input_mode: row.input_mode,
    option_group_key: row.option_group_key ?? null,
    required: row.required ?? true,
    sort_order: asNonNegativeInteger(row.sort_order, 0),
    default_value: row.default_value ?? null,
  }));

  const { data: existingFields, error: existingFieldError } = await supabase
    .from("parameter_traceability_profile_fields")
    .select("id, field_key")
    .eq("profile_id", normalizedProfileId);
  if (existingFieldError) throw existingFieldError;

  const keepKeys = new Set(nextFields.map((field) => field.field_key));
  const removeIds = (existingFields ?? [])
    .filter((field: { id: string; field_key: string }) => !keepKeys.has(field.field_key as TraceabilityProfileFieldKey))
    .map((field: { id: string }) => field.id);

  if (removeIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("parameter_traceability_profile_fields")
      .delete()
      .in("id", removeIds);
    if (deleteError) throw deleteError;
  }

  if (nextFields.length > 0) {
    const { error: fieldUpsertError } = await supabase
      .from("parameter_traceability_profile_fields")
      .upsert(nextFields, { onConflict: "profile_id,field_key" });
    if (fieldUpsertError) throw fieldUpsertError;
  }
}

export async function upsertTraceabilityType(row: Omit<TraceabilityTypeRow, "created_at">) {
  const normalized = {
    ...row,
    code: row.code.trim().toUpperCase(),
    label: row.label.trim(),
  };

  const { error } = await supabase.from("parameter_traceability_types").upsert(normalized);
  if (error) throw error;

  await ensureDefaultProfileForTypeRow(normalized);
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
  if (
    groupKey === "dn" ||
    groupKey === "dn2" ||
    groupKey === "od" ||
    groupKey === "sch" ||
    groupKey === "pn" ||
    groupKey === "filler_diameter"
  ) {
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
      profile_id,
      code_index,
      dn,
      dn2,
      od,
      od2,
      sch,
      pressure_class,
      thickness,
      filler_manufacturer,
      filler_type,
      filler_diameter,
      description,
      custom_dimension,
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
      profile:profile_id (
        id,
        type_code,
        code,
        label,
        certificate_type,
        is_default,
        is_active,
        sort_order,
        created_at,
        fields:parameter_traceability_profile_fields (
          id,
          profile_id,
          field_key,
          label,
          input_mode,
          option_group_key,
          required,
          sort_order,
          default_value,
          created_at
        )
      ),
      material:material_id (
        id,
        name,
        material_code
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

  const rows = ((data ?? []) as unknown as ProjectTraceabilityRow[]).map((row) => {
    const fields = row.profile?.fields ?? [];
    return {
      ...row,
      profile: row.profile
        ? {
            ...row.profile,
            fields: sortProfileFields(fields),
          }
        : null,
    };
  });

  return rows;
}

export async function createProjectTraceability(input: {
  project_id: string;
  type_code: string;
  profile_id?: string | null;
  dn?: string | null;
  dn2?: string | null;
  od?: string | null;
  od2?: string | null;
  sch?: string | null;
  pressure_class?: string | null;
  thickness?: string | null;
  filler_manufacturer?: string | null;
  filler_type?: string | null;
  filler_diameter?: string | null;
  description?: string | null;
  custom_dimension?: string | null;
  material_id?: string | null;
  material_certificate_id?: string | null;
  heat_number?: string | null;
}) {
  const { data, error } = await supabase.rpc("create_project_traceability_with_next_index", {
    p_project_id: input.project_id,
    p_type_code: input.type_code,
    p_profile_id: input.profile_id ?? null,
    p_dn: input.dn ?? null,
    p_dn2: input.dn2 ?? null,
    p_od: input.od ?? null,
    p_od2: input.od2 ?? null,
    p_sch: input.sch ?? null,
    p_pressure_class: input.pressure_class ?? null,
    p_thickness: input.thickness ?? null,
    p_filler_manufacturer: input.filler_manufacturer ?? null,
    p_filler_type: input.filler_type ?? null,
    p_filler_diameter: input.filler_diameter ?? null,
    p_description: input.description ?? null,
    p_custom_dimension: input.custom_dimension ?? null,
    p_material_id: input.material_id ?? null,
    p_material_certificate_id: input.material_certificate_id ?? null,
    p_heat_number: input.heat_number ?? null,
  });
  if (error) throw error;
  if (!data) throw new Error("Kunne ikke opprette sporbarhet.");
  return String(data);
}

export async function updateProjectTraceability(
  id: string,
  patch: Partial<
    Pick<
      ProjectTraceabilityRow,
      | "type_code"
      | "profile_id"
      | "dn"
      | "dn2"
      | "od"
      | "od2"
      | "sch"
      | "pressure_class"
      | "thickness"
      | "filler_manufacturer"
      | "filler_type"
      | "filler_diameter"
      | "description"
      | "custom_dimension"
      | "material_id"
      | "material_certificate_id"
      | "heat_number"
      | "code_index"
    >
  >
) {
  const { error } = await supabase.from("project_traceability").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProjectTraceability(id: string) {
  const { error } = await supabase.from("project_traceability").delete().eq("id", id);
  if (error) throw error;
}

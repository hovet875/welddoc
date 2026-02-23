import { supabase } from "../services/supabaseClient";

export type WelderCertScopeRow = {
  id: string;
  standard_id: string | null;
  fm_group_id: string | null;
  material_id: string | null;
  welding_process_code: string | null;
  joint_type: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  standard?: { id: string; label: string; revision: number | null } | null;
  fm_group?: { id: string; standard_id: string; label: string } | null;
};

type RawScopeRow = Omit<WelderCertScopeRow, "standard" | "fm_group"> & {
  standard?: WelderCertScopeRow["standard"] | WelderCertScopeRow["standard"][] | null;
  fm_group?: WelderCertScopeRow["fm_group"] | WelderCertScopeRow["fm_group"][] | null;
};

const normalizeJoin = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const normalizeScopeRow = (row: RawScopeRow): WelderCertScopeRow => ({
  ...row,
  standard: normalizeJoin(row.standard),
  fm_group: normalizeJoin(row.fm_group),
});

export async function fetchWelderCertScopes(opts?: { includeInactive?: boolean }): Promise<WelderCertScopeRow[]> {
  let query = supabase
    .from("parameter_welder_cert_scopes")
    .select(
      `
        id,
        standard_id,
        fm_group_id,
        material_id,
        welding_process_code,
        joint_type,
        is_active,
        sort_order,
        created_at,
        standard:standard_id (
          id,
          label,
          revision
        ),
        fm_group:fm_group_id (
          id,
          standard_id,
          label
        )
      `
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as RawScopeRow[]).map(normalizeScopeRow);
}

export async function createWelderCertScope(input: {
  standard_id?: string | null;
  fm_group_id?: string | null;
  material_id?: string | null;
  welding_process_code?: string | null;
  joint_type?: string | null;
  sort_order?: number;
}) {
  const { error } = await supabase.from("parameter_welder_cert_scopes").insert({
    standard_id: input.standard_id ?? null,
    fm_group_id: input.fm_group_id ?? null,
    material_id: input.material_id ?? null,
    welding_process_code: input.welding_process_code ?? null,
    joint_type: input.joint_type ?? null,
    sort_order: input.sort_order ?? 0,
  });
  if (error) throw error;
}

export async function updateWelderCertScope(
  id: string,
  patch: Partial<
    Pick<
      WelderCertScopeRow,
      "standard_id" | "fm_group_id" | "material_id" | "welding_process_code" | "joint_type" | "is_active" | "sort_order"
    >
  >
) {
  const { error } = await supabase.from("parameter_welder_cert_scopes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteWelderCertScope(id: string) {
  const { error } = await supabase.from("parameter_welder_cert_scopes").delete().eq("id", id);
  if (error) throw error;
}

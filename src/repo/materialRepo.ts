import { supabase } from "../services/supabaseClient";

export type MaterialRow = {
  id: string;
  name: string;
  material_code: string;
  material_group: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

export async function fetchMaterials(opts?: { includeInactive?: boolean }): Promise<MaterialRow[]> {
  let query = supabase
    .from("parameter_materials")
    .select("id, name, material_code, material_group, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MaterialRow[];
}

export async function createMaterial(payload: {
  name: string;
  material_code: string;
  material_group: string;
}) {
  const { error } = await supabase.from("parameter_materials").insert(payload);
  if (error) throw error;
}

export async function updateMaterial(
  id: string,
  payload: { name: string; material_code: string; material_group: string }
) {
  const { error } = await supabase.from("parameter_materials").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteMaterial(id: string) {
  const { error } = await supabase.from("parameter_materials").delete().eq("id", id);
  if (error) throw error;
}

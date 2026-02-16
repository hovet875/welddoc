import { supabase } from "../services/supabaseClient";

export type WeldJointTypeRow = {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

export async function fetchWeldJointTypes(opts?: { includeInactive?: boolean }): Promise<WeldJointTypeRow[]> {
  let query = supabase
    .from("parameter_weld_joint_types")
    .select("id, label, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WeldJointTypeRow[];
}

export async function createWeldJointType(label: string) {
  const { error } = await supabase.from("parameter_weld_joint_types").insert({ label });
  if (error) throw error;
}

export async function updateWeldJointType(id: string, label: string) {
  const { error } = await supabase.from("parameter_weld_joint_types").update({ label }).eq("id", id);
  if (error) throw error;
}

export async function deleteWeldJointType(id: string) {
  const { error } = await supabase.from("parameter_weld_joint_types").delete().eq("id", id);
  if (error) throw error;
}

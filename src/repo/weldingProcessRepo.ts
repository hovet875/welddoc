import { supabase } from "../services/supabaseClient";

export type WeldingProcessRow = {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

export async function fetchWeldingProcesses(opts?: { includeInactive?: boolean }): Promise<WeldingProcessRow[]> {
  let query = supabase
    .from("parameter_welding_processes")
    .select("id, label, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WeldingProcessRow[];
}

export async function createWeldingProcess(label: string) {
  const { error } = await supabase.from("parameter_welding_processes").insert({ label });
  if (error) throw error;
}

export async function updateWeldingProcess(id: string, label: string) {
  const { error } = await supabase.from("parameter_welding_processes").update({ label }).eq("id", id);
  if (error) throw error;
}

export async function deleteWeldingProcess(id: string) {
  const { error } = await supabase.from("parameter_welding_processes").delete().eq("id", id);
  if (error) throw error;
}

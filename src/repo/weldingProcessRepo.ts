import { supabase } from "../services/supabaseClient";

export type WeldingProcessRow = {
  id: string;
  code: string | null;
  label: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

export async function fetchWeldingProcesses(opts?: { includeInactive?: boolean }): Promise<WeldingProcessRow[]> {
  let query = supabase
    .from("parameter_welding_processes")
    .select("id, code, label, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true, nullsFirst: false })
    .order("label", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WeldingProcessRow[];
}

export async function createWeldingProcess(payload: { code: string; label: string }) {
  const { error } = await supabase.from("parameter_welding_processes").insert(payload);
  if (error) throw error;
}

export async function updateWeldingProcess(id: string, payload: { code: string; label: string }) {
  const { error } = await supabase.from("parameter_welding_processes").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteWeldingProcess(id: string) {
  const { error } = await supabase.from("parameter_welding_processes").delete().eq("id", id);
  if (error) throw error;
}

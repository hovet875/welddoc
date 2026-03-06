import { supabase } from "../services/supabaseClient";

export type SupplierRow = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

export async function fetchSuppliers(opts?: { includeInactive?: boolean }): Promise<SupplierRow[]> {
  let query = supabase
    .from("parameter_suppliers")
    .select("id, name, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SupplierRow[];
}

export async function createSupplier(name: string) {
  const { error } = await supabase.from("parameter_suppliers").insert({ name });
  if (error) throw error;
}

export async function ensureSupplierExists(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const { data, error } = await supabase
    .from("parameter_suppliers")
    .select("id")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.id) return;

  await createSupplier(trimmed);
}

export async function updateSupplier(id: string, name: string) {
  const { error } = await supabase.from("parameter_suppliers").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase.from("parameter_suppliers").delete().eq("id", id);
  if (error) throw error;
}

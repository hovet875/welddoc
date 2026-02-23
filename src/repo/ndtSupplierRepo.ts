import { supabase } from "../services/supabaseClient";

export type NdtSupplierRow = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

export type NdtInspectorRow = {
  id: string;
  supplier_id: string;
  name: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
};

export async function fetchNdtSuppliers(opts?: { includeInactive?: boolean }): Promise<NdtSupplierRow[]> {
  let query = supabase
    .from("parameter_ndt_suppliers")
    .select("id, name, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NdtSupplierRow[];
}

export async function createNdtSupplier(name: string) {
  const { error } = await supabase.from("parameter_ndt_suppliers").insert({ name });
  if (error) throw error;
}

export async function updateNdtSupplier(id: string, name: string) {
  const { error } = await supabase.from("parameter_ndt_suppliers").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteNdtSupplier(id: string) {
  const { error } = await supabase.from("parameter_ndt_suppliers").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchNdtInspectors(opts?: {
  includeInactive?: boolean;
  supplierId?: string | null;
}): Promise<NdtInspectorRow[]> {
  let query = supabase
    .from("parameter_ndt_inspectors")
    .select("id, supplier_id, name, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (opts?.supplierId) {
    query = query.eq("supplier_id", opts.supplierId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NdtInspectorRow[];
}

export async function createNdtInspector(input: { supplier_id: string; name: string }) {
  const { error } = await supabase.from("parameter_ndt_inspectors").insert(input);
  if (error) throw error;
}

export async function updateNdtInspector(id: string, patch: { supplier_id?: string; name?: string }) {
  const { error } = await supabase.from("parameter_ndt_inspectors").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteNdtInspector(id: string) {
  const { error } = await supabase.from("parameter_ndt_inspectors").delete().eq("id", id);
  if (error) throw error;
}

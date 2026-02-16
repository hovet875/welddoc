import { supabase } from "../../../../services/supabaseClient";
import type { EmployeeOption, ListFilters, ListResult, NdtMethodOption, NdtReportRow, WeldDetailRow, WeldListRow } from "./types";

const BASE_SELECT = `
  id,
  sveis_id:weld_no,
  fuge:joint_type,
  sveiser_id:welder_id,
  dato:weld_date,
  status,
  kontrollert_av:visual_inspector,
  updated_at:created_at,
  komponent_a:component_a_id (
    id,
    type_code,
    code_index,
    dn,
    heat_number,
    filler_type,
    material:material_id (
      material_code
    ),
    cert:material_certificate_id (
      certificate_type,
      heat_numbers
    )
  ),
  komponent_b:component_b_id (
    id,
    type_code,
    code_index,
    dn,
    heat_number,
    filler_type,
    material:material_id (
      material_code
    ),
    cert:material_certificate_id (
      certificate_type,
      heat_numbers
    )
  ),
  tilsett:filler_traceability_id (
    id,
    type_code,
    code_index,
    dn,
    heat_number,
    filler_type,
    material:material_id (
      material_code
    ),
    cert:material_certificate_id (
      certificate_type,
      heat_numbers
    )
  ),
  wps:wps_id (
    id,
    doc_no
  ),
  vt_report_id:visual_report_id,
  pt_report_id:crack_report_id,
  vol_report_id:volumetric_report_id,
  sveiser:welder_id (
    id,
    display_name,
    welder_no
  )
`;

const DETAIL_SELECT = BASE_SELECT;

type RawWelder = { id: string; display_name: string | null; welder_no: string | null } | null;
type RawTrace = {
  id: string;
  type_code: string;
  code_index: number | null;
  dn: string | null;
  heat_number: string | null;
  filler_type: string | null;
  material?: { material_code: string | null } | { material_code: string | null }[] | null;
  cert?:
    | { certificate_type: "material" | "filler" | string; heat_numbers: string[] | null }
    | { certificate_type: "material" | "filler" | string; heat_numbers: string[] | null }[]
    | null;
} | null;
type RawWps = { id: string; doc_no: string | null } | null;
type RawWeldRow = Omit<
  WeldListRow,
  "status" | "sveiser" | "komponent_a" | "komponent_b" | "tilsett" | "komponent_a_id" | "komponent_b_id" | "tilsett_id" | "wps" | "wps_id"
> & {
  status: boolean | null;
  sveiser?: RawWelder | RawWelder[] | null;
  komponent_a?: RawTrace | RawTrace[] | null;
  komponent_b?: RawTrace | RawTrace[] | null;
  tilsett?: RawTrace | RawTrace[] | null;
  wps?: RawWps | RawWps[] | null;
};

const normalizeWelder = (value: RawWelder | RawWelder[] | null | undefined) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const normalizeTrace = (value: RawTrace | RawTrace[] | null | undefined) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const normalizeWps = (value: RawWps | RawWps[] | null | undefined) => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const buildTraceCode = (trace: RawTrace | null) => {
  if (!trace) return null;
  return `${trace.type_code}${trace.code_index ?? ""}`;
};

const normalizeWeldRow = (row: RawWeldRow): WeldListRow => {
  const komponentATrace = normalizeTrace(row.komponent_a);
  const komponentBTrace = normalizeTrace(row.komponent_b);
  const tilsettTrace = normalizeTrace(row.tilsett);
  const komponentA = buildTraceCode(komponentATrace);
  const komponentB = buildTraceCode(komponentBTrace);
  const tilsett = buildTraceCode(tilsettTrace);
  const wpsRow = normalizeWps(row.wps);
  const wps = wpsRow?.doc_no ?? null;
  return {
    ...row,
    komponent_a_id: komponentATrace?.id ?? null,
    komponent_b_id: komponentBTrace?.id ?? null,
    tilsett_id: tilsettTrace?.id ?? null,
    sveiser: normalizeWelder(row.sveiser),
    komponent_a: komponentA,
    komponent_b: komponentB,
    tilsett,
    wps_id: wpsRow?.id ?? null,
    wps,
    status: Boolean(row.status),
  };
};

const mapPatchToProjectWelds = (patch: Partial<WeldDetailRow>) => {
  const mapped: Record<string, unknown> = {};
  const hasField = (name: keyof WeldDetailRow) => Object.prototype.hasOwnProperty.call(patch, name);
  if (patch.sveis_id != null) {
    const next = typeof patch.sveis_id === "string" ? Number(patch.sveis_id) : patch.sveis_id;
    mapped.weld_no = Number.isFinite(next as number) ? next : null;
  }
  if (hasField("fuge")) mapped.joint_type = patch.fuge || null;
  if (hasField("sveiser_id")) mapped.welder_id = patch.sveiser_id || null;
  if (hasField("wps_id")) mapped.wps_id = patch.wps_id || null;
  if (patch.dato != null) mapped.weld_date = patch.dato;
  if (hasField("komponent_a_id")) mapped.component_a_id = patch.komponent_a_id || null;
  if (hasField("komponent_b_id")) mapped.component_b_id = patch.komponent_b_id || null;
  if (hasField("tilsett_id")) mapped.filler_traceability_id = patch.tilsett_id || null;
  if (hasField("vt_report_id")) mapped.visual_report_id = patch.vt_report_id || null;
  if (hasField("kontrollert_av")) mapped.visual_inspector = patch.kontrollert_av || null;
  if (hasField("pt_report_id")) mapped.crack_report_id = patch.pt_report_id || null;
  if (hasField("vol_report_id")) mapped.volumetric_report_id = patch.vol_report_id || null;
  if (patch.status != null) mapped.status = Boolean(patch.status);
  return mapped;
};

export async function listWelds(opts: {
  page: number;
  pageSize: number;
  filters: ListFilters;
  orderBy: "weld_no" | "weld_date" | "created_at";
  orderDir: "asc" | "desc";
  logId?: string | null;
}): Promise<ListResult<WeldListRow>> {
  const { page, pageSize, filters, orderBy, orderDir, logId } = opts;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("project_welds")
    .select(BASE_SELECT, { count: "exact" })
    .order(orderBy, { ascending: orderDir === "asc", nullsFirst: false })
    .range(from, to);

  if (logId) {
    query = query.eq("log_id", logId);
  }

  if (filters.status === "true") {
    query = query.eq("status", true);
  } else if (filters.status === "false") {
    query = query.eq("status", false);
  }

  const search = filters.search.trim();
  if (search) {
    const q = `%${search}%`;
    query = query.or(
      [
        `weld_no.ilike.${q}`,
        `joint_type.ilike.${q}`,
        `welder_id.ilike.${q}`,
        `crack_report_id.ilike.${q}`,
        `volumetric_report_id.ilike.${q}`,
      ].join(",")
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((row) => normalizeWeldRow(row as RawWeldRow));
  return { rows, count: count ?? 0 };
}

export async function getWeldDetail(id: string): Promise<WeldDetailRow> {
  const { data, error } = await supabase
    .from("project_welds")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return normalizeWeldRow(data as RawWeldRow) as WeldDetailRow;
}

export async function createWeld(input: { logId: string; patch: Partial<WeldDetailRow> }) {
  const mapped = mapPatchToProjectWelds(input.patch);
  if (mapped.weld_no == null) {
    throw new Error("Sveis ID mangler eller er ugyldig.");
  }
  const payload = {
    id: crypto.randomUUID(),
    log_id: input.logId,
    weld_no: mapped.weld_no as number,
    joint_type: mapped.joint_type ?? null,
    component_a_id: mapped.component_a_id ?? null,
    component_b_id: mapped.component_b_id ?? null,
    welder_id: mapped.welder_id ?? null,
    wps_id: mapped.wps_id ?? null,
    weld_date: mapped.weld_date ?? null,
    filler_traceability_id: mapped.filler_traceability_id ?? null,
    visual_inspector: mapped.visual_inspector ?? null,
    visual_report_id: mapped.visual_report_id ?? null,
    crack_report_id: mapped.crack_report_id ?? null,
    volumetric_report_id: mapped.volumetric_report_id ?? null,
    status: mapped.status ?? false,
  };
  const { error } = await supabase.from("project_welds").insert(payload);
  if (error) throw error;
  return payload.id as string;
}

export async function createEmptyWeldRows(input: { logId: string; count: number }) {
  const logId = String(input.logId || "").trim();
  if (!logId) throw new Error("Logg mangler.");

  const count = Math.max(1, Math.min(200, Math.trunc(Number(input.count) || 0)));
  if (!count) throw new Error("Ugyldig antall.");

  const { data: latestRows, error: latestError } = await supabase
    .from("project_welds")
    .select("weld_no")
    .eq("log_id", logId)
    .order("weld_no", { ascending: false })
    .limit(1);
  if (latestError) throw latestError;

  const latest = Number((latestRows ?? [])[0]?.weld_no ?? 0);
  const startNo = Number.isFinite(latest) ? latest + 1 : 1;

  const payload = Array.from({ length: count }, (_, idx) => ({
    id: crypto.randomUUID(),
    log_id: logId,
    weld_no: startNo + idx,
    status: false,
  }));

  const { error } = await supabase.from("project_welds").insert(payload);
  if (error) throw error;

  return {
    count,
    firstWeldNo: startNo,
    lastWeldNo: startNo + count - 1,
  };
}

export async function updateWeld(id: string, patch: Partial<WeldDetailRow>) {
  const mapped = mapPatchToProjectWelds(patch);
  const { error } = await supabase.from("project_welds").update(mapped).eq("id", id);
  if (error) throw error;
}

export async function bulkUpdate(ids: string[], patch: Partial<WeldDetailRow>) {
  if (!ids.length) return;
  const mapped = mapPatchToProjectWelds(patch);
  const { error } = await supabase.from("project_welds").update(mapped).in("id", ids);
  if (error) throw error;
}

export async function deleteWelds(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from("project_welds").delete().in("id", ids);
  if (error) throw error;
}

export async function listNdtReports(opts?: { projectNo?: string | null }): Promise<NdtReportRow[]> {
  let query = supabase
    .from("ndt_reports")
    .select(
      `
      id,
      title,
      report_date,
      file:file_id (
        label
      ),
      method:method_id (
        code
      )
    `
    )
    .order("report_date", { ascending: false, nullsFirst: false })
    .limit(200);

  const projectNo = String(opts?.projectNo ?? "").trim();
  if (projectNo) {
    query = query.eq("title", projectNo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    method: row.method?.code ?? null,
    report_no: row.file?.label ? String(row.file.label).replace(/\.pdf$/i, "") : null,
    date: row.report_date ?? null,
    file_url: null,
    notes: null,
  })) as NdtReportRow[];
}

export async function listNdtMethods(): Promise<NdtMethodOption[]> {
  const { data, error } = await supabase
    .from("parameter_ndt_methods")
    .select("code, label, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    code: String(row.code ?? "").trim().toUpperCase(),
    label: String(row.label ?? row.code ?? "").trim(),
  }));
}

export async function listEmployees(): Promise<EmployeeOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, welder_no")
    .order("display_name", { ascending: true, nullsFirst: false })
    .order("welder_no", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const name = String(row.display_name ?? "").trim();
    const no = String(row.welder_no ?? "").trim();
    return {
      id: String(row.id),
      display_name: name || null,
      welder_no: no || null,
      label: [no, name].filter(Boolean).join(" - ") || String(row.id),
    };
  });
}

import type { MaterialCertificateRow } from "@/repo/materialCertificateRepo";
import type { MaterialRow } from "@/repo/materialRepo";
import type { ProjectTraceabilityRow, TraceabilityOptionRow, TraceabilityTypeRow } from "@/repo/traceabilityRepo";
import type { FilteredCertificatesResult, TraceabilityModalValues } from "../types";

export function lookupType(types: TraceabilityTypeRow[], code: string | null | undefined) {
  if (!code) return null;
  return types.find((type) => type.code === code) ?? null;
}

export function firstDefault(items: TraceabilityOptionRow[], fallback = "") {
  const found = items.find((item) => item.is_default);
  if (found) return found.value;
  return items[0]?.value ?? fallback;
}

export function fieldLabelForDn2(code: string) {
  if (code === "TR") return "DN gren";
  if (code === "RC" || code === "RE") return "DN liten";
  return "DN2";
}

export function certificateLabel(cert: MaterialCertificateRow) {
  return cert.file?.label?.trim() || cert.id;
}

export function buildCertificateSearchText(cert: MaterialCertificateRow) {
  const label = certificateLabel(cert).toLowerCase();
  const supplier = (cert.supplier ?? "").toLowerCase();
  const heat = (cert.heat_numbers ?? []).join(" ").toLowerCase();
  const materialName = (cert.material?.name ?? "").toLowerCase();
  const filler = (cert.filler_type ?? "").toLowerCase();
  return `${label} ${supplier} ${heat} ${materialName} ${filler}`.trim();
}

export function getFilteredCertificates(params: {
  type: TraceabilityTypeRow | null;
  certs: MaterialCertificateRow[];
  materialId: string | null;
  fillerType: string | null;
  query: string;
}): FilteredCertificatesResult {
  const { type, certs, materialId, fillerType, query } = params;

  if (!type) {
    return { list: [], reason: "Mangler sporbarhetstype." };
  }

  const targetType = type.use_filler_type ? "filler" : "material";
  let list = certs.filter((cert) => cert.certificate_type === targetType);

  if (type.use_filler_type) {
    if (!fillerType) return { list: [], reason: "Velg sveisetilsett-type først." };
    list = list.filter((cert) => (cert.filler_type ?? "") === fillerType);
  } else {
    if (!materialId) return { list: [], reason: "Velg material først." };
    list = list.filter((cert) => cert.material_id === materialId);
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery) {
    list = list.filter((cert) => buildCertificateSearchText(cert).includes(normalizedQuery));
  }

  return {
    list,
    reason: list.length === 0 ? "Ingen treff." : "",
  };
}

export function renderDimension(row: ProjectTraceabilityRow) {
  const parts: string[] = [];
  if (row.dn) parts.push(`DN${row.dn}`);
  if (row.dn2) parts.push(`DN${row.dn2}`);
  if (row.sch) parts.push(`SCH${row.sch}`);
  if (row.pressure_class) parts.push(String(row.pressure_class));
  if (row.thickness) parts.push(`${row.thickness} mm`);
  const useFillerType = Boolean(row.type?.use_filler_type || row.cert?.certificate_type === "filler");
  if (useFillerType && row.filler_type) parts.push(row.filler_type);
  return parts.join(" · ") || "—";
}

export function renderHeatLabel(row: ProjectTraceabilityRow) {
  const selected = (row.heat_number || "").trim();
  if (selected) return selected;
  if (!row.cert) return "Ikke valgt";
  const heat = (row.cert.heat_numbers ?? []).filter(Boolean).join(", ");
  return heat || "—";
}

export function statusForTraceabilityRow(row: ProjectTraceabilityRow): {
  tone: "success" | "warning" | "danger";
  label: string;
  openable: boolean;
  hint?: string;
} {
  if (row.material_certificate_id && row.cert?.file_id) {
    return { tone: "success", label: "Klar", openable: true };
  }
  if (!row.material_certificate_id && String(row.heat_number ?? "").trim()) {
    return {
      tone: "warning",
      label: "Manuell",
      openable: false,
      hint: "Manuell heat. Ikke koblet til sertifikat.",
    };
  }
  return { tone: "danger", label: "Mangel", openable: false };
}

export function sortedTraceabilityRows(rows: ProjectTraceabilityRow[]) {
  return [...rows].sort((a, b) => {
    const codeA = (a.type_code ?? "").toLowerCase();
    const codeB = (b.type_code ?? "").toLowerCase();
    const codeCompare = codeA.localeCompare(codeB, "nb", { numeric: true, sensitivity: "base" });
    if (codeCompare !== 0) return codeCompare;
    const idxA = a.code_index ?? 0;
    const idxB = b.code_index ?? 0;
    if (idxA !== idxB) return idxA - idxB;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function buildInitialValues(params: {
  row: ProjectTraceabilityRow | null;
  defaultType: TraceabilityTypeRow | null;
  optionsSch: TraceabilityOptionRow[];
  optionsPn: TraceabilityOptionRow[];
  optionsFiller: TraceabilityOptionRow[];
}): TraceabilityModalValues {
  const { row, defaultType, optionsSch, optionsPn, optionsFiller } = params;

  return {
    type_code: row?.type_code ?? defaultType?.code ?? "",
    dn: row?.dn ?? "",
    dn2: row?.dn2 ?? "",
    sch: row?.sch ?? defaultType?.default_sch ?? firstDefault(optionsSch),
    pressure_class: row?.pressure_class ?? defaultType?.default_pressure ?? firstDefault(optionsPn),
    thickness: row?.thickness ?? "",
    filler_type: row?.filler_type ?? firstDefault(optionsFiller),
    material_id: row?.material_id ?? row?.material?.id ?? "",
    material_certificate_id: row?.material_certificate_id ?? "",
    heat_number: row?.heat_number ?? "",
  };
}

export function normalizeSavePayload(
  values: TraceabilityModalValues,
  selectedMaterial: MaterialRow | null,
  selectedType: TraceabilityTypeRow | null
) {
  const isFiller = Boolean(selectedType?.use_filler_type);

  return {
    type_code: values.type_code,
    dn: values.dn.trim() || null,
    dn2: values.dn2.trim() || null,
    sch: values.sch.trim() || null,
    pressure_class: values.pressure_class.trim() || null,
    thickness: values.thickness.trim() || null,
    filler_type: isFiller ? values.filler_type.trim() || null : null,
    material_id: isFiller ? null : selectedMaterial?.id ?? null,
    material_certificate_id: values.material_certificate_id.trim() || null,
    heat_number: values.heat_number.trim() || null,
  };
}

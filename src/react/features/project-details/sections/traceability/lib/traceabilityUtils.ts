import type { MaterialCertificateRow } from "@/repo/materialCertificateRepo";
import type { MaterialRow } from "@/repo/materialRepo";
import type {
  ProjectTraceabilityRow,
  TraceabilityOptionRow,
  TraceabilityProfileFieldKey,
  TraceabilityProfileRow,
  TraceabilityTypeRow,
} from "@/repo/traceabilityRepo";
import type { FilteredCertificatesResult, TraceabilityModalValues } from "../types";

const PROFILE_FIELD_ORDER: TraceabilityProfileFieldKey[] = [
  "dn",
  "dn2",
  "od",
  "od2",
  "sch",
  "pressure_class",
  "thickness",
  "filler_manufacturer",
  "filler_type",
  "filler_diameter",
  "description",
  "custom_dimension",
];

function fieldOrder(fieldKey: TraceabilityProfileFieldKey) {
  const idx = PROFILE_FIELD_ORDER.indexOf(fieldKey);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function fieldValue(row: ProjectTraceabilityRow, key: TraceabilityProfileFieldKey) {
  if (key === "dn") return row.dn;
  if (key === "dn2") return row.dn2;
  if (key === "od") return row.od;
  if (key === "od2") return row.od2;
  if (key === "sch") return row.sch;
  if (key === "pressure_class") return row.pressure_class;
  if (key === "thickness") return row.thickness;
  if (key === "filler_manufacturer") return row.filler_manufacturer;
  if (key === "filler_type") return row.filler_type;
  if (key === "filler_diameter") return row.filler_diameter;
  if (key === "description") return row.description;
  return row.custom_dimension;
}

function normalizedOptionsMap(params: {
  dn: TraceabilityOptionRow[];
  od: TraceabilityOptionRow[];
  sch: TraceabilityOptionRow[];
  pn: TraceabilityOptionRow[];
  filler: TraceabilityOptionRow[];
  fillerManufacturer: TraceabilityOptionRow[];
  fillerDiameter: TraceabilityOptionRow[];
}) {
  return {
    dn: params.dn,
    od: params.od,
    sch: params.sch,
    pn: params.pn,
    filler_type: params.filler,
    filler_manufacturer: params.fillerManufacturer,
    filler_diameter: params.fillerDiameter,
  };
}

function fallbackOptionGroup(fieldKey: TraceabilityProfileFieldKey): string | null {
  if (fieldKey === "dn" || fieldKey === "dn2") return "dn";
  if (fieldKey === "od" || fieldKey === "od2") return "od";
  if (fieldKey === "sch") return "sch";
  if (fieldKey === "pressure_class") return "pn";
  if (fieldKey === "filler_manufacturer") return "filler_manufacturer";
  if (fieldKey === "filler_type") return "filler_type";
  if (fieldKey === "filler_diameter") return "filler_diameter";
  return null;
}

export function lookupType(types: TraceabilityTypeRow[], code: string | null | undefined) {
  if (!code) return null;
  return types.find((type) => type.code === code) ?? null;
}

export function lookupProfile(profiles: TraceabilityProfileRow[], id: string | null | undefined) {
  if (!id) return null;
  return profiles.find((profile) => profile.id === id) ?? null;
}

export function profilesForType(profiles: TraceabilityProfileRow[], typeCode: string | null | undefined) {
  if (!typeCode) return [];
  return profiles
    .filter((profile) => profile.type_code === typeCode && profile.is_active)
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.code.localeCompare(b.code, "nb", { sensitivity: "base", numeric: true });
    });
}

export function defaultProfileForType(profiles: TraceabilityProfileRow[], typeCode: string | null | undefined) {
  const list = profilesForType(profiles, typeCode);
  if (!list.length) return null;
  return list.find((profile) => profile.is_default) ?? list[0] ?? null;
}

export function sortedProfileFields(profile: TraceabilityProfileRow | null | undefined) {
  const fields = [...(profile?.fields ?? [])];
  return fields.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return fieldOrder(a.field_key) - fieldOrder(b.field_key);
  });
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

export function hasSchOrThickness(values: Pick<TraceabilityModalValues, "sch" | "thickness">) {
  return Boolean(values.sch.trim() || values.thickness.trim());
}

export function parseFillerTypeThickness(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*mm\b/i);
  if (!match) return "";
  return match[1] ?? "";
}

export function isFillerProfile(profile: TraceabilityProfileRow | null | undefined) {
  if (!profile) return false;
  if (profile.certificate_type === "filler") return true;
  return sortedProfileFields(profile).some((field) => field.field_key === "filler_type");
}

export function profileHasField(profile: TraceabilityProfileRow | null | undefined, fieldKey: TraceabilityProfileFieldKey) {
  return sortedProfileFields(profile).some((field) => field.field_key === fieldKey);
}

export function profileFieldRequired(profile: TraceabilityProfileRow | null | undefined, fieldKey: TraceabilityProfileFieldKey) {
  return Boolean(sortedProfileFields(profile).find((field) => field.field_key === fieldKey)?.required);
}

export function profileFieldLabel(profile: TraceabilityProfileRow | null | undefined, fieldKey: TraceabilityProfileFieldKey, fallbackLabel: string) {
  return sortedProfileFields(profile).find((field) => field.field_key === fieldKey)?.label?.trim() || fallbackLabel;
}

export function profileFieldOptionGroup(profile: TraceabilityProfileRow | null | undefined, fieldKey: TraceabilityProfileFieldKey) {
  const fromProfile = sortedProfileFields(profile).find((field) => field.field_key === fieldKey)?.option_group_key?.trim();
  if (fromProfile) return fromProfile;
  return fallbackOptionGroup(fieldKey);
}

export function profileFieldInputMode(profile: TraceabilityProfileRow | null | undefined, fieldKey: TraceabilityProfileFieldKey) {
  return sortedProfileFields(profile).find((field) => field.field_key === fieldKey)?.input_mode ?? "text";
}

export function optionRowsForField(params: {
  profile: TraceabilityProfileRow | null | undefined;
  fieldKey: TraceabilityProfileFieldKey;
  options: {
    dn: TraceabilityOptionRow[];
    od: TraceabilityOptionRow[];
    sch: TraceabilityOptionRow[];
    pn: TraceabilityOptionRow[];
    filler: TraceabilityOptionRow[];
    fillerManufacturer: TraceabilityOptionRow[];
    fillerDiameter: TraceabilityOptionRow[];
  };
}) {
  const { profile, fieldKey, options } = params;
  const byGroup = normalizedOptionsMap(options);
  const groupKey = profileFieldOptionGroup(profile, fieldKey);
  if (!groupKey) return [];
  const rows = byGroup[groupKey as keyof typeof byGroup] ?? [];
  return rows.map((row) => ({ value: row.value, label: row.value }));
}

export function certificateLabel(cert: MaterialCertificateRow) {
  return cert.file?.label?.trim() || cert.id;
}

export function buildCertificateSearchText(cert: MaterialCertificateRow) {
  const label = certificateLabel(cert).toLowerCase();
  const supplier = (cert.supplier ?? "").toLowerCase();
  const heat = (cert.heat_numbers ?? []).join(" ").toLowerCase();
  const materialName = (cert.material?.name ?? "").toLowerCase();
  const fillerManufacturer = (cert.filler_manufacturer ?? "").toLowerCase();
  const filler = (cert.filler_type ?? "").toLowerCase();
  const fillerDiameter = (cert.filler_diameter ?? "").toLowerCase();
  return `${label} ${supplier} ${heat} ${materialName} ${fillerManufacturer} ${filler} ${fillerDiameter}`.trim();
}

export function getFilteredCertificates(params: {
  profile: TraceabilityProfileRow | null;
  certs: MaterialCertificateRow[];
  materialId: string | null;
  fillerManufacturer: string | null;
  fillerType: string | null;
  fillerDiameter: string | null;
  query: string;
}): FilteredCertificatesResult {
  const { profile, certs, materialId, fillerManufacturer, fillerType, fillerDiameter, query } = params;

  if (!profile) {
    return { list: [], reason: "Mangler sporbarhetsprofil." };
  }

  const targetType = isFillerProfile(profile) ? "filler" : "material";
  let list = certs.filter((cert) => cert.certificate_type === targetType);

  if (targetType === "filler") {
    if (!fillerType) return { list: [], reason: "Velg sveisetilsett-type først." };
    list = list.filter((cert) => (cert.filler_type ?? "") === fillerType);
    if (fillerManufacturer) {
      list = list.filter((cert) => (cert.filler_manufacturer ?? "") === fillerManufacturer);
    }
    if (fillerDiameter) {
      list = list.filter((cert) => (cert.filler_diameter ?? "") === fillerDiameter);
    }
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

export function isFillerTraceabilityRow(row: ProjectTraceabilityRow) {
  if (row.profile?.certificate_type === "filler") return true;
  if (profileHasField(row.profile, "filler_type")) return true;
  if (row.cert?.certificate_type === "filler") return true;
  if (String(row.filler_type ?? "").trim()) return true;
  if (String(row.filler_manufacturer ?? "").trim()) return true;
  return Boolean(String(row.filler_diameter ?? "").trim());
}

function formatDimensionField(fieldKey: TraceabilityProfileFieldKey, value: string | null) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (fieldKey === "dn") return `DN${text}`;
  if (fieldKey === "dn2") return `DN${text}`;
  if (fieldKey === "od") return `OD${text}`;
  if (fieldKey === "od2") return `OD${text}`;
  if (fieldKey === "sch") return `SCH${text}`;
  if (fieldKey === "thickness") return `${text} mm`;
  if (fieldKey === "filler_diameter") return `${text} mm`;
  return text;
}

export function renderDimension(row: ProjectTraceabilityRow) {
  const parts: string[] = [];
  const profileFields = sortedProfileFields(row.profile);

  if (profileFields.length > 0) {
    profileFields.forEach((field) => {
      const formatted = formatDimensionField(field.field_key, fieldValue(row, field.field_key));
      if (formatted) parts.push(formatted);
    });
    return parts.join(" · ") || "—";
  }

  const fallbackOrder: TraceabilityProfileFieldKey[] = [
    "dn",
    "dn2",
    "od",
    "od2",
    "sch",
    "pressure_class",
    "thickness",
    "filler_manufacturer",
    "description",
    "filler_diameter",
    "custom_dimension",
  ];

  fallbackOrder.forEach((fieldKey) => {
    const formatted = formatDimensionField(fieldKey, fieldValue(row, fieldKey));
    if (formatted) parts.push(formatted);
  });

  if (isFillerTraceabilityRow(row) && row.filler_type) {
    if (!parts.includes(row.filler_type)) {
      parts.push(row.filler_type);
    }
  }

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
  defaultProfile: TraceabilityProfileRow | null;
  profiles: TraceabilityProfileRow[];
  options: {
    dn: TraceabilityOptionRow[];
    od: TraceabilityOptionRow[];
    sch: TraceabilityOptionRow[];
    pn: TraceabilityOptionRow[];
    filler: TraceabilityOptionRow[];
    fillerManufacturer: TraceabilityOptionRow[];
    fillerDiameter: TraceabilityOptionRow[];
  };
}): TraceabilityModalValues {
  const { row, defaultType, defaultProfile, profiles, options } = params;
  const byGroup = normalizedOptionsMap(options);
  const selectedProfile =
    row?.profile ??
    lookupProfile(profiles, row?.profile_id) ??
    defaultProfile ??
    defaultProfileForType(profiles, row?.type_code ?? defaultType?.code) ??
    null;

  const defaultForField = (fieldKey: TraceabilityProfileFieldKey, fallback = "") => {
    const field = sortedProfileFields(selectedProfile).find((item) => item.field_key === fieldKey);
    const explicitDefault = String(field?.default_value ?? "").trim();
    if (explicitDefault) return explicitDefault;
    const optionGroupKey = (field?.option_group_key ?? fallbackOptionGroup(fieldKey)) as keyof typeof byGroup | null;
    if (!optionGroupKey) return fallback;
    return firstDefault(byGroup[optionGroupKey] ?? [], fallback);
  };

  return {
    type_code: row?.type_code ?? defaultType?.code ?? selectedProfile?.type_code ?? "",
    profile_id: row?.profile_id ?? selectedProfile?.id ?? "",
    dn: row?.dn ?? defaultForField("dn"),
    dn2: row?.dn2 ?? defaultForField("dn2"),
    od: row?.od ?? defaultForField("od"),
    od2: row?.od2 ?? defaultForField("od2"),
    sch: row?.sch ?? defaultForField("sch", defaultType?.default_sch ?? firstDefault(options.sch)),
    pressure_class:
      row?.pressure_class ?? defaultForField("pressure_class", defaultType?.default_pressure ?? firstDefault(options.pn)),
    thickness: row?.thickness ?? defaultForField("thickness"),
    filler_manufacturer:
      row?.filler_manufacturer ?? defaultForField("filler_manufacturer", firstDefault(options.fillerManufacturer)),
    filler_type: row?.filler_type ?? defaultForField("filler_type", firstDefault(options.filler)),
    filler_diameter: row?.filler_diameter ?? defaultForField("filler_diameter", firstDefault(options.fillerDiameter)),
    description: row?.description ?? defaultForField("description"),
    custom_dimension: row?.custom_dimension ?? defaultForField("custom_dimension"),
    material_id: row?.material_id ?? row?.material?.id ?? "",
    material_certificate_id: row?.material_certificate_id ?? "",
    heat_number: row?.heat_number ?? "",
  };
}

export function normalizeSavePayload(
  values: TraceabilityModalValues,
  selectedMaterial: MaterialRow | null,
  selectedProfile: TraceabilityProfileRow | null
) {
  const isFiller = isFillerProfile(selectedProfile);
  const hasField = (fieldKey: TraceabilityProfileFieldKey) => profileHasField(selectedProfile, fieldKey);
  const clean = (value: string) => value.trim() || null;

  return {
    type_code: values.type_code,
    profile_id: values.profile_id.trim() || selectedProfile?.id || null,
    dn: hasField("dn") ? clean(values.dn) : null,
    dn2: hasField("dn2") ? clean(values.dn2) : null,
    od: hasField("od") ? clean(values.od) : null,
    od2: hasField("od2") ? clean(values.od2) : null,
    sch: hasField("sch") ? clean(values.sch) : null,
    pressure_class: hasField("pressure_class") ? clean(values.pressure_class) : null,
    thickness: hasField("thickness") ? clean(values.thickness) : null,
    filler_manufacturer: isFiller && hasField("filler_manufacturer") ? clean(values.filler_manufacturer) : null,
    filler_type: isFiller && hasField("filler_type") ? clean(values.filler_type) : null,
    filler_diameter: isFiller && hasField("filler_diameter") ? clean(values.filler_diameter) : null,
    description: hasField("description") ? clean(values.description) : null,
    custom_dimension: hasField("custom_dimension") ? clean(values.custom_dimension) : null,
    material_id: isFiller ? null : selectedMaterial?.id ?? null,
    material_certificate_id: clean(values.material_certificate_id),
    heat_number: clean(values.heat_number),
  };
}

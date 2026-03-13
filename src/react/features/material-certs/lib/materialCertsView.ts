import type { MaterialRow } from "@/repo/materialRepo";
import type { MaterialCertificateRow, MaterialCertificateType } from "@/repo/materialCertificateRepo";

export type SelectOption = {
  value: string;
  label: string;
};

export type MaterialCertPanelFilters = {
  materialId: string;
  fillerManufacturer: string;
  fillerType: string;
  fillerDiameter: string;
  supplier: string;
  query: string;
};

export const INITIAL_MATERIAL_CERT_FILTERS: MaterialCertPanelFilters = {
  materialId: "",
  fillerManufacturer: "",
  fillerType: "",
  fillerDiameter: "",
  supplier: "",
  query: "",
};

export const MATERIAL_CERT_TYPE_OPTIONS: SelectOption[] = [
  { value: "2.1", label: "2.1" },
  { value: "2.2", label: "2.2" },
  { value: "3.1", label: "3.1" },
  { value: "3.2", label: "3.2" },
];

export function trimOrEmpty(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export function normalizeHeat(value: string) {
  return value.trim();
}

export function parseHeatNumbers(value: string) {
  return normalizeHeatNumbers(
    value
      .split(/\n|,|;|\t/)
      .map((part) => normalizeHeat(part))
      .filter(Boolean)
  );
}

export function normalizeHeatNumbers(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeHeat(String(value ?? "")))
        .filter(Boolean)
    )
  );
}

export function heatNumbersToTags(values: string[] | null | undefined) {
  return normalizeHeatNumbers(values ?? []);
}

export function hasMaterialCertFilters(type: MaterialCertificateType, filters: MaterialCertPanelFilters) {
  return Boolean(
      filters.query ||
      filters.supplier ||
      (type === "material"
        ? filters.materialId
        : filters.fillerManufacturer || filters.fillerType || filters.fillerDiameter)
  );
}

export function formatMaterialCertCount(total: number, hasFilters: boolean) {
  return hasFilters ? `${total} treff` : `${total} stk`;
}

export function buildMaterialOptions(materials: MaterialRow[]): SelectOption[] {
  return materials.map((material) => ({
    value: material.id,
    label: material.name,
  }));
}

export function buildSimpleOptions(values: string[]): SelectOption[] {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

export function withCurrentOption(options: SelectOption[], value: string, fallbackLabel?: string) {
  const trimmed = trimOrEmpty(value);
  if (!trimmed || options.some((option) => option.value === trimmed)) {
    return options;
  }

  return [...options, { value: trimmed, label: fallbackLabel ?? trimmed }];
}

export function materialCertProductLabel(row: MaterialCertificateRow) {
  if (row.certificate_type === "filler") {
    return (
      [trimOrEmpty(row.filler_manufacturer), trimOrEmpty(row.filler_type), trimOrEmpty(row.filler_diameter)]
        .filter(Boolean)
        .join(" ")
        .trim() || "-"
    );
  }
  return trimOrEmpty(row.material?.name) || "-";
}

export function materialCertStatus(row: MaterialCertificateRow) {
  const hasSupplier = trimOrEmpty(row.supplier).length > 0;
  const hasHeat = (row.heat_numbers ?? []).some((value) => trimOrEmpty(value).length > 0);
  if (hasSupplier && hasHeat) {
    return { tone: "success" as const, label: "Klar" };
  }
  return { tone: "warning" as const, label: "Mangler data" };
}

export function materialCertFileTitle(row: Pick<MaterialCertificateRow, "file">) {
  return trimOrEmpty(row.file?.label).replace(/\.pdf$/i, "") || "Sertifikat";
}

import type { FileInboxRow } from "@/repo/fileInboxRepo";
import type { MaterialCertificateType } from "@/repo/materialCertificateRepo";
import { createUuid } from "@/utils/id";
import { normalizeHeatNumbers, parseHeatNumbers, trimOrEmpty } from "./materialCertsView";

export type MaterialCertUploadSource =
  | { kind: "local"; file: File }
  | { kind: "inbox"; inboxId: string; fileId: string; fileName: string };

export type MaterialCertUploadEntryDraft = {
  id: string;
  source: MaterialCertUploadSource;
  materialId: string;
  fillerType: string;
  supplier: string;
  heatNumbers: string[];
};

export type MaterialCertUploadDefaults = {
  materialId: string;
  fillerType: string;
  supplier: string;
};

function inferFileNameFromPath(input: string) {
  const normalized = input.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || input;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => readString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return parseHeatNumbers(value);
  }
  return [] as string[];
}

export function createUploadEntryFromFile(
  file: File,
  certificateType: MaterialCertificateType,
  defaults: MaterialCertUploadDefaults
): MaterialCertUploadEntryDraft {
  return {
    id: createUuid(),
    source: { kind: "local", file },
    materialId: certificateType === "material" ? defaults.materialId : "",
    fillerType: certificateType === "filler" ? defaults.fillerType : "",
    supplier: defaults.supplier,
    heatNumbers: [],
  };
}

export function mergeInboxUploadEntries(
  existingEntries: MaterialCertUploadEntryDraft[],
  rows: FileInboxRow[],
  certificateType: MaterialCertificateType,
  defaults: MaterialCertUploadDefaults
) {
  const existingInboxEntries = new Map<string, MaterialCertUploadEntryDraft>();
  for (const entry of existingEntries) {
    if (entry.source.kind === "inbox") {
      existingInboxEntries.set(entry.source.inboxId, entry);
    }
  }

  const localEntries = existingEntries.filter((entry) => entry.source.kind === "local");
  const inboxEntries = rows.map<MaterialCertUploadEntryDraft>((row) => {
    const current = existingInboxEntries.get(row.id);
    const meta =
      row.suggested_meta && typeof row.suggested_meta === "object"
        ? (row.suggested_meta as Record<string, unknown>)
        : {};

    const suggestedMaterialId = readString(meta.material_id);
    const suggestedFillerType = readString(meta.filler_type);
    const suggestedSupplier = readString(meta.supplier);
    const suggestedHeats = readStringArray(meta.heat_numbers);

    return {
      id: current?.id ?? `inbox:${row.id}`,
      source: {
        kind: "inbox",
        inboxId: row.id,
        fileId: row.file_id,
        fileName: trimOrEmpty(row.file?.label) || inferFileNameFromPath(row.source_path),
      },
      materialId:
        current?.materialId ??
        (certificateType === "material" ? suggestedMaterialId || defaults.materialId : ""),
      fillerType:
        current?.fillerType ??
        (certificateType === "filler" ? suggestedFillerType || defaults.fillerType : ""),
      supplier: current?.supplier ?? suggestedSupplier ?? defaults.supplier,
      heatNumbers: current?.heatNumbers ?? normalizeHeatNumbers(suggestedHeats),
    };
  });

  return [...localEntries, ...inboxEntries];
}

export function applyUploadDefaultsToEntries(
  entries: MaterialCertUploadEntryDraft[],
  certificateType: MaterialCertificateType,
  defaults: MaterialCertUploadDefaults
) {
  return entries.map((entry) => ({
    ...entry,
    materialId:
      certificateType === "material"
        ? defaults.materialId || entry.materialId
        : entry.materialId,
    fillerType:
      certificateType === "filler"
        ? defaults.fillerType || entry.fillerType
        : entry.fillerType,
    supplier: defaults.supplier || entry.supplier,
  }));
}

export function uploadEntryFileName(entry: MaterialCertUploadEntryDraft) {
  return entry.source.kind === "local" ? entry.source.file.name : entry.source.fileName;
}

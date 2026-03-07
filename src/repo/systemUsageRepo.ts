import { supabase } from "../services/supabaseClient";

export type SystemUsageTableStat = {
  tableName: string;
  rowEstimate: number;
  totalBytes: number;
};

export type SystemUsageStorageStat = {
  key: string;
  fileCount: number;
  totalBytes: number;
};

export type SystemUsageStats = {
  generatedAt: string | null;
  tableUsage: SystemUsageTableStat[];
  storage: {
    fileCount: number;
    totalBytes: number;
    bucketUsage: SystemUsageStorageStat[];
    typeUsage: SystemUsageStorageStat[];
  };
};

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseStorageUsage(raw: unknown, keyName: "bucket" | "type"): SystemUsageStorageStat[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;

      const keyRaw = row[keyName];
      const key = typeof keyRaw === "string" && keyRaw.trim() ? keyRaw.trim() : "ukjent";
      return {
        key,
        fileCount: asNumber(row.file_count),
        totalBytes: asNumber(row.total_bytes),
      } satisfies SystemUsageStorageStat;
    })
    .filter((row): row is SystemUsageStorageStat => row !== null)
    .sort((a, b) => b.totalBytes - a.totalBytes);
}

function parseSystemUsage(raw: unknown): SystemUsageStats {
  const root = asRecord(raw);
  if (!root) {
    throw new Error("Ugyldig svar fra get_system_usage_stats.");
  }

  const storageRaw = asRecord(root.storage);
  const generatedAtRaw = root.generated_at;
  const generatedAt = typeof generatedAtRaw === "string" && generatedAtRaw.length > 0 ? generatedAtRaw : null;

  const tableUsage = Array.isArray(root.table_usage)
    ? root.table_usage
        .map((item) => {
          const row = asRecord(item);
          if (!row) return null;

          const tableNameRaw = row.table_name;
          const tableName = typeof tableNameRaw === "string" && tableNameRaw.trim() ? tableNameRaw : "ukjent";
          return {
            tableName,
            rowEstimate: asNumber(row.row_estimate),
            totalBytes: asNumber(row.total_bytes),
          } satisfies SystemUsageTableStat;
        })
        .filter((row): row is SystemUsageTableStat => row !== null)
        .sort((a, b) => b.totalBytes - a.totalBytes)
    : [];

  return {
    generatedAt,
    tableUsage,
    storage: {
      fileCount: storageRaw ? asNumber(storageRaw.file_count) : 0,
      totalBytes: storageRaw ? asNumber(storageRaw.total_bytes) : 0,
      bucketUsage: storageRaw ? parseStorageUsage(storageRaw.bucket_usage, "bucket") : [],
      typeUsage: storageRaw ? parseStorageUsage(storageRaw.type_usage, "type") : [],
    },
  };
}

export async function fetchSystemUsageStats() {
  const { data, error } = await supabase.rpc("get_system_usage_stats");
  if (error) {
    if (error.code === "PGRST202") {
      throw new Error("Database-funksjon mangler: kjør nyeste Supabase-migreringer.");
    }
    throw new Error(error.message || "Kunne ikke hente systemstatistikk.");
  }

  return parseSystemUsage(data);
}

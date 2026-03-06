import type { NdtCertRow, WelderCertRow } from "@/repo/certRepo";

export type CertStatus = "ok" | "warn" | "fault";

export type SelectOption = {
  value: string;
  label: string;
};

export type WelderCertFilters = {
  welderId: string;
  material: string;
  jointType: string;
  status: "" | CertStatus;
  query: string;
};

export type NdtCertFilters = {
  company: string;
  method: string;
  status: "" | CertStatus;
  query: string;
};

const SOON_DAYS = 30;

export const CERT_STATUS_OPTIONS: SelectOption[] = [
  { value: "ok", label: "Gyldig" },
  { value: "warn", label: "Utløper snart" },
  { value: "fault", label: "Utløpt" },
];

export function isCertStatus(value: string): value is CertStatus {
  return value === "ok" || value === "warn" || value === "fault";
}

export function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function trimOrEmpty(value: string) {
  return value.trim();
}

export function trimOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const THICKNESS_INFINITE = "\u221E";
const THICKNESS_INFINITE_ALIASES = new Set([THICKNESS_INFINITE, "inf", "infinite", "ubegrenset"]);

function normalizeThicknessPart(raw: string) {
  const trimmed = trimOrEmpty(raw);
  if (!trimmed) return null;

  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(?:\.\d)?$/.test(normalized)) return null;
  return normalized.replace(".", ",");
}

function splitThicknessNote(raw: string) {
  const source = trimOrEmpty(raw);
  if (!source) return { base: "", note: "" };

  if (!source.endsWith(")")) return { base: source, note: "" };

  const noteStart = source.lastIndexOf("(");
  if (noteStart <= 0) return { base: source, note: "" };

  const base = trimOrEmpty(source.slice(0, noteStart));
  const note = trimOrEmpty(source.slice(noteStart + 1, -1)).replace(/\s+/g, " ");
  if (!base || !note) return { base: source, note: "" };
  return { base, note };
}

export function normalizeCoverageThicknessInput(value: string) {
  const { base, note } = splitThicknessNote(value);
  if (!base) return null;

  const cleanedBase = base.replace(/\s*mm$/i, "");
  if (!cleanedBase.includes("-")) return trimOrEmpty(value) || null;

  const [fromRaw = "", toRaw = ""] = cleanedBase.split("-", 2);
  const from = normalizeThicknessPart(fromRaw);
  if (!from) {
    throw new Error("Tykkelse fra må være et tall med maks 1 desimal (f.eks. 2,8).");
  }

  const toCandidate = trimOrEmpty(toRaw).toLowerCase();
  const toIsInfinite = THICKNESS_INFINITE_ALIASES.has(toCandidate);
  let normalizedBase = "";

  if (toIsInfinite) {
    normalizedBase = `${from}-${THICKNESS_INFINITE}`;
  } else {
    const to = normalizeThicknessPart(toRaw);
    if (!to) {
      throw new Error("Tykkelsesområde må være tall med maks 1 desimal (f.eks. 2,8-5,6).");
    }

    const fromNumber = Number(from.replace(",", "."));
    const toNumber = Number(to.replace(",", "."));
    if (fromNumber > toNumber) {
      throw new Error("Tykkelse fra kan ikke være større enn tykkelse til.");
    }

    normalizedBase = `${from}-${to}`;
  }

  return note ? `${normalizedBase} (${note})` : normalizedBase;
}

export function materialLabel(row: WelderCertRow) {
  if (!row.base_material) return "";
  return `${row.base_material.name} (${row.base_material.material_code}) - ${row.base_material.material_group}`;
}

export function getCertStatus(expiresAt: string | null): CertStatus {
  if (!expiresAt) return "ok";

  const expiresDate = new Date(`${expiresAt}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = expiresDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "fault";
  if (diffDays <= SOON_DAYS) return "warn";
  return "ok";
}

export function statusTone(status: CertStatus): "success" | "warning" | "danger" {
  if (status === "warn") return "warning";
  if (status === "fault") return "danger";
  return "success";
}

export function statusLabel(status: CertStatus) {
  if (status === "warn") return "Utløper snart";
  if (status === "fault") return "Utløpt";
  return "Gyldig";
}

export function welderGroupLabel(row: WelderCertRow) {
  const welderNoRaw = trimOrEmpty(row.profile?.welder_no ?? "");
  const welderNo = welderNoRaw ? welderNoRaw.padStart(3, "0") : "-";
  const displayName = trimOrEmpty(row.profile?.display_name ?? "Uten navn");
  return `${welderNo} - ${displayName}`;
}

export function groupWelderRows(rows: WelderCertRow[]) {
  const grouped = new Map<string, WelderCertRow[]>();
  for (const row of rows) {
    const key = welderGroupLabel(row);
    const current = grouped.get(key);
    if (current) current.push(row);
    else grouped.set(key, [row]);
  }

  return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], "nb", { sensitivity: "base" }));
}

export function groupNdtRows(rows: NdtCertRow[]) {
  const grouped = new Map<string, NdtCertRow[]>();
  for (const row of rows) {
    const key = trimOrEmpty(row.company || "Ukjent");
    const current = grouped.get(key);
    if (current) current.push(row);
    else grouped.set(key, [row]);
  }

  return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], "nb", { sensitivity: "base" }));
}

export function filterWelderRows(rows: WelderCertRow[], filters: WelderCertFilters) {
  return rows.filter((row) => {
    if (filters.welderId && row.profile_id !== filters.welderId) return false;
    if (filters.material && materialLabel(row) !== filters.material) return false;

    if (filters.jointType) {
      const joints = String(row.coverage_joint_type ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (!joints.includes(filters.jointType)) return false;
    }

    if (filters.status && getCertStatus(row.expires_at) !== filters.status) return false;

    const query = normalize(filters.query);
    if (query) {
      const searchText = [
        row.certificate_no,
        row.standard,
        row.welding_process_code ?? "",
        row.fm_group ?? "",
        row.coverage_joint_type ?? "",
        row.coverage_thickness ?? "",
        row.profile?.welder_no ?? "",
        row.profile?.display_name ?? "",
        materialLabel(row),
      ]
        .join(" ")
        .toLowerCase();
      if (!searchText.includes(query)) return false;
    }

    return true;
  });
}

export function filterNdtRows(rows: NdtCertRow[], filters: NdtCertFilters) {
  return rows.filter((row) => {
    if (filters.company && trimOrEmpty(row.company) !== filters.company) return false;
    if (filters.method && trimOrEmpty(row.ndt_method) !== filters.method) return false;
    if (filters.status && getCertStatus(row.expires_at) !== filters.status) return false;

    const query = normalize(filters.query);
    if (query) {
      const searchText = [row.certificate_no, row.ndt_method, row.personnel_name, row.company].join(" ").toLowerCase();
      if (!searchText.includes(query)) return false;
    }

    return true;
  });
}

export function formatCount(filtered: number, total: number, hasFilters: boolean) {
  return hasFilters ? `${filtered} av ${total} stk` : `${total} stk`;
}

export function parseWeldingProcessOption(row: { code: string | null; label: string }): SelectOption | null {
  let code = trimOrEmpty(row.code || "");
  let label = trimOrEmpty(row.label || "");

  if (!code) {
    const match = label.match(/^(\d{2,4})\s*-\s*(.+)$/);
    if (match) {
      code = trimOrEmpty(match[1]);
      label = trimOrEmpty(match[2]);
    } else if (/^\d{2,4}$/.test(label)) {
      code = label;
      label = "";
    }
  } else {
    label = label.replace(new RegExp(`^${code}\\s*-\\s*`, "i"), "").trim();
  }

  if (!code) return null;
  return { value: code, label: label ? `${code} - ${label}` : code };
}

export function buildWeldingProcessOptions(
  rows: Array<{ code: string | null; label: string }>,
  certRows: WelderCertRow[]
) {
  const byCode = new Map<string, SelectOption>();

  for (const row of rows) {
    const option = parseWeldingProcessOption(row);
    if (!option) continue;
    byCode.set(option.value, option);
  }

  for (const row of certRows) {
    const code = trimOrEmpty(row.welding_process_code ?? "");
    if (!code || byCode.has(code)) continue;
    byCode.set(code, { value: code, label: code });
  }

  return Array.from(byCode.values()).sort((a, b) => a.label.localeCompare(b.label, "nb", { sensitivity: "base" }));
}

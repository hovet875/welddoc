// src/pages/certs/state.ts
import type { ProfileWelderRow, WelderCertRow, NdtCertRow } from "../../repo/certRepo";
import type { StandardRow, StandardFmGroupRow } from "../../repo/standardRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import type { NdtMethodRow } from "../../repo/ndtReportRepo";

export type CertsPageState = {
  welders: ProfileWelderRow[];
  welderCerts: WelderCertRow[];
  ndtCerts: NdtCertRow[];
  standards: StandardRow[];
  fmGroups: StandardFmGroupRow[];
  materials: MaterialRow[];
  ndtMethods: NdtMethodRow[];
  loadSeq: number;
  loading: boolean;
  isAdmin: boolean;
};

export function createState(): CertsPageState {
  return {
    welders: [],
    welderCerts: [],
    ndtCerts: [],
    standards: [],
    fmGroups: [],
    materials: [],
    ndtMethods: [],
    loadSeq: 0,
    loading: false,
    isAdmin: false,
  };
}


export function groupByWelder(rows: WelderCertRow[]) {
  const m = new Map<string, WelderCertRow[]>();

  for (const r of rows) {
    const p = r.profile ?? null;
    const welderNo = p?.welder_no ?? null;
    const name = (p?.display_name || "Uten navn").trim();
    const no = welderNo == null ? "—" : String(welderNo).padStart(3, "0");
    const key = `${no} – ${name}`;

    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(r);
  }

  // sort groups by numeric welder no (admins will prefer this)
  const entries = [...m.entries()];
  entries.sort((a, b) => {
    const na = parseInt(a[0].slice(0, 3), 10);
    const nb = parseInt(b[0].slice(0, 3), 10);
    if (Number.isNaN(na) && Number.isNaN(nb)) return a[0].localeCompare(b[0]);
    if (Number.isNaN(na)) return 1;
    if (Number.isNaN(nb)) return -1;
    return na - nb;
  });

  return entries;
}

export function groupByCompany(rows: NdtCertRow[]) {
  const m = new Map<string, NdtCertRow[]>();
  for (const r of rows) {
    const key = (r.company || "Ukjent").trim();
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(r);
  }
  return [...m.entries()];
}

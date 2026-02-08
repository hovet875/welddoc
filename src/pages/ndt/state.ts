import type { ProfileWelderRow } from "../../repo/certRepo";
import type { ProjectRow } from "../../repo/projectRepo";
import type { CustomerRow } from "../../repo/customerRepo";
import type { NdtMethodRow, NdtReportRow } from "../../repo/ndtReportRepo";

export type NdtPageState = {
  reports: NdtReportRow[];
  methods: NdtMethodRow[];
  welders: ProfileWelderRow[];
  projects: ProjectRow[];
  customers: CustomerRow[];
  loadSeq: number;
  loading: boolean;
  isAdmin: boolean;
  page: number;
  pageSize: number;
};

export function createState(): NdtPageState {
  return {
    reports: [],
    methods: [],
    welders: [],
    projects: [],
    customers: [],
    loadSeq: 0,
    loading: false,
    isAdmin: false,
    page: 1,
    pageSize: 10,
  };
}

export function groupByMethod(rows: NdtReportRow[]) {
  const m = new Map<string, NdtReportRow[]>();
  for (const r of rows) {
    const key = (r.method?.label || r.method?.code || "Ukjent").trim();
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(r);
  }
  return [...m.entries()];
}

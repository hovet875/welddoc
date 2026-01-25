import type { WPQRRow, WPSRow } from "../../repo/wpsRepo";

export type WpsPageState = {
  wpqrAll: WPQRRow[];
  wpsAll: WPSRow[];
  loadSeq: number;
  loading: boolean;
};

export function createState(): WpsPageState {
  return {
    wpqrAll: [],
    wpsAll: [],
    loadSeq: 0,
    loading: false,
  };
}

/** grupper på prosess */
export function groupByProcess<T extends { process: string }>(rows: T[]) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const key = (r.process || "Ukjent").trim();
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(r);
  }
  return [...m.entries()];
}

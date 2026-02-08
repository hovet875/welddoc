import type { MaterialCertificateRow } from "../../repo/materialCertificateRepo";
import type { MaterialRow } from "../../repo/materialRepo";
import type { TraceabilityOptionRow } from "../../repo/traceabilityRepo";
import type { SupplierRow } from "../../repo/supplierRepo";

export type MaterialCertState = {
  rows: MaterialCertificateRow[];
  suppliers: SupplierRow[];
  materials: MaterialRow[];
  fillerOptions: TraceabilityOptionRow[];
  loadSeq: number;
  loading: boolean;
  isAdmin: boolean;
  pageByType: Record<"material" | "filler", number>;
  pageSize: number;
};

export function createState(): MaterialCertState {
  return {
    rows: [],
    suppliers: [],
    materials: [],
    fillerOptions: [],
    loadSeq: 0,
    loading: false,
    isAdmin: false,
    pageByType: {
      material: 1,
      filler: 1,
    },
    pageSize: 20,
  };
}

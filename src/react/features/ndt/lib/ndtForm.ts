import type { NdtMethodRow } from "@/repo/ndtReportRepo";
import type { NdtInspectorRow } from "@/repo/ndtSupplierRepo";
import { trimOrEmpty } from "./ndtView";

export type NdtWelderStatsDraft = Record<string, { weldCount: string; defectCount: string }>;

export type NdtReportFormDraft = {
  title: string;
  customer: string;
  reportDate: string;
  methodId: string;
  supplierId: string;
  inspectorId: string;
  welderIds: string[];
  welderStats: NdtWelderStatsDraft;
};

export type NdtReportPayloadDraft = {
  method_id: string;
  ndt_supplier_id: string | null;
  ndt_inspector_id: string | null;
  weld_count: number | null;
  defect_count: number | null;
  title: string;
  customer: string;
  report_date: string;
  welder_stats: Array<{ welder_id: string; weld_count: number | null; defect_count: number | null }>;
};

type BuildNdtReportPayloadOptions = {
  rtWelderRequiredMessage?: string;
  getWelderLabel?: (welderId: string) => string;
};

function parseNonNegativeNumber(value: string, fieldName: string) {
  const cleaned = trimOrEmpty(value);
  if (!cleaned) throw new Error(`Oppgi ${fieldName}.`);
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${fieldName} må være et tall >= 0.`);
  return parsed;
}

export function buildNdtReportPayload(
  draft: NdtReportFormDraft,
  methods: NdtMethodRow[],
  inspectors: NdtInspectorRow[],
  options?: BuildNdtReportPayloadOptions
): NdtReportPayloadDraft {
  const title = trimOrEmpty(draft.title);
  const customer = trimOrEmpty(draft.customer);
  const reportDate = trimOrEmpty(draft.reportDate);
  const methodId = trimOrEmpty(draft.methodId);
  const supplierId = trimOrEmpty(draft.supplierId) || null;
  const inspectorId = trimOrEmpty(draft.inspectorId) || null;

  if (!title || !customer || !reportDate) {
    throw new Error("Velg prosjektnr, kunde og dato.");
  }
  if (!methodId) throw new Error("Velg NDT-metode.");

  if ((supplierId == null) !== (inspectorId == null)) {
    throw new Error("Velg både NDT-firma og kontrollør, eller la begge stå tomme.");
  }
  if (supplierId && inspectorId) {
    const inspector = inspectors.find((row) => row.id === inspectorId) ?? null;
    if (!inspector || inspector.supplier_id !== supplierId) {
      throw new Error("Valgt kontrollør tilhører ikke valgt firma.");
    }
  }

  const method = methods.find((row) => row.id === methodId) ?? null;
  const isRtMethod = trimOrEmpty(method?.code).toUpperCase() === "RT";
  const getWelderLabel = options?.getWelderLabel ?? ((welderId: string) => welderId);

  let welderStats: Array<{ welder_id: string; weld_count: number | null; defect_count: number | null }> =
    draft.welderIds.map((welderId) => ({
      welder_id: welderId,
      weld_count: null,
      defect_count: null,
    }));

  if (isRtMethod) {
    if (draft.welderIds.length === 0) {
      throw new Error(options?.rtWelderRequiredMessage ?? "Velg minst en sveiser for RT.");
    }

    welderStats = draft.welderIds.map((welderId) => {
      const draftStats = draft.welderStats[welderId] ?? { weldCount: "", defectCount: "" };
      const welderLabel = getWelderLabel(welderId);

      return {
        welder_id: welderId,
        weld_count: parseNonNegativeNumber(draftStats.weldCount, `antall sveis for ${welderLabel}`),
        defect_count: parseNonNegativeNumber(draftStats.defectCount, `antall feil for ${welderLabel}`),
      };
    });

    const totalWelds = welderStats.reduce((sum, row) => sum + (row.weld_count ?? 0), 0);
    if (totalWelds <= 0) throw new Error("Antall sveis må være større enn 0 for RT.");
  }

  const weldCount = isRtMethod ? welderStats.reduce((sum, row) => sum + (row.weld_count ?? 0), 0) : null;
  const defectCount = isRtMethod ? welderStats.reduce((sum, row) => sum + (row.defect_count ?? 0), 0) : null;

  return {
    method_id: methodId,
    ndt_supplier_id: supplierId,
    ndt_inspector_id: inspectorId,
    weld_count: weldCount,
    defect_count: defectCount,
    title,
    customer,
    report_date: reportDate,
    welder_stats: welderStats,
  };
}

import type { ProfileWelderRow, WelderCertLookupRow } from "@/repo/certRepo";
import type { ProjectWeldRow } from "@/repo/weldLogRepo";
import type { ProjectTraceabilityRow } from "@/repo/traceabilityRepo";
import type { WelderCertScopeRow } from "@/repo/welderCertScopeRepo";
import type {
  WeldLogEditorValues,
  WeldLogNdtReportOption,
  WeldLogPrintStatusFilter,
  WeldLogStatusFilter,
  WeldLogTraceabilityOption,
  WeldLogWpsOption,
} from "../types";

export const VT_NO_REPORT_VALUE = "__VT_NO_REPORT__";

const normalizeText = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();
const normalizeJointType = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
const normalizeFmGroup = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
const normalizeStandard = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\((?:19|20)\d{2}\)\s*$/, "")
    .replace(/[:/-]\s*(?:19|20)\d{2}\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const extractStandardCore = (value: string | null | undefined) => {
  const normalized = normalizeStandard(value);
  if (!normalized) return "";
  const match = normalized.match(/\b(\d{3,5}\s*-\s*\d{1,3})\b/);
  if (!match) return "";
  return match[1].replace(/\s+/g, "");
};

const standardsMatch = (a: string | null | undefined, b: string | null | undefined) => {
  const leftCore = extractStandardCore(a);
  const rightCore = extractStandardCore(b);
  if (leftCore && rightCore) return leftCore === rightCore;

  const left = normalizeStandard(a);
  const right = normalizeStandard(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.replace(/\s+/g, "") === right.replace(/\s+/g, "");
};

const normalizeProcessCode = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const stripLeadingZeros = (code: string) => code.replace(/^0+(?=\d)/, "");
  const direct = raw.match(/^([0-9]{2,4})(?:\s*-\s*.*)?$/);
  if (direct) return stripLeadingZeros(direct[1]);

  const embedded = raw.match(/\b([0-9]{2,4})\b/);
  if (embedded) return stripLeadingZeros(embedded[1]);

  return raw.toUpperCase();
};

const parseDateOnly = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (!match) return null;
  const [, yyyy, mm, dd] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const certJointTypes = (coverageJointType: string | null | undefined) =>
  new Set(
    String(coverageJointType ?? "")
      .split(/[;,/]+/)
      .map((value) => normalizeJointType(value))
      .filter(Boolean)
  );

const isCertExpiredAt = (expiresAt: string | null | undefined, referenceDate: Date) => {
  const expires = parseDateOnly(expiresAt);
  if (!expires) return false;
  return expires.getTime() < referenceDate.getTime();
};

const componentMaterialIds = (
  componentOptions: WeldLogTraceabilityOption[],
  componentAId: string | null | undefined,
  componentBId: string | null | undefined
) =>
  new Set(
    [componentAId, componentBId]
      .map((id) => componentOptions.find((row) => row.id === id)?.material_id ?? null)
      .filter((id): id is string => Boolean(id))
  );

const certMatchesScope = (cert: WelderCertLookupRow, scope: WelderCertScopeRow) => {
  if (normalizeText(scope.standard?.label) && !standardsMatch(cert.standard, scope.standard?.label)) return false;
  if (
    normalizeProcessCode(scope.welding_process_code) &&
    normalizeProcessCode(cert.welding_process_code) !== normalizeProcessCode(scope.welding_process_code)
  ) {
    return false;
  }
  const scopeMaterialId = String(scope.material_id ?? "").trim();
  if (scopeMaterialId && String(cert.base_material_id ?? "").trim() !== scopeMaterialId) return false;
  const scopeJoint = normalizeJointType(scope.joint_type);
  if (scopeJoint) {
    const joints = certJointTypes(cert.coverage_joint_type);
    if (!joints.has(scopeJoint)) return false;
  }
  const scopeFmGroup = normalizeText(scope.fm_group?.label);
  if (scopeFmGroup && normalizeFmGroup(cert.fm_group) !== normalizeFmGroup(scope.fm_group?.label)) return false;
  return true;
};

const certMatchesDirectContext = (
  cert: WelderCertLookupRow,
  selectedWps: WeldLogWpsOption,
  processCode: string,
  jointType: string,
  materialIds: Set<string>
) => {
  if (!standardsMatch(cert.standard, selectedWps.standard_label)) return false;
  if (normalizeProcessCode(cert.welding_process_code) !== processCode) return false;
  const certMaterialId = String(cert.base_material_id ?? "").trim();
  if (certMaterialId && !materialIds.has(certMaterialId)) return false;
  const joints = certJointTypes(cert.coverage_joint_type);
  if (joints.size > 0 && !joints.has(jointType)) return false;
  return true;
};

export function resolveWelderCertForScope(input: {
  welderId: string;
  wpsId: string | null | undefined;
  jointType: string | null | undefined;
  componentAId: string | null | undefined;
  componentBId: string | null | undefined;
  weldDate: string | null | undefined;
  componentOptions: WeldLogTraceabilityOption[];
  welderCerts: WelderCertLookupRow[];
  welderScopes: WelderCertScopeRow[];
  wpsOptions: WeldLogWpsOption[];
}) {
  const welderId = String(input.welderId ?? "").trim();
  if (!welderId) return null;

  const wpsId = String(input.wpsId ?? "").trim();
  if (!wpsId) return null;
  const selectedWps = input.wpsOptions.find((row) => row.id === wpsId);
  if (!selectedWps) return null;

  const processCode = normalizeProcessCode(selectedWps.process);
  const jointType = normalizeJointType(input.jointType);
  const materialIds = componentMaterialIds(input.componentOptions, input.componentAId, input.componentBId);
  if (!processCode || !jointType || !materialIds.size) return null;

  const hasScopeConfig = input.welderScopes.length > 0;
  const matchingScopes = input.welderScopes.filter((scope) => {
    if (normalizeProcessCode(scope.welding_process_code) && normalizeProcessCode(scope.welding_process_code) !== processCode) return false;
    if (normalizeJointType(scope.joint_type) && normalizeJointType(scope.joint_type) !== jointType) return false;
    const scopeMaterialId = String(scope.material_id ?? "").trim();
    if (scopeMaterialId && !materialIds.has(scopeMaterialId)) return false;
    return true;
  });

  const referenceDate = parseDateOnly(input.weldDate) ?? parseDateOnly(new Date().toISOString()) ?? new Date();

  const candidates = input.welderCerts
    .filter((cert) => String(cert.profile_id ?? "").trim() === welderId)
    .filter((cert) => !isCertExpiredAt(cert.expires_at, referenceDate))
    .map((cert) => {
      const matchesScope = matchingScopes.length ? matchingScopes.filter((scope) => certMatchesScope(cert, scope)) : [];
      if (matchingScopes.length > 0 && matchesScope.length === 0) return null;
      if (matchingScopes.length === 0 && hasScopeConfig) return null;
      if (matchingScopes.length === 0 && !certMatchesDirectContext(cert, selectedWps, processCode, jointType, materialIds)) return null;

      const joints = certJointTypes(cert.coverage_joint_type);
      const fmGroup = normalizeText(cert.fm_group);
      const expiresAtTs = parseDateOnly(cert.expires_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const createdAtTs = Number(new Date(cert.created_at).getTime()) || 0;
      const bestScopeSpecificity = matchesScope.reduce((best, scope) => {
        let score = 0;
        if (normalizeText(scope.standard?.label)) score += 4;
        if (normalizeProcessCode(scope.welding_process_code)) score += 3;
        if (String(scope.material_id ?? "").trim()) score += 3;
        if (normalizeJointType(scope.joint_type)) score += 2;
        if (normalizeText(scope.fm_group?.label)) score += 2;
        return Math.max(best, score);
      }, 0);

      let score = 0;
      score += bestScopeSpecificity;
      if (String(cert.base_material_id ?? "").trim()) score += 3;
      if (joints.size > 0) score += 2;
      if (fmGroup && fmGroup !== "n/a") score += 1;

      return { cert, score, expiresAtTs, createdAtTs };
    })
    .filter((entry): entry is { cert: WelderCertLookupRow; score: number; expiresAtTs: number; createdAtTs: number } => Boolean(entry))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.expiresAtTs !== a.expiresAtTs) return b.expiresAtTs - a.expiresAtTs;
      if (b.createdAtTs !== a.createdAtTs) return b.createdAtTs - a.createdAtTs;
      return String(a.cert.certificate_no ?? "").localeCompare(String(b.cert.certificate_no ?? ""), "nb", {
        sensitivity: "base",
      });
    });

  return candidates[0]?.cert.id ?? null;
}

export function toTraceabilityOption(row: ProjectTraceabilityRow): WeldLogTraceabilityOption {
  const traceCode = `${row.type_code}${row.code_index ?? ""}`;
  const dn = String(row.dn ?? "").trim();
  const od = String(row.od ?? "").trim();
  const description = String(row.description ?? "").trim();
  const fillerDescriptor = [
    String(row.filler_manufacturer ?? "").trim(),
    String(row.filler_type ?? "").trim(),
    String(row.filler_diameter ?? "").trim() ? `${String(row.filler_diameter ?? "").trim()} mm` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const directHeat = String(row.heat_number ?? "").trim();
  const certHeat = String((row.cert?.heat_numbers ?? []).find((value) => String(value ?? "").trim()) ?? "").trim();
  const heat = directHeat || certHeat;
  const dimension = dn ? `DN${dn}` : od ? `OD${od}` : description || fillerDescriptor;

  return {
    id: row.id,
    trace_code: traceCode,
    material_id: row.material_id ?? null,
    dn: dn || null,
    heat_number: heat || null,
    label: [traceCode, dimension, heat].filter(Boolean).join(" - "),
  };
}

export function getWpsOptionsForContext(input: {
  jointType: string | null | undefined;
  componentAId: string | null | undefined;
  componentBId: string | null | undefined;
  componentOptions: WeldLogTraceabilityOption[];
  wpsOptions: WeldLogWpsOption[];
}) {
  const jointType = String(input.jointType ?? "").trim();
  const materialIds = componentMaterialIds(input.componentOptions, input.componentAId, input.componentBId);

  if (!jointType || !materialIds.size) {
    return [] as WeldLogWpsOption[];
  }

  return input.wpsOptions.filter(
    (row) => Boolean(row.material_id && materialIds.has(row.material_id)) && normalizeText(row.joint_type) === normalizeText(jointType)
  );
}

export function createEditorValues(row?: ProjectWeldRow | null): WeldLogEditorValues {
  return {
    id: row?.id ?? null,
    weld_no: row?.weld_no != null ? String(row.weld_no) : "",
    joint_type: row?.joint_type ?? "",
    component_a_id: row?.component_a_id ?? "",
    component_b_id: row?.component_b_id ?? "",
    welder_id: row?.welder_id ?? "",
    welder_cert_id: row?.welder_cert_id ?? "",
    wps_id: row?.wps_id ?? "",
    weld_date: row?.weld_date ?? "",
    filler_traceability_id: row?.filler_traceability_id ?? "",
    visual_report_id: row?.visual_report_id ?? "",
    visual_inspector: row?.visual_inspector ?? "",
    crack_report_id: row?.crack_report_id ?? "",
    volumetric_report_id: row?.volumetric_report_id ?? "",
    status: Boolean(row?.status),
  };
}

export function validateEditorValues(values: WeldLogEditorValues) {
  const errors: Record<string, string> = {};
  if (!String(values.weld_no).trim()) errors.weld_no = "Sveis ID er påkrevd.";
  if (!values.joint_type.trim()) errors.joint_type = "Fuge er påkrevd.";
  if (!values.welder_id.trim()) errors.welder_id = "Sveiser er påkrevd.";
  if (!values.weld_date.trim()) errors.weld_date = "Dato er påkrevd.";
  return errors;
}

export function normalizeDateInput(value: string) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function getWelderLabel(row: ProjectWeldRow, welders: ProfileWelderRow[]) {
  const no = String(row.welder?.welder_no ?? "").trim();
  const name = String(row.welder?.display_name ?? "").trim();
  const fromRow = [no, name].filter(Boolean).join(" - ");
  if (fromRow) return fromRow;

  const welderId = String(row.welder_id ?? "").trim();
  if (!welderId) return "—";
  const fromList = welders.find((item) => item.id === welderId);
  if (!fromList) return welderId;
  return [fromList.welder_no, fromList.display_name].filter(Boolean).join(" - ") || welderId;
}

export function formatNorDate(value: string | null | undefined) {
  if (!value) return "—";
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}.${mm}.${yyyy}`;
  }
  return raw;
}

export function reportMatchesField(field: "vt" | "pt" | "vol", report: WeldLogNdtReportOption) {
  const methodCode = String(report.method ?? "").trim().toUpperCase();
  if (field === "vt") return methodCode === "VT";
  if (field === "pt") return methodCode === "PT" || methodCode === "MT";
  return methodCode === "RT" || methodCode === "UT";
}

export function statusLabel(status: boolean | null | undefined) {
  return status ? "Godkjent" : "Til kontroll";
}

export function filterRowsByStatus(rows: ProjectWeldRow[], status: WeldLogStatusFilter | WeldLogPrintStatusFilter) {
  if (status === "ready") return rows.filter((row) => Boolean(row.status));
  if (status === "pending") return rows.filter((row) => !row.status);
  return rows;
}

export function sortRowsByWeldNo(rows: ProjectWeldRow[]) {
  return [...rows].sort((a, b) => {
    const aNo = Number(a.weld_no ?? Number.POSITIVE_INFINITY);
    const bNo = Number(b.weld_no ?? Number.POSITIVE_INFINITY);
    if (aNo !== bNo) return aNo - bNo;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function drawingLabel(drawingNo: string, revision: string | null | undefined) {
  const rev = String(revision ?? "-").trim().toUpperCase() || "-";
  return `${drawingNo} - Rev ${rev}`;
}

export function selectedDrawingLabel(input: { drawingId: string; drawingMap: Map<string, { drawing_no: string; revision: string | null }> }) {
  const drawing = input.drawingMap.get(input.drawingId);
  if (!drawing) return "-";
  return drawingLabel(drawing.drawing_no, drawing.revision);
}

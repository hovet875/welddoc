import type { NdtCertRow, WelderCertRow } from "@/repo/certRepo";
import type { NdtReportRow } from "@/repo/ndtReportRepo";
import type { ProjectTraceabilityRow } from "@/repo/traceabilityRepo";
import type { ProjectWeldRow } from "@/repo/weldLogRepo";
import type { WPSRow } from "@/repo/wpsRepo";

export function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function normalizeLookupKey(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function collectTraceabilityCertificateRefs(
  rows: ProjectTraceabilityRow[],
  certificateType: "material" | "filler"
) {
  const refs = new Map<string, { id: string; file_id: string | null; fileLabel: string | null }>();

  for (const row of rows) {
    const cert = row.cert;
    if (!cert || cert.certificate_type !== certificateType || !cert.id) continue;
    if (!refs.has(cert.id)) {
      refs.set(cert.id, {
        id: cert.id,
        file_id: cert.file_id ?? null,
        fileLabel: cert.file?.label ?? null,
      });
    }
  }

  return Array.from(refs.values());
}

export function collectProjectWpsRefs(welds: ProjectWeldRow[], wpsRows: WPSRow[]) {
  const wpsById = new Map(wpsRows.map((row) => [row.id, row]));
  const linkedRows: WPSRow[] = [];
  let unresolvedCount = 0;

  for (const wpsId of uniqueIds(welds.map((row) => row.wps_id))) {
    const row = wpsById.get(wpsId);
    if (!row) {
      unresolvedCount += 1;
      continue;
    }
    linkedRows.push(row);
  }

  return {
    rows: linkedRows,
    linkedCount: linkedRows.length,
    fileCount: linkedRows.filter((row) => Boolean(row.file_id)).length,
    unresolvedCount,
  };
}

export function collectProjectWpqrRefs(wpsRows: WPSRow[]) {
  const refs = new Map<string, { id: string; file_id: string | null; label: string }>();
  let unresolvedCount = 0;

  for (const row of wpsRows) {
    if (!row.wpqr?.id) {
      unresolvedCount += 1;
      continue;
    }
    if (!refs.has(row.wpqr.id)) {
      refs.set(row.wpqr.id, {
        id: row.wpqr.id,
        file_id: row.wpqr.file_id ?? null,
        label: String(row.wpqr.doc_no ?? "").trim() || row.wpqr.id,
      });
    }
  }

  const linkedRows = Array.from(refs.values());

  return {
    rows: linkedRows,
    linkedCount: linkedRows.length,
    fileCount: linkedRows.filter((row) => Boolean(row.file_id)).length,
    unresolvedCount,
  };
}

export function collectProjectNdtReportRefs(welds: ProjectWeldRow[]) {
  const refs = new Map<string, { id: string; file_id: string | null; label: string }>();

  for (const weld of welds) {
    for (const report of [weld.visual_report, weld.crack_report, weld.volumetric_report]) {
      if (!report?.id) continue;
      if (!refs.has(report.id)) {
        refs.set(report.id, {
          id: report.id,
          file_id: report.file_id ?? null,
          label: String(report.file?.label ?? report.id).trim() || report.id,
        });
      }
    }
  }

  const linkedRows = Array.from(refs.values());

  return {
    rows: linkedRows,
    linkedCount: linkedRows.length,
    fileCount: linkedRows.filter((row) => Boolean(row.file_id)).length,
  };
}

export function collectProjectWelderCertRefs(welds: ProjectWeldRow[], certRows: WelderCertRow[]) {
  const certById = new Map(certRows.map((row) => [row.id, row]));
  const linkedRows: Array<{ id: string; file_id: string | null; label: string }> = [];
  let unresolvedCount = 0;

  for (const certId of uniqueIds(welds.map((row) => row.welder_cert_id))) {
    const row = certById.get(certId);
    if (!row) {
      unresolvedCount += 1;
      continue;
    }
    linkedRows.push({
      id: row.id,
      file_id: row.file_id ?? null,
      label: String(row.certificate_no ?? row.id).trim() || row.id,
    });
  }

  return {
    rows: linkedRows,
    linkedCount: linkedRows.length,
    fileCount: linkedRows.filter((row) => Boolean(row.file_id)).length,
    unresolvedCount,
  };
}

export function collectProjectNdtPersonnelRefs(
  reportIds: string[],
  reportRows: NdtReportRow[],
  certRows: NdtCertRow[]
) {
  const reportIdSet = new Set(reportIds);
  const projectReports = reportRows.filter((row) => reportIdSet.has(row.id));
  const matchedCerts = new Map<string, { id: string; file_id: string | null; label: string }>();
  const inspectorKeys = new Set<string>();
  let unresolvedCount = 0;

  for (const report of projectReports) {
    const company = normalizeLookupKey(report.ndt_supplier?.name);
    const personnel = normalizeLookupKey(report.ndt_inspector?.name);

    if (!company || !personnel) {
      unresolvedCount += 1;
      continue;
    }

    const inspectorKey = `${company}|${personnel}`;
    if (inspectorKeys.has(inspectorKey)) continue;
    inspectorKeys.add(inspectorKey);

    const match = certRows.find(
      (row) =>
        normalizeLookupKey(row.company) === company &&
        normalizeLookupKey(row.personnel_name) === personnel
    );

    if (!match) {
      unresolvedCount += 1;
      continue;
    }

    if (!matchedCerts.has(match.id)) {
      matchedCerts.set(match.id, {
        id: match.id,
        file_id: match.file_id ?? null,
        label: String(match.certificate_no ?? match.id).trim() || match.id,
      });
    }
  }

  const certList = Array.from(matchedCerts.values());

  return {
    rows: certList,
    inspectorCount: inspectorKeys.size,
    linkedCount: certList.length,
    fileCount: certList.filter((row) => Boolean(row.file_id)).length,
    unresolvedCount,
  };
}
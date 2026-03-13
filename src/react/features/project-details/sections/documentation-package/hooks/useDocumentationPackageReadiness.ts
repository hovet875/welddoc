import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DOCUMENT_PACKAGE_CATALOG,
  type DocumentPackageCatalogEntry,
  type DocumentPackageDocumentKey,
} from "@/documents/package/documentPackageCatalog";
import { fetchCertData } from "@/repo/certRepo";
import { fetchNdtReports } from "@/repo/ndtReportRepo";
import { fetchProjectDrawings } from "@/repo/projectDrawingRepo";
import { fetchProjectPressureTest } from "@/repo/projectPressureTestRepo";
import { fetchProjectWorkOrder } from "@/repo/projectWorkOrderRepo";
import { fetchProjectTraceability } from "@/repo/traceabilityRepo";
import { fetchProjectWelds } from "@/repo/weldLogRepo";
import { fetchWpsData } from "@/repo/wpsRepo";
import {
  collectProjectNdtPersonnelRefs,
  collectProjectNdtReportRefs,
  collectProjectWelderCertRefs,
  collectProjectWpsRefs,
  collectProjectWpqrRefs,
  collectTraceabilityCertificateRefs,
} from "../lib/documentPackageData";

export type DocumentationPackageReadinessState = "ready" | "partial" | "missing" | "pending";

export type DocumentationPackageReadinessItem = {
  definition: DocumentPackageCatalogEntry;
  readiness: DocumentationPackageReadinessState;
  summary: string;
};

type DocumentationPackageReadinessSnapshot = {
  items: DocumentationPackageReadinessItem[];
  readyCount: number;
  partialCount: number;
  implementedCount: number;
};

type DocumentationPackageReadinessStateValue = {
  loading: boolean;
  error: string | null;
  snapshot: DocumentationPackageReadinessSnapshot;
};

const EMPTY_SNAPSHOT: DocumentationPackageReadinessSnapshot = {
  items: [],
  readyCount: 0,
  partialCount: 0,
  implementedCount: 0,
};

const INITIAL_STATE: DocumentationPackageReadinessStateValue = {
  loading: true,
  error: null,
  snapshot: EMPTY_SNAPSHOT,
};

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function readinessForEntry(input: {
  definition: DocumentPackageCatalogEntry;
  workOrderPresent: boolean;
  workOrderLabel: string;
  drawingCount: number;
  drawingPdfCount: number;
  traceabilityRowCount: number;
  weldLogCount: number;
  weldRowCount: number;
  materialCertCount: number;
  materialCertPdfCount: number;
  fillerCertCount: number;
  fillerCertPdfCount: number;
  wpsCount: number;
  wpsPdfCount: number;
  unresolvedWpsCount: number;
  wpqrCount: number;
  wpqrPdfCount: number;
  unresolvedWpqrCount: number;
  welderCertCount: number;
  welderCertPdfCount: number;
  unresolvedWelderCertCount: number;
  ndtReportCount: number;
  ndtReportPdfCount: number;
  ndtPersonnelCount: number;
  ndtPersonnelPdfCount: number;
  unresolvedNdtPersonnelCount: number;
  pressureTestPresent: boolean;
  pressureTestRowCount: number;
  calibrationCertPresent: boolean;
}): DocumentationPackageReadinessItem {
  const {
    definition,
    workOrderPresent,
    workOrderLabel,
    drawingCount,
    drawingPdfCount,
    traceabilityRowCount,
    weldLogCount,
    weldRowCount,
    materialCertCount,
    materialCertPdfCount,
    fillerCertCount,
    fillerCertPdfCount,
    wpsCount,
    wpsPdfCount,
    unresolvedWpsCount,
    wpqrCount,
    wpqrPdfCount,
    unresolvedWpqrCount,
    welderCertCount,
    welderCertPdfCount,
    unresolvedWelderCertCount,
    ndtReportCount,
    ndtReportPdfCount,
    ndtPersonnelCount,
    ndtPersonnelPdfCount,
    unresolvedNdtPersonnelCount,
    pressureTestPresent,
    pressureTestRowCount,
    calibrationCertPresent,
  } = input;

  const byKey: Record<DocumentPackageDocumentKey, DocumentationPackageReadinessItem> = {
    package_main_pdf: {
      definition,
      readiness:
        traceabilityRowCount > 0 && weldRowCount > 0
          ? "ready"
          : traceabilityRowCount > 0 || weldRowCount > 0 || pressureTestPresent
            ? "partial"
            : "pending",
      summary:
        traceabilityRowCount > 0 && weldRowCount > 0
          ? `HOVEDPDF kan forhåndsvises med forside, innholdsoversikt, ${traceabilityRowCount} sporbarhetsrad${traceabilityRowCount === 1 ? "" : "er"} og ${weldRowCount} sveis${weldRowCount === 1 ? "" : "er"}. Trykktest legges til senere.`
          : traceabilityRowCount > 0 || weldRowCount > 0
            ? `HOVEDPDF kan forhåndsvises allerede nå, men er delvis komplett: ${traceabilityRowCount} sporbarhetsrad${traceabilityRowCount === 1 ? "" : "er"} og ${weldRowCount} sveis${weldRowCount === 1 ? "" : "er"}. Trykktest legges til senere.`
            : pressureTestPresent
              ? `Trykktestdata finnes (${pressureTestRowCount} rad${pressureTestRowCount === 1 ? "" : "er"}), men HOVEDPDF mangler fortsatt sporbarhet eller sveiselogggrunnlag.`
              : "HOVEDPDF kan nå bygges med forside, innholdsoversikt, materialsporbarhetsliste og sveiselogg. Trykktest legges til senere.",
    },
    project_work_order: {
      definition,
      readiness: workOrderPresent ? "ready" : "missing",
      summary: workOrderPresent ? `Arbeidsordre klar: ${workOrderLabel}.` : "Ingen arbeidsordre er koblet til prosjektet ennå.",
    },
    project_drawings: {
      definition,
      readiness:
        drawingCount === 0 ? "missing" : drawingPdfCount === 0 ? "missing" : drawingPdfCount < drawingCount ? "partial" : "ready",
      summary:
        drawingCount === 0
          ? "Ingen tegninger opprettet ennå."
          : drawingPdfCount === 0
            ? `Ingen tegningsrader har PDF ennå (${drawingCount} opprettet).`
            : drawingPdfCount < drawingCount
              ? `${drawingPdfCount} av ${drawingCount} tegningsrader har PDF.`
              : `Alle ${drawingCount} tegninger har PDF og er klare som kildedokumenter.`,
    },
    material_certificates: {
      definition,
      readiness:
        materialCertCount === 0 ? "missing" : materialCertPdfCount < materialCertCount ? "partial" : "ready",
      summary:
        materialCertCount === 0
          ? "Ingen materialsertifikater er koblet til prosjektets sporbarhet ennå."
          : materialCertPdfCount < materialCertCount
            ? `${materialCertPdfCount} av ${materialCertCount} prosjektknyttede materialsertifikater har PDF.`
            : `Alle ${materialCertCount} prosjektknyttede materialsertifikater har PDF og kan pakkes i ZIP.`,
    },
    filler_certificates: {
      definition,
      readiness:
        fillerCertCount === 0 ? "missing" : fillerCertPdfCount < fillerCertCount ? "partial" : "ready",
      summary:
        fillerCertCount === 0
          ? "Ingen sveisetilsettsertifikater er koblet til prosjektets sporbarhet ennå."
          : fillerCertPdfCount < fillerCertCount
            ? `${fillerCertPdfCount} av ${fillerCertCount} prosjektknyttede sveisetilsettsertifikater har PDF.`
            : `Alle ${fillerCertCount} prosjektknyttede sveisetilsettsertifikater har PDF og kan pakkes i ZIP.`,
    },
    wps_wpqr_documents: {
      definition,
      readiness:
        wpsCount === 0 && wpqrCount === 0
          ? "missing"
          : unresolvedWpsCount > 0 || unresolvedWpqrCount > 0 || wpsPdfCount < wpsCount || wpqrPdfCount < wpqrCount
            ? "partial"
            : "ready",
      summary:
        wpsCount === 0 && wpqrCount === 0
          ? weldRowCount > 0
            ? `Ingen WPS eller WPQR er koblet til prosjektets ${weldRowCount} sveis${weldRowCount === 1 ? "" : "er"} ennå.`
            : "Ingen WPS eller WPQR er koblet til prosjektets sveiselogg ennå."
          : `WPS: ${wpsPdfCount} av ${wpsCount} PDF. WPQR: ${wpqrPdfCount} av ${wpqrCount} PDF.${unresolvedWpsCount > 0 ? ` ${unresolvedWpsCount} WPS-referanse${unresolvedWpsCount === 1 ? "" : "r"} mangler fortsatt oppslag.` : ""}${unresolvedWpqrCount > 0 ? ` ${unresolvedWpqrCount} brukt WPS mangler fortsatt WPQR-kobling.` : ""}`,
    },
    welder_certificates: {
      definition,
      readiness:
        welderCertCount === 0
          ? "missing"
          : unresolvedWelderCertCount > 0 || welderCertPdfCount < welderCertCount
            ? "partial"
            : "ready",
      summary:
        welderCertCount === 0
          ? weldLogCount > 0
            ? `Ingen sveisesertifikater er koblet til prosjektets ${weldLogCount} weld logg${weldLogCount === 1 ? "" : "er"} ennå.`
            : "Ingen sveisesertifikater er koblet til prosjektet ennå."
          : unresolvedWelderCertCount > 0 || welderCertPdfCount < welderCertCount
            ? `${welderCertPdfCount} av ${welderCertCount} prosjektknyttede sveisesertifikater har PDF.${unresolvedWelderCertCount > 0 ? ` ${unresolvedWelderCertCount} sertifikatreferanse${unresolvedWelderCertCount === 1 ? "" : "r"} mangler fortsatt oppslag.` : ""}`
            : `Alle ${welderCertCount} prosjektknyttede sveisesertifikater har PDF og kan pakkes i ZIP.`,
    },
    ndt_documents: {
      definition,
      readiness:
        ndtReportCount === 0
          ? "missing"
          : ndtReportPdfCount < ndtReportCount || unresolvedNdtPersonnelCount > 0 || ndtPersonnelPdfCount < ndtPersonnelCount
            ? "partial"
            : "ready",
      summary:
        ndtReportCount === 0
          ? weldLogCount > 0
            ? `Ingen NDT-dokumenter er koblet til prosjektets ${weldLogCount} weld logg${weldLogCount === 1 ? "" : "er"} ennå.`
            : "Ingen NDT-dokumenter er koblet til prosjektet ennå."
          : `Rapporter: ${ndtReportPdfCount} av ${ndtReportCount} PDF. Personellsertifikater: ${ndtPersonnelPdfCount} av ${ndtPersonnelCount} PDF.${unresolvedNdtPersonnelCount > 0 ? ` ${unresolvedNdtPersonnelCount} inspektor${unresolvedNdtPersonnelCount === 1 ? "" : "er"} mangler fortsatt sikker sertifikatkobling.` : ""}`,
    },
    calibration_certificates: {
      definition,
      readiness: calibrationCertPresent ? "ready" : pressureTestPresent ? "partial" : "pending",
      summary: calibrationCertPresent
        ? "Kalibreringssertifikat er koblet til trykktest og kan pakkes i ZIP."
        : pressureTestPresent
          ? "Trykktestdata finnes, men kalibreringssertifikat er ikke koblet ennå."
          : "Trykktest er ikke klart ennå, sa kalibreringssertifikater kan kobles senere.",
    },
  };

  return byKey[definition.key];
}

function buildSnapshot(input: {
  workOrderPresent: boolean;
  workOrderLabel: string;
  drawingCount: number;
  drawingPdfCount: number;
  traceabilityRowCount: number;
  weldLogCount: number;
  weldRowCount: number;
  materialCertCount: number;
  materialCertPdfCount: number;
  fillerCertCount: number;
  fillerCertPdfCount: number;
  wpsCount: number;
  wpsPdfCount: number;
  unresolvedWpsCount: number;
  wpqrCount: number;
  wpqrPdfCount: number;
  unresolvedWpqrCount: number;
  welderCertCount: number;
  welderCertPdfCount: number;
  unresolvedWelderCertCount: number;
  ndtReportCount: number;
  ndtReportPdfCount: number;
  ndtPersonnelCount: number;
  ndtPersonnelPdfCount: number;
  unresolvedNdtPersonnelCount: number;
  pressureTestPresent: boolean;
  pressureTestRowCount: number;
  calibrationCertPresent: boolean;
}): DocumentationPackageReadinessSnapshot {
  const items = DOCUMENT_PACKAGE_CATALOG.map((definition) =>
    readinessForEntry({
      definition,
      workOrderPresent: input.workOrderPresent,
      workOrderLabel: input.workOrderLabel,
      drawingCount: input.drawingCount,
      drawingPdfCount: input.drawingPdfCount,
      traceabilityRowCount: input.traceabilityRowCount,
      weldLogCount: input.weldLogCount,
      weldRowCount: input.weldRowCount,
      materialCertCount: input.materialCertCount,
      materialCertPdfCount: input.materialCertPdfCount,
      fillerCertCount: input.fillerCertCount,
      fillerCertPdfCount: input.fillerCertPdfCount,
      wpsCount: input.wpsCount,
      wpsPdfCount: input.wpsPdfCount,
      unresolvedWpsCount: input.unresolvedWpsCount,
      wpqrCount: input.wpqrCount,
      wpqrPdfCount: input.wpqrPdfCount,
      unresolvedWpqrCount: input.unresolvedWpqrCount,
      welderCertCount: input.welderCertCount,
      welderCertPdfCount: input.welderCertPdfCount,
      unresolvedWelderCertCount: input.unresolvedWelderCertCount,
      ndtReportCount: input.ndtReportCount,
      ndtReportPdfCount: input.ndtReportPdfCount,
      ndtPersonnelCount: input.ndtPersonnelCount,
      ndtPersonnelPdfCount: input.ndtPersonnelPdfCount,
      unresolvedNdtPersonnelCount: input.unresolvedNdtPersonnelCount,
      pressureTestPresent: input.pressureTestPresent,
      pressureTestRowCount: input.pressureTestRowCount,
      calibrationCertPresent: input.calibrationCertPresent,
    })
  );

  const implementedItems = items.filter((item) => item.definition.implementation === "available");

  return {
    items,
    readyCount: implementedItems.filter((item) => item.readiness === "ready").length,
    partialCount: implementedItems.filter((item) => item.readiness === "partial").length,
    implementedCount: implementedItems.length,
  };
}

export function useDocumentationPackageReadiness(projectId: string) {
  const [state, setState] = useState<DocumentationPackageReadinessStateValue>(INITIAL_STATE);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [workOrder, drawings, traceabilityRows, weldData, wpsData, certData, ndtReports, pressureTest] = await Promise.all([
        fetchProjectWorkOrder(projectId),
        fetchProjectDrawings(projectId),
        fetchProjectTraceability(projectId),
        fetchProjectWelds(projectId),
        fetchWpsData(),
        fetchCertData(),
        fetchNdtReports(),
        fetchProjectPressureTest(projectId),
      ]);

      if (requestId !== requestRef.current) return;

      const drawingPdfCount = drawings.filter((row) => Boolean(row.file_id)).length;
      const materialCertRefs = collectTraceabilityCertificateRefs(traceabilityRows, "material");
      const fillerCertRefs = collectTraceabilityCertificateRefs(traceabilityRows, "filler");
      const wpsRefs = collectProjectWpsRefs(weldData.welds, wpsData.wps);
      const wpqrRefs = collectProjectWpqrRefs(wpsRefs.rows);
      const ndtReportRefs = collectProjectNdtReportRefs(weldData.welds);
      const welderCertRefs = collectProjectWelderCertRefs(weldData.welds, certData.welderCerts);
      const ndtPersonnelRefs = collectProjectNdtPersonnelRefs(
        weldData.welds
          .flatMap((row) => [row.visual_report?.id, row.crack_report?.id, row.volumetric_report?.id])
          .filter((value): value is string => Boolean(value)),
        ndtReports,
        certData.ndtCerts
      );
      const pressureTestPresent = Boolean(pressureTest.meta) || pressureTest.rows.length > 0;

      const snapshot = buildSnapshot({
        workOrderPresent: Boolean(workOrder?.file_id),
        workOrderLabel: workOrder?.file?.label || "Arbeidsordre",
        drawingCount: drawings.length,
        drawingPdfCount,
        traceabilityRowCount: traceabilityRows.length,
        weldLogCount: weldData.logs.length,
        weldRowCount: weldData.welds.length,
        materialCertCount: materialCertRefs.length,
        materialCertPdfCount: materialCertRefs.filter((row) => Boolean(row.file_id)).length,
        fillerCertCount: fillerCertRefs.length,
        fillerCertPdfCount: fillerCertRefs.filter((row) => Boolean(row.file_id)).length,
        wpsCount: wpsRefs.linkedCount,
        wpsPdfCount: wpsRefs.fileCount,
        unresolvedWpsCount: wpsRefs.unresolvedCount,
        wpqrCount: wpqrRefs.linkedCount,
        wpqrPdfCount: wpqrRefs.fileCount,
        unresolvedWpqrCount: wpqrRefs.unresolvedCount,
        welderCertCount: welderCertRefs.linkedCount,
        welderCertPdfCount: welderCertRefs.fileCount,
        unresolvedWelderCertCount: welderCertRefs.unresolvedCount,
        ndtReportCount: ndtReportRefs.linkedCount,
        ndtReportPdfCount: ndtReportRefs.fileCount,
        ndtPersonnelCount: ndtPersonnelRefs.linkedCount,
        ndtPersonnelPdfCount: ndtPersonnelRefs.fileCount,
        unresolvedNdtPersonnelCount: ndtPersonnelRefs.unresolvedCount,
        pressureTestPresent,
        pressureTestRowCount: pressureTest.rows.length,
        calibrationCertPresent: Boolean(pressureTest.meta?.gauge_cert_file_id),
      });

      setState({
        loading: false,
        error: null,
        snapshot,
      });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setState({
        loading: false,
        error: readErrorMessage(error, "Kunne ikke laste package-status."),
        snapshot: EMPTY_SNAPSHOT,
      });
    }
  }, [projectId]);

  useEffect(() => {
    void reload();

    return () => {
      requestRef.current += 1;
    };
  }, [reload]);

  const value = useMemo(
    () => ({
      ...state,
      reload,
    }),
    [reload, state]
  );

  return value;
}

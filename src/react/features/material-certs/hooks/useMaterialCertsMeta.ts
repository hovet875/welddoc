import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMaterialCertificateFillerDiameters,
  fetchMaterialCertificateFillerManufacturers,
  fetchMaterialCertificateFillerTypes,
  fetchMaterialCertificateSupplierNames,
} from "@/repo/materialCertificateRepo";
import { fetchMaterials, type MaterialRow } from "@/repo/materialRepo";
import { countNewFileInboxByTarget } from "@/repo/fileInboxRepo";
import { fetchSuppliers, type SupplierRow } from "@/repo/supplierRepo";
import { fetchTraceabilityOptions, type TraceabilityOptionRow } from "@/repo/traceabilityRepo";

type MaterialCertsMetaState = {
  materials: MaterialRow[];
  suppliers: SupplierRow[];
  supplierNames: string[];
  fillerOptions: TraceabilityOptionRow[];
  fillerTypeNames: string[];
  fillerManufacturerOptions: TraceabilityOptionRow[];
  fillerManufacturerNames: string[];
  fillerDiameterOptions: TraceabilityOptionRow[];
  fillerDiameterNames: string[];
  inboxNewCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

type MaterialCertsMetaResult = MaterialCertsMetaState & {
  reload: () => Promise<void>;
};

const INITIAL_STATE: MaterialCertsMetaState = {
  materials: [],
  suppliers: [],
  supplierNames: [],
  fillerOptions: [],
  fillerTypeNames: [],
  fillerManufacturerOptions: [],
  fillerManufacturerNames: [],
  fillerDiameterOptions: [],
  fillerDiameterNames: [],
  inboxNewCount: 0,
  loading: true,
  refreshing: false,
  error: null,
};

function readErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return "Kunne ikke hente metadata for materialsertifikater.";
}

export function useMaterialCertsMeta(isAdmin: boolean): MaterialCertsMetaResult {
  const [state, setState] = useState<MaterialCertsMetaState>(INITIAL_STATE);
  const loadSeqRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const isInitialLoad = !hasLoadedRef.current;

    setState((prev) => ({
      ...prev,
      loading: isInitialLoad,
      refreshing: !isInitialLoad,
      error: null,
    }));

    try {
      const [
        materials,
        suppliers,
        certSupplierNames,
        fillerOptions,
        fillerManufacturerOptions,
        fillerDiameterOptions,
        fillerTypeNames,
        fillerManufacturerNames,
        fillerDiameterNames,
        inboxNewCount,
      ] = await Promise.all([
        fetchMaterials({ includeInactive: true }),
        fetchSuppliers({ includeInactive: true }),
        fetchMaterialCertificateSupplierNames(),
        fetchTraceabilityOptions("filler_type"),
        fetchTraceabilityOptions("filler_manufacturer"),
        fetchTraceabilityOptions("filler_diameter"),
        fetchMaterialCertificateFillerTypes(),
        fetchMaterialCertificateFillerManufacturers(),
        fetchMaterialCertificateFillerDiameters(),
        isAdmin ? countNewFileInboxByTarget("material_certificate") : Promise.resolve(0),
      ]);

      if (seq !== loadSeqRef.current) return;

      const supplierNames = Array.from(
        new Set([...suppliers.map((row) => row.name.trim()).filter(Boolean), ...certSupplierNames])
      ).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));

      const fillerNames = Array.from(
        new Set([...fillerOptions.map((row) => row.value.trim()).filter(Boolean), ...fillerTypeNames])
      ).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
      const fillerManufacturerValues = Array.from(
        new Set([...fillerManufacturerOptions.map((row) => row.value.trim()).filter(Boolean), ...fillerManufacturerNames])
      ).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }));
      const fillerDiameterValues = Array.from(
        new Set([...fillerDiameterOptions.map((row) => row.value.trim()).filter(Boolean), ...fillerDiameterNames])
      ).sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base", numeric: true }));

      hasLoadedRef.current = true;
      setState({
        materials,
        suppliers,
        supplierNames,
        fillerOptions,
        fillerTypeNames: fillerNames,
        fillerManufacturerOptions,
        fillerManufacturerNames: fillerManufacturerValues,
        fillerDiameterOptions,
        fillerDiameterNames: fillerDiameterValues,
        inboxNewCount,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (err) {
      if (seq !== loadSeqRef.current) return;

      hasLoadedRef.current = true;
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: readErrorMessage(err),
      }));
    }
  }, [isAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    ...state,
    reload,
  };
}

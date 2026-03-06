import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCertData, type NdtCertRow, type ProfileWelderRow, type WelderCertRow } from "@/repo/certRepo";
import { fetchMaterials, type MaterialRow } from "@/repo/materialRepo";
import { fetchNdtMethods, type NdtMethodRow } from "@/repo/ndtReportRepo";
import { fetchNdtInspectors, fetchNdtSuppliers, type NdtInspectorRow, type NdtSupplierRow } from "@/repo/ndtSupplierRepo";
import { fetchStandardFmGroups, fetchStandards, type StandardFmGroupRow, type StandardRow } from "@/repo/standardRepo";
import { fetchWeldingProcesses, type WeldingProcessRow } from "@/repo/weldingProcessRepo";
import { fetchWeldJointTypes, type WeldJointTypeRow } from "@/repo/weldJointTypeRepo";

type CertsDataState = {
  welders: ProfileWelderRow[];
  welderCerts: WelderCertRow[];
  ndtCerts: NdtCertRow[];
  standards: StandardRow[];
  fmGroups: StandardFmGroupRow[];
  materials: MaterialRow[];
  weldingProcesses: WeldingProcessRow[];
  ndtMethods: NdtMethodRow[];
  ndtSuppliers: NdtSupplierRow[];
  ndtInspectors: NdtInspectorRow[];
  jointTypes: WeldJointTypeRow[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
};

type CertsDataResult = CertsDataState & {
  reload: () => Promise<void>;
};

const INITIAL_STATE: CertsDataState = {
  welders: [],
  welderCerts: [],
  ndtCerts: [],
  standards: [],
  fmGroups: [],
  materials: [],
  weldingProcesses: [],
  ndtMethods: [],
  ndtSuppliers: [],
  ndtInspectors: [],
  jointTypes: [],
  loading: true,
  refreshing: false,
  error: null,
};

function readErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return "Ukjent feil ved lasting av sertifikater.";
}

export function useCertsData(): CertsDataResult {
  const [state, setState] = useState<CertsDataState>(INITIAL_STATE);
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
      const [certData, standards, fmGroups, materials, weldingProcesses, ndtMethods, ndtSuppliers, ndtInspectors, jointTypes] =
        await Promise.all([
          fetchCertData(),
          fetchStandards(),
          fetchStandardFmGroups(),
          fetchMaterials(),
          fetchWeldingProcesses(),
          fetchNdtMethods(),
          fetchNdtSuppliers(),
          fetchNdtInspectors(),
          fetchWeldJointTypes(),
        ]);
      if (seq !== loadSeqRef.current) return;

      hasLoadedRef.current = true;
      setState({
        welders: certData.welders,
        welderCerts: certData.welderCerts,
        ndtCerts: certData.ndtCerts,
        standards,
        fmGroups,
        materials,
        weldingProcesses,
        ndtMethods,
        ndtSuppliers,
        ndtInspectors,
        jointTypes,
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
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    ...state,
    reload,
  };
}

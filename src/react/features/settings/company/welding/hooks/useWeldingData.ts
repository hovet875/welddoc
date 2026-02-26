import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchMaterials, type MaterialRow } from "../../../../../../repo/materialRepo";
import { fetchNdtMethods, type NdtMethodRow } from "../../../../../../repo/ndtReportRepo";
import { fetchStandards, type StandardRow } from "../../../../../../repo/standardRepo";
import { fetchWeldingProcesses, type WeldingProcessRow } from "../../../../../../repo/weldingProcessRepo";
import { fetchWeldJointTypes, type WeldJointTypeRow } from "../../../../../../repo/weldJointTypeRepo";
import type { WeldingDataState, WeldingListState } from "../welding.types";

type UseWeldingDataArgs = {
  enabled: boolean;
};

type UseWeldingDataResult = WeldingDataState & {
  reloadAll: () => Promise<void>;
  reloadMaterials: () => Promise<void>;
  reloadStandards: () => Promise<void>;
  reloadNdtMethods: () => Promise<void>;
  reloadProcesses: () => Promise<void>;
  reloadJointTypes: () => Promise<void>;
};

const EMPTY_MATERIALS: WeldingListState<MaterialRow> = {
  loading: false,
  error: null,
  rows: [],
};

const EMPTY_STANDARDS: WeldingListState<StandardRow> = {
  loading: false,
  error: null,
  rows: [],
};

const EMPTY_NDT_METHODS: WeldingListState<NdtMethodRow> = {
  loading: false,
  error: null,
  rows: [],
};

const EMPTY_PROCESSES: WeldingListState<WeldingProcessRow> = {
  loading: false,
  error: null,
  rows: [],
};

const EMPTY_JOINT_TYPES: WeldingListState<WeldJointTypeRow> = {
  loading: false,
  error: null,
  rows: [],
};

function readError(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useWeldingData({ enabled }: UseWeldingDataArgs): UseWeldingDataResult {
  const [materials, setMaterials] = useState<WeldingListState<MaterialRow>>(EMPTY_MATERIALS);
  const [standards, setStandards] = useState<WeldingListState<StandardRow>>(EMPTY_STANDARDS);
  const [ndtMethods, setNdtMethods] = useState<WeldingListState<NdtMethodRow>>(EMPTY_NDT_METHODS);
  const [processes, setProcesses] = useState<WeldingListState<WeldingProcessRow>>(EMPTY_PROCESSES);
  const [jointTypes, setJointTypes] = useState<WeldingListState<WeldJointTypeRow>>(EMPTY_JOINT_TYPES);

  const seqRef = useRef({
    materials: 0,
    standards: 0,
    ndtMethods: 0,
    processes: 0,
    jointTypes: 0,
  });

  const reloadMaterials = useCallback(async () => {
    if (!enabled) {
      setMaterials(EMPTY_MATERIALS);
      return;
    }

    const seq = ++seqRef.current.materials;
    setMaterials((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const rows = await fetchMaterials({ includeInactive: true });
      if (seq !== seqRef.current.materials) return;
      setMaterials({ loading: false, error: null, rows });
    } catch (err) {
      if (seq !== seqRef.current.materials) return;
      setMaterials({ loading: false, error: readError(err, "Kunne ikke hente materialer."), rows: [] });
    }
  }, [enabled]);

  const reloadStandards = useCallback(async () => {
    if (!enabled) {
      setStandards(EMPTY_STANDARDS);
      return;
    }

    const seq = ++seqRef.current.standards;
    setStandards((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const rows = await fetchStandards();
      if (seq !== seqRef.current.standards) return;
      setStandards({ loading: false, error: null, rows });
    } catch (err) {
      if (seq !== seqRef.current.standards) return;
      setStandards({ loading: false, error: readError(err, "Kunne ikke hente standarder."), rows: [] });
    }
  }, [enabled]);

  const reloadNdtMethods = useCallback(async () => {
    if (!enabled) {
      setNdtMethods(EMPTY_NDT_METHODS);
      return;
    }

    const seq = ++seqRef.current.ndtMethods;
    setNdtMethods((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const rows = await fetchNdtMethods({ includeInactive: true });
      if (seq !== seqRef.current.ndtMethods) return;
      setNdtMethods({ loading: false, error: null, rows });
    } catch (err) {
      if (seq !== seqRef.current.ndtMethods) return;
      setNdtMethods({ loading: false, error: readError(err, "Kunne ikke hente NDT-metoder."), rows: [] });
    }
  }, [enabled]);

  const reloadProcesses = useCallback(async () => {
    if (!enabled) {
      setProcesses(EMPTY_PROCESSES);
      return;
    }

    const seq = ++seqRef.current.processes;
    setProcesses((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const rows = await fetchWeldingProcesses({ includeInactive: true });
      if (seq !== seqRef.current.processes) return;
      setProcesses({ loading: false, error: null, rows });
    } catch (err) {
      if (seq !== seqRef.current.processes) return;
      setProcesses({ loading: false, error: readError(err, "Kunne ikke hente sveiseprosesser."), rows: [] });
    }
  }, [enabled]);

  const reloadJointTypes = useCallback(async () => {
    if (!enabled) {
      setJointTypes(EMPTY_JOINT_TYPES);
      return;
    }

    const seq = ++seqRef.current.jointTypes;
    setJointTypes((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const rows = await fetchWeldJointTypes({ includeInactive: true });
      if (seq !== seqRef.current.jointTypes) return;
      setJointTypes({ loading: false, error: null, rows });
    } catch (err) {
      if (seq !== seqRef.current.jointTypes) return;
      setJointTypes({ loading: false, error: readError(err, "Kunne ikke hente sveisefuger."), rows: [] });
    }
  }, [enabled]);

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadMaterials(), reloadStandards(), reloadNdtMethods(), reloadProcesses(), reloadJointTypes()]);
  }, [reloadJointTypes, reloadMaterials, reloadNdtMethods, reloadProcesses, reloadStandards]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  return useMemo(
    () => ({
      materials,
      standards,
      ndtMethods,
      processes,
      jointTypes,
      reloadAll,
      reloadMaterials,
      reloadStandards,
      reloadNdtMethods,
      reloadProcesses,
      reloadJointTypes,
    }),
    [
      materials,
      standards,
      ndtMethods,
      processes,
      jointTypes,
      reloadAll,
      reloadMaterials,
      reloadStandards,
      reloadNdtMethods,
      reloadProcesses,
      reloadJointTypes,
    ]
  );
}

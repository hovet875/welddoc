import { useCallback, useMemo, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import {
  createCertPdfSignedUrl,
  createNdtCertWithPdf,
  createWelderCertWithPdf,
  deleteNdtCert,
  deleteWelderCert,
  updateNdtCertWithPdf,
  updateWelderCertWithPdf,
  type NdtCertRow,
  type ProfileWelderRow,
  type WelderCertRow,
} from "@/repo/certRepo";
import type { MaterialRow } from "@/repo/materialRepo";
import type { NdtMethodRow } from "@/repo/ndtReportRepo";
import type { NdtInspectorRow, NdtSupplierRow } from "@/repo/ndtSupplierRepo";
import type { StandardFmGroupRow, StandardRow } from "@/repo/standardRepo";
import type { WeldJointTypeRow } from "@/repo/weldJointTypeRepo";
import type { WeldingProcessRow } from "@/repo/weldingProcessRepo";
import { esc } from "@/utils/dom";
import { toast } from "@react/ui/notify";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import type { AppPdfPreviewState } from "@react/ui/AppPdfPreviewModal";
import type { NdtCertModalSubmit } from "../components/NdtCertModal";
import type { WelderCertModalSubmit } from "../components/WelderCertModal";
import {
  buildNdtModalOptions,
  buildNdtCompanyFilterOptions,
  buildNdtMethodFilterOptions,
  buildStandardsByLabel,
  buildJointTypeFilterOptions,
  buildMaterialFilterOptions,
  buildWelderFilterOptions,
  buildWelderModalOptions,
  createInspectorOptionsByCompany,
} from "../lib/certsOptions";
import {
  filterNdtRows,
  filterWelderRows,
  formatCount,
  groupNdtRows,
  groupWelderRows,
  type NdtCertFilters,
  type WelderCertFilters,
} from "../lib/certsView";

type ModalMode = "new" | "edit" | "renew";

type ActiveModal = {
  opened: boolean;
  mode: ModalMode;
  rowId: string | null;
};

type UseCertsPageStateArgs = {
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
  reload: () => Promise<void>;
};

const INITIAL_WELDER_FILTERS: WelderCertFilters = {
  welderId: "",
  material: "",
  jointType: "",
  status: "",
  query: "",
};

const INITIAL_NDT_FILTERS: NdtCertFilters = {
  company: "",
  method: "",
  status: "",
  query: "",
};

function createModalState(): ActiveModal {
  return { opened: false, mode: "new", rowId: null };
}

function createPdfPreviewState(): AppPdfPreviewState {
  return {
    opened: false,
    title: "PDF",
    url: null,
    loading: false,
    error: null,
  };
}

function hasWelderFilters(filters: WelderCertFilters) {
  return Boolean(filters.welderId || filters.material || filters.jointType || filters.status || filters.query);
}

function hasNdtFilters(filters: NdtCertFilters) {
  return Boolean(filters.company || filters.method || filters.status || filters.query);
}

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useCertsPageState({
  welders,
  welderCerts,
  ndtCerts,
  standards,
  fmGroups,
  materials,
  weldingProcesses,
  ndtMethods,
  ndtSuppliers,
  ndtInspectors,
  jointTypes,
  reload,
}: UseCertsPageStateArgs) {
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();
  const [welderFilters, setWelderFilters] = useState<WelderCertFilters>(INITIAL_WELDER_FILTERS);
  const [ndtFilters, setNdtFilters] = useState<NdtCertFilters>(INITIAL_NDT_FILTERS);
  const [welderModal, setWelderModal] = useState<ActiveModal>(() => createModalState());
  const [ndtModal, setNdtModal] = useState<ActiveModal>(() => createModalState());
  const [pdfPreview, setPdfPreview] = useState<AppPdfPreviewState>(() => createPdfPreviewState());
  const [debouncedWelderQuery] = useDebouncedValue(welderFilters.query, 150);
  const [debouncedNdtQuery] = useDebouncedValue(ndtFilters.query, 150);

  const standardsByLabel = useMemo(() => buildStandardsByLabel(standards), [standards]);
  const welderFilterOptions = useMemo(() => buildWelderFilterOptions(welders), [welders]);
  const materialFilterOptions = useMemo(() => buildMaterialFilterOptions(welderCerts), [welderCerts]);
  const jointTypeFilterOptions = useMemo(
    () => buildJointTypeFilterOptions(jointTypes, welderCerts),
    [jointTypes, welderCerts]
  );
  const ndtCompanyFilterOptions = useMemo(
    () => buildNdtCompanyFilterOptions(ndtSuppliers, ndtCerts),
    [ndtSuppliers, ndtCerts]
  );
  const ndtMethodFilterOptions = useMemo(
    () => buildNdtMethodFilterOptions(ndtMethods, ndtCerts),
    [ndtMethods, ndtCerts]
  );

  const effectiveWelderFilters = useMemo(
    () => ({ ...welderFilters, query: debouncedWelderQuery }),
    [debouncedWelderQuery, welderFilters]
  );
  const effectiveNdtFilters = useMemo(
    () => ({ ...ndtFilters, query: debouncedNdtQuery }),
    [debouncedNdtQuery, ndtFilters]
  );

  const filteredWelderRows = useMemo(
    () => filterWelderRows(welderCerts, effectiveWelderFilters),
    [effectiveWelderFilters, welderCerts]
  );
  const filteredNdtRows = useMemo(() => filterNdtRows(ndtCerts, effectiveNdtFilters), [effectiveNdtFilters, ndtCerts]);

  const welderGroups = useMemo(() => groupWelderRows(filteredWelderRows), [filteredWelderRows]);
  const ndtGroups = useMemo(() => groupNdtRows(filteredNdtRows), [filteredNdtRows]);

  const selectedWelderRow = useMemo(
    () => welderCerts.find((row) => row.id === welderModal.rowId) ?? null,
    [welderCerts, welderModal.rowId]
  );
  const selectedNdtRow = useMemo(() => ndtCerts.find((row) => row.id === ndtModal.rowId) ?? null, [ndtCerts, ndtModal.rowId]);

  const welderModalOptions = useMemo(
    () =>
      buildWelderModalOptions({
        selectedWelderRow,
        welderFilterOptions,
        standardsByLabel,
        weldingProcesses,
        welderCerts,
        materials,
        jointTypes,
      }),
    [jointTypes, materials, selectedWelderRow, standardsByLabel, welderCerts, welderFilterOptions, weldingProcesses]
  );

  const inspectorOptionsByCompanyBase = useMemo(
    () =>
      createInspectorOptionsByCompany(
        ndtSuppliers.map((item) => ({ id: item.id, name: item.name })),
        ndtInspectors.map((item) => ({ supplier_id: item.supplier_id, name: item.name })),
        ndtCerts.map((item) => ({ company: item.company, personnel_name: item.personnel_name }))
      ),
    [ndtCerts, ndtInspectors, ndtSuppliers]
  );

  const ndtModalOptions = useMemo(
    () =>
      buildNdtModalOptions({
        selectedNdtRow,
        companyOptionsBase: ndtCompanyFilterOptions,
        methodOptionsBase: ndtMethodFilterOptions,
        inspectorOptionsByCompanyBase,
      }),
    [inspectorOptionsByCompanyBase, ndtCompanyFilterOptions, ndtMethodFilterOptions, selectedNdtRow]
  );

  const closePdfPreview = useCallback(() => {
    setPdfPreview(createPdfPreviewState());
  }, []);

  const openPdfPreview = useCallback(async (kind: "welder" | "ndt", ref: string | null, title: string) => {
    if (!ref) {
      toast("Ingen PDF er koblet til denne raden.");
      return;
    }

    setPdfPreview({
      opened: true,
      title,
      url: null,
      loading: true,
      error: null,
    });

    try {
      const url = await createCertPdfSignedUrl(kind, ref, 120);
      setPdfPreview({
        opened: true,
        title,
        url,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error(err);
      setPdfPreview({
        opened: true,
        title,
        url: null,
        loading: false,
        error: readErrorMessage(err, "Kunne ikke åpne PDF."),
      });
    }
  }, []);

  const closeWelderModal = useCallback(() => setWelderModal(createModalState()), []);
  const closeNdtModal = useCallback(() => setNdtModal(createModalState()), []);

  const requestDeleteWelder = useCallback(
    (row: WelderCertRow) => {
      confirmDelete({
        title: "Slett sveisesertifikat",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(row.certificate_no)}</b>?`,
        onConfirm: async () => {
          await deleteWelderCert(row.id);
        },
        onDone: async () => {
          await reload();
          toast("Sveisesertifikat slettet.");
        },
      });
    },
    [confirmDelete, reload]
  );

  const requestDeleteNdt = useCallback(
    (row: NdtCertRow) => {
      confirmDelete({
        title: "Slett NDT-sertifikat",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(row.certificate_no)}</b>?`,
        onConfirm: async () => {
          await deleteNdtCert(row.id);
        },
        onDone: async () => {
          await reload();
          toast("NDT-sertifikat slettet.");
        },
      });
    },
    [confirmDelete, reload]
  );

  const handleWelderModalSubmit = useCallback(
    async (input: WelderCertModalSubmit) => {
      if (input.mode === "new") {
        if (!input.pdfFile) throw new Error("PDF må lastes opp for å opprette sertifikat.");
        await createWelderCertWithPdf(input.payload, input.pdfFile);
        toast("Sveisesertifikat opprettet.");
      } else {
        if (!input.rowId) throw new Error("Mangler sertifikat-id for oppdatering.");
        await updateWelderCertWithPdf(input.rowId, input.payload, {
          pdfFile: input.pdfFile,
          removePdf: input.mode === "renew" ? false : input.removePdf,
        });
        toast(input.mode === "renew" ? "Sveisesertifikat fornyet." : "Sveisesertifikat oppdatert.");
      }

      closeWelderModal();
      await reload();
    },
    [closeWelderModal, reload]
  );

  const handleNdtModalSubmit = useCallback(
    async (input: NdtCertModalSubmit) => {
      if (input.mode === "new") {
        if (!input.pdfFile) throw new Error("PDF må lastes opp for å opprette sertifikat.");
        await createNdtCertWithPdf(input.payload, input.pdfFile);
        toast("NDT-sertifikat opprettet.");
      } else {
        if (!input.rowId) throw new Error("Mangler sertifikat-id for oppdatering.");
        await updateNdtCertWithPdf(input.rowId, input.payload, {
          pdfFile: input.pdfFile,
          removePdf: input.mode === "renew" ? false : input.removePdf,
        });
        toast(input.mode === "renew" ? "NDT-sertifikat fornyet." : "NDT-sertifikat oppdatert.");
      }

      closeNdtModal();
      await reload();
    },
    [closeNdtModal, reload]
  );

  return {
    welderFilters,
    setWelderFilters,
    ndtFilters,
    setNdtFilters,
    welderFilterOptions,
    materialFilterOptions,
    jointTypeFilterOptions,
    ndtCompanyFilterOptions,
    ndtMethodFilterOptions,
    welderGroups,
    ndtGroups,
    filteredWelderRows,
    filteredNdtRows,
    hasWelderFilters: hasWelderFilters(welderFilters),
    hasNdtFilters: hasNdtFilters(ndtFilters),
    welderMeta: formatCount(filteredWelderRows.length, welderCerts.length, hasWelderFilters(welderFilters)),
    ndtMeta: formatCount(filteredNdtRows.length, ndtCerts.length, hasNdtFilters(ndtFilters)),
    welderModal,
    setWelderModal,
    ndtModal,
    setNdtModal,
    selectedWelderRow,
    selectedNdtRow,
    welderModalOptions,
    ndtModalOptions,
    standardsByLabel,
    fmGroups,
    standards,
    pdfPreview,
    closePdfPreview,
    openPdfPreview,
    closeWelderModal,
    closeNdtModal,
    requestDeleteWelder,
    requestDeleteNdt,
    handleWelderModalSubmit,
    handleNdtModalSubmit,
    deleteConfirmModal,
  };
}

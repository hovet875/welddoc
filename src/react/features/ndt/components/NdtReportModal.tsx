import { useEffect, useMemo, useState } from "react";
import { Alert, Group, SimpleGrid, Stack } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { ProfileWelderRow } from "@/repo/certRepo";
import type { CustomerRow } from "@/repo/customerRepo";
import type { NdtMethodRow, NdtReportRow } from "@/repo/ndtReportRepo";
import type { NdtInspectorRow, NdtSupplierRow } from "@/repo/ndtSupplierRepo";
import type { ProjectRow } from "@/repo/projectRepo";
import { validatePdfFile } from "@/utils/format";
import { AppButton } from "@react/ui/AppButton";
import { AppDateInput } from "@react/ui/AppDateInput";
import { AppFileInput } from "@react/ui/AppFileInput";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppMultiSelect } from "@react/ui/AppMultiSelect";
import { AppSelect } from "@react/ui/AppSelect";
import { buildNdtReportPayload, type NdtWelderStatsDraft } from "../lib/ndtForm";
import {
  buildCustomerOptions,
  buildInspectorOptions,
  buildMethodById,
  buildMethodOptions,
  buildProjectCustomerByNo,
  buildProjectOptions,
  buildSupplierOptions,
  buildWelderLabelById,
  buildWelderOptions,
  withCurrentOption,
} from "../lib/ndtOptions";
import { trimOrEmpty } from "../lib/ndtView";
import { NdtRtWelderStatsFields } from "./NdtRtWelderStatsFields";

type ModalMode = "new" | "edit";

export type NdtReportModalSubmit = {
  mode: ModalMode;
  rowId: string | null;
  payload: {
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
  pdfFile: File | null;
};

type NdtReportModalProps = {
  opened: boolean;
  mode: ModalMode;
  row: NdtReportRow | null;
  methods: NdtMethodRow[];
  welders: ProfileWelderRow[];
  projects: ProjectRow[];
  customers: CustomerRow[];
  ndtSuppliers: NdtSupplierRow[];
  ndtInspectors: NdtInspectorRow[];
  onClose: () => void;
  onSubmit: (payload: NdtReportModalSubmit) => Promise<void>;
  onOpenExistingPdf?: (ref: string, title: string) => void;
};

type FormState = {
  projectNo: string;
  customer: string;
  reportDate: string;
  methodId: string;
  supplierId: string;
  inspectorId: string;
  welderIds: string[];
  welderStats: NdtWelderStatsDraft;
  pdfFile: File | null;
  error: string | null;
  submitting: boolean;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function initialFormState(): FormState {
  return {
    projectNo: "",
    customer: "",
    reportDate: todayIsoDate(),
    methodId: "",
    supplierId: "",
    inspectorId: "",
    welderIds: [],
    welderStats: {},
    pdfFile: null,
    error: null,
    submitting: false,
  };
}

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function NdtReportModal({
  opened,
  mode,
  row,
  methods,
  welders,
  projects,
  customers,
  ndtSuppliers,
  ndtInspectors,
  onClose,
  onSubmit,
  onOpenExistingPdf,
}: NdtReportModalProps) {
  const [state, setState] = useState<FormState>(initialFormState);

  const projectCustomerByNo = useMemo(() => buildProjectCustomerByNo(projects), [projects]);

  const methodById = useMemo(() => buildMethodById(methods), [methods]);

  useEffect(() => {
    if (!opened) {
      setState(initialFormState());
      return;
    }

    if (mode === "new" || !row) {
      setState(initialFormState());
      return;
    }

    const projectNo = trimOrEmpty(row.title);
    const welderIds = Array.from(new Set((row.report_welders || []).map((entry) => entry.welder_id).filter(Boolean)));
    const welderStats: NdtWelderStatsDraft = {};

    for (const welderRow of row.report_welders || []) {
      const id = trimOrEmpty(welderRow.welder_id);
      if (!id) continue;
      welderStats[id] = {
        weldCount: welderRow.weld_count == null ? "" : String(welderRow.weld_count),
        defectCount: welderRow.defect_count == null ? "" : String(welderRow.defect_count),
      };
    }

    setState({
      projectNo,
      customer: trimOrEmpty(row.customer) || projectCustomerByNo.get(projectNo) || "",
      reportDate: (trimOrEmpty(row.report_date) || row.created_at).slice(0, 10),
      methodId: trimOrEmpty(row.method_id),
      supplierId: trimOrEmpty(row.ndt_supplier_id) || trimOrEmpty(row.ndt_inspector?.supplier_id),
      inspectorId: trimOrEmpty(row.ndt_inspector_id),
      welderIds,
      welderStats,
      pdfFile: null,
      error: null,
      submitting: false,
    });
  }, [mode, opened, projectCustomerByNo, row]);

  const methodOptionsBase = useMemo(() => buildMethodOptions(methods), [methods]);

  const projectOptionsBase = useMemo(() => buildProjectOptions(projects), [projects]);

  const customerOptionsBase = useMemo(() => buildCustomerOptions(customers), [customers]);

  const supplierOptionsBase = useMemo(() => buildSupplierOptions(ndtSuppliers), [ndtSuppliers]);

  const allWelderOptions = useMemo(() => buildWelderOptions(welders), [welders]);

  const welderLabelById = useMemo(() => buildWelderLabelById(allWelderOptions), [allWelderOptions]);

  const inspectorOptionsBase = useMemo(
    () => buildInspectorOptions(ndtInspectors, state.supplierId),
    [ndtInspectors, state.supplierId]
  );

  const methodOptions = useMemo(
    () =>
      withCurrentOption(
        methodOptionsBase,
        state.methodId,
        row?.method ? trimOrEmpty(row.method.label) || trimOrEmpty(row.method.code) || state.methodId : state.methodId
      ),
    [methodOptionsBase, row?.method, state.methodId]
  );

  const projectOptions = useMemo(
    () => withCurrentOption(projectOptionsBase, state.projectNo, state.projectNo),
    [projectOptionsBase, state.projectNo]
  );

  const customerOptions = useMemo(
    () => withCurrentOption(customerOptionsBase, state.customer, state.customer),
    [customerOptionsBase, state.customer]
  );

  const supplierOptions = useMemo(
    () =>
      withCurrentOption(
        supplierOptionsBase,
        state.supplierId,
        trimOrEmpty(row?.ndt_supplier?.name) || state.supplierId
      ),
    [row?.ndt_supplier?.name, state.supplierId, supplierOptionsBase]
  );

  const inspectorOptions = useMemo(
    () =>
      withCurrentOption(
        inspectorOptionsBase,
        state.inspectorId,
        trimOrEmpty(row?.ndt_inspector?.name) || state.inspectorId
      ),
    [inspectorOptionsBase, row?.ndt_inspector?.name, state.inspectorId]
  );

  const selectedMethodCode = trimOrEmpty(methodById.get(state.methodId)?.code).toUpperCase();
  const isRtMethod = selectedMethodCode === "RT";
  const existingPdfRef = row?.file_id ?? null;
  const existingPdfTitle = trimOrEmpty(row?.file?.label) || "NDT-rapport";

  const welderOptions = useMemo(() => {
    if (state.welderIds.length === 0) return allWelderOptions;
    const existingIds = new Set(allWelderOptions.map((option) => option.value));
    const missing = state.welderIds
      .filter((id) => !existingIds.has(id))
      .map((id) => ({ value: id, label: id }));
    return [...allWelderOptions, ...missing];
  }, [allWelderOptions, state.welderIds]);

  const handleWelderIdsChange = (nextWelderIds: string[]) => {
    setState((prev) => {
      const nextSet = new Set(nextWelderIds);
      const nextWelderStats: NdtWelderStatsDraft = {};

      for (const [welderId, stats] of Object.entries(prev.welderStats)) {
        if (nextSet.has(welderId)) {
          nextWelderStats[welderId] = stats;
        }
      }

      return {
        ...prev,
        welderIds: nextWelderIds,
        welderStats: nextWelderStats,
      };
    });
  };

  const setWelderStat = (welderId: string, key: "weldCount" | "defectCount", value: string) => {
    setState((prev) => ({
      ...prev,
      welderStats: {
        ...prev.welderStats,
        [welderId]: {
          weldCount: prev.welderStats[welderId]?.weldCount ?? "",
          defectCount: prev.welderStats[welderId]?.defectCount ?? "",
          [key]: value,
        },
      },
    }));
  };

  const submit = async () => {
    setState((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const reportPayload = buildNdtReportPayload(
        {
          title: state.projectNo,
          customer: state.customer,
          reportDate: state.reportDate,
          methodId: state.methodId,
          supplierId: state.supplierId,
          inspectorId: state.inspectorId,
          welderIds: state.welderIds,
          welderStats: state.welderStats,
        },
        methods,
        ndtInspectors,
        {
          rtWelderRequiredMessage: "Velg minst en sveiser for RT-rapport.",
          getWelderLabel: (welderId) => welderLabelById.get(welderId) ?? welderId,
        }
      );

      if (mode === "new" && !state.pdfFile) {
        throw new Error("Velg en PDF for ny rapport.");
      }
      if (state.pdfFile) {
        const pdfError = validatePdfFile(state.pdfFile, 25);
        if (pdfError) throw new Error(pdfError);
      }

      await onSubmit({
        mode,
        rowId: row?.id ?? null,
        payload: reportPayload,
        pdfFile: state.pdfFile,
      });
    } catch (err) {
      console.error(err);
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: readErrorMessage(err, "Kunne ikke lagre NDT-rapport."),
      }));
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={mode === "new" ? "Ny NDT-rapport" : "Endre NDT-rapport"}
      busy={state.submitting}
      size="xl"
    >
      <Stack gap="sm">
        {state.error ? (
          <Alert color="red" variant="light" title="Feil">
            {state.error}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <AppSelect
            label="Prosjektnr"
            value={state.projectNo}
            onChange={(value) =>
              setState((prev) => ({
                ...prev,
                projectNo: value,
                customer: projectCustomerByNo.get(value) || prev.customer,
              }))
            }
            data={projectOptions}
            placeholder="Velg prosjekt..."
            searchable
          />
          <AppSelect
            label="Kunde"
            value={state.customer}
            onChange={(value) => setState((prev) => ({ ...prev, customer: value }))}
            data={customerOptions}
            placeholder="Velg kunde..."
            searchable
          />
          <AppDateInput
            label="Rapportdato"
            value={state.reportDate}
            onChange={(value) => setState((prev) => ({ ...prev, reportDate: value }))}
          />
          <AppSelect
            label="NDT-metode"
            value={state.methodId}
            onChange={(value) => setState((prev) => ({ ...prev, methodId: value }))}
            data={methodOptions}
            placeholder="Velg metode..."
            searchable
          />
          <AppSelect
            label="NDT-firma"
            value={state.supplierId}
            onChange={(value) =>
              setState((prev) => ({
                ...prev,
                supplierId: value,
                inspectorId: value === prev.supplierId ? prev.inspectorId : "",
              }))
            }
            data={supplierOptions}
            placeholder="Velg firma..."
            clearable
            searchable
          />
          <AppSelect
            label="NDT-kontrollør"
            value={state.inspectorId}
            onChange={(value) => setState((prev) => ({ ...prev, inspectorId: value }))}
            data={inspectorOptions}
            placeholder={state.supplierId ? "Velg kontrollør..." : "Velg firma først"}
            disabled={!state.supplierId}
            clearable
            searchable
          />
        </SimpleGrid>

        <Stack gap={6}>
          <AppMultiSelect
            label="Sveisere"
            value={state.welderIds}
            onChange={handleWelderIdsChange}
            data={welderOptions}
            placeholder={welderOptions.length > 0 ? "Velg en eller flere sveisere..." : "Ingen sveisere funnet"}
            searchable
            clearable
            nothingFoundMessage="Ingen treff"
          />
        </Stack>

        {isRtMethod ? (
          <NdtRtWelderStatsFields
            welderIds={state.welderIds}
            welderLabelById={welderLabelById}
            welderStats={state.welderStats}
            onChangeStat={setWelderStat}
            variant="table"
            helperText="For RT er antall sveis og feil per sveiser påkrevd."
          />
        ) : null}

        <AppFileInput
          label={mode === "new" ? "PDF (påkrevd)" : "Ny PDF (valgfri)"}
          value={state.pdfFile}
          onChange={(value) => setState((prev) => ({ ...prev, pdfFile: value }))}
          accept="application/pdf"
          clearable
        />

        {mode === "edit" && existingPdfRef ? (
          <Group>
            <AppButton
              tone="neutral"
              size="sm"
              leftSection={<IconEye size={14} />}
              onClick={() => onOpenExistingPdf?.(existingPdfRef, existingPdfTitle)}
            >
              Vis eksisterende PDF
            </AppButton>
          </Group>
        ) : null}
      </Stack>

      <AppModalActions
        confirmLabel={mode === "new" ? "Lagre" : "Oppdater"}
        onCancel={onClose}
        onConfirm={() => void submit()}
        cancelDisabled={state.submitting}
        confirmLoading={state.submitting}
      />
    </AppModal>
  );
}

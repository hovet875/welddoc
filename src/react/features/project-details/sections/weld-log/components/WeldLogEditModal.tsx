import { useEffect, useMemo, useState } from "react";
import { Alert, Group, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import type { ProfileWelderRow, WelderCertLookupRow } from "@/repo/certRepo";
import type { ProjectWeldRow, WeldEmployeeOption, WeldNdtReportOption } from "@/repo/weldLogRepo";
import type { WelderCertScopeRow } from "@/repo/welderCertScopeRepo";
import { AppCheckbox } from "@react/ui/AppCheckbox";
import { AppDrawer } from "@react/ui/AppDrawer";
import { AppDateInput } from "@react/ui/AppDateInput";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppNumberInput } from "@react/ui/AppNumberInput";
import { AppSelect } from "@react/ui/AppSelect";
import { notifyError } from "@react/ui/notify";
import {
  createEditorValues,
  getWpsOptionsForContext,
  normalizeDateInput,
  reportMatchesField,
  resolveWelderCertForScope,
  validateEditorValues,
} from "../lib/weldLogUtils";
import type { WeldLogEditorValues, WeldLogTraceabilityOption, WeldLogWpsOption } from "../types";

type WeldLogEditModalProps = {
  opened: boolean;
  row: ProjectWeldRow | null;
  saving: boolean;
  jointTypes: string[];
  welders: ProfileWelderRow[];
  employees: WeldEmployeeOption[];
  reports: WeldNdtReportOption[];
  componentOptions: WeldLogTraceabilityOption[];
  fillerOptions: WeldLogTraceabilityOption[];
  wpsOptions: WeldLogWpsOption[];
  welderCerts: WelderCertLookupRow[];
  welderScopes: WelderCertScopeRow[];
  onClose: () => void;
  onSubmit: (values: WeldLogEditorValues) => Promise<void>;
};

export function WeldLogEditModal({
  opened,
  row,
  saving,
  jointTypes,
  welders,
  employees,
  reports,
  componentOptions,
  fillerOptions,
  wpsOptions,
  welderCerts,
  welderScopes,
  onClose,
  onSubmit,
}: WeldLogEditModalProps) {
  const [vtNoReport, setVtNoReport] = useState(false);

  const form = useForm<WeldLogEditorValues>({
    initialValues: createEditorValues(row),
  });

  useEffect(() => {
    if (!opened) return;
    const values = createEditorValues(row);
    form.setValues(values);
    setVtNoReport(!values.visual_report_id && Boolean(values.visual_inspector));
    form.clearErrors();
    form.resetDirty();
  }, [opened, row?.id]);

  const filteredWpsOptions = useMemo(
    () =>
      getWpsOptionsForContext({
        jointType: form.values.joint_type,
        componentAId: form.values.component_a_id,
        componentBId: form.values.component_b_id,
        componentOptions,
        wpsOptions,
      }),
    [form.values.joint_type, form.values.component_a_id, form.values.component_b_id, componentOptions, wpsOptions]
  );

  useEffect(() => {
    const currentWpsId = form.values.wps_id;
    if (!currentWpsId) return;
    if (filteredWpsOptions.some((option) => option.id === currentWpsId)) return;
    form.setFieldValue("wps_id", "");
  }, [filteredWpsOptions, form.values.wps_id]);

  useEffect(() => {
    if (filteredWpsOptions.length !== 1) return;
    const only = filteredWpsOptions[0];
    if (form.values.wps_id === only.id) return;
    form.setFieldValue("wps_id", only.id);
  }, [filteredWpsOptions, form.values.wps_id]);

  const jointTypeOptions = useMemo(
    () => jointTypes.map((value) => ({ value, label: value })),
    [jointTypes]
  );

  const welderOptions = useMemo(
    () =>
      welders.map((welder) => ({
        value: welder.id,
        label: [welder.welder_no, welder.display_name].filter(Boolean).join(" - ") || welder.id,
      })),
    [welders]
  );

  const componentSelectOptions = useMemo(
    () => componentOptions.map((option) => ({ value: option.id, label: option.label })),
    [componentOptions]
  );

  const fillerSelectOptions = useMemo(
    () => fillerOptions.map((option) => ({ value: option.id, label: option.label })),
    [fillerOptions]
  );

  const wpsSelectOptions = useMemo(
    () => filteredWpsOptions.map((option) => ({ value: option.id, label: option.label })),
    [filteredWpsOptions]
  );

  const reportOptionsByMethod = useMemo(() => {
    const map = {
      vt: reports.filter((report) => reportMatchesField("vt", report)),
      pt: reports.filter((report) => reportMatchesField("pt", report)),
      vol: reports.filter((report) => reportMatchesField("vol", report)),
    };
    return {
      vt: map.vt.map((report) => ({
        value: report.id,
        label: [report.report_no || report.id, report.date || ""].filter(Boolean).join(" - "),
      })),
      pt: map.pt.map((report) => ({
        value: report.id,
        label: [report.report_no || report.id, report.date || ""].filter(Boolean).join(" - "),
      })),
      vol: map.vol.map((report) => ({
        value: report.id,
        label: [report.report_no || report.id, report.date || ""].filter(Boolean).join(" - "),
      })),
    };
  }, [reports]);

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ value: employee.id, label: employee.label })),
    [employees]
  );

  const save = async () => {
    const values = form.values;
    const errors = validateEditorValues(values);
    if (Object.keys(errors).length > 0) {
      form.setErrors(errors);
      return;
    }

    const normalizedDate = normalizeDateInput(values.weld_date);
    if (!normalizedDate) {
      form.setFieldError("weld_date", "Ugyldig dato.");
      return;
    }

    if (values.visual_inspector && values.visual_inspector === values.welder_id) {
      form.setFieldError("visual_inspector", "Visuell godkjenner kan ikke være samme som sveiser.");
      return;
    }

    const certId = resolveWelderCertForScope({
      welderId: values.welder_id,
      wpsId: values.wps_id,
      jointType: values.joint_type,
      componentAId: values.component_a_id,
      componentBId: values.component_b_id,
      weldDate: normalizedDate,
      componentOptions,
      welderCerts,
      welderScopes,
      wpsOptions,
    });

    const submitValues: WeldLogEditorValues = {
      ...values,
      weld_date: normalizedDate,
      welder_cert_id: certId ?? "",
      visual_report_id: vtNoReport ? "" : values.visual_report_id,
      visual_inspector: vtNoReport ? values.visual_inspector : "",
    };

    try {
      await onSubmit(submitValues);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Klarte ikke å lagre sveis.");
    }
  };

  return (
    <AppDrawer
      opened={opened}
      onClose={onClose}
      title={row ? "Endre sveis" : "Ny sveis"}
      size="min(860px, 100vw)"
      busy={saving}
      position="right"
    >
      <Stack gap="md">
        <Group grow>
          <AppNumberInput
            label="Sveis ID"
            value={form.values.weld_no}
            onChange={(value) => form.setFieldValue("weld_no", value)}
            error={form.errors.weld_no}
            min={1}
            step={1}
            disabled={saving}
          />
          <AppDateInput
            label="Dato"
            value={form.values.weld_date}
            onChange={(value) => form.setFieldValue("weld_date", value)}
            error={form.errors.weld_date}
            disabled={saving}
          />
        </Group>

        <Group grow>
          <AppSelect
            label="Fugetype"
            value={form.values.joint_type}
            onChange={(value) => form.setFieldValue("joint_type", value)}
            data={jointTypeOptions}
            error={form.errors.joint_type}
            searchable
            clearable
            disabled={saving}
          />
          <AppSelect
            label="Sveiser"
            value={form.values.welder_id}
            onChange={(value) => form.setFieldValue("welder_id", value)}
            data={welderOptions}
            error={form.errors.welder_id}
            searchable
            clearable
            disabled={saving}
          />
        </Group>

        <Group grow>
          <AppSelect
            label="Komponent A"
            value={form.values.component_a_id}
            onChange={(value) => form.setFieldValue("component_a_id", value)}
            data={componentSelectOptions}
            searchable
            clearable
            disabled={saving}
          />
          <AppSelect
            label="Komponent B"
            value={form.values.component_b_id}
            onChange={(value) => form.setFieldValue("component_b_id", value)}
            data={componentSelectOptions}
            searchable
            clearable
            disabled={saving}
          />
        </Group>

        <Group grow>
          <AppSelect
            label="WPS"
            value={form.values.wps_id}
            onChange={(value) => form.setFieldValue("wps_id", value)}
            data={wpsSelectOptions}
            placeholder="Velg fugetype + komponenter først"
            searchable
            clearable
            disabled={saving}
          />
          <AppSelect
            label="Tilsett"
            value={form.values.filler_traceability_id}
            onChange={(value) => form.setFieldValue("filler_traceability_id", value)}
            data={fillerSelectOptions}
            searchable
            clearable
            disabled={saving}
          />
        </Group>

        <Group grow align="flex-end">
          <AppSelect
            label="Visuell rapport (VT)"
            value={form.values.visual_report_id}
            onChange={(value) => {
              form.setFieldValue("visual_report_id", value);
              if (value) {
                setVtNoReport(false);
                form.setFieldValue("visual_inspector", "");
              }
            }}
            data={reportOptionsByMethod.vt}
            searchable
            clearable
            disabled={saving || vtNoReport}
          />
          <AppCheckbox
            checked={vtNoReport}
            onChange={(checked) => {
              setVtNoReport(checked);
              if (checked) {
                form.setFieldValue("visual_report_id", "");
              }
            }}
            label="Ingen VT-rapport (intern godkjenner)"
          />
        </Group>

        {vtNoReport ? (
          <AppSelect
            label="Intern godkjenner"
            value={form.values.visual_inspector}
            onChange={(value) => form.setFieldValue("visual_inspector", value)}
            data={employeeOptions}
            error={form.errors.visual_inspector}
            searchable
            clearable
            disabled={saving}
          />
        ) : null}

        <Group grow>
          <AppSelect
            label="Sprekkrapport (PT/MT)"
            value={form.values.crack_report_id}
            onChange={(value) => form.setFieldValue("crack_report_id", value)}
            data={reportOptionsByMethod.pt}
            searchable
            clearable
            disabled={saving}
          />
          <AppSelect
            label="Volumetrisk rapport (RT/UT)"
            value={form.values.volumetric_report_id}
            onChange={(value) => form.setFieldValue("volumetric_report_id", value)}
            data={reportOptionsByMethod.vol}
            searchable
            clearable
            disabled={saving}
          />
        </Group>

        <AppCheckbox
          checked={form.values.status}
          onChange={(checked) => form.setFieldValue("status", checked)}
          label="Godkjent"
          disabled={saving}
        />

        {!form.values.welder_cert_id ? (
          <Alert color="yellow" variant="light">
            Sertifikat velges automatisk ved lagring når WPS, fuge og materialgrunnlag matcher.
          </Alert>
        ) : null}

        <AppModalActions
          cancelLabel="Avbryt"
          confirmLabel={row ? "Lagre" : "Opprett"}
          onCancel={onClose}
          onConfirm={() => {
            void save();
          }}
          confirmLoading={saving}
        />
      </Stack>
    </AppDrawer>
  );
}

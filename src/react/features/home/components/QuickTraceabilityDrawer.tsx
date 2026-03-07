import { useEffect, useMemo, useState } from "react";
import { Alert, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { fetchMaterials, type MaterialRow } from "@/repo/materialRepo";
import { fetchProjects, type ProjectRow } from "@/repo/projectRepo";
import {
  createProjectTraceability,
  fetchTraceabilityOptions,
  fetchTraceabilityTypes,
  type TraceabilityOptionRow,
  type TraceabilityTypeRow,
} from "@/repo/traceabilityRepo";
import { AppButton } from "@react/ui/AppButton";
import { AppDrawer } from "@react/ui/AppDrawer";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import { notifyError, notifySuccess, toast } from "@react/ui/notify";
import { HeatCertificatePicker } from "@react/features/project-details/sections/traceability/components/HeatCertificatePicker";
import {
  buildInitialValues,
  fieldLabelForDn2,
  firstDefault,
  lookupType,
  normalizeSavePayload,
} from "@react/features/project-details/sections/traceability/lib/traceabilityUtils";
import type { TraceabilityModalValues } from "@react/features/project-details/sections/traceability/types";

type QuickTraceabilityDrawerProps = {
  opened: boolean;
  onClose: () => void;
};

type QuickTraceabilityFormValues = TraceabilityModalValues & {
  project_id: string;
};

type TraceabilityOptionsByGroup = {
  dn: TraceabilityOptionRow[];
  sch: TraceabilityOptionRow[];
  pn: TraceabilityOptionRow[];
  filler: TraceabilityOptionRow[];
};

const EMPTY_OPTIONS: TraceabilityOptionsByGroup = {
  dn: [],
  sch: [],
  pn: [],
  filler: [],
};

function createInitialValues(): QuickTraceabilityFormValues {
  return {
    project_id: "",
    type_code: "",
    dn: "",
    dn2: "",
    sch: "",
    pressure_class: "",
    thickness: "",
    filler_type: "",
    material_id: "",
    material_certificate_id: "",
    heat_number: "",
  };
}

function sortByLabel(a: { label: string }, b: { label: string }) {
  return a.label.localeCompare(b.label, "nb", { sensitivity: "base", numeric: true });
}

function isDuplicateTraceabilityCodeError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
  if (code === "23505") return true;
  const message = "message" in err ? String((err as { message?: unknown }).message ?? "") : "";
  return message.toLowerCase().includes("project_traceability_project_id_type_code_code_index_key");
}

function optionRows(items: TraceabilityOptionRow[]) {
  return items.map((item) => ({ value: item.value, label: item.value }));
}

export function QuickTraceabilityDrawer({ opened, onClose }: QuickTraceabilityDrawerProps) {
  const [baseLoading, setBaseLoading] = useState(false);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [types, setTypes] = useState<TraceabilityTypeRow[]>([]);
  const [options, setOptions] = useState<TraceabilityOptionsByGroup>(EMPTY_OPTIONS);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [pickedFileLabel, setPickedFileLabel] = useState("");

  const form = useForm<QuickTraceabilityFormValues>({
    initialValues: createInitialValues(),
  });

  const projectOptions = useMemo(
    () =>
      projects
        .map((project) => ({
          value: project.id,
          label: `${project.project_no} - ${project.name || "Uten navn"}`,
        }))
        .sort(sortByLabel),
    [projects]
  );

  const typeOptions = useMemo(
    () =>
      types.map((type) => ({
        value: type.code,
        label: `${type.code} - ${type.label}`,
      })),
    [types]
  );

  const materialOptions = useMemo(
    () =>
      materials.map((material) => ({
        value: material.id,
        label: material.name,
      })),
    [materials]
  );

  const selectedType = useMemo(
    () => lookupType(types, form.values.type_code),
    [types, form.values.type_code]
  );

  const selectedMaterial = useMemo(() => {
    const materialId = form.values.material_id.trim();
    if (!materialId) return null;
    return materials.find((material) => material.id === materialId) ?? null;
  }, [materials, form.values.material_id]);

  const hasSelectedCert = Boolean(form.values.material_certificate_id.trim());
  const certificateSectionReady = useMemo(() => {
    if (!form.values.project_id.trim()) return false;
    if (!selectedType) return false;
    if (selectedType.use_dn && !form.values.dn.trim()) return false;
    if (selectedType.use_dn2 && !form.values.dn2.trim()) return false;
    if (selectedType.use_sch && !form.values.sch.trim()) return false;
    if (selectedType.use_thickness && !form.values.thickness.trim()) return false;
    if (selectedType.use_pressure && !form.values.pressure_class.trim()) return false;
    if (selectedType.use_filler_type) {
      return Boolean(form.values.filler_type.trim());
    }
    return Boolean(form.values.material_id.trim());
  }, [
    form.values.project_id,
    form.values.dn,
    form.values.dn2,
    form.values.sch,
    form.values.thickness,
    form.values.pressure_class,
    form.values.filler_type,
    form.values.material_id,
    selectedType,
  ]);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;

    form.setValues(createInitialValues());
    form.clearErrors();
    setProjects([]);
    setTypes([]);
    setOptions(EMPTY_OPTIONS);
    setMaterials([]);
    setBaseError(null);
    setPickedFileLabel("");

    void (async () => {
      setBaseLoading(true);
      try {
        const [projectRows, typeRows, dnRows, schRows, pnRows, fillerRows, materialRows] = await Promise.all([
          fetchProjects(),
          fetchTraceabilityTypes(),
          fetchTraceabilityOptions("dn"),
          fetchTraceabilityOptions("sch"),
          fetchTraceabilityOptions("pn"),
          fetchTraceabilityOptions("filler_type"),
          fetchMaterials(),
        ]);
        if (cancelled) return;

        const activeProjects = projectRows.filter((row) => row.is_active);
        const visibleProjects = activeProjects.length > 0 ? activeProjects : projectRows;
        setProjects(visibleProjects);
        setTypes(typeRows);
        setOptions({
          dn: dnRows,
          sch: schRows,
          pn: pnRows,
          filler: fillerRows,
        });
        setMaterials(materialRows);

        const defaultType = typeRows[0] ?? null;
        const defaults = buildInitialValues({
          row: null,
          defaultType,
          optionsSch: schRows,
          optionsPn: pnRows,
          optionsFiller: fillerRows,
        });
        form.setValues({
          ...createInitialValues(),
          ...defaults,
        });
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setBaseError("Klarte ikke å laste data for hurtigregistrering av sporbarhet.");
      } finally {
        if (!cancelled) {
          setBaseLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const updateType = (nextTypeCode: string) => {
    form.setFieldValue("type_code", nextTypeCode);
    const nextType = lookupType(types, nextTypeCode);
    if (!nextType) return;

    if (nextType.use_sch && !form.values.sch) {
      form.setFieldValue("sch", nextType.default_sch ?? firstDefault(options.sch));
    }
    if (nextType.use_pressure && !form.values.pressure_class) {
      form.setFieldValue("pressure_class", nextType.default_pressure ?? firstDefault(options.pn));
    }
    if (nextType.use_filler_type && !form.values.filler_type) {
      form.setFieldValue("filler_type", firstDefault(options.filler));
    }

    form.setFieldValue("material_certificate_id", "");
    form.setFieldValue("heat_number", "");
    setPickedFileLabel("");
  };

  const submit = async () => {
    const projectId = form.values.project_id.trim();
    if (!projectId) {
      form.setFieldError("project_id", "Prosjekt er påkrevd.");
      return;
    }

    if (!selectedType) {
      form.setFieldError("type_code", "Kode er påkrevd.");
      return;
    }

    if (selectedType.use_dn && !form.values.dn.trim()) {
      form.setFieldError("dn", "DN er påkrevd.");
      return;
    }
    if (selectedType.use_dn2 && !form.values.dn2.trim()) {
      form.setFieldError("dn2", `${fieldLabelForDn2(selectedType.code)} er påkrevd.`);
      return;
    }
    if (selectedType.use_sch && !form.values.sch.trim()) {
      form.setFieldError("sch", "SCH er påkrevd.");
      return;
    }
    if (selectedType.use_thickness && !form.values.thickness.trim()) {
      form.setFieldError("thickness", "Tykkelse er påkrevd.");
      return;
    }
    if (selectedType.use_pressure && !form.values.pressure_class.trim()) {
      form.setFieldError("pressure_class", "Trykklasse er påkrevd.");
      return;
    }
    if (selectedType.use_filler_type && !form.values.filler_type.trim()) {
      form.setFieldError("filler_type", "Sveisetilsett type er påkrevd.");
      return;
    }
    if (!selectedType.use_filler_type && !selectedMaterial) {
      form.setFieldError("material_id", "Material er påkrevd.");
      return;
    }
    if (!form.values.heat_number.trim()) {
      form.setFieldError("heat_number", "Heat nr er påkrevd.");
      return;
    }

    const payload = normalizeSavePayload(form.values, selectedMaterial, selectedType);

    try {
      setSubmitting(true);
      try {
        await createProjectTraceability({
          project_id: projectId,
          ...payload,
        });
      } catch (err) {
        if (!isDuplicateTraceabilityCodeError(err)) {
          throw err;
        }
        // Retry once on race for next code_index.
        await createProjectTraceability({
          project_id: projectId,
          ...payload,
        });
      }

      notifySuccess("Sporbarhet registrert.");
      if (!payload.material_certificate_id && payload.heat_number) {
        toast("Lagret med manuell heat. Koble til sertifikat senere.");
      }
      form.clearErrors();
    } catch (err) {
      console.error(err);
      notifyError(err instanceof Error ? err.message : "Klarte ikke å lagre hurtigregistrering av sporbarhet.");
    } finally {
      setSubmitting(false);
    }
  };

  const certMetaText = hasSelectedCert
    ? `Valgt: ${pickedFileLabel || form.values.material_certificate_id}`
    : form.values.heat_number.trim()
      ? "Manuell heat registrert. Ikke koblet til sertifikat."
      : "Ikke koblet til sertifikat.";

  return (
    <AppDrawer
      opened={opened}
      onClose={() => {
        if (submitting) return;
        onClose();
      }}
      title="Hurtigregistrer sporbarhet"
      size="min(600px, 100vw)"
      position="right"
      busy={submitting}
    >
      <Stack gap="md">
        {baseError ? (
          <Alert color="red" variant="light">
            {baseError}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <AppSelect
            label="Prosjekt"
            value={form.values.project_id}
            onChange={(value) => form.setFieldValue("project_id", value)}
            data={projectOptions}
            error={form.errors.project_id}
            searchable
            clearable
            disabled={baseLoading || submitting}
          />
          <AppSelect
            label="Kode"
            value={form.values.type_code}
            onChange={updateType}
            data={typeOptions}
            error={form.errors.type_code}
            searchable={false}
            allowDeselect={false}
            disabled={baseLoading || submitting || types.length === 0}
          />
        </SimpleGrid>

        {selectedType?.use_dn ? (
          <AppSelect
            label="DN"
            value={form.values.dn}
            onChange={(value) => form.setFieldValue("dn", value)}
            data={optionRows(options.dn)}
            error={form.errors.dn}
            placeholder="Velg DN..."
            searchable
            disabled={baseLoading || submitting}
          />
        ) : null}

        {selectedType?.use_dn2 ? (
          <AppSelect
            label={fieldLabelForDn2(selectedType.code)}
            value={form.values.dn2}
            onChange={(value) => form.setFieldValue("dn2", value)}
            data={optionRows(options.dn)}
            error={form.errors.dn2}
            placeholder="Velg DN..."
            searchable
            disabled={baseLoading || submitting}
          />
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          {selectedType?.use_sch ? (
            <AppSelect
              label="SCH"
              value={form.values.sch}
              onChange={(value) => form.setFieldValue("sch", value)}
              data={optionRows(options.sch)}
              error={form.errors.sch}
              placeholder="Velg SCH..."
              searchable
              disabled={baseLoading || submitting}
            />
          ) : null}

          {selectedType?.use_pressure ? (
            <AppSelect
              label="Trykklasse"
              value={form.values.pressure_class}
              onChange={(value) => form.setFieldValue("pressure_class", value)}
              data={optionRows(options.pn)}
              error={form.errors.pressure_class}
              placeholder="Velg PN..."
              searchable
              disabled={baseLoading || submitting}
            />
          ) : null}

          {selectedType?.use_thickness ? (
            <AppTextInput
              label="Tykkelse (mm)"
              value={form.values.thickness}
              onChange={(value) => form.setFieldValue("thickness", value)}
              error={form.errors.thickness}
              placeholder="f.eks 8"
              disabled={baseLoading || submitting}
            />
          ) : null}
        </SimpleGrid>

        {selectedType?.use_filler_type ? (
          <AppSelect
            label="Sveisetilsett type"
            value={form.values.filler_type}
            onChange={(value) => {
              form.setFieldValue("filler_type", value);
              form.setFieldValue("material_certificate_id", "");
              form.setFieldValue("heat_number", "");
              setPickedFileLabel("");
            }}
            data={optionRows(options.filler)}
            error={form.errors.filler_type}
            placeholder="Velg type..."
            searchable
            disabled={baseLoading || submitting}
          />
        ) : (
          <AppSelect
            label="Material"
            value={form.values.material_id}
            onChange={(value) => {
              form.setFieldValue("material_id", value);
              form.setFieldValue("material_certificate_id", "");
              form.setFieldValue("heat_number", "");
              setPickedFileLabel("");
            }}
            data={materialOptions}
            error={form.errors.material_id}
            placeholder="Velg material..."
            searchable
            disabled={baseLoading || submitting}
          />
        )}

        {certificateSectionReady ? (
          <Stack gap={6}>
            <Text fw={600} size="sm">
              Sertifikat og heat
            </Text>

            <Text size="sm" c="dimmed">
              {certMetaText}
            </Text>

            <HeatCertificatePicker
              disabled={baseLoading || submitting}
              certificateType={selectedType?.use_filler_type ? "filler" : "material"}
              materialId={selectedType?.use_filler_type ? null : form.values.material_id.trim() || null}
              fillerType={selectedType?.use_filler_type ? form.values.filler_type.trim() || null : null}
              onPick={(hit) => {
                form.setFieldValue("material_certificate_id", hit.certificate_id);
                form.setFieldValue("heat_number", hit.heat_number);
                setPickedFileLabel((hit.file_label ?? "").trim());
                form.clearFieldError("heat_number");
              }}
            />

            {hasSelectedCert ? (
              <Group justify="space-between" align="flex-end">
                <AppTextInput
                  label="Heat nr"
                  value={form.values.heat_number}
                  error={form.errors.heat_number}
                  readOnly
                  disabled={baseLoading || submitting}
                />
                <AppButton
                  tone="neutral"
                  onClick={() => {
                    form.setFieldValue("material_certificate_id", "");
                    form.setFieldValue("heat_number", "");
                    setPickedFileLabel("");
                  }}
                  disabled={baseLoading || submitting}
                >
                  Tøm valg
                </AppButton>
              </Group>
            ) : (
              <Stack gap="xs">
                <Alert color="blue" variant="light">
                  Hvis du ikke finner sertifikat i søket, skriv inn heat nr manuelt.
                </Alert>
                <AppTextInput
                  label="Heat nr (manuell)"
                  value={form.values.heat_number}
                  onChange={(value) => form.setFieldValue("heat_number", value)}
                  error={form.errors.heat_number}
                  placeholder="Skriv heat nr..."
                  disabled={baseLoading || submitting}
                />
              </Stack>
            )}

            <Text size="xs" c="dimmed">
              {hasSelectedCert
                ? "Heat er låst når sertifikat er valgt. Trykk 'Tøm valg' for å registrere manuelt."
                : "Du kan registrere nå og koble til sertifikat senere."}
            </Text>
          </Stack>
        ) : (
          <Alert color="gray" variant="light">
            Velg prosjekt, kode og relevante parametere over før du registrerer sertifikat og heat.
          </Alert>
        )}

        <AppModalActions
          cancelLabel="Lukk"
          confirmLabel="Registrer sporbarhet"
          onCancel={() => {
            if (submitting) return;
            onClose();
          }}
          onConfirm={() => {
            void submit();
          }}
          confirmLoading={submitting}
          confirmDisabled={baseLoading || types.length === 0}
        />
      </Stack>
    </AppDrawer>
  );
}

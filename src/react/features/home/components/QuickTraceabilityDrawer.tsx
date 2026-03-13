import { useEffect, useMemo, useState } from "react";
import { Alert, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { fetchMaterials, type MaterialRow } from "@/repo/materialRepo";
import { fetchProjects, type ProjectRow } from "@/repo/projectRepo";
import {
  createProjectTraceability,
  fetchTraceabilityOptions,
  fetchTraceabilityProfiles,
  fetchTraceabilityTypes,
  type TraceabilityOptionRow,
  type TraceabilityProfileFieldKey,
  type TraceabilityProfileRow,
  type TraceabilityTypeRow,
} from "@/repo/traceabilityRepo";
import { AppButton } from "@react/ui/AppButton";
import { AppDrawer } from "@react/ui/AppDrawer";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppProfileSelectToggle } from "@react/ui/AppProfileSelectToggle";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import { notifyError, notifySuccess, toast } from "@react/ui/notify";
import { HeatCertificatePicker } from "@react/features/project-details/sections/traceability/components/HeatCertificatePicker";
import {
  buildInitialValues,
  defaultProfileForType,
  fieldLabelForDn2,
  isFillerProfile,
  lookupProfile,
  lookupType,
  normalizeSavePayload,
  optionRowsForField,
  profileFieldInputMode,
  profileFieldLabel,
  profileFieldRequired,
  profileHasField,
  profilesForType,
  sortedProfileFields,
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
  od: TraceabilityOptionRow[];
  sch: TraceabilityOptionRow[];
  pn: TraceabilityOptionRow[];
  filler: TraceabilityOptionRow[];
  fillerManufacturer: TraceabilityOptionRow[];
  fillerDiameter: TraceabilityOptionRow[];
};

const EMPTY_OPTIONS: TraceabilityOptionsByGroup = {
  dn: [],
  od: [],
  sch: [],
  pn: [],
  filler: [],
  fillerManufacturer: [],
  fillerDiameter: [],
};

function createInitialValues(): QuickTraceabilityFormValues {
  return {
    project_id: "",
    type_code: "",
    profile_id: "",
    dn: "",
    dn2: "",
    od: "",
    od2: "",
    sch: "",
    pressure_class: "",
    thickness: "",
    filler_manufacturer: "",
    filler_type: "",
    filler_diameter: "",
    description: "",
    custom_dimension: "",
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

function formValue(values: QuickTraceabilityFormValues, fieldKey: TraceabilityProfileFieldKey) {
  if (fieldKey === "dn") return values.dn;
  if (fieldKey === "dn2") return values.dn2;
  if (fieldKey === "od") return values.od;
  if (fieldKey === "od2") return values.od2;
  if (fieldKey === "sch") return values.sch;
  if (fieldKey === "pressure_class") return values.pressure_class;
  if (fieldKey === "thickness") return values.thickness;
  if (fieldKey === "filler_manufacturer") return values.filler_manufacturer;
  if (fieldKey === "filler_type") return values.filler_type;
  if (fieldKey === "filler_diameter") return values.filler_diameter;
  if (fieldKey === "description") return values.description;
  return values.custom_dimension;
}

export function QuickTraceabilityDrawer({ opened, onClose }: QuickTraceabilityDrawerProps) {
  const [baseLoading, setBaseLoading] = useState(false);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [types, setTypes] = useState<TraceabilityTypeRow[]>([]);
  const [profiles, setProfiles] = useState<TraceabilityProfileRow[]>([]);
  const [options, setOptions] = useState<TraceabilityOptionsByGroup>(EMPTY_OPTIONS);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [pickedFileLabel, setPickedFileLabel] = useState("");
  const [profilePickerVisible, setProfilePickerVisible] = useState(false);

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

  const selectedType = useMemo(() => lookupType(types, form.values.type_code), [types, form.values.type_code]);

  const availableProfiles = useMemo(
    () => profilesForType(profiles, form.values.type_code || selectedType?.code),
    [profiles, form.values.type_code, selectedType?.code]
  );

  const selectedProfile = useMemo(() => {
    const direct = lookupProfile(profiles, form.values.profile_id);
    if (direct && direct.type_code === form.values.type_code) return direct;
    return defaultProfileForType(profiles, form.values.type_code || selectedType?.code);
  }, [profiles, form.values.profile_id, form.values.type_code, selectedType?.code]);

  const profileFields = useMemo(() => sortedProfileFields(selectedProfile), [selectedProfile]);
  const fillerProfile = useMemo(() => isFillerProfile(selectedProfile), [selectedProfile]);

  const profileOptions = useMemo(
    () =>
      availableProfiles.map((profile) => ({
        value: profile.id,
        label: `${profile.code} - ${profile.label}`,
      })),
    [availableProfiles]
  );

  const profileSummaryText = useMemo(() => {
    if (!selectedProfile) return "Ingen profil valgt.";
    const prefix = selectedProfile.is_default ? "Standardprofil" : "Aktiv profil";
    return `${prefix}: ${selectedProfile.code} - ${selectedProfile.label}`;
  }, [selectedProfile]);

  const materialOptions = useMemo(
    () =>
      materials.map((material) => ({
        value: material.id,
        label: material.name,
      })),
    [materials]
  );

  const selectedMaterial = useMemo(() => {
    const materialId = form.values.material_id.trim();
    if (!materialId) return null;
    return materials.find((material) => material.id === materialId) ?? null;
  }, [materials, form.values.material_id]);

  const hasSelectedCert = Boolean(form.values.material_certificate_id.trim());

  const certificateSectionReady = useMemo(() => {
    if (!form.values.project_id.trim()) return false;
    if (!selectedType || !selectedProfile) return false;

    for (const field of profileFields) {
      if (!field.required) continue;
      if (!formValue(form.values, field.field_key).trim()) return false;
    }

    if (!fillerProfile && !form.values.material_id.trim()) return false;
    return true;
  }, [form.values, selectedType, selectedProfile, profileFields, fillerProfile]);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;

    form.setValues(createInitialValues());
    form.clearErrors();
    setProjects([]);
    setTypes([]);
    setProfiles([]);
    setOptions(EMPTY_OPTIONS);
    setMaterials([]);
    setBaseError(null);
    setPickedFileLabel("");
    setProfilePickerVisible(false);

    void (async () => {
      setBaseLoading(true);
      try {
        const [projectRows, typeRows, profileRows, dnRows, odRows, schRows, pnRows, fillerRows, fillerManufacturerRows, fillerDiameterRows, materialRows] = await Promise.all([
          fetchProjects(),
          fetchTraceabilityTypes(),
          fetchTraceabilityProfiles(),
          fetchTraceabilityOptions("dn"),
          fetchTraceabilityOptions("od"),
          fetchTraceabilityOptions("sch"),
          fetchTraceabilityOptions("pn"),
          fetchTraceabilityOptions("filler_type"),
          fetchTraceabilityOptions("filler_manufacturer"),
          fetchTraceabilityOptions("filler_diameter"),
          fetchMaterials(),
        ]);
        if (cancelled) return;

        const activeProjects = projectRows.filter((row) => row.is_active);
        const visibleProjects = activeProjects.length > 0 ? activeProjects : projectRows;
        setProjects(visibleProjects);
        setTypes(typeRows);
        setProfiles(profileRows);
        setOptions({
          dn: dnRows,
          od: odRows,
          sch: schRows,
          pn: pnRows,
          filler: fillerRows,
          fillerManufacturer: fillerManufacturerRows,
          fillerDiameter: fillerDiameterRows,
        });
        setMaterials(materialRows);

        const defaultType = typeRows[0] ?? null;
        const defaultProfile = defaultProfileForType(profileRows, defaultType?.code);
        const defaults = buildInitialValues({
          row: null,
          defaultType,
          defaultProfile,
          profiles: profileRows,
          options: {
            dn: dnRows,
            od: odRows,
            sch: schRows,
            pn: pnRows,
            filler: fillerRows,
            fillerManufacturer: fillerManufacturerRows,
            fillerDiameter: fillerDiameterRows,
          },
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

  useEffect(() => {
    if (profileOptions.length > 1) return;
    setProfilePickerVisible(false);
  }, [profileOptions.length]);

  const setFieldValue = (fieldKey: TraceabilityProfileFieldKey, value: string) => {
    if (fieldKey === "dn") form.setFieldValue("dn", value);
    if (fieldKey === "dn2") form.setFieldValue("dn2", value);
    if (fieldKey === "od") form.setFieldValue("od", value);
    if (fieldKey === "od2") form.setFieldValue("od2", value);
    if (fieldKey === "sch") form.setFieldValue("sch", value);
    if (fieldKey === "pressure_class") form.setFieldValue("pressure_class", value);
    if (fieldKey === "thickness") form.setFieldValue("thickness", value);
    if (fieldKey === "filler_manufacturer") form.setFieldValue("filler_manufacturer", value);
    if (fieldKey === "filler_type") form.setFieldValue("filler_type", value);
    if (fieldKey === "filler_diameter") form.setFieldValue("filler_diameter", value);
    if (fieldKey === "description") form.setFieldValue("description", value);
    if (fieldKey === "custom_dimension") form.setFieldValue("custom_dimension", value);
  };

  const updateType = (nextTypeCode: string) => {
    const nextType = lookupType(types, nextTypeCode);
    const nextProfile = defaultProfileForType(profiles, nextTypeCode);

    form.setFieldValue("type_code", nextTypeCode);
    form.setFieldValue("profile_id", nextProfile?.id ?? "");

    const defaults = buildInitialValues({
      row: null,
      defaultType: nextType ?? null,
      defaultProfile: nextProfile,
      profiles,
      options,
    });

    form.setValues({
      ...form.values,
      ...defaults,
      type_code: nextTypeCode,
      profile_id: nextProfile?.id ?? "",
    });

    form.setFieldValue("material_certificate_id", "");
    form.setFieldValue("heat_number", "");
    setPickedFileLabel("");
  };

  const updateProfile = (profileId: string) => {
    const nextProfile = lookupProfile(profiles, profileId);

    form.setFieldValue("profile_id", profileId);

    if (nextProfile) {
      if (profileHasField(nextProfile, "filler_manufacturer") && !form.values.filler_manufacturer.trim()) {
        const rows = optionRowsForField({ profile: nextProfile, fieldKey: "filler_manufacturer", options });
        const first = rows[0]?.value ?? "";
        if (first) form.setFieldValue("filler_manufacturer", first);
      }
      if (profileHasField(nextProfile, "filler_type") && !form.values.filler_type.trim()) {
        const rows = optionRowsForField({ profile: nextProfile, fieldKey: "filler_type", options });
        const first = rows[0]?.value ?? "";
        if (first) form.setFieldValue("filler_type", first);
      }
      if (profileHasField(nextProfile, "filler_diameter") && !form.values.filler_diameter.trim()) {
        const rows = optionRowsForField({ profile: nextProfile, fieldKey: "filler_diameter", options });
        const first = rows[0]?.value ?? "";
        if (first) form.setFieldValue("filler_diameter", first);
      }
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

    if (!selectedProfile) {
      form.setFieldError("profile_id", "Profil er påkrevd.");
      return;
    }

    for (const field of profileFields) {
      if (!field.required) continue;
      if (!formValue(form.values, field.field_key).trim()) {
        form.setFieldError(field.field_key, `${field.label} er påkrevd.`);
        return;
      }
    }

    if (!fillerProfile && !selectedMaterial) {
      form.setFieldError("material_id", "Material er påkrevd.");
      return;
    }

    if (!form.values.heat_number.trim()) {
      form.setFieldError("heat_number", "Heat nr er påkrevd.");
      return;
    }

    const payload = normalizeSavePayload(form.values, selectedMaterial, selectedProfile);

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

        <AppProfileSelectToggle
          visible={profilePickerVisible}
          onVisibleChange={setProfilePickerVisible}
          value={form.values.profile_id}
          onChange={updateProfile}
          data={profileOptions}
          error={form.errors.profile_id}
          disabled={baseLoading || submitting}
          selectDisabled={profileOptions.length === 0}
          toggleDisabled={profileOptions.length <= 1}
          helperText={profileSummaryText}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {profileFields.map((field) => {
            const fieldKey = field.field_key;
            const required = profileFieldRequired(selectedProfile, fieldKey);
            const inputMode = profileFieldInputMode(selectedProfile, fieldKey);
            const label =
              fieldKey === "dn2"
                ? profileFieldLabel(selectedProfile, fieldKey, fieldLabelForDn2(selectedType?.code ?? ""))
                : profileFieldLabel(selectedProfile, fieldKey, field.label);

            const currentValue = formValue(form.values, fieldKey);

            if (inputMode === "option") {
              return (
                <AppSelect
                  key={field.id}
                  label={label}
                  required={required}
                  value={currentValue}
                  onChange={(value) => {
                    setFieldValue(fieldKey, value);
                    if (
                      fieldKey === "filler_manufacturer" ||
                      fieldKey === "filler_type" ||
                      fieldKey === "filler_diameter"
                    ) {
                      form.setFieldValue("material_certificate_id", "");
                      form.setFieldValue("heat_number", "");
                      setPickedFileLabel("");
                    }
                  }}
                  data={optionRowsForField({ profile: selectedProfile, fieldKey, options })}
                  error={form.errors[fieldKey]}
                  searchable
                  disabled={baseLoading || submitting}
                />
              );
            }

            return (
              <AppTextInput
                key={field.id}
                label={label}
                value={currentValue}
                onChange={(value) => setFieldValue(fieldKey, value)}
                error={form.errors[fieldKey]}
                required={required}
                disabled={baseLoading || submitting}
              />
            );
          })}
        </SimpleGrid>

        {!fillerProfile ? (
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
        ) : null}

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
              certificateType={fillerProfile ? "filler" : "material"}
              materialId={fillerProfile ? null : form.values.material_id.trim() || null}
              fillerType={fillerProfile ? form.values.filler_type.trim() || null : null}
              fillerManufacturer={fillerProfile ? form.values.filler_manufacturer.trim() || null : null}
              fillerDiameter={fillerProfile ? form.values.filler_diameter.trim() || null : null}
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
            Velg prosjekt, kode, profil og påkrevde felt før du registrerer sertifikat og heat.
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
          confirmDisabled={baseLoading || types.length === 0 || !selectedProfile}
        />
      </Stack>
    </AppDrawer>
  );
}

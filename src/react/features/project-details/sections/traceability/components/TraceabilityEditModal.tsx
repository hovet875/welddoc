import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppProfileSelectToggle } from "@react/ui/AppProfileSelectToggle";
import { AppSelect } from "@react/ui/AppSelect";
import { notifyError } from "@react/ui/notify";
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
  profilesForType,
  sortedProfileFields,
} from "../lib/traceabilityUtils";
import type { TraceabilityEditModalProps, TraceabilityModalValues } from "../types";
import { HeatCertificatePicker } from "./HeatCertificatePicker";

export function TraceabilityEditModal({
  opened,
  row,
  saving,
  isAdmin,
  types,
  profiles,
  options,
  materials,
  onClose,
  onSubmit,
}: TraceabilityEditModalProps) {
  const defaultType = types[0] ?? null;
  const defaultProfile = defaultProfileForType(profiles, row?.type_code ?? defaultType?.code);

  const form = useForm<TraceabilityModalValues>({
    initialValues: buildInitialValues({
      row,
      defaultType,
      defaultProfile,
      profiles,
      options,
    }),
  });

  const [pickedFileLabel, setPickedFileLabel] = useState<string>("");
  const [profilePickerVisible, setProfilePickerVisible] = useState(false);

  useEffect(() => {
    if (!opened) return;

    const nextDefaultType = row?.type ?? lookupType(types, row?.type_code) ?? types[0] ?? null;
    const nextDefaultProfile =
      row?.profile ??
      lookupProfile(profiles, row?.profile_id) ??
      defaultProfileForType(profiles, row?.type_code ?? nextDefaultType?.code) ??
      null;

    form.setValues(
      buildInitialValues({
        row,
        defaultType: nextDefaultType,
        defaultProfile: nextDefaultProfile,
        profiles,
        options,
      })
    );

    // For edit-mode: show existing file label if available
    setPickedFileLabel(row?.cert?.file?.label?.trim() ?? "");
    setProfilePickerVisible(false);

    form.resetDirty();
    form.clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, row?.id, types, profiles]);

  const selectedType = useMemo(
    () => lookupType(types, form.values.type_code) ?? defaultType,
    [types, form.values.type_code, defaultType]
  );

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

  const selectedMaterial = useMemo(() => {
    const id = form.values.material_id.trim();
    if (!id) return null;
    return materials.find((material) => material.id === id) ?? null;
  }, [materials, form.values.material_id]);

  const typeOptions = useMemo(
    () =>
      types.map((type) => ({
        value: type.code,
        label: `${type.code} – ${type.label}`,
      })),
    [types]
  );

  const profileOptions = useMemo(
    () =>
      availableProfiles.map((profile) => ({
        value: profile.id,
        label: `${profile.code} – ${profile.label}`,
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

  useEffect(() => {
    if (profileOptions.length > 1) return;
    setProfilePickerVisible(false);
  }, [profileOptions.length]);

  const updateType = (value: string) => {
    const nextType = lookupType(types, value);
    const nextProfile = defaultProfileForType(profiles, value);

    form.setFieldValue("type_code", value);
    form.setFieldValue("profile_id", nextProfile?.id ?? "");

    const defaults = buildInitialValues({
      row: null,
      defaultType: nextType ?? null,
      defaultProfile: nextProfile,
      profiles,
      options,
    });
    form.setValues({ ...form.values, ...defaults, type_code: value, profile_id: nextProfile?.id ?? "" });
    form.setFieldValue("material_certificate_id", "");
    form.setFieldValue("heat_number", "");
    setPickedFileLabel("");
  };

  const updateProfile = (value: string) => {
    const nextProfile = lookupProfile(profiles, value);
    form.setFieldValue("profile_id", value);

    if (nextProfile?.id) {
      const nextFields = sortedProfileFields(nextProfile);
      if (nextFields.some((field) => field.field_key === "filler_manufacturer") && !form.values.filler_manufacturer.trim()) {
        const rows = optionRowsForField({ profile: nextProfile, fieldKey: "filler_manufacturer", options });
        const first = rows[0]?.value ?? "";
        if (first) form.setFieldValue("filler_manufacturer", first);
      }
      if (nextFields.some((field) => field.field_key === "filler_type") && !form.values.filler_type.trim()) {
        const rows = optionRowsForField({ profile: nextProfile, fieldKey: "filler_type", options });
        const first = rows[0]?.value ?? "";
        if (first) form.setFieldValue("filler_type", first);
      }
      if (nextFields.some((field) => field.field_key === "filler_diameter") && !form.values.filler_diameter.trim()) {
        const rows = optionRowsForField({ profile: nextProfile, fieldKey: "filler_diameter", options });
        const first = rows[0]?.value ?? "";
        if (first) form.setFieldValue("filler_diameter", first);
      }
    }

    form.setFieldValue("material_certificate_id", "");
    form.setFieldValue("heat_number", "");
    setPickedFileLabel("");
  };

  const hasSelectedCert = Boolean(form.values.material_certificate_id.trim());

  const submit = async () => {
    if (!isAdmin) return notifyError("Du må være admin for å gjøre dette.");
    if (!selectedType) return notifyError("Mangler type-oppsett i app-parametre.");
    if (!selectedProfile) return notifyError("Mangler sporbarhetsprofil.");

    const valueForField = (fieldKey: string) => {
      if (fieldKey === "dn") return form.values.dn.trim();
      if (fieldKey === "dn2") return form.values.dn2.trim();
      if (fieldKey === "od") return form.values.od.trim();
      if (fieldKey === "od2") return form.values.od2.trim();
      if (fieldKey === "sch") return form.values.sch.trim();
      if (fieldKey === "pressure_class") return form.values.pressure_class.trim();
      if (fieldKey === "thickness") return form.values.thickness.trim();
      if (fieldKey === "filler_manufacturer") return form.values.filler_manufacturer.trim();
      if (fieldKey === "filler_type") return form.values.filler_type.trim();
      if (fieldKey === "filler_diameter") return form.values.filler_diameter.trim();
      if (fieldKey === "description") return form.values.description.trim();
      return form.values.custom_dimension.trim();
    };

    for (const field of profileFields) {
      if (!field.required) continue;
      const value = valueForField(field.field_key);
      if (!value) {
        return notifyError(`${field.label || "Felt"} er påkrevd.`);
      }
    }

    if (!fillerProfile && !selectedMaterial) {
      return notifyError("Velg material fra listen.");
    }

    const heat = form.values.heat_number.trim();
    if (!heat) {
      return notifyError("Skriv heat nr manuelt eller søk opp via sertifikat.");
    }

    await onSubmit(normalizeSavePayload(form.values, selectedMaterial, selectedProfile));
  };

const modeLabel = row ? "Endre sporbarhet" : "Ny sporbarhet";

const heat = form.values.heat_number.trim();

const certMetaText = hasSelectedCert
  ? `Valgt: ${pickedFileLabel || row?.cert?.file?.label || form.values.material_certificate_id}`
  : heat
    ? "Manuell heat registrert. Ikke koblet til sertifikat."
    : "Ikke koblet til sertifikat.";

  return (
    <AppModal opened={opened} onClose={onClose} title={modeLabel} size="xl" busy={saving}>
      <Stack gap="md">
        {types.length === 0 ? (
          <Alert color="yellow" variant="light">
            Mangler type-oppsett i app-parametre.
          </Alert>
        ) : null}

        <AppSelect
          label="Kode"
          value={form.values.type_code}
          onChange={updateType}
          data={typeOptions}
          allowDeselect={false}
          searchable={false}
          disabled={saving}
        />

        <AppProfileSelectToggle
          visible={profilePickerVisible}
          onVisibleChange={setProfilePickerVisible}
          value={form.values.profile_id}
          onChange={updateProfile}
          data={profileOptions}
          disabled={saving}
          selectDisabled={profileOptions.length === 0}
          toggleDisabled={profileOptions.length <= 1}
          helperText={profileSummaryText}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {profileFields.map((field) => {
            const fieldKey = field.field_key;
            const inputMode = profileFieldInputMode(selectedProfile, fieldKey);
            const required = profileFieldRequired(selectedProfile, fieldKey);
            const label =
              fieldKey === "dn2"
                ? profileFieldLabel(selectedProfile, fieldKey, fieldLabelForDn2(selectedType?.code ?? ""))
                : profileFieldLabel(selectedProfile, fieldKey, field.label);

            const commonProps = {
              label,
              disabled: saving,
              required,
            };

            if (inputMode === "option") {
              const data = optionRowsForField({ profile: selectedProfile, fieldKey, options });
              const value =
                fieldKey === "dn"
                  ? form.values.dn
                  : fieldKey === "dn2"
                    ? form.values.dn2
                    : fieldKey === "od"
                      ? form.values.od
                      : fieldKey === "od2"
                        ? form.values.od2
                        : fieldKey === "sch"
                          ? form.values.sch
                            : fieldKey === "pressure_class"
                              ? form.values.pressure_class
                            : fieldKey === "filler_type"
                              ? form.values.filler_type
                            : fieldKey === "filler_manufacturer"
                              ? form.values.filler_manufacturer
                              : fieldKey === "filler_diameter"
                                ? form.values.filler_diameter
                              : "";

              return (
                <AppSelect
                  key={field.id}
                  {...commonProps}
                  value={value}
                  data={data}
                  searchable
                  onChange={(nextValue) => {
                    if (fieldKey === "dn") form.setFieldValue("dn", nextValue);
                    if (fieldKey === "dn2") form.setFieldValue("dn2", nextValue);
                    if (fieldKey === "od") form.setFieldValue("od", nextValue);
                    if (fieldKey === "od2") form.setFieldValue("od2", nextValue);
                    if (fieldKey === "sch") form.setFieldValue("sch", nextValue);
                    if (fieldKey === "pressure_class") form.setFieldValue("pressure_class", nextValue);
                    if (fieldKey === "filler_manufacturer") form.setFieldValue("filler_manufacturer", nextValue);
                    if (fieldKey === "filler_type") form.setFieldValue("filler_type", nextValue);
                    if (fieldKey === "filler_diameter") form.setFieldValue("filler_diameter", nextValue);
                    if (fieldKey === "filler_manufacturer" || fieldKey === "filler_type" || fieldKey === "filler_diameter") {
                      form.setFieldValue("material_certificate_id", "");
                      form.setFieldValue("heat_number", "");
                      setPickedFileLabel("");
                    }
                  }}
                />
              );
            }

            const textValue =
              fieldKey === "dn"
                ? form.values.dn
                : fieldKey === "dn2"
                  ? form.values.dn2
                  : fieldKey === "od"
                    ? form.values.od
                    : fieldKey === "od2"
                      ? form.values.od2
                      : fieldKey === "sch"
                        ? form.values.sch
                        : fieldKey === "pressure_class"
                          ? form.values.pressure_class
                          : fieldKey === "thickness"
                            ? form.values.thickness
                            : fieldKey === "filler_manufacturer"
                              ? form.values.filler_manufacturer
                            : fieldKey === "filler_type"
                              ? form.values.filler_type
                              : fieldKey === "filler_diameter"
                                ? form.values.filler_diameter
                              : fieldKey === "description"
                                ? form.values.description
                                : form.values.custom_dimension;

            return (
              <TextInput
                key={field.id}
                {...commonProps}
                value={textValue}
                onChange={(event) => {
                  const value = event.currentTarget.value;
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
                }}
              />
            );
          })}
        </SimpleGrid>

        {!fillerProfile && (
          <AppSelect
            label="Material"
            value={form.values.material_id}
            onChange={(value) => {
              form.setFieldValue("material_id", value);
              // changing material invalidates cert/heat selection
              form.setFieldValue("material_certificate_id", "");
              form.setFieldValue("heat_number", "");
              setPickedFileLabel("");
            }}
            data={materialOptions}
            placeholder="Velg material..."
            searchable
            disabled={saving}
          />
        )}

        <Stack gap={6}>
          <Text fw={600} size="sm">
            Sertifikat
          </Text>

          <Text size="sm" c="dimmed">
            {certMetaText}
          </Text>

          <HeatCertificatePicker
            disabled={saving}
            certificateType={fillerProfile ? "filler" : "material"}
            materialId={fillerProfile ? null : form.values.material_id.trim() || null}
            fillerType={fillerProfile ? form.values.filler_type.trim() || null : null}
            fillerManufacturer={fillerProfile ? form.values.filler_manufacturer.trim() || null : null}
            fillerDiameter={fillerProfile ? form.values.filler_diameter.trim() || null : null}
            onPick={(hit) => {
              form.setFieldValue("material_certificate_id", hit.certificate_id);
              form.setFieldValue("heat_number", hit.heat_number);
              setPickedFileLabel((hit.file_label ?? "").trim());
            }}
          />

          {hasSelectedCert ? (
            <Group justify="space-between" align="flex-end">
              <TextInput label="Heat nr" value={form.values.heat_number} readOnly disabled={saving} />
              <Button
                variant="light"
                color="gray"
                onClick={() => {
                  form.setFieldValue("material_certificate_id", "");
                  form.setFieldValue("heat_number", "");
                  setPickedFileLabel("");
                }}
                disabled={saving}
              >
                Tøm valg
              </Button>
            </Group>
          ) : (
            <TextInput
              label="Heat nr (manuell)"
              value={form.values.heat_number}
              onChange={(event) => form.setFieldValue("heat_number", event.currentTarget.value)}
              placeholder="Skriv heat nr..."
              disabled={saving}
            />
          )}

          <Text size="xs" c="dimmed">
            {hasSelectedCert
              ? "Heat er låst når sertifikat er valgt. Trykk “Tøm valg” for å registrere manuelt."
              : "Du kan registrere sveisen nå og koble til sertifikat senere."}
          </Text>
        </Stack>

        <AppModalActions
          cancelLabel="Avbryt"
          confirmLabel="Lagre"
          onCancel={onClose}
          onConfirm={() => void submit()}
          confirmLoading={saving}
          confirmDisabled={!isAdmin || !selectedType || !selectedProfile}
        />
      </Stack>
    </AppModal>
  );
}

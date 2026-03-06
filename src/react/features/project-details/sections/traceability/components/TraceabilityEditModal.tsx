import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppSelect } from "@react/ui/AppSelect";
import { notifyError } from "@react/ui/notify";
import {
  buildInitialValues,
  fieldLabelForDn2,
  firstDefault,
  lookupType,
  normalizeSavePayload,
} from "../lib/traceabilityUtils";
import type { TraceabilityEditModalProps, TraceabilityModalValues } from "../types";
import { HeatCertificatePicker } from "./HeatCertificatePicker";

export function TraceabilityEditModal({
  opened,
  row,
  saving,
  isAdmin,
  types,
  options,
  materials,
  onClose,
  onSubmit,
}: TraceabilityEditModalProps) {
  const defaultType = types[0] ?? null;

  const form = useForm<TraceabilityModalValues>({
    initialValues: buildInitialValues({
      row,
      defaultType,
      optionsSch: options.sch,
      optionsPn: options.pn,
      optionsFiller: options.filler,
    }),
  });

  const [pickedFileLabel, setPickedFileLabel] = useState<string>("");

  useEffect(() => {
    if (!opened) return;

    const nextDefaultType = row?.type ?? lookupType(types, row?.type_code) ?? types[0] ?? null;

    form.setValues(
      buildInitialValues({
        row,
        defaultType: nextDefaultType,
        optionsSch: options.sch,
        optionsPn: options.pn,
        optionsFiller: options.filler,
      })
    );

    // For edit-mode: show existing file label if available
    setPickedFileLabel(row?.cert?.file?.label?.trim() ?? "");

    form.resetDirty();
    form.clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, row?.id, types]);

  const selectedType = useMemo(
    () => lookupType(types, form.values.type_code) ?? defaultType,
    [types, form.values.type_code, defaultType]
  );

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

  const materialOptions = useMemo(
    () =>
      materials.map((material) => ({
        value: material.id,
        label: material.name,
      })),
    [materials]
  );

  const optionRows = (items: Array<{ value: string; label?: string }>) =>
    items.map((item) => ({ value: item.value, label: item.label ?? item.value }));

  const updateType = (value: string) => {
    form.setFieldValue("type_code", value);
    const next = lookupType(types, value);
    if (!next) return;

    if (next.use_sch && !form.values.sch) {
      form.setFieldValue("sch", next.default_sch ?? firstDefault(options.sch));
    }
    if (next.use_pressure && !form.values.pressure_class) {
      form.setFieldValue("pressure_class", next.default_pressure ?? firstDefault(options.pn));
    }
    if (next.use_filler_type && !form.values.filler_type) {
      form.setFieldValue("filler_type", firstDefault(options.filler));
    }

    // If type toggles between material/filler, clear cert + heat (safer UX)
    form.setFieldValue("material_certificate_id", "");
    form.setFieldValue("heat_number", "");
    setPickedFileLabel("");
  };

  const hasSelectedCert = Boolean(form.values.material_certificate_id.trim());

  const submit = async () => {
    if (!isAdmin) return notifyError("Du må være admin for å gjøre dette.");
    if (!selectedType) return notifyError("Mangler type-oppsett i app-parametre.");

    // Validate required fields based on type config
    if (selectedType.use_dn && !form.values.dn.trim()) return notifyError("Velg DN.");
    if (selectedType.use_dn2 && !form.values.dn2.trim()) return notifyError("Velg DN2.");
    if (selectedType.use_sch && !form.values.sch.trim()) return notifyError("Velg SCH.");
    if (selectedType.use_thickness && !form.values.thickness.trim()) return notifyError("Fyll inn tykkelse.");
    if (selectedType.use_pressure && !form.values.pressure_class.trim()) return notifyError("Velg trykklasse.");
    if (selectedType.use_filler_type && !form.values.filler_type.trim()) return notifyError("Velg sveisetilsett type.");

    // Material required when not filler type
    if (!selectedType.use_filler_type && !selectedMaterial) {
      return notifyError("Velg material fra listen.");
    }

    // Heat rules:
    // - if cert picked: heat must exist (it will be locked)
    // - else: heat must be manually provided
    const heat = form.values.heat_number.trim();
    if (!heat) {
      return notifyError("Skriv heat nr manuelt eller søk opp via sertifikat.");
    }

    await onSubmit(normalizeSavePayload(form.values, selectedMaterial, selectedType));
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

        {selectedType?.use_dn ? (
          <AppSelect
            label="DN"
            value={form.values.dn}
            onChange={(value) => form.setFieldValue("dn", value)}
            data={optionRows(options.dn)}
            placeholder="Velg DN..."
            searchable
            disabled={saving}
          />
        ) : null}

        {selectedType?.use_dn2 ? (
          <AppSelect
            label={fieldLabelForDn2(selectedType.code)}
            value={form.values.dn2}
            onChange={(value) => form.setFieldValue("dn2", value)}
            data={optionRows(options.dn)}
            placeholder="Velg DN..."
            searchable
            disabled={saving}
          />
        ) : null}

        <Group grow align="flex-start">
          {selectedType?.use_sch ? (
            <AppSelect
              label="SCH"
              value={form.values.sch}
              onChange={(value) => form.setFieldValue("sch", value)}
              data={optionRows(options.sch)}
              placeholder="Velg SCH..."
              searchable
              disabled={saving}
            />
          ) : null}

          {selectedType?.use_pressure ? (
            <AppSelect
              label="Trykklasse"
              value={form.values.pressure_class}
              onChange={(value) => form.setFieldValue("pressure_class", value)}
              data={optionRows(options.pn)}
              placeholder="Velg PN..."
              searchable
              disabled={saving}
            />
          ) : null}

          {selectedType?.use_thickness ? (
            <TextInput
              label="Tykkelse (mm)"
              value={form.values.thickness}
              onChange={(event) => form.setFieldValue("thickness", event.currentTarget.value)}
              placeholder="f.eks 8"
              disabled={saving}
            />
          ) : null}
        </Group>

        {selectedType?.use_filler_type ? (
          <AppSelect
            label="Sveisetilsett type"
            value={form.values.filler_type}
            onChange={(value) => {
              form.setFieldValue("filler_type", value);
              // changing filler type invalidates cert/heat selection
              form.setFieldValue("material_certificate_id", "");
              form.setFieldValue("heat_number", "");
              setPickedFileLabel("");
            }}
            data={optionRows(options.filler)}
            placeholder="Velg type..."
            searchable
            disabled={saving}
          />
        ) : (
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
            certificateType={selectedType?.use_filler_type ? "filler" : "material"}
            materialId={selectedType?.use_filler_type ? null : form.values.material_id.trim() || null}
            fillerType={selectedType?.use_filler_type ? form.values.filler_type.trim() || null : null}
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
          confirmDisabled={!isAdmin || !selectedType}
        />
      </Stack>
    </AppModal>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useForm } from "@mantine/form";
import { Alert, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { MaterialRow } from "@/repo/materialRepo";
import type { MaterialCertificateRow, MaterialCertificateType } from "@/repo/materialCertificateRepo";
import { validatePdfFile } from "@/utils/format";
import { AppAutocomplete } from "@react/ui/AppAutocomplete";
import { AppButton } from "@react/ui/AppButton";
import { AppFileInput } from "@react/ui/AppFileInput";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTagsInput } from "@react/ui/AppTagsInput";
import {
  heatNumbersToTags,
  MATERIAL_CERT_TYPE_OPTIONS,
  normalizeHeatNumbers,
  trimOrEmpty,
  withCurrentOption,
} from "../lib/materialCertsView";

export type MaterialCertModalSubmit = {
  rowId: string;
  patch: {
    certificate_type: MaterialCertificateType;
    cert_type: string;
    material_id: string | null;
    filler_type: string | null;
    supplier: string | null;
    heat_numbers: string[];
  };
  pdfFile: File | null;
};

type MaterialCertModalProps = {
  opened: boolean;
  row: MaterialCertificateRow | null;
  materials: MaterialRow[];
  supplierSuggestions: string[];
  fillerTypeNames: string[];
  onClose: () => void;
  onSubmit: (submission: MaterialCertModalSubmit) => Promise<void>;
  onOpenExistingPdf: (ref: string, title: string) => void;
};

type MaterialCertFormValues = {
  certificateType: MaterialCertificateType;
  certType: string;
  materialId: string;
  fillerType: string;
  supplier: string;
  heatNumbers: string[];
  pdfFile: File | null;
};

function createInitialValues(row: MaterialCertificateRow | null): MaterialCertFormValues {
  return {
    certificateType: row?.certificate_type ?? "material",
    certType: trimOrEmpty(row?.cert_type) || "3.1",
    materialId: trimOrEmpty(row?.material_id),
    fillerType: trimOrEmpty(row?.filler_type),
    supplier: trimOrEmpty(row?.supplier),
    heatNumbers: heatNumbersToTags(row?.heat_numbers),
    pdfFile: null,
  };
}

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function MaterialCertModal({
  opened,
  row,
  materials,
  supplierSuggestions,
  fillerTypeNames,
  onClose,
  onSubmit,
  onOpenExistingPdf,
}: MaterialCertModalProps) {
  const form = useForm<MaterialCertFormValues>({
    initialValues: createInitialValues(null),
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) {
      setError(null);
      setSubmitting(false);
      return;
    }

    form.setValues(createInitialValues(row));
    form.resetDirty();
    setError(null);
    setSubmitting(false);
  }, [opened, row]);

  const values = form.values;

  const materialOptions = useMemo(
    () =>
      materials.map((material) => ({
        value: material.id,
        label: material.name,
      })),
    [materials]
  );

  const fillerTypeOptions = useMemo(
    () => withCurrentOption(fillerTypeNames.map((value) => ({ value, label: value })), values.fillerType),
    [fillerTypeNames, values.fillerType]
  );

  const submit = async () => {
    if (!row) return;

    setSubmitting(true);
    setError(null);

    try {
      const certificateType = values.certificateType;
      const certType = trimOrEmpty(values.certType) || "3.1";
      const materialId = trimOrEmpty(values.materialId);
      const fillerType = trimOrEmpty(values.fillerType);
      const supplier = trimOrEmpty(values.supplier);
      const heatNumbers = normalizeHeatNumbers(values.heatNumbers);

      if (certificateType === "material" && !materialId) {
        throw new Error("Velg material for materialsertifikatet.");
      }

      if (certificateType === "filler" && !fillerType) {
        throw new Error("Velg type for sveisetilsett-sertifikatet.");
      }

      if (values.pdfFile) {
        const pdfError = validatePdfFile(values.pdfFile, 25);
        if (pdfError) throw new Error(pdfError);
      }

      await onSubmit({
        rowId: row.id,
        patch: {
          certificate_type: certificateType,
          cert_type: certType,
          material_id: certificateType === "material" ? materialId : null,
          filler_type: certificateType === "filler" ? fillerType : null,
          supplier: supplier || null,
          heat_numbers: heatNumbers,
        },
        pdfFile: values.pdfFile,
      });
    } catch (err) {
      console.error(err);
      setSubmitting(false);
      setError(readErrorMessage(err, "Kunne ikke oppdatere materialsertifikatet."));
    }
  };

  return (
    <AppModal opened={opened} onClose={onClose} title="Endre materialsertifikat" busy={submitting} size="lg">
      <Stack gap="sm">
        {error ? (
          <Alert color="red" variant="light" title="Feil">
            {error}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <AppSelect
            label="Type"
            value={values.certificateType}
            onChange={(value) =>
              form.setFieldValue("certificateType", value === "filler" ? "filler" : "material")
            }
            data={[
              { value: "material", label: "Material" },
              { value: "filler", label: "Sveisetilsett" },
            ]}
            allowDeselect={false}
          />
          <AppSelect
            label="Sertifikattype"
            value={values.certType}
            onChange={(value) => form.setFieldValue("certType", value || "3.1")}
            data={MATERIAL_CERT_TYPE_OPTIONS}
            allowDeselect={false}
          />
          {values.certificateType === "material" ? (
            <AppSelect
              label="Material"
              value={values.materialId}
              onChange={(value) => form.setFieldValue("materialId", value)}
              data={materialOptions}
              placeholder="Velg material..."
              searchable
            />
          ) : (
            <AppSelect
              label="Sveisetilsett-type"
              value={values.fillerType}
              onChange={(value) => form.setFieldValue("fillerType", value)}
              data={fillerTypeOptions}
              placeholder="Velg type..."
              searchable
            />
          )}
          <AppAutocomplete
            label="Leverandør"
            value={values.supplier}
            onChange={(value) => form.setFieldValue("supplier", value)}
            data={supplierSuggestions}
            placeholder="Leverandør"
            mobileSearchable
          />
        </SimpleGrid>

        <AppTagsInput
          label="Heat nr."
          description="Trykk Enter, komma eller lim inn flere verdier. Hver verdi blir eget heat."
          value={values.heatNumbers}
          onChange={(value) => form.setFieldValue("heatNumbers", normalizeHeatNumbers(value))}
          placeholder="Legg til heat nr."
        />

        <Stack gap={6}>
          <AppFileInput
            label="Erstatt PDF (valgfritt)"
            value={values.pdfFile}
            onChange={(value) => form.setFieldValue("pdfFile", value)}
            accept="application/pdf"
            clearable
          />
          {row?.file_id ? (
            <Group gap="sm" justify="space-between" wrap="wrap">
              <Text size="sm" c="dimmed">
                Eksisterende PDF beholdes hvis du ikke velger ny fil.
              </Text>
              <AppButton
                tone="neutral"
                size="sm"
                leftSection={<IconEye size={14} />}
                onClick={() => onOpenExistingPdf(row.file_id!, row.file?.label ?? "Materialsertifikat")}
              >
                Vis eksisterende PDF
              </AppButton>
            </Group>
          ) : null}
        </Stack>
      </Stack>

      <AppModalActions
        confirmLabel="Oppdater"
        onCancel={onClose}
        onConfirm={() => void submit()}
        cancelDisabled={submitting}
        confirmLoading={submitting}
      />
    </AppModal>
  );
}

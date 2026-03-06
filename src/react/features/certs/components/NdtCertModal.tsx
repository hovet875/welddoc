import { useEffect, useMemo, useState } from "react";
import { useForm } from "@mantine/form";
import { Alert, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { NdtCertRow, UpsertNdtCertInput } from "@/repo/certRepo";
import { validatePdfFile } from "@/utils/format";
import { AppButton } from "@react/ui/AppButton";
import { AppDateInput } from "@react/ui/AppDateInput";
import { AppFileInput } from "@react/ui/AppFileInput";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import { type SelectOption, trimOrEmpty } from "../lib/certsView";

type ModalMode = "new" | "edit" | "renew";

export type NdtCertModalSubmit = {
  mode: ModalMode;
  rowId: string | null;
  payload: UpsertNdtCertInput;
  pdfFile: File | null;
  removePdf: boolean;
};

type NdtCertModalProps = {
  opened: boolean;
  mode: ModalMode;
  row: NdtCertRow | null;
  companyOptions: SelectOption[];
  methodOptions: SelectOption[];
  inspectorOptionsByCompany: Record<string, SelectOption[]>;
  onClose: () => void;
  onSubmit: (payload: NdtCertModalSubmit) => Promise<void>;
  onOpenExistingPdf?: (ref: string) => void;
};

type NdtCertFormValues = {
  company: string;
  personnelName: string;
  certificateNo: string;
  ndtMethod: string;
  expiresAt: string;
  pdfFile: File | null;
  removePdf: boolean;
};

function createInitialValues(row: NdtCertRow | null, mode: ModalMode): NdtCertFormValues {
  if (!row || mode === "new") {
    return {
      company: "",
      personnelName: "",
      certificateNo: "",
      ndtMethod: "",
      expiresAt: "",
      pdfFile: null,
      removePdf: false,
    };
  }

  return {
    company: row.company ?? "",
    personnelName: row.personnel_name ?? "",
    certificateNo: row.certificate_no ?? "",
    ndtMethod: row.ndt_method ?? "",
    expiresAt: row.expires_at ?? "",
    pdfFile: null,
    removePdf: false,
  };
}

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function NdtCertModal({
  opened,
  mode,
  row,
  companyOptions,
  methodOptions,
  inspectorOptionsByCompany,
  onClose,
  onSubmit,
  onOpenExistingPdf,
}: NdtCertModalProps) {
  const form = useForm<NdtCertFormValues>({
    initialValues: createInitialValues(null, "new"),
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) {
      setError(null);
      setSubmitting(false);
      return;
    }

    form.setValues(createInitialValues(row, mode));
    form.resetDirty();
    form.clearErrors();
    setError(null);
    setSubmitting(false);
  }, [mode, opened, row]);

  const values = form.values;

  const inspectorOptions = useMemo(() => {
    if (!values.company) return [] as SelectOption[];
    return inspectorOptionsByCompany[values.company] ?? [];
  }, [inspectorOptionsByCompany, values.company]);

  const inspectorOptionsWithCurrent = useMemo(() => {
    if (!values.personnelName || inspectorOptions.some((item) => item.value === values.personnelName)) {
      return inspectorOptions;
    }
    return [...inspectorOptions, { value: values.personnelName, label: `${values.personnelName} (ukjent)` }];
  }, [inspectorOptions, values.personnelName]);

  const existingPdfRef = row ? row.file_id || row.pdf_path || null : null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const personnelName = trimOrEmpty(values.personnelName);
      const company = trimOrEmpty(values.company);
      const certificateNo = trimOrEmpty(values.certificateNo);
      const ndtMethod = trimOrEmpty(values.ndtMethod);
      const expiresAt = trimOrEmpty(values.expiresAt) || null;

      if (!personnelName || !company || !certificateNo || !ndtMethod) {
        throw new Error("Fyll ut kontrollør, firma, sertifikatnr og NDT-metode.");
      }

      if (values.pdfFile) {
        const pdfError = validatePdfFile(values.pdfFile, 25);
        if (pdfError) throw new Error(pdfError);
      }

      if (mode === "new" && !values.pdfFile) {
        throw new Error("PDF må lastes opp for å opprette sertifikat.");
      }

      if (mode === "renew" && !values.pdfFile) {
        throw new Error("Last opp ny PDF for å fornye sertifikatet.");
      }

      if (mode === "renew" && !expiresAt) {
        throw new Error("Velg ny utløpsdato.");
      }

      const payload: UpsertNdtCertInput = {
        personnel_name: personnelName,
        company,
        certificate_no: certificateNo,
        ndt_method: ndtMethod,
        expires_at: expiresAt,
      };

      await onSubmit({
        mode,
        rowId: row?.id ?? null,
        payload,
        pdfFile: values.pdfFile,
        removePdf: values.removePdf && !values.pdfFile,
      });
    } catch (err) {
      console.error(err);
      setSubmitting(false);
      setError(readErrorMessage(err, "Kunne ikke lagre NDT-sertifikat."));
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={
        mode === "new"
          ? "Legg til NDT-sertifikat"
          : mode === "renew"
            ? "Forny NDT-sertifikat"
            : "Endre NDT-sertifikat"
      }
      busy={submitting}
      size="lg"
    >
      <Stack gap="sm">
        {error ? (
          <Alert color="red" variant="light" title="Feil">
            {error}
          </Alert>
        ) : null}

        {mode === "renew" ? (
          <Stack gap="sm">
            <AppTextInput label="Sertifikat" value={values.certificateNo} disabled />
            <AppDateInput
              label="Ny utløpsdato"
              value={values.expiresAt}
              onChange={(value) => form.setFieldValue("expiresAt", value)}
              placeholder="Velg dato"
            />
            <AppFileInput
              label="Ny PDF (påkrevd)"
              value={values.pdfFile}
              onChange={(value) => {
                form.setFieldValue("pdfFile", value);
                form.setFieldValue("removePdf", false);
              }}
              accept="application/pdf"
              clearable
            />
            <Text c="dimmed" size="sm">
              Ved fornying oppdateres kun utløpsdato og PDF.
            </Text>
          </Stack>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              <AppSelect
                label="Firma"
                value={values.company}
                onChange={(value) => {
                  form.setFieldValue("company", value);
                  form.setFieldValue("personnelName", values.company === value ? values.personnelName : "");
                }}
                data={companyOptions}
                placeholder="Velg firma..."
                searchable
              />
              <AppSelect
                label="NDT-kontrollør"
                value={values.personnelName}
                onChange={(value) => form.setFieldValue("personnelName", value)}
                data={inspectorOptionsWithCurrent}
                placeholder={values.company ? "Velg kontrollør..." : "Velg firma først"}
                disabled={!values.company}
                searchable
              />
              <AppTextInput
                label="Sertifikatnr"
                value={values.certificateNo}
                onChange={(value) => form.setFieldValue("certificateNo", value)}
              />
              <AppSelect
                label="NDT-metode"
                value={values.ndtMethod}
                onChange={(value) => form.setFieldValue("ndtMethod", value)}
                data={methodOptions}
                placeholder="Velg NDT-metode..."
                searchable
              />
              <AppDateInput
                label="Utløpsdato"
                value={values.expiresAt}
                onChange={(value) => form.setFieldValue("expiresAt", value)}
                placeholder="Velg dato"
              />
            </SimpleGrid>

            <AppFileInput
              label={mode === "new" ? "PDF (påkrevd)" : "Ny PDF (valgfri)"}
              value={values.pdfFile}
              onChange={(value) => {
                form.setFieldValue("pdfFile", value);
                form.setFieldValue("removePdf", value ? false : values.removePdf);
              }}
              accept="application/pdf"
              clearable
            />
          </>
        )}

        {mode === "edit" && existingPdfRef ? (
          <Group gap="sm">
            <AppButton
              tone="neutral"
              size="sm"
              leftSection={<IconEye size={14} />}
              onClick={() => onOpenExistingPdf?.(existingPdfRef)}
            >
              Vis eksisterende PDF
            </AppButton>
            <AppButton
              tone={values.removePdf ? "danger" : "neutral"}
              size="sm"
              onClick={() => form.setFieldValue("removePdf", !values.removePdf)}
              disabled={values.pdfFile != null}
            >
              {values.removePdf ? "PDF markert for sletting" : "Marker PDF for sletting"}
            </AppButton>
          </Group>
        ) : null}
      </Stack>

      <AppModalActions
        confirmLabel={mode === "new" ? "Lagre" : "Oppdater"}
        onCancel={onClose}
        onConfirm={() => void submit()}
        cancelDisabled={submitting}
        confirmLoading={submitting}
      />
    </AppModal>
  );
}

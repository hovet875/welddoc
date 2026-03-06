import { useEffect, useMemo, useState } from "react";
import { useForm } from "@mantine/form";
import { Alert, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { UpsertWelderCertInput, WelderCertRow } from "@/repo/certRepo";
import type { StandardFmGroupRow, StandardRow } from "@/repo/standardRepo";
import { validatePdfFile } from "@/utils/format";
import { AppButton } from "@react/ui/AppButton";
import { AppDateInput } from "@react/ui/AppDateInput";
import { AppFileInput } from "@react/ui/AppFileInput";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppMultiSelect } from "@react/ui/AppMultiSelect";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import { normalizeCoverageThicknessInput, type SelectOption, trimOrEmpty, trimOrNull } from "../lib/certsView";

type ModalMode = "new" | "edit" | "renew";

export type WelderCertModalSubmit = {
  mode: ModalMode;
  rowId: string | null;
  payload: UpsertWelderCertInput;
  pdfFile: File | null;
  removePdf: boolean;
};

type WelderCertModalProps = {
  opened: boolean;
  mode: ModalMode;
  row: WelderCertRow | null;
  welderOptions: SelectOption[];
  standardOptions: SelectOption[];
  processOptions: SelectOption[];
  materialOptions: SelectOption[];
  jointTypeOptions: SelectOption[];
  standards: StandardRow[];
  fmGroups: StandardFmGroupRow[];
  onClose: () => void;
  onSubmit: (payload: WelderCertModalSubmit) => Promise<void>;
  onOpenExistingPdf?: (ref: string) => void;
};

type WelderCertFormValues = {
  profileId: string;
  certificateNo: string;
  standard: string;
  weldingProcessCode: string;
  baseMaterialId: string;
  coverageJointTypes: string[];
  coverageThickness: string;
  expiresAt: string;
  fmGroup: string;
  pdfFile: File | null;
  removePdf: boolean;
};

function parseCoverageJointTypes(value: string | null) {
  return String(value ?? "")
    .split(",")
    .map((part) => trimOrEmpty(part))
    .filter(Boolean);
}

function createInitialValues(row: WelderCertRow | null, mode: ModalMode): WelderCertFormValues {
  if (!row || mode === "new") {
    return {
      profileId: "",
      certificateNo: "",
      standard: "",
      weldingProcessCode: "",
      baseMaterialId: "",
      coverageJointTypes: [],
      coverageThickness: "",
      expiresAt: "",
      fmGroup: "",
      pdfFile: null,
      removePdf: false,
    };
  }

  return {
    profileId: row.profile_id ?? "",
    certificateNo: row.certificate_no ?? "",
    standard: row.standard ?? "",
    weldingProcessCode: row.welding_process_code ?? "",
    baseMaterialId: row.base_material_id ?? "",
    coverageJointTypes: parseCoverageJointTypes(row.coverage_joint_type),
    coverageThickness: row.coverage_thickness ?? "",
    expiresAt: row.expires_at ?? "",
    fmGroup: row.fm_group ?? "",
    pdfFile: null,
    removePdf: false,
  };
}

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function WelderCertModal({
  opened,
  mode,
  row,
  welderOptions,
  standardOptions,
  processOptions,
  materialOptions,
  jointTypeOptions,
  standards,
  fmGroups,
  onClose,
  onSubmit,
  onOpenExistingPdf,
}: WelderCertModalProps) {
  const form = useForm<WelderCertFormValues>({
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

  const fmGroupOptions = useMemo(() => {
    if (!values.standard) return [] as SelectOption[];

    const standardIds = new Set(standards.filter((item) => item.label === values.standard).map((item) => item.id));
    if (!standardIds.size) return [] as SelectOption[];

    const labels = new Set<string>();
    for (const rowItem of fmGroups) {
      if (!standardIds.has(rowItem.standard_id)) continue;
      const label = trimOrEmpty(rowItem.label);
      if (label) labels.add(label);
    }

    const out = Array.from(labels)
      .sort((a, b) => a.localeCompare(b, "nb", { sensitivity: "base" }))
      .map((value) => ({ value, label: value }));

    if (values.fmGroup && !labels.has(values.fmGroup)) {
      out.push({ value: values.fmGroup, label: `${values.fmGroup} (ukjent)` });
    }

    return out;
  }, [fmGroups, standards, values.fmGroup, values.standard]);

  const existingPdfRef = row ? row.file_id || row.pdf_path || null : null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
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

      const profileId = trimOrEmpty(values.profileId);
      const certificateNo = trimOrEmpty(values.certificateNo);
      const standard = trimOrEmpty(values.standard);
      const weldingProcessCode = trimOrNull(values.weldingProcessCode);
      const baseMaterialId = trimOrNull(values.baseMaterialId);
      const coverageJointType = values.coverageJointTypes.length > 0 ? values.coverageJointTypes.join(", ") : null;
      const coverageThickness = normalizeCoverageThicknessInput(values.coverageThickness);
      const expiresAt = trimOrNull(values.expiresAt);
      let fmGroup = trimOrNull(values.fmGroup);

      if (mode === "renew") {
        if (!row) throw new Error("Mangler sertifikat for fornying.");
        if (!expiresAt) throw new Error("Velg ny utløpsdato.");
      } else {
        if (fmGroupOptions.length > 0 && !fmGroup) {
          throw new Error("Velg FM-gruppe.");
        }
        if (fmGroupOptions.length === 0 && standard && !fmGroup) {
          fmGroup = "N/A";
        }

        if (!profileId || !certificateNo || !standard || !weldingProcessCode) {
          throw new Error("Fyll ut Sveiser, Sertifikatnr, Standard og Sveisemetode.");
        }
      }

      const payload: UpsertWelderCertInput = {
        profile_id: profileId,
        certificate_no: certificateNo,
        standard,
        welding_process_code: weldingProcessCode,
        base_material_id: baseMaterialId,
        coverage_joint_type: coverageJointType,
        coverage_thickness: coverageThickness,
        expires_at: expiresAt,
        fm_group: fmGroup,
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
      setError(readErrorMessage(err, "Kunne ikke lagre sertifikat."));
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={
        mode === "new"
          ? "Legg til sveisesertifikat"
          : mode === "renew"
            ? "Forny sveisesertifikat"
            : "Endre sveisesertifikat"
      }
      busy={submitting}
      size="xl"
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
                label="Sveiser"
                value={values.profileId}
                onChange={(value) => form.setFieldValue("profileId", value)}
                data={welderOptions}
                placeholder="Velg sveiser..."
                searchable
              />
              <AppTextInput
                label="Sertifikatnr"
                value={values.certificateNo}
                onChange={(value) => form.setFieldValue("certificateNo", value)}
              />
              <AppSelect
                label="Standard"
                value={values.standard}
                onChange={(value) => {
                  form.setFieldValue("standard", value);
                  form.setFieldValue("fmGroup", "");
                }}
                data={standardOptions}
                placeholder="Velg standard..."
                searchable
              />
              <AppSelect
                label="Sveisemetode"
                value={values.weldingProcessCode}
                onChange={(value) => form.setFieldValue("weldingProcessCode", value)}
                data={processOptions}
                placeholder="Velg sveisemetode..."
                searchable
              />
              <AppSelect
                label="Grunnmaterial"
                value={values.baseMaterialId}
                onChange={(value) => form.setFieldValue("baseMaterialId", value)}
                data={materialOptions}
                placeholder="Velg materiale (valgfritt)"
                clearable
                searchable
              />
              <AppSelect
                label="FM-gruppe"
                value={values.fmGroup}
                onChange={(value) => form.setFieldValue("fmGroup", value)}
                data={fmGroupOptions}
                placeholder={
                  values.standard
                    ? fmGroupOptions.length > 0
                      ? "Velg FM-gruppe..."
                      : "Ingen FM-grupper for valgt standard"
                    : "Velg standard først"
                }
                clearable
                disabled={!values.standard}
              />
              <AppMultiSelect
                label="Fugetype"
                value={values.coverageJointTypes}
                onChange={(value) => form.setFieldValue("coverageJointTypes", value)}
                data={jointTypeOptions}
                placeholder="Velg en eller flere fugetyper"
                searchable
                clearable
                nothingFoundMessage="Ingen treff"
              />
              <AppTextInput
                label="Tykkelsesområde"
                value={values.coverageThickness}
                onChange={(value) => form.setFieldValue("coverageThickness", value)}
                placeholder="f.eks. 2,8-5,6"
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

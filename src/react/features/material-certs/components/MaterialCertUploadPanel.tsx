import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@mantine/form";
import { Alert, Collapse, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { FileRejection } from "@mantine/dropzone";
import { IconRefresh, IconUpload } from "@tabler/icons-react";
import { deleteFileInboxEntryAndMaybeFile, fetchNewFileInboxByTarget } from "@/repo/fileInboxRepo";
import type { MaterialRow } from "@/repo/materialRepo";
import { type MaterialCertificateType, uploadBatchWithMeta } from "@/repo/materialCertificateRepo";
import { ensureSupplierExists } from "@/repo/supplierRepo";
import { esc } from "@/utils/dom";
import { AppAutocomplete } from "@react/ui/AppAutocomplete";
import { notifyError, notifySuccess } from "@react/ui/notify";
import { AppButton } from "@react/ui/AppButton";
import { AppPanel } from "@react/ui/AppPanel";
import { AppPdfDropzone } from "@react/ui/AppPdfDropzone";
import { AppSelect } from "@react/ui/AppSelect";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import { MaterialCertUploadEntryCard } from "./MaterialCertUploadEntryCard";
import type { SelectOption } from "../lib/materialCertsView";
import { MATERIAL_CERT_TYPE_OPTIONS, normalizeHeatNumbers, trimOrEmpty } from "../lib/materialCertsView";
import {
  applyUploadDefaultsToEntries,
  createUploadEntryFromFile,
  mergeInboxUploadEntries,
  type MaterialCertUploadDefaults,
  type MaterialCertUploadEntryDraft,
} from "../lib/materialCertsUpload";

type MaterialCertUploadPanelProps = {
  opened: boolean;
  materials: MaterialRow[];
  supplierSuggestions: string[];
  fillerManufacturerOptions: SelectOption[];
  fillerTypeOptions: SelectOption[];
  fillerDiameterOptions: SelectOption[];
  onOpenPdf: (refOrUrl: string, title: string) => void;
  onUploaded: () => Promise<void>;
  onInboxCountChange?: () => Promise<void> | void;
};

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function MaterialCertUploadPanel({
  opened,
  materials,
  supplierSuggestions,
  fillerManufacturerOptions,
  fillerTypeOptions,
  fillerDiameterOptions,
  onOpenPdf,
  onUploaded,
  onInboxCountChange,
}: MaterialCertUploadPanelProps) {
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();
  const [entries, setEntries] = useState<MaterialCertUploadEntryDraft[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState("Ingen filer i kø.");
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: {
      certificateType: "material" as MaterialCertificateType,
      certType: "3.1",
      defaultMaterialId: "",
      defaultFillerManufacturer: "",
      defaultFillerType: "",
      defaultFillerDiameter: "",
      defaultSupplier: "",
    },
  });
  const values = form.values;
  const certificateType = values.certificateType;
  const certType = values.certType;

  const materialOptions = useMemo<SelectOption[]>(
    () =>
      materials.map((material) => ({
        value: material.id,
        label: material.name,
      })),
    [materials]
  );

  const defaults = useMemo<MaterialCertUploadDefaults>(
    () => ({
      materialId: values.defaultMaterialId,
      fillerManufacturer: values.defaultFillerManufacturer,
      fillerType: values.defaultFillerType,
      fillerDiameter: values.defaultFillerDiameter,
      supplier: values.defaultSupplier,
    }),
    [
      values.defaultFillerDiameter,
      values.defaultFillerManufacturer,
      values.defaultFillerType,
      values.defaultMaterialId,
      values.defaultSupplier,
    ]
  );
  const defaultsRef = useRef<MaterialCertUploadDefaults>(defaults);

  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);

  const refreshInbox = useCallback(async () => {
    setLoadingInbox(true);
    setError(null);

    try {
      const rows = await fetchNewFileInboxByTarget("material_certificate");
      setEntries((current) => mergeInboxUploadEntries(current, rows, certificateType, defaultsRef.current));
      await onInboxCountChange?.();
    } catch (err) {
      console.error(err);
      setError(readErrorMessage(err, "Kunne ikke hente filer fra inbox."));
    } finally {
      setLoadingInbox(false);
    }
  }, [certificateType, onInboxCountChange]);

  useEffect(() => {
    if (!opened) return;
    void refreshInbox();
  }, [opened, refreshInbox]);

  useEffect(() => {
    if (!opened) return;
    setStatusText(entries.length > 0 ? `${entries.length} filer i kø.` : "Ingen filer i kø.");
  }, [entries.length, opened]);

  const updateEntry = useCallback((entryId: string, patch: Partial<MaterialCertUploadEntryDraft>) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry))
    );
  }, []);

  const handleDrop = useCallback(
    (files: File[]) => {
      setError(null);
      if (files.length === 0) return;

      setEntries((current) => [
        ...current,
        ...files.map((file) => createUploadEntryFromFile(file, certificateType, defaults)),
      ]);
      setStatusText(`${files.length} filer lagt til.`);
    },
    [certificateType, defaults]
  );

  const handleReject = useCallback((files: FileRejection[]) => {
    if (files.length === 0) return;
    setError("Kun PDF-filer opptil 25 MB kan lastes opp.");
  }, []);

  const handlePreview = useCallback(
    (entry: MaterialCertUploadEntryDraft) => {
      if (entry.source.kind === "local") {
        const url = URL.createObjectURL(entry.source.file);
        onOpenPdf(url, entry.source.file.name);
        return;
      }

      onOpenPdf(entry.source.fileId, entry.source.fileName);
    },
    [onOpenPdf]
  );

  const handleRemove = useCallback(
    (entry: MaterialCertUploadEntryDraft) => {
      if (entry.source.kind !== "inbox") {
        setEntries((current) => current.filter((item) => item.id !== entry.id));
        return;
      }

      const inboxId = entry.source.inboxId;
      const fileName = entry.source.fileName;

      confirmDelete({
        title: "Slett innboksfil",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(fileName)}</b> fra inbox og lagring?`,
        onConfirm: async () => {
          await deleteFileInboxEntryAndMaybeFile(inboxId);
          setEntries((current) => current.filter((item) => item.id !== entry.id));
          await onInboxCountChange?.();
        },
      });
    },
    [confirmDelete, onInboxCountChange]
  );

  const applyDefaultsToAll = useCallback(() => {
    setEntries((current) => applyUploadDefaultsToEntries(current, certificateType, defaults));
  }, [certificateType, defaults]);

  const uploadAll = useCallback(async () => {
    setError(null);

    if (entries.length === 0) {
      setError("Legg til minst én PDF før opplasting.");
      return;
    }

    if (certificateType === "material") {
      const missingCount = entries.filter((entry) => !trimOrEmpty(entry.materialId)).length;
      if (missingCount > 0) {
        setError(`Velg material for ${missingCount} filer før opplasting.`);
        return;
      }
    }

    if (certificateType === "filler") {
      const missingCount = entries.filter((entry) => !trimOrEmpty(entry.fillerType)).length;
      if (missingCount > 0) {
        setError(`Velg sveisetilsett-type for ${missingCount} filer før opplasting.`);
        return;
      }
    }

    setUploading(true);
    setStatusText("Forbereder opplasting...");

    try {
      const uniqueSuppliers = Array.from(
        new Set(entries.map((entry) => trimOrEmpty(entry.supplier)).filter(Boolean))
      );
      for (const supplier of uniqueSuppliers) {
        await ensureSupplierExists(supplier);
      }

      await uploadBatchWithMeta(
        entries.map((entry) => ({
          file: entry.source.kind === "local" ? entry.source.file : null,
          file_id: entry.source.kind === "inbox" ? entry.source.fileId : null,
          inbox_id: entry.source.kind === "inbox" ? entry.source.inboxId : null,
          source_name: entry.source.kind === "local" ? entry.source.file.name : entry.source.fileName,
          certificate_type: certificateType,
          cert_type: certType,
          supplier: trimOrEmpty(entry.supplier) || null,
          material_id: certificateType === "material" ? trimOrEmpty(entry.materialId) || null : null,
          filler_manufacturer:
            certificateType === "filler" ? trimOrEmpty(entry.fillerManufacturer) || null : null,
          filler_type: certificateType === "filler" ? trimOrEmpty(entry.fillerType) || null : null,
          filler_diameter:
            certificateType === "filler" ? trimOrEmpty(entry.fillerDiameter) || null : null,
          heat_numbers: normalizeHeatNumbers(entry.heatNumbers),
        })),
        (index: number, total: number) => {
          setStatusText(`Laster opp ${index} av ${total}...`);
        },
        () => true
      );

      setEntries([]);
      setStatusText("Opplasting fullført.");
      notifySuccess("Materialsertifikater lastet opp.");
      await onUploaded();
      await onInboxCountChange?.();
    } catch (err) {
      console.error(err);
      const message = readErrorMessage(err, "Kunne ikke laste opp materialsertifikatene.");
      setError(message);
      notifyError(message);
    } finally {
      setUploading(false);
    }
  }, [certType, certificateType, entries, onInboxCountChange, onUploaded]);

  return (
    <Collapse in={opened}>
      <AppPanel
        title="Filopplasting"
        meta={
          entries.length > 0
            ? `${entries.length} filer i kø. Identiske PDF-er kobles til eksisterende fil i stedet for å lastes opp på nytt.`
            : "Legg til PDF-filer manuelt eller hent fra inbox."
        }
        actions={
          <Group gap="xs" wrap="wrap">
            <AppButton
              tone="neutral"
              size="sm"
              leftSection={<IconRefresh size={14} />}
              onClick={() => void refreshInbox()}
              disabled={loadingInbox || uploading}
            >
              Synk inbox
            </AppButton>
            <AppButton tone="neutral" size="sm" onClick={applyDefaultsToAll} disabled={entries.length === 0 || uploading}>
              Bruk standardvalg på alle
            </AppButton>
            <AppButton tone="neutral" size="sm" onClick={() => setEntries([])} disabled={entries.length === 0 || uploading}>
              Tøm kø
            </AppButton>
            <AppButton
              tone="primary"
              size="sm"
              leftSection={<IconUpload size={14} />}
              onClick={() => void uploadAll()}
              disabled={entries.length === 0}
              loading={uploading}
            >
              Last opp alle
            </AppButton>
          </Group>
        }
      >
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            <AppSelect
              label="Type"
              value={certificateType}
              onChange={(value) => form.setFieldValue("certificateType", value === "filler" ? "filler" : "material")}
              data={[
                { value: "material", label: "Material" },
                { value: "filler", label: "Sveisetilsett" },
              ]}
              allowDeselect={false}
            />
            <AppSelect
              label="Sertifikattype"
              value={certType}
              onChange={(value) => form.setFieldValue("certType", value || "3.1")}
              data={MATERIAL_CERT_TYPE_OPTIONS}
              allowDeselect={false}
            />
            {certificateType === "material" ? (
              <AppSelect
                label="Standard material"
                value={values.defaultMaterialId}
                onChange={(value) => form.setFieldValue("defaultMaterialId", value)}
                data={materialOptions}
                placeholder="Ikke satt"
                clearable
                searchable
              />
            ) : (
              <>
                <AppSelect
                  label="Standard produsent"
                  value={values.defaultFillerManufacturer}
                  onChange={(value) => form.setFieldValue("defaultFillerManufacturer", value)}
                  data={fillerManufacturerOptions}
                  placeholder="Ikke satt"
                  clearable
                  searchable
                />
                <AppSelect
                  label="Standard sveisetilsett-type"
                  value={values.defaultFillerType}
                  onChange={(value) => form.setFieldValue("defaultFillerType", value)}
                  data={fillerTypeOptions}
                  placeholder="Ikke satt"
                  clearable
                  searchable
                />
                <AppSelect
                  label="Standard diameter (mm)"
                  value={values.defaultFillerDiameter}
                  onChange={(value) => form.setFieldValue("defaultFillerDiameter", value)}
                  data={fillerDiameterOptions}
                  placeholder="Ikke satt"
                  clearable
                  searchable
                />
              </>
            )}
            <AppAutocomplete
              label="Standard leverandør"
              value={values.defaultSupplier}
              onChange={(value) => form.setFieldValue("defaultSupplier", value)}
              data={supplierSuggestions}
              placeholder="Ikke satt"
              mobileSearchable
            />
          </SimpleGrid>

          <AppPdfDropzone onDrop={handleDrop} onReject={handleReject} disabled={uploading} />

          {error ? (
            <Alert color="red" variant="light" title="Feil">
              {error}
            </Alert>
          ) : null}

          <Text size="sm" c="dimmed">
            {loadingInbox ? "Henter filer fra inbox..." : statusText}
          </Text>

          {entries.length > 0 ? (
            entries.map((entry) => (
              <MaterialCertUploadEntryCard
                key={entry.id}
                entry={entry}
                certificateType={certificateType}
                materialOptions={materialOptions}
                fillerManufacturerOptions={fillerManufacturerOptions}
                fillerTypeOptions={fillerTypeOptions}
                fillerDiameterOptions={fillerDiameterOptions}
                supplierSuggestions={supplierSuggestions}
                disabled={uploading}
                onChange={updateEntry}
                onPreview={handlePreview}
                onRemove={handleRemove}
              />
            ))
          ) : null}
        </Stack>
      </AppPanel>
      {deleteConfirmModal}
    </Collapse>
  );
}

import { useEffect } from "react";
import { useForm } from "@mantine/form";
import { Group, Stack, Text, TextInput } from "@mantine/core";
import { validatePdfFile } from "@/utils/format";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppPdfDropzone } from "@react/ui/AppPdfDropzone";
import { AppSelect } from "@react/ui/AppSelect";
import { notifyError } from "@react/ui/notify";
import { REVISION_OPTIONS } from "../lib/drawingsUtils";
import type { ProjectDrawingRow } from "../types";

type DrawingEditModalProps = {
  opened: boolean;
  row: ProjectDrawingRow | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: { drawingNo: string; revision: string; file: File | null }) => Promise<void>;
};

type DrawingEditValues = {
  drawingNo: string;
  revision: string;
  file: File | null;
};

export function DrawingEditModal({ opened, row, saving, onClose, onSubmit }: DrawingEditModalProps) {
  const form = useForm<DrawingEditValues>({
    initialValues: {
      drawingNo: "",
      revision: "A",
      file: null,
    },
  });

  useEffect(() => {
    if (!opened || !row) return;
    form.setValues({
      drawingNo: row.drawing_no,
      revision: (row.revision || "A").trim() || "A",
      file: null,
    });
    form.resetDirty();
    form.clearErrors();
  }, [opened, row?.id]);

  const submit = async () => {
    const nextDrawingNo = form.values.drawingNo.trim();
    if (!nextDrawingNo) {
      notifyError("Tegningsnr kan ikke være tomt.");
      return;
    }

    if (form.values.file) {
      const validationError = validatePdfFile(form.values.file, 25);
      if (validationError) {
        notifyError(validationError);
        return;
      }
    }

    await onSubmit({
      drawingNo: nextDrawingNo,
      revision: form.values.revision,
      file: form.values.file,
    });
  };

  return (
    <AppModal opened={opened} onClose={onClose} title="Endre tegning" size="lg" busy={saving}>
      <Stack gap="md">
        <Group grow align="flex-start">
          <TextInput
            label="Tegningsnr."
            value={form.values.drawingNo}
            onChange={(event) => form.setFieldValue("drawingNo", event.currentTarget.value)}
          />
          <AppSelect
            label="Revisjon"
            value={form.values.revision}
            onChange={(value) => form.setFieldValue("revision", value)}
            data={REVISION_OPTIONS.map((option) => ({ value: option, label: option }))}
            searchable={false}
            allowDeselect={false}
          />
        </Group>

        <AppPdfDropzone
          multiple={false}
          disabled={saving}
          title="Erstatt PDF (valgfritt)"
          subtitle="Velg ny PDF for å bytte eksisterende fil."
          onDrop={(files) => {
            const file = files[0] ?? null;
            if (!file) return;
            form.setFieldValue("file", file);
          }}
          onReject={() => notifyError("Kun PDF er tillatt, maks 25 MB.")}
        />

        {form.values.file ? (
          <Text size="sm" c="dimmed">
            Ny fil: {form.values.file.name}
          </Text>
        ) : null}

        <AppModalActions
          cancelLabel="Avbryt"
          confirmLabel="Oppdater"
          onCancel={onClose}
          onConfirm={() => {
            void submit();
          }}
          confirmLoading={saving}
        />
      </Stack>
    </AppModal>
  );
}

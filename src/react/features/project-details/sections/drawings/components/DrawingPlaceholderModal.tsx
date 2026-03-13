import { useEffect } from "react";
import { useForm } from "@mantine/form";
import { Group, Stack, Text, TextInput } from "@mantine/core";
import { AppNumberInput } from "@react/ui/AppNumberInput";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppSelect } from "@react/ui/AppSelect";
import { notifyError } from "@react/ui/notify";
import { normalizeButtWeldCountInput, parseButtWeldCount, REVISION_OPTIONS } from "../lib/drawingsUtils";

type DrawingPlaceholderModalProps = {
  opened: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: { drawingNo: string; revision: string; buttWeldCount: number }) => Promise<void>;
};

type DrawingPlaceholderValues = {
  drawingNo: string;
  revision: string;
  buttWeldCount: string;
};

export function DrawingPlaceholderModal({ opened, saving, onClose, onSubmit }: DrawingPlaceholderModalProps) {
  const form = useForm<DrawingPlaceholderValues>({
    initialValues: {
      drawingNo: "",
      revision: "-",
      buttWeldCount: "0",
    },
  });

  useEffect(() => {
    if (!opened) return;
    form.setValues({
      drawingNo: "",
      revision: "-",
      buttWeldCount: "0",
    });
    form.resetDirty();
    form.clearErrors();
  }, [opened]);

  const submit = async () => {
    const drawingNo = form.values.drawingNo.trim();
    if (!drawingNo) {
      notifyError("Tegningsnr kan ikke være tomt.");
      return;
    }

    const buttWeldCount = parseButtWeldCount(form.values.buttWeldCount);
    if (buttWeldCount == null) {
      notifyError("Buttsveiser må være et heltall lik eller større enn 0.");
      return;
    }

    await onSubmit({
      drawingNo,
      revision: form.values.revision,
      buttWeldCount,
    });
  };

  return (
    <AppModal opened={opened} onClose={onClose} title="Ny midlertidig tegning" size="md" busy={saving}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Opprett en tegning uten PDF nå. Skannet PDF kan lastes opp senere på samme tegningsrad.
        </Text>

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
          <AppNumberInput
            label="Buttsveiser"
            value={form.values.buttWeldCount}
            onChange={(value) => form.setFieldValue("buttWeldCount", normalizeButtWeldCountInput(value))}
            min={0}
            placeholder="f.eks. 12"
          />
        </Group>

        <AppModalActions
          cancelLabel="Avbryt"
          confirmLabel="Opprett"
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

import { Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppTextInput } from "@react/ui/AppTextInput";

type WeldLogBulkAddModalProps = {
  opened: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (count: number) => Promise<void>;
};

export function WeldLogBulkAddModal({ opened, loading, onClose, onConfirm }: WeldLogBulkAddModalProps) {
  const form = useForm({
    initialValues: {
      count: "20",
    },
  });

  const submit = async () => {
    const count = Math.trunc(Number(form.values.count));
    if (!Number.isFinite(count) || count < 1 || count > 200) {
      form.setFieldError("count", "Velg et antall mellom 1 og 200.");
      return;
    }
    await onConfirm(count);
  };

  return (
    <AppModal opened={opened} onClose={onClose} busy={loading} title="Bulk legg til sveiser" size="md">
      <Stack gap="md">
        <AppTextInput
          label="Antall tomme rader"
          value={form.values.count}
          onChange={(value) => form.setFieldValue("count", value)}
          error={form.errors.count}
          disabled={loading}
        />

        <Text size="sm" c="dimmed">
          Radene opprettes med stigende sveis-ID og tomt innhold.
        </Text>

        <AppModalActions
          cancelLabel="Avbryt"
          confirmLabel="Opprett"
          onCancel={onClose}
          onConfirm={() => {
            void submit();
          }}
          confirmLoading={loading}
        />
      </Stack>
    </AppModal>
  );
}

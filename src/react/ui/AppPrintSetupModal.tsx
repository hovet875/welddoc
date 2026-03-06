import { useEffect } from "react";
import { Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { AppCheckbox } from "./AppCheckbox";
import { AppModal } from "./AppModal";
import { AppModalActions } from "./AppModalActions";
import { AppSelect } from "./AppSelect";

export type AppPrintSetupStatusOption<S extends string> = {
  value: S;
  label: string;
};

export type AppPrintSetupColumnOption<C extends string> = {
  key: C;
  label: string;
};

export type AppPrintSetupValues<S extends string, C extends string> = {
  includeProjectMeta: boolean;
  statusFilter: S;
  columns: C[];
};

type AppPrintSetupModalProps<S extends string, C extends string> = {
  opened: boolean;
  onClose: () => void;
  onConfirm: (values: AppPrintSetupValues<S, C>) => Promise<void> | void;
  defaultValues: AppPrintSetupValues<S, C>;
  title?: string;
  description?: string;
  statusLabel?: string;
  statusOptions: Array<AppPrintSetupStatusOption<S>>;
  columnsLabel?: string;
  columnOptions: Array<AppPrintSetupColumnOption<C>>;
  includeProjectMetaLabel?: string;
  confirmLabel?: string;
};

export function AppPrintSetupModal<S extends string, C extends string>({
  opened,
  onClose,
  onConfirm,
  defaultValues,
  title = "Skriv ut",
  description,
  statusLabel = "Innhold",
  statusOptions,
  columnsLabel = "Kolonner",
  columnOptions,
  includeProjectMetaLabel = "Ta med prosjektinfo i toppfelt",
  confirmLabel = "Skriv ut",
}: AppPrintSetupModalProps<S, C>) {
  const form = useForm<AppPrintSetupValues<S, C>>({
    initialValues: defaultValues,
  });

  useEffect(() => {
    if (!opened) return;
    form.setValues(defaultValues);
    form.resetDirty();
    form.clearErrors();
  }, [opened, defaultValues.includeProjectMeta, defaultValues.statusFilter, defaultValues.columns.join("|")]);

  const toggleColumn = (key: C, checked: boolean) => {
    const current = form.values.columns;
    if (checked) {
      if (current.includes(key)) return;
      form.setFieldValue("columns", [...current, key]);
      return;
    }
    form.setFieldValue(
      "columns",
      current.filter((value) => value !== key)
    );
  };

  return (
    <AppModal opened={opened} onClose={onClose} title={title} size="lg">
      <Stack gap="md">
        {description ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : null}

        <AppSelect
          label={statusLabel}
          value={form.values.statusFilter}
          onChange={(value) => {
            const fallback = statusOptions[0]?.value;
            if (!fallback) return;
            form.setFieldValue("statusFilter", ((value as S) || fallback) as S);
          }}
          data={statusOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          allowDeselect={false}
          searchable={false}
        />

        <Stack gap={6}>
          <Text size="sm" fw={600}>
            {columnsLabel}
          </Text>
          {columnOptions.map((option) => (
            <AppCheckbox
              key={option.key}
              checked={form.values.columns.includes(option.key)}
              onChange={(checked) => toggleColumn(option.key, checked)}
              label={option.label}
            />
          ))}
        </Stack>

        <AppCheckbox
          checked={form.values.includeProjectMeta}
          onChange={(checked) => form.setFieldValue("includeProjectMeta", checked)}
          label={includeProjectMetaLabel}
        />

        <AppModalActions
          cancelLabel="Avbryt"
          confirmLabel={confirmLabel}
          onCancel={onClose}
          onConfirm={() => {
            void onConfirm(form.values);
          }}
          confirmDisabled={form.values.columns.length === 0}
        />
      </Stack>
    </AppModal>
  );
}

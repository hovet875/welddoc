import { type ReactNode } from "react";
import { Collapse, Stack, Switch, Text } from "@mantine/core";
import { AppSelect } from "./AppSelect";

type AppProfileSelectToggleOption = {
  value: string;
  label: string;
};

type AppProfileSelectToggleProps = {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  data: AppProfileSelectToggleOption[];
  error?: ReactNode;
  disabled?: boolean;
  selectDisabled?: boolean;
  toggleDisabled?: boolean;
  toggleLabel?: string;
  helperText?: string;
};

export function AppProfileSelectToggle({
  visible,
  onVisibleChange,
  value,
  onChange,
  data,
  error,
  disabled = false,
  selectDisabled = false,
  toggleDisabled = false,
  toggleLabel = "Vis profilvalg",
  helperText,
}: AppProfileSelectToggleProps) {
  return (
    <Stack gap="xs">
      <Switch
        size="sm"
        checked={visible}
        onChange={(event) => onVisibleChange(event.currentTarget.checked)}
        label={toggleLabel}
        disabled={disabled || toggleDisabled}
      />

      {!visible && helperText ? (
        <Text size="xs" c="dimmed">
          {helperText}
        </Text>
      ) : null}

      <Collapse in={visible}>
        <AppSelect
          label="Profil"
          value={value}
          onChange={onChange}
          data={data}
          error={error}
          searchable={false}
          allowDeselect={false}
          disabled={disabled || selectDisabled}
        />
      </Collapse>
    </Stack>
  );
}

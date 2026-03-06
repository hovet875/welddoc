import { Checkbox } from "@mantine/core";

type AppCheckboxProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
};

export function AppCheckbox({ checked, onChange, disabled, label, id }: AppCheckboxProps) {
  return (
    <Checkbox
      id={id}
      checked={checked}
      disabled={disabled}
      label={label}
      onChange={(event) => onChange?.(event.currentTarget.checked)}
    />
  );
}

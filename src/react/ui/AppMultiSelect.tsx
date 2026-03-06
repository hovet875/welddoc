import { MultiSelect, type MultiSelectProps } from "@mantine/core";

type AppMultiSelectProps = Omit<MultiSelectProps, "value" | "onChange"> & {
  value: string[];
  onChange?: (value: string[]) => void;
};

export function AppMultiSelect({ value, onChange, ...props }: AppMultiSelectProps) {
  return <MultiSelect value={value} onChange={(nextValue) => onChange?.(nextValue ?? [])} {...props} />;
}

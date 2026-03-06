import { TextInput, type TextInputProps } from "@mantine/core";

type AppTextInputProps = Omit<TextInputProps, "value" | "onChange"> & {
  value: string;
  onChange?: (value: string) => void;
};

export function AppTextInput({
  value,
  onChange,
  ...props
}: AppTextInputProps) {
  return (
    <TextInput
      value={value}
      {...props}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  );
}

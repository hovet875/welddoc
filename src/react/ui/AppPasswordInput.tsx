import { PasswordInput, type PasswordInputProps } from "@mantine/core";

type AppPasswordInputProps = Omit<PasswordInputProps, "value" | "onChange"> & {
  value: string;
  onChange?: (value: string) => void;
};

export function AppPasswordInput({ value, onChange, ...props }: AppPasswordInputProps) {
  return (
    <PasswordInput
      value={value}
      {...props}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  );
}

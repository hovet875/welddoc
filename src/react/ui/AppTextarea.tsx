import { Textarea, type TextareaProps } from "@mantine/core";

type AppTextareaProps = Omit<TextareaProps, "value" | "onChange"> & {
  value: string;
  onChange?: (value: string) => void;
};

export function AppTextarea({ value, onChange, ...props }: AppTextareaProps) {
  return (
    <Textarea
      value={value}
      {...props}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  );
}

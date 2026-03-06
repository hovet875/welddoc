import { FileInput, type FileInputProps } from "@mantine/core";

type AppFileInputProps = Omit<FileInputProps, "value" | "onChange"> & {
  value: File | null;
  onChange?: (value: File | null) => void;
};

export function AppFileInput({ value, onChange, ...props }: AppFileInputProps) {
  return <FileInput value={value} onChange={(nextValue) => onChange?.(nextValue ?? null)} {...props} />;
}

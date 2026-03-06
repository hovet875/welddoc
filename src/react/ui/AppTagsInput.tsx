import { TagsInput, type TagsInputProps } from "@mantine/core";

type AppTagsInputProps = Omit<TagsInputProps, "value" | "onChange"> & {
  value: string[];
  onChange?: (value: string[]) => void;
};

export function AppTagsInput({ value, onChange, ...props }: AppTagsInputProps) {
  return (
    <TagsInput
      value={value}
      onChange={(nextValue) => onChange?.(nextValue ?? [])}
      splitChars={[",", ";", "\n", "\t"]}
      acceptValueOnBlur
      clearable
      {...props}
    />
  );
}

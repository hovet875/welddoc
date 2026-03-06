import { NumberInput, type NumberInputProps } from "@mantine/core";

type AppNumberInputProps = Omit<NumberInputProps, "value" | "onChange"> & {
  value: string;
  onChange?: (value: string) => void;
};

export function AppNumberInput({ value, onChange, ...props }: AppNumberInputProps) {
  return (
    <NumberInput
      value={value}
      allowDecimal={false}
      allowNegative={false}
      onChange={(nextValue) => {
        if (typeof nextValue === "number") {
          onChange?.(Number.isFinite(nextValue) ? String(nextValue) : "");
          return;
        }
        onChange?.(nextValue);
      }}
      {...props}
    />
  );
}

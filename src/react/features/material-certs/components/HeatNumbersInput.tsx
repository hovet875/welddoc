import { useEffect, useMemo, useState } from "react";
import { AppTextarea } from "@react/ui/AppTextarea";
import { parseHeatNumbers } from "../lib/materialCertsView";

type HeatNumbersInputProps = {
  label: string;
  description?: string;
  placeholder?: string;
  value: string[];
  disabled?: boolean;
  onChange: (value: string[]) => void;
};

function serializeHeatNumbers(values: string[]) {
  return values.join("\n");
}

export function HeatNumbersInput({
  label,
  description,
  placeholder,
  value,
  disabled = false,
  onChange,
}: HeatNumbersInputProps) {
  const serializedValue = useMemo(() => serializeHeatNumbers(value), [value]);
  const [draft, setDraft] = useState(serializedValue);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setDraft(serializedValue);
  }, [focused, serializedValue]);

  return (
    <AppTextarea
      label={label}
      description={description}
      value={draft}
      onChange={setDraft}
      placeholder={placeholder}
      minRows={1}
      maxRows={8}
      disabled={disabled}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseHeatNumbers(draft);
        onChange(parsed);
        setDraft(serializeHeatNumbers(parsed));
      }}
    />
  );
}

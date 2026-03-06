import { MonthPickerInput } from "@mantine/dates";
import "dayjs/locale/nb";

type AppMonthPickerProps = {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

function toPickerValue(value: string): string {
  const raw = value.trim();
  const monthOnly = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw);
  if (monthOnly) return `${monthOnly[1]}-${monthOnly[2]}-01`;
  const fullDate = /^(\d{4})-(0[1-9]|1[0-2])-[0-3]\d/.exec(raw);
  if (fullDate) return raw;
  return "";
}

function toMonthValue(value: string | null): string {
  if (!value) return "";
  const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(value.trim());
  if (!match) return "";
  return `${match[1]}-${match[2]}`;
}

export function AppMonthPicker({
  value,
  onChange,
  disabled,
  placeholder = "Velg måned",
}: AppMonthPickerProps) {
  return (
    <MonthPickerInput
      type="default"
      value={toPickerValue(value)}
      onChange={(next) => onChange?.(toMonthValue(next))}
      disabled={disabled}
      locale="nb"
      valueFormat="MMMM YYYY"
      placeholder={placeholder}
      variant="filled"
      size="sm"
      popoverProps={{ withinPortal: false }}
      styles={{
        input: {
          background: "var(--panel)",
          border: "1px solid var(--border)",
          color: "var(--text)",
        },
      }}
    />
  );
}

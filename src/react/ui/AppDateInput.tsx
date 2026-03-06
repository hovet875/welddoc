import React from "react";
import { DateInput, type DateInputProps } from "@mantine/dates";
import { TextInput, type TextInputProps } from "@mantine/core";
import { IconCalendar } from "@tabler/icons-react";
import { useMediaQuery } from "@mantine/hooks";
import "dayjs/locale/nb";

type AppDateInputProps = Omit<DateInputProps, "value" | "onChange" | "defaultValue"> & {
  /** ISO: YYYY-MM-DD or "" */
  value: string;
  onChange?: (value: string) => void;

  nativeInputProps?: Omit<TextInputProps, "value" | "onChange" | "type">;
  mobileBreakpointPx?: number;
  mode?: "auto" | "native" | "mantine";
};

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = (navigator as any).platform || "";
  const maxTouchPoints = (navigator as any).maxTouchPoints || 0;
  return /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(y, m - 1, d);

  if (dt.getFullYear() !== y) return null;
  if (dt.getMonth() !== m - 1) return null;
  if (dt.getDate() !== d) return null;
  return dt;
}

function parseNorwegianDate(value: string): Date | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const d = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);
  const dt = new Date(y, m - 1, d);

  if (dt.getFullYear() !== y) return null;
  if (dt.getMonth() !== m - 1) return null;
  if (dt.getDate() !== d) return null;
  return dt;
}

function toIsoDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export function AppDateInput({
  value,
  onChange,
  placeholder = "Velg dato",
  leftSection,
  popoverProps,
  nativeInputProps,
  mobileBreakpointPx = 1024,
  mode = "auto",
  ...props
}: AppDateInputProps) {
  const isiOS = detectIOS();
  const isBelowBp = useMediaQuery(`(max-width: ${mobileBreakpointPx}px)`);
  const useNative =
    mode === "native" ? true : mode === "mantine" ? false : Boolean(isiOS && isBelowBp);

  const [internalDate, setInternalDate] = React.useState<Date | null>(() => parseIsoDate(value));

  // Sync når parent oppdaterer (f.eks. modal åpner med default dato)
  React.useEffect(() => {
    setInternalDate(parseIsoDate(value));
  }, [value]);

  if (useNative) {
    return (
      <TextInput
        type="date"
        value={value || ""}
        onChange={(e) => onChange?.(e.currentTarget.value)}
        disabled={props.disabled}
        readOnly={props.readOnly}
        required={props.required}
        label={props.label}
        description={props.description}
        error={props.error}
        withAsterisk={props.withAsterisk}
        placeholder={placeholder}
        leftSection={leftSection ?? <IconCalendar size={16} stroke={1.8} />}
        styles={{ input: { fontSize: 16 } }}
        {...nativeInputProps}
      />
    );
  }

  const mergedPopoverProps = {
    withinPortal: true, // viktig for iPad/modals/scroll-containere
    zIndex: 460,
    ...popoverProps,
  };

  return (
    <DateInput
      {...props}
      value={internalDate}
      onChange={(next: unknown) => {
        // ✅ Fiks “første klikk tømmer”:
        // Mantine kan sende null/"" når en dato allerede er valgt (deselect/toggle)
        if (next == null) return;
        if (typeof next === "string" && next.trim() === "") return;

        let parsed: Date | null = null;

        // Støtt både Date og string (ulik Mantine-versjon/typing)
        if (isValidDate(next)) {
          parsed = next;
        } else if (typeof next === "string") {
          parsed = parseIsoDate(next) ?? parseNorwegianDate(next);
        }

        if (!parsed) return;

        setInternalDate(parsed);
        onChange?.(toIsoDate(parsed));
      }}
      dateParser={(input) => parseIsoDate(input) ?? parseNorwegianDate(input)}
      locale="nb"
      valueFormat="DD.MM.YYYY"
      firstDayOfWeek={1}
      placeholder={placeholder}
      leftSection={leftSection ?? <IconCalendar size={16} stroke={1.8} />}
      popoverProps={mergedPopoverProps}
      clearable={false}
    />
  );
}
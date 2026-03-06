import React, { Children, isValidElement, useMemo, type ReactNode } from "react";
import { NativeSelect, Select } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

type AppNativeSelectProps = {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;

  /**
   * Optional passthrough props for underlying mantine components
   * (kept flexible so you can extend without changing this wrapper).
   */
  selectProps?: Omit<
    React.ComponentProps<typeof Select>,
    "value" | "onChange" | "data" | "disabled" | "placeholder" | "allowDeselect"
  >;
  nativeSelectProps?: Omit<
    React.ComponentProps<typeof NativeSelect>,
    "value" | "onChange" | "data" | "disabled"
  >;

  /**
   * Breakpoint for switching to NativeSelect on mobile iOS.
   * Default: 768px.
   */
  mobileBreakpointPx?: number;

  /**
   * Force a specific mode (useful for testing).
   * - "auto": NativeSelect on iOS mobile, Select otherwise (default)
   * - "native": always NativeSelect
   * - "select": always Select
   */
  mode?: "auto" | "native" | "select";
};

type AppSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function flattenText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((child) => flattenText(child)).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return flattenText(node.props.children);
  return "";
}

function mapOptionChildren(children: ReactNode): AppSelectOption[] {
  const options: AppSelectOption[] = [];

  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ value?: unknown; children?: ReactNode; disabled?: boolean }>(child)) continue;
    if (typeof child.type !== "string" || child.type !== "option") continue;

    options.push({
      value: child.props.value == null ? "" : String(child.props.value),
      label: flattenText(child.props.children),
      disabled: child.props.disabled,
    });
  }

  return options;
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // Covers iPhone/iPad/iPod; iPadOS sometimes reports as MacIntel with touch points.
  const ua = navigator.userAgent || "";
  const platform = (navigator as any).platform || "";
  const maxTouchPoints = (navigator as any).maxTouchPoints || 0;

  const iOSUA = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = platform === "MacIntel" && maxTouchPoints > 1;

  return iOSUA || iPadOS;
}

export function AppNativeSelect({
  value,
  onChange,
  disabled,
  children,
  selectProps,
  nativeSelectProps,
  mobileBreakpointPx = 768,
  mode = "auto",
}: AppNativeSelectProps) {
  const options = useMemo(() => mapOptionChildren(children), [children]);

  // If there is a disabled placeholder option with value "", keep its label as placeholder for Select
  // and keep it as the first option for NativeSelect (native needs the actual option present).
  const placeholderOption = options.find((o) => o.value === "" && o.disabled);

  const isMobile = useMediaQuery(`(max-width: ${mobileBreakpointPx}px)`);
  const useNative =
    mode === "native" ? true : mode === "select" ? false : Boolean(isMobile && detectIOS());

  if (useNative) {
    // NativeSelect uses real <select> => iOS picker, no unnecessary keyboard, no zoom issues if font >= 16px.
    // Keep the disabled placeholder as-is if present.
    const data = options.map((o) => ({
      value: o.value,
      label: o.label,
      disabled: o.disabled,
    }));

    return (
      <NativeSelect
        value={value}
        disabled={disabled}
        data={data}
        onChange={(e) => onChange?.(e.currentTarget.value)}
        {...nativeSelectProps}
      />
    );
  }

  // Mantine Select is a combobox (input-based). Great UX on desktop.
  // We map "" to a sentinel value because Select can behave awkwardly with empty-string values.
  const EMPTY_OPTION_VALUE = "__wd_empty_option__";

  const data = options
    .filter((o) => !(o.value === "" && o.disabled)) // remove disabled placeholder from dropdown list
    .map((o) => ({
      value: o.value === "" ? EMPTY_OPTION_VALUE : o.value,
      label: o.label,
      disabled: o.disabled,
    }));

  const normalizedValue = value === "" ? EMPTY_OPTION_VALUE : value;
  const resolvedValue = data.some((o) => o.value === normalizedValue) ? normalizedValue : null;

  return (
    <Select
      value={resolvedValue}
      data={data}
      disabled={disabled}
      placeholder={placeholderOption?.label}
      allowDeselect={false}
      searchable={false}
      onChange={(nextValue) =>
        onChange?.(nextValue == null || nextValue === EMPTY_OPTION_VALUE ? "" : nextValue)
      }
      {...selectProps}
    />
  );
}

export default AppNativeSelect;
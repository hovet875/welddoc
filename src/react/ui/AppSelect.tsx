import { Select, type SelectProps } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

type AppSelectProps = Omit<SelectProps, "value" | "onChange"> & {
  value: string;
  onChange?: (value: string) => void;
  mobileSearchable?: boolean;
};

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = (navigator as any).platform || "";
  const maxTouchPoints = (navigator as any).maxTouchPoints || 0;

  const iOSUA = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = platform === "MacIntel" && maxTouchPoints > 1;

  return iOSUA || iPadOS;
}

const DEFAULT_COMBOBOX_PROPS: NonNullable<SelectProps["comboboxProps"]> = {
  withinPortal: true,
  portalProps: {
    target: ".react-root",
  },
  zIndex: 460,
  position: "bottom-start",
  offset: 6,
  middlewares: { flip: true, shift: true },
};

export function AppSelect({ value, onChange, comboboxProps, maxDropdownHeight, mobileSearchable = false, searchable, ...props }: AppSelectProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const useMobileNonSearchable = Boolean(isMobile && detectIOS() && !mobileSearchable);
  const normalizedValue = value === "" ? null : value;
  const effectiveSearchable = useMobileNonSearchable ? false : searchable;

  return (
    <Select
      value={normalizedValue}
      searchable={effectiveSearchable}
      // sensible defaults (you can override by passing props)
      maxDropdownHeight={maxDropdownHeight ?? 260}
      comboboxProps={{
        ...DEFAULT_COMBOBOX_PROPS,
        ...comboboxProps,
        // merge middlewares safely if user provided some
        middlewares: {
          ...DEFAULT_COMBOBOX_PROPS.middlewares,
          ...(comboboxProps as any)?.middlewares,
        },
      }}
      {...props}
      onChange={(nextValue) => onChange?.(nextValue ?? "")}
    />
  );
}
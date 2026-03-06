import { Autocomplete, Button, Group, type AutocompleteProps, type ComboboxItem } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useRef, useState } from "react";

type AppAutocompleteData = string[] | ComboboxItem[];

type AppAutocompleteProps = Omit<AutocompleteProps, "value" | "onChange" | "data"> & {
  value: string;
  onChange?: (value: string) => void;
  data: AppAutocompleteData;
  mobileSearchable?: boolean;
  withClientFilter?: boolean;
  activateSearchLabel?: string;
  cancelSearchLabel?: string;
};

function detectTouchMobile() {
  if (typeof window === "undefined") return false;
  const hasTouch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  return hasTouch;
}

const DEFAULT_COMBOBOX_PROPS: NonNullable<AutocompleteProps["comboboxProps"]> = {
  withinPortal: true,
  portalProps: {
    target: ".react-root",
  },
  zIndex: 460,
  position: "bottom-start",
  offset: 6,
  middlewares: { flip: true, shift: true },
};

export function AppAutocomplete({
  value,
  onChange,
  data,
  comboboxProps,
  maxDropdownHeight,
  mobileSearchable = false,
  withClientFilter = true,
  activateSearchLabel = "Start søk",
  cancelSearchLabel = "Avslutt søk",
  placeholder,
  disabled,
  ...props
}: AppAutocompleteProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isTouchMobile = Boolean(isMobile && detectTouchMobile());
  const useManualMobileSearch = Boolean(isTouchMobile && !mobileSearchable);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mobileSearchActive, setMobileSearchActive] = useState(false);

  useEffect(() => {
    if (!disabled) return;
    setMobileSearchActive(false);
  }, [disabled]);

  const readOnly = useManualMobileSearch && !mobileSearchActive;
  const effectivePlaceholder = readOnly ? "Trykk «Start søk» for å skrive..." : placeholder;

  return (
    <>
      <Autocomplete
        ref={inputRef}
        value={value}
        data={data}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={effectivePlaceholder}
        maxDropdownHeight={maxDropdownHeight ?? 260}
        filter={withClientFilter ? undefined : ({ options }) => options}
        comboboxProps={{
          ...DEFAULT_COMBOBOX_PROPS,
          ...comboboxProps,
          middlewares: {
            ...DEFAULT_COMBOBOX_PROPS.middlewares,
            ...(comboboxProps as any)?.middlewares,
          },
        }}
        {...props}
        onChange={(nextValue) => onChange?.(nextValue)}
      />

      {useManualMobileSearch ? (
        <Group mt={6} gap="xs" justify="flex-end">
          {!mobileSearchActive ? (
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                setMobileSearchActive(true);
                requestAnimationFrame(() => {
                  inputRef.current?.focus();
                });
              }}
              disabled={disabled}
            >
              {activateSearchLabel}
            </Button>
          ) : (
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                setMobileSearchActive(false);
                inputRef.current?.blur();
              }}
              disabled={disabled}
            >
              {cancelSearchLabel}
            </Button>
          )}
        </Group>
      ) : null}
    </>
  );
}

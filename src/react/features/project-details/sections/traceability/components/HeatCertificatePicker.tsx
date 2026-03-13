import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Combobox, Group, Loader, Text, TextInput, useCombobox } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { MaterialCertificateType } from "@/repo/materialCertificateRepo";
import { searchCertificateHeats, type MaterialCertificateHeatHit } from "@/repo/materialCertificateRepo";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Props = {
  disabled?: boolean;
  certificateType: MaterialCertificateType; // "material" | "filler"
  materialId?: string | null;
  fillerManufacturer?: string | null;
  fillerType?: string | null;
  fillerDiameter?: string | null;

  // når user velger et heat-treff:
  onPick: (hit: MaterialCertificateHeatHit) => void;
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

export function HeatCertificatePicker({ disabled, certificateType, materialId, fillerManufacturer, fillerType, fillerDiameter, onPick }: Props) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isIOSMobile = Boolean(isMobile && detectIOS());

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 250);
  const [mobileSearchActive, setMobileSearchActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<MaterialCertificateHeatHit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canSearch = useMemo(() => {
    if (certificateType === "material") return Boolean((materialId ?? "").trim());
    return Boolean((fillerType ?? "").trim());
  }, [certificateType, materialId, fillerType]);

  useEffect(() => {
    if (!isIOSMobile) return;
    if (!canSearch) {
      setMobileSearchActive(false);
      setQuery("");
      setHits([]);
      combobox.closeDropdown();
    }
  }, [isIOSMobile, canSearch]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError(null);

      if (!canSearch) {
        setHits([]);
        return;
      }

      const q = debounced.trim();
      if (!q) {
        setHits([]);
        return;
      }

      setLoading(true);
      try {
        const res = await searchCertificateHeats({
          heat: q,
          certificate_type: certificateType,
          material_id: materialId ?? null,
          filler_manufacturer: fillerManufacturer ?? null,
          filler_type: fillerType ?? null,
          filler_diameter: fillerDiameter ?? null,
          limit: 30,
        });
        if (!cancelled) setHits(res);
      } catch (e) {
        if (!cancelled) setError("Klarte ikke å søke etter heat.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [debounced, canSearch, certificateType, materialId, fillerManufacturer, fillerType, fillerDiameter]);

  const placeholder = !canSearch
    ? certificateType === "material"
      ? "Velg material først…"
      : "Velg sveisetilsett-type først…"
    : isIOSMobile && !mobileSearchActive
      ? "Trykk «Start søk» for å skrive heat…"
      : "Skriv heat nr…";

  const inputReadOnly = Boolean(isIOSMobile && !mobileSearchActive);

  const activateMobileSearch = () => {
    if (!isIOSMobile) return;
    if (!canSearch) return;
    setMobileSearchActive(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const cancelMobileSearch = () => {
    if (!isIOSMobile) return;
    setMobileSearchActive(false);
    setQuery("");
    setHits([]);
    combobox.closeDropdown();
    inputRef.current?.blur();
  };

  return (
    <Combobox
      store={combobox}
      withinPortal
      portalProps={{ target: ".react-root" }}
      onOptionSubmit={(value) => {
        const hit = hits.find((h) => `${h.certificate_id}::${h.heat_number}` === value);
        if (!hit) return;
        onPick(hit);
        setQuery("");
        setHits([]);
        combobox.closeDropdown();
        if (isIOSMobile) {
          setMobileSearchActive(false);
          inputRef.current?.blur();
        }
      }}
    >
      <Combobox.Target>
        <TextInput
          ref={inputRef}
          label="Søk heat nr"
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            combobox.openDropdown();
          }}
          onFocus={() => {
            if (isIOSMobile && !mobileSearchActive) return;
            combobox.openDropdown();
          }}
          placeholder={placeholder}
          disabled={disabled || !canSearch}
          readOnly={inputReadOnly}
          rightSection={loading ? <Loader size="xs" /> : undefined}
          autoComplete="off"
        />
      </Combobox.Target>

      {isIOSMobile ? (
        <Group mt={6} gap="xs" justify="flex-end">
          {!mobileSearchActive ? (
            <Button size="xs" variant="light" onClick={activateMobileSearch} disabled={disabled || !canSearch}>
              Start søk
            </Button>
          ) : (
            <Button size="xs" variant="subtle" color="gray" onClick={cancelMobileSearch} disabled={disabled}>
              Avslutt søk
            </Button>
          )}
        </Group>
      ) : null}

      <Combobox.Dropdown>
        {error ? (
          <Combobox.Empty>{error}</Combobox.Empty>
        ) : hits.length === 0 ? (
          <Combobox.Empty>Ingen treff.</Combobox.Empty>
        ) : (
          <Combobox.Options>
            {hits.map((hit) => {
              const key = `${hit.certificate_id}::${hit.heat_number}`;
              const label = hit.file_label?.trim() || "Uten filnavn";
              return (
                <Combobox.Option key={key} value={key}>
                  <Text size="sm" fw={600} lineClamp={1}>
                    {hit.heat_number}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {label}
                  </Text>
                </Combobox.Option>
              );
            })}
          </Combobox.Options>
        )}
      </Combobox.Dropdown>
    </Combobox>
  );
}

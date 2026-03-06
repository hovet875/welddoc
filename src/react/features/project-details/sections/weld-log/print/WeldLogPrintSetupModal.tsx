import { AppPrintSetupModal } from "@react/ui/AppPrintSetupModal";
import type { WeldLogPrintColumnKey, WeldLogPrintOptions, WeldLogPrintStatusFilter } from "./types";
import { WELD_LOG_PRINT_DEFAULTS } from "./types";

type WeldLogPrintSetupModalProps = {
  opened: boolean;
  onClose: () => void;
  onConfirm: (options: WeldLogPrintOptions) => Promise<void> | void;
};

export function WeldLogPrintSetupModal({ opened, onClose, onConfirm }: WeldLogPrintSetupModalProps) {
  return (
    <AppPrintSetupModal<WeldLogPrintStatusFilter, WeldLogPrintColumnKey>
      opened={opened}
      onClose={onClose}
      title="Skriv ut sveiselogg"
      description="Velg hvilke data som skal med i utskrift av sveiselogg."
      defaultValues={WELD_LOG_PRINT_DEFAULTS}
      statusLabel="Innhold"
      statusOptions={[
        { value: "all", label: "Alle rader" },
        { value: "ready", label: "Kun Godkjent" },
        { value: "pending", label: "Kun Til kontroll" },
      ]}
      columnsLabel="Kolonner"
      columnOptions={[
        { key: "weldNumber", label: "Sveisenummer" },
        { key: "jointType", label: "Fuge" },
        { key: "component", label: "Komponent" },
        { key: "welder", label: "Sveiser" },
        { key: "wps", label: "WPS" },
        { key: "weldDate", label: "Dato" },
        { key: "filler", label: "Tilsett" },
        { key: "vt", label: "Visuell (VT)" },
        { key: "pt", label: "Sprekk (PT/MT)" },
        { key: "vol", label: "Volumetrisk (RT/UT)" },
        { key: "status", label: "Status" },
      ]}
      includeProjectMetaLabel="Ta med prosjektinfo i toppfelt"
      confirmLabel="Skriv ut"
      onConfirm={onConfirm}
    />
  );
}

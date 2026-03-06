import { SimpleGrid } from "@mantine/core";
import { AppDateInput } from "@react/ui/AppDateInput";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import type { WpsEditorState } from "../wps.types";

export type WpsEditorSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type WpsEditorFormFieldsProps = {
  editor: WpsEditorState;
  standardOptions: WpsEditorSelectOption[];
  processOptions: WpsEditorSelectOption[];
  materialOptions: WpsEditorSelectOption[];
  jointTypeOptions: WpsEditorSelectOption[];
  wpqrOptions: WpsEditorSelectOption[];
  onFieldChange: <K extends keyof WpsEditorState>(field: K, value: WpsEditorState[K]) => void;
  onProcessChange: (value: string) => void;
};

export function WpsEditorFormFields({
  editor,
  standardOptions,
  processOptions,
  materialOptions,
  jointTypeOptions,
  wpqrOptions,
  onFieldChange,
  onProcessChange,
}: WpsEditorFormFieldsProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      <AppTextInput
        label={`${editor.kind.toUpperCase()} nr.`}
        placeholder={editor.kind === "wps" ? "WPS-141-001" : "WPQR-001"}
        value={editor.docNo}
        onChange={(value) => onFieldChange("docNo", value)}
      />
      <AppDateInput label="Dato lagt opp" value={editor.docDate} onChange={(value) => onFieldChange("docDate", value)} />
      <AppSelect
        label="Standard"
        placeholder="Velg standard..."
        value={editor.standardId}
        data={standardOptions}
        searchable={standardOptions.length > 10}
        nothingFoundMessage="Ingen treff"
        onChange={(value) => onFieldChange("standardId", value)}
      />
      <AppSelect
        label="Sveisemetode"
        placeholder="Velg metode..."
        value={editor.process}
        data={processOptions}
        searchable={processOptions.length > 10}
        nothingFoundMessage="Ingen treff"
        onChange={onProcessChange}
      />
      <AppSelect
        label="Materiale"
        placeholder="Velg materiale..."
        value={editor.materialId}
        data={materialOptions}
        searchable={materialOptions.length > 10}
        nothingFoundMessage="Ingen treff"
        onChange={(value) => onFieldChange("materialId", value)}
      />
      <AppSelect
        label="Fuge"
        placeholder="Velg fugetype..."
        value={editor.fuge}
        data={jointTypeOptions}
        searchable={jointTypeOptions.length > 10}
        nothingFoundMessage="Ingen treff"
        onChange={(value) => onFieldChange("fuge", value)}
      />
      {editor.kind === "wps" ? (
        <AppSelect
          label="Koble til WPQR (valgfritt)"
          placeholder="Ikke koblet"
          value={editor.wpqrId}
          data={wpqrOptions}
          searchable={wpqrOptions.length > 10}
          nothingFoundMessage="Ingen treff"
          onChange={(value) => onFieldChange("wpqrId", value)}
        />
      ) : (
        <div />
      )}
      <AppTextInput
        label="Tykkelseområde"
        placeholder="f.eks. 2,8-6,8mm (FW: 3-∞)"
        value={editor.tykkelse}
        onChange={(value) => onFieldChange("tykkelse", value)}
      />
    </SimpleGrid>
  );
}

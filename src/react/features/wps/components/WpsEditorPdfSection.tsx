import { Box, Group, Paper, Stack, Text } from "@mantine/core";
import { AppButton } from "@react/ui/AppButton";
import { AppCheckbox } from "@react/ui/AppCheckbox";
import { AppFileInput } from "@react/ui/AppFileInput";
import type { WpsEditorState } from "../wps.types";

const PDF_FRAME_STYLE = {
  width: "100%",
  height: "min(70vh, 460px)",
  border: 0,
  background: "#0b0e12",
  display: "block",
} as const;

type WpsEditorPdfSectionProps = {
  editor: WpsEditorState;
  localPdfPreviewUrl: string | null;
  onFieldChange: <K extends keyof WpsEditorState>(field: K, value: WpsEditorState[K]) => void;
  onPdfFileChange: (file: File | null) => void;
  onOpenPdfPreview: (fileId: string | null, title: string) => void;
};

export function WpsEditorPdfSection({
  editor,
  localPdfPreviewUrl,
  onFieldChange,
  onPdfFileChange,
  onOpenPdfPreview,
}: WpsEditorPdfSectionProps) {
  return (
    <Stack gap="sm" mt="md">
      <Text size="sm" fw={600}>
        PDF (valgfritt)
      </Text>

      {editor.existingFileId ? (
        <Group justify="space-between" align="center" mb="xs">
          <Text size="sm" c="dimmed">
            Eksisterende PDF er registrert.
          </Text>
          <AppButton
            tone="neutral"
            size="xs"
            type="button"
            onClick={() => onOpenPdfPreview(editor.existingFileId, `${editor.kind.toUpperCase()} ${editor.docNo || ""}`.trim())}
          >
            Forhåndsvis
          </AppButton>
        </Group>
      ) : null}

      {editor.existingFileId ? (
        <AppCheckbox
          checked={editor.removeExistingPdf}
          disabled={Boolean(editor.newPdfFile)}
          onChange={(checked) => onFieldChange("removeExistingPdf", checked)}
          label="Fjern eksisterende PDF"
        />
      ) : null}

      <AppFileInput
        label="Velg PDF"
        placeholder="Ingen fil valgt"
        clearable
        accept="application/pdf"
        value={editor.newPdfFile}
        onChange={onPdfFileChange}
      />

      {localPdfPreviewUrl ? (
        <Paper withBorder radius="md" p={0} style={{ overflow: "hidden" }}>
          <Box component="iframe" src={localPdfPreviewUrl} title="Forhåndsvisning av ny PDF" style={PDF_FRAME_STYLE} />
        </Paper>
      ) : null}
    </Stack>
  );
}

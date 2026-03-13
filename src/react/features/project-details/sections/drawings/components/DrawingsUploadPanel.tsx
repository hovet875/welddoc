import { Alert, Collapse, Group, Stack, Text } from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import { AppButton } from "@react/ui/AppButton";
import { AppPanel } from "@react/ui/AppPanel";
import { AppPdfDropzone } from "@react/ui/AppPdfDropzone";
import { DrawingUploadEntryCard } from "./DrawingUploadEntryCard";
import type { UploadEntry } from "../types";

type DrawingsUploadPanelProps = {
  opened: boolean;
  uploading: boolean;
  entries: UploadEntry[];
  error: string | null;
  onDrop: (files: File[]) => void;
  onReject?: () => void;
  onPreview: (entry: UploadEntry) => void;
  onChangeDrawingNo: (entryId: string, drawingNo: string) => void;
  onChangeRevision: (entryId: string, revision: string) => void;
  onChangeButtWeldCount: (entryId: string, buttWeldCount: string) => void;
  onRemove: (entryId: string) => void;
  onClear: () => void;
  onSubmit: () => void;
};

export function DrawingsUploadPanel({
  opened,
  uploading,
  entries,
  error,
  onDrop,
  onReject,
  onPreview,
  onChangeDrawingNo,
  onChangeRevision,
  onChangeButtWeldCount,
  onRemove,
  onClear,
  onSubmit,
}: DrawingsUploadPanelProps) {
  return (
    <Collapse in={opened}>
      <AppPanel
        title="Filopplasting"
        meta={entries.length > 0 ? `${entries.length} filer i kø.` : "Legg til PDF-filer og fyll ut metadata før opplasting."}
        actions={
          <Group gap="xs" wrap="wrap">
            <AppButton tone="neutral" size="sm" onClick={onClear} disabled={entries.length === 0 || uploading}>
              Tøm kø
            </AppButton>
            <AppButton
              tone="primary"
              size="sm"
              leftSection={<IconUpload size={14} />}
              onClick={onSubmit}
              disabled={entries.length === 0}
              loading={uploading}
            >
              Last opp alle
            </AppButton>
          </Group>
        }
      >
        <Stack gap="sm">
          <AppPdfDropzone onDrop={onDrop} onReject={() => onReject?.()} disabled={uploading} />

          <Text size="sm" c="dimmed">
            Midlertidige tegninger med samme tegningsnr oppdateres med opplastet PDF i stedet for å opprette en ny rad.
          </Text>

          {error ? (
            <Alert color="red" variant="light" title="Feil">
              {error}
            </Alert>
          ) : null}

          {entries.length === 0 ? <Text c="dimmed">Ingen filer i kø.</Text> : null}

          {entries.map((entry) => (
            <DrawingUploadEntryCard
              key={entry.id}
              entry={entry}
              disabled={uploading}
              onChangeDrawingNo={onChangeDrawingNo}
              onChangeRevision={onChangeRevision}
              onChangeButtWeldCount={onChangeButtWeldCount}
              onPreview={onPreview}
              onRemove={onRemove}
            />
          ))}
        </Stack>
      </AppPanel>
    </Collapse>
  );
}

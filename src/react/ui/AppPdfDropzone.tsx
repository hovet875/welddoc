import { Group, Stack, Text } from "@mantine/core";
import { Dropzone, MIME_TYPES, type FileRejection } from "@mantine/dropzone";
import { IconFileTypePdf, IconUpload, IconX } from "@tabler/icons-react";

type AppPdfDropzoneProps = {
  onDrop: (files: File[]) => void;
  onReject?: (files: FileRejection[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  maxSizeMb?: number;
  title?: string;
  subtitle?: string;
};

export function AppPdfDropzone({
  onDrop,
  onReject,
  disabled = false,
  multiple = true,
  maxSizeMb = 25,
  title = "Dra PDF-filer hit, eller klikk for å velge",
  subtitle = "Kun PDF er tillatt.",
}: AppPdfDropzoneProps) {
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  return (
    <Dropzone
      onDrop={onDrop}
      onReject={onReject}
      disabled={disabled}
      multiple={multiple}
      maxSize={maxSizeBytes}
      accept={[MIME_TYPES.pdf]}
    >
      <Group justify="center" gap="md" mih={120} wrap="nowrap">
        <Dropzone.Accept>
          <IconUpload size={28} />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX size={28} />
        </Dropzone.Reject>
        <Dropzone.Idle>
          <IconFileTypePdf size={28} />
        </Dropzone.Idle>

        <Stack gap={2}>
          <Text fw={600}>{title}</Text>
          <Text size="sm" c="dimmed">
            {subtitle} Maks {maxSizeMb} MB.
          </Text>
        </Stack>
      </Group>
    </Dropzone>
  );
}

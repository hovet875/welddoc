import { Group, Table, Text, TextInput } from "@mantine/core";
import { AppButton } from "@react/ui/AppButton";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppPdfDropzone } from "@react/ui/AppPdfDropzone";
import { AppSelect } from "@react/ui/AppSelect";
import { REVISION_OPTIONS } from "../lib/drawingsUtils";
import type { UploadEntry } from "../types";

type DrawingsUploadModalProps = {
  opened: boolean;
  uploading: boolean;
  entries: UploadEntry[];
  onClose: () => void;
  onDrop: (files: File[]) => void;
  onReject?: () => void;
  onChangeDrawingNo: (entryId: string, drawingNo: string) => void;
  onChangeRevision: (entryId: string, revision: string) => void;
  onRemove: (entryId: string) => void;
  onSubmit: () => void;
};

export function DrawingsUploadModal({
  opened,
  uploading,
  entries,
  onClose,
  onDrop,
  onReject,
  onChangeDrawingNo,
  onChangeRevision,
  onRemove,
  onSubmit,
}: DrawingsUploadModalProps) {
  return (
    <AppModal opened={opened} onClose={onClose} title="Last opp tegninger" size="xl" busy={uploading}>
      <Group mb="sm" justify="space-between">
        <Text size="sm" c="dimmed">
          Legg til PDF-filer, juster tegningsnr/revisjon og last opp.
        </Text>
      </Group>

      <AppPdfDropzone
        disabled={uploading}
        multiple
        onDrop={onDrop}
        onReject={() => onReject?.()}
      />

      <Table.ScrollContainer minWidth={700} mt="md">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fil</Table.Th>
              <Table.Th>Tegningsnr.</Table.Th>
              <Table.Th>Rev</Table.Th>
              <Table.Th style={{ width: 72 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {entries.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed">Ingen filer valgt.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              entries.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>{entry.file.name}</Table.Td>
                  <Table.Td>
                    <TextInput
                      value={entry.drawingNo}
                      onChange={(event) => onChangeDrawingNo(entry.id, event.currentTarget.value)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <AppSelect
                      value={entry.revision}
                      onChange={(value) => onChangeRevision(entry.id, value)}
                      data={REVISION_OPTIONS.map((option) => ({ value: option, label: option }))}
                      searchable={false}
                      allowDeselect={false}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group justify="flex-end">
                      <AppButton tone="danger" onClick={() => onRemove(entry.id)}>
                        Fjern
                      </AppButton>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <AppModalActions
        cancelLabel="Avbryt"
        confirmLabel="Last opp"
        onCancel={onClose}
        onConfirm={onSubmit}
        confirmDisabled={entries.length === 0}
        confirmLoading={uploading}
      />
    </AppModal>
  );
}

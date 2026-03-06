import type { FormEvent } from "react";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { WpsEditorFormFields, type WpsEditorSelectOption } from "./WpsEditorFormFields";
import { WpsEditorPdfSection } from "./WpsEditorPdfSection";
import type { WpsEditorState } from "../wps.types";

type WpsEditorModalProps = {
  editor: WpsEditorState | null;
  saving: boolean;
  standardOptions: WpsEditorSelectOption[];
  processOptions: WpsEditorSelectOption[];
  materialOptions: WpsEditorSelectOption[];
  jointTypeOptions: WpsEditorSelectOption[];
  wpqrOptions: WpsEditorSelectOption[];
  localPdfPreviewUrl: string | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldChange: <K extends keyof WpsEditorState>(field: K, value: WpsEditorState[K]) => void;
  onProcessChange: (value: string) => void;
  onPdfFileChange: (file: File | null) => void;
  onOpenPdfPreview: (fileId: string | null, title: string) => void;
};

export function WpsEditorModal({
  editor,
  saving,
  standardOptions,
  processOptions,
  materialOptions,
  jointTypeOptions,
  wpqrOptions,
  localPdfPreviewUrl,
  onClose,
  onSubmit,
  onFieldChange,
  onProcessChange,
  onPdfFileChange,
  onOpenPdfPreview,
}: WpsEditorModalProps) {
  return (
    <AppModal
      opened={editor?.opened === true}
      onClose={onClose}
      busy={saving}
      size="xl"
      title={editor ? (editor.mode === "create" ? `Ny ${editor.kind.toUpperCase()}` : `Endre ${editor.kind.toUpperCase()}`) : ""}
    >
      {editor ? (
        <form onSubmit={onSubmit}>
          <WpsEditorFormFields
            editor={editor}
            standardOptions={standardOptions}
            processOptions={processOptions}
            materialOptions={materialOptions}
            jointTypeOptions={jointTypeOptions}
            wpqrOptions={wpqrOptions}
            onFieldChange={onFieldChange}
            onProcessChange={onProcessChange}
          />

          <WpsEditorPdfSection
            editor={editor}
            localPdfPreviewUrl={localPdfPreviewUrl}
            onFieldChange={onFieldChange}
            onPdfFileChange={onPdfFileChange}
            onOpenPdfPreview={onOpenPdfPreview}
          />

          <AppModalActions
            onCancel={onClose}
            cancelDisabled={saving}
            confirmLabel={editor.mode === "create" ? "Lagre" : "Oppdater"}
            confirmType="submit"
            confirmLoading={saving}
          />
        </form>
      ) : null}
    </AppModal>
  );
}

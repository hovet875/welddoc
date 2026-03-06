import { useCallback } from "react";
import { type ConfirmModalArgs, useConfirmModal } from "./useConfirmModal";

export type DeleteConfirmArgs = {
  title: string;
  messageHtml: string;
  onConfirm: () => Promise<void> | void;
  onDone?: (() => Promise<void>) | (() => void);
  confirmLabel?: string;
  cancelLabel?: string;
  warningText?: string;
  errorMessage?: string;
};

export function useDeleteConfirmModal() {
  const { openConfirmModal, confirmModal } = useConfirmModal({
    confirmTone: "danger",
    confirmLabel: "Slett",
    cancelLabel: "Avbryt",
    warningText: "Dette kan ikke angres.",
    errorMessage: "Feil ved sletting.",
  });

  const confirmDelete = useCallback(
    (args: DeleteConfirmArgs) => {
      const confirmArgs: ConfirmModalArgs = {
        title: args.title,
        messageHtml: args.messageHtml,
        onConfirm: args.onConfirm,
        onDone: args.onDone,
        confirmTone: "danger",
        confirmLabel: args.confirmLabel ?? "Slett",
        cancelLabel: args.cancelLabel ?? "Avbryt",
        warningText: args.warningText ?? "Dette kan ikke angres.",
        errorMessage: args.errorMessage ?? "Feil ved sletting.",
      };
      openConfirmModal(confirmArgs);
    },
    [openConfirmModal]
  );

  return { confirmDelete, deleteConfirmModal: confirmModal };
}

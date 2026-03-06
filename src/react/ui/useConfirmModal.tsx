import { useCallback, useState, type ReactNode } from "react";
import { Text, type ModalProps } from "@mantine/core";
import { notifyError } from "@react/ui/notify";
import { type AppButtonTone } from "./AppButton";
import { AppModal } from "./AppModal";
import { AppModalActions } from "./AppModalActions";

export type ConfirmModalArgs = {
  title: string;
  messageHtml?: string;
  message?: ReactNode;
  warningText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: AppButtonTone;
  onConfirm: () => Promise<void> | void;
  onDone?: (() => Promise<void>) | (() => void);
  errorMessage?: string;
  size?: ModalProps["size"];
};

type UseConfirmModalOptions = {
  confirmLabel?: string;
  cancelLabel?: string;
  warningText?: string;
  confirmTone?: AppButtonTone;
  errorMessage?: string;
};

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useConfirmModal(options?: UseConfirmModalOptions) {
  const [confirmState, setConfirmState] = useState<ConfirmModalArgs | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const closeConfirmModal = useCallback(() => {
    setConfirmState(null);
    setSubmitting(false);
  }, []);

  const openConfirmModal = useCallback((args: ConfirmModalArgs) => {
    setConfirmState(args);
  }, []);

  const submitConfirmModal = useCallback(async () => {
    if (!confirmState) return;

    try {
      setSubmitting(true);
      const onDone = confirmState.onDone;
      await confirmState.onConfirm();
      closeConfirmModal();
      await onDone?.();
    } catch (err) {
      console.error(err);
      notifyError(
        readErrorMessage(err, confirmState.errorMessage ?? options?.errorMessage ?? "Kunne ikke fullføre handlingen.")
      );
      setSubmitting(false);
    }
  }, [closeConfirmModal, confirmState, options?.errorMessage]);

  const warningText = confirmState?.warningText ?? options?.warningText;
  const cancelLabel = confirmState?.cancelLabel ?? options?.cancelLabel ?? "Avbryt";
  const confirmLabel = confirmState?.confirmLabel ?? options?.confirmLabel ?? "Bekreft";
  const confirmTone = confirmState?.confirmTone ?? options?.confirmTone ?? "primary";

  const confirmModal: ReactNode = (
    <AppModal
      opened={confirmState != null}
      onClose={closeConfirmModal}
      title={confirmState?.title ?? ""}
      busy={submitting}
      size={confirmState?.size}
    >
      {confirmState?.message ?? null}
      {confirmState?.messageHtml ? (
        <Text component="div" dangerouslySetInnerHTML={{ __html: confirmState.messageHtml }} />
      ) : null}
      {warningText ? (
        <Text c="dimmed" size="sm" mt="xs">
          {warningText}
        </Text>
      ) : null}

      <AppModalActions
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        onCancel={closeConfirmModal}
        onConfirm={() => void submitConfirmModal()}
        cancelDisabled={submitting}
        confirmLoading={submitting}
        confirmTone={confirmTone}
      />
    </AppModal>
  );

  return { openConfirmModal, closeConfirmModal, confirmModal };
}

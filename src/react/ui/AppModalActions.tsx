import { Group } from "@mantine/core";
import { AppButton, type AppButtonTone } from "./AppButton";

type AppModalActionsProps = {
  cancelLabel?: string;
  confirmLabel: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  showCancel?: boolean;
  showConfirm?: boolean;
  cancelDisabled?: boolean;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  confirmTone?: AppButtonTone;
  confirmType?: "button" | "submit" | "reset";
};

export function AppModalActions({
  cancelLabel = "Avbryt",
  confirmLabel,
  onCancel,
  onConfirm,
  showCancel = true,
  showConfirm = true,
  cancelDisabled,
  confirmDisabled,
  confirmLoading,
  confirmTone = "primary",
  confirmType = "button",
}: AppModalActionsProps) {
  if (!showCancel && !showConfirm) return null;

  return (
    <Group justify="flex-end" mt="md">
      {showCancel ? (
        <AppButton tone="neutral" onClick={onCancel} disabled={cancelDisabled}>
          {cancelLabel}
        </AppButton>
      ) : null}
      {showConfirm ? (
        <AppButton
          tone={confirmTone}
          onClick={onConfirm}
          type={confirmType}
          disabled={confirmDisabled}
          loading={confirmLoading}
        >
          {confirmLabel}
        </AppButton>
      ) : null}
    </Group>
  );
}

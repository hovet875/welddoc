import { Modal, type ModalProps } from "@mantine/core";

type AppModalProps = ModalProps & {
  busy?: boolean;
};

export function AppModal({
  busy = false,
  centered = true,
  closeOnClickOutside,
  closeOnEscape,
  classNames,
  ...props
}: AppModalProps) {
  const mergedClassNames = {
    ...classNames,
    content: `${classNames?.content ? `${classNames.content} ` : ""}app-modal-content`,
  };

  return (
    <Modal
      centered={centered}
      closeOnClickOutside={closeOnClickOutside ?? !busy}
      closeOnEscape={closeOnEscape ?? !busy}
      classNames={mergedClassNames}
      {...props}
    />
  );
}

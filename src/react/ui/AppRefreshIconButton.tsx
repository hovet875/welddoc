import type { MouseEventHandler } from "react";
import { ActionIcon } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";

type Props = {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  className?: string;
  size?: number;
};

export function AppRefreshIconButton({
  onClick,
  disabled,
  loading,
  title = "Oppdater",
  className,
  size = 38,
}: Props) {
  return (
    <ActionIcon
      variant="light"
      color="brand"
      radius="xl"
      size={size}
      type="button"
      aria-label={title}
      title={title}
      className={className}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
    >
      <IconRefresh size={20} stroke={1.9} />
    </ActionIcon>
  );
}

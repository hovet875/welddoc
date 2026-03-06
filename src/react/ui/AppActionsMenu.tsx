import type { ReactNode } from "react";
import { ActionIcon, Menu } from "@mantine/core";
import { IconDotsVertical, IconPencil, IconPrinter, IconTrash, IconUserCheck, IconUserOff } from "@tabler/icons-react";

export type AppActionsMenuItem = {
  key: string;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  color?: string;
  disabled?: boolean;
};

type BuildActionItemArgs = Pick<AppActionsMenuItem, "key" | "label" | "onClick" | "disabled">;

export function createEditAction({
  key = "edit",
  label = "Rediger",
  onClick,
  disabled,
}: Partial<BuildActionItemArgs> & Pick<BuildActionItemArgs, "onClick">): AppActionsMenuItem {
  return {
    key,
    label,
    icon: <IconPencil size={16} />,
    onClick,
    disabled,
  };
}

export function createDeleteAction({
  key = "delete",
  label = "Slett",
  onClick,
  disabled,
}: Partial<BuildActionItemArgs> & Pick<BuildActionItemArgs, "onClick">): AppActionsMenuItem {
  return {
    key,
    label,
    icon: <IconTrash size={16} />,
    color: "red",
    onClick,
    disabled,
  };
}

export function createPrintAction({
  key = "print",
  label = "Skriv ut",
  onClick,
  disabled,
}: Partial<BuildActionItemArgs> & Pick<BuildActionItemArgs, "onClick">): AppActionsMenuItem {
  return {
    key,
    label,
    icon: <IconPrinter size={16} />,
    onClick,
    disabled,
  };
}

export function createActivateAction({
  key = "activate",
  label = "Aktiver",
  onClick,
  disabled,
}: Partial<BuildActionItemArgs> & Pick<BuildActionItemArgs, "onClick">): AppActionsMenuItem {
  return {
    key,
    label,
    icon: <IconUserCheck size={16} />,
    color: "green",
    onClick,
    disabled,
  };
}

export function createDeactivateAction({
  key = "deactivate",
  label = "Deaktiver",
  onClick,
  disabled,
}: Partial<BuildActionItemArgs> & Pick<BuildActionItemArgs, "onClick">): AppActionsMenuItem {
  return {
    key,
    label,
    icon: <IconUserOff size={16} />,
    color: "yellow",
    onClick,
    disabled,
  };
}

type AppActionsMenuProps = {
  items: AppActionsMenuItem[];
  title?: string;
  disabled?: boolean;
  size?: number;
};

export function AppActionsMenu({
  items,
  title = "Handlinger",
  disabled = false,
  size = 34,
}: AppActionsMenuProps) {
  return (
    <Menu withinPortal position="bottom-end" shadow="md">
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          radius="xl"
          size={size}
          type="button"
          aria-label={title}
          title={title}
          disabled={disabled}
        >
          <IconDotsVertical size={18} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        {items.map((item) => (
          <Menu.Item
            key={item.key}
            leftSection={item.icon}
            color={item.color}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            {item.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

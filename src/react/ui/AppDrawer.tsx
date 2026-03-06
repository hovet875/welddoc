import { Drawer, type DrawerProps } from "@mantine/core";

type AppDrawerProps = DrawerProps & {
  busy?: boolean;
};

export function AppDrawer({
  busy = false,
  closeOnClickOutside,
  closeOnEscape,
  position = "right",
  ...props
}: AppDrawerProps) {
  return (
    <Drawer
      position={position}
      closeOnClickOutside={closeOnClickOutside ?? !busy}
      closeOnEscape={closeOnEscape ?? !busy}
      {...props}
    />
  );
}

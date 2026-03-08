import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Burger,
  Button,
  Divider,
  Drawer,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronRight,
  IconLogout,
  IconSettings,
  IconUser,
  IconHome2,
  IconFolder,
  IconCertificate,
  IconFileSettings,
  IconIdBadge2,
  IconZoomScan,
} from "@tabler/icons-react";
import { signOutSafely } from "@react/auth/logout";
import { preloadRouteForPath } from "@react/router/routePreload";
import { ROUTES } from "@react/router/routes";

type AppHeaderProps = {
  displayName: string;
  email: string;
};

const NAV_ITEMS = [
  { to: ROUTES.home, label: "Hjem", icon: IconHome2 },
  { to: ROUTES.projects, label: "Prosjekter", icon: IconFolder },
  { to: ROUTES.materialCerts, label: "Materialsertifikater", icon: IconCertificate },
  { to: ROUTES.wps, label: "Sveiseprosedyrer", icon: IconFileSettings },
  { to: ROUTES.certs, label: "Sveisesertifikater", icon: IconIdBadge2 },
  { to: ROUTES.ndt, label: "NDT", icon: IconZoomScan },
];

export function AppHeader({ displayName, email }: AppHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpened, setMobileNavOpened] = useState(false);

  const isActive = (to: string) => {
    if (to === ROUTES.home) return location.pathname === ROUTES.home;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const handleLogout = useCallback(async () => {
    await signOutSafely("Utlogging feilet");
    setMobileNavOpened(false);
    navigate(ROUTES.login, { replace: true });
  }, [navigate]);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpened(false);
  }, []);

  const prefetch = useCallback((to: string) => {
    void preloadRouteForPath(to);
  }, []);

  return (
    <Box
      component="header"
      pb={0}
      mb="lg"
      style={{
        background: "transparent",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <Paper
        withBorder
        radius="xl"
        px="lg"
        py="md"
        style={{
          background: "rgba(10, 18, 32, 0.55)",
          borderColor: "rgba(255,255,255,0.10)",
          boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
          backdropFilter: "blur(14px)",
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap" gap="md">
          <Box
            component={Link}
            to={ROUTES.home}
            onMouseEnter={() => prefetch(ROUTES.home)}
            onFocus={() => prefetch(ROUTES.home)}
            onTouchStart={() => prefetch(ROUTES.home)}
            aria-label="Gå til startsiden"
            style={{ display: "inline-flex", flexShrink: 0 }}
          >
            <Box
              component="img"
              src="/images/titech-logo-header.png"
              alt="WeldDoc"
              h={{ base: 54, sm: 96 }}
              w="auto"
              style={{ objectFit: "contain" }}
            />
          </Box>

          <Group
            gap="xs"
            justify="center"
            align="center"
            wrap="nowrap"
            visibleFrom="md"
            style={{ flex: 1, minWidth: 0 }}
          >
            {NAV_ITEMS.map((item) => {
  const active = isActive(item.to);
  const Icon = item.icon;

  return (
    <Button
      key={item.to}
      component={Link}
      to={item.to}
      onMouseEnter={() => prefetch(item.to)}
      onFocus={() => prefetch(item.to)}
      onTouchStart={() => prefetch(item.to)}
      radius="xl"
      size="sm"
      variant={active ? "filled" : "light"}
      color={active ? "brand" : "gray"}
      leftSection={<Icon size={16} aria-hidden="true" />}
    >
      {item.label}
    </Button>
  );
})}
          </Group>

          <Group justify="flex-end" align="center" gap="sm" style={{ flexShrink: 0 }}>
            <Box maw={240} visibleFrom="md" style={{ flexShrink: 0 }}>
              <Menu position="bottom-end" shadow="md">
                <Menu.Target>
                  <UnstyledButton id="user-avatar" aria-label="Brukerprofil" style={{ display: "block" }}>
                    <Paper
                      withBorder
                      radius="xl"
                      px="md"
                      py="sm"
                      style={{
                        minWidth: 132,
                        background: "linear-gradient(180deg, rgba(17, 26, 46, 0.94), rgba(13, 21, 39, 0.92))",
                        borderColor: "rgba(122, 162, 255, 0.20)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 14px 30px rgba(0,0,0,0.22)",
                        backdropFilter: "blur(14px)",
                      }}
                    >
                      <Stack gap={8} align="center">
                        <Avatar
                          color="brand"
                          variant="light"
                          radius="xl"
                          size={44}
                          style={{
                            border: "3px solid rgba(69, 168, 239, 0.55)",
                            boxShadow: "0 0 0 4px rgba(69, 168, 239, 0.10)",
                          }}
                        >
                          <IconUser size={16} aria-hidden="true" />
                        </Avatar>

                        <Text ta="center" size="sm" fw={600} truncate c="white">
                          {displayName}
                        </Text>
                      </Stack>
                    </Paper>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown>
                  {email ? (
                    <>
                      <Menu.Label>{email}</Menu.Label>
                      <Menu.Divider />
                    </>
                  ) : null}
                  <Menu.Item
                    component={Link}
                    to={ROUTES.settings}
                    leftSection={<IconSettings size={14} />}
                    onMouseEnter={() => prefetch(ROUTES.settings)}
                    onFocus={() => prefetch(ROUTES.settings)}
                    onTouchStart={() => prefetch(ROUTES.settings)}
                  >
                    Innstillinger
                  </Menu.Item>
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={14} />}
                    onClick={() => void handleLogout()}
                  >
                    Logg ut
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Box>

            <Burger
              hiddenFrom="md"
              opened={mobileNavOpened}
              onClick={() => setMobileNavOpened((opened) => !opened)}
              aria-label={mobileNavOpened ? "Lukk navigasjon" : "Åpne navigasjon"}
              color="white"
            />
          </Group>
        </Group>
      </Paper>

      <Drawer
        opened={mobileNavOpened}
        onClose={closeMobileNav}
        hiddenFrom="md"
        position="right"
        size="100%"
        title="Meny"
        padding="lg"
        overlayProps={{ backgroundOpacity: 0.55, blur: 4 }}
        styles={{
          content: {
            background: "linear-gradient(180deg, rgba(9, 16, 28, 0.98), rgba(13, 20, 34, 0.99))",
          },
          header: {
            background: "transparent",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          },
          body: {
            paddingTop: 8,
          },
        }}
      >
        <Stack gap="md">
          <Paper
            withBorder
            radius="lg"
            p="md"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Group wrap="nowrap" align="center">
              <Avatar color="brand" variant="light" radius="xl" size="lg">
                <IconUser size={18} aria-hidden="true" />
              </Avatar>
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Text size="sm" fw={700} c="white" truncate>
                  {displayName}
                </Text>
                {email ? (
                  <Text size="xs" c="dimmed" truncate>
                    {email}
                  </Text>
                ) : null}
              </Stack>
            </Group>
          </Paper>

          <Stack gap="xs">
              {NAV_ITEMS.map((item) => {
  const active = isActive(item.to);
  const Icon = item.icon;

  return (
    <Button
      key={item.to}
      component={Link}
      to={item.to}
      onMouseEnter={() => prefetch(item.to)}
      onFocus={() => prefetch(item.to)}
      onTouchStart={() => prefetch(item.to)}
      justify="space-between"
      variant={active ? "filled" : "light"}
      color={active ? "brand" : "gray"}
      radius="lg"
      size="md"
      fullWidth
      leftSection={<Icon size={18} aria-hidden="true" />}
      rightSection={<IconChevronRight size={16} />}
      onClick={closeMobileNav}
    >
      {item.label}
    </Button>
  );
})}
          </Stack>

          <Divider color="rgba(255,255,255,0.08)" />

          <Button
            component={Link}
            to={ROUTES.settings}
            onMouseEnter={() => prefetch(ROUTES.settings)}
            onFocus={() => prefetch(ROUTES.settings)}
            onTouchStart={() => prefetch(ROUTES.settings)}
            variant="subtle"
            color="gray"
            radius="lg"
            size="md"
            justify="space-between"
            leftSection={<IconSettings size={18} />}
            rightSection={<IconChevronRight size={16} />}
            onClick={closeMobileNav}
          >
            Innstillinger
          </Button>

          <Button
            variant="light"
            color="red"
            radius="lg"
            size="md"
            leftSection={<IconLogout size={18} />}
            onClick={() => void handleLogout()}
          >
            Logg ut
          </Button>
        </Stack>
      </Drawer>
    </Box>
  );
}

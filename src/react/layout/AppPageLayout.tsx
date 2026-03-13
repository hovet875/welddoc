import type { ReactNode } from "react";
import { Alert, AppShell, Box, Button, Container, Group, Stack } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useAuth } from "../auth/AuthProvider";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";

type AppPageLayoutProps = {
  pageClassName?: string;
  mainClassName?: string;
  displayName?: string;
  email?: string;
  children: ReactNode;
};

export function AppPageLayout({
  pageClassName,
  mainClassName,
  displayName,
  email,
  children,
}: AppPageLayoutProps) {
  const { access, session, status, message, clearMessage, refresh } = useAuth();
  const resolvedDisplayName = displayName ?? access?.displayName ?? "Bruker";
  const resolvedEmail = email ?? session?.user?.email ?? "";
  const shellClassName = pageClassName ? `app-shell shell ${pageClassName}` : "app-shell shell";
  const contentClassName = mainClassName ? `app-main main ${mainClassName}` : "app-main main";

  return (
    <AppShell padding={0} className={shellClassName}>
      <AppShell.Main className={contentClassName}>
        <Container
          size={1600}
          px={{ base: "md", sm: "lg" }}
          py={{ base: "md", sm: "lg" }}
        >
          <Box mb="md">
            <AppHeader displayName={resolvedDisplayName} email={resolvedEmail} />
          </Box>
          <Stack gap="sm">
            {status === "authenticated" && message ? (
              <Alert
                color="orange"
                variant="light"
                title="Tilkoblingsproblem"
                icon={<IconAlertCircle size={18} />}
              >
                {message}
                <Group gap="xs" mt="sm">
                  <Button size="compact-sm" variant="light" color="orange" onClick={() => void refresh()}>
                    Prøv igjen
                  </Button>
                  <Button size="compact-sm" variant="subtle" color="gray" onClick={clearMessage}>
                    Skjul
                  </Button>
                </Group>
              </Alert>
            ) : null}
            {children}
          </Stack>
          <AppFooter />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

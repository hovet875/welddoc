import { Box, Group, Paper, Text } from "@mantine/core";

export function AppFooter() {
  const year = new Date().getFullYear();
  const appVersion = __APP_VERSION__;

  return (
    <Box
      component="footer"
      role="contentinfo"
      mt="xl"
      style={{
        paddingBottom: "max(var(--mantine-spacing-sm), env(safe-area-inset-bottom))",
      }}
    >
      <Paper withBorder radius="xl" p="md">
        <Group justify="space-between" align="center" gap="sm" wrap="wrap">
          <Text c="dimmed" size="sm">
            Ti-Tech Sveis AS - {year}
          </Text>
          <Text c="dimmed" size="sm">
            Versjon {appVersion}
          </Text>
        </Group>
      </Paper>
    </Box>
  );
}

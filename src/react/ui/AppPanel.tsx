import type { CSSProperties, ReactNode } from "react";
import { Box, Group, Paper, Stack, Text } from "@mantine/core";

type AppPanelProps = {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function AppPanel({ title, meta, actions, children, className, bodyClassName, style, bodyStyle }: AppPanelProps) {
  const hasHeader = title != null || meta != null || actions != null;

  return (
    <Paper withBorder radius="xl" shadow="md" className={cx("app-panel", className)} style={style}>
      {hasHeader ? (
        <Group
          className="app-panel__header"
          justify="space-between"
          align="center"
          gap="sm"
          px="md"
          py="sm"
        >
          <Stack gap={2} className="app-panel__titleblock">
            {title != null ? (
              <Text component="div" fw={700}>
                {title}
              </Text>
            ) : null}
            {meta != null ? (
              <Text component="div" c="dimmed" size="sm">
                {meta}
              </Text>
            ) : null}
          </Stack>
          {actions}
        </Group>
      ) : null}

      <Box p="sm" className={bodyClassName} style={bodyStyle}>
        {children}
      </Box>
    </Paper>
  );
}

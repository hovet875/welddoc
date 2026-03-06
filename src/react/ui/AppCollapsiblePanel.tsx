import { useState, type ReactNode } from "react";
import { Accordion, Box, Group, Paper, Text } from "@mantine/core";

type AppCollapsiblePanelProps = {
  title: ReactNode;
  meta?: ReactNode;
  defaultCollapsed?: boolean;
  children: ReactNode;
};

export function AppCollapsiblePanel({
  title,
  meta,
  defaultCollapsed = true,
  children,
}: AppCollapsiblePanelProps) {
  const ITEM_VALUE = "content";
  const [value, setValue] = useState<string | null>(defaultCollapsed ? null : ITEM_VALUE);

  return (
    <Paper withBorder radius="xl" shadow="md" className="app-collapsible-panel">
      <Accordion
        value={value}
        onChange={setValue}
        variant="default"
        radius={0}
        chevronPosition="right"
        classNames={{
          item: "app-collapsible-panel__item",
          control: "app-collapsible-panel__control",
          panel: "app-collapsible-panel__panel",
        }}
      >
        <Accordion.Item value={ITEM_VALUE}>
          <Accordion.Control>
            <Group gap="sm" wrap="nowrap">
              <Text fw={700}>{title}</Text>
              {meta != null ? (
                <Text c="dimmed" size="sm">
                  {meta}
                </Text>
              ) : null}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Box>{children}</Box>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
}

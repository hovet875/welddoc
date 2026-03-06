import { Link } from "react-router-dom";
import { Paper, SimpleGrid, Text, Group, ThemeIcon } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import type { CompanySettingsMenuItem } from "../company-settings.types";

type CompanySettingsMenuProps = {
  items: CompanySettingsMenuItem[];
};

export function CompanySettingsMenu({ items }: CompanySettingsMenuProps) {
  return (
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" verticalSpacing="md">
      {items.map((item) => (
        <Paper
          key={item.to}
          component={Link}
          to={item.to}
          withBorder
          radius="xl"
          shadow="md"
          p="lg"
          style={{
            display: "block",
            textDecoration: "none",
            height: "100%",
          }}
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <div>
              <Text fw={700} size="lg">
                {item.title}
              </Text>
              <Text c="dimmed" size="sm" mt={6}>
                {item.meta}
              </Text>
            </div>

            <ThemeIcon variant="light" radius="xl">
              <IconChevronRight size={18} />
            </ThemeIcon>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
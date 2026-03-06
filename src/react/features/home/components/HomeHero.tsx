import { Group, Paper, SimpleGrid, Text, ThemeIcon } from "@mantine/core";
import { IconChevronRight, IconFlame, IconZoomScan } from "@tabler/icons-react";
import { AppPanel } from "@react/ui/AppPanel";

type HomeHeroProps = {
  onOpenQuickWeld: () => void;
  onOpenQuickTraceability: () => void;
};

const ACTION_ITEMS = [
  {
    key: "quick-weld",
    title: "Hurtigregistrer sveis",
    icon: IconFlame,
  },
  {
    key: "quick-traceability",
    title: "Hurtigregistrer sporbarhet",
    icon: IconZoomScan,
  },
] as const;

export function HomeHero({ onOpenQuickWeld, onOpenQuickTraceability }: HomeHeroProps) {
  return (
    <AppPanel title="Hurtighandlinger">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {ACTION_ITEMS.map((item) => {
          const Icon = item.icon;
          const isQuickWeld = item.key === "quick-weld";
          const isQuickTraceability = item.key === "quick-traceability";

          if (isQuickWeld) {
            return (
              <Paper
                key={item.key}
                component="button"
                type="button"
                onClick={onOpenQuickWeld}
                withBorder
                radius="xl"
                p="lg"
                style={{
                  display: "block",
                  textDecoration: "none",
                  height: "100%",
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "inherit",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon variant="light" radius="xl" size="lg" color="brand">
                      <Icon size={18} />
                    </ThemeIcon>
                    <Text fw={700}>{item.title}</Text>
                  </Group>

                  <ThemeIcon variant="light" radius="xl" color="gray">
                    <IconChevronRight size={18} />
                  </ThemeIcon>
                </Group>
              </Paper>
            );
          }

          if (isQuickTraceability) {
            return (
              <Paper
                key={item.key}
                component="button"
                type="button"
                onClick={onOpenQuickTraceability}
                withBorder
                radius="xl"
                p="lg"
                style={{
                  display: "block",
                  textDecoration: "none",
                  height: "100%",
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "inherit",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon variant="light" radius="xl" size="lg" color="brand">
                      <Icon size={18} />
                    </ThemeIcon>
                    <Text fw={700}>{item.title}</Text>
                  </Group>

                  <ThemeIcon variant="light" radius="xl" color="gray">
                    <IconChevronRight size={18} />
                  </ThemeIcon>
                </Group>
              </Paper>
            );
          }

          return null;
        })}
      </SimpleGrid>
    </AppPanel>
  );
}

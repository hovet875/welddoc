import { useEffect, useState } from "react";
import { Grid, Paper, Stack, Text } from "@mantine/core";
import { fetchProjectPage, type ProjectRow } from "@/repo/projectRepo";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppLinkButton } from "@react/ui/AppLinkButton";
import { AppPanel } from "@react/ui/AppPanel";
import { ROUTES, routePath } from "@react/router/routes";

const CREATED_AT_FMT = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "short",
});

type RecentProjectsPanelProps = {
  isAdmin: boolean;
};

function formatCreatedAt(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  return CREATED_AT_FMT.format(new Date(ms));
}

function buildProjectMeta(row: ProjectRow) {
  const parts: string[] = [];

  if (row.customer.trim()) {
    parts.push(row.customer.trim());
  }
  if (row.work_order.trim()) {
    parts.push(`AO ${row.work_order.trim()}`);
  }

  const createdAt = formatCreatedAt(row.created_at);
  if (createdAt) {
    parts.push(`Opprettet ${createdAt}`);
  }

  return parts.join(" | ");
}

export function RecentProjectsPanel({ isAdmin }: RecentProjectsPanelProps) {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchProjectPage({
          page: 1,
          pageSize: 10,
          filters: {
            status: "active",
            isAdmin,
          },
        });

        if (cancelled) return;
        setRows(result.items);
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setError(err instanceof Error && err.message ? err.message : "Kunne ikke laste nylige prosjekter.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  return (
    <AppPanel
      title="Nylige prosjekter"
      meta="10 siste aktive prosjekter med direkte lenke inn i prosjektet."
      style={{ height: "100%", width: "100%" }}
      actions={
        <AppLinkButton to={ROUTES.projects} size="xs">
          Se alle
        </AppLinkButton>
      }
    >
      <AppAsyncState
        loading={loading}
        error={error}
        isEmpty={rows.length === 0}
        loadingMessage="Laster prosjekter..."
        showLoadingState={false}
        emptyMessage="Ingen nylige prosjekter."
      >
        <Stack gap="sm">
          {rows.map((row) => {
            const name = row.name.trim() || "Uten navn";
            const meta = buildProjectMeta(row);

            return (
              <Paper key={row.id} withBorder radius="lg" p="md">
                <Grid gutter="sm" align="center">
                  <Grid.Col span={{ base: 12, sm: 9 }}>
                    <Stack gap={4}>
                      <Text fw={700} size="sm">
                        Prosjekt {row.project_no}
                      </Text>
                      <Text size="sm">{name}</Text>
                      <Text c="dimmed" size="xs" lh={1.45}>
                        {meta || "Vis prosjektet for detaljer."}
                      </Text>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 3 }}>
                    <AppLinkButton to={routePath.projectDetails(row.id)} size="xs" fullWidth>
                      Vis
                    </AppLinkButton>
                  </Grid.Col>
                </Grid>
              </Paper>
            );
          })}
        </Stack>
      </AppAsyncState>
    </AppPanel>
  );
}

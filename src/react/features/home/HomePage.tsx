import { useState } from "react";
import { Grid, Stack } from "@mantine/core";
import { useAuth } from "../../auth/AuthProvider";
import { AppPageLayout } from "../../layout/AppPageLayout";
import { CertificateStatusPanel } from "./components/CertificateStatusPanel";
import { HomeHero } from "./components/HomeHero";
import { QuickTraceabilityDrawer } from "./components/QuickTraceabilityDrawer";
import { QuickWeldDrawer } from "./components/QuickWeldDrawer";
import { RecentProjectsPanel } from "./components/RecentProjectsPanel";
import { UbibotCard } from "./components/UbibotCard";

export function HomePage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;
  const [quickWeldOpened, setQuickWeldOpened] = useState(false);
  const [quickTraceabilityOpened, setQuickTraceabilityOpened] = useState(false);

  return (
    <AppPageLayout pageClassName="page-home" displayName={displayName} email={email}>
      <Stack gap="md">
        <HomeHero
          onOpenQuickWeld={() => setQuickWeldOpened(true)}
          onOpenQuickTraceability={() => setQuickTraceabilityOpened(true)}
        />

        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, lg: 6 }} style={{ display: "flex" }}>
            <RecentProjectsPanel isAdmin={isAdmin} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }} style={{ display: "flex" }}>
            <CertificateStatusPanel />
          </Grid.Col>
          <Grid.Col span={12}>
            <UbibotCard />
          </Grid.Col>
        </Grid>

        <QuickWeldDrawer
          opened={quickWeldOpened}
          currentUserId={session?.user?.id ?? null}
          onClose={() => setQuickWeldOpened(false)}
        />
        <QuickTraceabilityDrawer
          opened={quickTraceabilityOpened}
          onClose={() => setQuickTraceabilityOpened(false)}
        />
      </Stack>
    </AppPageLayout>
  );
}

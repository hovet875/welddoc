import { useEffect, useMemo, useState } from "react";
import { Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { fetchHomeCertStatusData, type HomeNdtCertStatusRow, type HomeWelderCertStatusRow } from "@/repo/certRepo";
import { getCertStatus, statusLabel, statusTone, type CertStatus } from "@react/features/certs/lib/certsView";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppLinkButton } from "@react/ui/AppLinkButton";
import { AppPanel } from "@react/ui/AppPanel";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";

type CertificateListItem = {
  id: string;
  typeLabel: "Sveiser" | "NDT";
  personLabel: string;
  certificateNo: string;
  expiresAt: string | null;
  status: CertStatus;
  secondaryLabel: string;
};

type StatusCounts = Record<CertStatus, number>;

const DATE_FMT = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "short",
});

const STATUS_ORDER: Record<CertStatus, number> = {
  fault: 0,
  warn: 1,
  ok: 2,
};

const STATUS_CARD_ORDER: CertStatus[] = ["fault", "warn", "ok"];

function formatDate(value: string | null) {
  if (!value) return "Ingen utløpsdato";
  const ms = Date.parse(`${value}T00:00:00`);
  if (!Number.isFinite(ms)) return value;
  return DATE_FMT.format(new Date(ms));
}

function formatWelderLabel(row: HomeWelderCertStatusRow) {
  const displayName = String(row.profile?.display_name ?? "").trim() || "Ukjent sveiser";
  const welderNo = String(row.profile?.welder_no ?? "").trim();
  return welderNo ? `${welderNo} - ${displayName}` : displayName;
}

function buildItems(
  welderCerts: HomeWelderCertStatusRow[],
  ndtCerts: HomeNdtCertStatusRow[]
): CertificateListItem[] {
  const welderItems = welderCerts.map((row) => ({
    id: `welder:${row.id}`,
    typeLabel: "Sveiser" as const,
    personLabel: formatWelderLabel(row),
    certificateNo: row.certificate_no,
    expiresAt: row.expires_at,
    status: getCertStatus(row.expires_at),
    secondaryLabel: "Sveisesertifikat",
  }));

  const ndtItems = ndtCerts.map((row) => ({
    id: `ndt:${row.id}`,
    typeLabel: "NDT" as const,
    personLabel: row.personnel_name.trim() || "Ukjent kontrollør",
    certificateNo: row.certificate_no,
    expiresAt: row.expires_at,
    status: getCertStatus(row.expires_at),
    secondaryLabel: [row.company.trim(), row.ndt_method.trim()].filter(Boolean).join(" | ") || "NDT-sertifikat",
  }));

  return [...welderItems, ...ndtItems]
    .filter((item) => item.status !== "ok")
    .sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;

      const aTime = a.expiresAt ? Date.parse(`${a.expiresAt}T00:00:00`) : Number.POSITIVE_INFINITY;
      const bTime = b.expiresAt ? Date.parse(`${b.expiresAt}T00:00:00`) : Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;

      return a.personLabel.localeCompare(b.personLabel, "nb", { sensitivity: "base" });
    })
    .slice(0, 5);
}

function buildStatusCounts(
  welderCerts: HomeWelderCertStatusRow[],
  ndtCerts: HomeNdtCertStatusRow[]
): StatusCounts {
  const counts: StatusCounts = { fault: 0, warn: 0, ok: 0 };

  for (const row of welderCerts) {
    counts[getCertStatus(row.expires_at)] += 1;
  }
  for (const row of ndtCerts) {
    counts[getCertStatus(row.expires_at)] += 1;
  }

  return counts;
}

export function CertificateStatusPanel() {
  const [welderCerts, setWelderCerts] = useState<HomeWelderCertStatusRow[]>([]);
  const [ndtCerts, setNdtCerts] = useState<HomeNdtCertStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchHomeCertStatusData();
        if (cancelled) return;
        setWelderCerts(result.welderCerts);
        setNdtCerts(result.ndtCerts);
      } catch (err) {
        if (cancelled) return;
        setWelderCerts([]);
        setNdtCerts([]);
        setError(err instanceof Error && err.message ? err.message : "Kunne ikke laste sertifikatstatus.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusCounts = useMemo(() => buildStatusCounts(welderCerts, ndtCerts), [welderCerts, ndtCerts]);
  const criticalItems = useMemo(() => buildItems(welderCerts, ndtCerts), [welderCerts, ndtCerts]);
  const total = welderCerts.length + ndtCerts.length;

  return (
    <AppPanel
      title="Sertifikatstatus"
      meta={total > 0 ? `${total} sertifikater overvåkes` : "Ingen sertifikater funnet"}
      style={{ height: "100%", width: "100%" }}
      actions={
        <AppLinkButton to="/certs" size="xs">
          Vis sertifikater
        </AppLinkButton>
      }
    >
      <AppAsyncState
        loading={loading}
        error={error}
        isEmpty={total === 0}
        loadingMessage="Laster sertifikatstatus..."
        showLoadingState={false}
        emptyMessage="Ingen sertifikater tilgjengelig."
      >
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            {STATUS_CARD_ORDER.map((status) => (
              <Paper key={status} withBorder radius="lg" p="md">
                <Stack gap={4}>
                  <AppStatusBadge tone={statusTone(status)}>{statusLabel(status)}</AppStatusBadge>
                  <Text fw={700} size="xl">
                    {statusCounts[status]}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {status === "fault"
                      ? "Bør følges opp nå"
                      : status === "warn"
                        ? "Utløper innen 30 dager"
                        : "Ingen handling nødvendig"}
                  </Text>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>

          {criticalItems.length > 0 ? (
            <Stack gap="sm">
              {criticalItems.map((item) => (
                <Paper key={item.id} withBorder radius="lg" p="md">
                  <Stack gap={6}>
                    <Group justify="space-between" align="flex-start" gap="sm">
                      <Stack gap={2}>
                        <Text fw={700} size="sm">
                          {item.personLabel}
                        </Text>
                        <Text c="dimmed" size="xs">
                          {item.typeLabel} | {item.secondaryLabel}
                        </Text>
                      </Stack>
                      <AppStatusBadge tone={statusTone(item.status)}>{statusLabel(item.status)}</AppStatusBadge>
                    </Group>

                    <Text size="sm">Sertifikat {item.certificateNo}</Text>
                    <Text c="dimmed" size="xs">
                      Utløper {formatDate(item.expiresAt)}
                    </Text>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper withBorder radius="lg" p="md">
              <Text c="dimmed" size="sm">
                Ingen sertifikater trenger oppfølging nå.
              </Text>
            </Paper>
          )}
        </Stack>
      </AppAsyncState>
    </AppPanel>
  );
}

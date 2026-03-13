import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Checkbox, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import type { DocumentPackageCatalogEntry, DocumentPackageDocumentKey } from "@/documents/package/documentPackageCatalog";
import { getDocumentPackageLabel } from "@/documents/package/documentPackageCatalog";
import { createDocumentPackageWorkerContract, getDocumentPackageWorkerStepLabel } from "@/documents/package/documentPackageJobContract";
import { canDeleteDocumentPackageJob, type DocumentPackageJobRow } from "@/repo/documentPackageRepo";
import { createSignedUrlForFileRef } from "@/repo/fileRepo";
import { openDocumentWindow } from "@/react/ui/openDocumentWindow";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppButton } from "@react/ui/AppButton";
import { AppJobProgress, getAppJobProgressLabel, getAppJobProgressTone } from "@react/ui/AppJobProgress";
import { AppPanel } from "@react/ui/AppPanel";
import { AppStatusBadge, type AppStatusTone } from "@react/ui/AppStatusBadge";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import { notifyError, notifySuccess } from "@react/ui/notify";
import { esc } from "@/utils/dom";
import type { ProjectRow } from "../../projectDetails.types";
import { type DocumentationPackageReadinessItem, useDocumentationPackageReadiness } from "./hooks/useDocumentationPackageReadiness";
import { useDocumentationPackageJobs } from "./hooks/useDocumentationPackageJobs";
import { DocumentPackageMainPdfPreview } from "./preview/DocumentPackageMainPdfPreview";
import { buildDocumentPackageSnapshot } from "./preview/buildDocumentPackageSnapshot";

type ProjectDocumentationPackageSectionProps = {
  projectId: string;
  isAdmin: boolean;
  project: ProjectRow;
};

const JOB_DATE_TIME_FMT = new Intl.DateTimeFormat("nb-NO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function readinessTone(readiness: DocumentationPackageReadinessItem["readiness"]): AppStatusTone {
  if (readiness === "ready") return "success";
  if (readiness === "partial") return "warning";
  if (readiness === "pending") return "info";
  return "neutral";
}

function readinessBadgeLabel(readiness: DocumentationPackageReadinessItem["readiness"]) {
  if (readiness === "ready") return "Klar";
  if (readiness === "partial") return "Delvis";
  if (readiness === "pending") return "Neste steg";
  return "Mangler";
}

function deliveryLabel(definition: DocumentPackageCatalogEntry) {
  if (definition.delivery === "main-pdf") return "Kundefil PDF";
  if (definition.folderName) return `ZIP: ${definition.folderName}/`;
  return "ZIP-mappe";
}

function inclusionTone(checked: boolean, disabled: boolean): AppStatusTone {
  if (disabled) return "neutral";
  return checked ? "success" : "neutral";
}

function inclusionLabel(checked: boolean, disabled: boolean) {
  if (disabled) return "Kan ikke velges";
  return checked ? "Inkluderes" : "Ikke valgt";
}

function isSelectableItem(item: DocumentationPackageReadinessItem) {
  if (item.definition.implementation !== "available") return false;
  if (item.definition.key === "package_main_pdf") return true;
  return item.readiness === "ready" || item.readiness === "partial";
}

function documentStateColor(item: DocumentationPackageReadinessItem) {
  if (item.definition.implementation === "planned") return "neutral";
  return readinessTone(item.readiness);
}

function documentStateLabel(item: DocumentationPackageReadinessItem) {
  if (item.definition.implementation === "planned") return "Neste fase";
  return readinessBadgeLabel(item.readiness);
}

function formatJobDateTime(value: string) {
  try {
    return JOB_DATE_TIME_FMT.format(new Date(value));
  } catch {
    return value;
  }
}

function packageJobSummary(job: DocumentPackageJobRow) {
  if (job.status === "failed") {
    return job.error_message || "Dokumentpakken kunne ikke fullføres.";
  }

  if (job.status === "completed") {
    const artifacts = [
      job.source_zip_artifact ? "ZIP klar" : "",
      job.main_pdf_artifact ? "PDF klar" : "",
    ].filter(Boolean);

    if (artifacts.length > 0) {
      return artifacts.join(" og ");
    }

    return "Dokumentpakken er ferdig.";
  }

  if (job.status === "running") {
    const stepLabel = getDocumentPackageWorkerStepLabel(job.progress_step);
    return stepLabel || "Genererer dokumentpakke";
  }

  return "Venter på behandling";
}

function requestedDocumentSummary(requestedDocuments: DocumentPackageDocumentKey[]) {
  const labels = requestedDocuments.map((key) => getDocumentPackageLabel(key)).filter(Boolean);
  if (labels.length <= 4) return labels.join(", ");
  return `${labels.slice(0, 4).join(", ")} +${labels.length - 4} til`;
}

function packageJobArtifactCount(job: DocumentPackageJobRow) {
  return new Set([job.artifact_file_id, job.main_pdf_file_id, job.source_zip_file_id].filter(Boolean)).size;
}

function DocumentCard({
  item,
  checked,
  disabled,
  onToggle,
}: {
  item: DocumentationPackageReadinessItem;
  checked: boolean;
  disabled: boolean;
  onToggle: (key: DocumentPackageDocumentKey, checked: boolean) => void;
}) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group align="flex-start" wrap="nowrap" gap="sm">
          <Checkbox
            mt={4}
            checked={checked}
            disabled={disabled}
            onChange={(event) => {
              onToggle(item.definition.key, event.currentTarget.checked);
            }}
            aria-label={`Velg ${item.definition.label}`}
          />

          <Stack gap="xs" style={{ flex: 1 }}>
            <Group justify="space-between" align="flex-start" gap="sm">
              <Stack gap={2}>
                <Text fw={700}>{item.definition.label}</Text>
                <Text size="xs" c="dimmed">
                  {deliveryLabel(item.definition)}
                </Text>
              </Stack>

              <Stack gap="xs" align="flex-end">
                <AppStatusBadge tone={inclusionTone(checked, disabled)}>{inclusionLabel(checked, disabled)}</AppStatusBadge>
                <AppStatusBadge tone={documentStateColor(item)}>{documentStateLabel(item)}</AppStatusBadge>
              </Stack>
            </Group>

            <Text size="sm">{item.definition.description}</Text>

            <Text size="xs" c="dimmed">
              {item.summary}
            </Text>
          </Stack>
        </Group>
      </Stack>
    </Paper>
  );
}

function PackageJobCard({
  job,
  isAdmin,
  downloadingArtifactId,
  deletingJobId,
  onDownloadArtifact,
  onDelete,
}: {
  job: DocumentPackageJobRow;
  isAdmin: boolean;
  downloadingArtifactId: string | null;
  deletingJobId: string | null;
  onDownloadArtifact: (fileId: string) => void;
  onDelete: (job: DocumentPackageJobRow) => void;
}) {
  const summary = packageJobSummary(job);
  const canDelete = canDeleteDocumentPackageJob(job);
  const artifactCount = packageJobArtifactCount(job);

  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Text fw={700}>{formatJobDateTime(job.created_at)}</Text>
          <AppStatusBadge tone={getAppJobProgressTone(job.status)}>{getAppJobProgressLabel(job.status)}</AppStatusBadge>
        </Group>

        <Text size="sm">{summary}</Text>

        <Text size="xs" c="dimmed">
          Dokumentspor: {requestedDocumentSummary(job.requested_documents) || "Ingen registrert."}
        </Text>

        <Group gap="xs">
          {job.source_zip_artifact ? (
            <AppButton
              tone="neutral"
              size="sm"
              onClick={() => {
                onDownloadArtifact(job.source_zip_artifact!.id);
              }}
              loading={downloadingArtifactId === job.source_zip_artifact.id}
            >
              Last ned ZIP
            </AppButton>
          ) : null}

          {job.main_pdf_artifact ? (
            <AppButton
              tone="neutral"
              size="sm"
              onClick={() => {
                onDownloadArtifact(job.main_pdf_artifact!.id);
              }}
              loading={downloadingArtifactId === job.main_pdf_artifact.id}
            >
              Last ned PDF
            </AppButton>
          ) : null}

          {isAdmin ? (
            <AppButton
              tone="danger"
              size="sm"
              onClick={() => {
                onDelete(job);
              }}
              loading={deletingJobId === job.id}
              disabled={!canDelete || deletingJobId !== null}
              title={
                canDelete
                  ? artifactCount > 0
                    ? `Sletter jobb og ${artifactCount} tilhørende artefakt${artifactCount === 1 ? "" : "er"}`
                    : "Slett jobb"
                  : "Jobb som kjører kan ikke slettes ennå"
              }
            >
              Slett jobb
            </AppButton>
          ) : null}
        </Group>
      </Stack>
    </Paper>
  );
}

export function ProjectDocumentationPackageSection({ projectId, isAdmin, project }: ProjectDocumentationPackageSectionProps) {
  const [previewingMainPdf, setPreviewingMainPdf] = useState(false);
  const [downloadingArtifactId, setDownloadingArtifactId] = useState<string | null>(null);
  const [selectedDocumentKeys, setSelectedDocumentKeys] = useState<DocumentPackageDocumentKey[]>([]);
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();
  const { loading, error, snapshot, reload } = useDocumentationPackageReadiness(projectId);
  const {
    loading: jobsLoading,
    creating: jobsCreating,
    deletingJobId,
    realtimeConnected,
    error: jobsError,
    jobs,
    reload: reloadJobs,
    createJob,
    deleteJob,
  } = useDocumentationPackageJobs(projectId);

  const mainPdfItems = useMemo(
    () =>
      snapshot.items
        .filter((item) => item.definition.delivery === "main-pdf")
        .sort((left, right) => left.definition.label.localeCompare(right.definition.label)),
    [snapshot.items]
  );

  const zipFolderItems = useMemo(
    () =>
      snapshot.items
        .filter((item) => item.definition.delivery === "zip-folder")
        .sort((left, right) => {
          if (left.definition.implementation !== right.definition.implementation) {
            return left.definition.implementation === "available" ? -1 : 1;
          }
          return left.definition.label.localeCompare(right.definition.label);
        }),
    [snapshot.items]
  );

  const queuedJob = useMemo(() => jobs.find((job) => job.status === "queued") ?? null, [jobs]);
  const latestJob = useMemo(
    () => jobs.find((job) => job.status === "queued" || job.status === "running") ?? jobs[0] ?? null,
    [jobs]
  );

  useEffect(() => {
    const selectableKeys = snapshot.items.filter(isSelectableItem).map((item) => item.definition.key);

    setSelectedDocumentKeys((current) => {
      if (selectableKeys.length === 0) return [];
      const selectableSet = new Set(selectableKeys);
      const preserved = current.filter((key) => selectableSet.has(key));
      return preserved.length > 0 ? preserved : selectableKeys;
    });
  }, [snapshot.items]);

  const requestableDocumentKeys = useMemo(
    () => snapshot.items.filter((item) => isSelectableItem(item)).map((item) => item.definition.key),
    [snapshot.items]
  );

  const selectedDocumentKeySet = useMemo(() => new Set(selectedDocumentKeys), [selectedDocumentKeys]);

  const selectedRequestableDocumentKeys = useMemo(
    () => requestableDocumentKeys.filter((key) => selectedDocumentKeySet.has(key)),
    [requestableDocumentKeys, selectedDocumentKeySet]
  );

  const selectedZipDocumentCount = useMemo(
    () => selectedRequestableDocumentKeys.filter((key) => key !== "package_main_pdf").length,
    [selectedRequestableDocumentKeys]
  );

  const canPreviewMainPdf = useMemo(
    () =>
      selectedDocumentKeySet.has("package_main_pdf") &&
      selectedRequestableDocumentKeys.some((key) => key !== "package_main_pdf"),
    [selectedDocumentKeySet, selectedRequestableDocumentKeys]
  );

  const toggleDocumentSelection = (key: DocumentPackageDocumentKey, checked: boolean) => {
    if (!isAdmin) return;

    setSelectedDocumentKeys((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return Array.from(next);
    });
  };

  const downloadJobArtifact = async (fileId: string) => {
    try {
      setDownloadingArtifactId(fileId);
      const url = await createSignedUrlForFileRef(fileId, { expiresSeconds: 300 });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      notifyError(downloadError instanceof Error ? downloadError.message : "Kunne ikke laste ned artefakt.");
    } finally {
      setDownloadingArtifactId(null);
    }
  };

  const requestDeleteJob = (job: DocumentPackageJobRow) => {
    if (!isAdmin) {
      notifyError("Kun admin kan slette package-jobber.");
      return;
    }

    if (!canDeleteDocumentPackageJob(job)) {
      notifyError("Package-jobb som kjører kan ikke slettes ennå.");
      return;
    }

    const artifactCount = packageJobArtifactCount(job);
    const artifactLine =
      artifactCount > 0
        ? ` Dette sletter ogsa <b>${artifactCount}</b> artefakt${artifactCount === 1 ? "" : "er"} fra database og storage.`
        : "";

    confirmDelete({
      title: "Slett package-jobb",
      messageHtml: `Er du sikker pa at du vil slette package-jobben opprettet <b>${esc(formatJobDateTime(job.created_at))}</b>?${artifactLine}`,
      errorMessage: "Kunne ikke slette package-jobb.",
      onConfirm: async () => {
        await deleteJob(job.id);
      },
      onDone: () => {
        notifySuccess("Package-jobb slettet.");
      },
    });
  };

  const requestPackage = async () => {
    if (!isAdmin) {
      notifyError("Kun admin kan opprette package-jobber.");
      return;
    }

    if (queuedJob) {
      notifyError("Det finnes allerede en package-jobb i ko for prosjektet.");
      return;
    }

    if (!selectedRequestableDocumentKeys.length) {
      notifyError("Velg minst en leveransedel for a opprette package-jobb.");
      return;
    }

    try {
      const packageSnapshot = await buildDocumentPackageSnapshot(project, {
        requestedDocuments: selectedRequestableDocumentKeys,
      });

      const workerContract = createDocumentPackageWorkerContract({
        projectId,
        projectNo: project.project_no,
        projectName: project.name,
        requestedDocuments: selectedRequestableDocumentKeys,
        snapshot: packageSnapshot,
      });

      await createJob(selectedRequestableDocumentKeys, workerContract);
      notifySuccess(`Package-jobb opprettet med ${selectedRequestableDocumentKeys.length} valgte leveransedeler.`);
    } catch (jobError) {
      notifyError(jobError instanceof Error ? jobError.message : "Kunne ikke opprette package-jobb.");
    }
  };

  const previewMainPdf = async () => {
    try {
      setPreviewingMainPdf(true);
      const packageSnapshot = await buildDocumentPackageSnapshot(project, {
        requestedDocuments: selectedRequestableDocumentKeys,
      });

      if (!packageSnapshot.main_pdf.data) {
        throw new Error("Pakkesammendraget kunne ikke bygges for valgt innhold.");
      }

      await openDocumentWindow({
        title: `Pakkesammendrag - ${project.project_no}`,
        element: <DocumentPackageMainPdfPreview data={packageSnapshot.main_pdf.data} />,
      });
    } catch (previewError) {
      notifyError(previewError instanceof Error ? previewError.message : "Kunne ikke åpne forhåndsvisning av dokumentpakken.");
    } finally {
      setPreviewingMainPdf(false);
    }
  };

  return (
    <AppPanel
      title="Dokumentasjonspakke"
      meta={`Prosjekt ${project.project_no} · ${project.name}`}
      actions={
        <Group gap="xs" wrap="nowrap">
          {isAdmin ? (
            <AppButton
              tone="neutral"
              size="sm"
              onClick={() => {
                void previewMainPdf();
              }}
              disabled={loading || previewingMainPdf || !canPreviewMainPdf}
              loading={previewingMainPdf}
            >
              Forhåndsvis PDF
            </AppButton>
          ) : null}
          <AppButton
            tone="neutral"
            size="sm"
            onClick={() => {
              void Promise.all([reload(), reloadJobs()]);
            }}
            disabled={loading || jobsLoading}
          >
            Oppdater status
          </AppButton>
          {isAdmin ? (
            <AppButton
              tone="primary"
              size="sm"
              onClick={() => {
                void requestPackage();
              }}
              disabled={loading || jobsLoading || jobsCreating || selectedRequestableDocumentKeys.length === 0 || Boolean(queuedJob)}
              loading={jobsCreating}
            >
              Bestill pakke
            </AppButton>
          ) : null}
        </Group>
      }
    >
      <Stack gap="md">
        {!isAdmin ? (
          <Alert color="gray" variant="light">
            Kun admin kan opprette, endre og slette package-jobber.
          </Alert>
        ) : null}

        <Paper withBorder radius="lg" p="md">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={700}>Package-jobber</Text>
              <Group gap="xs">
                {latestJob && (latestJob.status === "queued" || latestJob.status === "running") ? (
                  <Badge color={realtimeConnected ? "teal" : "gray"} variant="light">
                    {realtimeConnected ? "Sanntid pa" : "Auto-oppdatering"}
                  </Badge>
                ) : null}
                {queuedJob ? (
                  <Badge color="yellow" variant="light">
                    1 i ko
                  </Badge>
                ) : null}
                <Badge color="blue" variant="light">
                  {jobs.length} registrert
                </Badge>
              </Group>
            </Group>

            {latestJob ? (
              <AppJobProgress
                title="Status"
                meta={`Opprettet ${formatJobDateTime(latestJob.created_at)}`}
                status={latestJob.status}
                value={latestJob.progress_percent}
                description={packageJobSummary(latestJob)}
              />
            ) : null}

            {queuedJob ? (
              <Text size="sm" c="dimmed">
                Ny bestilling er sperret mens en jobb star i ko.
              </Text>
            ) : null}

            {jobsError ? <Text size="sm" c="red">{jobsError}</Text> : null}

            {jobs.length > 0 ? (
              <Stack gap="sm">
                {jobs.map((job) => (
                  <PackageJobCard
                    key={job.id}
                    job={job}
                    isAdmin={isAdmin}
                    downloadingArtifactId={downloadingArtifactId}
                    deletingJobId={deletingJobId}
                    onDownloadArtifact={(fileId) => {
                      void downloadJobArtifact(fileId);
                    }}
                    onDelete={requestDeleteJob}
                  />
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Ingen package-jobber registrert ennå.
              </Text>
            )}
          </Stack>
        </Paper>

        <AppAsyncState
          loading={loading}
          error={error}
          onRetry={() => {
            void reload();
          }}
          isEmpty={snapshot.items.length === 0}
          emptyMessage="Ingen dokumentstatus tilgjengelig ennå."
          loadingMessage="Laster package-status..."
        >
          <Stack gap="lg">
            <Stack gap="sm">
              <Group justify="space-between" align="center" gap="sm">
                <Stack gap={2}>
                  <Text fw={700}>Pakkesammendrag PDF</Text>
                  <Text size="sm" c="dimmed">
                    Velg om kunde-PDF-en skal genereres sammen med de valgte ZIP-seksjonene.
                  </Text>
                </Stack>
                <AppStatusBadge tone={selectedDocumentKeySet.has("package_main_pdf") ? "success" : "neutral"}>
                  {selectedDocumentKeySet.has("package_main_pdf") ? "PDF valgt" : "PDF ikke valgt"}
                </AppStatusBadge>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                {mainPdfItems.map((item) => (
                  <DocumentCard
                    key={item.definition.key}
                    item={item}
                    checked={selectedDocumentKeySet.has(item.definition.key)}
                    disabled={!isAdmin || !isSelectableItem(item)}
                    onToggle={toggleDocumentSelection}
                  />
                ))}
              </SimpleGrid>
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between" align="center" gap="sm">
                <Stack gap={2}>
                  <Text fw={700}>ZIP-seksjoner</Text>
                  <Text size="sm" c="dimmed">
                    Kortene beskriver hva som faktisk kan leveres i hver mappe. Huk av delene som skal inngå i pakken.
                  </Text>
                </Stack>
                <AppStatusBadge tone={selectedZipDocumentCount > 0 ? "success" : "neutral"}>
                  {selectedZipDocumentCount} valgt
                </AppStatusBadge>
              </Group>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                {zipFolderItems.map((item) => (
                  <DocumentCard
                    key={item.definition.key}
                    item={item}
                    checked={selectedDocumentKeySet.has(item.definition.key)}
                    disabled={!isAdmin || !isSelectableItem(item)}
                    onToggle={toggleDocumentSelection}
                  />
                ))}
              </SimpleGrid>
            </Stack>
          </Stack>
        </AppAsyncState>

        {deleteConfirmModal}
      </Stack>
    </AppPanel>
  );
}

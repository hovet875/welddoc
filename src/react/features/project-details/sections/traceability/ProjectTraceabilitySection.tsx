import { useCallback, useMemo, useState } from "react";
import { Alert, Group, Stack, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import { createSignedUrlForFileRef } from "@/repo/fileRepo";
import {
  createProjectTraceability,
  deleteProjectTraceability,
  updateProjectTraceability,
  type ProjectTraceabilityRow,
} from "@/repo/traceabilityRepo";
import { esc } from "@/utils/dom";
import { AppActionsMenu, createPrintAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppButton } from "@react/ui/AppButton";
import { AppPanel } from "@react/ui/AppPanel";
import { AppPdfPreviewModal, type AppPdfPreviewState } from "@react/ui/AppPdfPreviewModal";
import { AppPrintSetupModal } from "@react/ui/AppPrintSetupModal";
import { notifyError, notifySuccess, toast } from "@react/ui/notify";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import { TraceabilityEditModal } from "./components/TraceabilityEditModal";
import { TraceabilityTable } from "./components/TraceabilityTable";
import { useProjectTraceabilityData } from "./hooks/useProjectTraceabilityData";
import { printTraceabilityTable } from "./lib/printTraceabilityTable";
import type { TraceabilityPrintOptions, TraceabilitySavePayload } from "./types";

type TraceabilityProject = {
  id: string;
  project_no: number;
  name: string;
};

type ProjectTraceabilitySectionProps = {
  projectId: string;
  isAdmin: boolean;
  project: TraceabilityProject;
};

const TRACEABILITY_PRINT_DEFAULTS: TraceabilityPrintOptions = {
  includeProjectMeta: true,
  statusFilter: "all",
  columns: ["code", "dimensionType", "materialType", "heat"],
};

function createPdfPreviewState(): AppPdfPreviewState {
  return {
    opened: false,
    title: "Materialsertifikat",
    url: null,
    loading: false,
    error: null,
  };
}

export function ProjectTraceabilitySection({ projectId, isAdmin, project }: ProjectTraceabilitySectionProps) {
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();

  const { loading, error, rows, types, options, materials, reloadRows } = useProjectTraceabilityData(projectId);

  const [editOpened, setEditOpened] = useState(false);
  const [editRow, setEditRow] = useState<ProjectTraceabilityRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [pdfPreview, setPdfPreview] = useState<AppPdfPreviewState>(() => createPdfPreviewState());
  const [printSetupOpened, setPrintSetupOpened] = useState(false);

  const closeEditModal = useCallback(() => {
    if (savingEdit) return;
    setEditOpened(false);
    setEditRow(null);
  }, [savingEdit]);

  const openCreateModal = useCallback(() => {
    if (!isAdmin) {
      toast("Du må være admin for å gjøre dette.");
      return;
    }
    setEditRow(null);
    setEditOpened(true);
  }, [isAdmin]);

  const openEditModal = useCallback(
    (row: ProjectTraceabilityRow) => {
      if (!isAdmin) {
        toast("Du må være admin for å gjøre dette.");
        return;
      }
      setEditRow(row);
      setEditOpened(true);
    },
    [isAdmin]
  );

  const submitEdit = useCallback(
    async (payload: TraceabilitySavePayload) => {
      try {
        setSavingEdit(true);

        if (editRow) {
          await updateProjectTraceability(editRow.id, payload);
          notifySuccess("Sporbarhet oppdatert.");
        } else {
          await createProjectTraceability({
            project_id: projectId,
            ...payload,
          });
          notifySuccess("Sporbarhet opprettet.");
        }

        if (!payload.material_certificate_id && payload.heat_number) {
          toast("Lagret med manuell heat. Koble til sertifikat senere.");
        }

        setEditOpened(false);
        setEditRow(null);

        // IMPORTANT: only reload rows (fast)
        await reloadRows();
      } catch (err) {
        console.error(err);
        notifyError(err instanceof Error ? err.message : "Klarte ikke å lagre sporbarhet.");
      } finally {
        setSavingEdit(false);
      }
    },
    [editRow, projectId, reloadRows]
  );

  const requestDelete = useCallback(
    (row: ProjectTraceabilityRow) => {
      if (!isAdmin) return;

      confirmDelete({
        title: "Slett sporbarhet",
        messageHtml: `Slett <b>${esc(row.type_code)}${row.code_index ?? ""}</b>?`,
        onConfirm: async () => {
          await deleteProjectTraceability(row.id);
        },
        onDone: async () => {
          await reloadRows();
          notifySuccess("Sporbarhet slettet.");
        },
      });
    },
    [confirmDelete, isAdmin, reloadRows]
  );

  const openCertificatePreview = useCallback(async (fileId: string) => {
    setPdfPreview({
      opened: true,
      title: "Materialsertifikat",
      url: null,
      loading: true,
      error: null,
    });

    try {
      const url = await createSignedUrlForFileRef(fileId, { expiresSeconds: 120 });
      setPdfPreview({
        opened: true,
        title: "Materialsertifikat",
        url,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error(err);
      setPdfPreview({
        opened: true,
        title: "Materialsertifikat",
        url: null,
        loading: false,
        error: err instanceof Error ? err.message : "Klarte ikke å åpne PDF-forhåndsvisning.",
      });
    }
  }, []);

  const closePdfPreview = useCallback(() => {
    setPdfPreview(createPdfPreviewState());
  }, []);

  const printTable = useCallback(
    async (printOptions?: TraceabilityPrintOptions) => {
      try {
        await printTraceabilityTable({ rows, types, project, options: printOptions });
      } catch (err) {
        console.error(err);
        notifyError(err instanceof Error ? err.message : "Klarte ikke å skrive ut sporbarhetsliste.");
      }
    },
    [project, rows, types]
  );

  const actionItems = useMemo<AppActionsMenuItem[]>(
    () => [
      {
        key: "open-first-cert",
        label: "Åpne første sertifikat",
        icon: <IconEye size={16} />,
        disabled: !rows.some((row) => Boolean(row.cert?.file_id)),
        onClick: () => {
          const fileId = rows.find((row) => row.cert?.file_id)?.cert?.file_id;
          if (!fileId) return;
          void openCertificatePreview(fileId);
        },
      },
      {
        ...createPrintAction({
          onClick: () => setPrintSetupOpened(true),
        }),
        disabled: rows.length === 0,
      },
    ],
    [openCertificatePreview, rows]
  );

  return (
    <>
      <AppPanel
        title="Materialsporbarhet"
        meta="Koble komponenter til material/filler, sertifikat og heat"
        actions={
          <Group gap="xs" wrap="nowrap">
            <AppActionsMenu title="Sporbarhet handlinger" items={actionItems} disabled={loading || Boolean(error)} />
            {isAdmin ? (
              <AppButton tone="primary" size="sm" onClick={openCreateModal}>
                Ny sporbarhet
              </AppButton>
            ) : null}
          </Group>
        }
      >
        <Stack gap="sm">
          <AppAsyncState
            loading={loading}
            error={error}
            isEmpty={!error && !loading && rows.length === 0}
            loadingMessage="Laster sporbarhet..."
            emptyMessage="Ingen sporbarhet registrert."
          >
            <TraceabilityTable
              rows={rows}
              types={types}
              isAdmin={isAdmin}
              onEdit={openEditModal}
              onDelete={requestDelete}
              onOpenCertificate={(fileId) => void openCertificatePreview(fileId)}
            />
          </AppAsyncState>

          {!isAdmin ? (
            <Alert color="gray" variant="light">
              Kun admin kan opprette, endre og slette sporbarhet.
            </Alert>
          ) : null}

          {!loading && !error && rows.length > 0 ? (
            <Text c="dimmed" size="sm">
              Tips: Velg heat via søk når sertifikat finnes. Bruk manuell heat kun når sertifikat ikke er tilgjengelig ennå.
            </Text>
          ) : null}
        </Stack>
      </AppPanel>

      <TraceabilityEditModal
        opened={editOpened}
        row={editRow}
        saving={savingEdit}
        isAdmin={isAdmin}
        projectId={projectId}
        types={types}
        options={options}
        materials={materials}
        onClose={closeEditModal}
        onSubmit={submitEdit}
      />

      <AppPrintSetupModal
        opened={printSetupOpened}
        onClose={() => setPrintSetupOpened(false)}
        title="Skriv ut sporbarhetsliste"
        description="Velg hvilke data som skal med i utskrift. Oppsettet er laget for å kunne gjenbrukes i andre seksjoner."
        defaultValues={TRACEABILITY_PRINT_DEFAULTS}
        statusLabel="Innhold"
        statusOptions={[
          { value: "all", label: "Alle rader" },
          { value: "ready", label: "Kun Klar" },
          { value: "manual", label: "Kun Manuell" },
          { value: "missing", label: "Kun Mangel" },
        ]}
        columnsLabel="Kolonner"
        columnOptions={[
          { key: "code", label: "Kode" },
          { key: "dimensionType", label: "Dimensjon/type" },
          { key: "materialType", label: "Materialkvalitet" },
          { key: "heat", label: "Heat nr." },
        ]}
        includeProjectMetaLabel="Ta med prosjektinfo i toppfelt"
        confirmLabel="Skriv ut"
        onConfirm={async (printOptions) => {
          setPrintSetupOpened(false);
          await printTable(printOptions);
        }}
      />

      <AppPdfPreviewModal preview={pdfPreview} onClose={closePdfPreview} />

      {deleteConfirmModal}
    </>
  );
}
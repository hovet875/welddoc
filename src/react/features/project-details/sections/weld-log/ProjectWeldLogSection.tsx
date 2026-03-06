import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Group, Stack, Text } from "@mantine/core";
import {
  IconCheck,
  IconFilePlus,
  IconListCheck,
  IconPlus,
  IconRefresh,
  IconRosetteDiscountCheck,
  IconRosetteDiscountCheckOff,
  IconTestPipe,
  IconX,
} from "@tabler/icons-react";
import {
  bulkUpdateProjectWelds,
  createEmptyProjectWeldRows,
  createProjectWeld,
  deleteProjectWeld,
  deleteProjectWelds,
  fetchProjectWeldPage,
  fetchProjectWeldRowsForLog,
  updateProjectWeld,
  type WeldQuickFilter,
  type ProjectWeldRow,
} from "@/repo/weldLogRepo";
import { esc } from "@/utils/dom";
import { AppActionsMenu, createPrintAction, type AppActionsMenuItem } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppButton } from "@react/ui/AppButton";
import { AppDateInput } from "@react/ui/AppDateInput";
import { AppPanel } from "@react/ui/AppPanel";
import { AppPaginationToolbar } from "@react/ui/AppPaginationToolbar";
import { AppSelect } from "@react/ui/AppSelect";
import { notifyError, notifySuccess, toast } from "@react/ui/notify";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import { WeldLogBulkAddModal } from "./components/WeldLogBulkAddModal";
import { WeldLogEditModal } from "./components/WeldLogEditModal";
import { WeldLogInfoModal } from "./components/WeldLogInfoModal";
import { WeldLogTable } from "./components/WeldLogTable";
import { useProjectWeldLogData } from "./hooks/useProjectWeldLogData";
import { printWeldLogTable } from "./lib/printWeldLogTable";
import { reportMatchesField, selectedDrawingLabel, VT_NO_REPORT_VALUE } from "./lib/weldLogUtils";
import { WeldLogPrintSetupModal } from "./print";
import type { WeldLogBulkState, WeldLogEditorValues, WeldLogProject, WeldLogStatusFilter } from "./types";

type ProjectWeldLogSectionProps = {
  projectId: string;
  isAdmin: boolean;
  project: WeldLogProject;
};

const DEFAULT_BULK: WeldLogBulkState = {
  field: "",
  value: "",
  vtNoReport: false,
  vtInspectorId: "",
};

export function ProjectWeldLogSection({ projectId, isAdmin, project }: ProjectWeldLogSectionProps) {
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();
  const storageKey = `weld-log-prefs:${projectId}`;

  const { loading, error, data, reloadAll, drawingOptions, drawingById, logByDrawingId, ensureLogIdForDrawing } = useProjectWeldLogData(
    projectId,
    project.project_no
  );

  const [drawingId, setDrawingId] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return "";
      const parsed = JSON.parse(raw) as { drawingId?: string };
      return parsed.drawingId ?? "";
    } catch {
      return "";
    }
  });
  const [logId, setLogId] = useState("");
  const [statusFilter, setStatusFilter] = useState<WeldLogStatusFilter>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return "all";
      const parsed = JSON.parse(raw) as { statusFilter?: WeldLogStatusFilter };
      if (parsed.statusFilter === "ready" || parsed.statusFilter === "pending" || parsed.statusFilter === "all") {
        return parsed.statusFilter;
      }
      return "all";
    } catch {
      return "all";
    }
  });
  const [quickFilter, setQuickFilter] = useState<WeldQuickFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return 50;
      const parsed = JSON.parse(raw) as { pageSize?: number };
      const next = Number(parsed.pageSize ?? 50);
      return next === 25 || next === 50 || next === 100 ? next : 50;
    } catch {
      return 50;
    }
  });

  const [rows, setRows] = useState<ProjectWeldRow[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const rowsRequestId = useRef(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [editOpened, setEditOpened] = useState(false);
  const [editRow, setEditRow] = useState<ProjectWeldRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [infoOpened, setInfoOpened] = useState(false);
  const [infoRow, setInfoRow] = useState<ProjectWeldRow | null>(null);

  const [bulk, setBulk] = useState<WeldLogBulkState>(DEFAULT_BULK);

  const [bulkAddOpened, setBulkAddOpened] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);

  const [printSetupOpened, setPrintSetupOpened] = useState(false);

  useEffect(() => {
    if (drawingId && drawingOptions.some((row) => row.value === drawingId)) return;
    if (drawingOptions.length > 0) {
      setDrawingId(drawingOptions[0].value);
    }
  }, [drawingId, drawingOptions]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          drawingId,
          statusFilter,
          pageSize,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [drawingId, statusFilter, pageSize, storageKey]);

  useEffect(() => {
    if (!drawingId) {
      setLogId("");
      return;
    }
    const existing = logByDrawingId.get(drawingId);
    if (existing?.id) {
      setLogId(existing.id);
      return;
    }
    void ensureLogIdForDrawing(drawingId)
      .then((nextLogId) => setLogId(nextLogId))
      .catch((err) => {
        console.error(err);
        notifyError(err instanceof Error ? err.message : "Klarte ikke å klargjøre sveiseloggen.");
      });
  }, [drawingId, logByDrawingId, ensureLogIdForDrawing]);

  useEffect(() => {
    setPage(1);
  }, [logId, statusFilter, quickFilter, pageSize]);

  const reloadRows = useCallback(async () => {
    if (!logId) {
      setRows([]);
      setRowsTotal(0);
      setRowsError(null);
      return;
    }

    const reqId = rowsRequestId.current + 1;
    rowsRequestId.current = reqId;

    setRowsLoading(true);
    setRowsError(null);

    try {
      const result = await fetchProjectWeldPage({
        logId,
        page,
        pageSize,
        statusFilter,
        quickFilter,
      });

      if (rowsRequestId.current !== reqId) return;

      const nextTotalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
      if (result.total > 0 && page > nextTotalPages) {
        setPage(nextTotalPages);
        return;
      }

      setRows(result.items);
      setRowsTotal(result.total);
    } catch (err) {
      if (rowsRequestId.current !== reqId) return;
      console.error(err);
      setRows([]);
      setRowsTotal(0);
      setRowsError("Klarte ikke å hente sveiselogg-rader.");
    } finally {
      if (rowsRequestId.current === reqId) {
        setRowsLoading(false);
      }
    }
  }, [logId, page, pageSize, statusFilter, quickFilter]);

  useEffect(() => {
    void reloadRows();
  }, [reloadRows]);

  const welderCertNoById = useMemo(
    () =>
      new Map(
        data.welderCerts.map((cert) => [cert.id, cert.certificate_no])
      ),
    [data.welderCerts]
  );

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      rows.forEach((row) => {
        if (prev.has(row.id)) next.add(row.id);
      });
      return next;
    });
  }, [rows]);

  const openCreate = useCallback(() => {
    if (!isAdmin) return;
    setEditRow(null);
    setEditOpened(true);
  }, [isAdmin]);

  const openEdit = useCallback(
    (row: ProjectWeldRow) => {
      if (!isAdmin) return;
      setEditRow(row);
      setEditOpened(true);
    },
    [isAdmin]
  );

  const openInfo = useCallback((row: ProjectWeldRow) => {
    setInfoRow(row);
    setInfoOpened(true);
  }, []);

  const closeEdit = useCallback(() => {
    if (savingEdit) return;
    setEditOpened(false);
    setEditRow(null);
  }, [savingEdit]);

  const submitEdit = useCallback(
    async (values: WeldLogEditorValues) => {
      try {
        setSavingEdit(true);
        const payload = {
          weld_no: Number(values.weld_no),
          joint_type: values.joint_type || null,
          component_a_id: values.component_a_id || null,
          component_b_id: values.component_b_id || null,
          welder_id: values.welder_id || null,
          welder_cert_id: values.welder_cert_id || null,
          wps_id: values.wps_id || null,
          weld_date: values.weld_date || null,
          filler_traceability_id: values.filler_traceability_id || null,
          visual_report_id: values.visual_report_id || null,
          visual_inspector: values.visual_inspector || null,
          crack_report_id: values.crack_report_id || null,
          volumetric_report_id: values.volumetric_report_id || null,
          status: values.status,
        };

        if (editRow?.id) {
          await updateProjectWeld(editRow.id, payload);
          notifySuccess("Sveis oppdatert.");
        } else {
          if (!logId) {
            notifyError("Velg tegning først.");
            return;
          }
          await createProjectWeld({
            log_id: logId,
            ...payload,
          });
          notifySuccess("Sveis opprettet.");
        }

        setEditOpened(false);
        setEditRow(null);
        await reloadRows();
      } catch (err) {
        console.error(err);
        notifyError(err instanceof Error ? err.message : "Klarte ikke å lagre sveis.");
      } finally {
        setSavingEdit(false);
      }
    },
    [editRow?.id, logId, reloadRows]
  );

  const requestDelete = useCallback(
    (row: ProjectWeldRow) => {
      if (!isAdmin) return;
      confirmDelete({
        title: "Slett sveis",
        messageHtml: `Slett valgt sveis <b>${esc(String(row.weld_no ?? row.id))}</b>?`,
        onConfirm: async () => {
          await deleteProjectWeld(row.id);
        },
        onDone: async () => {
          await reloadRows();
          notifySuccess("Sveis slettet.");
        },
      });
    },
    [confirmDelete, isAdmin, reloadRows]
  );

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedIds(new Set());
        return;
      }
      setSelectedIds(new Set(rows.map((row) => row.id)));
    },
    [rows]
  );

  const toggleRow = useCallback((rowId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }, []);

  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.has(row.id)), [rows, selectedIds]);

  const bulkApprove = useCallback(async () => {
    if (!selectedIds.size) return;
    try {
      await bulkUpdateProjectWelds(Array.from(selectedIds), { status: true });
      notifySuccess("Valgte rader godkjent.");
      await reloadRows();
    } catch (err) {
      console.error(err);
      notifyError(err instanceof Error ? err.message : "Klarte ikke å godkjenne valgte rader.");
    }
  }, [selectedIds, reloadRows]);

  const bulkReview = useCallback(async () => {
    if (!selectedIds.size) return;
    try {
      await bulkUpdateProjectWelds(Array.from(selectedIds), { status: false });
      notifySuccess("Valgte rader satt til kontroll.");
      await reloadRows();
    } catch (err) {
      console.error(err);
      notifyError(err instanceof Error ? err.message : "Klarte ikke å oppdatere valgte rader.");
    }
  }, [selectedIds, reloadRows]);

  const bulkDelete = useCallback(() => {
    if (!selectedIds.size) return;
    confirmDelete({
      title: "Slett valgte",
      messageHtml: `Slett <b>${selectedIds.size}</b> valgte rader?`,
      onConfirm: async () => {
        await deleteProjectWelds(Array.from(selectedIds));
      },
      onDone: async () => {
        setSelectedIds(new Set());
        await reloadRows();
        notifySuccess("Valgte rader slettet.");
      },
    });
  }, [confirmDelete, selectedIds, reloadRows]);

  const applyBulkChange = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!bulk.field) {
      toast("Velg hva du vil endre.");
      return;
    }

    const value = String(bulk.value ?? "").trim();
    const patch: Record<string, string | boolean | null> = {};
    let successMessage = "Valgte rader oppdatert.";

    if (bulk.field === "joint_type") {
      if (!value) return toast("Velg fugetype.");
      patch.joint_type = value;
      patch.welder_cert_id = null;
      successMessage = "Fugetype oppdatert.";
    } else if (bulk.field === "welder") {
      if (!value) return toast("Velg sveiser.");
      patch.welder_id = value;
      patch.welder_cert_id = null;
      successMessage = "Sveiser oppdatert.";
    } else if (bulk.field === "weld_date") {
      if (!value) return toast("Velg dato.");
      patch.weld_date = value;
      successMessage = "Dato oppdatert.";
    } else if (bulk.field === "filler") {
      if (!value) return toast("Velg tilsett.");
      patch.filler_traceability_id = value;
      successMessage = "Tilsett oppdatert.";
    } else if (bulk.field === "vt") {
      const useInspector = bulk.vtNoReport || value === VT_NO_REPORT_VALUE;
      if (useInspector) {
        const inspectorId = String(bulk.vtInspectorId ?? "").trim();
        if (!inspectorId) return toast("Velg intern godkjenner.");

        const hasConflict = selectedRows.some((row) => String(row.welder_id ?? "").trim() === inspectorId);
        if (hasConflict) {
          return toast("Intern godkjenner kan ikke være samme person som sveiser på valgt rad.");
        }

        patch.visual_report_id = null;
        patch.visual_inspector = inspectorId;
        successMessage = "Intern VT-godkjenner satt.";
      } else {
        if (!value) return toast("Velg visuell rapport.");
        const report = data.reports.find((row) => row.id === value && reportMatchesField("vt", row));
        if (!report) return toast("Ugyldig visuell rapport valgt.");
        patch.visual_report_id = report.id;
        patch.visual_inspector = null;
        successMessage = "Visuell rapport oppdatert.";
      }
    } else if (bulk.field === "pt") {
      if (!value) return toast("Velg sprekkrapport.");
      const report = data.reports.find((row) => row.id === value && reportMatchesField("pt", row));
      if (!report) return toast("Ugyldig sprekkrapport valgt.");
      patch.crack_report_id = report.id;
      successMessage = "Sprekkrapport oppdatert.";
    } else if (bulk.field === "vol") {
      if (!value) return toast("Velg volumetrisk rapport.");
      const report = data.reports.find((row) => row.id === value && reportMatchesField("vol", row));
      if (!report) return toast("Ugyldig volumetrisk rapport valgt.");
      patch.volumetric_report_id = report.id;
      successMessage = "Volumetrisk rapport oppdatert.";
    }

    try {
      await bulkUpdateProjectWelds(ids, patch as any);
      setBulk(DEFAULT_BULK);
      notifySuccess(successMessage);
      await reloadRows();
    } catch (err) {
      console.error(err);
      notifyError(err instanceof Error ? err.message : "Klarte ikke å oppdatere valgte rader.");
    }
  }, [bulk, data.reports, reloadRows, selectedIds, selectedRows]);

  const openBulkAdd = useCallback(() => {
    if (!isAdmin) return;
    if (!logId) {
      toast("Velg tegning først.");
      return;
    }
    setBulkAddOpened(true);
  }, [isAdmin, logId]);

  const submitBulkAdd = useCallback(
    async (count: number) => {
      if (!logId) {
        toast("Velg tegning først.");
        return;
      }

      try {
        setBulkAdding(true);
        const created = await createEmptyProjectWeldRows({ logId, count });
        setBulkAddOpened(false);
        await reloadRows();
        notifySuccess(`Opprettet ${created.count} tomme rader (${created.firstWeldNo}-${created.lastWeldNo}).`);
      } catch (err) {
        console.error(err);
        notifyError(err instanceof Error ? err.message : "Klarte ikke å opprette tomme rader.");
      } finally {
        setBulkAdding(false);
      }
    },
    [logId, reloadRows]
  );

  const printRows = useCallback(async () => {
    setPrintSetupOpened(true);
  }, []);

  const actionItems = useMemo<AppActionsMenuItem[]>(
    () => [
      {
        key: "refresh",
        label: "Oppdater liste",
        icon: <IconRefresh size={16} />,
        onClick: () => {
          void Promise.all([reloadAll(), reloadRows()]);
        },
      },
      {
        key: "bulk-add",
        label: "Bulk legg til tomme rader",
        icon: <IconFilePlus size={16} />,
        disabled: !isAdmin || !logId,
        onClick: openBulkAdd,
      },
      {
        ...createPrintAction({
          onClick: printRows,
        }),
        disabled: rowsTotal === 0,
      },
    ],
    [isAdmin, logId, openBulkAdd, printRows, reloadAll, reloadRows, rowsTotal]
  );

  const selectedDrawingText = useMemo(
    () => selectedDrawingLabel({ drawingId, drawingMap: drawingById }),
    [drawingId, drawingById]
  );

  return (
    <>
      <AppPanel
        title="Sveiselogg"
        meta="Oversikt over sveiser tilknyttet valgt tegning"
        actions={
          <Group gap="xs" wrap="nowrap">
            <AppActionsMenu title="Sveiselogg handlinger" items={actionItems} disabled={loading || Boolean(error)} />
            {isAdmin ? (
              <AppButton tone="primary" size="sm" onClick={openCreate} disabled={!logId} leftSection={<IconPlus size={14} />}>
                Ny sveis
              </AppButton>
            ) : null}
          </Group>
        }
      >
        <Stack gap="sm">
          <Group gap="sm" grow>
            <AppSelect
              label="Tegning"
              value={drawingId}
              onChange={(value) => {
                setDrawingId(value);
                setSelectedIds(new Set());
                setPage(1);
              }}
              data={drawingOptions}
              placeholder="Velg tegning..."
              searchable
              disabled={loading || drawingOptions.length === 0}
            />
            <AppSelect
              label="Status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter((value as WeldLogStatusFilter) || "all");
                setSelectedIds(new Set());
                setPage(1);
              }}
              data={[
                { value: "all", label: "Alle" },
                { value: "pending", label: "Til kontroll" },
                { value: "ready", label: "Godkjent" },
              ]}
              allowDeselect={false}
              searchable={false}
            />
          </Group>

          <Group gap="xs" wrap="wrap">
            <AppButton tone={quickFilter === "all" ? "primary" : "neutral"} size="xs" onClick={() => { setQuickFilter("all"); setSelectedIds(new Set()); setPage(1); }}>
              Alle
            </AppButton>
            <AppButton
              tone={quickFilter === "missingWps" ? "primary" : "neutral"}
              size="xs"
              leftSection={<IconTestPipe size={14} />}
              onClick={() => { setQuickFilter("missingWps"); setSelectedIds(new Set()); setPage(1); }}
            >
              Mangler WPS
            </AppButton>
            <AppButton
              tone={quickFilter === "missingCert" ? "primary" : "neutral"}
              size="xs"
              leftSection={<IconRosetteDiscountCheckOff size={14} />}
              onClick={() => { setQuickFilter("missingCert"); setSelectedIds(new Set()); setPage(1); }}
            >
              Mangler sertifikat
            </AppButton>
            <AppButton
              tone={quickFilter === "missingNdt" ? "primary" : "neutral"}
              size="xs"
              leftSection={<IconRosetteDiscountCheck size={14} />}
              onClick={() => { setQuickFilter("missingNdt"); setSelectedIds(new Set()); setPage(1); }}
            >
              Mangler NDT
            </AppButton>
          </Group>

          <AppAsyncState
            loading={loading || rowsLoading}
            error={error || rowsError}
            isEmpty={!error && !loading && rows.length === 0}
            loadingMessage="Laster sveiselogg..."
            emptyMessage="Ingen sveiselogg-rader funnet for valgt tegning."
          >
            <WeldLogTable
              rows={rows}
              isAdmin={isAdmin}
              welderCertNoById={welderCertNoById}
              selectedIds={selectedIds}
              onToggleAll={toggleAll}
              onToggleRow={toggleRow}
              onOpenInfo={openInfo}
              onOpenEdit={openEdit}
              onDelete={requestDelete}
            />
          </AppAsyncState>

          {!loading && !rowsLoading && !error && !rowsError && rowsTotal > 0 ? (
            <AppPaginationToolbar
              page={page}
              pageSize={pageSize}
              total={rowsTotal}
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(1);
              }}
            />
          ) : null}

          {!loading && !error ? (
            <Text size="sm" c="dimmed">
              Aktiv tegning: {selectedDrawingText}
            </Text>
          ) : null}

          {selectedIds.size > 0 ? (
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                {selectedIds.size} valgt · {rows.length} vist · {rowsTotal} totalt på tegning
              </Text>
              <Group gap="xs" align="end" grow>
                <AppSelect
                  label="Bulk-felt"
                  value={bulk.field}
                  onChange={(value) =>
                    setBulk({
                      ...DEFAULT_BULK,
                      field: (value as WeldLogBulkState["field"]) || "",
                    })
                  }
                  data={[
                    { value: "joint_type", label: "Fugetype" },
                    { value: "welder", label: "Sveiser" },
                    { value: "weld_date", label: "Dato" },
                    { value: "filler", label: "Tilsett" },
                    { value: "vt", label: "Visuell" },
                    { value: "pt", label: "Sprekk" },
                    { value: "vol", label: "Volumetrisk" },
                  ]}
                  placeholder="Velg felt..."
                />

                {bulk.field === "weld_date" ? (
                  <AppDateInput
                    label="Ny verdi"
                    value={bulk.value}
                    onChange={(value) => setBulk((prev) => ({ ...prev, value }))}
                  />
                ) : (
                  <AppSelect
                    label="Ny verdi"
                    value={bulk.value}
                    onChange={(value) =>
                      setBulk((prev) => ({
                        ...prev,
                        value,
                        vtNoReport: prev.field === "vt" ? value === VT_NO_REPORT_VALUE : prev.vtNoReport,
                      }))
                    }
                    data={
                      bulk.field === "joint_type"
                        ? data.jointTypes.map((value) => ({ value, label: value }))
                        : bulk.field === "welder"
                          ? data.welders.map((welder) => ({
                              value: welder.id,
                              label: [welder.welder_no, welder.display_name].filter(Boolean).join(" - ") || welder.id,
                            }))
                          : bulk.field === "filler"
                            ? data.fillerOptions.map((option) => ({ value: option.id, label: option.label }))
                            : bulk.field === "vt"
                              ? [
                                  { value: VT_NO_REPORT_VALUE, label: "Ingen rapport" },
                                  ...data.reports
                                    .filter((report) => reportMatchesField("vt", report))
                                    .map((report) => ({ value: report.id, label: report.report_no || report.id })),
                                ]
                              : bulk.field === "pt"
                                ? data.reports
                                    .filter((report) => reportMatchesField("pt", report))
                                    .map((report) => ({ value: report.id, label: report.report_no || report.id }))
                                : bulk.field === "vol"
                                  ? data.reports
                                      .filter((report) => reportMatchesField("vol", report))
                                      .map((report) => ({ value: report.id, label: report.report_no || report.id }))
                                  : []
                    }
                    searchable
                    clearable
                    disabled={!bulk.field}
                  />
                )}

                {bulk.field === "vt" && bulk.vtNoReport ? (
                  <AppSelect
                    label="Intern godkjenner"
                    value={bulk.vtInspectorId}
                    onChange={(value) => setBulk((prev) => ({ ...prev, vtInspectorId: value }))}
                    data={data.employees.map((employee) => ({ value: employee.id, label: employee.label }))}
                    searchable
                    clearable
                  />
                ) : null}
              </Group>

              <Group gap="xs">
                <AppButton
                  tone="neutral"
                  onClick={() => void applyBulkChange()}
                  leftSection={<IconListCheck size={14} />}
                  disabled={!bulk.field || (!bulk.value && !(bulk.field === "vt" && bulk.vtNoReport && bulk.vtInspectorId))}
                >
                  Bruk på valgte
                </AppButton>
                <AppButton tone="neutral" onClick={() => void bulkReview()} leftSection={<IconX size={14} />}>
                  Sett til kontroll
                </AppButton>
                <AppButton tone="primary" onClick={() => void bulkApprove()} leftSection={<IconCheck size={14} />}>
                  Godkjenn valgte
                </AppButton>
                {isAdmin ? (
                  <AppButton tone="danger" onClick={bulkDelete}>
                    Slett valgte
                  </AppButton>
                ) : null}
              </Group>
            </Stack>
          ) : null}

          {!isAdmin ? (
            <Alert color="gray" variant="light">
              Kun admin kan opprette, endre og slette sveiselogg-rader.
            </Alert>
          ) : null}

        </Stack>
      </AppPanel>

      <WeldLogEditModal
        opened={editOpened}
        row={editRow}
        saving={savingEdit}
        jointTypes={data.jointTypes}
        welders={data.welders}
        employees={data.employees}
        reports={data.reports}
        componentOptions={data.componentOptions}
        fillerOptions={data.fillerOptions}
        wpsOptions={data.wpsOptions}
        welderCerts={data.welderCerts}
        welderScopes={data.welderScopes}
        onClose={closeEdit}
        onSubmit={submitEdit}
      />

      <WeldLogInfoModal opened={infoOpened} row={infoRow} onClose={() => setInfoOpened(false)} />

      <WeldLogBulkAddModal
        opened={bulkAddOpened}
        loading={bulkAdding}
        onClose={() => {
          if (bulkAdding) return;
          setBulkAddOpened(false);
        }}
        onConfirm={submitBulkAdd}
      />

      <WeldLogPrintSetupModal
        opened={printSetupOpened}
        onClose={() => setPrintSetupOpened(false)}
        onConfirm={async (options) => {
          setPrintSetupOpened(false);
          try {
            const printRows = await fetchProjectWeldRowsForLog({
              logId,
              statusFilter: "all",
              quickFilter: "all",
            });
            await printWeldLogTable({
              rows: printRows,
              reports: data.reports,
              employees: data.employees,
              welders: data.welders,
              project,
              drawingLabel: selectedDrawingText,
              options,
            });
          } catch (err) {
            console.error(err);
            notifyError(err instanceof Error ? err.message : "Klarte ikke å skrive ut sveiselogg.");
          }
        }}
      />

      {deleteConfirmModal}
    </>
  );
}

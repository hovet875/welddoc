import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMediaQuery } from "@mantine/hooks";
import { createSignedUrlForFileRef } from "@/repo/fileRepo";
import { fetchProjectDrawings, type ProjectDrawingRow } from "@/repo/projectDrawingRepo";
import { fetchProjects, type ProjectRow } from "@/repo/projectRepo";
import { fetchProjectTraceability, type ProjectTraceabilityRow } from "@/repo/traceabilityRepo";
import {
  createProjectWeld,
  ensureProjectWeldLog,
  fetchNextProjectWeldNo,
  fetchProjectWeldLogId,
  fetchWeldEmployees,
  type WeldEmployeeOption,
} from "@/repo/weldLogRepo";
import { fetchWeldJointTypes } from "@/repo/weldJointTypeRepo";
import { AppButton } from "@react/ui/AppButton";
import { AppDateInput } from "@react/ui/AppDateInput";
import { AppDrawer } from "@react/ui/AppDrawer";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppNumberInput } from "@react/ui/AppNumberInput";
import { AppSelect } from "@react/ui/AppSelect";
import { AppStatusBadge } from "@react/ui/AppStatusBadge";
import { notifyError, notifySuccess } from "@react/ui/notify";

type QuickWeldDrawerProps = {
  opened: boolean;
  currentUserId: string | null;
  onClose: () => void;
};

type QuickWeldFormValues = {
  project_id: string;
  drawing_id: string;
  weld_no: string;
  joint_type: string;
  welder_id: string;
  weld_date: string;
  component_a_id: string;
  component_b_id: string;
  filler_traceability_id: string;
};

type TraceabilitySelectOption = {
  id: string;
  label: string;
  component_type: string;
  traceability_code: string;
  heat_no: string;
};

function getTodayIsoDate() {
  const now = new Date();
  const yyyy = String(now.getFullYear()).padStart(4, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function createInitialValues(): QuickWeldFormValues {
  return {
    project_id: "",
    drawing_id: "",
    weld_no: "",
    joint_type: "",
    welder_id: "",
    weld_date: getTodayIsoDate(),
    component_a_id: "",
    component_b_id: "",
    filler_traceability_id: "",
  };
}

function mapTraceabilityOption(row: ProjectTraceabilityRow): TraceabilitySelectOption {
  const componentType = String(row.type?.label ?? row.type_code ?? "").trim() || row.type_code;
  const traceabilityCode = `${row.type_code}${row.code_index ?? ""}`;
  const directHeat = String(row.heat_number ?? "").trim();
  const certHeat = String((row.cert?.heat_numbers ?? []).find((value) => String(value ?? "").trim()) ?? "").trim();
  const heat = directHeat || certHeat;
  const dn = String(row.dn ?? "").trim();

  const labelParts = [
    componentType ? `Type ${componentType}` : "",
    `Sporbarhet ${traceabilityCode}`,
    `Heat ${heat || "-"}`,
    dn ? `DN ${dn}` : "",
  ].filter(Boolean);

  return {
    id: row.id,
    component_type: componentType,
    traceability_code: traceabilityCode,
    heat_no: heat,
    label: labelParts.join(" | "),
  };
}

function sortByLabel(a: { label: string }, b: { label: string }) {
  return a.label.localeCompare(b.label, "nb", { sensitivity: "base", numeric: true });
}

function isDuplicateWeldNoError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
  if (code === "23505") return true;
  const message = "message" in err ? String((err as { message?: unknown }).message ?? "") : "";
  return message.toLowerCase().includes("uq_project_welds_log_no");
}

export function QuickWeldDrawer({ opened, currentUserId, onClose }: QuickWeldDrawerProps) {
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [baseLoading, setBaseLoading] = useState(false);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [projectContextLoading, setProjectContextLoading] = useState(false);
  const [projectContextError, setProjectContextError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [drawings, setDrawings] = useState<ProjectDrawingRow[]>([]);
  const [drawingOptions, setDrawingOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [jointTypeOptions, setJointTypeOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [welders, setWelders] = useState<WeldEmployeeOption[]>([]);
  const [componentOptions, setComponentOptions] = useState<TraceabilitySelectOption[]>([]);
  const [fillerOptions, setFillerOptions] = useState<TraceabilitySelectOption[]>([]);
  const [drawingPreviewUrl, setDrawingPreviewUrl] = useState("");
  const [drawingPreviewLoading, setDrawingPreviewLoading] = useState(false);
  const [drawingPreviewError, setDrawingPreviewError] = useState("");

  const form = useForm<QuickWeldFormValues>({
    initialValues: createInitialValues(),
  });

  const weldNoRequestRef = useRef(0);
  const autoWeldNoKeyRef = useRef("");

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: `${project.project_no} - ${project.name || "Uten navn"}`,
      })),
    [projects]
  );

  const componentOptionById = useMemo(
    () => new Map(componentOptions.map((option) => [option.id, option])),
    [componentOptions]
  );

  const fillerOptionById = useMemo(
    () => new Map(fillerOptions.map((option) => [option.id, option])),
    [fillerOptions]
  );

  const selectedComponentA = componentOptionById.get(form.values.component_a_id) ?? null;
  const selectedComponentB = componentOptionById.get(form.values.component_b_id) ?? null;
  const selectedFiller = fillerOptionById.get(form.values.filler_traceability_id) ?? null;
  const selectedDrawing = useMemo(
    () => drawings.find((row) => row.id === form.values.drawing_id) ?? null,
    [drawings, form.values.drawing_id]
  );
  const previewMinHeight = isMobile ? "60dvh" : 300;
  const previewFrameHeight = isMobile ? "52dvh" : "42dvh";
  useEffect(() => {
    if (!opened) return;
    let cancelled = false;

    form.setValues(createInitialValues());
    form.clearErrors();
    setProjects([]);
    setDrawings([]);
    setDrawingOptions([]);
    setJointTypeOptions([]);
    setWelders([]);
    setComponentOptions([]);
    setFillerOptions([]);
    setBaseError(null);
    setProjectContextError(null);
    setDrawingPreviewUrl("");
    setDrawingPreviewError("");
    setDrawingPreviewLoading(false);
    autoWeldNoKeyRef.current = "";

    void (async () => {
      setBaseLoading(true);

      try {
        const [projectRows, jointTypes, welderRows] = await Promise.all([
          fetchProjects(),
          fetchWeldJointTypes(),
          fetchWeldEmployees(),
        ]);
        if (cancelled) return;

        const activeProjects = projectRows.filter((row) => row.is_active);
        const visibleProjects = activeProjects.length > 0 ? activeProjects : projectRows;

        setProjects(visibleProjects);
        setJointTypeOptions(
          jointTypes.map((row) => ({ value: row.label, label: row.label }))
        );
        setWelders(welderRows);

        const defaultJointType =
          jointTypes.find((row) => row.label.toUpperCase() === "BW")?.label ??
          jointTypes[0]?.label ??
          "";
        if (defaultJointType) {
          form.setFieldValue("joint_type", defaultJointType);
        }

        const ownWelder = welderRows.find(
          (row) => row.id === currentUserId && Boolean(String(row.welder_no ?? "").trim())
        );
        if (ownWelder?.id) {
          form.setFieldValue("welder_id", ownWelder.id);
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setBaseError("Klarte ikke å laste data for hurtigregistrering.");
      } finally {
        if (!cancelled) {
          setBaseLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [opened, currentUserId]);

  useEffect(() => {
    if (!opened) return;
    const projectId = String(form.values.project_id ?? "").trim();
    if (!projectId) {
      setDrawings([]);
      setDrawingOptions([]);
      setComponentOptions([]);
      setFillerOptions([]);
      setProjectContextError(null);
      setDrawingPreviewUrl("");
      setDrawingPreviewError("");
      setDrawingPreviewLoading(false);
      form.setFieldValue("drawing_id", "");
      form.setFieldValue("component_a_id", "");
      form.setFieldValue("component_b_id", "");
      form.setFieldValue("filler_traceability_id", "");
      return;
    }

    let cancelled = false;
    void (async () => {
      setProjectContextLoading(true);
      setProjectContextError(null);

      try {
        const [drawings, traceabilityRows] = await Promise.all([
          fetchProjectDrawings(projectId),
          fetchProjectTraceability(projectId),
        ]);
        if (cancelled) return;
        setDrawings(drawings);

        const nextDrawingOptions = drawings
          .map((row) => ({
            value: row.id,
            label: `${row.drawing_no} - Rev ${String(row.revision ?? "-").trim().toUpperCase() || "-"}`,
          }))
          .sort(sortByLabel);
        setDrawingOptions(nextDrawingOptions);

        const validDrawingIds = new Set(nextDrawingOptions.map((option) => option.value));
        if (!validDrawingIds.has(form.values.drawing_id)) {
          form.setFieldValue("drawing_id", nextDrawingOptions[0]?.value ?? "");
        }

        const componentRows = traceabilityRows
          .filter((row) => row.cert?.certificate_type !== "filler" && !row.type?.use_filler_type)
          .map(mapTraceabilityOption)
          .sort(sortByLabel);
        const fillerRows = traceabilityRows
          .filter(
            (row) =>
              row.cert?.certificate_type === "filler" ||
              row.type?.use_filler_type ||
              Boolean(String(row.filler_type ?? "").trim())
          )
          .map(mapTraceabilityOption)
          .sort(sortByLabel);

        setComponentOptions(componentRows);
        setFillerOptions(fillerRows);

        const validComponentIds = new Set(componentRows.map((row) => row.id));
        if (!validComponentIds.has(form.values.component_a_id)) {
          form.setFieldValue("component_a_id", "");
        }
        if (!validComponentIds.has(form.values.component_b_id)) {
          form.setFieldValue("component_b_id", "");
        }

        const validFillerIds = new Set(fillerRows.map((row) => row.id));
        if (!validFillerIds.has(form.values.filler_traceability_id)) {
          form.setFieldValue("filler_traceability_id", "");
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setProjectContextError("Klarte ikke å laste tegning og sporbarhet for valgt prosjekt.");
      } finally {
        if (!cancelled) {
          setProjectContextLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [opened, form.values.project_id]);

  useEffect(() => {
    if (!opened) return;

    const drawingId = String(form.values.drawing_id ?? "").trim();
    if (!drawingId) {
      setDrawingPreviewUrl("");
      setDrawingPreviewError("");
      setDrawingPreviewLoading(false);
      return;
    }

    const selected = drawings.find((row) => row.id === drawingId) ?? null;
    if (!selected) {
      setDrawingPreviewUrl("");
      setDrawingPreviewError("");
      setDrawingPreviewLoading(false);
      return;
    }

    if (!selected.file_id) {
      setDrawingPreviewUrl("");
      setDrawingPreviewLoading(false);
      setDrawingPreviewError("Valgt tegning har ingen PDF-fil.");
      return;
    }

    let cancelled = false;
    void (async () => {
      setDrawingPreviewLoading(true);
      setDrawingPreviewError("");

      try {
        const previewUrl = await createSignedUrlForFileRef(selected.file_id!, { expiresSeconds: 900 });
        if (cancelled) return;
        setDrawingPreviewUrl(previewUrl);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setDrawingPreviewUrl("");
        setDrawingPreviewError("Klarte ikke å laste tegning for forhåndsvisning.");
      } finally {
        if (!cancelled) {
          setDrawingPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [opened, drawings, form.values.drawing_id]);

  useEffect(() => {
    if (!opened) return;
    const projectId = String(form.values.project_id ?? "").trim();
    const drawingId = String(form.values.drawing_id ?? "").trim();
    if (!projectId || !drawingId) return;

    const weldNoKey = `${projectId}:${drawingId}`;
    const requestId = weldNoRequestRef.current + 1;
    weldNoRequestRef.current = requestId;

    let cancelled = false;
    void (async () => {
      try {
        const logId = await fetchProjectWeldLogId(projectId, drawingId);
        const nextWeldNo = logId ? await fetchNextProjectWeldNo(logId) : 1;
        if (cancelled || weldNoRequestRef.current !== requestId) return;

        if (autoWeldNoKeyRef.current !== weldNoKey || !String(form.values.weld_no ?? "").trim()) {
          form.setFieldValue("weld_no", String(nextWeldNo));
        }
        autoWeldNoKeyRef.current = weldNoKey;
      } catch (err) {
        if (cancelled || weldNoRequestRef.current !== requestId) return;
        console.error(err);
        notifyError("Klarte ikke å finne neste ledige Sveis ID.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [opened, form.values.project_id, form.values.drawing_id]);

  const welderSelectOptions = useMemo(
    () => welders.map((row) => ({ value: row.id, label: row.label })),
    [welders]
  );

  const componentSelectOptions = useMemo(
    () => componentOptions.map((row) => ({ value: row.id, label: row.label })),
    [componentOptions]
  );

  const fillerSelectOptions = useMemo(
    () => fillerOptions.map((row) => ({ value: row.id, label: row.label })),
    [fillerOptions]
  );

  const save = async () => {
    const projectId = String(form.values.project_id ?? "").trim();
    const drawingId = String(form.values.drawing_id ?? "").trim();
    const weldNo = Math.trunc(Number(form.values.weld_no));
    const jointType = String(form.values.joint_type ?? "").trim();
    const welderId = String(form.values.welder_id ?? "").trim();
    const weldDate = String(form.values.weld_date ?? "").trim();
    const componentAId = String(form.values.component_a_id ?? "").trim();
    const componentBId = String(form.values.component_b_id ?? "").trim();
    const fillerId = String(form.values.filler_traceability_id ?? "").trim();

    const errors: Partial<Record<keyof QuickWeldFormValues, string>> = {};
    if (!projectId) errors.project_id = "Prosjekt er påkrevd.";
    if (!drawingId) errors.drawing_id = "Tegningsnr er påkrevd.";
    if (!Number.isFinite(weldNo) || weldNo < 1) errors.weld_no = "Sveis ID må være et positivt tall.";
    if (!jointType) errors.joint_type = "Fugetype er påkrevd.";
    if (!welderId) errors.welder_id = "Sveiser ID er påkrevd.";
    if (!weldDate) errors.weld_date = "Dato er påkrevd.";
    if (!componentAId) errors.component_a_id = "Komponent A er påkrevd.";
    if (!componentBId) errors.component_b_id = "Komponent B er påkrevd.";
    if (Object.keys(errors).length > 0) {
      form.setErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      const logId = await ensureProjectWeldLog(projectId, drawingId);

      await createProjectWeld({
        log_id: logId,
        weld_no: weldNo,
        joint_type: jointType || null,
        welder_id: welderId || null,
        weld_date: weldDate || null,
        component_a_id: componentAId || null,
        component_b_id: componentBId || null,
        filler_traceability_id: fillerId || null,
        status: false,
      });

      notifySuccess("Sveis registrert. Status er satt til Til kontroll.");
      autoWeldNoKeyRef.current = `${projectId}:${drawingId}`;
      const nextWeldNo = await fetchNextProjectWeldNo(logId);
      form.setFieldValue("weld_no", String(nextWeldNo));
      form.clearFieldError("weld_no");
    } catch (err) {
      console.error(err);
      if (isDuplicateWeldNoError(err)) {
        form.setFieldError("weld_no", "Sveis ID finnes allerede for valgt tegning.");
        try {
          const logId = await fetchProjectWeldLogId(projectId, drawingId);
          if (logId) {
            const nextWeldNo = await fetchNextProjectWeldNo(logId);
            form.setFieldValue("weld_no", String(nextWeldNo));
          }
        } catch {
          // ignore follow-up errors
        }
        notifyError("Sveis ID er allerede i bruk på valgt tegning.");
        return;
      }
      notifyError(err instanceof Error ? err.message : "Klarte ikke å lagre hurtigregistrering.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppDrawer
      opened={opened}
      onClose={() => {
        if (submitting) return;
        onClose();
      }}
      title="Hurtigregistrer sveis"
      size="min(600px, 100vw)"
      position="right"
      busy={submitting}
    >
      <Stack gap="md">
        {baseError ? (
          <Alert color="red" variant="light">
            {baseError}
          </Alert>
        ) : null}

        {projectContextError ? (
          <Alert color="red" variant="light">
            {projectContextError}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <AppSelect
            label="Prosjekt"
            value={form.values.project_id}
            onChange={(value) => form.setFieldValue("project_id", value)}
            data={projectOptions}
            error={form.errors.project_id}
            searchable
            disabled={baseLoading || submitting}
            clearable
          />
          <AppSelect
            label="Tegningsnr"
            value={form.values.drawing_id}
            onChange={(value) => form.setFieldValue("drawing_id", value)}
            data={drawingOptions}
            error={form.errors.drawing_id}
            searchable
            disabled={baseLoading || projectContextLoading || submitting || !form.values.project_id}
            clearable
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <AppNumberInput
            label="Sveis ID"
            value={form.values.weld_no}
            onChange={(value) => form.setFieldValue("weld_no", value)}
            error={form.errors.weld_no}
            min={1}
            step={1}
            disabled={submitting || projectContextLoading}
          />
          <AppSelect
            label="Fugetype"
            value={form.values.joint_type}
            onChange={(value) => form.setFieldValue("joint_type", value)}
            data={jointTypeOptions}
            error={form.errors.joint_type}
            searchable
            disabled={baseLoading || submitting}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <AppSelect
            label="Sveiser ID"
            value={form.values.welder_id}
            onChange={(value) => form.setFieldValue("welder_id", value)}
            data={welderSelectOptions}
            error={form.errors.welder_id}
            searchable
            clearable
            disabled={baseLoading || submitting}
          />
          <AppDateInput
            label="Dato"
            value={form.values.weld_date}
            onChange={(value) => form.setFieldValue("weld_date", value)}
            error={form.errors.weld_date}
            disabled={submitting}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <AppSelect
            label="Komponent A"
            value={form.values.component_a_id}
            onChange={(value) => form.setFieldValue("component_a_id", value)}
            data={componentSelectOptions}
            error={form.errors.component_a_id}
            searchable
            clearable
            description={
              selectedComponentA
                ? `Type: ${selectedComponentA.component_type || "-"} | Sporbarhet: ${selectedComponentA.traceability_code} | Heat: ${selectedComponentA.heat_no || "-"}`
                : "Velg komponent med sporbarhetskode og heat."
            }
            disabled={projectContextLoading || submitting || !form.values.project_id}
          />
          <AppSelect
            label="Komponent B"
            value={form.values.component_b_id}
            onChange={(value) => form.setFieldValue("component_b_id", value)}
            data={componentSelectOptions}
            error={form.errors.component_b_id}
            searchable
            clearable
            description={
              selectedComponentB
                ? `Type: ${selectedComponentB.component_type || "-"} | Sporbarhet: ${selectedComponentB.traceability_code} | Heat: ${selectedComponentB.heat_no || "-"}`
                : "Velg komponent med sporbarhetskode og heat."
            }
            disabled={projectContextLoading || submitting || !form.values.project_id}
          />
        </SimpleGrid>

        <AppSelect
          label="Sveisetilsett"
          value={form.values.filler_traceability_id}
          onChange={(value) => form.setFieldValue("filler_traceability_id", value)}
          data={fillerSelectOptions}
          searchable
          clearable
          description={
            selectedFiller
              ? `Sporbarhet: ${selectedFiller.traceability_code} | Heat: ${selectedFiller.heat_no || "-"}`
              : "Valgfritt. Velg tilsett med sporbarhetskode og heat ved behov."
          }
          disabled={projectContextLoading || submitting || !form.values.project_id}
        />

        <Alert color="blue" variant="light">
          <Stack gap={6}>
            <Text size="sm">Status settes automatisk ved lagring:</Text>
            <AppStatusBadge tone="info">Til kontroll</AppStatusBadge>
          </Stack>
        </Alert>

        <AppModalActions
          cancelLabel="Lukk"
          confirmLabel="Registrer sveis"
          onCancel={() => {
            if (submitting) return;
            onClose();
          }}
          onConfirm={() => {
            void save();
          }}
          confirmLoading={submitting}
          confirmDisabled={baseLoading || projectContextLoading}
        />

        <Paper withBorder radius="lg" p="sm" style={{ minHeight: previewMinHeight }}>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Forhåndsvisning av tegning
            </Text>

            {!selectedDrawing ? (
              <Text size="sm" c="dimmed">
                Velg prosjekt og tegning for forhåndsvisning.
              </Text>
            ) : null}

            {drawingPreviewLoading ? (
              <Text size="sm" c="dimmed">
                Laster tegning...
              </Text>
            ) : null}

            {drawingPreviewError ? (
              <Alert color="red" variant="light">
                {drawingPreviewError}
              </Alert>
            ) : null}

            {drawingPreviewUrl ? (
              <>
                <Box
                  component="iframe"
                  src={drawingPreviewUrl}
                  title={selectedDrawing?.drawing_no || "Tegning"}
                  style={{
                    width: "100%",
                    height: previewFrameHeight,
                    border: 0,
                    borderRadius: 10,
                    background: "#0b0e12",
                    display: "block",
                  }}
                />
                <AppButton
                  tone="neutral"
                  onClick={() => {
                    window.open(drawingPreviewUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  Åpne tegning i ny fane
                </AppButton>
              </>
            ) : null}
          </Stack>
        </Paper>
      </Stack>
    </AppDrawer>
  );
}




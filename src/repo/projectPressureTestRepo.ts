import { supabase } from "../services/supabaseClient";
import { createUuid } from "../utils/id";
import {
  createFileLink,
  createFileRecord,
  createSignedUrlForFileRef,
  deleteFileRecord,
  uploadFileToIdPath,
} from "./fileRepo";

export type PressureTestType = "pressure" | "leak";

export type PressureTestPerformerOption = {
  id: string;
  display_name: string | null;
  welder_no: string | null;
  label: string;
};

export type ProjectPressureTestRow = {
  id: string;
  project_id: string;
  test_type: PressureTestType;
  test_date: string | null;
  test_location: string | null;
  performed_by: string | null;
  test_equipment: string | null;
  gauge_id: string | null;
  gauge_cert_file_id: string | null;
  comments: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  performer?: { id: string; display_name: string | null; welder_no: string | null } | null;
  gauge_file?: { id: string; label: string | null; mime_type: string | null; size_bytes: number | null } | null;
};

export type ProjectPressureTestItemRow = {
  id: string;
  project_id: string;
  line_no: number;
  drawing_no: string | null;
  description: string | null;
  test_medium: string | null;
  working_pressure: string | null;
  test_pressure: string | null;
  hold_time: string | null;
  result: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const META_SELECT = `
  id,
  project_id,
  test_type,
  test_date,
  test_location,
  performed_by,
  test_equipment,
  gauge_id,
  gauge_cert_file_id,
  comments,
  created_by,
  created_at,
  updated_at,
  performer:performed_by (
    id,
    display_name,
    welder_no
  ),
  gauge_file:gauge_cert_file_id (
    id,
    label,
    mime_type,
    size_bytes
  )
`;

const ROW_SELECT = `
  id,
  project_id,
  line_no,
  drawing_no,
  description,
  test_medium,
  working_pressure,
  test_pressure,
  hold_time,
  result,
  created_by,
  created_at,
  updated_at
`;

const normalizeTestType = (value: string | null | undefined): PressureTestType => {
  return String(value ?? "").trim().toLowerCase() === "leak" ? "leak" : "pressure";
};

export async function listPressureTestPerformers(): Promise<PressureTestPerformerOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, welder_no")
    .order("display_name", { ascending: true, nullsFirst: false })
    .order("welder_no", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const name = String(row.display_name ?? "").trim();
    const no = String(row.welder_no ?? "").trim();
    return {
      id: String(row.id),
      display_name: name || null,
      welder_no: no || null,
      label: [no, name].filter(Boolean).join(" - ") || String(row.id),
    };
  });
}

export async function fetchProjectPressureTestMeta(projectId: string): Promise<ProjectPressureTestRow | null> {
  const { data, error } = await supabase
    .from("project_pressure_tests")
    .select(META_SELECT)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data as any),
    test_type: normalizeTestType((data as any).test_type),
  } as ProjectPressureTestRow;
}

export async function fetchProjectPressureTestRows(projectId: string): Promise<ProjectPressureTestItemRow[]> {
  const { data, error } = await supabase
    .from("project_pressure_test_rows")
    .select(ROW_SELECT)
    .eq("project_id", projectId)
    .order("line_no", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectPressureTestItemRow[];
}

export async function fetchProjectPressureTest(projectId: string) {
  const [meta, rows] = await Promise.all([fetchProjectPressureTestMeta(projectId), fetchProjectPressureTestRows(projectId)]);
  return { meta, rows };
}

export async function saveProjectPressureTestMeta(
  projectId: string,
  patch: Partial<
    Pick<
      ProjectPressureTestRow,
      "test_type" | "test_date" | "test_location" | "performed_by" | "test_equipment" | "gauge_id" | "gauge_cert_file_id" | "comments"
    >
  >
) {
  const current = await fetchProjectPressureTestMeta(projectId);
  const payload = {
    project_id: projectId,
    test_type: normalizeTestType(patch.test_type ?? current?.test_type ?? "pressure"),
    test_date: patch.test_date !== undefined ? patch.test_date : current?.test_date ?? null,
    test_location: patch.test_location !== undefined ? patch.test_location : current?.test_location ?? null,
    performed_by: patch.performed_by !== undefined ? patch.performed_by : current?.performed_by ?? null,
    test_equipment: patch.test_equipment !== undefined ? patch.test_equipment : current?.test_equipment ?? null,
    gauge_id: patch.gauge_id !== undefined ? patch.gauge_id : current?.gauge_id ?? null,
    gauge_cert_file_id: patch.gauge_cert_file_id !== undefined ? patch.gauge_cert_file_id : current?.gauge_cert_file_id ?? null,
    comments: patch.comments !== undefined ? patch.comments : current?.comments ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("project_pressure_tests")
    .upsert(payload, { onConflict: "project_id" })
    .select(META_SELECT)
    .single();
  if (error) throw error;
  return {
    ...(data as any),
    test_type: normalizeTestType((data as any).test_type),
  } as ProjectPressureTestRow;
}

const nextLineNoForProject = async (projectId: string) => {
  const { data, error } = await supabase
    .from("project_pressure_test_rows")
    .select("line_no")
    .eq("project_id", projectId)
    .order("line_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const latest = Number((data as any)?.line_no ?? 0);
  return Number.isFinite(latest) && latest > 0 ? latest + 1 : 1;
};

export async function createProjectPressureTestRow(input: {
  project_id: string;
  line_no?: number | null;
  drawing_no?: string | null;
  description?: string | null;
  test_medium?: string | null;
  working_pressure?: string | null;
  test_pressure?: string | null;
  hold_time?: string | null;
  result?: string | null;
}) {
  const lineNo = input.line_no && Number.isFinite(input.line_no) ? Math.max(1, Math.trunc(input.line_no)) : await nextLineNoForProject(input.project_id);
  const payload = {
    id: createUuid(),
    project_id: input.project_id,
    line_no: lineNo,
    drawing_no: input.drawing_no ?? null,
    description: input.description ?? null,
    test_medium: input.test_medium ?? null,
    working_pressure: input.working_pressure ?? null,
    test_pressure: input.test_pressure ?? null,
    hold_time: input.hold_time ?? null,
    result: input.result ?? null,
  };
  const { error } = await supabase.from("project_pressure_test_rows").insert(payload);
  if (error) throw error;
  return payload.id;
}

export async function createProjectPressureTestRows(input: { project_id: string; count: number }) {
  const count = Math.max(1, Math.min(200, Math.trunc(Number(input.count) || 0)));
  if (!count) throw new Error("Ugyldig antall.");

  const startLineNo = await nextLineNoForProject(input.project_id);
  const payload = Array.from({ length: count }, (_, idx) => ({
    id: createUuid(),
    project_id: input.project_id,
    line_no: startLineNo + idx,
  }));
  const { error } = await supabase.from("project_pressure_test_rows").insert(payload);
  if (error) throw error;
  return {
    count,
    firstLineNo: startLineNo,
    lastLineNo: startLineNo + count - 1,
  };
}

export async function updateProjectPressureTestRow(
  id: string,
  patch: Partial<
    Pick<ProjectPressureTestItemRow, "line_no" | "drawing_no" | "description" | "test_medium" | "working_pressure" | "test_pressure" | "hold_time" | "result">
  >
) {
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("project_pressure_test_rows").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteProjectPressureTestRow(id: string) {
  const { error } = await supabase.from("project_pressure_test_rows").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertPressureGaugeCertificate(projectId: string, file: File) {
  const current = await fetchProjectPressureTestMeta(projectId);
  if (current?.gauge_cert_file_id) {
    const fileId = current.gauge_cert_file_id;
    const { bucket, path, sha256 } = await uploadFileToIdPath("project_pressure_gauge", fileId, file, {
      allowExistingFileId: fileId,
    });
    const { error } = await supabase
      .from("files")
      .update({
        bucket,
        path,
        label: file.name,
        mime_type: file.type || "application/pdf",
        size_bytes: file.size,
        sha256,
      })
      .eq("id", fileId);
    if (error) throw error;
    return await fetchProjectPressureTestMeta(projectId);
  }

  const fileId = createUuid();
  try {
    const { bucket, path, sha256 } = await uploadFileToIdPath("project_pressure_gauge", fileId, file);
    await createFileRecord({
      id: fileId,
      bucket,
      path,
      type: "project_pressure_gauge",
      label: file.name,
      mime_type: file.type || "application/pdf",
      size_bytes: file.size,
      sha256,
    });
    const meta = await saveProjectPressureTestMeta(projectId, { gauge_cert_file_id: fileId });
    await createFileLink(fileId, "project_pressure_test", meta.id);
    return meta;
  } catch (error) {
    try {
      await deleteFileRecord(fileId);
    } catch {}
    throw error;
  }
}

export async function removePressureGaugeCertificate(projectId: string) {
  const current = await fetchProjectPressureTestMeta(projectId);
  const fileId = String(current?.gauge_cert_file_id ?? "").trim();
  if (!fileId) return;
  await saveProjectPressureTestMeta(projectId, { gauge_cert_file_id: null });
  await deleteFileRecord(fileId);
}

export async function openPressureGaugeCertificate(ref: string) {
  const url = await createSignedUrlForFileRef(ref, { expiresSeconds: 120 });
  window.open(url, "_blank", "noopener,noreferrer");
}

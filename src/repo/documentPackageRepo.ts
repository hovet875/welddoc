import type {
  DocumentPackageDocumentKey,
} from "@/documents/package/documentPackageCatalog";
import type {
  DocumentPackageWorkerContract,
  DocumentPackageWorkerProgressStepKey,
} from "@/documents/package/documentPackageJobContract";
import { supabase } from "../services/supabaseClient";

export type DocumentPackageJobStatus = "queued" | "running" | "completed" | "failed";

export type DocumentPackageJobArtifact = {
  id: string;
  label: string | null;
  mime_type: string | null;
  size_bytes: number | null;
} | null;

export type DocumentPackageJobOptions = DocumentPackageWorkerContract | Record<string, unknown>;

export type DocumentPackageJobRow = {
  id: string;
  project_id: string;
  status: DocumentPackageJobStatus;
  requested_documents: DocumentPackageDocumentKey[];
  options: DocumentPackageJobOptions;
  artifact_file_id: string | null;
  main_pdf_file_id: string | null;
  source_zip_file_id: string | null;
  error_message: string | null;
  progress_percent: number;
  progress_step: DocumentPackageWorkerProgressStepKey | null;
  progress_message: string | null;
  progress_details: Record<string, unknown>;
  worker_ref: string | null;
  heartbeat_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  artifact: DocumentPackageJobArtifact;
  main_pdf_artifact: DocumentPackageJobArtifact;
  source_zip_artifact: DocumentPackageJobArtifact;
};

const DOCUMENT_PACKAGE_JOB_SELECT = `
  id,
  project_id,
  status,
  requested_documents,
  options,
  artifact_file_id,
  main_pdf_file_id,
  source_zip_file_id,
  error_message,
  progress_percent,
  progress_step,
  progress_message,
  progress_details,
  worker_ref,
  heartbeat_at,
  created_by,
  created_at,
  updated_at,
  started_at,
  finished_at,
  artifact:artifact_file_id (
    id,
    label,
    mime_type,
    size_bytes
  ),
  main_pdf_artifact:main_pdf_file_id (
    id,
    label,
    mime_type,
    size_bytes
  ),
  source_zip_artifact:source_zip_file_id (
    id,
    label,
    mime_type,
    size_bytes
  )
`;

function uniqueRequestedDocuments(requestedDocuments: DocumentPackageDocumentKey[]) {
  return Array.from(new Set(requestedDocuments.map((value) => String(value).trim()).filter(Boolean))) as DocumentPackageDocumentKey[];
}

function uniqueArtifactFileIds(job: Pick<DocumentPackageJobRow, "artifact_file_id" | "main_pdf_file_id" | "source_zip_file_id">) {
  return Array.from(
    new Set([job.artifact_file_id, job.main_pdf_file_id, job.source_zip_file_id].filter(Boolean))
  ) as string[];
}

export function canDeleteDocumentPackageJob(job: Pick<DocumentPackageJobRow, "status">) {
  return job.status !== "running";
}

async function deleteDocumentPackageArtifactFile(fileId: string) {
  const { data: meta, error: metaError } = await supabase
    .from("files")
    .select("bucket, path")
    .eq("id", fileId)
    .maybeSingle();

  if (metaError) throw metaError;
  if (!meta) return;

  const { error: storageError } = await supabase.storage.from(meta.bucket).remove([meta.path]);
  if (storageError) {
    throw new Error("Kunne ikke slette package-artefakt fra lagring.");
  }

  const { error: deleteError } = await supabase.from("files").delete().eq("id", fileId);
  if (deleteError) throw deleteError;
}

export async function listDocumentPackageJobs(projectId: string, limit = 10) {
  const { data, error } = await supabase
    .from("document_package_jobs")
    .select(DOCUMENT_PACKAGE_JOB_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as DocumentPackageJobRow[];
}

export async function hasQueuedDocumentPackageJob(projectId: string) {
  const { data, error } = await supabase
    .from("document_package_jobs")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "queued")
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function hasActiveDocumentPackageJob(projectId: string) {
  const { data, error } = await supabase
    .from("document_package_jobs")
    .select("id")
    .eq("project_id", projectId)
    .in("status", ["queued", "running"])
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function createDocumentPackageJob(input: {
  projectId: string;
  requestedDocuments: DocumentPackageDocumentKey[];
  options?: DocumentPackageJobOptions;
}) {
  const requestedDocuments = uniqueRequestedDocuments(input.requestedDocuments);
  if (requestedDocuments.length === 0) {
    throw new Error("Velg minst ett dokumentspor for a opprette package-jobb.");
  }

  const activeJobExists = await hasActiveDocumentPackageJob(input.projectId);
  if (activeJobExists) {
    throw new Error("Det finnes allerede en aktiv package-jobb for prosjektet.");
  }

  const { data, error } = await supabase
    .from("document_package_jobs")
    .insert({
      project_id: input.projectId,
      status: "queued",
      requested_documents: requestedDocuments,
      options: input.options ?? {},
    })
    .select(DOCUMENT_PACKAGE_JOB_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as DocumentPackageJobRow;
}

export async function deleteDocumentPackageJob(jobId: string) {
  const { data: job, error: jobError } = await supabase
    .from("document_package_jobs")
    .select("id, status, artifact_file_id, main_pdf_file_id, source_zip_file_id")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job) return;

  if (!canDeleteDocumentPackageJob(job as Pick<DocumentPackageJobRow, "status">)) {
    throw new Error("Package-jobb som kjører kan ikke slettes ennå.");
  }

  for (const fileId of uniqueArtifactFileIds(job as Pick<DocumentPackageJobRow, "artifact_file_id" | "main_pdf_file_id" | "source_zip_file_id">)) {
    await deleteDocumentPackageArtifactFile(fileId);
  }

  const { error: deleteJobError } = await supabase.from("document_package_jobs").delete().eq("id", jobId);
  if (deleteJobError) throw deleteJobError;
}

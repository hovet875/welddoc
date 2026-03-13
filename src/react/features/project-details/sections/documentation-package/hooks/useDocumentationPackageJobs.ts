import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentPackageDocumentKey } from "@/documents/package/documentPackageCatalog";
import type { DocumentPackageJobOptions } from "@/repo/documentPackageRepo";
import { supabase } from "@/services/supabaseClient";
import {
  createDocumentPackageJob,
  deleteDocumentPackageJob,
  listDocumentPackageJobs,
  type DocumentPackageJobRow,
} from "@/repo/documentPackageRepo";

type DocumentationPackageJobsState = {
  loading: boolean;
  creating: boolean;
  deletingJobId: string | null;
  error: string | null;
  jobs: DocumentPackageJobRow[];
  realtimeConnected: boolean;
};

const INITIAL_STATE: DocumentationPackageJobsState = {
  loading: true,
  creating: false,
  deletingJobId: null,
  realtimeConnected: false,
  error: null,
  jobs: [],
};

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function useDocumentationPackageJobs(projectId: string) {
  const [state, setState] = useState<DocumentationPackageJobsState>(INITIAL_STATE);
  const requestRef = useRef(0);
  const realtimeReloadTimeoutRef = useRef<number | null>(null);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const requestId = ++requestRef.current;
    setState((prev) => ({
      ...prev,
      loading: silent ? prev.loading : true,
      error: null,
    }));

    try {
      const jobs = await listDocumentPackageJobs(projectId);
      if (requestId !== requestRef.current) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        jobs,
      }));
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: readErrorMessage(error, "Kunne ikke laste package-jobber."),
        jobs: silent ? prev.jobs : [],
      }));
    }
  }, [projectId]);

  const scheduleSilentReload = useCallback(
    (delayMs = 150) => {
      if (typeof window === "undefined") {
        void reload({ silent: true });
        return;
      }

      if (realtimeReloadTimeoutRef.current !== null) {
        window.clearTimeout(realtimeReloadTimeoutRef.current);
      }

      realtimeReloadTimeoutRef.current = window.setTimeout(() => {
        realtimeReloadTimeoutRef.current = null;
        void reload({ silent: true });
      }, delayMs);
    },
    [reload]
  );

  useEffect(() => {
    void reload();

    return () => {
      requestRef.current += 1;
      if (typeof window !== "undefined" && realtimeReloadTimeoutRef.current !== null) {
        window.clearTimeout(realtimeReloadTimeoutRef.current);
      }
    };
  }, [reload]);

  useEffect(() => {
    setState((prev) => ({ ...prev, realtimeConnected: false }));

    const channel = supabase
      .channel(`document-package-jobs:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "document_package_jobs",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          scheduleSilentReload();
        }
      )
      .subscribe((status) => {
        setState((prev) => ({
          ...prev,
          realtimeConnected: status === "SUBSCRIBED",
        }));

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          scheduleSilentReload(0);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, scheduleSilentReload]);

  const hasActiveJob = useMemo(
    () => state.jobs.some((job) => job.status === "queued" || job.status === "running"),
    [state.jobs]
  );

  useEffect(() => {
    if (typeof window === "undefined" || state.realtimeConnected || !hasActiveJob) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void reload({ silent: true });
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasActiveJob, reload, state.realtimeConnected]);

  const createJob = useCallback(
    async (requestedDocuments: DocumentPackageDocumentKey[], options?: DocumentPackageJobOptions) => {
      setState((prev) => ({ ...prev, creating: true, error: null }));
      try {
        const job = await createDocumentPackageJob({ projectId, requestedDocuments, options });
        await reload({ silent: true });
        setState((prev) => ({ ...prev, creating: false }));
        return job;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          creating: false,
          error: readErrorMessage(error, "Kunne ikke opprette package-jobb."),
        }));
        throw error;
      }
    },
    [projectId, reload]
  );

  const deleteJob = useCallback(
    async (jobId: string) => {
      setState((prev) => ({ ...prev, deletingJobId: jobId, error: null }));
      try {
        await deleteDocumentPackageJob(jobId);
        await reload({ silent: true });
        setState((prev) => ({ ...prev, deletingJobId: null }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          deletingJobId: null,
          error: readErrorMessage(error, "Kunne ikke slette package-jobb."),
        }));
        throw error;
      }
    },
    [reload]
  );

  return useMemo(
    () => ({
      ...state,
      reload,
      createJob,
      deleteJob,
    }),
    [createJob, deleteJob, reload, state]
  );
}

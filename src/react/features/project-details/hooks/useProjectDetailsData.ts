import { useEffect, useState } from "react";
import { fetchProjectById, type ProjectRow } from "@/repo/projectRepo";

function readErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return "Kunne ikke laste prosjekt.";
}

export function useProjectDetailsData(projectId: string | undefined) {
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      setProject(null);
      setError("Mangler prosjekt-ID.");
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const next = await fetchProjectById(projectId);
        if (cancelled) return;
        setProject(next);
      } catch (err) {
        if (cancelled) return;
        setProject(null);
        setError(readErrorMessage(err));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return {
    project,
    loading,
    error,
  };
}

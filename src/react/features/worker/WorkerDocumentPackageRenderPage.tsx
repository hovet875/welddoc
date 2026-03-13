import { useEffect, useMemo } from "react";
import { Center, Loader, Stack, Text } from "@mantine/core";
import type { DocumentPackageSnapshot } from "@/documents/package/documentPackageSnapshot";
import { DocumentPackageMainPdfPreview } from "@/react/features/project-details/sections/documentation-package/preview/DocumentPackageMainPdfPreview";
import { waitForImages, waitForNextPaint } from "@/react/ui/documentWindowSupport";
import {
  DOCUMENT_PACKAGE_RENDER_STORAGE_KEY,
  clearDocumentPackageRenderStatus,
  setDocumentPackageRenderStatus,
} from "./documentPackageRenderRuntime";

function readSnapshot() {
  const rawValue =
    window.localStorage.getItem(DOCUMENT_PACKAGE_RENDER_STORAGE_KEY) ??
    window.sessionStorage.getItem(DOCUMENT_PACKAGE_RENDER_STORAGE_KEY);
  if (!rawValue) {
    throw new Error("Fant ikke render-payload i browser storage.");
  }

  const parsed = JSON.parse(rawValue) as DocumentPackageSnapshot;
  if (!parsed?.main_pdf?.data) {
    throw new Error("Render-payload mangler main_pdf.data.");
  }

  return parsed;
}

export function WorkerDocumentPackageRenderPage() {
  const result = useMemo(() => {
    try {
      return {
        snapshot: readSnapshot(),
        error: null,
      };
    } catch (error) {
      return {
        snapshot: null,
        error: error instanceof Error ? error.message : "Kunne ikke lese render-payload.",
      };
    }
  }, []);

  useEffect(() => {
    document.body.classList.add("document-window-body");
    setDocumentPackageRenderStatus("loading");

    return () => {
      document.body.classList.remove("document-window-body");
      clearDocumentPackageRenderStatus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (result.error || !result.snapshot?.main_pdf.data) {
      setDocumentPackageRenderStatus("error", result.error ?? "Ugyldig render-payload.");
      return;
    }

    document.title = `Package render - ${result.snapshot.main_pdf.data.projectLabel}`;

    void (async () => {
      try {
        await waitForImages(document, { timeoutMs: 15000 });
        await waitForNextPaint(window);
        if (cancelled) return;
        setDocumentPackageRenderStatus("true");
      } catch (error) {
        if (cancelled) return;
        setDocumentPackageRenderStatus(
          "error",
          error instanceof Error ? error.message : "Render ble ikke klar i tide."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [result.error, result.snapshot]);

  if (result.error || !result.snapshot?.main_pdf.data) {
    return (
      <div id="document-window-root" className="document-window-root">
        <Center mih="100vh">
          <Stack gap="xs" align="center">
            <Text fw={700}>Renderfeil</Text>
            <Text size="sm" c="dimmed">
              {result.error ?? "Ugyldig render-payload."}
            </Text>
          </Stack>
        </Center>
      </div>
    );
  }

  return (
    <div id="document-window-root" className="document-window-root">
      <DocumentPackageMainPdfPreview data={result.snapshot.main_pdf.data} />
      <div aria-hidden="true" style={{ display: "none" }}>
        <Loader size="xs" />
      </div>
    </div>
  );
}

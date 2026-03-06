import { useCallback, useEffect, useMemo, useState } from "react";
import {
  countNewFileInboxByTarget,
  deleteFileInboxEntryAndMaybeFile,
  fetchNewFileInboxByTarget,
  markFileInboxProcessed,
} from "@/repo/fileInboxRepo";
import {
  createNdtReportWithExistingFile,
  createNdtReportWithFile,
  type NdtMethodRow,
  type NdtReportRow,
} from "@/repo/ndtReportRepo";
import type { NdtInspectorRow } from "@/repo/ndtSupplierRepo";
import { toast } from "@react/ui/notify";
import {
  buildNdtUploadPayload,
  createLocalUploadEntry,
  findPotentialDuplicateReport,
  isPdfFile,
  mergeInboxEntries,
  type NdtUploadEntryDraft,
  type NdtUploadPayload,
} from "../lib/ndtUpload";

type UseNdtUploadQueueArgs = {
  opened: boolean;
  reports: NdtReportRow[];
  methods: NdtMethodRow[];
  ndtInspectors: NdtInspectorRow[];
  onOpenPdf: (ref: string, title: string) => void;
  onUploaded: () => Promise<void>;
  onInboxCountChange?: (count: number) => void;
};

type UseNdtUploadQueueResult = {
  entries: NdtUploadEntryDraft[];
  loadingInbox: boolean;
  uploadingAll: boolean;
  uploadingIds: Set<string>;
  error: string | null;
  duplicateCount: number;
  refreshInbox: () => Promise<void>;
  updateEntry: (entryId: string, updater: (entry: NdtUploadEntryDraft) => NdtUploadEntryDraft) => void;
  handleDrop: (files: File[]) => void;
  handlePreviewEntry: (entry: NdtUploadEntryDraft) => void;
  handleRemoveEntry: (entry: NdtUploadEntryDraft) => Promise<void>;
  handleUploadEntry: (entry: NdtUploadEntryDraft) => Promise<void>;
  handleUploadAll: () => Promise<void>;
  clearLocalEntries: () => void;
};

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function entryName(entry: NdtUploadEntryDraft) {
  return entry.source.kind === "local" ? entry.source.file.name : entry.source.fileName;
}

export function useNdtUploadQueue({
  opened,
  reports,
  methods,
  ndtInspectors,
  onOpenPdf,
  onUploaded,
  onInboxCountChange,
}: UseNdtUploadQueueArgs): UseNdtUploadQueueResult {
  const [entries, setEntries] = useState<NdtUploadEntryDraft[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [uploadingAll, setUploadingAll] = useState(false);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const setEntriesWithUpdater = useCallback((updater: (rows: NdtUploadEntryDraft[]) => NdtUploadEntryDraft[]) => {
    setEntries((prev) => updater(prev));
  }, []);

  const duplicateCount = useMemo(
    () => entries.reduce((sum, entry) => sum + (findPotentialDuplicateReport(reports, entry.sourceName) ? 1 : 0), 0),
    [entries, reports]
  );

  const markUploading = useCallback((entryId: string, uploading: boolean) => {
    setUploadingIds((prev) => {
      const next = new Set(prev);
      if (uploading) {
        next.add(entryId);
      } else {
        next.delete(entryId);
      }
      return next;
    });
  }, []);

  const refreshInbox = useCallback(async () => {
    setLoadingInbox(true);
    setError(null);

    try {
      const [rows, count] = await Promise.all([
        fetchNewFileInboxByTarget("ndt_report"),
        countNewFileInboxByTarget("ndt_report"),
      ]);
      setEntriesWithUpdater((prev) => mergeInboxEntries(prev, rows));
      onInboxCountChange?.(count);
    } catch (err) {
      console.error(err);
      setError(readErrorMessage(err, "Kunne ikke hente filer fra NAS-innboks."));
    } finally {
      setLoadingInbox(false);
    }
  }, [onInboxCountChange, setEntriesWithUpdater]);

  useEffect(() => {
    if (!opened) return;
    void refreshInbox();
  }, [opened, refreshInbox]);

  const updateEntry = useCallback(
    (entryId: string, updater: (entry: NdtUploadEntryDraft) => NdtUploadEntryDraft) => {
      setEntriesWithUpdater((prev) => prev.map((entry) => (entry.id === entryId ? updater(entry) : entry)));
    },
    [setEntriesWithUpdater]
  );

  const uploadPayload = useCallback(async (payload: NdtUploadPayload) => {
    if (payload.file) {
      await createNdtReportWithFile({
        source_name: payload.source_name,
        method_id: payload.method_id,
        ndt_supplier_id: payload.ndt_supplier_id,
        ndt_inspector_id: payload.ndt_inspector_id,
        weld_count: payload.weld_count,
        defect_count: payload.defect_count,
        title: payload.title,
        customer: payload.customer,
        report_date: payload.report_date,
        welder_stats: payload.welder_stats,
        file: payload.file,
      });
    } else {
      if (!payload.file_id) throw new Error("Manglende filreferanse for innboksfil.");
      await createNdtReportWithExistingFile({
        source_name: payload.source_name,
        method_id: payload.method_id,
        ndt_supplier_id: payload.ndt_supplier_id,
        ndt_inspector_id: payload.ndt_inspector_id,
        weld_count: payload.weld_count,
        defect_count: payload.defect_count,
        title: payload.title,
        customer: payload.customer,
        report_date: payload.report_date,
        welder_stats: payload.welder_stats,
        file_id: payload.file_id,
      });
    }

    if (payload.inbox_id) {
      await markFileInboxProcessed(payload.inbox_id);
    }
  }, []);

  const handleDrop = useCallback(
    (files: File[]) => {
      setEntriesWithUpdater((prev) => {
        const existingKeys = new Set(
          prev.map((entry) =>
            entry.source.kind === "local"
              ? `local:${entry.source.file.name}:${entry.source.file.size}`
              : `inbox:${entry.source.fileId}`
          )
        );

        const next = [...prev];
        let rejectedCount = 0;

        for (const file of files) {
          if (!isPdfFile(file)) {
            rejectedCount += 1;
            continue;
          }

          const key = `local:${file.name}:${file.size}`;
          if (existingKeys.has(key)) continue;

          existingKeys.add(key);
          next.push(createLocalUploadEntry(file));
        }

        if (rejectedCount > 0) {
          toast(`${rejectedCount} fil(er) ble hoppet over fordi de ikke er PDF.`);
        }

        return next;
      });
    },
    [setEntriesWithUpdater]
  );

  const handlePreviewEntry = useCallback(
    (entry: NdtUploadEntryDraft) => {
      if (entry.source.kind === "inbox") {
        onOpenPdf(entry.source.fileId, entryName(entry));
        return;
      }

      const objectUrl = URL.createObjectURL(entry.source.file);
      onOpenPdf(objectUrl, entryName(entry));
    },
    [onOpenPdf]
  );

  const handleRemoveEntry = useCallback(
    async (entry: NdtUploadEntryDraft) => {
      if (entry.source.kind === "inbox") {
        try {
          await deleteFileInboxEntryAndMaybeFile(entry.source.inboxId);
          toast("Fil fjernet fra innboks.");
          setEntriesWithUpdater((prev) => prev.filter((row) => row.id !== entry.id));
          await refreshInbox();
        } catch (err) {
          console.error(err);
          toast(readErrorMessage(err, "Kunne ikke slette innboksfil."));
        }
        return;
      }

      setEntriesWithUpdater((prev) => prev.filter((row) => row.id !== entry.id));
    },
    [refreshInbox, setEntriesWithUpdater]
  );

  const handleUploadEntry = useCallback(
    async (entry: NdtUploadEntryDraft) => {
      if (uploadingIds.has(entry.id) || uploadingAll) return;

      markUploading(entry.id, true);
      setError(null);

      try {
        const payload = buildNdtUploadPayload(entry, methods, ndtInspectors);
        await uploadPayload(payload);
        setEntriesWithUpdater((prev) => prev.filter((row) => row.id !== entry.id));
        await Promise.all([onUploaded(), refreshInbox()]);
        toast(`${entryName(entry)} lastet opp.`);
      } catch (err) {
        console.error(err);
        const message = readErrorMessage(err, `Kunne ikke laste opp ${entryName(entry)}.`);
        setError(message);
        toast(message);
      } finally {
        markUploading(entry.id, false);
      }
    },
    [
      markUploading,
      methods,
      ndtInspectors,
      onUploaded,
      refreshInbox,
      setEntriesWithUpdater,
      uploadPayload,
      uploadingAll,
      uploadingIds,
    ]
  );

  const handleUploadAll = useCallback(async () => {
    if (entries.length === 0 || uploadingAll) return;

    const queue = [...entries];
    let uploadedCount = 0;
    setUploadingAll(true);
    setError(null);

    try {
      for (const entry of queue) {
        markUploading(entry.id, true);
        const payload = buildNdtUploadPayload(entry, methods, ndtInspectors);
        await uploadPayload(payload);
        setEntriesWithUpdater((prev) => prev.filter((row) => row.id !== entry.id));
        uploadedCount += 1;
        markUploading(entry.id, false);
      }

      await Promise.all([onUploaded(), refreshInbox()]);
      toast(`Lastet opp ${uploadedCount} fil(er).`);
    } catch (err) {
      console.error(err);
      const message = readErrorMessage(err, "Kunne ikke fullføre opplasting.");
      setError(message);
      toast(message);
    } finally {
      for (const entry of queue) {
        markUploading(entry.id, false);
      }
      setUploadingAll(false);
    }
  }, [
    entries,
    markUploading,
    methods,
    ndtInspectors,
    onUploaded,
    refreshInbox,
    setEntriesWithUpdater,
    uploadPayload,
    uploadingAll,
  ]);

  const clearLocalEntries = useCallback(() => {
    setEntriesWithUpdater((prev) => prev.filter((entry) => entry.source.kind === "inbox"));
  }, [setEntriesWithUpdater]);

  return {
    entries,
    loadingInbox,
    uploadingAll,
    uploadingIds,
    error,
    duplicateCount,
    refreshInbox,
    updateEntry,
    handleDrop,
    handlePreviewEntry,
    handleRemoveEntry,
    handleUploadEntry,
    handleUploadAll,
    clearLocalEntries,
  };
}

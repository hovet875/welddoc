import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { MaterialRow } from "@/repo/materialRepo";
import {
  createWpqrWithOptionalPdf,
  createWpsWithOptionalPdf,
  type WPQRRow,
  type WPSRow,
  updateWpqrWithPdf,
  updateWpsWithPdf,
} from "@/repo/wpsRepo";
import { notifySuccess, notifyError } from "@react/ui/notify";
import { normalizeDocNo, validatePdfFile } from "@/utils/format";
import { isSameProcess, materialLabelFromOption } from "@react/features/wps/lib/wpsHelpers";
import { materialDisplay, resolveProcessKey } from "@react/features/wps/lib/wpsView";
import type { EditorKind, WpsEditorState } from "@react/features/wps/wps.types";

type UseWpsEditorParams = {
  processDictionary: Map<string, string>;
  materials: MaterialRow[];
  wpsRows: WPSRow[];
  wpqrRows: WPQRRow[];
  reload: () => Promise<void>;
};

type UseWpsEditorResult = {
  editor: WpsEditorState | null;
  savingEditor: boolean;
  localPdfPreviewUrl: string | null;
  openCreateModal: (kind: EditorKind) => void;
  openWpqrEditModal: (row: WPQRRow) => void;
  openWpsEditModal: (row: WPSRow) => void;
  closeEditor: () => void;
  setEditorField: <K extends keyof WpsEditorState>(field: K, value: WpsEditorState[K]) => void;
  handleEditorProcessChange: (value: string) => void;
  handlePdfFileChange: (nextFile: File | null) => void;
  submitEditor: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function currentDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(value: string | null | undefined, fallback: string | null | undefined) {
  const primary = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(primary)) return primary;
  if (/^\d{4}-\d{2}-\d{2}T/.test(primary)) return primary.slice(0, 10);

  const secondary = String(fallback ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(secondary)) return secondary;
  if (/^\d{4}-\d{2}-\d{2}T/.test(secondary)) return secondary.slice(0, 10);

  return currentDateInputValue();
}

function createEmptyEditor(kind: EditorKind): WpsEditorState {
  return {
    opened: true,
    kind,
    mode: "create",
    rowId: "",
    docNo: "",
    docDate: currentDateInputValue(),
    standardId: "",
    process: "",
    materialId: "",
    fuge: "",
    tykkelse: "",
    wpqrId: "",
    existingFileId: null,
    removeExistingPdf: false,
    newPdfFile: null,
  };
}

export function useWpsEditor({
  processDictionary,
  materials,
  wpsRows,
  wpqrRows,
  reload,
}: UseWpsEditorParams): UseWpsEditorResult {
  const [editor, setEditor] = useState<WpsEditorState | null>(null);
  const [savingEditor, setSavingEditor] = useState(false);
  const [localPdfPreviewUrl, setLocalPdfPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!editor?.newPdfFile) {
      setLocalPdfPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      return;
    }

    const url = URL.createObjectURL(editor.newPdfFile);
    setLocalPdfPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [editor?.newPdfFile]);

  const openCreateModal = useCallback((kind: EditorKind) => {
    setEditor(createEmptyEditor(kind));
  }, []);

  const openWpqrEditModal = useCallback(
    (row: WPQRRow) => {
      setEditor({
        opened: true,
        kind: "wpqr",
        mode: "edit",
        rowId: row.id,
        docNo: row.doc_no ?? "",
        docDate: toDateInputValue(row.doc_date, row.created_at),
        standardId: row.standard_id ?? "",
        process: resolveProcessKey(row.process, processDictionary) || "",
        materialId: row.material_id ?? "",
        fuge: row.fuge ?? "",
        tykkelse: row.tykkelse ?? "",
        wpqrId: "",
        existingFileId: row.file_id ?? null,
        removeExistingPdf: false,
        newPdfFile: null,
      });
    },
    [processDictionary]
  );

  const openWpsEditModal = useCallback(
    (row: WPSRow) => {
      setEditor({
        opened: true,
        kind: "wps",
        mode: "edit",
        rowId: row.id,
        docNo: row.doc_no ?? "",
        docDate: toDateInputValue(row.doc_date, row.created_at),
        standardId: row.standard_id ?? "",
        process: resolveProcessKey(row.process, processDictionary) || "",
        materialId: row.material_id ?? "",
        fuge: row.fuge ?? "",
        tykkelse: row.tykkelse ?? "",
        wpqrId: row.wpqr_id ?? "",
        existingFileId: row.file_id ?? null,
        removeExistingPdf: false,
        newPdfFile: null,
      });
    },
    [processDictionary]
  );

  const closeEditor = useCallback(() => {
    if (savingEditor) return;
    setEditor(null);
  }, [savingEditor]);

  const setEditorField = useCallback(<K extends keyof WpsEditorState>(field: K, value: WpsEditorState[K]) => {
    setEditor((current) => {
      if (!current) return current;
      return { ...current, [field]: value };
    });
  }, []);

  const handleEditorProcessChange = useCallback(
    (value: string) => {
      setEditor((current) => {
        if (!current) return current;
        const next = { ...current, process: value };
        if (next.kind !== "wps") return next;
        if (!next.wpqrId) return next;
        const hasSelected = wpqrRows.some(
          (row) => row.id === next.wpqrId && (!value || isSameProcess(row.process, value, processDictionary))
        );
        if (hasSelected) return next;
        return { ...next, wpqrId: "" };
      });
    },
    [processDictionary, wpqrRows]
  );

  const handlePdfFileChange = useCallback(
    (nextFile: File | null) => {
      if (!nextFile) {
        setEditorField("newPdfFile", null);
        return;
      }
      if (!String(nextFile.type || "").toLowerCase().includes("pdf") && !nextFile.name.toLowerCase().endsWith(".pdf")) {
        notifyError("Kun PDF-filer er tillatt.");
        return;
      }
      setEditor((current) => {
        if (!current) return current;
        return {
          ...current,
          newPdfFile: nextFile,
          removeExistingPdf: false,
        };
      });
    },
    [setEditorField]
  );

  const submitEditor = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editor) return;

      const docNo = normalizeDocNo(editor.docNo);
      const docDate = String(editor.docDate ?? "").trim();
      const standardId = String(editor.standardId ?? "").trim();
      const process = String(editor.process ?? "").trim();
      const materialId = String(editor.materialId ?? "").trim();
      const fuge = String(editor.fuge ?? "").trim();
      const tykkelse = String(editor.tykkelse ?? "").trim();

      if (!docNo || !docDate || !standardId || !process || !materialId || !fuge || !tykkelse) {
        notifyError("Fyll ut alle obligatoriske felter.");
        return;
      }

      const material = materials.find((row) => row.id === materialId);
      const currentEditRow =
        editor.mode === "edit"
          ? editor.kind === "wps"
            ? wpsRows.find((row) => row.id === editor.rowId) ?? null
            : wpqrRows.find((row) => row.id === editor.rowId) ?? null
          : null;
      const currentEditMaterialLabel = currentEditRow ? materialDisplay(currentEditRow) : "";
      const materialLabel = material ? materialLabelFromOption(material) : currentEditMaterialLabel;

      if (!materialLabel) {
        notifyError("Velg materiale fra listen.");
        return;
      }
      const nextPdfFile = editor.newPdfFile;
      if (nextPdfFile) {
        const pdfError = validatePdfFile(nextPdfFile, 25);
        if (pdfError) {
          notifyError(pdfError);
          return;
        }
      }

      const removePdf = editor.removeExistingPdf && !nextPdfFile;

      try {
        setSavingEditor(true);

        if (editor.kind === "wpqr") {
          const payload = {
            doc_no: docNo,
            doc_date: docDate,
            standard_id: standardId,
            process,
            material_id: materialId,
            materiale: materialLabel,
            fuge,
            tykkelse,
          };

          if (editor.mode === "create") {
            await createWpqrWithOptionalPdf(payload, nextPdfFile);
            notifySuccess("WPQR opprettet.");
          } else {
            await updateWpqrWithPdf(editor.rowId, payload, {
              pdfFile: nextPdfFile,
              removePdf,
            });
            notifySuccess("WPQR oppdatert.");
          }
        } else {
          const payload = {
            doc_no: docNo,
            doc_date: docDate,
            standard_id: standardId,
            process,
            material_id: materialId,
            materiale: materialLabel,
            fuge,
            tykkelse,
            wpqr_id: editor.wpqrId || null,
          };

          if (editor.mode === "create") {
            await createWpsWithOptionalPdf(payload, nextPdfFile);
            notifySuccess("WPS opprettet.");
          } else {
            await updateWpsWithPdf(editor.rowId, payload, {
              pdfFile: nextPdfFile,
              removePdf,
            });
            notifySuccess("WPS oppdatert.");
          }
        }

        setEditor(null);
        await reload();
      } catch (err) {
        console.error(err);
        notifyError(readErrorMessage(err, "Kunne ikke lagre."));
      } finally {
        setSavingEditor(false);
      }
    },
    [editor, materials, reload, wpqrRows, wpsRows]
  );

  return {
    editor,
    savingEditor,
    localPdfPreviewUrl,
    openCreateModal,
    openWpqrEditModal,
    openWpsEditModal,
    closeEditor,
    setEditorField,
    handleEditorProcessChange,
    handlePdfFileChange,
    submitEditor,
  };
}

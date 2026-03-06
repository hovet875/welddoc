import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Box, Group, SimpleGrid, Stack } from "@mantine/core";
import { supabase } from "@/services/supabaseClient";
import { AppActionsMenu, createDeleteAction, createEditAction } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppButton } from "@react/ui/AppButton";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppModal } from "@react/ui/AppModal";
import { AppNativeSelect } from "@react/ui/AppNativeSelect";
import { AppRefreshIconButton } from "@react/ui/AppRefreshIconButton";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import {
  createMaterial,
  deleteMaterial,
  updateMaterial,
  type MaterialRow,
} from "@/repo/materialRepo";
import {
  createNdtMethod,
  deleteNdtMethod,
  updateNdtMethod,
  type NdtMethodRow,
} from "@/repo/ndtReportRepo";
import {
  createStandard,
  createStandardFmGroup,
  deleteStandard,
  deleteStandardFmGroup,
  fetchStandardFmGroups,
  updateStandard,
  updateStandardFmGroup,
  type StandardFmGroupRow,
  type StandardRow,
} from "@/repo/standardRepo";
import {
  createWeldingProcess,
  deleteWeldingProcess,
  updateWeldingProcess,
  type WeldingProcessRow,
} from "@/repo/weldingProcessRepo";
import {
  createWeldJointType,
  deleteWeldJointType,
  updateWeldJointType,
  type WeldJointTypeRow,
} from "@/repo/weldJointTypeRepo";
import { toast } from "@react/ui/notify";
import { esc } from "@/utils/dom";
import { useAuth } from "../../../../auth/AuthProvider";
import { AppPageLayout } from "../../../../layout/AppPageLayout";
import { CompanySettingsHeader } from "../components/CompanySettingsHeader";
import { useWeldingData } from "./hooks/useWeldingData";
import { WeldingAdminListPanel } from "./components/WeldingAdminListPanel";
import { WeldingListItem } from "./components/WeldingListItem";

const STANDARD_TYPES = [
  "Sveisesertifisering",
  "Sveiseprosedyreprøving",
  "Sveiseprosedyrespesifikasjon",
  "Material/typestandard",
  "Utforelse",
  "Inspeksjon",
  "Annet",
] as const;

const PROCESS_CODE_PATTERN = /^\d{2,4}$/;

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function materialLabel(row: Pick<MaterialRow, "name" | "material_code" | "material_group">) {
  return `${row.name} (${row.material_code}) - ${row.material_group}`;
}

function standardLabelText(
  row: Pick<StandardRow, "label" | "revision"> | { label: string; revision: number | null }
) {
  return row.revision ? `${row.label} (${row.revision})` : row.label;
}

function processLabelText(row: Pick<WeldingProcessRow, "code" | "label">) {
  const code = String(row.code ?? "").trim();
  const label = String(row.label ?? "").trim();
  if (code && label) return `${code} - ${label}`;
  return code || label;
}

async function countReferences(table: string, column: string, value: string) {
  const result = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (result.error) throw result.error;
  return result.count ?? 0;
}

type FmGroupsModalState = {
  opened: boolean;
  standardId: string;
  standardLabel: string;
};

type FmGroupEditModalState = {
  opened: boolean;
  rowId: string;
  label: string;
};

type MaterialEditModalState = {
  opened: boolean;
  rowId: string;
  name: string;
  code: string;
  group: string;
};

type StandardEditModalState = {
  opened: boolean;
  rowId: string;
  label: string;
  description: string;
  type: string;
  revision: string;
};

type NdtMethodEditModalState = {
  opened: boolean;
  rowId: string;
  code: string;
  label: string;
  description: string;
  standardId: string;
};

type ProcessEditModalState = {
  opened: boolean;
  rowId: string;
  code: string;
  label: string;
};

type JointTypeEditModalState = {
  opened: boolean;
  rowId: string;
  label: string;
};

const FM_GROUPS_MODAL_INITIAL_STATE: FmGroupsModalState = {
  opened: false,
  standardId: "",
  standardLabel: "",
};

const FM_GROUP_EDIT_MODAL_INITIAL_STATE: FmGroupEditModalState = {
  opened: false,
  rowId: "",
  label: "",
};

const MATERIAL_EDIT_MODAL_INITIAL_STATE: MaterialEditModalState = {
  opened: false,
  rowId: "",
  name: "",
  code: "",
  group: "",
};

const STANDARD_EDIT_MODAL_INITIAL_STATE: StandardEditModalState = {
  opened: false,
  rowId: "",
  label: "",
  description: "",
  type: "",
  revision: "",
};

const NDT_METHOD_EDIT_MODAL_INITIAL_STATE: NdtMethodEditModalState = {
  opened: false,
  rowId: "",
  code: "",
  label: "",
  description: "",
  standardId: "",
};

const PROCESS_EDIT_MODAL_INITIAL_STATE: ProcessEditModalState = {
  opened: false,
  rowId: "",
  code: "",
  label: "",
};

const JOINT_TYPE_EDIT_MODAL_INITIAL_STATE: JointTypeEditModalState = {
  opened: false,
  rowId: "",
  label: "",
};

export function CompanySettingsWeldingPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;

  const {
    materials,
    standards,
    ndtMethods,
    processes,
    jointTypes,
    reloadAll,
    reloadMaterials,
    reloadStandards,
    reloadNdtMethods,
    reloadProcesses,
    reloadJointTypes,
  } = useWeldingData({ enabled: isAdmin });

  const [materialName, setMaterialName] = useState("");
  const [materialCode, setMaterialCode] = useState("");
  const [materialGroup, setMaterialGroup] = useState("");
  const [addingMaterial, setAddingMaterial] = useState(false);

  const [standardType, setStandardType] = useState("");
  const [standardLabel, setStandardLabel] = useState("");
  const [standardDescription, setStandardDescription] = useState("");
  const [standardRevision, setStandardRevision] = useState("");
  const [addingStandard, setAddingStandard] = useState(false);

  const [ndtCode, setNdtCode] = useState("");
  const [ndtLabel, setNdtLabel] = useState("");
  const [ndtDescription, setNdtDescription] = useState("");
  const [ndtStandardId, setNdtStandardId] = useState("");
  const [addingNdtMethod, setAddingNdtMethod] = useState(false);

  const [processCode, setProcessCode] = useState("");
  const [processLabel, setProcessLabel] = useState("");
  const [addingProcess, setAddingProcess] = useState(false);

  const [jointTypeLabel, setJointTypeLabel] = useState("");
  const [addingJointType, setAddingJointType] = useState(false);
  const [materialEditModal, setMaterialEditModal] = useState<MaterialEditModalState>(
    MATERIAL_EDIT_MODAL_INITIAL_STATE
  );
  const [materialEditSaving, setMaterialEditSaving] = useState(false);
  const [standardEditModal, setStandardEditModal] = useState<StandardEditModalState>(
    STANDARD_EDIT_MODAL_INITIAL_STATE
  );
  const [standardEditSaving, setStandardEditSaving] = useState(false);
  const [fmGroupsModal, setFmGroupsModal] = useState<FmGroupsModalState>(FM_GROUPS_MODAL_INITIAL_STATE);
  const [fmGroupsRows, setFmGroupsRows] = useState<StandardFmGroupRow[]>([]);
  const [fmGroupsLoading, setFmGroupsLoading] = useState(false);
  const [fmGroupsError, setFmGroupsError] = useState<string | null>(null);
  const [fmGroupInput, setFmGroupInput] = useState("");
  const [fmGroupSaving, setFmGroupSaving] = useState(false);
  const [fmGroupEditModal, setFmGroupEditModal] = useState<FmGroupEditModalState>(
    FM_GROUP_EDIT_MODAL_INITIAL_STATE
  );
  const [fmGroupEditSaving, setFmGroupEditSaving] = useState(false);
  const [ndtMethodEditModal, setNdtMethodEditModal] = useState<NdtMethodEditModalState>(
    NDT_METHOD_EDIT_MODAL_INITIAL_STATE
  );
  const [ndtMethodEditSaving, setNdtMethodEditSaving] = useState(false);
  const [processEditModal, setProcessEditModal] = useState<ProcessEditModalState>(
    PROCESS_EDIT_MODAL_INITIAL_STATE
  );
  const [processEditSaving, setProcessEditSaving] = useState(false);
  const [jointTypeEditModal, setJointTypeEditModal] = useState<JointTypeEditModalState>(
    JOINT_TYPE_EDIT_MODAL_INITIAL_STATE
  );
  const [jointTypeEditSaving, setJointTypeEditSaving] = useState(false);
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();

  const isRefreshing = useMemo(
    () =>
      materials.loading ||
      standards.loading ||
      ndtMethods.loading ||
      processes.loading ||
      jointTypes.loading,
    [jointTypes.loading, materials.loading, ndtMethods.loading, processes.loading, standards.loading]
  );

  const standardOptions = useMemo(
    () =>
      standards.rows.map((row) => ({
        id: row.id,
        label: standardLabelText(row),
      })),
    [standards.rows]
  );

  const revisionYearOptions = useMemo(
    () => Array.from({ length: 31 }, (_, i) => String(new Date().getFullYear() - i)),
    []
  );

  const standardTypeOptions = useMemo(() => {
    const base = STANDARD_TYPES.map((type) => ({ value: type, label: type }));
    if (!standardEditModal.type || STANDARD_TYPES.includes(standardEditModal.type as (typeof STANDARD_TYPES)[number])) {
      return [{ value: "", label: "Velg type..." }, ...base];
    }
    return [{ value: "", label: "Velg type..." }, ...base, { value: standardEditModal.type, label: standardEditModal.type }];
  }, [standardEditModal.type]);

  const standardRevisionOptions = useMemo(() => {
    const base = revisionYearOptions.map((year) => ({ value: year, label: year }));
    if (!standardEditModal.revision || revisionYearOptions.includes(standardEditModal.revision)) {
      return [{ value: "", label: "Ingen revisjon" }, ...base];
    }
    return [
      { value: "", label: "Ingen revisjon" },
      ...base,
      { value: standardEditModal.revision, label: standardEditModal.revision },
    ];
  }, [revisionYearOptions, standardEditModal.revision]);

  const ndtModalStandardOptions = useMemo(() => {
    const base = standardOptions.map((option) => ({
      value: option.id,
      label: option.label,
    }));
    if (!ndtMethodEditModal.standardId || standardOptions.some((option) => option.id === ndtMethodEditModal.standardId)) {
      return [{ value: "", label: "Standard (valgfritt)" }, ...base];
    }
    return [
      { value: "", label: "Standard (valgfritt)" },
      ...base,
      { value: ndtMethodEditModal.standardId, label: ndtMethodEditModal.standardId },
    ];
  }, [ndtMethodEditModal.standardId, standardOptions]);


  const closeFmGroupsModal = useCallback(() => {
    setFmGroupsModal(FM_GROUPS_MODAL_INITIAL_STATE);
    setFmGroupsRows([]);
    setFmGroupsError(null);
    setFmGroupsLoading(false);
    setFmGroupInput("");
    setFmGroupSaving(false);
    setFmGroupEditModal(FM_GROUP_EDIT_MODAL_INITIAL_STATE);
    setFmGroupEditSaving(false);
  }, []);

  const loadFmGroups = useCallback(async (standardId: string) => {
    setFmGroupsLoading(true);
    setFmGroupsError(null);

    try {
      const rows = await fetchStandardFmGroups(standardId);
      setFmGroupsRows(rows);
    } catch (err) {
      console.error(err);
      setFmGroupsRows([]);
      setFmGroupsError(readErrorMessage(err, "Kunne ikke hente FM-grupper."));
    } finally {
      setFmGroupsLoading(false);
    }
  }, []);

  const openFmGroupsModal = useCallback(
    (standard: StandardRow) => {
      setFmGroupsModal({
        opened: true,
        standardId: standard.id,
        standardLabel: standard.label,
      });
      setFmGroupsRows([]);
      setFmGroupsError(null);
      setFmGroupInput("");
      void loadFmGroups(standard.id);
    },
    [loadFmGroups]
  );

  const addFmGroup = useCallback(async () => {
    const label = fmGroupInput.trim();
    const standardId = fmGroupsModal.standardId;

    if (!standardId) return;
    if (!label) {
      toast("Skriv inn FM-gruppe.");
      return;
    }

    try {
      setFmGroupSaving(true);
      await createStandardFmGroup({ standard_id: standardId, label });
      setFmGroupInput("");
      await Promise.all([loadFmGroups(standardId), reloadStandards()]);
      toast("FM-gruppe lagt til.");
    } catch (err) {
      console.error(err);
      toast(readErrorMessage(err, "Kunne ikke legge til FM-gruppe."));
    } finally {
      setFmGroupSaving(false);
    }
  }, [fmGroupInput, fmGroupsModal.standardId, loadFmGroups, reloadStandards]);

  const openFmGroupEditModal = useCallback((row: StandardFmGroupRow) => {
    setFmGroupEditModal({
      opened: true,
      rowId: row.id,
      label: row.label,
    });
  }, []);

  const closeFmGroupEditModal = useCallback(() => {
    setFmGroupEditModal(FM_GROUP_EDIT_MODAL_INITIAL_STATE);
    setFmGroupEditSaving(false);
  }, []);

  const submitFmGroupEditModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const label = fmGroupEditModal.label.trim();
      const rowId = fmGroupEditModal.rowId;
      const standardId = fmGroupsModal.standardId;

      if (!standardId || !rowId) return;
      if (!label) {
        toast("Skriv inn FM-gruppe.");
        return;
      }

      try {
        setFmGroupEditSaving(true);
        await updateStandardFmGroup(rowId, { label });
        closeFmGroupEditModal();
        await Promise.all([loadFmGroups(standardId), reloadStandards()]);
        toast("Oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere FM-gruppe."));
      } finally {
        setFmGroupEditSaving(false);
      }
    },
    [closeFmGroupEditModal, fmGroupEditModal.label, fmGroupEditModal.rowId, fmGroupsModal.standardId, loadFmGroups, reloadStandards]
  );

  const deleteFmGroupRow = useCallback(
    (row: StandardFmGroupRow) => {
      const standardId = fmGroupsModal.standardId;
      if (!standardId) return;

      confirmDelete({
        title: "Slett FM-gruppe",
        messageHtml: `Er du sikker pa at du vil slette <b>${esc(row.label)}</b>?`,
        onConfirm: async () => {
          await deleteStandardFmGroup(row.id);
        },
        onDone: async () => {
          await Promise.all([loadFmGroups(standardId), reloadStandards()]);
          toast("FM-gruppe slettet.");
        },
      });
    },
    [confirmDelete, fmGroupsModal.standardId, loadFmGroups, reloadStandards]
  );

  const addMaterial = async () => {
    const name = materialName.trim();
    const code = materialCode.trim();
    const group = materialGroup.trim();

    if (!name || !code || !group) {
      toast("Fyll inn navn, kode og gruppe.");
      return;
    }

    setAddingMaterial(true);
    try {
      await createMaterial({
        name,
        material_code: code,
        material_group: group,
      });
      setMaterialName("");
      setMaterialCode("");
      setMaterialGroup("");
      await reloadMaterials();
      toast("Materiale lagt til.");
    } catch (err) {
      console.error(err);
      toast(readErrorMessage(err, "Kunne ikke legge til materiale."));
    } finally {
      setAddingMaterial(false);
    }
  };

  const openMaterialEditModal = useCallback(
    (row: MaterialRow) => {
      setMaterialEditModal({
        opened: true,
        rowId: row.id,
        name: row.name,
        code: row.material_code,
        group: row.material_group,
      });
    },
    []
  );

  const closeMaterialEditModal = useCallback(() => {
    setMaterialEditModal(MATERIAL_EDIT_MODAL_INITIAL_STATE);
    setMaterialEditSaving(false);
  }, []);

  const submitMaterialEditModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextName = materialEditModal.name.trim();
      const nextCode = materialEditModal.code.trim();
      const nextGroup = materialEditModal.group.trim();

      if (!materialEditModal.rowId) return;
      if (!nextName || !nextCode || !nextGroup) {
        toast("Fyll inn navn, kode og gruppe.");
        return;
      }

      try {
        setMaterialEditSaving(true);
        await updateMaterial(materialEditModal.rowId, {
          name: nextName,
          material_code: nextCode,
          material_group: nextGroup,
        });

        closeMaterialEditModal();
        await reloadMaterials();
        toast("Oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere materiale."));
      } finally {
        setMaterialEditSaving(false);
      }
    },
    [closeMaterialEditModal, materialEditModal.code, materialEditModal.group, materialEditModal.name, materialEditModal.rowId, reloadMaterials]
  );

  const deleteMaterialRow = useCallback(
    async (row: MaterialRow) => {
      try {
        const [wpsCount, wpqrCount] = await Promise.all([
          countReferences("wps", "material_id", row.id),
          countReferences("wpqr", "material_id", row.id),
        ]);

        if (wpsCount > 0 || wpqrCount > 0) {
          toast("Kan ikke slette: materialet brukes i WPS/WPQR.");
          return;
        }

        confirmDelete({
          title: "Slett materiale",
          messageHtml: `Er du sikker på at du vil slette <b>${esc(materialLabel(row))}</b>?`,
          onConfirm: async () => {
            await deleteMaterial(row.id);
          },
          onDone: async () => {
            await reloadMaterials();
            toast("Materiale slettet.");
          },
        });
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke slette materiale."));
      }
    },
    [confirmDelete, reloadMaterials]
  );

  const addStandard = async () => {
    const label = standardLabel.trim();
    const description = standardDescription.trim();
    const type = standardType.trim();
    const revisionRaw = standardRevision.trim();
    const revision = revisionRaw ? Number.parseInt(revisionRaw, 10) : null;

    if (!label) {
      toast("Fyll inn navn.");
      return;
    }

    setAddingStandard(true);
    try {
      await createStandard({
        label,
        description: description || null,
        type: type || null,
        revision: revision && Number.isFinite(revision) ? revision : null,
      });
      setStandardLabel("");
      setStandardDescription("");
      setStandardType("");
      setStandardRevision("");
      await reloadStandards();
      toast("Standard lagt til.");
    } catch (err) {
      console.error(err);
      toast(readErrorMessage(err, "Kunne ikke legge til standard."));
    } finally {
      setAddingStandard(false);
    }
  };

  const openStandardEditModal = useCallback(
    (row: StandardRow) => {
      setStandardEditModal({
        opened: true,
        rowId: row.id,
        label: row.label,
        description: row.description ?? "",
        type: row.type ?? "",
        revision: row.revision != null ? String(row.revision) : "",
      });
    },
    []
  );

  const closeStandardEditModal = useCallback(() => {
    setStandardEditModal(STANDARD_EDIT_MODAL_INITIAL_STATE);
    setStandardEditSaving(false);
  }, []);

  const submitStandardEditModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextLabel = standardEditModal.label.trim();
      const nextDescription = standardEditModal.description.trim();
      const nextType = standardEditModal.type.trim();
      const revisionRaw = standardEditModal.revision.trim();
      const revision = revisionRaw ? Number.parseInt(revisionRaw, 10) : null;

      if (!standardEditModal.rowId) return;
      if (!nextLabel) {
        toast("Fyll inn navn.");
        return;
      }

      try {
        setStandardEditSaving(true);
        await updateStandard(standardEditModal.rowId, {
          label: nextLabel,
          description: nextDescription || null,
          type: nextType || null,
          revision: revision && Number.isFinite(revision) ? revision : null,
        });

        closeStandardEditModal();
        await reloadStandards();
        toast("Oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere standard."));
      } finally {
        setStandardEditSaving(false);
      }
    },
    [closeStandardEditModal, reloadStandards, standardEditModal.description, standardEditModal.label, standardEditModal.revision, standardEditModal.rowId, standardEditModal.type]
  );

  const deleteStandardRow = useCallback(
    async (row: StandardRow) => {
      try {
        const count = await countReferences("welder_certificates", "standard", row.label);
        if (count > 0) {
          toast("Kan ikke slette: standarden brukes i sertifikater.");
          return;
        }

        confirmDelete({
          title: "Slett standard",
          messageHtml: `Er du sikker pa at du vil slette <b>${esc(standardLabelText(row))}</b>?`,
          onConfirm: async () => {
            await deleteStandard(row.id);
          },
          onDone: async () => {
            await reloadStandards();
            toast("Standard slettet.");
          },
        });
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke slette standard."));
      }
    },
    [confirmDelete, reloadStandards]
  );

  const openStandardFmModal = useCallback(
    (row: StandardRow) => {
      openFmGroupsModal(row);
    },
    [openFmGroupsModal]
  );

  const addNdtMethod = async () => {
    const code = ndtCode.trim().toUpperCase();
    const label = ndtLabel.trim();
    const description = ndtDescription.trim();
    const standardId = ndtStandardId.trim() || null;

    if (!code || !label) {
      toast("Fyll inn kode og navn.");
      return;
    }

    setAddingNdtMethod(true);
    try {
      await createNdtMethod({
        code,
        label,
        description: description || null,
        standard_id: standardId,
      });
      setNdtCode("");
      setNdtLabel("");
      setNdtDescription("");
      setNdtStandardId("");
      await reloadNdtMethods();
      toast("NDT-metode lagt til.");
    } catch (err) {
      console.error(err);
      toast(readErrorMessage(err, "Kunne ikke legge til NDT-metode."));
    } finally {
      setAddingNdtMethod(false);
    }
  };

  const openNdtMethodEditModal = useCallback(
    (row: NdtMethodRow) => {
      setNdtMethodEditModal({
        opened: true,
        rowId: row.id,
        code: row.code,
        label: row.label,
        description: row.description ?? "",
        standardId: row.standard_id ?? "",
      });
    },
    []
  );

  const closeNdtMethodEditModal = useCallback(() => {
    setNdtMethodEditModal(NDT_METHOD_EDIT_MODAL_INITIAL_STATE);
    setNdtMethodEditSaving(false);
  }, []);

  const submitNdtMethodEditModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const code = ndtMethodEditModal.code.trim().toUpperCase();
      const label = ndtMethodEditModal.label.trim();
      const description = ndtMethodEditModal.description.trim();
      const standardId = ndtMethodEditModal.standardId.trim() || null;

      if (!ndtMethodEditModal.rowId) return;
      if (!code || !label) {
        toast("Fyll inn kode og navn.");
        return;
      }

      try {
        setNdtMethodEditSaving(true);
        await updateNdtMethod(ndtMethodEditModal.rowId, {
          code,
          label,
          description: description || null,
          standard_id: standardId,
        });

        closeNdtMethodEditModal();
        await reloadNdtMethods();
        toast("Oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere NDT-metode."));
      } finally {
        setNdtMethodEditSaving(false);
      }
    },
    [closeNdtMethodEditModal, ndtMethodEditModal.code, ndtMethodEditModal.description, ndtMethodEditModal.label, ndtMethodEditModal.rowId, ndtMethodEditModal.standardId, reloadNdtMethods]
  );

  const deleteNdtMethodRow = useCallback(
    async (row: NdtMethodRow) => {
      try {
        const count = await countReferences("ndt_reports", "method_id", row.id);
        if (count > 0) {
          toast("Kan ikke slette: metoden brukes i rapporter.");
          return;
        }

        confirmDelete({
          title: "Slett NDT-metode",
          messageHtml: `Er du sikker pa at du vil slette <b>${esc(`${row.code} - ${row.label}`)}</b>?`,
          onConfirm: async () => {
            await deleteNdtMethod(row.id);
          },
          onDone: async () => {
            await reloadNdtMethods();
            toast("NDT-metode slettet.");
          },
        });
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke slette NDT-metode."));
      }
    },
    [confirmDelete, reloadNdtMethods]
  );

  const addProcess = async () => {
    const code = processCode.trim();
    const label = processLabel.trim();
    if (!code || !label) {
      toast("Fyll inn kode og beskrivelse.");
      return;
    }
    if (!PROCESS_CODE_PATTERN.test(code)) {
      toast("Kode ma vare 2-4 siffer.");
      return;
    }

    setAddingProcess(true);
    try {
      await createWeldingProcess({ code, label });
      setProcessCode("");
      setProcessLabel("");
      await reloadProcesses();
      toast("Sveiseprosess lagt til.");
    } catch (err) {
      console.error(err);
      toast(readErrorMessage(err, "Kunne ikke legge til sveiseprosess."));
    } finally {
      setAddingProcess(false);
    }
  };

  const openProcessEditModal = useCallback(
    (row: WeldingProcessRow) => {
      setProcessEditModal({
        opened: true,
        rowId: row.id,
        code: String(row.code ?? ""),
        label: row.label,
      });
    },
    []
  );

  const closeProcessEditModal = useCallback(() => {
    setProcessEditModal(PROCESS_EDIT_MODAL_INITIAL_STATE);
    setProcessEditSaving(false);
  }, []);

  const submitProcessEditModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const code = processEditModal.code.trim();
      const label = processEditModal.label.trim();

      if (!processEditModal.rowId) return;
      if (!code || !label) {
        toast("Fyll inn kode og beskrivelse.");
        return;
      }
      if (!PROCESS_CODE_PATTERN.test(code)) {
        toast("Kode ma vare 2-4 siffer.");
        return;
      }

      try {
        setProcessEditSaving(true);
        await updateWeldingProcess(processEditModal.rowId, { code, label });
        closeProcessEditModal();
        await reloadProcesses();
        toast("Oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere sveiseprosess."));
      } finally {
        setProcessEditSaving(false);
      }
    },
    [closeProcessEditModal, processEditModal.code, processEditModal.label, processEditModal.rowId, reloadProcesses]
  );

  const deleteProcessRow = useCallback(
    async (row: WeldingProcessRow) => {
      try {
        confirmDelete({
          title: "Slett sveiseprosess",
          messageHtml: `Er du sikker pa at du vil slette <b>${esc(processLabelText(row))}</b>?`,
          onConfirm: async () => {
            await deleteWeldingProcess(row.id);
          },
          onDone: async () => {
            await reloadProcesses();
            toast("Sveiseprosess slettet.");
          },
        });
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke slette sveiseprosess."));
      }
    },
    [confirmDelete, reloadProcesses]
  );

  const addJointType = async () => {
    const label = jointTypeLabel.trim().toUpperCase();
    if (!label) {
      toast("Skriv inn fugetype.");
      return;
    }

    setAddingJointType(true);
    try {
      await createWeldJointType(label);
      setJointTypeLabel("");
      await reloadJointTypes();
      toast("Sveisefuge lagt til.");
    } catch (err) {
      console.error(err);
      toast(readErrorMessage(err, "Kunne ikke legge til sveisefuge."));
    } finally {
      setAddingJointType(false);
    }
  };

  const openJointTypeEditModal = useCallback(
    (row: WeldJointTypeRow) => {
      setJointTypeEditModal({
        opened: true,
        rowId: row.id,
        label: row.label,
      });
    },
    []
  );

  const closeJointTypeEditModal = useCallback(() => {
    setJointTypeEditModal(JOINT_TYPE_EDIT_MODAL_INITIAL_STATE);
    setJointTypeEditSaving(false);
  }, []);

  const submitJointTypeEditModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const label = jointTypeEditModal.label.trim().toUpperCase();

      if (!jointTypeEditModal.rowId) return;
      if (!label) {
        toast("Skriv inn fugetype.");
        return;
      }

      try {
        setJointTypeEditSaving(true);
        await updateWeldJointType(jointTypeEditModal.rowId, label);
        closeJointTypeEditModal();
        await reloadJointTypes();
        toast("Oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere sveisefuge."));
      } finally {
        setJointTypeEditSaving(false);
      }
    },
    [closeJointTypeEditModal, jointTypeEditModal.label, jointTypeEditModal.rowId, reloadJointTypes]
  );

  const deleteJointTypeRow = useCallback(
    async (row: WeldJointTypeRow) => {
      try {
        const [wpsCount, wpqrCount] = await Promise.all([
          countReferences("wps", "fuge", row.label),
          countReferences("wpqr", "fuge", row.label),
        ]);
        if (wpsCount > 0 || wpqrCount > 0) {
          toast("Kan ikke slette: sveisefugen brukes i WPS/WPQR.");
          return;
        }

        confirmDelete({
          title: "Slett sveisefuge",
          messageHtml: `Er du sikker pa at du vil slette <b>${esc(row.label)}</b>?`,
          onConfirm: async () => {
            await deleteWeldJointType(row.id);
          },
          onDone: async () => {
            await reloadJointTypes();
            toast("Sveisefuge slettet.");
          },
        });
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke slette sveisefuge."));
      }
    },
    [confirmDelete, reloadJointTypes]
  );

  if (!isAdmin) {
    return (
      <AppPageLayout pageClassName="page-company-settings" displayName={displayName} email={email}>
          <CompanySettingsHeader
            title="App-parametere - Teknisk / Sveising"
            subtitle="Kun admin har tilgang."
            backTo="/settings/company"
            backLabel="<- App-parametere"
          />
          <div className="muted app-muted-block">
            Kun admin har tilgang.
          </div>
      </AppPageLayout>
    );
  }

  return (
    <AppPageLayout pageClassName="page-company-settings" displayName={displayName} email={email}>
      <CompanySettingsHeader
          title="App-parametere - Teknisk / Sveising"
          subtitle="Materialer, standarder, NDT-metoder, sveiseprosesser og sveisefuger."
          backTo="/settings/company"
          backLabel="<- App-parametere"
          actions={
            <AppRefreshIconButton
              onClick={() => void reloadAll()}
              disabled={isRefreshing}
              loading={isRefreshing}
            />
          }
        />

        <Stack gap="md">
          <WeldingAdminListPanel
            title="Materialer"
            helperText={'Vises som "Navn (kode) - gruppe".'}
            listState={materials}
            emptyMessage="Ingen materialer."
            form={
              <Group align="flex-end" gap="sm" wrap="wrap">
                <Box flex={1} miw={320}>
                  <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                    <AppTextInput placeholder="Materialnavn..." value={materialName} onChange={setMaterialName} />
                    <AppTextInput placeholder="Materialkode..." value={materialCode} onChange={setMaterialCode} />
                    <AppTextInput placeholder="Materialgruppe..." value={materialGroup} onChange={setMaterialGroup} />
                  </SimpleGrid>
                </Box>
                <AppButton tone="primary" size="sm" disabled={addingMaterial} onClick={() => void addMaterial()}>
                  Legg til
                </AppButton>
              </Group>
            }
            renderItem={(row) => (
              <WeldingListItem
                key={row.id}
                title={materialLabel(row)}
                actions={
                  <AppActionsMenu
                    items={[
                      createEditAction({
                        key: "edit-material",
                        onClick: () => openMaterialEditModal(row),
                      }),
                      createDeleteAction({
                        key: "delete-material",
                        onClick: () => void deleteMaterialRow(row),
                      }),
                    ]}
                  />
                }
              />
            )}
          />

          <WeldingAdminListPanel
            title="Standarder"
            listState={standards}
            emptyMessage="Ingen standarder."
            form={
              <Group align="flex-end" gap="sm" wrap="wrap">
                <Box flex={1} miw={320}>
                  <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="sm">
                    <AppNativeSelect value={standardType} onChange={setStandardType}>
                      <option value="">Velg type...</option>
                      {STANDARD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </AppNativeSelect>
                    <AppTextInput
                      placeholder="Standardnavn... (f.eks NS-ISO 9606-1)"
                      value={standardLabel}
                      onChange={setStandardLabel}
                    />
                    <AppTextInput
                      placeholder="Beskrivelse..."
                      value={standardDescription}
                      onChange={setStandardDescription}
                    />
                    <AppNativeSelect value={standardRevision} onChange={setStandardRevision}>
                      <option value="">Ingen revisjon</option>
                      {Array.from({ length: 31 }, (_, i) => {
                        const year = String(new Date().getFullYear() - i);
                        return (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        );
                      })}
                    </AppNativeSelect>
                  </SimpleGrid>
                </Box>
                <AppButton tone="primary" size="sm" disabled={addingStandard} onClick={() => void addStandard()}>
                  Legg til
                </AppButton>
              </Group>
            }
            renderItem={(row) => {
              const meta = [row.type, row.description].filter(Boolean).join(" - ");
              return (
                <WeldingListItem
                  key={row.id}
                  title={standardLabelText(row)}
                  meta={meta}
                  actions={
                    <Group gap="xs" wrap="nowrap">
                      {row.has_fm_group ? (
                        <AppButton size="sm" onClick={() => void openStandardFmModal(row)}>
                          FM-grupper
                        </AppButton>
                      ) : null}
                      <AppActionsMenu
                        items={[
                          createEditAction({
                            key: "edit-standard",
                            onClick: () => openStandardEditModal(row),
                          }),
                          createDeleteAction({
                            key: "delete-standard",
                            onClick: () => void deleteStandardRow(row),
                          }),
                        ]}
                      />
                    </Group>
                  }
                />
              );
            }}
          />

          <WeldingAdminListPanel
            title="NDT-metoder"
            helperText="NDT-metoder brukes i sertifikater og rapporter."
            listState={ndtMethods}
            emptyMessage="Ingen NDT-metoder."
            form={
              <Group align="flex-end" gap="sm" wrap="wrap">
                <Box flex={1} miw={320}>
                  <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="sm">
                    <AppTextInput placeholder="Kode... (f.eks RT)" value={ndtCode} onChange={setNdtCode} />
                    <AppTextInput placeholder="Navn..." value={ndtLabel} onChange={setNdtLabel} />
                    <AppTextInput
                      placeholder="Beskrivelse..."
                      value={ndtDescription}
                      onChange={setNdtDescription}
                    />
                    <AppNativeSelect value={ndtStandardId} onChange={setNdtStandardId}>
                      <option value="">Standard (valgfritt)...</option>
                      {standardOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </AppNativeSelect>
                  </SimpleGrid>
                </Box>
                <AppButton tone="primary" size="sm" disabled={addingNdtMethod} onClick={() => void addNdtMethod()}>
                  Legg til
                </AppButton>
              </Group>
            }
            renderItem={(row) => {
              const meta = [row.description, row.standard ? standardLabelText(row.standard) : null]
                .filter(Boolean)
                .join(" - ");
              return (
                <WeldingListItem
                  key={row.id}
                  title={`${row.code} - ${row.label}`}
                  meta={meta}
                  actions={
                    <AppActionsMenu
                      items={[
                        createEditAction({
                          key: "edit-ndt",
                          onClick: () => openNdtMethodEditModal(row),
                        }),
                        createDeleteAction({
                          key: "delete-ndt",
                          onClick: () => void deleteNdtMethodRow(row),
                        }),
                      ]}
                    />
                  }
                />
              );
            }}
          />

          <WeldingAdminListPanel
            title="Sveiseprosesser"
            listState={processes}
            emptyMessage="Ingen sveiseprosesser."
            form={
              <Group align="flex-end" gap="sm" wrap="wrap">
                <Box flex={1} miw={320}>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                    <AppTextInput
                      placeholder="Kode... (f.eks 141)"
                      value={processCode}
                      onChange={setProcessCode}
                    />
                    <AppTextInput
                      placeholder="Beskrivelse... (f.eks TIG-sveis)"
                      value={processLabel}
                      onChange={setProcessLabel}
                    />
                  </SimpleGrid>
                </Box>
                <AppButton tone="primary" size="sm" disabled={addingProcess} onClick={() => void addProcess()}>
                  Legg til
                </AppButton>
              </Group>
            }
            renderItem={(row) => (
              <WeldingListItem
                key={row.id}
                title={processLabelText(row)}
                actions={
                  <AppActionsMenu
                    items={[
                      createEditAction({
                        key: "edit-process",
                        onClick: () => openProcessEditModal(row),
                      }),
                      createDeleteAction({
                        key: "delete-process",
                        onClick: () => void deleteProcessRow(row),
                      }),
                    ]}
                  />
                }
              />
            )}
          />

          <WeldingAdminListPanel
            title="Sveisefuger"
            helperText="Brukes i dropdown for fugetype i WPS/WPQR."
            listState={jointTypes}
            emptyMessage="Ingen sveisefuger."
            form={
              <Group align="flex-end" gap="sm" wrap="wrap">
                <Box flex={1} miw={320}>
                  <AppTextInput
                    placeholder="Ny fugetype... (f.eks BW eller FW)"
                    value={jointTypeLabel}
                    onChange={setJointTypeLabel}
                  />
                </Box>
                <AppButton tone="primary" size="sm" disabled={addingJointType} onClick={() => void addJointType()}>
                  Legg til
                </AppButton>
              </Group>
            }
            renderItem={(row) => (
              <WeldingListItem
                key={row.id}
                title={row.label}
                actions={
                  <AppActionsMenu
                    items={[
                      createEditAction({
                        key: "edit-joint-type",
                        onClick: () => openJointTypeEditModal(row),
                      }),
                      createDeleteAction({
                        key: "delete-joint-type",
                        onClick: () => void deleteJointTypeRow(row),
                      }),
                    ]}
                  />
                }
              />
            )}
          />

        </Stack>

        <AppModal
          opened={materialEditModal.opened}
          onClose={closeMaterialEditModal}
          title="Endre materiale"
          busy={materialEditSaving}
        >
          <form onSubmit={submitMaterialEditModal}>
            <AppTextInput
              label="Materialnavn"
              value={materialEditModal.name}
              onChange={(value) =>
                setMaterialEditModal((current) => ({
                  ...current,
                  name: value,
                }))
              }
            />
            <AppTextInput
              mt="sm"
              label="Materialkode"
              value={materialEditModal.code}
              onChange={(value) =>
                setMaterialEditModal((current) => ({
                  ...current,
                  code: value,
                }))
              }
            />
            <AppTextInput
              mt="sm"
              label="Materialgruppe"
              value={materialEditModal.group}
              onChange={(value) =>
                setMaterialEditModal((current) => ({
                  ...current,
                  group: value,
                }))
              }
            />

            <AppModalActions
              onCancel={closeMaterialEditModal}
              cancelDisabled={materialEditSaving}
              confirmLabel="Lagre"
              confirmType="submit"
              confirmLoading={materialEditSaving}
            />
          </form>
        </AppModal>

        <AppModal
          opened={standardEditModal.opened}
          onClose={closeStandardEditModal}
          title="Endre standard"
          busy={standardEditSaving}
        >
          <form onSubmit={submitStandardEditModal}>
            <AppTextInput
              label="Standardnavn"
              value={standardEditModal.label}
              onChange={(value) =>
                setStandardEditModal((current) => ({
                  ...current,
                  label: value,
                }))
              }
            />
            <AppTextInput
              mt="sm"
              label="Beskrivelse"
              value={standardEditModal.description}
              onChange={(value) =>
                setStandardEditModal((current) => ({
                  ...current,
                  description: value,
                }))
              }
            />
            <AppSelect
              mt="sm"
              label="Type"
              data={standardTypeOptions}
              value={standardEditModal.type}
              allowDeselect={false}
              onChange={(value) =>
                setStandardEditModal((current) => ({
                  ...current,
                  type: value,
                }))
              }
            />
            <AppSelect
              mt="sm"
              label="Revisjon"
              data={standardRevisionOptions}
              value={standardEditModal.revision}
              allowDeselect={false}
              onChange={(value) =>
                setStandardEditModal((current) => ({
                  ...current,
                  revision: value,
                }))
              }
            />

            <AppModalActions
              onCancel={closeStandardEditModal}
              cancelDisabled={standardEditSaving}
              confirmLabel="Lagre"
              confirmType="submit"
              confirmLoading={standardEditSaving}
            />
          </form>
        </AppModal>

        <AppModal
          opened={fmGroupsModal.opened}
          onClose={closeFmGroupsModal}
          title={`FM-grupper - ${fmGroupsModal.standardLabel}`}
          busy={fmGroupSaving}
          size="lg"
        >
          <Stack gap="md">
            <Group align="flex-end" gap="sm" wrap="wrap">
              <Box flex={1} miw={240}>
                <AppTextInput
                  placeholder="Ny FM-gruppe..."
                  value={fmGroupInput}
                  onChange={setFmGroupInput}
                />
              </Box>
              <AppButton tone="primary" size="sm" disabled={fmGroupSaving} onClick={() => void addFmGroup()}>
                Legg til
              </AppButton>
            </Group>

            <AppAsyncState
              loading={fmGroupsLoading}
              error={fmGroupsError}
              isEmpty={fmGroupsRows.length === 0}
              emptyMessage="Ingen FM-grupper."
            >
              <Stack gap="sm">
                {fmGroupsRows.map((row) => (
                  <WeldingListItem
                    key={row.id}
                    title={row.label}
                    actions={
                      <AppActionsMenu
                        title={`Handlinger for ${row.label}`}
                        items={[
                          createEditAction({
                            key: `edit-${row.id}`,
                            onClick: () => openFmGroupEditModal(row),
                          }),
                          createDeleteAction({
                            key: `delete-${row.id}`,
                            onClick: () => deleteFmGroupRow(row),
                          }),
                        ]}
                      />
                    }
                  />
                ))}
              </Stack>
            </AppAsyncState>
          </Stack>

          <AppModalActions
            showCancel={false}
            confirmLabel="Ferdig"
            confirmTone="neutral"
            onConfirm={closeFmGroupsModal}
            confirmDisabled={fmGroupSaving}
          />
        </AppModal>

        <AppModal
          opened={fmGroupEditModal.opened}
          onClose={closeFmGroupEditModal}
          title="Endre FM-gruppe"
          busy={fmGroupEditSaving}
        >
          <form onSubmit={submitFmGroupEditModal}>
            <AppTextInput
              label="FM-gruppe"
              value={fmGroupEditModal.label}
              onChange={(value) =>
                setFmGroupEditModal((current) => ({
                  ...current,
                  label: value,
                }))
              }
            />

            <AppModalActions
              onCancel={closeFmGroupEditModal}
              cancelDisabled={fmGroupEditSaving}
              confirmLabel="Lagre"
              confirmType="submit"
              confirmLoading={fmGroupEditSaving}
            />
          </form>
        </AppModal>

        <AppModal
          opened={ndtMethodEditModal.opened}
          onClose={closeNdtMethodEditModal}
          title="Endre NDT-metode"
          busy={ndtMethodEditSaving}
        >
          <form onSubmit={submitNdtMethodEditModal}>
            <AppTextInput
              label="Kode"
              value={ndtMethodEditModal.code}
              onChange={(value) =>
                setNdtMethodEditModal((current) => ({
                  ...current,
                  code: value,
                }))
              }
            />
            <AppTextInput
              mt="sm"
              label="Navn"
              value={ndtMethodEditModal.label}
              onChange={(value) =>
                setNdtMethodEditModal((current) => ({
                  ...current,
                  label: value,
                }))
              }
            />
            <AppTextInput
              mt="sm"
              label="Beskrivelse"
              value={ndtMethodEditModal.description}
              onChange={(value) =>
                setNdtMethodEditModal((current) => ({
                  ...current,
                  description: value,
                }))
              }
            />
            <AppSelect
              mt="sm"
              label="Standard (valgfritt)"
              data={ndtModalStandardOptions}
              value={ndtMethodEditModal.standardId}
              searchable={ndtModalStandardOptions.length > 8}
              nothingFoundMessage="Ingen treff"
              allowDeselect={false}
              onChange={(value) =>
                setNdtMethodEditModal((current) => ({
                  ...current,
                  standardId: value,
                }))
              }
            />

            <AppModalActions
              onCancel={closeNdtMethodEditModal}
              cancelDisabled={ndtMethodEditSaving}
              confirmLabel="Lagre"
              confirmType="submit"
              confirmLoading={ndtMethodEditSaving}
            />
          </form>
        </AppModal>

        <AppModal
          opened={processEditModal.opened}
          onClose={closeProcessEditModal}
          title="Endre sveiseprosess"
          busy={processEditSaving}
        >
          <form onSubmit={submitProcessEditModal}>
            <AppTextInput
              label="Kode"
              value={processEditModal.code}
              onChange={(value) =>
                setProcessEditModal((current) => ({
                  ...current,
                  code: value,
                }))
              }
            />
            <AppTextInput
              mt="sm"
              label="Beskrivelse"
              value={processEditModal.label}
              onChange={(value) =>
                setProcessEditModal((current) => ({
                  ...current,
                  label: value,
                }))
              }
            />

            <AppModalActions
              onCancel={closeProcessEditModal}
              cancelDisabled={processEditSaving}
              confirmLabel="Lagre"
              confirmType="submit"
              confirmLoading={processEditSaving}
            />
          </form>
        </AppModal>

        <AppModal
          opened={jointTypeEditModal.opened}
          onClose={closeJointTypeEditModal}
          title="Endre sveisefuge"
          busy={jointTypeEditSaving}
        >
          <form onSubmit={submitJointTypeEditModal}>
            <AppTextInput
              label="Fugetype"
              value={jointTypeEditModal.label}
              onChange={(value) =>
                setJointTypeEditModal((current) => ({
                  ...current,
                  label: value,
                }))
              }
            />

            <AppModalActions
              onCancel={closeJointTypeEditModal}
              cancelDisabled={jointTypeEditSaving}
              confirmLabel="Lagre"
              confirmType="submit"
              confirmLoading={jointTypeEditSaving}
            />
          </form>
        </AppModal>

        {deleteConfirmModal}
    </AppPageLayout>
  );
}

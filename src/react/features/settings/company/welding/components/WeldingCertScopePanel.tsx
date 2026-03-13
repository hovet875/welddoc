import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Box, Group, SimpleGrid } from "@mantine/core";
import type { MaterialRow } from "@/repo/materialRepo";
import { fetchStandardFmGroups, type StandardFmGroupRow, type StandardRow } from "@/repo/standardRepo";
import {
  createWelderCertScope,
  deleteWelderCertScope,
  fetchWelderCertScopes,
  updateWelderCertScope,
  type WelderCertScopeRow,
} from "@/repo/welderCertScopeRepo";
import type { WeldingProcessRow } from "@/repo/weldingProcessRepo";
import type { WeldJointTypeRow } from "@/repo/weldJointTypeRepo";
import { AppActionsMenu, createDeleteAction, createEditAction } from "@react/ui/AppActionsMenu";
import { AppButton } from "@react/ui/AppButton";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppSelect } from "@react/ui/AppSelect";
import { toast } from "@react/ui/notify";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import { esc } from "@/utils/dom";
import type { WeldingListState } from "../welding.types";
import { WeldingAdminListPanel } from "./WeldingAdminListPanel";
import { WeldingListItem } from "./WeldingListItem";

type SelectOption = {
  value: string;
  label: string;
};

type ScopeListState = {
  loading: boolean;
  error: string | null;
  rows: WelderCertScopeRow[];
};

type FmGroupsState = {
  loading: boolean;
  error: string | null;
  rows: StandardFmGroupRow[];
};

type ScopeEditModalState = {
  opened: boolean;
  rowId: string;
  standardId: string;
  fmGroupId: string;
  materialId: string;
  weldingProcessCode: string;
  jointType: string;
};

type WeldingCertScopePanelProps = {
  standards: WeldingListState<StandardRow>;
  materials: WeldingListState<MaterialRow>;
  processes: WeldingListState<WeldingProcessRow>;
  jointTypes: WeldingListState<WeldJointTypeRow>;
  refreshNonce?: number;
};

const EMPTY_SCOPE_LIST_STATE: ScopeListState = {
  loading: true,
  error: null,
  rows: [],
};

const EMPTY_FM_GROUPS_STATE: FmGroupsState = {
  loading: true,
  error: null,
  rows: [],
};

const INITIAL_SCOPE_EDIT_MODAL_STATE: ScopeEditModalState = {
  opened: false,
  rowId: "",
  standardId: "",
  fmGroupId: "",
  materialId: "",
  weldingProcessCode: "",
  jointType: "",
};

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function standardLabelText(row: Pick<StandardRow, "label" | "revision">) {
  return row.revision ? `${row.label} (${row.revision})` : row.label;
}

function materialLabel(row: Pick<MaterialRow, "name" | "material_code" | "material_group">) {
  return `${row.name} (${row.material_code}) - ${row.material_group}`;
}

function processLabelText(row: Pick<WeldingProcessRow, "code" | "label">) {
  const code = String(row.code ?? "").trim();
  const label = String(row.label ?? "").trim();
  if (code && label) return `${code} - ${label}`;
  return code || label;
}

function appendMissingOption(options: SelectOption[], value: string, fallbackLabel?: string) {
  const normalized = value.trim();
  if (!normalized) return options;
  if (options.some((row) => row.value === normalized)) return options;
  return [...options, { value: normalized, label: fallbackLabel ?? normalized }];
}

export function WeldingCertScopePanel({
  standards,
  materials,
  processes,
  jointTypes,
  refreshNonce = 0,
}: WeldingCertScopePanelProps) {
  const [scopeState, setScopeState] = useState<ScopeListState>(EMPTY_SCOPE_LIST_STATE);
  const [fmGroupsState, setFmGroupsState] = useState<FmGroupsState>(EMPTY_FM_GROUPS_STATE);

  const [standardId, setStandardId] = useState("");
  const [fmGroupId, setFmGroupId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [weldingProcessCode, setWeldingProcessCode] = useState("");
  const [jointType, setJointType] = useState("");
  const [addingScope, setAddingScope] = useState(false);

  const [editModal, setEditModal] = useState<ScopeEditModalState>(INITIAL_SCOPE_EDIT_MODAL_STATE);
  const [savingEditModal, setSavingEditModal] = useState(false);
  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();

  const loadScopes = useCallback(async () => {
    setScopeState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await fetchWelderCertScopes({ includeInactive: true });
      setScopeState({ loading: false, error: null, rows });
    } catch (err) {
      console.error(err);
      setScopeState({
        loading: false,
        error: readErrorMessage(err, "Kunne ikke hente sertifikatscope."),
        rows: [],
      });
    }
  }, []);

  const loadFmGroups = useCallback(async () => {
    setFmGroupsState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await fetchStandardFmGroups();
      setFmGroupsState({ loading: false, error: null, rows });
    } catch (err) {
      console.error(err);
      setFmGroupsState({
        loading: false,
        error: readErrorMessage(err, "Kunne ikke hente FM-grupper."),
        rows: [],
      });
    }
  }, []);

  useEffect(() => {
    void loadScopes();
  }, [loadScopes, refreshNonce]);

  useEffect(() => {
    void loadFmGroups();
  }, [loadFmGroups, refreshNonce, standards.rows]);

  const standardsById = useMemo(() => {
    const map = new Map<string, StandardRow>();
    for (const row of standards.rows) map.set(row.id, row);
    return map;
  }, [standards.rows]);

  const fmGroupsById = useMemo(() => {
    const map = new Map<string, StandardFmGroupRow>();
    for (const row of fmGroupsState.rows) map.set(row.id, row);
    return map;
  }, [fmGroupsState.rows]);

  const materialsById = useMemo(() => {
    const map = new Map<string, MaterialRow>();
    for (const row of materials.rows) map.set(row.id, row);
    return map;
  }, [materials.rows]);

  const processesByCode = useMemo(() => {
    const map = new Map<string, WeldingProcessRow>();
    for (const row of processes.rows) {
      const code = String(row.code ?? "").trim();
      if (!code) continue;
      if (!map.has(code)) map.set(code, row);
    }
    return map;
  }, [processes.rows]);

  const standardOptions = useMemo<SelectOption[]>(() => {
    return standards.rows.map((row) => ({
      value: row.id,
      label: standardLabelText(row),
    }));
  }, [standards.rows]);

  const materialOptions = useMemo<SelectOption[]>(() => {
    return materials.rows.map((row) => ({
      value: row.id,
      label: materialLabel(row),
    }));
  }, [materials.rows]);

  const processOptions = useMemo<SelectOption[]>(() => {
    return Array.from(processesByCode.values()).map((row) => {
      const code = String(row.code ?? "").trim();
      return {
        value: code,
        label: processLabelText(row),
      };
    });
  }, [processesByCode]);

  const jointOptions = useMemo<SelectOption[]>(() => {
    return jointTypes.rows.map((row) => ({
      value: row.label,
      label: row.label,
    }));
  }, [jointTypes.rows]);

  const resolveFmSelectState = useCallback(
    (selectedStandardId: string, selectedFmGroupId: string) => {
      const sid = selectedStandardId.trim();
      const selected = selectedFmGroupId.trim();
      if (!sid) {
        return {
          disabled: true,
          options: [{ value: "", label: "Velg standard forst..." }] as SelectOption[],
        };
      }

      const standard = standardsById.get(sid) ?? null;
      if (!standard?.has_fm_group) {
        return {
          disabled: true,
          options: [{ value: "", label: "FM ikke brukt for valgt standard" }] as SelectOption[],
        };
      }

      const rows = fmGroupsState.rows.filter((row) => row.standard_id === sid);
      if (rows.length === 0) {
        return {
          disabled: true,
          options: [{ value: "", label: "Ingen FM-grupper definert" }] as SelectOption[],
        };
      }

      let options: SelectOption[] = [{ value: "", label: "FM-gruppe (valgfritt)..." }];
      options = options.concat(
        rows.map((row) => ({
          value: row.id,
          label: row.label,
        }))
      );
      return {
        disabled: false,
        options: appendMissingOption(options, selected),
      };
    },
    [fmGroupsState.rows, standardsById]
  );

  const addFmSelectState = useMemo(
    () => resolveFmSelectState(standardId, fmGroupId),
    [fmGroupId, resolveFmSelectState, standardId]
  );

  const editFmSelectState = useMemo(
    () => resolveFmSelectState(editModal.standardId, editModal.fmGroupId),
    [editModal.fmGroupId, editModal.standardId, resolveFmSelectState]
  );

  useEffect(() => {
    if (!addFmSelectState.disabled) return;
    if (!fmGroupId) return;
    setFmGroupId("");
  }, [addFmSelectState.disabled, fmGroupId]);

  useEffect(() => {
    if (!editFmSelectState.disabled) return;
    if (!editModal.fmGroupId) return;
    setEditModal((current) => ({
      ...current,
      fmGroupId: "",
    }));
  }, [editFmSelectState.disabled, editModal.fmGroupId]);

  const addScope = useCallback(async () => {
    const nextStandardId = standardId.trim();
    const nextWeldingProcessCode = weldingProcessCode.trim();
    const nextFmGroupId = fmGroupId.trim() || null;
    const nextMaterialId = materialId.trim() || null;
    const nextJointType = jointType.trim() || null;

    if (!nextStandardId || !nextWeldingProcessCode) {
      toast("Velg minst standard og sveiseprosess.");
      return;
    }

    try {
      setAddingScope(true);
      await createWelderCertScope({
        standard_id: nextStandardId,
        fm_group_id: nextFmGroupId,
        material_id: nextMaterialId,
        welding_process_code: nextWeldingProcessCode,
        joint_type: nextJointType,
      });
      setFmGroupId("");
      setMaterialId("");
      setWeldingProcessCode("");
      setJointType("");
      await loadScopes();
      toast("Scope lagt til.");
    } catch (err) {
      console.error(err);
      toast(readErrorMessage(err, "Kunne ikke legge til sertifikatscope."));
    } finally {
      setAddingScope(false);
    }
  }, [fmGroupId, jointType, loadScopes, materialId, standardId, weldingProcessCode]);

  const openEditModal = useCallback((row: WelderCertScopeRow) => {
    setEditModal({
      opened: true,
      rowId: row.id,
      standardId: row.standard_id ?? "",
      fmGroupId: row.fm_group_id ?? "",
      materialId: row.material_id ?? "",
      weldingProcessCode: row.welding_process_code ?? "",
      jointType: row.joint_type ?? "",
    });
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModal(INITIAL_SCOPE_EDIT_MODAL_STATE);
    setSavingEditModal(false);
  }, []);

  const submitEditModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const rowId = editModal.rowId;
      const nextStandardId = editModal.standardId.trim();
      const nextWeldingProcessCode = editModal.weldingProcessCode.trim();
      if (!rowId) return;

      if (!nextStandardId || !nextWeldingProcessCode) {
        toast("Velg minst standard og sveiseprosess.");
        return;
      }

      try {
        setSavingEditModal(true);
        await updateWelderCertScope(rowId, {
          standard_id: nextStandardId,
          fm_group_id: editModal.fmGroupId.trim() || null,
          material_id: editModal.materialId.trim() || null,
          welding_process_code: nextWeldingProcessCode,
          joint_type: editModal.jointType.trim() || null,
        });
        closeEditModal();
        await loadScopes();
        toast("Scope oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere sertifikatscope."));
      } finally {
        setSavingEditModal(false);
      }
    },
    [closeEditModal, editModal, loadScopes]
  );

  const scopeStandardLabel = useCallback(
    (scope: WelderCertScopeRow) => {
      const standard = standardsById.get(scope.standard_id ?? "");
      if (standard) return standardLabelText(standard);
      if (scope.standard) return standardLabelText(scope.standard);
      return "Alle standarder";
    },
    [standardsById]
  );

  const scopeFmLabel = useCallback(
    (scope: WelderCertScopeRow) => {
      if (!scope.fm_group_id) return "Alle FM";
      const group = fmGroupsById.get(scope.fm_group_id);
      return group?.label ?? scope.fm_group?.label ?? scope.fm_group_id;
    },
    [fmGroupsById]
  );

  const scopeMaterialLabel = useCallback(
    (scope: WelderCertScopeRow) => {
      if (!scope.material_id) return "Alle materialer";
      const material = materialsById.get(scope.material_id);
      return material ? materialLabel(material) : scope.material_id;
    },
    [materialsById]
  );

  const scopeProcessLabel = useCallback(
    (scope: WelderCertScopeRow) => {
      const code = String(scope.welding_process_code ?? "").trim();
      if (!code) return "Alle prosesser";
      const process = processesByCode.get(code);
      return process ? processLabelText(process) : code;
    },
    [processesByCode]
  );

  const scopeJointLabel = useCallback((scope: WelderCertScopeRow) => {
    const value = String(scope.joint_type ?? "").trim();
    return value || "Alle fuger";
  }, []);

  const deleteScopeRow = useCallback(
    (row: WelderCertScopeRow) => {
      confirmDelete({
        title: "Slett sertifikatscope",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(scopeStandardLabel(row))}</b>?`,
        onConfirm: async () => {
          await deleteWelderCertScope(row.id);
        },
        onDone: async () => {
          await loadScopes();
          toast("Scope slettet.");
        },
      });
    },
    [confirmDelete, loadScopes, scopeStandardLabel]
  );

  const dependencyLoading =
    standards.loading || materials.loading || processes.loading || jointTypes.loading || fmGroupsState.loading;

  const renderStandardSelectData = useCallback(
    (selected: string, placeholder: string) =>
      appendMissingOption(
        [{ value: "", label: placeholder }, ...standardOptions],
        selected
      ),
    [standardOptions]
  );

  const renderMaterialSelectData = useCallback(
    (selected: string, placeholder: string) =>
      appendMissingOption(
        [{ value: "", label: placeholder }, ...materialOptions],
        selected
      ),
    [materialOptions]
  );

  const renderProcessSelectData = useCallback(
    (selected: string, placeholder: string) =>
      appendMissingOption(
        [{ value: "", label: placeholder }, ...processOptions],
        selected
      ),
    [processOptions]
  );

  const renderJointSelectData = useCallback(
    (selected: string, placeholder: string) =>
      appendMissingOption(
        [{ value: "", label: placeholder }, ...jointOptions],
        selected
      ),
    [jointOptions]
  );

  return (
    <>
      <WeldingAdminListPanel
        title="Sertifikatscope"
        helperText="Definerer hvilke kombinasjoner som brukes for automatisk kobling av sveisesertifikat i weld-log."
        listState={scopeState}
        emptyMessage="Ingen scope definert."
        form={
          <Group align="flex-end" gap="sm" wrap="wrap">
            <Box flex={1} miw={320}>
              <SimpleGrid cols={{ base: 1, md: 2, xl: 5 }} spacing="sm">
                <AppSelect
                  value={standardId}
                  onChange={(value) => {
                    setStandardId(value);
                    setFmGroupId("");
                  }}
                  data={renderStandardSelectData(standardId, "Standard...")}
                  allowDeselect={false}
                  searchable
                  nothingFoundMessage="Ingen treff"
                  disabled={dependencyLoading || addingScope}
                />
                <AppSelect
                  value={fmGroupId}
                  onChange={setFmGroupId}
                  data={addFmSelectState.options}
                  allowDeselect={false}
                  searchable
                  nothingFoundMessage="Ingen treff"
                  disabled={dependencyLoading || addingScope || addFmSelectState.disabled}
                />
                <AppSelect
                  value={materialId}
                  onChange={setMaterialId}
                  data={renderMaterialSelectData(materialId, "Materiale (valgfritt)...")}
                  allowDeselect={false}
                  searchable
                  nothingFoundMessage="Ingen treff"
                  disabled={dependencyLoading || addingScope}
                />
                <AppSelect
                  value={weldingProcessCode}
                  onChange={setWeldingProcessCode}
                  data={renderProcessSelectData(weldingProcessCode, "Sveiseprosess...")}
                  allowDeselect={false}
                  searchable
                  nothingFoundMessage="Ingen treff"
                  disabled={dependencyLoading || addingScope}
                />
                <AppSelect
                  value={jointType}
                  onChange={setJointType}
                  data={renderJointSelectData(jointType, "Fugetype (valgfritt)...")}
                  allowDeselect={false}
                  searchable
                  nothingFoundMessage="Ingen treff"
                  disabled={dependencyLoading || addingScope}
                />
              </SimpleGrid>
            </Box>
            <AppButton tone="primary" size="sm" onClick={() => void addScope()} disabled={addingScope || dependencyLoading}>
              Legg til
            </AppButton>
          </Group>
        }
        renderItem={(row) => {
          const title = `${scopeStandardLabel(row)} - ${scopeProcessLabel(row)}`;
          const meta = [scopeFmLabel(row), scopeMaterialLabel(row), scopeJointLabel(row)].join(" - ");

          return (
            <WeldingListItem
              key={row.id}
              title={title}
              meta={meta}
              actions={
                <AppActionsMenu
                  items={[
                    createEditAction({
                      key: `edit-scope-${row.id}`,
                      onClick: () => openEditModal(row),
                    }),
                    createDeleteAction({
                      key: `delete-scope-${row.id}`,
                      onClick: () => deleteScopeRow(row),
                    }),
                  ]}
                />
              }
            />
          );
        }}
      />

      <AppModal
        opened={editModal.opened}
        onClose={closeEditModal}
        title="Endre sertifikatscope"
        busy={savingEditModal}
      >
        <form onSubmit={submitEditModal}>
          <AppSelect
            label="Standard"
            value={editModal.standardId}
            onChange={(value) =>
              setEditModal((current) => ({
                ...current,
                standardId: value,
                fmGroupId: "",
              }))
            }
            data={renderStandardSelectData(editModal.standardId, "Standard...")}
            allowDeselect={false}
            searchable
            nothingFoundMessage="Ingen treff"
            disabled={savingEditModal}
          />
          <AppSelect
            mt="sm"
            label="FM-gruppe"
            value={editModal.fmGroupId}
            onChange={(value) =>
              setEditModal((current) => ({
                ...current,
                fmGroupId: value,
              }))
            }
            data={editFmSelectState.options}
            allowDeselect={false}
            searchable
            nothingFoundMessage="Ingen treff"
            disabled={savingEditModal || editFmSelectState.disabled}
          />
          <AppSelect
            mt="sm"
            label="Materiale"
            value={editModal.materialId}
            onChange={(value) =>
              setEditModal((current) => ({
                ...current,
                materialId: value,
              }))
            }
            data={renderMaterialSelectData(editModal.materialId, "Materiale (valgfritt)...")}
            allowDeselect={false}
            searchable
            nothingFoundMessage="Ingen treff"
            disabled={savingEditModal}
          />
          <AppSelect
            mt="sm"
            label="Sveiseprosess"
            value={editModal.weldingProcessCode}
            onChange={(value) =>
              setEditModal((current) => ({
                ...current,
                weldingProcessCode: value,
              }))
            }
            data={renderProcessSelectData(editModal.weldingProcessCode, "Sveiseprosess...")}
            allowDeselect={false}
            searchable
            nothingFoundMessage="Ingen treff"
            disabled={savingEditModal}
          />
          <AppSelect
            mt="sm"
            label="Fugetype"
            value={editModal.jointType}
            onChange={(value) =>
              setEditModal((current) => ({
                ...current,
                jointType: value,
              }))
            }
            data={renderJointSelectData(editModal.jointType, "Fugetype (valgfritt)...")}
            allowDeselect={false}
            searchable
            nothingFoundMessage="Ingen treff"
            disabled={savingEditModal}
          />

          <AppModalActions
            onCancel={closeEditModal}
            cancelDisabled={savingEditModal}
            confirmLabel="Lagre"
            confirmType="submit"
            confirmLoading={savingEditModal}
          />
        </form>
      </AppModal>

      {deleteConfirmModal}
    </>
  );
}

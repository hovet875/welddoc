import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Box, Divider, Group, Paper, SimpleGrid, Stack, Tabs, Text } from "@mantine/core";
import {
  createTraceabilityOption,
  deleteTraceabilityProfile,
  deleteTraceabilityOption,
  deleteTraceabilityType,
  fetchTraceabilityOptions,
  fetchTraceabilityProfiles,
  fetchTraceabilityTypes,
  replaceTraceabilityProfileFields,
  setDefaultTraceabilityProfile,
  setDefaultTraceabilityOption,
  upsertTraceabilityProfile,
  upsertTraceabilityType,
  type TraceabilityProfileFieldInputMode,
  type TraceabilityProfileFieldKey,
  type TraceabilityProfileFieldUpsertInput,
  type TraceabilityProfileRow,
  type TraceabilityOptionRow,
  type TraceabilityTypeRow,
} from "@/repo/traceabilityRepo";
import { AppActionsMenu, createDeleteAction, createEditAction } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppButton } from "@react/ui/AppButton";
import { AppCheckbox } from "@react/ui/AppCheckbox";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppNumberInput } from "@react/ui/AppNumberInput";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import { toast } from "@react/ui/notify";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import { esc } from "@/utils/dom";
import { IconStar } from "@tabler/icons-react";
import { WeldingCollapsiblePanel } from "./WeldingCollapsiblePanel";
import { WeldingListItem } from "./WeldingListItem";

type TraceabilityListState<T> = {
  loading: boolean;
  error: string | null;
  rows: T[];
};

type TraceOptionGroupKey =
  | "dn"
  | "od"
  | "sch"
  | "pn"
  | "filler_manufacturer"
  | "filler_type"
  | "filler_diameter";

type TraceTypeEditModalState = {
  opened: boolean;
  code: string;
  label: string;
  useDn: boolean;
  useDn2: boolean;
  useSch: boolean;
  usePressure: boolean;
  useThickness: boolean;
  useFillerType: boolean;
  defaultSch: string;
  defaultPressure: string;
};

type ProfileListState = TraceabilityListState<TraceabilityProfileRow>;

type ProfileFieldEditState = {
  enabled: boolean;
  required: boolean;
  label: string;
  inputMode: TraceabilityProfileFieldInputMode;
  optionGroupKey: string;
  sortOrder: string;
  defaultValue: string;
};

type ProfileFieldEditMap = Record<TraceabilityProfileFieldKey, ProfileFieldEditState>;

type ProfileEditModalState = {
  opened: boolean;
  id: string;
  typeCode: string;
  code: string;
  label: string;
  certificateType: "material" | "filler";
  isDefault: boolean;
  isActive: boolean;
  sortOrder: string;
  fields: ProfileFieldEditMap;
};

type WeldingTraceabilityPanelProps = {
  refreshNonce?: number;
};

type TraceabilityOptionGroupConfig = {
  key: TraceOptionGroupKey;
  title: string;
  placeholder: string;
  addLabel: string;
  emptyMessage: string;
};

const TRACEABILITY_OPTION_GROUPS: TraceabilityOptionGroupConfig[] = [
  {
    key: "dn",
    title: "DN",
    placeholder: "Ny DN...",
    addLabel: "Legg til DN",
    emptyMessage: "Ingen DN-valg.",
  },
  {
    key: "od",
    title: "OD",
    placeholder: "Ny OD...",
    addLabel: "Legg til OD",
    emptyMessage: "Ingen OD-valg.",
  },
  {
    key: "sch",
    title: "SCH",
    placeholder: "Ny SCH...",
    addLabel: "Legg til SCH",
    emptyMessage: "Ingen SCH-valg.",
  },
  {
    key: "pn",
    title: "PN",
    placeholder: "Ny PN...",
    addLabel: "Legg til PN",
    emptyMessage: "Ingen PN-valg.",
  },
  {
    key: "filler_manufacturer",
    title: "Produsent",
    placeholder: "f.eks ESAB",
    addLabel: "Legg til produsent",
    emptyMessage: "Ingen produsentvalg.",
  },
  {
    key: "filler_type",
    title: "Sveisetilsett-type",
    placeholder: "f.eks 316Lsi",
    addLabel: "Legg til type",
    emptyMessage: "Ingen sveisetilsett-typer.",
  },
  {
    key: "filler_diameter",
    title: "Diameter (mm)",
    placeholder: "f.eks 2.4",
    addLabel: "Legg til diameter",
    emptyMessage: "Ingen diametervalg.",
  },
];

type ProfileFieldDefinition = {
  key: TraceabilityProfileFieldKey;
  defaultLabel: string;
  defaultInputMode: TraceabilityProfileFieldInputMode;
  defaultOptionGroupKey: string | null;
  defaultSortOrder: number;
};

const PROFILE_FIELD_DEFINITIONS: ProfileFieldDefinition[] = [
  { key: "dn", defaultLabel: "DN", defaultInputMode: "option", defaultOptionGroupKey: "dn", defaultSortOrder: 10 },
  { key: "dn2", defaultLabel: "DN2", defaultInputMode: "option", defaultOptionGroupKey: "dn", defaultSortOrder: 20 },
  { key: "od", defaultLabel: "OD", defaultInputMode: "text", defaultOptionGroupKey: "od", defaultSortOrder: 30 },
  { key: "od2", defaultLabel: "OD2", defaultInputMode: "text", defaultOptionGroupKey: "od", defaultSortOrder: 40 },
  { key: "sch", defaultLabel: "SCH", defaultInputMode: "option", defaultOptionGroupKey: "sch", defaultSortOrder: 50 },
  {
    key: "pressure_class",
    defaultLabel: "Trykklasse",
    defaultInputMode: "option",
    defaultOptionGroupKey: "pn",
    defaultSortOrder: 60,
  },
  {
    key: "thickness",
    defaultLabel: "Tykkelse (mm)",
    defaultInputMode: "number",
    defaultOptionGroupKey: null,
    defaultSortOrder: 70,
  },
  {
    key: "filler_manufacturer",
    defaultLabel: "Produsent",
    defaultInputMode: "option",
    defaultOptionGroupKey: "filler_manufacturer",
    defaultSortOrder: 80,
  },
  {
    key: "filler_type",
    defaultLabel: "Sveisetilsett type",
    defaultInputMode: "option",
    defaultOptionGroupKey: "filler_type",
    defaultSortOrder: 90,
  },
  {
    key: "filler_diameter",
    defaultLabel: "Diameter (mm)",
    defaultInputMode: "option",
    defaultOptionGroupKey: "filler_diameter",
    defaultSortOrder: 100,
  },
  {
    key: "description",
    defaultLabel: "Beskrivelse",
    defaultInputMode: "text",
    defaultOptionGroupKey: null,
    defaultSortOrder: 110,
  },
  {
    key: "custom_dimension",
    defaultLabel: "Spesifikasjon",
    defaultInputMode: "text",
    defaultOptionGroupKey: null,
    defaultSortOrder: 120,
  },
];

const PROFILE_FIELD_ORDER = PROFILE_FIELD_DEFINITIONS.map((row) => row.key);

const PROFILE_INPUT_MODE_OPTIONS = [
  { value: "option", label: "Valgliste" },
  { value: "text", label: "Tekst" },
  { value: "number", label: "Tall" },
] as const;

const PROFILE_CERT_TYPE_OPTIONS = [
  { value: "material", label: "Material" },
  { value: "filler", label: "Sveisetilsett" },
] as const;

const PROFILE_OPTION_GROUP_OPTIONS = [
  { value: "", label: "Ingen valgliste" },
  { value: "dn", label: "DN" },
  { value: "od", label: "OD" },
  { value: "sch", label: "SCH" },
  { value: "pn", label: "PN" },
  { value: "filler_manufacturer", label: "Produsent" },
  { value: "filler_type", label: "Sveisetilsett-type" },
  { value: "filler_diameter", label: "Diameter (mm)" },
] as const;

const EMPTY_TRACE_TYPE_STATE: TraceabilityListState<TraceabilityTypeRow> = {
  loading: true,
  error: null,
  rows: [],
};

const EMPTY_TRACE_OPTION_STATE: TraceabilityListState<TraceabilityOptionRow> = {
  loading: true,
  error: null,
  rows: [],
};

const EMPTY_TRACE_OPTION_STATES: Record<TraceOptionGroupKey, TraceabilityListState<TraceabilityOptionRow>> = {
  dn: EMPTY_TRACE_OPTION_STATE,
  od: EMPTY_TRACE_OPTION_STATE,
  sch: EMPTY_TRACE_OPTION_STATE,
  pn: EMPTY_TRACE_OPTION_STATE,
  filler_manufacturer: EMPTY_TRACE_OPTION_STATE,
  filler_type: EMPTY_TRACE_OPTION_STATE,
  filler_diameter: EMPTY_TRACE_OPTION_STATE,
};

const INITIAL_TYPE_EDIT_MODAL_STATE: TraceTypeEditModalState = {
  opened: false,
  code: "",
  label: "",
  useDn: false,
  useDn2: false,
  useSch: false,
  usePressure: false,
  useThickness: false,
  useFillerType: false,
  defaultSch: "",
  defaultPressure: "",
};

const EMPTY_PROFILE_STATE: ProfileListState = {
  loading: true,
  error: null,
  rows: [],
};

function fieldDefinition(fieldKey: TraceabilityProfileFieldKey) {
  return PROFILE_FIELD_DEFINITIONS.find((item) => item.key === fieldKey);
}

function createEmptyProfileFields(): ProfileFieldEditMap {
  const fields = {} as ProfileFieldEditMap;
  PROFILE_FIELD_DEFINITIONS.forEach((definition) => {
    fields[definition.key] = {
      enabled: false,
      required: true,
      label: definition.defaultLabel,
      inputMode: definition.defaultInputMode,
      optionGroupKey: definition.defaultOptionGroupKey ?? "",
      sortOrder: String(definition.defaultSortOrder),
      defaultValue: "",
    };
  });
  return fields;
}

function createProfileModalState(row?: TraceabilityProfileRow | null, typeCodeFallback?: string): ProfileEditModalState {
  const fields = createEmptyProfileFields();
  const sourceFields = row?.fields ?? [];
  sourceFields.forEach((field) => {
    const defaults = fieldDefinition(field.field_key);
    fields[field.field_key] = {
      enabled: true,
      required: field.required,
      label: field.label || defaults?.defaultLabel || field.field_key,
      inputMode: field.input_mode,
      optionGroupKey: field.option_group_key ?? defaults?.defaultOptionGroupKey ?? "",
      sortOrder: String(field.sort_order ?? defaults?.defaultSortOrder ?? 0),
      defaultValue: field.default_value ?? "",
    };
  });

  return {
    opened: true,
    id: row?.id ?? "",
    typeCode: row?.type_code ?? typeCodeFallback ?? "",
    code: row?.code ?? "",
    label: row?.label ?? "",
    certificateType: row?.certificate_type ?? "material",
    isDefault: row?.is_default ?? false,
    isActive: row?.is_active ?? true,
    sortOrder: String(row?.sort_order ?? 0),
    fields,
  };
}

const INITIAL_PROFILE_EDIT_MODAL_STATE: ProfileEditModalState = {
  opened: false,
  id: "",
  typeCode: "",
  code: "",
  label: "",
  certificateType: "material",
  isDefault: false,
  isActive: true,
  sortOrder: "0",
  fields: createEmptyProfileFields(),
};

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function normalizeSortOrder(value: string, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed >= 0 ? parsed : fallback;
}

export function WeldingTraceabilityPanel({ refreshNonce = 0 }: WeldingTraceabilityPanelProps) {
  const [typesState, setTypesState] = useState<TraceabilityListState<TraceabilityTypeRow>>(EMPTY_TRACE_TYPE_STATE);
  const [profilesState, setProfilesState] = useState<ProfileListState>(EMPTY_PROFILE_STATE);
  const [optionStates, setOptionStates] = useState<
    Record<TraceOptionGroupKey, TraceabilityListState<TraceabilityOptionRow>>
  >(EMPTY_TRACE_OPTION_STATES);

  const [typeCode, setTypeCode] = useState("");
  const [typeLabel, setTypeLabel] = useState("");
  const [typeUseDn, setTypeUseDn] = useState(false);
  const [typeUseDn2, setTypeUseDn2] = useState(false);
  const [typeUseSch, setTypeUseSch] = useState(false);
  const [typeUsePressure, setTypeUsePressure] = useState(false);
  const [typeUseThickness, setTypeUseThickness] = useState(false);
  const [typeUseFillerType, setTypeUseFillerType] = useState(false);
  const [typeDefaultSch, setTypeDefaultSch] = useState("");
  const [typeDefaultPressure, setTypeDefaultPressure] = useState("");
  const [addingType, setAddingType] = useState(false);

  const [optionInputs, setOptionInputs] = useState<Record<TraceOptionGroupKey, string>>({
    dn: "",
    od: "",
    sch: "",
    pn: "",
    filler_manufacturer: "",
    filler_type: "",
    filler_diameter: "",
  });
  const [addingOptionGroup, setAddingOptionGroup] = useState<TraceOptionGroupKey | null>(null);
  const [optionActionKey, setOptionActionKey] = useState<string | null>(null);
  const [activeOptionTab, setActiveOptionTab] = useState<TraceOptionGroupKey>("dn");

  const [typeEditModal, setTypeEditModal] = useState<TraceTypeEditModalState>(INITIAL_TYPE_EDIT_MODAL_STATE);
  const [savingTypeEdit, setSavingTypeEdit] = useState(false);
  const [activeProfileTypeCode, setActiveProfileTypeCode] = useState("");
  const [profileEditModal, setProfileEditModal] = useState<ProfileEditModalState>(INITIAL_PROFILE_EDIT_MODAL_STATE);
  const [savingProfileEdit, setSavingProfileEdit] = useState(false);
  const [profileActionKey, setProfileActionKey] = useState<string | null>(null);

  const { confirmDelete, deleteConfirmModal } = useDeleteConfirmModal();

  const loadTypes = useCallback(async () => {
    setTypesState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await fetchTraceabilityTypes();
      setTypesState({ loading: false, error: null, rows });
    } catch (err) {
      console.error(err);
      setTypesState({
        loading: false,
        error: readErrorMessage(err, "Kunne ikke hente sporbarhetskoder."),
        rows: [],
      });
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    setProfilesState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await fetchTraceabilityProfiles();
      setProfilesState({ loading: false, error: null, rows });
    } catch (err) {
      console.error(err);
      setProfilesState({
        loading: false,
        error: readErrorMessage(err, "Kunne ikke hente sporbarhetsprofiler."),
        rows: [],
      });
    }
  }, []);

  const loadOptionGroup = useCallback(async (groupKey: TraceOptionGroupKey) => {
    setOptionStates((prev) => ({
      ...prev,
      [groupKey]: {
        ...prev[groupKey],
        loading: true,
        error: null,
      },
    }));

    try {
      const rows = await fetchTraceabilityOptions(groupKey);
      setOptionStates((prev) => ({
        ...prev,
        [groupKey]: {
          loading: false,
          error: null,
          rows,
        },
      }));
    } catch (err) {
      console.error(err);
      setOptionStates((prev) => ({
        ...prev,
        [groupKey]: {
          loading: false,
          error: readErrorMessage(err, `Kunne ikke hente valg for ${groupKey}.`),
          rows: [],
        },
      }));
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadTypes(),
      loadProfiles(),
      ...TRACEABILITY_OPTION_GROUPS.map((group) => loadOptionGroup(group.key)),
    ]);
  }, [loadOptionGroup, loadProfiles, loadTypes]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, refreshNonce]);

  useEffect(() => {
    const current = activeProfileTypeCode.trim();
    const typeCodes = typesState.rows.map((row) => row.code);
    if (current && typeCodes.includes(current)) return;

    const fromProfiles = profilesState.rows[0]?.type_code ?? "";
    const fallback = typeCodes[0] ?? fromProfiles;
    if (fallback && fallback !== current) {
      setActiveProfileTypeCode(fallback);
    }
  }, [activeProfileTypeCode, profilesState.rows, typesState.rows]);

  const resetTypeForm = useCallback(() => {
    setTypeCode("");
    setTypeLabel("");
    setTypeUseDn(false);
    setTypeUseDn2(false);
    setTypeUseSch(false);
    setTypeUsePressure(false);
    setTypeUseThickness(false);
    setTypeUseFillerType(false);
    setTypeDefaultSch("");
    setTypeDefaultPressure("");
  }, []);

  const addTraceType = useCallback(async () => {
    const code = typeCode.trim().toUpperCase();
    const label = typeLabel.trim();

    if (!code || !label) {
      toast("Fyll inn kode og beskrivelse.");
      return;
    }

    try {
      setAddingType(true);
      await upsertTraceabilityType({
        code,
        label,
        use_dn: typeUseDn,
        use_dn2: typeUseDn2,
        use_sch: typeUseSch,
        use_pressure: typeUsePressure,
        use_thickness: typeUseThickness,
        use_filler_type: typeUseFillerType,
        default_sch: typeDefaultSch.trim() || null,
        default_pressure: typeDefaultPressure.trim() || null,
      });
      resetTypeForm();
      await loadTypes();
      await loadProfiles();
      toast("Sporbarhetskode lagt til.");
    } catch (err) {
      console.error(err);
      toast(readErrorMessage(err, "Kunne ikke legge til sporbarhetskode."));
    } finally {
      setAddingType(false);
    }
  }, [
    loadProfiles,
    loadTypes,
    resetTypeForm,
    typeCode,
    typeDefaultPressure,
    typeDefaultSch,
    typeLabel,
    typeUseDn,
    typeUseDn2,
    typeUseFillerType,
    typeUsePressure,
    typeUseSch,
    typeUseThickness,
  ]);

  const openTypeEditModal = useCallback((row: TraceabilityTypeRow) => {
    setTypeEditModal({
      opened: true,
      code: row.code,
      label: row.label,
      useDn: row.use_dn,
      useDn2: row.use_dn2,
      useSch: row.use_sch,
      usePressure: row.use_pressure,
      useThickness: row.use_thickness,
      useFillerType: row.use_filler_type,
      defaultSch: row.default_sch ?? "",
      defaultPressure: row.default_pressure ?? "",
    });
  }, []);

  const closeTypeEditModal = useCallback(() => {
    setTypeEditModal(INITIAL_TYPE_EDIT_MODAL_STATE);
    setSavingTypeEdit(false);
  }, []);

  const submitTypeEditModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const code = typeEditModal.code.trim().toUpperCase();
      const label = typeEditModal.label.trim();
      if (!code || !label) {
        toast("Fyll inn kode og beskrivelse.");
        return;
      }

      try {
        setSavingTypeEdit(true);
        await upsertTraceabilityType({
          code,
          label,
          use_dn: typeEditModal.useDn,
          use_dn2: typeEditModal.useDn2,
          use_sch: typeEditModal.useSch,
          use_pressure: typeEditModal.usePressure,
          use_thickness: typeEditModal.useThickness,
          use_filler_type: typeEditModal.useFillerType,
          default_sch: typeEditModal.defaultSch.trim() || null,
          default_pressure: typeEditModal.defaultPressure.trim() || null,
        });
        closeTypeEditModal();
        await loadTypes();
        await loadProfiles();
        toast("Sporbarhetskode oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere sporbarhetskode."));
      } finally {
        setSavingTypeEdit(false);
      }
    },
    [closeTypeEditModal, loadProfiles, loadTypes, typeEditModal]
  );

  const deleteTraceTypeRow = useCallback(
    (row: TraceabilityTypeRow) => {
      confirmDelete({
        title: "Slett sporbarhetskode",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(row.code)}</b>?`,
        onConfirm: async () => {
          await deleteTraceabilityType(row.code);
        },
        onDone: async () => {
          await loadTypes();
          await loadProfiles();
          toast("Sporbarhetskode slettet.");
        },
      });
    },
    [confirmDelete, loadProfiles, loadTypes]
  );

  const addTraceabilityOption = useCallback(
    async (groupKey: TraceOptionGroupKey) => {
      const rawValue = optionInputs[groupKey].trim();
      if (!rawValue) {
        toast("Skriv inn verdi.");
        return;
      }

      try {
        setAddingOptionGroup(groupKey);
        await createTraceabilityOption({
          group_key: groupKey,
          value: rawValue,
        });
        setOptionInputs((prev) => ({
          ...prev,
          [groupKey]: "",
        }));
        await loadOptionGroup(groupKey);
        toast("Valg lagt til.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke legge til valg."));
      } finally {
        setAddingOptionGroup(null);
      }
    },
    [loadOptionGroup, optionInputs]
  );

  const deleteTraceabilityOptionRow = useCallback(
    (groupKey: TraceOptionGroupKey, row: TraceabilityOptionRow) => {
      confirmDelete({
        title: "Slett valg",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(row.value)}</b>?`,
        onConfirm: async () => {
          await deleteTraceabilityOption(row.id);
        },
        onDone: async () => {
          await loadOptionGroup(groupKey);
          toast("Valg slettet.");
        },
      });
    },
    [confirmDelete, loadOptionGroup]
  );

  const setDefaultOption = useCallback(
    async (groupKey: TraceOptionGroupKey, row: TraceabilityOptionRow) => {
      try {
        setOptionActionKey(row.id);
        await setDefaultTraceabilityOption(groupKey, row.id);
        await loadOptionGroup(groupKey);
        toast("Standardvalg oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere standardvalg."));
      } finally {
        setOptionActionKey(null);
      }
    },
    [loadOptionGroup]
  );

  const profileTypeOptions = useMemo(
    () =>
      typesState.rows.map((row) => ({
        value: row.code,
        label: `${row.code} - ${row.label}`,
      })),
    [typesState.rows]
  );

  const profilesForActiveType = useMemo(() => {
    const typeCode = activeProfileTypeCode.trim();
    if (!typeCode) return [] as TraceabilityProfileRow[];
    return profilesState.rows
      .filter((row) => row.type_code === typeCode)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.code.localeCompare(b.code, "nb", { sensitivity: "base", numeric: true });
      });
  }, [activeProfileTypeCode, profilesState.rows]);

  const updateProfileField = useCallback(
    (fieldKey: TraceabilityProfileFieldKey, patch: Partial<ProfileFieldEditState>) => {
      setProfileEditModal((current) => ({
        ...current,
        fields: {
          ...current.fields,
          [fieldKey]: {
            ...current.fields[fieldKey],
            ...patch,
          },
        },
      }));
    },
    []
  );

  const openProfileCreateModal = useCallback(() => {
    const fallbackTypeCode = activeProfileTypeCode.trim() || typesState.rows[0]?.code || "";
    if (!fallbackTypeCode) {
      toast("Opprett minst en sporbarhetskode først.");
      return;
    }
    const defaultState = createProfileModalState(null, fallbackTypeCode);
    const countForType = profilesState.rows.filter((row) => row.type_code === fallbackTypeCode).length;
    setProfileEditModal({
      ...defaultState,
      isDefault: countForType === 0,
    });
  }, [activeProfileTypeCode, profilesState.rows, typesState.rows]);

  const openProfileEditModal = useCallback((row: TraceabilityProfileRow) => {
    setProfileEditModal(createProfileModalState(row, row.type_code));
  }, []);

  const closeProfileEditModal = useCallback(() => {
    setProfileEditModal(INITIAL_PROFILE_EDIT_MODAL_STATE);
    setSavingProfileEdit(false);
  }, []);

  const submitProfileEditModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const typeCode = profileEditModal.typeCode.trim().toUpperCase();
      const code = profileEditModal.code.trim().toUpperCase();
      const label = profileEditModal.label.trim();
      if (!typeCode || !code || !label) {
        toast("Fyll inn type, profilkode og navn.");
        return;
      }

      const fieldRows: TraceabilityProfileFieldUpsertInput[] = PROFILE_FIELD_ORDER
        .filter((fieldKey) => profileEditModal.fields[fieldKey].enabled)
        .map((fieldKey) => {
          const source = profileEditModal.fields[fieldKey];
          const definition = fieldDefinition(fieldKey);
          return {
            field_key: fieldKey,
            label: source.label.trim() || definition?.defaultLabel || fieldKey,
            input_mode: source.inputMode,
            option_group_key:
              source.inputMode === "option"
                ? source.optionGroupKey.trim() || definition?.defaultOptionGroupKey || null
                : null,
            required: source.required,
            sort_order: normalizeSortOrder(source.sortOrder, definition?.defaultSortOrder ?? 0),
            default_value: source.defaultValue.trim() || null,
          };
        });

      if (fieldRows.length === 0) {
        toast("Velg minst ett felt for profilen.");
        return;
      }

      try {
        setSavingProfileEdit(true);
        const savedProfile = await upsertTraceabilityProfile({
          id: profileEditModal.id.trim() || undefined,
          type_code: typeCode,
          code,
          label,
          certificate_type: profileEditModal.certificateType,
          is_default: profileEditModal.isDefault,
          is_active: profileEditModal.isActive,
          sort_order: normalizeSortOrder(profileEditModal.sortOrder, 0),
        });

        await replaceTraceabilityProfileFields(savedProfile.id, fieldRows);
        await loadProfiles();
        setActiveProfileTypeCode(savedProfile.type_code);
        closeProfileEditModal();
        toast(profileEditModal.id ? "Profil oppdatert." : "Profil lagt til.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke lagre profil."));
      } finally {
        setSavingProfileEdit(false);
      }
    },
    [closeProfileEditModal, loadProfiles, profileEditModal]
  );

  const deleteProfileRow = useCallback(
    (row: TraceabilityProfileRow) => {
      const profilesForTypeCount = profilesState.rows.filter((item) => item.type_code === row.type_code).length;
      if (profilesForTypeCount <= 1) {
        toast("Kan ikke slette siste profil for en type.");
        return;
      }

      confirmDelete({
        title: "Slett sporbarhetsprofil",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(`${row.type_code} ${row.code}`)}</b>?`,
        onConfirm: async () => {
          await deleteTraceabilityProfile(row.id);
        },
        onDone: async () => {
          await loadProfiles();
          toast("Profil slettet.");
        },
      });
    },
    [confirmDelete, loadProfiles, profilesState.rows]
  );

  const setProfileAsDefault = useCallback(
    async (row: TraceabilityProfileRow) => {
      try {
        setProfileActionKey(row.id);
        await setDefaultTraceabilityProfile(row.type_code, row.id);
        await loadProfiles();
        toast("Standardprofil oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere standardprofil."));
      } finally {
        setProfileActionKey(null);
      }
    },
    [loadProfiles]
  );

  const renderProfileMeta = useCallback((row: TraceabilityProfileRow) => {
    const status = row.is_active ? "Aktiv" : "Inaktiv";
    const certType = row.certificate_type === "filler" ? "Sertifikat: Sveisetilsett" : "Sertifikat: Material";
    const fields = (row.fields ?? [])
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return PROFILE_FIELD_ORDER.indexOf(a.field_key) - PROFILE_FIELD_ORDER.indexOf(b.field_key);
      })
      .map((field) => `${field.label || field.field_key}${field.required ? "*" : ""}`)
      .join(", ");

    return [
      `Type ${row.type_code}`,
      certType,
      row.is_default ? "Standardprofil" : "",
      status,
      fields ? `Felt: ${fields}` : "Felt: ingen",
    ]
      .filter(Boolean)
      .join(" - ");
  }, []);

  const renderTraceTypeMeta = useCallback((row: TraceabilityTypeRow) => {
    const flags = [
      row.use_dn ? "DN" : "",
      row.use_dn2 ? "DN2" : "",
      row.use_sch ? "SCH" : "",
      row.use_pressure ? "PN" : "",
      row.use_thickness ? "Tykkelse" : "",
      row.use_filler_type ? "Tilsett-type" : "",
    ].filter(Boolean);

    const defaults = [
      row.default_sch ? `Default SCH: ${row.default_sch}` : "",
      row.default_pressure ? `Default PN: ${row.default_pressure}` : "",
    ].filter(Boolean);

    return [...defaults, flags.join(", ")].filter(Boolean).join(" - ");
  }, []);

  return (
    <>
      <WeldingCollapsiblePanel title="Sporbarhetskoder" meta="Admin">
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
          <Stack gap="md">
            <Group align="flex-end" gap="sm" wrap="wrap">
              <Box flex={1} miw={260}>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <AppTextInput placeholder="Kode" value={typeCode} onChange={setTypeCode} />
                  <AppTextInput placeholder="Beskrivelse" value={typeLabel} onChange={setTypeLabel} />
                </SimpleGrid>
              </Box>
              <AppButton tone="primary" size="sm" onClick={() => void addTraceType()} disabled={addingType}>
                Legg til
              </AppButton>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              <AppCheckbox checked={typeUseDn} onChange={setTypeUseDn} label="DN" />
              <AppCheckbox checked={typeUseDn2} onChange={setTypeUseDn2} label="DN2" />
              <AppCheckbox checked={typeUseSch} onChange={setTypeUseSch} label="SCH" />
              <AppCheckbox checked={typeUsePressure} onChange={setTypeUsePressure} label="PN" />
              <AppCheckbox checked={typeUseThickness} onChange={setTypeUseThickness} label="Tykkelse" />
              <AppCheckbox checked={typeUseFillerType} onChange={setTypeUseFillerType} label="Sveisetilsett-type" />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <AppTextInput
                placeholder="Default SCH (valgfritt)"
                value={typeDefaultSch}
                onChange={setTypeDefaultSch}
              />
              <AppTextInput
                placeholder="Default PN (valgfritt)"
                value={typeDefaultPressure}
                onChange={setTypeDefaultPressure}
              />
            </SimpleGrid>

            <Text c="dimmed" size="sm">
              Typeoppsettet under brukes som grunnlag for standardprofil. Bruk profilpanelet for detaljstyring av felt.
            </Text>

            <AppAsyncState
              loading={typesState.loading}
              error={typesState.error}
              isEmpty={typesState.rows.length === 0}
              emptyMessage="Ingen sporbarhetskoder."
            >
              <Stack gap="sm">
                {typesState.rows.map((row) => (
                  <WeldingListItem
                    key={row.code}
                    title={`${row.code} - ${row.label}`}
                    meta={renderTraceTypeMeta(row)}
                    actions={
                      <AppActionsMenu
                        items={[
                          createEditAction({
                            key: `edit-type-${row.code}`,
                            onClick: () => openTypeEditModal(row),
                          }),
                          createDeleteAction({
                            key: `delete-type-${row.code}`,
                            onClick: () => deleteTraceTypeRow(row),
                          }),
                        ]}
                      />
                    }
                  />
                ))}
              </Stack>
            </AppAsyncState>
          </Stack>

          <Stack gap="md">
            <Text fw={600}>Valg for DN / OD / SCH / PN / Sveisetilsett</Text>
            <Divider />

            <Tabs
              value={activeOptionTab}
              onChange={(value) => {
                if (!value) return;
                if (!TRACEABILITY_OPTION_GROUPS.some((group) => group.key === value)) return;
                setActiveOptionTab(value as TraceOptionGroupKey);
              }}
            >
              <Tabs.List>
                {TRACEABILITY_OPTION_GROUPS.map((group) => (
                  <Tabs.Tab key={group.key} value={group.key}>
                    {group.title} ({optionStates[group.key].rows.length})
                  </Tabs.Tab>
                ))}
              </Tabs.List>

              {TRACEABILITY_OPTION_GROUPS.map((group) => {
                const state = optionStates[group.key];
                const isAdding = addingOptionGroup === group.key;
                return (
                  <Tabs.Panel key={group.key} value={group.key} pt="md">
                    <Stack gap="sm">
                      <Group align="flex-end" gap="sm" wrap="wrap">
                        <Box flex={1} miw={260}>
                          <AppTextInput
                            label={group.title}
                            placeholder={group.placeholder}
                            value={optionInputs[group.key]}
                            onChange={(value) =>
                              setOptionInputs((prev) => ({
                                ...prev,
                                [group.key]: value,
                              }))
                            }
                          />
                        </Box>
                        <AppButton
                          tone="primary"
                          size="sm"
                          onClick={() => void addTraceabilityOption(group.key)}
                          disabled={isAdding}
                        >
                          {group.addLabel}
                        </AppButton>
                      </Group>

                      <AppAsyncState
                        loading={state.loading}
                        error={state.error}
                        isEmpty={state.rows.length === 0}
                        emptyMessage={group.emptyMessage}
                      >
                        <Stack gap="sm">
                          {state.rows.map((row) => (
                            <WeldingListItem
                              key={row.id}
                              title={row.value}
                              meta={row.is_default ? "Standard" : undefined}
                              actions={
                                <AppActionsMenu
                                  items={[
                                    {
                                      key: `default-${row.id}`,
                                      label: "Sett som standard",
                                      icon: <IconStar size={16} />,
                                      onClick: () => void setDefaultOption(group.key, row),
                                      disabled: row.is_default || optionActionKey === row.id,
                                    },
                                    createDeleteAction({
                                      key: `delete-${row.id}`,
                                      onClick: () => deleteTraceabilityOptionRow(group.key, row),
                                      disabled: optionActionKey === row.id,
                                    }),
                                  ]}
                                />
                              }
                            />
                          ))}
                        </Stack>
                      </AppAsyncState>
                    </Stack>
                  </Tabs.Panel>
                );
              })}
            </Tabs>
          </Stack>
        </SimpleGrid>
      </WeldingCollapsiblePanel>

      <WeldingCollapsiblePanel title="Sporbarhetsprofiler" meta="Admin">
        <Stack gap="md">
          <Group align="flex-end" gap="sm" wrap="wrap">
            <Box flex={1} miw={320}>
              <AppSelect
                label="Komponenttype"
                value={activeProfileTypeCode}
                onChange={setActiveProfileTypeCode}
                data={profileTypeOptions}
                allowDeselect={false}
                searchable
                disabled={typesState.loading || profileTypeOptions.length === 0}
              />
            </Box>
            <AppButton
              tone="primary"
              size="sm"
              onClick={openProfileCreateModal}
              disabled={typesState.loading || profileTypeOptions.length === 0}
            >
              Ny profil
            </AppButton>
          </Group>

          <Text c="dimmed" size="sm">
            Profilene styrer hvilke felter som brukes for hver komponenttype i sporbarhetsregistrering.
          </Text>

          <AppAsyncState
            loading={profilesState.loading}
            error={profilesState.error}
            isEmpty={profilesForActiveType.length === 0}
            emptyMessage={activeProfileTypeCode ? "Ingen profiler for valgt type." : "Velg en type først."}
          >
            <Stack gap="sm">
              {profilesForActiveType.map((row) => {
                const profilesForTypeCount = profilesState.rows.filter((item) => item.type_code === row.type_code).length;
                return (
                  <WeldingListItem
                    key={row.id}
                    title={`${row.code} - ${row.label}`}
                    meta={renderProfileMeta(row)}
                    actions={
                      <AppActionsMenu
                        items={[
                          {
                            key: `default-profile-${row.id}`,
                            label: "Sett som standard",
                            icon: <IconStar size={16} />,
                            onClick: () => void setProfileAsDefault(row),
                            disabled: row.is_default || profileActionKey === row.id,
                          },
                          createEditAction({
                            key: `edit-profile-${row.id}`,
                            onClick: () => openProfileEditModal(row),
                            disabled: profileActionKey === row.id,
                          }),
                          createDeleteAction({
                            key: `delete-profile-${row.id}`,
                            onClick: () => deleteProfileRow(row),
                            disabled: profileActionKey === row.id || profilesForTypeCount <= 1,
                          }),
                        ]}
                      />
                    }
                  />
                );
              })}
            </Stack>
          </AppAsyncState>
        </Stack>
      </WeldingCollapsiblePanel>

      <AppModal
        opened={profileEditModal.opened}
        onClose={closeProfileEditModal}
        title={profileEditModal.id ? "Endre profil" : "Ny profil"}
        busy={savingProfileEdit}
        size="xl"
      >
        <form onSubmit={submitProfileEditModal}>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <AppSelect
                label="Komponenttype"
                value={profileEditModal.typeCode}
                onChange={(value) =>
                  setProfileEditModal((current) => ({
                    ...current,
                    typeCode: value,
                  }))
                }
                data={profileTypeOptions}
                allowDeselect={false}
                searchable
                disabled={savingProfileEdit || profileTypeOptions.length === 0}
              />
              <AppSelect
                label="Sertifikat-type"
                value={profileEditModal.certificateType}
                onChange={(value) =>
                  setProfileEditModal((current) => ({
                    ...current,
                    certificateType: value === "filler" ? "filler" : "material",
                  }))
                }
                data={[...PROFILE_CERT_TYPE_OPTIONS]}
                allowDeselect={false}
                searchable={false}
                disabled={savingProfileEdit}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <AppTextInput
                label="Profilkode"
                value={profileEditModal.code}
                onChange={(value) =>
                  setProfileEditModal((current) => ({
                    ...current,
                    code: value,
                  }))
                }
                disabled={savingProfileEdit}
              />
              <AppTextInput
                label="Navn"
                value={profileEditModal.label}
                onChange={(value) =>
                  setProfileEditModal((current) => ({
                    ...current,
                    label: value,
                  }))
                }
                disabled={savingProfileEdit}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <AppNumberInput
                label="Sortering"
                value={profileEditModal.sortOrder}
                onChange={(value) =>
                  setProfileEditModal((current) => ({
                    ...current,
                    sortOrder: value,
                  }))
                }
                disabled={savingProfileEdit}
              />
              <Group gap="md" align="center" mt="xl">
                <AppCheckbox
                  checked={profileEditModal.isDefault}
                  onChange={(checked) =>
                    setProfileEditModal((current) => ({
                      ...current,
                      isDefault: checked,
                    }))
                  }
                  label="Standardprofil"
                  disabled={savingProfileEdit}
                />
                <AppCheckbox
                  checked={profileEditModal.isActive}
                  onChange={(checked) =>
                    setProfileEditModal((current) => ({
                      ...current,
                      isActive: checked,
                    }))
                  }
                  label="Aktiv"
                  disabled={savingProfileEdit}
                />
              </Group>
            </SimpleGrid>

            <Divider />

            <Stack gap="sm">
              <Text fw={600}>Felt i profil</Text>
              {PROFILE_FIELD_DEFINITIONS.map((definition) => {
                const field = profileEditModal.fields[definition.key];
                const inputModeValue = field.inputMode;
                return (
                  <Paper key={definition.key} withBorder radius="md" p="sm">
                    <Stack gap="sm">
                      <Group gap="md" wrap="wrap">
                        <AppCheckbox
                          checked={field.enabled}
                          onChange={(checked) => {
                            updateProfileField(definition.key, { enabled: checked });
                          }}
                          label={definition.defaultLabel}
                          disabled={savingProfileEdit}
                        />
                        <AppCheckbox
                          checked={field.required}
                          onChange={(checked) => updateProfileField(definition.key, { required: checked })}
                          label="Påkrevd"
                          disabled={savingProfileEdit || !field.enabled}
                        />
                      </Group>

                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                        <AppTextInput
                          label="Label"
                          value={field.label}
                          onChange={(value) => updateProfileField(definition.key, { label: value })}
                          disabled={savingProfileEdit || !field.enabled}
                        />
                        <AppSelect
                          label="Input"
                          value={inputModeValue}
                          onChange={(value) =>
                            updateProfileField(definition.key, {
                              inputMode:
                                value === "option" || value === "number" ? value : "text",
                              optionGroupKey:
                                value === "option"
                                  ? field.optionGroupKey || definition.defaultOptionGroupKey || ""
                                  : "",
                            })
                          }
                          data={[...PROFILE_INPUT_MODE_OPTIONS]}
                          allowDeselect={false}
                          searchable={false}
                          disabled={savingProfileEdit || !field.enabled}
                        />
                      </SimpleGrid>

                      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                        <AppSelect
                          label="Valggruppe"
                          value={field.optionGroupKey}
                          onChange={(value) => updateProfileField(definition.key, { optionGroupKey: value })}
                          data={[...PROFILE_OPTION_GROUP_OPTIONS]}
                          allowDeselect={false}
                          searchable={false}
                          disabled={savingProfileEdit || !field.enabled || field.inputMode !== "option"}
                        />
                        <AppNumberInput
                          label="Sortering"
                          value={field.sortOrder}
                          onChange={(value) => updateProfileField(definition.key, { sortOrder: value })}
                          disabled={savingProfileEdit || !field.enabled}
                        />
                        <AppTextInput
                          label="Defaultverdi"
                          value={field.defaultValue}
                          onChange={(value) => updateProfileField(definition.key, { defaultValue: value })}
                          disabled={savingProfileEdit || !field.enabled}
                        />
                      </SimpleGrid>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>

            <AppModalActions
              onCancel={closeProfileEditModal}
              cancelDisabled={savingProfileEdit}
              confirmLabel="Lagre profil"
              confirmType="submit"
              confirmLoading={savingProfileEdit}
            />
          </Stack>
        </form>
      </AppModal>

      <AppModal
        opened={typeEditModal.opened}
        onClose={closeTypeEditModal}
        title="Endre sporbarhetskode"
        busy={savingTypeEdit}
      >
        <form onSubmit={submitTypeEditModal}>
          <AppTextInput label="Kode" value={typeEditModal.code} disabled />
          <AppTextInput
            mt="sm"
            label="Beskrivelse"
            value={typeEditModal.label}
            onChange={(value) =>
              setTypeEditModal((current) => ({
                ...current,
                label: value,
              }))
            }
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="sm">
            <AppCheckbox
              checked={typeEditModal.useDn}
              onChange={(checked) =>
                setTypeEditModal((current) => ({
                  ...current,
                  useDn: checked,
                }))
              }
              label="DN"
            />
            <AppCheckbox
              checked={typeEditModal.useDn2}
              onChange={(checked) =>
                setTypeEditModal((current) => ({
                  ...current,
                  useDn2: checked,
                }))
              }
              label="DN2"
            />
            <AppCheckbox
              checked={typeEditModal.useSch}
              onChange={(checked) =>
                setTypeEditModal((current) => ({
                  ...current,
                  useSch: checked,
                }))
              }
              label="SCH"
            />
            <AppCheckbox
              checked={typeEditModal.usePressure}
              onChange={(checked) =>
                setTypeEditModal((current) => ({
                  ...current,
                  usePressure: checked,
                }))
              }
              label="PN"
            />
            <AppCheckbox
              checked={typeEditModal.useThickness}
              onChange={(checked) =>
                setTypeEditModal((current) => ({
                  ...current,
                  useThickness: checked,
                }))
              }
              label="Tykkelse"
            />
            <AppCheckbox
              checked={typeEditModal.useFillerType}
              onChange={(checked) =>
                setTypeEditModal((current) => ({
                  ...current,
                  useFillerType: checked,
                }))
              }
              label="Sveisetilsett-type"
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="sm">
            <AppTextInput
              label="Default SCH"
              value={typeEditModal.defaultSch}
              onChange={(value) =>
                setTypeEditModal((current) => ({
                  ...current,
                  defaultSch: value,
                }))
              }
            />
            <AppTextInput
              label="Default PN"
              value={typeEditModal.defaultPressure}
              onChange={(value) =>
                setTypeEditModal((current) => ({
                  ...current,
                  defaultPressure: value,
                }))
              }
            />
          </SimpleGrid>

          <AppModalActions
            onCancel={closeTypeEditModal}
            cancelDisabled={savingTypeEdit}
            confirmLabel="Lagre"
            confirmType="submit"
            confirmLoading={savingTypeEdit}
          />
        </form>
      </AppModal>

      {deleteConfirmModal}
    </>
  );
}

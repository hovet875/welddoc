import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/services/supabaseClient";
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
import { openConfirmDelete } from "@/ui/confirm";
import { modalSaveButton, openModal, renderModal } from "@/ui/modal";
import { toast } from "@/ui/toast";
import { esc } from "@/utils/dom";
import { useAuth } from "../../../../auth/AuthProvider";
import { AppFooter } from "../../../../layout/AppFooter";
import { AppHeader } from "../../../../layout/AppHeader";
import { CompanySettingsHeader } from "../components/CompanySettingsHeader";
import { useWeldingData } from "./hooks/useWeldingData";
import { PencilIcon, TrashIcon } from "./components/WeldingActionIcons";
import { WeldingCollapsiblePanel } from "./components/WeldingCollapsiblePanel";

const STANDARD_TYPES = [
  "Sveisesertifisering",
  "Sveiseprosedyreproving",
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

function renderStandardTypeOptions(selected: string | null) {
  const options = [`<option value="">Velg type...</option>`];
  for (const type of STANDARD_TYPES) {
    options.push(
      `<option value="${esc(type)}" ${selected === type ? "selected" : ""}>${esc(type)}</option>`
    );
  }
  if (selected && !STANDARD_TYPES.includes(selected as (typeof STANDARD_TYPES)[number])) {
    options.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
  }
  return options.join("");
}

function renderRevisionOptions(selected: number | null) {
  const year = new Date().getFullYear();
  const options = [`<option value="">Ingen revisjon</option>`];
  for (let i = 0; i <= 30; i += 1) {
    const value = String(year - i);
    options.push(
      `<option value="${esc(value)}" ${selected === Number(value) ? "selected" : ""}>${esc(value)}</option>`
    );
  }
  if (selected != null && !options.some((item) => item.includes(`value="${selected}"`))) {
    options.push(`<option value="${esc(String(selected))}" selected>${esc(String(selected))}</option>`);
  }
  return options.join("");
}

async function countReferences(table: string, column: string, value: string) {
  const result = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (result.error) throw result.error;
  return result.count ?? 0;
}

type ConfirmDeleteArgs = {
  title: string;
  messageHtml: string;
  onConfirm: () => Promise<void>;
  onDone: () => Promise<void>;
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

  const modalMountRef = useRef<HTMLDivElement | null>(null);
  const modalControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    modalControllerRef.current = controller;
    return () => {
      controller.abort();
      modalControllerRef.current = null;
    };
  }, []);

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

  const renderNdtStandardOptions = useCallback(
    (selected?: string | null) => {
      const options = [`<option value="">Standard (valgfritt)...</option>`];
      for (const option of standardOptions) {
        const isSelected = selected && selected === option.id;
        options.push(
          `<option value="${esc(option.id)}" ${isSelected ? "selected" : ""}>${esc(option.label)}</option>`
        );
      }
      if (selected && !standardOptions.some((option) => option.id === selected)) {
        options.push(`<option value="${esc(selected)}" selected>${esc(selected)}</option>`);
      }
      return options.join("");
    },
    [standardOptions]
  );

  const confirmDelete = useCallback(({ title, messageHtml, onConfirm, onDone }: ConfirmDeleteArgs) => {
    const mount = modalMountRef.current;
    const signal = modalControllerRef.current?.signal;
    if (!mount || !signal) return;
    void openConfirmDelete(mount, signal, { title, messageHtml, onConfirm, onDone });
  }, []);

  const openFmGroupsModal = useCallback(async (standard: StandardRow) => {
    const mount = modalMountRef.current;
    const signal = modalControllerRef.current?.signal;
    if (!mount || !signal) return;

    const modalHtml = renderModal(
      `FM-grupper - ${esc(standard.label)}`,
      `
        <div class="settings-form">
          <div class="settings-row inline">
            <input data-fm-input class="input" type="text" placeholder="Ny FM-gruppe..." />
            <button data-fm-add class="btn primary small" type="button">Legg til</button>
          </div>
          <div data-fm-list class="settings-list"><div class="muted">Laster...</div></div>
        </div>
      `,
      "Ferdig"
    );

    const handle = openModal(mount, modalHtml, signal);
    const listEl = handle.root.querySelector<HTMLDivElement>("[data-fm-list]");
    const inputEl = handle.root.querySelector<HTMLInputElement>("[data-fm-input]");
    const addBtn = handle.root.querySelector<HTMLButtonElement>("[data-fm-add]");
    if (!listEl || !inputEl || !addBtn) return;

    const doneBtn = modalSaveButton(handle.root);
    doneBtn.addEventListener("click", () => handle.close(), { signal });

    const renderRows = (rows: StandardFmGroupRow[]) => {
      if (rows.length === 0) {
        listEl.innerHTML = `<div class="muted">Ingen FM-grupper.</div>`;
        return;
      }

      listEl.innerHTML = rows
        .map(
          (row) => `
            <div class="settings-item" data-fm-id="${esc(row.id)}">
              <div class="settings-item__title">${esc(row.label)}</div>
              <div class="settings-item__meta"></div>
              <div class="settings-item__actions">
                <button class="iconbtn small" type="button" data-fm-edit title="Endre" aria-label="Endre">
                  <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
                    <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L8.25 18.463 3 19.5l1.037-5.25L16.862 3.487zM5.39 17.11l2.872-.566L18.98 5.826l-2.306-2.306L5.956 14.238l-.566 2.872z"/>
                  </svg>
                </button>
                <button class="iconbtn small danger" type="button" data-fm-delete title="Slett" aria-label="Slett">
                  <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
                    <path fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H5.5a1 1 0 1 0 0 2H6v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h.5a1 1 0 1 0 0-2H16V4a1 1 0 0 0-1-1H9zm1 2h4V4h-4v1zm-1 5a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1z"/>
                  </svg>
                </button>
              </div>
            </div>
          `
        )
        .join("");
    };

    const loadRows = async () => {
      listEl.innerHTML = `<div class="muted">Laster...</div>`;
      try {
        const rows = await fetchStandardFmGroups(standard.id);
        renderRows(rows);
      } catch (err) {
        listEl.innerHTML = `<div class="err">Feil: ${esc(readErrorMessage(err, "Kunne ikke hente FM-grupper."))}</div>`;
      }
    };

    addBtn.addEventListener(
      "click",
      async () => {
        const label = inputEl.value.trim();
        if (!label) {
          toast("Skriv inn FM-gruppe.");
          return;
        }

        try {
          addBtn.disabled = true;
          await createStandardFmGroup({ standard_id: standard.id, label });
          inputEl.value = "";
          await loadRows();
          toast("FM-gruppe lagt til.");
        } catch (err) {
          console.error(err);
          toast(readErrorMessage(err, "Kunne ikke legge til FM-gruppe."));
        } finally {
          addBtn.disabled = false;
        }
      },
      { signal }
    );

    listEl.addEventListener(
      "click",
      async (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;

        const item = target.closest<HTMLElement>("[data-fm-id]");
        if (!item) return;

        const id = item.getAttribute("data-fm-id") ?? "";
        if (!id) return;

        if (target.closest("[data-fm-delete]")) {
          const title = item.querySelector(".settings-item__title")?.textContent?.trim() ?? "FM-gruppen";
          const confirmed = window.confirm(`Slette ${title}?`);
          if (!confirmed) return;

          try {
            await deleteStandardFmGroup(id);
            await loadRows();
            toast("FM-gruppe slettet.");
          } catch (err) {
            console.error(err);
            toast(readErrorMessage(err, "Kunne ikke slette FM-gruppe."));
          }
          return;
        }

        if (target.closest("[data-fm-edit]")) {
          const current = item.querySelector(".settings-item__title")?.textContent?.trim() ?? "";
          const next = window.prompt("Endre FM-gruppe", current) ?? "";
          const label = next.trim();
          if (!label || label === current) return;

          try {
            await updateStandardFmGroup(id, { label });
            await loadRows();
            toast("Oppdatert.");
          } catch (err) {
            console.error(err);
            toast(readErrorMessage(err, "Kunne ikke oppdatere FM-gruppe."));
          }
        }
      },
      { signal }
    );

    await loadRows();
  }, []);

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
      const mount = modalMountRef.current;
      const signal = modalControllerRef.current?.signal;
      if (!mount || !signal) return;

      const modalHtml = renderModal(
        "Endre materiale",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Materialnavn</label>
              <input data-f="name" class="input" type="text" value="${esc(row.name)}" />
            </div>
            <div class="field">
              <label>Materialkode</label>
              <input data-f="code" class="input" type="text" value="${esc(row.material_code)}" />
            </div>
            <div class="field">
              <label>Materialgruppe</label>
              <input data-f="group" class="input" type="text" value="${esc(row.material_group)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const handle = openModal(mount, modalHtml, signal);
      const save = modalSaveButton(handle.root);

      save.addEventListener(
        "click",
        async () => {
          try {
            save.disabled = true;
            save.textContent = "Lagrer...";

            const nextName =
              handle.root.querySelector<HTMLInputElement>("[data-f=name]")?.value.trim() ?? "";
            const nextCode =
              handle.root.querySelector<HTMLInputElement>("[data-f=code]")?.value.trim() ?? "";
            const nextGroup =
              handle.root.querySelector<HTMLInputElement>("[data-f=group]")?.value.trim() ?? "";

            if (!nextName || !nextCode || !nextGroup) {
              toast("Fyll inn navn, kode og gruppe.");
              return;
            }

            await updateMaterial(row.id, {
              name: nextName,
              material_code: nextCode,
              material_group: nextGroup,
            });

            handle.close();
            await reloadMaterials();
            toast("Oppdatert.");
          } catch (err) {
            console.error(err);
            toast(readErrorMessage(err, "Kunne ikke oppdatere materiale."));
          } finally {
            save.disabled = false;
            save.textContent = "Lagre";
          }
        },
        { signal }
      );
    },
    [reloadMaterials]
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
          messageHtml: `Er du sikker pa at du vil slette <b>${esc(materialLabel(row))}</b>?`,
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
      const mount = modalMountRef.current;
      const signal = modalControllerRef.current?.signal;
      if (!mount || !signal) return;

      const modalHtml = renderModal(
        "Endre standard",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Standardnavn</label>
              <input data-f="label" class="input" type="text" value="${esc(row.label)}" />
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Beskrivelse</label>
              <input data-f="description" class="input" type="text" value="${esc(row.description ?? "")}" />
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Type</label>
              <select data-f="type" class="select">${renderStandardTypeOptions(row.type ?? null)}</select>
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Revisjon</label>
              <select data-f="revision" class="select">${renderRevisionOptions(row.revision ?? null)}</select>
            </div>
          </div>
        `,
        "Lagre"
      );

      const handle = openModal(mount, modalHtml, signal);
      const save = modalSaveButton(handle.root);

      save.addEventListener(
        "click",
        async () => {
          try {
            save.disabled = true;
            save.textContent = "Lagrer...";

            const nextLabel =
              handle.root.querySelector<HTMLInputElement>("[data-f=label]")?.value.trim() ?? "";
            const nextDescription =
              handle.root.querySelector<HTMLInputElement>("[data-f=description]")?.value.trim() ?? "";
            const nextType =
              handle.root.querySelector<HTMLSelectElement>("[data-f=type]")?.value.trim() ?? "";
            const revisionRaw =
              handle.root.querySelector<HTMLSelectElement>("[data-f=revision]")?.value.trim() ?? "";
            const revision = revisionRaw ? Number.parseInt(revisionRaw, 10) : null;

            if (!nextLabel) {
              toast("Fyll inn navn.");
              return;
            }

            await updateStandard(row.id, {
              label: nextLabel,
              description: nextDescription || null,
              type: nextType || null,
              revision: revision && Number.isFinite(revision) ? revision : null,
            });

            handle.close();
            await reloadStandards();
            toast("Oppdatert.");
          } catch (err) {
            console.error(err);
            toast(readErrorMessage(err, "Kunne ikke oppdatere standard."));
          } finally {
            save.disabled = false;
            save.textContent = "Lagre";
          }
        },
        { signal }
      );
    },
    [reloadStandards]
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
    async (row: StandardRow) => {
      await openFmGroupsModal(row);
      await reloadStandards();
    },
    [openFmGroupsModal, reloadStandards]
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
      const mount = modalMountRef.current;
      const signal = modalControllerRef.current?.signal;
      if (!mount || !signal) return;

      const modalHtml = renderModal(
        "Endre NDT-metode",
        `
          <div class="modalgrid">
            <div class="field">
              <label>Kode</label>
              <input data-f="code" class="input" type="text" value="${esc(row.code)}" />
            </div>
            <div class="field">
              <label>Navn</label>
              <input data-f="label" class="input" type="text" value="${esc(row.label)}" />
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Beskrivelse</label>
              <input data-f="description" class="input" type="text" value="${esc(row.description ?? "")}" />
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Standard (valgfritt)</label>
              <select data-f="standard_id" class="select">
                ${renderNdtStandardOptions(row.standard_id ?? null)}
              </select>
            </div>
          </div>
        `,
        "Lagre"
      );

      const handle = openModal(mount, modalHtml, signal);
      const save = modalSaveButton(handle.root);

      save.addEventListener(
        "click",
        async () => {
          try {
            save.disabled = true;
            save.textContent = "Lagrer...";

            const code =
              handle.root.querySelector<HTMLInputElement>("[data-f=code]")?.value.trim().toUpperCase() ?? "";
            const label =
              handle.root.querySelector<HTMLInputElement>("[data-f=label]")?.value.trim() ?? "";
            const description =
              handle.root.querySelector<HTMLInputElement>("[data-f=description]")?.value.trim() ?? "";
            const standardId =
              handle.root.querySelector<HTMLSelectElement>("[data-f=standard_id]")?.value.trim() || null;

            if (!code || !label) {
              toast("Fyll inn kode og navn.");
              return;
            }

            await updateNdtMethod(row.id, {
              code,
              label,
              description: description || null,
              standard_id: standardId,
            });

            handle.close();
            await reloadNdtMethods();
            toast("Oppdatert.");
          } catch (err) {
            console.error(err);
            toast(readErrorMessage(err, "Kunne ikke oppdatere NDT-metode."));
          } finally {
            save.disabled = false;
            save.textContent = "Lagre";
          }
        },
        { signal }
      );
    },
    [reloadNdtMethods, renderNdtStandardOptions]
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
      const mount = modalMountRef.current;
      const signal = modalControllerRef.current?.signal;
      if (!mount || !signal) return;

      const modalHtml = renderModal(
        "Endre sveiseprosess",
        `
          <div class="modalgrid">
            <div class="field">
              <label>Kode</label>
              <input data-f="code" class="input" type="text" value="${esc(String(row.code ?? ""))}" />
            </div>
            <div class="field">
              <label>Beskrivelse</label>
              <input data-f="label" class="input" type="text" value="${esc(row.label)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const handle = openModal(mount, modalHtml, signal);
      const save = modalSaveButton(handle.root);

      save.addEventListener(
        "click",
        async () => {
          try {
            save.disabled = true;
            save.textContent = "Lagrer...";

            const code =
              handle.root.querySelector<HTMLInputElement>("[data-f=code]")?.value.trim() ?? "";
            const label =
              handle.root.querySelector<HTMLInputElement>("[data-f=label]")?.value.trim() ?? "";

            if (!code || !label) {
              toast("Fyll inn kode og beskrivelse.");
              return;
            }
            if (!PROCESS_CODE_PATTERN.test(code)) {
              toast("Kode ma vare 2-4 siffer.");
              return;
            }

            await updateWeldingProcess(row.id, { code, label });
            handle.close();
            await reloadProcesses();
            toast("Oppdatert.");
          } catch (err) {
            console.error(err);
            toast(readErrorMessage(err, "Kunne ikke oppdatere sveiseprosess."));
          } finally {
            save.disabled = false;
            save.textContent = "Lagre";
          }
        },
        { signal }
      );
    },
    [reloadProcesses]
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
      const mount = modalMountRef.current;
      const signal = modalControllerRef.current?.signal;
      if (!mount || !signal) return;

      const modalHtml = renderModal(
        "Endre sveisefuge",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Fugetype</label>
              <input data-f="label" class="input" type="text" value="${esc(row.label)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const handle = openModal(mount, modalHtml, signal);
      const save = modalSaveButton(handle.root);

      save.addEventListener(
        "click",
        async () => {
          try {
            save.disabled = true;
            save.textContent = "Lagrer...";

            const label =
              handle.root.querySelector<HTMLInputElement>("[data-f=label]")?.value.trim().toUpperCase() ?? "";
            if (!label) {
              toast("Skriv inn fugetype.");
              return;
            }

            await updateWeldJointType(row.id, label);
            handle.close();
            await reloadJointTypes();
            toast("Oppdatert.");
          } catch (err) {
            console.error(err);
            toast(readErrorMessage(err, "Kunne ikke oppdatere sveisefuge."));
          } finally {
            save.disabled = false;
            save.textContent = "Lagre";
          }
        },
        { signal }
      );
    },
    [reloadJointTypes]
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
      <div className="shell page-company-settings">
        <AppHeader displayName={displayName} email={email} />
        <main className="main">
          <CompanySettingsHeader
            title="App-parametere - Teknisk / Sveising"
            subtitle="Kun admin har tilgang."
            backTo="/settings/company"
            backLabel="<- App-parametere"
          />
          <div className="muted" style={{ padding: 16 }}>
            Kun admin har tilgang.
          </div>
        </main>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="shell page-company-settings">
      <AppHeader displayName={displayName} email={email} />

      <main className="main">
        <CompanySettingsHeader
          title="App-parametere - Teknisk / Sveising"
          subtitle="Materialer, standarder, NDT-metoder, sveiseprosesser og sveisefuger."
          backTo="/settings/company"
          backLabel="<- App-parametere"
          actions={
            <button className="btn small" type="button" disabled={isRefreshing} onClick={() => void reloadAll()}>
              Oppdater
            </button>
          }
        />

        <section className="section-grid">
          <WeldingCollapsiblePanel title="Materialer" meta="Admin">
            <div className="settings-form">
              <div className="settings-row inline">
                <div className="settings-inputs">
                  <input
                    className="input"
                    type="text"
                    placeholder="Materialnavn..."
                    value={materialName}
                    onChange={(event) => setMaterialName(event.target.value)}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Materialkode..."
                    value={materialCode}
                    onChange={(event) => setMaterialCode(event.target.value)}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Materialgruppe..."
                    value={materialGroup}
                    onChange={(event) => setMaterialGroup(event.target.value)}
                  />
                </div>
                <button className="btn primary small" type="button" disabled={addingMaterial} onClick={() => void addMaterial()}>
                  Legg til
                </button>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Vises som "Navn (kode) - gruppe".
              </div>
              <div className="settings-list">
                {materials.loading ? <div className="muted">Laster...</div> : null}
                {!materials.loading && materials.error ? <div className="err">Feil: {materials.error}</div> : null}
                {!materials.loading && !materials.error && materials.rows.length === 0 ? (
                  <div className="muted">Ingen materialer.</div>
                ) : null}
                {!materials.loading && !materials.error
                  ? materials.rows.map((row) => (
                      <div key={row.id} className="settings-item">
                        <div className="settings-item__title">{materialLabel(row)}</div>
                        <div className="settings-item__meta"></div>
                        <div className="settings-item__actions">
                          <button
                            className="iconbtn small"
                            type="button"
                            title="Endre"
                            onClick={() => openMaterialEditModal(row)}
                          >
                            <PencilIcon />
                          </button>
                          <button
                            className="iconbtn small danger"
                            type="button"
                            title="Slett"
                            onClick={() => void deleteMaterialRow(row)}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </WeldingCollapsiblePanel>

          <WeldingCollapsiblePanel title="Standarder" meta="Admin">
            <div className="settings-form">
              <div className="settings-row inline">
                <div className="settings-inputs">
                  <select
                    className="select"
                    value={standardType}
                    onChange={(event) => setStandardType(event.target.value)}
                  >
                    <option value="">Velg type...</option>
                    {STANDARD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="text"
                    placeholder="Standardnavn... (f.eks NS-ISO 9606-1)"
                    value={standardLabel}
                    onChange={(event) => setStandardLabel(event.target.value)}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Beskrivelse..."
                    value={standardDescription}
                    onChange={(event) => setStandardDescription(event.target.value)}
                  />
                  <select
                    className="select"
                    value={standardRevision}
                    onChange={(event) => setStandardRevision(event.target.value)}
                  >
                    <option value="">Ingen revisjon</option>
                    {Array.from({ length: 31 }, (_, i) => {
                      const year = String(new Date().getFullYear() - i);
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button className="btn primary small" type="button" disabled={addingStandard} onClick={() => void addStandard()}>
                  Legg til
                </button>
              </div>

              <div className="settings-list">
                {standards.loading ? <div className="muted">Laster...</div> : null}
                {!standards.loading && standards.error ? <div className="err">Feil: {standards.error}</div> : null}
                {!standards.loading && !standards.error && standards.rows.length === 0 ? (
                  <div className="muted">Ingen standarder.</div>
                ) : null}
                {!standards.loading && !standards.error
                  ? standards.rows.map((row) => {
                      const meta = [row.type, row.description].filter(Boolean).join(" - ");
                      return (
                        <div key={row.id} className="settings-item">
                          <div className="settings-item__title">{standardLabelText(row)}</div>
                          <div className="settings-item__meta">{meta}</div>
                          <div className="settings-item__actions">
                            {row.has_fm_group ? (
                              <button className="btn small" type="button" onClick={() => void openStandardFmModal(row)}>
                                FM-grupper
                              </button>
                            ) : null}
                            <button
                              className="iconbtn small"
                              type="button"
                              title="Endre"
                              onClick={() => openStandardEditModal(row)}
                            >
                              <PencilIcon />
                            </button>
                            <button
                              className="iconbtn small danger"
                              type="button"
                              title="Slett"
                              onClick={() => void deleteStandardRow(row)}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  : null}
              </div>
            </div>
          </WeldingCollapsiblePanel>

          <WeldingCollapsiblePanel title="NDT-metoder" meta="Admin">
            <div className="settings-form">
              <div className="settings-row inline">
                <div className="settings-inputs">
                  <input
                    className="input"
                    type="text"
                    placeholder="Kode... (f.eks RT)"
                    value={ndtCode}
                    onChange={(event) => setNdtCode(event.target.value)}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Navn..."
                    value={ndtLabel}
                    onChange={(event) => setNdtLabel(event.target.value)}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Beskrivelse..."
                    value={ndtDescription}
                    onChange={(event) => setNdtDescription(event.target.value)}
                  />
                  <select
                    className="select"
                    value={ndtStandardId}
                    onChange={(event) => setNdtStandardId(event.target.value)}
                  >
                    <option value="">Standard (valgfritt)...</option>
                    {standardOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn primary small"
                  type="button"
                  disabled={addingNdtMethod}
                  onClick={() => void addNdtMethod()}
                >
                  Legg til
                </button>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                NDT-metoder brukes i sertifikater og rapporter.
              </div>

              <div className="settings-list">
                {ndtMethods.loading ? <div className="muted">Laster...</div> : null}
                {!ndtMethods.loading && ndtMethods.error ? <div className="err">Feil: {ndtMethods.error}</div> : null}
                {!ndtMethods.loading && !ndtMethods.error && ndtMethods.rows.length === 0 ? (
                  <div className="muted">Ingen NDT-metoder.</div>
                ) : null}
                {!ndtMethods.loading && !ndtMethods.error
                  ? ndtMethods.rows.map((row) => {
                      const meta = [row.description, row.standard ? standardLabelText(row.standard) : null]
                        .filter(Boolean)
                        .join(" - ");
                      return (
                        <div key={row.id} className="settings-item">
                          <div className="settings-item__title">
                            {row.code} - {row.label}
                          </div>
                          <div className="settings-item__meta">{meta}</div>
                          <div className="settings-item__actions">
                            <button
                              className="iconbtn small"
                              type="button"
                              title="Endre"
                              onClick={() => openNdtMethodEditModal(row)}
                            >
                              <PencilIcon />
                            </button>
                            <button
                              className="iconbtn small danger"
                              type="button"
                              title="Slett"
                              onClick={() => void deleteNdtMethodRow(row)}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  : null}
              </div>
            </div>
          </WeldingCollapsiblePanel>

          <WeldingCollapsiblePanel title="Sveiseprosesser" meta="Admin">
            <div className="settings-form">
              <div className="settings-row inline">
                <div className="settings-inputs" style={{ gridTemplateColumns: "120px 1fr" }}>
                  <input
                    className="input"
                    type="text"
                    placeholder="Kode... (f.eks 141)"
                    value={processCode}
                    onChange={(event) => setProcessCode(event.target.value)}
                  />
                  <input
                    className="input"
                    type="text"
                    placeholder="Beskrivelse... (f.eks TIG-sveis)"
                    value={processLabel}
                    onChange={(event) => setProcessLabel(event.target.value)}
                  />
                </div>
                <button className="btn primary small" type="button" disabled={addingProcess} onClick={() => void addProcess()}>
                  Legg til
                </button>
              </div>

              <div className="settings-list">
                {processes.loading ? <div className="muted">Laster...</div> : null}
                {!processes.loading && processes.error ? <div className="err">Feil: {processes.error}</div> : null}
                {!processes.loading && !processes.error && processes.rows.length === 0 ? (
                  <div className="muted">Ingen sveiseprosesser.</div>
                ) : null}
                {!processes.loading && !processes.error
                  ? processes.rows.map((row) => (
                      <div key={row.id} className="settings-item">
                        <div className="settings-item__title">{processLabelText(row)}</div>
                        <div className="settings-item__meta"></div>
                        <div className="settings-item__actions">
                          <button
                            className="iconbtn small"
                            type="button"
                            title="Endre"
                            onClick={() => openProcessEditModal(row)}
                          >
                            <PencilIcon />
                          </button>
                          <button
                            className="iconbtn small danger"
                            type="button"
                            title="Slett"
                            onClick={() => void deleteProcessRow(row)}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </WeldingCollapsiblePanel>

          <WeldingCollapsiblePanel title="Sveisefuger" meta="Admin">
            <div className="settings-form">
              <div className="settings-row inline">
                <input
                  className="input"
                  type="text"
                  placeholder="Ny fugetype... (f.eks BW eller FW)"
                  value={jointTypeLabel}
                  onChange={(event) => setJointTypeLabel(event.target.value)}
                />
                <button
                  className="btn primary small"
                  type="button"
                  disabled={addingJointType}
                  onClick={() => void addJointType()}
                >
                  Legg til
                </button>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Brukes i dropdown for fugetype i WPS/WPQR.
              </div>

              <div className="settings-list">
                {jointTypes.loading ? <div className="muted">Laster...</div> : null}
                {!jointTypes.loading && jointTypes.error ? <div className="err">Feil: {jointTypes.error}</div> : null}
                {!jointTypes.loading && !jointTypes.error && jointTypes.rows.length === 0 ? (
                  <div className="muted">Ingen sveisefuger.</div>
                ) : null}
                {!jointTypes.loading && !jointTypes.error
                  ? jointTypes.rows.map((row) => (
                      <div key={row.id} className="settings-item">
                        <div className="settings-item__title">{row.label}</div>
                        <div className="settings-item__meta"></div>
                        <div className="settings-item__actions">
                          <button
                            className="iconbtn small"
                            type="button"
                            title="Endre"
                            onClick={() => openJointTypeEditModal(row)}
                          >
                            <PencilIcon />
                          </button>
                          <button
                            className="iconbtn small danger"
                            type="button"
                            title="Slett"
                            onClick={() => void deleteJointTypeRow(row)}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </WeldingCollapsiblePanel>

          <WeldingCollapsiblePanel title="Avanserte innstillinger" meta="Midlertidig legacy">
            <div className="settings-form">
              <div className="muted">
                Sveisesertifikat-scope og materialsporbarhet er neste steg i migreringen.
              </div>
              <div className="settings-actions">
                <Link className="btn small" to="/legacy/company-settings/welding">
                  Apne legacy-side
                </Link>
              </div>
            </div>
          </WeldingCollapsiblePanel>
        </section>

        <div ref={modalMountRef}></div>
      </main>

      <AppFooter />
    </div>
  );
}

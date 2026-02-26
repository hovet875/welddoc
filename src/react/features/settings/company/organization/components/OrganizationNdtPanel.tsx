import { useEffect, useMemo, useState } from "react";
import { toast } from "../../../../../../ui/toast";
import type { NdtInspectorRow, NdtSupplierRow } from "../../../../../../repo/ndtSupplierRepo";
import type { OrganizationListState } from "../organization.types";
import { PencilIcon, TrashIcon } from "./OrganizationActionIcons";
import { OrganizationCollapsiblePanel } from "./OrganizationCollapsiblePanel";

type OrganizationNdtPanelProps = {
  suppliersState: OrganizationListState<NdtSupplierRow>;
  inspectorsState: OrganizationListState<NdtInspectorRow>;
  onAddSupplier: (name: string) => Promise<void>;
  onAddInspector: (supplierId: string, name: string) => Promise<void>;
  onEditSupplier: (supplier: NdtSupplierRow) => void;
  onDeleteSupplier: (supplier: NdtSupplierRow) => void;
  onEditInspector: (inspector: NdtInspectorRow) => void;
  onDeleteInspector: (inspector: NdtInspectorRow) => void;
};

export function OrganizationNdtPanel({
  suppliersState,
  inspectorsState,
  onAddSupplier,
  onAddInspector,
  onEditSupplier,
  onDeleteSupplier,
  onEditInspector,
  onDeleteInspector,
}: OrganizationNdtPanelProps) {
  const [supplierInput, setSupplierInput] = useState("");
  const [inspectorInput, setInspectorInput] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [addingInspector, setAddingInspector] = useState(false);

  const suppliers = suppliersState.rows;
  const inspectors = inspectorsState.rows;

  useEffect(() => {
    if (suppliers.length === 0) {
      setSelectedSupplierId("");
      return;
    }

    if (!suppliers.some((supplier) => supplier.id === selectedSupplierId)) {
      setSelectedSupplierId(suppliers[0].id);
    }
  }, [selectedSupplierId, suppliers]);

  const inspectorsBySupplier = useMemo(() => {
    const map = new Map<string, NdtInspectorRow[]>();
    for (const supplier of suppliers) map.set(supplier.id, []);
    for (const inspector of inspectors) {
      const rows = map.get(inspector.supplier_id);
      if (!rows) continue;
      rows.push(inspector);
    }
    return map;
  }, [inspectors, suppliers]);

  const handleAddSupplier = async () => {
    const name = supplierInput.trim();
    if (!name) {
      toast("Skriv inn NDT-leverandør.");
      return;
    }

    setAddingSupplier(true);
    try {
      await onAddSupplier(name);
      setSupplierInput("");
    } catch {
      // Parent callback handles errors/toasts.
    } finally {
      setAddingSupplier(false);
    }
  };

  const handleAddInspector = async () => {
    const supplierId = selectedSupplierId.trim();
    const name = inspectorInput.trim();

    if (!supplierId) {
      toast("Velg NDT-leverandør.");
      return;
    }
    if (!name) {
      toast("Skriv inn kontrollør.");
      return;
    }

    setAddingInspector(true);
    try {
      await onAddInspector(supplierId, name);
      setInspectorInput("");
      setSelectedSupplierId(supplierId);
    } catch {
      // Parent callback handles errors/toasts.
    } finally {
      setAddingInspector(false);
    }
  };

  const isLoading = suppliersState.loading || inspectorsState.loading;
  const error = suppliersState.error ?? inspectorsState.error;

  return (
    <OrganizationCollapsiblePanel title="NDT-leverandører og kontrollører" meta="Admin">
      <div className="settings-form">
        <div className="settings-row inline">
          <input
            className="input"
            type="text"
            placeholder="Ny NDT-leverandør..."
            value={supplierInput}
            onChange={(event) => setSupplierInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void handleAddSupplier();
            }}
          />
          <button
            className="btn primary small"
            type="button"
            disabled={addingSupplier}
            onClick={() => void handleAddSupplier()}
          >
            Legg til leverandør
          </button>
        </div>

        <div className="settings-row inline">
          <div className="settings-inputs" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <select
              className="select"
              value={selectedSupplierId}
              onChange={(event) => setSelectedSupplierId(event.target.value)}
            >
              <option value="">Velg leverandør...</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="text"
              placeholder="Ny kontrollør..."
              value={inspectorInput}
              onChange={(event) => setInspectorInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void handleAddInspector();
              }}
            />
          </div>
          <button
            className="btn primary small"
            type="button"
            disabled={addingInspector}
            onClick={() => void handleAddInspector()}
          >
            Legg til kontrollør
          </button>
        </div>

        <div className="settings-list">
          {isLoading ? <div className="muted">Laster...</div> : null}
          {!isLoading && error ? <div className="err">Feil: {error}</div> : null}
          {!isLoading && !error && suppliers.length === 0 ? <div className="muted">Ingen NDT-leverandører.</div> : null}

          {!isLoading && !error
            ? suppliers.map((supplier) => {
                const supplierInspectors = inspectorsBySupplier.get(supplier.id) ?? [];

                return (
                  <div key={supplier.id} className="settings-subgroup">
                    <div className="settings-item">
                      <div className="settings-item__title">{supplier.name}</div>
                      <div className="settings-item__meta">{supplierInspectors.length} kontrollører</div>
                      <div className="settings-item__actions">
                        <button
                          className="iconbtn small"
                          type="button"
                          title="Endre"
                          onClick={() => onEditSupplier(supplier)}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          className="iconbtn small danger"
                          type="button"
                          title="Slett"
                          onClick={() => onDeleteSupplier(supplier)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>

                    <div className="settings-sublist">
                      {supplierInspectors.length === 0 ? (
                        <div className="muted" style={{ fontSize: 12 }}>
                          Ingen kontrollører.
                        </div>
                      ) : (
                        supplierInspectors.map((inspector) => (
                          <div key={inspector.id} className="settings-item settings-item--sub">
                            <div className="settings-item__title">{inspector.name}</div>
                            <div className="settings-item__meta">Kontrollør</div>
                            <div className="settings-item__actions">
                              <button
                                className="iconbtn small"
                                type="button"
                                title="Endre"
                                onClick={() => onEditInspector(inspector)}
                              >
                                <PencilIcon />
                              </button>
                              <button
                                className="iconbtn small danger"
                                type="button"
                                title="Slett"
                                onClick={() => onDeleteInspector(inspector)}
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            : null}
        </div>
      </div>
    </OrganizationCollapsiblePanel>
  );
}

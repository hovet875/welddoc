import { useState } from "react";
import { toast } from "../../../../../../ui/toast";
import type { OrganizationListState } from "../organization.types";
import { OrganizationCollapsiblePanel } from "./OrganizationCollapsiblePanel";
import { PencilIcon, TrashIcon } from "./OrganizationActionIcons";

type OrganizationSimplePanelProps<T extends { id: string }> = {
  title: string;
  inputPlaceholder: string;
  addLabel: string;
  helperText?: string;
  emptyText: string;
  listState: OrganizationListState<T>;
  getRowTitle: (row: T) => string;
  onAdd: (value: string) => Promise<void>;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
};

export function OrganizationSimplePanel<T extends { id: string }>({
  title,
  inputPlaceholder,
  addLabel,
  helperText,
  emptyText,
  listState,
  getRowTitle,
  onAdd,
  onEdit,
  onDelete,
}: OrganizationSimplePanelProps<T>) {
  const [inputValue, setInputValue] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const value = inputValue.trim();
    if (!value) {
      toast("Skriv inn navn.");
      return;
    }

    setAdding(true);
    try {
      await onAdd(value);
      setInputValue("");
    } catch {
      // onAdd handles user-facing errors.
    } finally {
      setAdding(false);
    }
  };

  return (
    <OrganizationCollapsiblePanel title={title} meta="Admin">
      <div className="settings-form">
        <div className="settings-row inline">
          <input
            className="input"
            type="text"
            placeholder={inputPlaceholder}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void handleAdd();
            }}
          />
          <button className="btn primary small" type="button" disabled={adding} onClick={() => void handleAdd()}>
            {addLabel}
          </button>
        </div>

        {helperText ? <div className="muted" style={{ fontSize: 12 }}>{helperText}</div> : null}

        <div className="settings-list">
          {listState.loading ? <div className="muted">Laster...</div> : null}
          {!listState.loading && listState.error ? <div className="err">Feil: {listState.error}</div> : null}
          {!listState.loading && !listState.error && listState.rows.length === 0 ? (
            <div className="muted">{emptyText}</div>
          ) : null}
          {!listState.loading && !listState.error && listState.rows.length > 0
            ? listState.rows.map((row) => (
                <div key={row.id} className="settings-item">
                  <div className="settings-item__title">{getRowTitle(row)}</div>
                  <div className="settings-item__meta"></div>
                  <div className="settings-item__actions">
                    <button className="iconbtn small" type="button" title="Endre" onClick={() => onEdit(row)}>
                      <PencilIcon />
                    </button>
                    <button className="iconbtn small danger" type="button" title="Slett" onClick={() => onDelete(row)}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))
            : null}
        </div>
      </div>
    </OrganizationCollapsiblePanel>
  );
}

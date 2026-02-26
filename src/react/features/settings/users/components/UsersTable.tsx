import type { UserRow } from "../users.types";

type UsersTableProps = {
  rows: UserRow[];
  loading: boolean;
  error: string | null;
  currentUserId: string | null;
  onEdit: (user: UserRow) => void;
  onToggle: (user: UserRow) => void;
};

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="svgicon" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L8.25 18.463 3 19.5l1.037-5.25L16.862 3.487zM5.39 17.11l2.872-.566L18.98 5.826l-2.306-2.306L5.956 14.238l-.566 2.872z"
      />
    </svg>
  );
}

function ToggleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="svgicon" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V4zm1 0h7v7h-2V7.41l-7.29 7.3-1.42-1.42L16.59 6H13V4z"
      />
    </svg>
  );
}

export function UsersTable({ rows, loading, error, currentUserId, onEdit, onToggle }: UsersTableProps) {
  if (loading) return <div className="muted">Laster...</div>;
  if (error) return <div className="err">Feil: {error}</div>;
  if (rows.length === 0) return <div className="muted">Ingen brukere.</div>;

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Visningsnavn</th>
            <th>E-post</th>
            <th>Stilling</th>
            <th>Sveiser ID</th>
            <th>Rolle</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isInactive = row.login_enabled === false;
            const isSelf = currentUserId === row.id;
            const statusLabel = isInactive ? "Inaktiv" : "Aktiv";
            return (
              <tr key={row.id} className={isInactive ? "user-inactive" : ""}>
                <td data-label="Visningsnavn">{row.display_name ?? ""}</td>
                <td data-label="E-post">{row.email ?? ""}</td>
                <td data-label="Stilling">{row.job_title ?? ""}</td>
                <td data-label="Sveiser ID">{row.welder_no ?? ""}</td>
                <td data-label="Rolle">{row.role ?? ""}</td>
                <td data-label="Status">
                  <span className={isInactive ? "status-pill fault" : "status-pill ok"}>{statusLabel}</span>
                </td>
                <td className="actcell">
                  <button
                    className="iconbtn"
                    type="button"
                    onClick={() => onEdit(row)}
                    aria-label={`Endre ${row.display_name ?? row.email ?? "Bruker"}`}
                    title="Endre"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    className={`iconbtn${isSelf ? " is-disabled" : ""}`}
                    type="button"
                    disabled={isSelf}
                    onClick={() => onToggle(row)}
                    aria-label={`Aktiver/deaktiver ${row.display_name ?? row.email ?? "Bruker"}`}
                    title="Aktiver/Deaktiver"
                  >
                    <ToggleIcon />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

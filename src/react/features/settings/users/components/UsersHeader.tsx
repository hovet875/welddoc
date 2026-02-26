import { Link } from "react-router-dom";

type UsersHeaderProps = {
  onRefresh: () => void;
  onAddUser: () => void;
};

export function UsersHeader({ onRefresh, onAddUser }: UsersHeaderProps) {
  return (
    <section className="section-header">
      <div>
        <h1 className="section-title">Administrer brukere</h1>
        <p className="section-subtitle">Oversikt over brukere i systemet.</p>
      </div>

      <div className="section-actions">
        <Link className="btn small" to="/settings">
          &larr; Tilbake
        </Link>
        <button className="btn accent small" type="button" onClick={onAddUser}>
          Legg til bruker
        </button>
        <button className="btn small" type="button" onClick={onRefresh}>
          Oppdater
        </button>
      </div>
    </section>
  );
}

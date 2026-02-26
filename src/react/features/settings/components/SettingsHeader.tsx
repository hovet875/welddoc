import { Link } from "react-router-dom";

type SettingsHeaderProps = {
  isAdmin: boolean;
};

export function SettingsHeader({ isAdmin }: SettingsHeaderProps) {
  return (
    <section className="section-header">
      <div>
        <h1 className="section-title">Innstillinger</h1>
        <p className="section-subtitle">Administrer app- og brukerinnstillinger.</p>
      </div>

      <div className="section-actions">
        {isAdmin ? (
          <Link className="btn small" to="/settings/company">
            App-parametere
          </Link>
        ) : null}
        {isAdmin ? (
          <Link className="btn small" to="/settings/users">
            Administrer brukere
          </Link>
        ) : null}
      </div>
    </section>
  );
}

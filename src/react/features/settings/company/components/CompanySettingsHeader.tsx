import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type CompanySettingsHeaderProps = {
  title: string;
  subtitle: string;
  backTo: string;
  backLabel: string;
  actions?: ReactNode;
};

export function CompanySettingsHeader({ title, subtitle, backTo, backLabel, actions }: CompanySettingsHeaderProps) {
  return (
    <section className="section-header">
      <div>
        <h1 className="section-title">{title}</h1>
        <p className="section-subtitle">{subtitle}</p>
      </div>

      <div className="section-actions">
        <Link className="btn small" to={backTo}>
          {backLabel}
        </Link>
        {actions}
      </div>
    </section>
  );
}

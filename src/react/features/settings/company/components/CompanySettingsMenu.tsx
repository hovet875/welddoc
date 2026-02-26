import { Link } from "react-router-dom";
import type { CompanySettingsMenuItem } from "../company-settings.types";

type CompanySettingsMenuProps = {
  items: CompanySettingsMenuItem[];
};

export function CompanySettingsMenu({ items }: CompanySettingsMenuProps) {
  return (
    <section className="menu-grid">
      {items.map((item) => (
        <Link key={item.to} className="menu-card" to={item.to}>
          <div className="menu-card__title">{item.title}</div>
          <div className="menu-card__meta">{item.meta}</div>
        </Link>
      ))}
    </section>
  );
}

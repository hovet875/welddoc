import { useState, type ReactNode } from "react";

type OrganizationCollapsiblePanelProps = {
  title: string;
  meta: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
};

export function OrganizationCollapsiblePanel({
  title,
  meta,
  children,
  defaultCollapsed = true,
}: OrganizationCollapsiblePanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`panel panel-collapsible${collapsed ? " is-collapsed" : ""}`}>
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        <div className="panel-meta">{meta}</div>
        <button
          className="panel-toggle"
          type="button"
          aria-expanded={collapsed ? "false" : "true"}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? "Vis" : "Skjul"}
        </button>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

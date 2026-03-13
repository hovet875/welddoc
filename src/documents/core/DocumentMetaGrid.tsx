import type { CSSProperties, ReactNode } from "react";

export type DocumentMetaGridItem = {
  label: string;
  value: ReactNode;
};

type DocumentMetaGridProps = {
  items: DocumentMetaGridItem[];
  columns?: 1 | 2 | 3 | 4;
  density?: "default" | "compact";
  className?: string;
};

export function DocumentMetaGrid({
  items,
  columns = 2,
  density = "default",
  className,
}: DocumentMetaGridProps) {
  const classes = ["doc-meta-grid", className].filter(Boolean).join(" ");
  const style = { "--doc-meta-columns": String(columns) } as CSSProperties;

  return (
    <dl className={classes} data-density={density} style={style}>
      {items.map((item) => (
        <div className="doc-meta-item" key={item.label}>
          <dt className="doc-meta-label">{item.label}</dt>
          <dd className="doc-meta-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

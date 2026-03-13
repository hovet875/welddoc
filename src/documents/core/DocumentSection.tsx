import type { ReactNode } from "react";

type DocumentSectionProps = {
  title?: string;
  children: ReactNode;
};

export function DocumentSection({ title, children }: DocumentSectionProps) {
  return (
    <section className="doc-section">
      {title ? <h2 className="doc-section-title">{title}</h2> : null}
      {children}
    </section>
  );
}
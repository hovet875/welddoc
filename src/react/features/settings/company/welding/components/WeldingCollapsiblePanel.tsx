import type { ReactNode } from "react";
import { AppCollapsiblePanel } from "@react/ui/AppCollapsiblePanel";

type WeldingCollapsiblePanelProps = {
  title: string;
  meta?: string;
  defaultCollapsed?: boolean;
  children: ReactNode;
};

export function WeldingCollapsiblePanel({
  title,
  meta = "Admin",
  defaultCollapsed = true,
  children,
}: WeldingCollapsiblePanelProps) {
  return (
    <AppCollapsiblePanel title={title} meta={meta} defaultCollapsed={defaultCollapsed}>
      {children}
    </AppCollapsiblePanel>
  );
}

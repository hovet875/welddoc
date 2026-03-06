import type { ReactNode } from "react";
import { AppCollapsiblePanel } from "@react/ui/AppCollapsiblePanel";

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
  return (
    <AppCollapsiblePanel title={title} meta={meta} defaultCollapsed={defaultCollapsed}>
      {children}
    </AppCollapsiblePanel>
  );
}

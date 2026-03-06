import type { ReactNode } from "react";
import { AppLinkButton } from "@react/ui/AppLinkButton";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";

type CompanySettingsHeaderProps = {
  title: string;
  subtitle: string;
  backTo: string;
  backLabel: string;
  actions?: ReactNode;
};

export function CompanySettingsHeader({ title, subtitle, backTo, backLabel, actions }: CompanySettingsHeaderProps) {
  return (
    <AppSectionHeader
      title={title}
      subtitle={subtitle}
      actions={
        <>
          <AppLinkButton to={backTo}>{backLabel}</AppLinkButton>
          {actions}
        </>
      }
    />
  );
}

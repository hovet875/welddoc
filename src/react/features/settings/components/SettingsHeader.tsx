import { AppLinkButton } from "@react/ui/AppLinkButton";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";
import { ROUTES } from "@react/router/routes";

type SettingsHeaderProps = {
  isAdmin: boolean;
};

export function SettingsHeader({ isAdmin }: SettingsHeaderProps) {
  return (
    <AppSectionHeader
      title="Innstillinger"
      subtitle="Administrer app- og brukerinnstillinger."
      actions={
        <>
          {isAdmin ? <AppLinkButton to={ROUTES.settingsCompany}>App-parametere</AppLinkButton> : null}
          {isAdmin ? <AppLinkButton to={ROUTES.settingsUsers}>Administrer brukere</AppLinkButton> : null}
        </>
      }
    />
  );
}

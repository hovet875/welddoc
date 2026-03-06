import { AppLinkButton } from "@react/ui/AppLinkButton";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";

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
          {isAdmin ? <AppLinkButton to="/settings/company">App-parametere</AppLinkButton> : null}
          {isAdmin ? <AppLinkButton to="/settings/users">Administrer brukere</AppLinkButton> : null}
        </>
      }
    />
  );
}

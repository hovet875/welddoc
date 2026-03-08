import { AppButton } from "@react/ui/AppButton";
import { AppLinkButton } from "@react/ui/AppLinkButton";
import { AppRefreshIconButton } from "@react/ui/AppRefreshIconButton";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";
import { ROUTES } from "@react/router/routes";

type UsersHeaderProps = {
  onRefresh: () => void;
  onAddUser: () => void;
  refreshing?: boolean;
};

export function UsersHeader({ onRefresh, onAddUser, refreshing = false }: UsersHeaderProps) {
  return (
    <AppSectionHeader
      title="Administrer brukere"
      subtitle="Oversikt over brukere i systemet."
      actions={
        <>
          <AppLinkButton to={ROUTES.settings}>&larr; Tilbake</AppLinkButton>
          <AppButton tone="primary" onClick={onAddUser}>
            Legg til bruker
          </AppButton>
          <AppRefreshIconButton onClick={onRefresh} disabled={refreshing} loading={refreshing} />
        </>
      }
    />
  );
}

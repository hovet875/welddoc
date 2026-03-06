import { AppButton } from "@react/ui/AppButton";
import { AppRefreshIconButton } from "@react/ui/AppRefreshIconButton";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";

type ProjectsHeaderProps = {
  isAdmin: boolean;
  refreshing: boolean;
  loading: boolean;
  onRefresh: () => void;
  onAddProject: () => void;
};

export function ProjectsHeader({ isAdmin, refreshing, loading, onRefresh, onAddProject }: ProjectsHeaderProps) {
  return (
    <AppSectionHeader
      title="Prosjekter"
      subtitle="Oversikt over aktive og inaktive prosjekter."
      actions={
        <>
          {isAdmin ? (
            <AppButton tone="primary" size="sm" onClick={onAddProject} disabled={loading}>
              Nytt prosjekt
            </AppButton>
          ) : null}
          <AppRefreshIconButton onClick={onRefresh} loading={refreshing} disabled={loading} />
        </>
      }
    />
  );
}

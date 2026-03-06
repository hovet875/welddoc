import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@react/features/auth/LoginPage";
import { CertsPage } from "@react/features/certs/CertsPage";
import { HomePage } from "@react/features/home/HomePage";
import { MaterialCertsPage } from "@react/features/material-certs/MaterialCertsPage";
import { MigrationPlaceholderPage } from "@react/features/migration/MigrationPlaceholderPage";
import { NdtPage } from "@react/features/ndt/NdtPage";
import { ProjectDetailsPage } from "@react/features/project-details/ProjectDetailsPage";
import { ProjectsPage } from "@react/features/projects/ProjectsPage";
import { SettingsPage } from "@react/features/settings/SettingsPage";
import { CompanySettingsPage } from "@react/features/settings/company/CompanySettingsPage";
import { CompanySettingsOrganizationPage } from "@react/features/settings/company/organization/CompanySettingsOrganizationPage";
import { CompanySettingsSystemPage } from "@react/features/settings/company/CompanySettingsSystemPage";
import { CompanySettingsWeldingPage } from "@react/features/settings/company/welding/CompanySettingsWeldingPage";
import { UsersPage } from "@react/features/settings/users/UsersPage";
import { WpsPage } from "@react/features/wps/WpsPage";
import { PublicOnlyRoute, RequireAuthRoute } from "@react/router/RouteGuards";

const MIGRATION_PLACEHOLDERS: Array<{ path: string; title: string; subtitle: string }> = [];

const LEGACY_REDIRECTS = [
  { from: "/users", to: "/settings/users" },
  { from: "/company-settings", to: "/settings/company" },
  { from: "/company-settings/organization", to: "/settings/company/organization" },
  { from: "/company-settings/welding", to: "/settings/company/welding" },
  { from: "/company-settings/system", to: "/settings/company/system" },
  { from: "/react", to: "/" },
  { from: "/react/home", to: "/" },
  { from: "/react/prosjekter", to: "/prosjekter" },
] as const;

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/react-login" element={<Navigate to="/login" replace />} />
      </Route>

      <Route element={<RequireAuthRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/prosjekter" element={<ProjectsPage />} />
        <Route path="/prosjekter/:projectId" element={<ProjectDetailsPage />} />
        <Route path="/prosjekter/:projectId/:section" element={<ProjectDetailsPage />} />
        <Route path="/materialsertifikater" element={<MaterialCertsPage />} />
        {MIGRATION_PLACEHOLDERS.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={<MigrationPlaceholderPage title={route.title} subtitle={route.subtitle} />}
          />
        ))}
        <Route path="/wps" element={<WpsPage />} />
        <Route path="/certs" element={<CertsPage />} />
        <Route path="/ndt" element={<NdtPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/users" element={<UsersPage />} />
        <Route path="/settings/company" element={<CompanySettingsPage />} />
        <Route path="/settings/company/system" element={<CompanySettingsSystemPage />} />
        <Route path="/settings/company/organization" element={<CompanySettingsOrganizationPage />} />
        <Route path="/settings/company/welding" element={<CompanySettingsWeldingPage />} />

        {LEGACY_REDIRECTS.map((route) => (
          <Route key={route.from} path={route.from} element={<Navigate to={route.to} replace />} />
        ))}
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

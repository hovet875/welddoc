import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PublicOnlyRoute, RequireAuthRoute } from "@react/router/RouteGuards";
import {
  loadCertsPage,
  loadCompanySettingsOrganizationPage,
  loadCompanySettingsPage,
  loadCompanySettingsSystemPage,
  loadCompanySettingsWeldingPage,
  loadHomePage,
  loadLoginPage,
  loadMaterialCertsPage,
  loadMigrationPlaceholderPage,
  loadNdtPage,
  loadProjectDetailsPage,
  loadProjectsPage,
  loadSettingsPage,
  loadUsersPage,
  loadWpsPage,
  preloadRouteForPath,
} from "@react/router/routePreload";

const MIGRATION_PLACEHOLDERS: Array<{ path: string; title: string; subtitle: string }> = [];

const LoginPage = lazy(() => loadLoginPage().then((m) => ({ default: m.LoginPage })));
const CertsPage = lazy(() => loadCertsPage().then((m) => ({ default: m.CertsPage })));
const HomePage = lazy(() => loadHomePage().then((m) => ({ default: m.HomePage })));
const MaterialCertsPage = lazy(() => loadMaterialCertsPage().then((m) => ({ default: m.MaterialCertsPage })));
const MigrationPlaceholderPage = lazy(() =>
  loadMigrationPlaceholderPage().then((m) => ({ default: m.MigrationPlaceholderPage }))
);
const NdtPage = lazy(() => loadNdtPage().then((m) => ({ default: m.NdtPage })));
const ProjectDetailsPage = lazy(() =>
  loadProjectDetailsPage().then((m) => ({ default: m.ProjectDetailsPage }))
);
const ProjectsPage = lazy(() => loadProjectsPage().then((m) => ({ default: m.ProjectsPage })));
const SettingsPage = lazy(() => loadSettingsPage().then((m) => ({ default: m.SettingsPage })));
const CompanySettingsPage = lazy(() =>
  loadCompanySettingsPage().then((m) => ({ default: m.CompanySettingsPage }))
);
const CompanySettingsOrganizationPage = lazy(() =>
  loadCompanySettingsOrganizationPage().then((m) => ({
    default: m.CompanySettingsOrganizationPage,
  }))
);
const CompanySettingsSystemPage = lazy(() =>
  loadCompanySettingsSystemPage().then((m) => ({
    default: m.CompanySettingsSystemPage,
  }))
);
const CompanySettingsWeldingPage = lazy(() =>
  loadCompanySettingsWeldingPage().then((m) => ({
    default: m.CompanySettingsWeldingPage,
  }))
);
const UsersPage = lazy(() => loadUsersPage().then((m) => ({ default: m.UsersPage })));
const WpsPage = lazy(() => loadWpsPage().then((m) => ({ default: m.WpsPage })));

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
  const location = useLocation();
  const suspenseFallback = null;

  useEffect(() => {
    void preloadRouteForPath(location.pathname);
  }, [location.pathname]);

  return (
    <Suspense fallback={suspenseFallback}>
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
    </Suspense>
  );
}

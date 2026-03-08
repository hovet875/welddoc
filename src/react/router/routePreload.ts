import { ROUTES } from "@react/router/routes";

type RouteLoader = () => Promise<unknown>;

export const loadLoginPage = () => import("@react/features/auth/LoginPage");
export const loadHomePage = () => import("@react/features/home/HomePage");
export const loadProjectsPage = () => import("@react/features/projects/ProjectsPage");
export const loadProjectDetailsPage = () => import("@react/features/project-details/ProjectDetailsPage");
export const loadMaterialCertsPage = () => import("@react/features/material-certs/MaterialCertsPage");
export const loadWpsPage = () => import("@react/features/wps/WpsPage");
export const loadCertsPage = () => import("@react/features/certs/CertsPage");
export const loadNdtPage = () => import("@react/features/ndt/NdtPage");
export const loadSettingsPage = () => import("@react/features/settings/SettingsPage");
export const loadUsersPage = () => import("@react/features/settings/users/UsersPage");
export const loadCompanySettingsPage = () => import("@react/features/settings/company/CompanySettingsPage");
export const loadCompanySettingsSystemPage = () =>
  import("@react/features/settings/company/CompanySettingsSystemPage");
export const loadCompanySettingsOrganizationPage = () =>
  import("@react/features/settings/company/organization/CompanySettingsOrganizationPage");
export const loadCompanySettingsWeldingPage = () =>
  import("@react/features/settings/company/welding/CompanySettingsWeldingPage");
export const loadMigrationPlaceholderPage = () =>
  import("@react/features/migration/MigrationPlaceholderPage");

function normalizePath(path: string) {
  let normalized = path.trim();
  if (!normalized) return ROUTES.home;

  normalized = normalized.replace(/^https?:\/\/[^/]+/i, "");
  normalized = normalized.split("#")[0]?.split("?")[0] ?? ROUTES.home;
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  return normalized;
}

function resolveLoaders(path: string): RouteLoader[] {
  const pathname = normalizePath(path);
  const loaders: RouteLoader[] = [];

  if (pathname === ROUTES.home) {
    loaders.push(loadHomePage);
    return loaders;
  }

  if (pathname === ROUTES.login) {
    loaders.push(loadLoginPage);
    return loaders;
  }

  if (pathname === ROUTES.projects) {
    loaders.push(loadProjectsPage);
    return loaders;
  }

  if (pathname.startsWith(`${ROUTES.projects}/`)) {
    loaders.push(loadProjectDetailsPage);
    return loaders;
  }

  if (pathname === ROUTES.materialCerts) {
    loaders.push(loadMaterialCertsPage);
    return loaders;
  }

  if (pathname === ROUTES.wps) {
    loaders.push(loadWpsPage);
    return loaders;
  }

  if (pathname === ROUTES.certs) {
    loaders.push(loadCertsPage);
    return loaders;
  }

  if (pathname === ROUTES.ndt) {
    loaders.push(loadNdtPage);
    return loaders;
  }

  if (pathname === ROUTES.settings) {
    loaders.push(loadSettingsPage);
    return loaders;
  }

  if (pathname === ROUTES.settingsUsers) {
    loaders.push(loadUsersPage);
    return loaders;
  }

  if (pathname === ROUTES.settingsCompany) {
    loaders.push(loadCompanySettingsPage);
    return loaders;
  }

  if (pathname === ROUTES.settingsCompanySystem) {
    loaders.push(loadCompanySettingsSystemPage);
    return loaders;
  }

  if (pathname === ROUTES.settingsCompanyOrganization) {
    loaders.push(loadCompanySettingsOrganizationPage);
    return loaders;
  }

  if (pathname === ROUTES.settingsCompanyWelding) {
    loaders.push(loadCompanySettingsWeldingPage);
    return loaders;
  }

  loaders.push(loadMigrationPlaceholderPage);
  return loaders;
}

export async function preloadRouteForPath(path: string) {
  const loaders = resolveLoaders(path);
  await Promise.allSettled(loaders.map((loader) => loader()));
}

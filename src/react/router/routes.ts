export const ROUTES = {
  home: "/",
  login: "/login",
  projects: "/projects",
  materialCerts: "/mtc",
  wps: "/procedures",
  certs: "/certs",
  ndt: "/ndt",
  settings: "/settings",
  settingsUsers: "/settings/users",
  settingsCompany: "/settings/company",
  settingsCompanySystem: "/settings/company/system",
  settingsCompanyOrganization: "/settings/company/organization",
  settingsCompanyWelding: "/settings/company/welding",
} as const;

export const ROUTE_PATTERNS = {
  projectDetails: `${ROUTES.projects}/:projectId`,
  projectDetailsSection: `${ROUTES.projects}/:projectId/:section`,
} as const;

export const routePath = {
  projectDetails: (projectId: string) => `${ROUTES.projects}/${projectId}`,
  projectDetailsSection: (projectId: string, section: string) => `${ROUTES.projects}/${projectId}/${section}`,
} as const;

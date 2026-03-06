import type { ProjectRow } from "@/repo/projectRepo";

export type ProjectDetailsSectionKey =
  | "oversikt"
  | "arbeidsordre"
  | "tegninger"
  | "sporbarhet"
  | "sveiselogg"
  | "dokumenter"
  | "trykktest"
  | "dokumentasjonspakke";

export type ProjectDetailsAliasSection = "wps" | "sveisesertifikat" | "ndt";

export type ProjectDetailsRouteSection = ProjectDetailsSectionKey | ProjectDetailsAliasSection;

export type ProjectDetailsSection = {
  key: ProjectDetailsSectionKey;
  label: string;
};

export type { ProjectRow };

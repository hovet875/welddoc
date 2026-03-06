import { resolveProcessKey } from "./wpsView";

type MaterialLabelInput = {
  name?: string | null;
  material_code?: string | null;
  material_group?: string | null;
};

export function materialLabelFromOption(input: MaterialLabelInput) {
  const name = String(input.name ?? "").trim();
  const code = String(input.material_code ?? "").trim();
  const group = String(input.material_group ?? "").trim();
  if (!name && !code && !group) return "";
  return `${name} (${code}) - ${group}`;
}

export function isSameProcess(a: string, b: string, processDictionary: Map<string, string>) {
  return resolveProcessKey(a, processDictionary) === resolveProcessKey(b, processDictionary);
}

function normalizeStandardType(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isStandardType(value: string | null | undefined, expected: string) {
  return normalizeStandardType(value) === normalizeStandardType(expected);
}

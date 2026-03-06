import { Badge } from "@mantine/core";

type AppMethodBadgeProps = {
  methodKey: string;
  label?: string;
};

const METHOD_COLORS = [
  "blue",
  "cyan",
  "teal",
  "green",
  "lime",
  "yellow",
  "orange",
  "red",
  "pink",
  "grape",
  "violet",
  "indigo",
] as const;

function normalizeMethodKey(value: string) {
  return value.trim().toUpperCase();
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function resolveMethodColor(methodKey: string) {
  const key = normalizeMethodKey(methodKey);
  if (!key) return "gray";
  const index = hashString(key) % METHOD_COLORS.length;
  return METHOD_COLORS[index];
}

export function AppMethodBadge({ methodKey, label }: AppMethodBadgeProps) {
  const normalizedKey = normalizeMethodKey(methodKey);
  const text = label?.trim() || normalizedKey || "Ukjent";
  return (
    <Badge variant="filled" color={resolveMethodColor(normalizedKey)} radius="xl">
      {text}
    </Badge>
  );
}

type DocumentStatusTone = "success" | "warning" | "danger" | "neutral";

const STATUS_TONE_BY_LABEL: Array<[match: string, tone: DocumentStatusTone]> = [
  ["godkjent", "success"],
  ["klar", "success"],
  ["til kontroll", "warning"],
  ["manuell", "warning"],
  ["avvist", "danger"],
  ["mangel", "danger"],
];

export function documentStatusTone(label: string): DocumentStatusTone {
  const normalized = String(label ?? "").trim().toLowerCase();
  if (!normalized) return "neutral";

  const match = STATUS_TONE_BY_LABEL.find(([candidate]) => candidate === normalized);
  return match?.[1] ?? "neutral";
}

type DocumentStatusBadgeProps = {
  label: string;
  tone?: DocumentStatusTone;
};

export function DocumentStatusBadge({ label, tone }: DocumentStatusBadgeProps) {
  const resolvedTone = tone ?? documentStatusTone(label);

  return (
    <span className="doc-status-badge" data-tone={resolvedTone}>
      {label}
    </span>
  );
}

type ErrorLike = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  error_description?: unknown;
};

const clean = (value: unknown): string => String(value ?? "").trim();

export function formatErrorMessage(error: unknown, fallback = "Ukjent feil"): string {
  if (!error) return fallback;

  if (typeof error === "string") {
    const text = clean(error);
    return text || fallback;
  }

  if (error instanceof Error) {
    const text = clean(error.message);
    return text || fallback;
  }

  if (typeof error === "object") {
    const row = error as ErrorLike;
    const parts = [row.message, row.error_description, row.details, row.hint]
      .map((part) => clean(part))
      .filter(Boolean);
    const code = clean(row.code);

    if (parts.length) {
      if (code && !parts.some((part) => part.includes(code))) parts.push(`kode: ${code}`);
      return parts.join(" | ");
    }

    if (code) return `Feilkode: ${code}`;

    try {
      const json = JSON.stringify(error);
      if (json && json !== "{}") return json;
    } catch {}
  }

  const text = clean(error);
  return text || fallback;
}

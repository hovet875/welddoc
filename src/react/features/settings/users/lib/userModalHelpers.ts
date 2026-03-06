export async function readFunctionError(err: any) {
  try {
    const ctx = err?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json();
      if (body?.error) return body.error as string;
    }
    if (ctx?.status) return `Feil ${ctx.status}: ${err?.message ?? ""}`.trim();
  } catch (innerErr) {
    console.warn("Kunne ikke lese feilbody", innerErr);
  }
  return err?.message ?? "Kunne ikke utføre operasjonen.";
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function sanitizeWelderNo(value: string) {
  const raw = value.replace(/\D/g, "").trim();
  return raw ? raw.padStart(3, "0") : null;
}

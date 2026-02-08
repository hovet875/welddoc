export function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function validatePdfFile(file: File, maxMb = 25) {
  if (file.type !== "application/pdf") return "Filen må være PDF.";
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) return `PDF er for stor (maks ${maxMb} MB).`;
  return null;
}

/** Stabil praksis: doc_no lagres konsistent */
export function normalizeDocNo(s: string) {
  return String(s ?? "").trim().toUpperCase();
}

export function truncateLabel(text: string, max = 15) {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}...`;
}
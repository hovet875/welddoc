// supabase/functions/nas-inbox-ingest/index.ts
// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// PDF text extraction
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.2.67/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_MB = Number(Deno.env.get("WELDDOC_MAX_FILE_MB") || "25");
const INGEST_TOKEN = Deno.env.get("NAS_INGEST_TOKEN") || "";
const STORAGE_BUCKET = Deno.env.get("SUPABASE_STORAGE_BUCKET") || "files";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const TARGETS = new Set(["material_certificate", "ndt_report"]);
const SOURCE_TO_TARGET: Record<string, string> = {
  Materialsertifikater: "material_certificate",
  "NDT-rapporter": "ndt_report",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(hash);
}

function parseJsonObject(input: string) {
  if (!input.trim()) return {};
  const parsed = JSON.parse(input);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("suggested_meta must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function normalizeForMatchSafe(input: string) {
  return (input || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNameCandidate(input: string) {
  let value = (input || "").replace(/\s+/g, " ").trim();
  value = value.replace(/^(document approved by|technician)\s*[:\-]?\s*/i, "");
  value = value.replace(/\bISO\b.*$/i, "");
  value = value.replace(/\bISO9712\b.*$/i, "");
  value = value.replace(/\bLevel\b.*$/i, "");
  value = value.replace(/[^\p{L}\s.'-]/gu, " ");
  value = value.replace(/\s+/g, " ").trim();

  const m = value.match(/[\p{L}][\p{L}.'-]*(?:\s+[\p{L}][\p{L}.'-]*){1,3}/u);
  return m ? m[0].trim() : "";
}

function findNameFromLabel(lines: string[], labelPattern: RegExp) {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!labelPattern.test(line)) continue;

    const inline = cleanNameCandidate(line.replace(labelPattern, "").replace(/^[:\-\s]+/, ""));
    if (inline) return inline;

    for (let j = i + 1; j < Math.min(lines.length, i + 5); j += 1) {
      const nextLine = lines[j];
      if (!nextLine) continue;
      if (
        /^(client|project|part|date|work order|location|trace|technician|document approved by|page\s+\d+)/i.test(
          nextLine
        )
      ) {
        continue;
      }
      const candidate = cleanNameCandidate(nextLine);
      if (candidate) return candidate;
    }
  }
  return "";
}

function parseDateToIso(rawValue: string) {
  const value = rawValue.trim().replace(/\s+/g, "").replace(/[./]/g, "-");
  const parts = value.split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 3) return "";

  let day = 0;
  let month = 0;
  let year = 0;

  if (parts[0].length === 4) {
    year = Number(parts[0]);
    month = Number(parts[1]);
    day = Number(parts[2]);
  } else {
    day = Number(parts[0]);
    month = Number(parts[1]);
    year = Number(parts[2]);
    if (year < 100) year += 2000;
  }

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return "";
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2099) return "";

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractMethodCode(text: string, fileName: string) {
  // "Report: UT-25-634 Rev. 0"
  const fromReportCode = /\breport\s*[:\-]?\s*(MT|VT|PT|RT|UT)\s*-\s*\d/i.exec(text)?.[1];
  if (fromReportCode) return fromReportCode.toUpperCase();

  const fromReportCode2 = /\breport\s*[:\-]?\s*(MT|VT|PT|RT|UT)-/i.exec(text)?.[1];
  if (fromReportCode2) return fromReportCode2.toUpperCase();

  // If your procedures include ".UT" (like BPI-xx.xx.xx UT), keep this:
  const fromProcedure = /\bBPI-[\d.]+\.(MT|VT|PT|RT|UT)\b/i.exec(text)?.[1];
  if (fromProcedure) return fromProcedure.toUpperCase();

  if (/ULTRASONIC\s+INSPECTION\s+REPORT/i.test(text)) return "UT";
  if (/MAGNETIC\s+PARTICLE\s+INSPECTION\s+REPORT/i.test(text)) return "MT";
  if (/VISUAL\s+INSPECTION\s+REPORT/i.test(text)) return "VT";
  if (/LIQUID\s+PENETRANT\s+INSPECTION\s+REPORT/i.test(text)) return "PT";
  if (/RADIOGRAPHIC\s+INSPECTION\s+REPORT/i.test(text)) return "RT";

  const fromFileName = /\b(MT|VT|PT|RT|UT)-\d{2,4}-\d+/i.exec(fileName)?.[1];
  if (fromFileName) return fromFileName.toUpperCase();

  return "";
}

function extractReportDate(text: string) {
  const candidates = [
    // Date 21-05-2025
    /\bdate\b[^\d]{0,25}([0-3]?\d\s*[.\-/]\s*[01]?\d\s*[.\-/]\s*(?:\d{4}|\d{2}))/i,

    // Near report header
    /\breport\s*[:\-]?\s*(?:MT|VT|PT|RT|UT)\s*-\s*\d{2,4}-\d+[\s\S]{0,250}?([0-3]?\d\s*[.\-/]\s*[01]?\d\s*[.\-/]\s*(?:\d{4}|\d{2}))/i,
  ];

  for (const rx of candidates) {
    const match = rx.exec(text);
    if (!match) continue;
    const parsed = parseDateToIso(match[1]);
    if (parsed) return parsed;
  }

  return "";
}


function extractInspectorName(text: string) {
  // Direct regex first (handles collapsed layout)
  const mTech = /\bTechnician\b[\s:,-]*([A-ZÆØÅ][\p{L}.'-]+(?:\s+[A-ZÆØÅ][\p{L}.'-]+){1,3})/iu.exec(text);
  if (mTech?.[1]) {
    const cleaned = cleanNameCandidate(mTech[1]);
    if (cleaned) return cleaned;
  }

  const mAppr =
    /\bDocument\s+Approved\s+By\b[\s:,-]*([A-ZÆØÅ][\p{L}.'-]+(?:\s+[A-ZÆØÅ][\p{L}.'-]+){1,3})/iu.exec(text);
  if (mAppr?.[1]) {
    const cleaned = cleanNameCandidate(mAppr[1]);
    if (cleaned) return cleaned;
  }

  // Line-based fallback
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const technician = findNameFromLabel(lines, /^technician\b/i);
  if (technician) return technician;

  const approved = findNameFromLabel(lines, /^document\s+approved\s+by\b/i);
  if (approved) return approved;

  // Last fallback: "<Name> ISO9712 RT Level 2"
  const mIso =
    /([A-ZÆØÅ][\p{L}.'-]+(?:\s+[A-ZÆØÅ][\p{L}.'-]+){1,3})\s+ISO\s*9712\s+(?:RT|VT|PT|MT|UT)\s+Level\s*\d/iu.exec(
      text
    );
  if (mIso?.[1]) {
    const cleaned = cleanNameCandidate(mIso[1]);
    if (cleaned) return cleaned;
  }

  return "";
}

function extractCompanyHint(text: string) {
  // Pragmatic hint for IKM when logo text may not be in text layer
  if (/\bIKM\b/i.test(text)) return "IKM Inspection AS";
  return "";
}

function chooseSupplierFromText(text: string, suppliers: Array<{ id: string; name: string; is_active: boolean }>) {
  const normalizedText = normalizeForMatchSafe(text);
  const matches = suppliers
    .map((supplier) => {
      const nameNorm = normalizeForMatchSafe(supplier.name || "");
      if (!nameNorm || !normalizedText.includes(nameNorm)) return null;
      return {
        id: supplier.id,
        name: supplier.name,
        is_active: !!supplier.is_active,
        score: nameNorm.length,
      };
    })
    .filter(Boolean) as Array<{ id: string; name: string; is_active: boolean; score: number }>;

  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return b.score - a.score;
  });
  return matches[0];
}

function chooseInspectorByName(
  inspectorName: string,
  supplierId: string | null,
  inspectors: Array<{ id: string; supplier_id: string; name: string; is_active: boolean }>
) {
  const want = normalizeForMatchSafe(inspectorName);
  if (!want) return null;

  const candidates = inspectors.filter((row) => {
    if (supplierId && row.supplier_id !== supplierId) return false;
    const rowNorm = normalizeForMatchSafe(row.name || "");
    return rowNorm === want || rowNorm.includes(want) || want.includes(rowNorm);
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const active = candidates.filter((c) => c.is_active);
  if (active.length === 1) return active[0];
  return null;
}

function chooseInspectorFromText(
  text: string,
  supplierId: string | null,
  inspectors: Array<{ id: string; supplier_id: string; name: string; is_active: boolean }>
) {
  const normalizedText = normalizeForMatchSafe(text);
  if (!normalizedText) return null;

  const matches = inspectors
    .map((row) => {
      if (supplierId && row.supplier_id !== supplierId) return null;
      const rowNorm = normalizeForMatchSafe(row.name || "");
      if (!rowNorm || !normalizedText.includes(rowNorm)) return null;
      return { ...row, score: rowNorm.length };
    })
    .filter(Boolean) as Array<{ id: string; supplier_id: string; name: string; is_active: boolean; score: number }>;

  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return b.score - a.score;
  });
  return matches[0];
}

function chooseMethodId(methodCode: string, methods: Array<{ id: string; code: string; is_active: boolean; sort_order: number }>) {
  if (!methodCode) return "";
  const candidates = methods.filter((row) => (row.code || "").toUpperCase() === methodCode.toUpperCase());
  if (candidates.length === 0) return "";
  if (candidates.length === 1) return candidates[0].id;

  const active = candidates.filter((c) => c.is_active);
  if (active.length === 1) return active[0].id;
  if (active.length > 1) {
    active.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return active[0].id;
  }
  return "";
}

function setIfEmpty(target: Record<string, unknown>, key: string, value: string) {
  if (!value) return;
  const current = target[key];
  if (current == null || current === "") {
    target[key] = value;
  }
}

async function extractPdfText(bytes: Uint8Array) {
  try {
    // @ts-ignore
    pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;

    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;

    let out = "";
    for (let p = 1; p <= pdf.numPages; p += 1) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      const rows: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = [];

      for (const item of (content.items || []) as any[]) {
        const raw = typeof item?.str === "string" ? item.str : "";
        const text = raw.trim();
        if (!text) continue;

        const x = Number(item?.transform?.[4] ?? 0);
        const y = Number(item?.transform?.[5] ?? 0);

        // group into "same line" with tolerance
        const row = rows.find((r) => Math.abs(r.y - y) < 2);
        if (row) {
          row.parts.push({ x, text });
        } else {
          rows.push({ y, parts: [{ x, text }] });
        }
      }

      // top-to-bottom
      rows.sort((a, b) => b.y - a.y);

      const lines = rows
        .map((row) => {
          row.parts.sort((a, b) => a.x - b.x);
          return row.parts.map((part) => part.text).join(" ").replace(/\s+/g, " ").trim();
        })
        .filter(Boolean);

      out += lines.join("\n") + "\n\n";
      if (out.length > 250_000) break;
    }

    return out.slice(0, 250_000);
  } catch {
    return "";
  }
}

async function enrichNdtSuggestedMeta(admin: any, text: string, fileName: string, base: Record<string, unknown>) {
  const merged = { ...base };

  const methodCode = extractMethodCode(text, fileName);
  const reportDate = extractReportDate(text);
  const inspectorName = extractInspectorName(text);

  const [methodsRes, suppliersRes, inspectorsRes] = await Promise.all([
    admin.from("parameter_ndt_methods").select("id, code, is_active, sort_order"),
    admin.from("parameter_ndt_suppliers").select("id, name, is_active"),
    admin.from("parameter_ndt_inspectors").select("id, supplier_id, name, is_active"),
  ]);

  if (methodsRes.error) throw methodsRes.error;
  if (suppliersRes.error) throw suppliersRes.error;
  if (inspectorsRes.error) throw inspectorsRes.error;

  const methods = methodsRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];
  const inspectors = inspectorsRes.data ?? [];

  const companyHint = extractCompanyHint(text);

  const supplierFromText =
    chooseSupplierFromText(text, suppliers) ||
    (companyHint
      ? suppliers.find((s: any) => normalizeForMatchSafe(s.name || "") === normalizeForMatchSafe(companyHint))
      : null);

  const inspectorFromLabel = chooseInspectorByName(inspectorName, supplierFromText?.id ?? null, inspectors);
  const inspectorFromText = inspectorFromLabel || chooseInspectorFromText(text, supplierFromText?.id ?? null, inspectors);

  const supplierId = supplierFromText?.id || inspectorFromText?.supplier_id || "";
  const supplierName =
    supplierFromText?.name ||
    suppliers.find((s: any) => s.id === supplierId)?.name ||
    companyHint ||
    "";

  const inspectorId = inspectorFromText?.id || "";
  const methodId = chooseMethodId(methodCode, methods);

  const extracted = {
    method_code: methodCode || null,
    report_date: reportDate || null,
    inspection_company: supplierName || null,
    inspector_name: inspectorName || null,
    method_id: methodId || null,
    ndt_supplier_id: supplierId || null,
    ndt_inspector_id: inspectorId || null,
    extracted_at: new Date().toISOString(),
  };

  const next = { ...merged };

  const prevExtracted =
    next.extracted && typeof next.extracted === "object" && !Array.isArray(next.extracted)
      ? (next.extracted as Record<string, unknown>)
      : {};

  next.extracted = { ...prevExtracted, ...extracted };

  // Convenience (optional) – only set if empty
  setIfEmpty(next, "method_code", methodCode);
  setIfEmpty(next, "report_date", reportDate);
  setIfEmpty(next, "inspection_company", supplierName);
  setIfEmpty(next, "inspector_name", inspectorName);
  setIfEmpty(next, "method_id", methodId);
  setIfEmpty(next, "ndt_supplier_id", supplierId);
  setIfEmpty(next, "ndt_inspector_id", inspectorId);

  return { suggestedMeta: next, extracted };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Missing Supabase env vars" });
    if (!INGEST_TOKEN) return json(500, { error: "Missing NAS_INGEST_TOKEN secret" });

    const providedToken =
      req.headers.get("x-ingest-token") ||
      (req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");

    if (!providedToken || providedToken !== INGEST_TOKEN) {
      return json(401, { error: "Unauthorized" });
    }

    const form = await req.formData();
    const target = String(form.get("target") || "").trim();
    const sourceFolder = String(form.get("source_folder") || "").trim();
    const sourcePath = String(form.get("source_path") || "").trim();
    const suggestedMetaRaw = String(form.get("suggested_meta") || "{}");
    const ocrTextRaw = String(form.get("ocr_text") || "").slice(0, 250_000);
    const file = form.get("file");

    if (!TARGETS.has(target)) return json(400, { error: "Invalid target" });
    if (!sourceFolder || !sourcePath) return json(400, { error: "source_folder and source_path are required" });
    if (SOURCE_TO_TARGET[sourceFolder] && SOURCE_TO_TARGET[sourceFolder] !== target) {
      return json(400, { error: "source_folder does not match target" });
    }
    if (!(file instanceof File)) return json(400, { error: "file is required" });

    const fileName = (file.name || "upload.pdf").trim();
    const isPdf = fileName.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    if (!isPdf) return json(400, { error: "Only PDF is allowed" });

    const maxBytes = MAX_FILE_MB * 1024 * 1024;
    if (file.size > maxBytes) return json(400, { error: `File too large (max ${MAX_FILE_MB}MB)` });

    let suggestedMeta = parseJsonObject(suggestedMetaRaw);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha256 = await sha256Hex(bytes);

    const { data: existingFile, error: existingFileErr } = await admin
      .from("files")
      .select("id")
      .eq("sha256", sha256)
      .maybeSingle();
    if (existingFileErr) throw existingFileErr;

    let fileId = existingFile?.id || null;
    let deduped = !!fileId;

    if (!fileId) {
      fileId = crypto.randomUUID();
      const storagePath = `inbox/${target}/${fileId}.pdf`;

      const { error: uploadErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, bytes, { upsert: false, contentType: "application/pdf" });
      if (uploadErr) throw uploadErr;

      const { error: insertFileErr } = await admin.from("files").insert({
        id: fileId,
        bucket: STORAGE_BUCKET,
        path: storagePath,
        type: target,
        label: fileName,
        mime_type: "application/pdf",
        size_bytes: file.size,
        sha256,
      });
      if (insertFileErr) {
        await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw insertFileErr;
      }
    }

    let extracted: Record<string, unknown> = {};

    if (target === "ndt_report") {
      const pdfText = await extractPdfText(bytes);

      // Combine PDF-text and optional OCR-text (OCR can help if supplier/logo isn't in text layer)
      const textForExtraction = [pdfText, ocrTextRaw]
        .map((v) => (v || "").trim())
        .filter(Boolean)
        .join("\n");

      const enriched = await enrichNdtSuggestedMeta(admin, textForExtraction, fileName, suggestedMeta);
      suggestedMeta = enriched.suggestedMeta;
      extracted = enriched.extracted;

      // Debug (uncomment if needed)
      // console.log("EXTRACTED:", extracted);
      // console.log("TEXT_HEAD:", textForExtraction.slice(0, 1500));
    }

    const { data: existingInbox, error: existingInboxErr } = await admin
      .from("file_inbox")
      .select("id")
      .eq("file_id", fileId)
      .eq("target", target)
      .eq("status", "new")
      .maybeSingle();
    if (existingInboxErr) throw existingInboxErr;

    let inboxId = existingInbox?.id || null;

    if (inboxId) {
      const { error: updateInboxErr } = await admin
        .from("file_inbox")
        .update({
          source_folder: sourceFolder,
          source_path: sourcePath,
          suggested_meta: suggestedMeta,
        })
        .eq("id", inboxId);
      if (updateInboxErr) throw updateInboxErr;
    } else {
      const { data: insertedInbox, error: insertInboxErr } = await admin
        .from("file_inbox")
        .insert({
          file_id: fileId,
          target,
          status: "new",
          source_folder: sourceFolder,
          source_path: sourcePath,
          suggested_meta: suggestedMeta,
        })
        .select("id")
        .single();
      if (insertInboxErr) throw insertInboxErr;
      inboxId = insertedInbox.id;
    }

    return json(200, {
      ok: true,
      file_id: fileId,
      inbox_id: inboxId,
      deduped,
      extracted,
    });
  } catch (err: any) {
    return json(500, { error: String(err?.message ?? err) });
  }
});

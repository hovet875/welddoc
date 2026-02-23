# NAS Inbox Sync (Synology)

This project now supports a Supabase-backed file inbox:

- `file_inbox.target = "material_certificate"` for files from `01_Inbox/Materialsertifikater`
- `file_inbox.target = "ndt_report"` for files from `01_Inbox/NDT-rapporter`

The script `scripts/nas-inbox-sync.mjs` scans your NAS folders and sends files to the Edge Function `nas-inbox-ingest`.

The Edge Function uploads PDF files to Supabase Storage, creates metadata rows in `files`, and creates inbox rows in `file_inbox`.

It then moves each source file to:

- `02_Processed/...` on success
- `03_Error/...` on failure (with `.error.txt` note)

## Required env vars (NAS script)

- `SUPABASE_FUNCTION_URL`
  Example: `https://<project-ref>.supabase.co/functions/v1/nas-inbox-ingest`
- `SUPABASE_ANON_KEY`
- `NAS_INGEST_TOKEN`

Optional:

- `WELDDOC_ROOT` (default: `/welddoc`)
- `WELDDOC_MAX_FILE_MB` (default: `25`)
- `WELDDOC_MIN_FILE_AGE_SEC` (default: `5`)
- `WELDDOC_OCR_ROOT` (default: `/welddoc/99_Temp/ocr`)
- `WELDDOC_OCR_TEXT_MAX_CHARS` (default: `250000`)

## Required secrets (Edge Function)

Set these in Supabase Edge Function secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NAS_INGEST_TOKEN`

Optional in function secrets:

- `SUPABASE_STORAGE_BUCKET` (default: `files`)
- `WELDDOC_MAX_FILE_MB` (default: `25`)

And ensure `supabase/config.toml` has:

```toml
[functions.nas-inbox-ingest]
verify_jwt = false
```

## Local run

```bash
npm run nas:sync
```

## Docker example (Synology)

```yaml
services:
  welddoc-inbox-sync:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - /volume1/docker/welddoc-app:/app
      - /volume1/welddoc:/welddoc
    environment:
      SUPABASE_FUNCTION_URL: "https://YOUR_PROJECT.supabase.co/functions/v1/nas-inbox-ingest"
      SUPABASE_ANON_KEY: "YOUR_ANON_KEY"
      NAS_INGEST_TOKEN: "YOUR_SHARED_TOKEN"
      WELDDOC_ROOT: "/welddoc"
      WELDDOC_MAX_FILE_MB: "25"
      WELDDOC_MIN_FILE_AGE_SEC: "5"
      WELDDOC_OCR_ROOT: "/welddoc/99_Temp/ocr"
    command: >
      sh -c "while true; do npm run nas:sync; sleep 20; done"
```

## Expected NAS structure

```text
welddoc/
  01_Inbox/
    Materialsertifikater/
    NDT-rapporter/
  02_Processed/
  03_Error/
  99_Temp/
```

## Optional OCR sidecar files

If you run OCR on NAS, the sync script will send OCR text to the Edge Function when it finds one of these files:

- `<pdf_path>.ocr.txt`
- `<pdf_basename>.ocr.txt`
- `<WELDDOC_OCR_ROOT>/<relative_pdf_path>.txt`
- `<WELDDOC_OCR_ROOT>/<relative_pdf_basename>.txt`

For example:

- PDF: `01_Inbox/NDT-rapporter/RT-26-167.pdf`
- OCR: `99_Temp/ocr/01_Inbox/NDT-rapporter/RT-26-167.txt`

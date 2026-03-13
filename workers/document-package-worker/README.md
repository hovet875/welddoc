# Document Package Worker

NAS worker for `document_package_jobs`.

It runs outside the frontend, authenticates with the Supabase service role key, and uses the stored package snapshot as the single source of truth for:

- ZIP structure
- included source files
- generated main PDF content

## What it does

1. polls queued jobs from `document_package_jobs`
2. atomically claims a job by switching it to `running`
3. downloads source files listed in `snapshot.source_zip.sections`
4. renders the main PDF by opening the hidden app route `/worker/document-package-render`
5. assembles the ZIP exactly from `relative_path`
6. uploads PDF / ZIP as Supabase `files`
7. updates progress fields and artifact ids on the job row

It also:

- updates `heartbeat_at` periodically while a job is running
- marks stale `running` jobs as `failed` when the heartbeat timeout is exceeded
- fails fast if the hidden render route reports an explicit render error
- cleans up uploaded artifacts again if a later upload step or final job completion fails

## Required env

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Optional env

- `WELDDOC_POLL_MS`
  Default `5000`
- `WELDDOC_JOB_LIMIT`
  Default `3`
- `WELDDOC_HEARTBEAT_MS`
  Default `10000`
- `WELDDOC_STALE_JOB_TIMEOUT_MS`
  Default `900000`
- `WELDDOC_DIST_DIR`
  Default `dist`
- `WELDDOC_STATIC_PORT`
  Default `4173`
- `WELDDOC_WORKER_ID`
  Worker identity stored in `worker_ref`
- `WELDDOC_ARTIFACT_BUCKET`
  Default `files`
- `WELDDOC_ARTIFACT_PREFIX`
  Default `document-package-artifacts`
- `WELDDOC_HEADLESS`
  Set `false` for visible browser during debugging
- `WELDDOC_RUN_ONCE`
  Set `true` to process available queued jobs once and exit

## Local run

From repo root:

```bash
npm run build
npm --prefix workers/document-package-worker install
npm run document-package:smoke
node workers/document-package-worker/index.mjs
```

Or only the render smoke check:

```bash
npm run build
npm --prefix workers/document-package-worker run smoke:render
```

## Staging verification

When staging credentials and one queued `document_package_jobs` row are available, the smallest real verification run is:

```bash
npm run build
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
WELDDOC_WORKER_ID=staging-smoke \
WELDDOC_RUN_ONCE=true \
node workers/document-package-worker/index.mjs
```

Verify afterwards in Supabase that the processed job has:

- `status = completed`
- heartbeat/progress updates during execution
- `main_pdf_file_id` and/or `source_zip_file_id`
- matching `files` rows and storage objects

If you want to test cleanup behavior, force a failure after the first artifact upload and confirm that uploaded storage objects and `files` rows are removed again.

One minimal staging run has already been completed once from this worker flow. That verified real job claim, main-PDF render, artifact upload, and cleanup of the temporary verification artifacts afterwards. The main live gap that still remains is a staging run that also exercises `source_zip` and a controlled post-upload failure.

## Docker

Build from repo root:

```bash
docker build -f workers/document-package-worker/Dockerfile -t welddoc-document-package-worker .
```

Run:

```bash
docker run --rm \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e WELDDOC_WORKER_ID=synology-nas-1 \
  welddoc-document-package-worker
```

## Synology Container Manager

Repo examples for Synology live here:

- `workers/document-package-worker/docker-compose.synology.yml`
- `workers/document-package-worker/.env.synology.example`
- `docs/synology-document-package-worker.md`

Recommended flow:

1. keep the repo on the NAS so Container Manager can build from repo root
2. copy `.env.synology.example` to `.env.synology` on the NAS and fill in the real values there
3. import `docker-compose.synology.yml` into Container Manager as a Project
4. build and start the worker with `restart: unless-stopped`
5. verify one queued job end-to-end before leaving it running continuously

If the service role key has ever been pasted into chat, logs, or terminal transcripts, rotate it before production deployment.

## Important constraint

Do not move package linkage logic into the worker.

The worker should consume the snapshot already stored in the job payload. If package rules change, update the snapshot builder in the app repo instead of adding more NAS-side interpretation.

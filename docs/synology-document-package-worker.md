# Synology Document Package Worker

Last updated: 2026-03-12

## Goal

Run the document-package worker as a long-running Container Manager project on Synology without storing the Supabase service role key in tracked repo files.

The repo now contains a Synology-ready baseline:

- `workers/document-package-worker/docker-compose.synology.yml`
- `workers/document-package-worker/.env.synology.example`
- `workers/document-package-worker/Dockerfile`

## Recommended NAS layout

Keep the repo itself on the NAS so Container Manager can build from repo root:

```text
/volume1/docker/welddoc-app/
  package.json
  src/
  workers/
    document-package-worker/
      docker-compose.synology.yml
      .env.synology
```

The compose file expects to stay in `workers/document-package-worker/` and builds with `context: ../..` so the full app can be built once and the worker can copy `dist` into the runtime image.

## 1. Prepare the NAS repo folder

1. Put the WeldDoc repo on the NAS, for example under `/volume1/docker/welddoc-app`.
2. Ensure the Synology box has enough free disk for one frontend build plus Playwright Chromium.
3. If the NAS is arm64, build on that NAS or publish an arm64 image separately. The provided compose file uses local build so host architecture is handled automatically.

## 2. Create the runtime env file

Copy:

- `workers/document-package-worker/.env.synology.example`

to:

- `workers/document-package-worker/.env.synology`

Fill in at minimum:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WELDDOC_WORKER_ID`

Recommended starting values already in the example:

- `WELDDOC_JOB_LIMIT=1`
  Safer on a NAS until real load is known
- `WELDDOC_POLL_MS=5000`
- `WELDDOC_HEARTBEAT_MS=10000`
- `WELDDOC_STALE_JOB_TIMEOUT_MS=900000`
- `WELDDOC_HEADLESS=true`

`WELDDOC_RUN_ONCE` should normally stay unset. Use it only for a one-shot verification run.

## 3. Create the Container Manager project

In Synology Container Manager:

1. Open `Project`.
2. Choose `Create`.
3. Import the compose file `workers/document-package-worker/docker-compose.synology.yml` from the NAS repo folder.
4. Keep the project rooted in the same worker folder so `.env.synology` resolves next to the compose file.
5. Build and start the project.

The provided compose file sets:

- `restart: unless-stopped`
- `init: true`
- `shm_size: 1gb`
- capped json-file logs

The extra shared memory is important because Playwright Chromium is much more stable with a larger `/dev/shm` than the Docker default.

## 4. First-run verification

Recommended first verification on NAS:

1. Queue one small document-package job in staging.
2. Temporarily add `WELDDOC_RUN_ONCE=true` to `.env.synology`.
3. Recreate the project once.
4. Confirm the worker logs show job claim and completion.
5. Remove `WELDDOC_RUN_ONCE=true` and recreate the project again for continuous polling.

Expected log shape:

- `Document package worker started as ...`
- `Processing package job ...`
- `Completed package job ...`

Expected Supabase state:

- `status` moves `queued -> running -> completed`
- `worker_ref` is filled with the NAS worker id
- `heartbeat_at` changes while the job runs
- `main_pdf_file_id` and/or `source_zip_file_id` point at real `files` rows

## 5. Updating the worker later

When the repo changes:

1. Pull the latest repo version onto the NAS.
2. Rebuild the Container Manager project.
3. Watch the worker logs for a clean restart.

If the service role key changes, update only `.env.synology` and recreate the project.

## Practical notes

- The worker image now uses a multi-stage Docker build so runtime does not carry the full root `node_modules` tree.
- Root `.dockerignore` now excludes local `node_modules`, `dist`, and `.env.*` files from the build context.
- `.gitignore` now ignores `.env.*`, so the real NAS env file is less likely to be committed by mistake.
- If the service role key has ever appeared in chat logs or terminal transcripts, rotate it before production use.

## Remaining live verification gap

One real staging worker run has already been completed for a minimal main-PDF job.

What still should be verified from the NAS deployment itself:

1. one staging run that also includes `source_zip`
2. one controlled failure after first artifact upload to confirm cleanup behavior outside local smoke
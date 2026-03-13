# Documentation Package Worker

Last updated: 2026-03-12

## Goal

Run package jobs on a NAS-hosted worker without exposing the Supabase service role key in the frontend.

The browser is responsible for:

- selecting package contents
- building the package snapshot from the same logic used by preview
- creating the package job in Supabase

The NAS worker is responsible for:

- polling `document_package_jobs` for queued jobs
- reading the versioned contract from `options`
- downloading source files referenced by the snapshot
- rendering the main PDF from the snapshot when requested
- assembling the ZIP from the snapshot manifest
- uploading finished artifacts to Supabase Storage
- updating job progress and artifact references back to Supabase

## Status now

This worker path is now past the initial proof-of-concept stage.

Implemented and hardened in repo:

- frontend builds a materialized `documentation-package-v2` snapshot and stores that contract on the job row
- worker route exists in production build and is reachable through SPA fallback
- Docker image builds successfully from repo root and resolves frontend `dist` as `/app/dist`
- worker renders the main PDF from the stored snapshot by opening `/worker/document-package-render`
- worker assembles the ZIP strictly from `snapshot.source_zip.sections[].files[].relative_path`
- worker uploads PDF and ZIP artifacts and writes `main_pdf_file_id` / `source_zip_file_id` back to the job
- worker route now boots in a dedicated React mount without `AuthProvider`, route guards, or frontend Supabase bootstrap
- worker render route now reports `loading`, `true`, or `error` explicitly through DOM dataset flags
- worker process now fails fast if the render page reports `error` instead of waiting only for a success timeout
- worker process now sends periodic heartbeat updates while a job is running
- worker process now marks stale `running` jobs as `failed` after heartbeat timeout instead of leaving them stuck forever
- worker now compensates partial artifact failures by deleting uploaded storage objects and `files` rows if later upload or final job completion fails
- frontend job creation now blocks when the project already has an active `queued` or `running` package job

Verified locally during assessment:

- `npm run build` produced a valid static SPA bundle for the worker route
- direct HTTP GET to `/worker/document-package-render` returned the production app shell with `200 OK`
- Docker build for `workers/document-package-worker/Dockerfile` completed successfully
- built container contains `/app/dist/index.html`
- local render smoke script now passes for both the explicit success path and the explicit error path
- GitHub Actions workflow now runs build + render smoke automatically on push and pull request

Verified once against real staging Supabase:

- one minimal `WELDDOC_RUN_ONCE=true` worker run was executed against staging with a real queued job
- the worker claimed the job, rendered the main PDF, uploaded the artifact, and marked the job `completed`
- the temporary staging artifact, related `files` row, and test job row were deleted again after verification

## Frontend / Worker split

The important rule is:

- the NAS worker must consume the materialized snapshot
- it should not re-implement package linkage rules locally

Current source of truth:

- snapshot builder:
  `src/react/features/project-details/sections/documentation-package/preview/buildDocumentPackageSnapshot.ts`
- PDF renderer:
  `src/documents/package/DocumentPackageMainPdf.tsx`
- hidden worker render route:
  `src/react/features/worker/WorkerDocumentPackageRenderPage.tsx`
- worker contract:
  `src/documents/package/documentPackageJobContract.ts`

## Contract shape

The current job payload is `documentation-package-v2`.

It includes:

- selected requested documents
- requested artifact names
- ordered worker progress steps
- `snapshot`

The snapshot contains:

- `main_pdf.data`
  Exact browser preview data for `DocumentPackageMainPdf`
- `source_zip.sections`
  Explicit ZIP folders and files with `relative_path`

This means the worker can produce output without discovering project linkage on its own.

## Runtime hardening

### Worker render isolation

The hidden render route is now mounted through a dedicated worker-only React entrypoint.

That means the render path no longer depends on:

- `AuthProvider`
- `supabase.auth.getSession()`
- route guards
- normal app route preloading
- service worker registration for this route

This reduces production failure modes for the NAS worker and makes the route closer to a pure snapshot renderer.

### Render readiness contract

The render page now uses the following DOM states:

- `document.documentElement.dataset.documentPackageRenderReady = "loading"`
- `document.documentElement.dataset.documentPackageRenderReady = "true"`
- `document.documentElement.dataset.documentPackageRenderReady = "error"`

On error it also sets:

- `document.documentElement.dataset.documentPackageRenderError`

The worker now waits for either success or error and throws immediately when the page reports `error`.

### Heartbeat and stale job recovery

While a job is running, the worker now updates `heartbeat_at` on a fixed interval.

On each poll cycle, any `running` job whose heartbeat is older than the configured stale timeout is marked as `failed`.

New worker env vars:

- `WELDDOC_HEARTBEAT_MS`
  Default `10000`
- `WELDDOC_STALE_JOB_TIMEOUT_MS`
  Default `900000`

## Job progress fields

`document_package_jobs` now supports:

- `progress_percent`
- `progress_step`
- `progress_message`
- `progress_details`
- `worker_ref`
- `heartbeat_at`
- `main_pdf_file_id`
- `source_zip_file_id`

Recommended worker progression:

1. set `status = 'running'`, `progress_step = 'snapshot_received'`, `progress_percent = 5`
2. set `progress_step = 'downloading_source_files'`
3. if `main_pdf.enabled`, set `progress_step = 'rendering_main_pdf'`
4. if `source_zip.enabled`, set `progress_step = 'assembling_zip'`
5. set `progress_step = 'uploading_artifacts'`
6. set `progress_step = 'finalizing_job'`
7. set `status = 'completed'`, `progress_percent = 100`, `finished_at = now()`

If a job fails:

- set `status = 'failed'`
- write a concrete `error_message`
- keep the latest `progress_step` and `progress_message`

## Artifact handling

The frontend expects:

- ZIP download from `source_zip_file_id`
- optional PDF download from `main_pdf_file_id`

The older `artifact_file_id` can remain for compatibility, but new worker code should treat:

- `source_zip_file_id` as the primary downloadable package artifact
- `main_pdf_file_id` as the optional generated PDF artifact

## What remains

These are still real production gaps after the hardening above:

- only one minimal main-PDF staging run has been verified so far; a live staging run that also exercises `source_zip` is still missing
- there is still no explicit retry or requeue workflow for failed jobs beyond creating a new job
- worker dependency installation is now lockfile-backed, but the container still depends on Playwright browser installation succeeding at build time
- stale job recovery marks old `running` jobs as `failed`; if the intended product behavior should instead be automatic retry, that policy still needs to be designed explicitly
- Synology/NAS deployment still needs first-run environment setup and runtime monitoring, even though repo examples now exist for Container Manager

## Recommended next steps

1. Run one staging job that includes both PDF and ZIP, then verify both artifact references and storage objects together.
2. Force one controlled post-upload failure and confirm artifact cleanup still works end-to-end outside local smoke.
3. Decide whether stale jobs should stay `failed` or be moved back to `queued` under controlled rules.
4. Deploy the worker on Synology with `workers/document-package-worker/docker-compose.synology.yml` and confirm heartbeat/logging from NAS.

## NAS worker notes

The NAS container should keep only operational concerns locally:

- polling / claiming jobs
- downloading files
- rendering / zipping
- uploading artifacts
- updating progress

Current NAS worker scaffold:

- `workers/document-package-worker/index.mjs`
- `workers/document-package-worker/Dockerfile`
- `workers/document-package-worker/README.md`
- `workers/document-package-worker/docker-compose.synology.yml`
- `workers/document-package-worker/.env.synology.example`

Synology-specific rollout notes live in:

- `docs/synology-document-package-worker.md`

It should not hardcode:

- folder membership logic
- project linkage rules
- PDF section inclusion rules
- file naming inside ZIP beyond the provided snapshot paths

Those rules are maintained in this repo and are already materialized into the stored snapshot.

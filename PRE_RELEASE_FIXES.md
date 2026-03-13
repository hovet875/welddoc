# PRE_RELEASE_FIXES

## Project context
- Solo developer
- App is pre-release
- Goal: pragmatic hardening before first release
- No over-engineering
- Prefer small safe changes over rewrites
- Prefer use of global components where it is possible, and a good solution. Prefer mantine components.
- Prefer low use of hardcoded styling.
- Home quick actions on the front page are intentionally available to both `profiles.role=admin` and `profiles.role=user`. Do not treat that as an auth bug. The stricter create/edit/delete messaging inside some project-detail sections is a separate product/UI rule and should be evaluated on its own if it becomes confusing.

## Fixed

### Explicit placeholder drawing workflow
- Status: fixed on 2026-03-10
- Priority: high
- Implemented: `supabase/migrations/058_project_drawings_placeholders.sql` makes `project_drawings.file_id` nullable and adds `is_placeholder`, so placeholders are explicit drawing rows without synthetic storage files. `src/repo/projectDrawingRepo.ts` now creates placeholders without uploading PDFs and adds a safe file-attach flow that converts an existing drawing row into a real PDF-backed drawing. `src/react/features/project-details/sections/drawings/ProjectDrawingsSection.tsx` now exposes explicit placeholder creation, reuses placeholders when a matching PDF is uploaded, and `src/react/features/project-details/sections/weld-log/hooks/useProjectWeldLogData.ts` no longer writes during data load.
- Why this approach was chosen: It keeps `project_weld_logs.drawing_id` unchanged, avoids placeholder file garbage in storage, and limits the change to the existing drawings and weld-log flows instead of redesigning the model.
- Manual verification:
  1. Open a project with no drawings and confirm the weld-log page no longer creates a drawing automatically.
  2. Create two or more midlertidige tegninger on the same project and confirm they all appear without PDFs.
  3. Upload a PDF with the same tegningsnr as one placeholder and confirm the same drawing row now has a PDF instead of a new weld-log target.
  4. Edit an existing placeholder row and upload a PDF there, then confirm weld logs still point to the same drawing.
  5. Delete a placeholder and confirm there is no leftover file; replace a legacy or existing drawing PDF and confirm the same file id/path is reused.

### WPS/WPQR file create flow cleanup
- Status: fixed on 2026-03-09
- Priority: high
- Implemented: `src/repo/wpsRepo.ts` now tracks whether the file upload succeeded and whether the `files` row was created for both WPQR and WPS create flows. If the flow fails, it deletes the file record when present, otherwise removes the uploaded storage object directly, then deletes the partially created WPQR/WPS row.
- Why this approach was chosen: It mirrors the safer pattern already used in `src/repo/certRepo.ts` and keeps the change local to the broken cleanup path.
- Manual verification:
  1. Create WPQR with PDF and confirm row + file exists.
  2. Create WPS with PDF and confirm row + file exists.
  3. Force a failure after upload but before full completion and verify no orphan file remains.
  4. Confirm retrying the same create flow does not leave duplicate garbage.

### File deletion order and cleanup failure surfacing
- Status: fixed on 2026-03-09
- Priority: high
- Implemented: `src/repo/fileRepo.ts` now fetches metadata, deletes the `files` row first, then removes the storage object and throws a clear cleanup error if storage removal fails. The same delete semantics were mirrored in the local helper inside `src/repo/certRepo.ts`, which had the same risk.
- Why this approach was chosen: The FK layout allows DB-first delete once owning rows or links have already been cleared, and DB-first avoids leaving broken file references behind if the database delete fails.
- Manual verification:
  1. Delete a record with an attached file and confirm both DB row and storage object are removed.
  2. Simulate a failing storage delete and confirm the app surfaces the cleanup failure clearly.
  3. Simulate a failing DB delete and confirm no silent broken record remains.

### Auth transient failure handling
- Status: fixed on 2026-03-09
- Priority: high
- Implemented: `src/react/auth/AuthProvider.tsx` now keeps the current session on transient access/profile failures instead of forcing logout. `src/auth/authClient.ts` now throws on `getSession()` failure so the provider can distinguish a real fetch error from "no session". `src/react/layout/AppPageLayout.tsx` now shows a retryable warning inside authenticated pages.
- Why this approach was chosen: It keeps true access denial behavior intact while removing the user-hostile logout path for temporary network or backend problems.
- Manual verification:
  1. Simulate a temporary network failure during access check and confirm the user is not forcibly logged out.
  2. Disable a user account and confirm the user is still denied correctly.
  3. Refresh while offline and confirm the UI shows a useful retryable warning instead of hard logout.

### Admin token fetch brittleness
- Status: fixed on 2026-03-10
- Priority: medium
- Implemented: `src/auth/authClient.ts` now exposes `getAccessToken()` so admin flows use the same auth/session path as the rest of the app. The helper first tries the current cached session and then retries through `supabase.auth.refreshSession()` before failing. `src/react/features/settings/users/UsersPage.tsx` now uses that helper for `insert-user` and `update-user` function calls instead of calling `supabase.auth.getSession()` directly.
- Why this approach was chosen: It keeps the fix local to admin actions, reuses the existing auth client, and adds one small retry path without changing broader auth behavior.
- Manual verification:
  1. Perform admin user create/edit actions after an idle period and confirm they still succeed.
  2. Refresh the page, navigate back to users, and confirm the first admin action still gets a valid token.
  3. If token acquisition truly fails, confirm the user gets the actionable "Prøv igjen eller logg inn på nytt" message.

### ProjectsPage reload/pagination state
- Status: fixed on 2026-03-10
- Priority: medium
- Implemented: `src/react/features/projects/ProjectsPage.tsx` now keeps filters, page, page size, and row refreshes in one local reducer-driven query state instead of separate state variables plus `rowsReloadKey`. Row loading now ignores stale requests with a request ref, resets paging atomically when filters change, and keeps delete refreshes local without forcing page 1 unless the save flow explicitly asks for it.
- Why this approach was chosen: It removes the brittle reload-key coordination without introducing a new state tool or moving logic out of the page. The reducer keeps the change local and makes filter/page transitions easier to reason about.
- Manual verification:
  1. Change filters rapidly while paging and confirm the table always lands on the correct first page for the active filters.
  2. Save and delete rows while filtered and confirm the total count and current page remain sensible.
  3. Reload repeatedly and confirm no duplicate or stale rows appear after quick changes.

### Async retry/error handling inconsistencies
- Status: fixed on 2026-03-10
- Priority: medium
- Implemented: `src/react/ui/AppAsyncState.tsx` now supports an optional retry action in the inline error state. That retry path is adopted in `src/react/features/projects/components/ProjectsTable.tsx`, `src/react/features/home/components/RecentProjectsPanel.tsx`, `src/react/features/home/components/CertificateStatusPanel.tsx`, `src/react/features/project-details/sections/traceability/ProjectTraceabilitySection.tsx`, and `src/react/features/project-details/sections/weld-log/ProjectWeldLogSection.tsx`. The two home panels also now guard against stale overlapping fetches with a request ref so retries and fast reloads do not race old responses back in.
- Why this approach was chosen: It improves recovery from transient fetch errors with one small shared component change, then only wires it into screens that already have a clear local reload path. That keeps scope local and avoids a broader async-state rewrite before release.
- Manual verification:
  1. Trigger a transient fetch failure on the projects page, home panels, and project detail sections and confirm each screen offers a retry.
  2. Retry successfully and confirm the component recovers without full page reload.
  3. Confirm loading, error, and empty states still remain visually clear.

### Null suspense fallback
- Status: fixed on 2026-03-10
- Priority: low
- Implemented: `src/react/router/RouteGuards.tsx` now exports the existing route loading screen, and `src/react/router/AppRouter.tsx` uses that component as the `Suspense` fallback instead of `null`.
- Why this approach was chosen: It removes the blank transition state with the smallest possible change and reuses the same loading UI already shown while auth state is resolving.
- Manual verification:
  1. Navigate between lazy-loaded pages on a slower connection and confirm the app shows a loader instead of a blank area.
  2. Refresh directly into a lazy-loaded route and confirm loading feedback is visible until the page renders.
  3. Confirm authenticated and public route guards still show the same loading UI as before.

### Settings profile load failure can overwrite existing data
- Status: fixed on 2026-03-10
- Priority: high
- Implemented: `src/react/features/settings/hooks/useSettingsData.ts` now treats profile read failures as real load errors instead of silently falling back to a partial form state. The hook exposes `error`, `canSave`, and `reload()`, preserves the current form values on failed reload, and blocks `save()` until a successful profile read has completed. `src/react/features/settings/components/SettingsProfileForm.tsx` now shows a retryable load error, surfaces save failures inline with a retry action, and disables editing/saving while the profile is not in a safe loaded state. `src/react/features/settings/SettingsPage.tsx` wires the retry paths through and normalizes raw network save errors such as `Failed to fetch` into a clearer user message.
- Why this approach was chosen: It keeps the fix local to the settings flow and removes the data-loss path without redesigning the form or auth model.
- Manual verification:
  1. Simulate a failing `profiles` fetch and confirm the page shows a clear load error instead of a silently reset form.
  2. Confirm save is blocked while the profile read is in an error state.
  3. Recover the fetch and confirm the real stored values load back in without clearing fields.
  4. Simulate going offline after the form has loaded, press save, and confirm the page shows a clear inline save error with retry without losing the edited form values.

### NDT report search correctness and debounced fetch churn
- Status: fixed on 2026-03-10
- Priority: medium
- Implemented: `src/react/features/ndt/NdtPage.tsx` now builds the effective server filters from stable primitive dependencies, so changing only the live query input no longer retriggers row fetches until the debounced query value updates. `src/repo/ndtReportRepo.ts` now resolves text search matches across report title/customer plus related file labels, NDT inspectors, and NDT suppliers, then applies those matching report ids consistently to list, count, and RT stats queries. `src/react/features/ndt/components/NdtReportsPanel.tsx` now also exposes the shared inline retry action for table load errors.
- Why this approach was chosen: It fixes the fetch-churn bug and aligns backend search with the UI promise using a local repo-layer change, without introducing a new search service or redesigning the page state.
- Manual verification:
  1. Type quickly in the NDT search field and confirm the page only reloads after the debounce pause.
  2. Search by existing file name, inspector, customer, supplier, and project number and confirm the expected reports are returned.
  3. Confirm RT statistics still match the filtered report set and that retry recovers the table after a transient load failure.

### Material certificate heat search mismatch
- Status: fixed on 2026-03-10
- Priority: medium
- Implemented: `src/repo/materialCertificateRepo.ts` now resolves list text queries through both the existing certificate text fields and the `material_certificate_heats` view, then scopes the paged certificate query to the union of matching certificate ids. That means the existing list search now actually finds certificates by stored heat numbers while preserving the current supplier/cert/filler text matching.
- Why this approach was chosen: The repo already had a dedicated `material_certificate_heats` view, so the smallest safe fix was to reuse that database projection instead of changing the UI copy or bolting on client-side filtering after pagination.
- Manual verification:
  1. Search by a known heat number and confirm the matching certificate row appears.
  2. Confirm supplier and cert type searches still work as before.
  3. Confirm both material and filler certificate tabs behave consistently with heat search.

### Global runtime error screen was taking down the whole app
- Status: fixed on 2026-03-12
- Priority: medium
- Implemented: `src/main.ts` no longer leaves the raw global `error` / `unhandledrejection` screen active after the React app has mounted. The destructive fallback is now limited to true bootstrap failures only, and known noisy browser/runtime messages such as `ResizeObserver loop completed with undelivered notifications` and extension-style async response noise are ignored during boot fallback handling. As related low-risk hardening, `vite.config.ts` now disables Workbox `navigationPreload`, and `src/react/features/home/components/UbibotChart.tsx` waits for a measurable container width before rendering the chart.
- Why this approach was chosen: The real issue was not that all runtime errors needed a bigger error screen, but that a boot-only emergency fallback was still active after successful mount. Restricting that behavior to bootstrap fixes the blank-screen regression without redesigning the broader runtime notification/logging path right before release.
- Manual verification:
  1. Trigger a rejected promise after the React app has mounted and confirm the UI is not replaced by a raw error screen.
  2. Trigger a real startup failure before mount and confirm the fatal fallback still appears.
  3. Open the homepage and confirm the Ubibot panel no longer contributes to a full blank screen during initial layout.
  4. Refresh with an existing service worker and confirm the app still boots normally without extra navigation preload noise.

## Remaining before release

### Idempotent ensure helpers under concurrent use
- Status: not started
- Priority: medium
- Problem: `src/repo/weldLogRepo.ts` `ensureProjectWeldLog()` and `src/repo/supplierRepo.ts` `ensureSupplierExists()` both use a read-then-insert pattern against database uniqueness rules. Under concurrent tabs, retries, or two users creating the same resource at once, they can still throw duplicate-key errors even though the logical intent is "ensure it exists".
- Why it matters: This creates intermittent user-visible failures in otherwise normal workflows, especially during quick retries or simultaneous admin work.
- Smallest safe fix: Make these helpers idempotent by using `upsert` where possible, or by catching unique-constraint violations and re-reading the existing row. Keep the fix local to the helper layer.
- Files to inspect:
  - `src/repo/weldLogRepo.ts`
  - `src/repo/supplierRepo.ts`
  - `supabase/supabase_schema.sql`
- Manual verification:
  1. Trigger two rapid create flows that need the same weld log and confirm only one row is created without a duplicate-key error.
  2. Trigger two rapid flows that try to create the same supplier name and confirm the user does not see a duplicate-key failure.
  3. Confirm normal single-user create flows still behave exactly as before.

## Safe to defer

### ProjectWeldLogSection.tsx complexity
- Status: not started
- Priority: low
- Why it can wait: The file is clearly too large and mixed-responsibility, but it is still understandable enough to work on if scope is kept narrow. A broad refactor before release is more likely to create regressions than reduce risk.
- What signal would mean it should be prioritized later: Repeated bugs in weld-log changes, rising change cost for simple edits, or difficulty adding one small feature without touching many unrelated states.

### Broader cleanup and standardization work
- Status: not started
- Priority: low
- Why it can wait: There are clear opportunities to standardize async hooks, modal state, file workflow helpers, and section structure. None of that is required for a safe first release if the targeted fixes above are handled.
- What signal would mean it should be prioritized later: Frequent repeated bug patterns, copy-paste fixes across many files, or onboarding friction when revisiting the code after a break.

## Rules for future implementation chats
- Focus on one fix at a time
- Prefer the smallest safe fix
- Avoid broad refactors unless required
- Do not redesign architecture unless the current design blocks a safe fix
- Preserve existing behavior unless the behavior is the bug
- When implementing a fix, explain:
  - what will change
  - why this approach was chosen
  - how to verify it

## Suggested workflow
1. Pick one issue
2. Inspect the listed files
3. Propose the smallest safe change
4. Implement
5. Add manual verification notes
6. Stop before expanding scope

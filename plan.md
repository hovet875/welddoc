# Documentation Package Plan

Last updated: 2026-03-12

## Goal

Build the project documentation package around two deliverables:

- one generated customer-facing PDF summary
- one ZIP with project-linked source files in a fixed folder structure

The same document composition model should continue to support browser preview now and worker-side generation later.

## Confirmed Product Direction

### Core separation

The feature now has an explicit split between:

- internal package control in the UI
- customer-facing generated PDF output

Internal readiness, missing links, unresolved references and selection logic belong in the package page.
The generated PDF shall only present included customer-facing content.

### ZIP folder structure

The ZIP shall contain:

- `01_Arbeidsordre/`
- `02_Tegninger/`
- `03_Materialsertifikater/`
- `04_Tilsettsertifikater/`
- `05_Sveiseprosedyrer_WPS_WPQR/`
- `06_Sveisesertifikater/`
- `07_NDT-rapporter/`
- `08_Kalibreringssertifikater/`

Only files that actually belong to the project through work order, drawings, traceability, weld log or pressure-test linkage shall be included.

### Main PDF structure

The current intended main PDF structure is:

- cover page
- register with actual page references
- package overview
- material traceability when included
- weld log sections when included
- pressure test later

The PDF should remain customer-facing. It should not expose internal states such as missing, partial, pending, unresolved or not-yet-linked.

## Current Status

### Implemented now

The current browser-side implementation includes:

- documentation package page with checkbox-based selection of package contents
- internal readiness and availability snapshot for each package deliverable
- package job creation and package job status handling
- main PDF browser preview
- customer-facing cover page as its own component
- register with computed page references
- package overview grouped by delivery section with file rows per section
- material traceability section using certificate/document references instead of status labels
- weld log section with real multi-page splitting instead of a single infinitely growing page
- package overview, material traceability and weld log split into multiple `DocumentPage` surfaces when needed
- fixed-height document pages in preview and print styling so sections paginate instead of stretching vertically

### Build status

The documentation package flow currently builds cleanly with `npm run build`.

The remaining build output seen during validation comes from existing Vite/Mantine warnings in `node_modules` and is not specific to this feature.

## Current UX / Output Rules

### Package page

The package page is now the internal control surface.

It currently:

- shows package cards with descriptive naming
- uses explicit selection checkboxes for included content
- removes the old per-card open action from the package card itself
- keeps readiness and internal status language in the UI only
- drives both preview and job creation from selected document keys

Important current limitation:

- selection state is currently local UI state and is not yet persisted per project

### Main PDF

The current PDF behavior is:

- cover page contains logo, title and project identity only
- register contains actual page references for generated sections
- package overview is grouped by leveransedel, with files listed as table rows
- package overview tries to keep multiple small modules on the same page rather than forcing one module per page
- module title and delivery location render on the same line, with the location right-aligned
- long tabular sections use explicit row-based splitting to avoid footer collisions

Current pagination assumptions:

- register page count is computed from fixed rows-per-page constants
- package overview page count is computed from grouped section slices
- material traceability page count is computed from fixed row limits
- weld log page count is computed from fixed row limits

If layout density changes later, those constants must be updated so register page references stay correct.

## Current Source Coverage

The frontend can already reason about project-linked package content for:

- work order
- drawings
- material certificates linked through project traceability
- filler certificates linked through project traceability
- WPS linked through project weld log
- WPQR linked through WPS rows used in project weld log
- welder certificates linked through project weld log
- NDT reports linked through project weld log
- NDT personnel certificates inferred from report inspector usage where matching certificate metadata exists
- pressure-test gauge certificate / calibration file when present

## Implementation Map

### Main package page

Primary UI entry point:

- `src/react/features/project-details/sections/documentation-package/ProjectDocumentationPackageSection.tsx`

This file owns:

- package selection state
- preview action
- package request action
- mapping of readiness snapshot to internal package cards

### Readiness and linkage helpers

Internal readiness snapshot:

- `src/react/features/project-details/sections/documentation-package/hooks/useDocumentationPackageReadiness.ts`

Shared package linkage helpers:

- `src/react/features/project-details/sections/documentation-package/lib/documentPackageData.ts`

These helpers are the current browser-side source of truth for project-linked file discovery.

### PDF composition

Main PDF data loader:

- `src/react/features/project-details/sections/documentation-package/preview/loadDocumentPackageMainPdfData.ts`

Main PDF renderer:

- `src/documents/package/DocumentPackageMainPdf.tsx`

Cover page component:

- `src/documents/package/DocumentPackageCoverPage.tsx`

Package PDF types:

- `src/documents/package/documentPackageMainPdf.types.ts`

### Shared document infrastructure

Shared document primitives live under:

- `src/documents/core/`

Shared document styling lives under:

- `src/documents/styles/documentBase.css`
- `src/documents/styles/documentPrint.css`

Shared pagination helpers for fixed row-based page splitting:

- `src/documents/core/documentPagination.ts`

### Section documents used by the package

Material traceability section:

- `src/documents/material-traceability/MaterialTraceabilityDocument.tsx`

Weld log section:

- `src/documents/weld-log/WeldLogDocument.tsx`

## Worker / Contract Status

Package jobs remain the contract for an external worker that will eventually:

- render the main PDF
- assemble the ZIP
- upload artifacts
- expose downloadable outputs

Current worker-related status:

- versioned worker contract remains in `src/documents/package/documentPackageJobContract.ts`
- package job creation is active in the frontend
- package jobs now carry a materialized snapshot built from the same browser-side package logic as preview
- main PDF section keys no longer advertise pressure test before that section exists
- job progress and separate PDF / ZIP artifact slots are now part of the package job model
- NAS worker flow is documented in `docs/documentation-package-worker.md`

Not yet implemented:

- worker-side rendering of the main PDF
- worker-side ZIP assembly
- artifact upload and download delivery
- NAS-side polling / claiming / heartbeat implementation

## Known Limitations

### Selection persistence

The selected package contents are not yet persisted per project.

### Pressure test inside main PDF

Pressure test content is still not part of the generated main PDF.

### Pagination model

Page references are currently derived from fixed row limits, not from layout measurement.

This is acceptable for now, but if table density, typography or footer/header height changes materially, page reference calculations must be revisited.

### NDT personnel certificate linkage

NDT personnel certificate linkage still depends on matching report inspector metadata to available certificate metadata.

If that relation becomes ambiguous, `07_NDT-rapporter/` may remain operational but not fully authoritative.

## Recommended Next Steps

1. Persist package selection per project so included content survives reloads and can be reused for later regeneration.
2. Implement worker-side rendering of the current main PDF structure using the existing package job contract.
3. Implement worker-side ZIP assembly for `01` through `08` using the same linkage rules as the browser-side preview path.
4. Add pressure test as a generated section in the main PDF.
5. Tighten NDT personnel certificate linkage so all NDT-related ZIP content is unambiguous.
6. If future layout changes are expected, centralize rows-per-page constants and document how register page references are recalculated.

## Practical Continuation Notes

If work resumes later, the safest continuation order is:

1. keep the current browser-side linkage helpers as the reference model
2. mirror that model in the worker instead of inventing a second package interpretation
3. add persistence for selected package contents before changing the job payload shape
4. treat package overview and register page-reference logic as coupled to pagination constants

This should allow further implementation without re-discovering the current package behavior from scratch.

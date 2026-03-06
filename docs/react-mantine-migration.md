# React + Mantine Migration Checklist

## Target State
- React is the default app shell and routing layer.
- Mantine theme is the styling foundation for all React UI.
- Legacy pages can coexist, but their CSS must not leak into React pages.

## Ground Rules
- Theme-first: use `src/react/ui/mantineTheme.ts` for colors, spacing, radius, shadows, and component defaults.
- React UI-first: use `App*` wrappers in `src/react/ui` for all common controls.
- No new global utility classes like `.btn`, `.input`, `.panel` for React features.
- Legacy CSS must be scoped by legacy page class or `.legacy-scope`.

## Per-Page Migration Checklist
1. Route
- Move route to React page in `src/react/router/AppRouter.tsx`.
- Keep legacy fallback route only when needed.

2. UI Components
- Replace raw controls with `AppButton`, `AppLinkButton`, `AppTextInput`, `AppNativeSelect`, `AppCheckbox`, `AppMonthPicker`, `AppRefreshIconButton`, `AppActionsMenu`.
- Use Mantine/Tabler icons consistently.

3. Styling
- Keep page layout classes if needed (`shell`, `main`, page root class).
- Move visual decisions to Mantine theme tokens.
- Remove hardcoded component colors where a theme token exists.

4. Legacy Boundary
- Scope remaining legacy-only CSS to page root class (`.page-*`) or `.legacy-scope`.
- Avoid generic selectors that can affect React pages.

5. Validation
- Run `npm exec tsc -- --noEmit`.
- Smoke-test: login, home, settings, company settings, users.

## Current Focus
- Continue replacing legacy action patterns with `AppActionsMenu`.
- Keep refresh actions standardized with `AppRefreshIconButton`.
- Keep date/month selection standardized with Mantine-based picker components.
- Track legacy decommission work in `docs/legacy-out-plan.md`.

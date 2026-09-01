# PALE Client Design Instructions

These instructions apply to every file under `client/`.

## Design intent

- Preserve the existing PALE Records editorial, Swiss, and restrained brutalist direction across the entire client.
- Treat `src/index.css`, its `@theme` tokens, and the generic components in `src/components/ui/` as the visual source of truth.
- Extend the current system instead of introducing a second theme, a generic dashboard aesthetic, or page-specific styling conventions.
- Keep the interface purposeful and grounded in the real class-record product: classes, students, subjects, sections, attendance, grades, academic years, and records.

## Color palette

Use the existing semantic colors. Prefer their Tailwind utilities or CSS variables over arbitrary color values in components.

- Paper surfaces: `paper` `#F4F4F0`, `paper-light` `#FCFCFA`, `paper-muted` `#EAEAE4`, `paper-border` `#D8D8CF`, and `paper-dark` `#CECEC2`.
- Ink: `ink` `#0A0A0A`, `ink-secondary` `#3D3D38`, `ink-muted` `#66665E`, and `ink-faint` `#96968C`.
- Signal and category accent colors: `signal-red` `#D92D20`, `signal-orange` `#EA580C`, `signal-amber` `#D97706`, `signal-yellow` `#CA8A04`, `signal-gold` `#B45309`, `signal-ochre` `#A16207`, `signal-mustard` `#854D0E`, `signal-emerald` `#059669`, `signal-teal` `#0D9488`, `signal-blue` `#1D4ED8`, `signal-purple` `#7C3AED`, and `signal-rose` `#E11D48`.
- Reserve signal colors for meaningful validation, warning, status, category accents, or informational states. Do not use them as decorative accents.
- Do not add new brand colors, gradients, glass effects, colorful shadows, or a separate dark theme unless the user explicitly requests them.

## Typography and visual language

- Use IBM Plex Sans for body copy and data that benefits from natural reading.
- Use Space Grotesk for display headings and major public-facing statements.
- Use IBM Plex Mono for short labels, codes, section numbers, metadata, and compact controls. Do not set paragraphs, long help text, or dense tables entirely in monospace.
- Keep the established square geometry: crisp one-pixel borders, little or no corner rounding, flat surfaces, and minimal shadow.
- Preserve the archival grid, thin rules, strong hierarchy, generous whitespace, uppercase labels, and occasional asymmetric composition where they support the page.
- Decorative devices such as crosshairs, oversized display type, dense tracking, and the archival grid should be used deliberately, not repeated on every panel.

## Authenticated and account screens

Account, dashboard, management, and other signed-in screens must use the same palette, typography, borders, and reusable components, but optimize them for everyday readability.

- Use `paper` for the application shell, `paper-light` for primary work surfaces, and `paper-muted` for secondary navigation or supporting regions.
- Keep content surfaces mostly solid so tables, forms, and records remain easy to scan. Limit the archival grid to the outer shell, page background, empty space, or selected identity moments.
- Prefer conventional, predictable information architecture: clear page title, concise supporting text, obvious primary action, stable navigation, and simple one- or two-column content layouts.
- Use display typography sparingly inside the account. Page titles should be prominent without approaching the oversized scale of the login or other public entry surfaces.
- Keep normal body and table text comfortably readable; avoid relying on `10px` text, wide tracking, all caps, or low-contrast ink for essential information.
- Use monospace and uppercase for short navigation labels, field labels, filters, statuses, and metadata only.
- Favor whitespace, alignment, rules, and weight for hierarchy. Do not solve hierarchy by adding more boxes, decoration, colors, or competing type treatments.
- Keep important actions obvious and stable. Secondary actions should not visually compete with the primary task.

## Components and implementation

- Reuse and extend the generic components in `src/components/ui/` before creating new primitives.
- Keep reusable components product-agnostic. Do not bake PALE branding, feature names, fixed dates, roles, permissions, or page copy into shared UI components.
- Keep visual variants centralized in components or theme tokens rather than duplicating long class strings across pages.
- Prefer semantic theme utilities such as `bg-paper`, `text-ink`, and `border-paper-border`. Avoid adding new hardcoded hex values when an existing token expresses the intent.
- Preserve the current React, TypeScript, Vite, and Tailwind architecture. Do not add a styling library or UI dependency solely to reproduce an existing pattern.
- A visual request does not authorize changes to authentication, permissions, API behavior, routing protection, or backend logic.

## YAGNI, scalability, and maintainability

- Follow YAGNI: implement only the screens, interactions, states, and data flows
  required by the current request.
- Keep straightforward UI work straightforward. Prefer readable components,
  explicit data flow, and familiar React patterns over clever or indirect code.
- Do not create placeholder pages, routes, stores, contexts, hooks, services,
  types, component variants, or permissions for possible future features.
- Treat every new abstraction, shared state mechanism, and configuration-driven
  pattern as a maintenance cost. Add it only for a current, demonstrated need.
- Keep pages focused on composition, feature-specific behavior inside the
  relevant `src/features/` area, generic UI primitives in `src/components/ui/`,
  and shared application layouts in `src/components/layout/`.
- Keep state as local as practical. Add shared context or another global state
  mechanism only when multiple current consumers require coordinated state.
- Extract a component, hook, or helper when it owns a clear responsibility,
  removes real duplication, or makes current behavior easier to test. Do not
  generalize a one-off implementation without a demonstrated need.
- Prefer small, explicit component APIs and composition over prop-heavy generic
  components or configuration-driven rendering.
- Keep real endpoint and payload handling out of presentation components. When
  an actual integration exists, place that behavior in the owning feature's API
  module instead of creating unused service layers.
- Treat responsive behavior, accessibility, honest loading and error states,
  and centralized theme variants as part of scalability and maintainability.

## Content integrity

- Use real product language and data supplied by the application.
- Do not invent metrics, student counts, academic dates, activity feeds, audit events, system health, security claims, clearance levels, encryption details, or operational statuses.
- If live data is unavailable, use an honest empty, loading, unavailable, or error state rather than fictional placeholder activity.
- Keep labels and explanations concise, direct, and appropriate for faculty and academic administrators.

## Accessibility and responsive behavior

- Maintain clear contrast between text and paper surfaces; do not use faint ink for required instructions or primary data.
- Preserve a visible high-contrast focus state for every interactive control.
- Use semantic HTML, programmatic labels, useful error messages, and keyboard-accessible interactions.
- Do not communicate status or validation through color alone.
- Keep touch targets comfortable and prevent horizontal overflow on narrow screens.
- Verify that hierarchy, actions, forms, tables, and navigation remain understandable on both mobile and desktop.

## Verification

- Review new screens beside `src/pages/LoginPage.tsx` and `src/index.css` to confirm that they belong to the same visual system.
- For account screens, also confirm that decoration has not reduced scanability or reading comfort.
- Add or update focused client tests for changed behavior when the existing
  client test setup supports them. Do not introduce a test framework solely to
  satisfy this instruction.
- Run `npm run lint` and `npm run build` from `client/` after client source
  changes when the environment permits, and wait for both commands to finish.
- For interaction or UX changes, verify the affected keyboard flow, labels,
  field errors, focus behavior, loading/saving state, narrow-screen layout, and
  touch targets as applicable.
- Perform browser verification only when the required authenticated state and
  test data are safely available. Do not invent credentials or create
  persistent data without authorization.
- Include the exact client checks and any unavailable browser verification in
  the repository completion report required by the root `AGENTS.md`.

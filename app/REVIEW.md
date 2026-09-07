`app/` is the thin web host: Vite entry, routing, PWA/offline shell, and SWA config.
It wires workspace packages and must not duplicate planner or money logic. At startup
it resolves same-origin `/import-feature.json` (no-store, not precached) and passes
import availability into `PlannerApp`; invalid or missing config fails closed on
file-backed imports per [DOCS/architecture.md](../DOCS/architecture.md) and
[DOCS/features/imports-and-migration.md](../DOCS/features/imports-and-migration.md)
— verify against those docs, do not invent kill-switch semantics beyond them.

Focus on host integration, caching, routing, and package boundaries. Offline behavior
follows implemented PWA/service-worker contracts.

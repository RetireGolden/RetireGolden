`packages/planner-ui` renders engine outputs; components must not recompute dollars,
taxes, or projections. It publishes typed contracts consumed by hosts including
RetireGolden Pro. Match existing tokens and component classes; keep light and dark
themes and accessibility baselines per [DOCS/standards.md](../../DOCS/standards.md).

Persistence is local (IndexedDB + JSON export). User plan data does not leave the
device. Limited network use exists for documented public/config paths only — the host
same-origin `/import-feature.json` switch and explicit opt-in FedInvest price lookup
in `fedInvestClient.ts` ([DOCS/standards.md](../../DOCS/standards.md)). Do not treat
the UI as "no network ever."

Review import gates, persistence/migration paths, error surfacing, and published
surface changes without inventing host-specific fallbacks.

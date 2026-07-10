# engine/

Pure-TypeScript domain engine for RetireGolden. See `DOCS/architecture.md` and `DOCS/code-map.md`.

**Purity rules (enforced by ESLint):**

- No imports from React, react-dom, react-router, recharts, or any UI code.
- No direct DOM/localStorage/IndexedDB access — persistence lives in `src/data/`.
- Every function deterministic; anything random takes an injected RNG.

Layout:

| Folder | Contents |
|--------|----------|
| `model/` | Plan schema (Zod), types, migrations |
| `params/` | Annual parameter packs (tax brackets, limits, RMD, Medicare, SS) + typed accessors |
| `tax/` | Federal tax engine, ACA credit, Medicare/IRMAA |
| `rmd/` | Required minimum distributions (SECURE 2.0) |
| `socialsecurity/` | Monthly claiming factors (PIA engine still in `src/socialSecurity/`) |
| `strategies/` | Roth-conversion sizing (fill-to-target), withdrawal ordering, SEPP, inherited-IRA, the optimizer |
| `projection/` | Deterministic annual ledger + summaries/comparison |
| `montecarlo/` | Seedable RNG, market models (lognormal, historical bootstrap), path runner + aggregation |
| `scenarios/` | Scenario patch apply/diff + side-by-side comparison |

The ported `longevity/` model lives in `src/longevity/` (app layer). The Web Worker pool that drives `montecarlo/` lives in `src/mc/` (workers are an app-layer concern).

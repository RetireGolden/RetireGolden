# Engineering standards

Conventions that keep RetireGolden cohesive. Read this and [architecture.md](architecture.md) before adding
or changing a feature. These are the rules the codebase already follows — match them.

## Non-negotiable invariants

1. **Local-first, no network for user data.** No backend, no account, no analytics, no remote content. Any
   feature that would send a plan off the device is out of scope by definition. Persistence is IndexedDB +
   JSON export only.
2. **The engine stays pure.** `packages/engine/src/**` (the `@retiregolden/engine` package) must not
   import React, recharts, `idb`, or app-layer code, and must not touch `localStorage`, `indexedDB`,
   `document`, `window`, or `fetch` — it runs in plain Node as well as the browser. This is enforced by
   ESLint (`packages/engine/eslint.config.js`) — if the lint rule fights you, the code is in the wrong
   layer, not the rule.
3. **The UI never computes money math.** Components call engine functions; all dollars, taxes, and
   projections originate in `packages/engine/`.
4. **Determinism.** Every engine function is deterministic; anything stochastic takes an **injected RNG**
   (`engine/montecarlo/rng.ts`) so runs reproduce and scenario diffs aren't sampling noise.
5. **One ledger.** Monte Carlo and the optimizer wrap the same `simulate` function — never write a second,
   simplified model. A strategy *proposes* a schedule; the exact ledger always prices it.
6. **Parameters are data, not code.** No hardcoded dollar figures in logic. Tax brackets, limits, SSA
   tables, and Medicare/FPL numbers live in versioned packs under `engine/params/`.

## Data model and schema changes

- The `Plan` is defined by **Zod schemas** in `engine/model/plan.ts`; **types are inferred from the
  schemas** (don't hand-write parallel interfaces). The same schemas validate imports and storage reads.
- **Prefer additive fields with a Zod default over a migration.** New optional fields (the pattern used by
  `stateMoves`, `insurance`, `capitalLossCarryforward`) ship with a default so existing saved plans stay
  byte-for-byte valid and `CURRENT_PLAN_SCHEMA_VERSION` stays put. Only bump the version + add a pure
  `migrate` step (`engine/model/migrations.ts`) for a genuinely breaking change (renames, removals,
  restructures). Every migration step is unit-tested.
- Persisted reads always go through migration + validation (`data/planStore.ts`); never trust raw stored
  JSON.

## Adding a feature (the established pattern)

Capital-loss carryforward and insurance are the reference examples — follow their shape:

1. **Schema** — add the field(s) to `engine/model/plan.ts` with a Zod default.
2. **Parameters** — any fixed legal constant (e.g. the $3,000 loss-offset limit) goes in the parameter pack,
   not inline.
3. **Engine** — implement the rule as a **pure, separately-tested helper**, then thread any year-to-year
   state through `engine/projection/simulate.ts` (mirror the existing depleting-pool / strategy patterns).
   Surface results on `YearResult` (`engine/projection/types.ts`) so the table/report/CSV need no recompute.
   When a change touches an inlined domain inside `simulatePlan`, extract that domain into its own helper
   as part of the change ("extract the domain you touch") — no big-bang rewrite.
4. **Strategies** are pure functions that emit per-year schedules into `simulate` — the optimizer plugs in
   the same way ("just another strategy provider"). Keep that seam intact.
5. **UI** — add the entry control in `planner/` (sections/fields) and the readout in the results/report
   pages. No money math in the component.
6. **Tests** — co-located `*.test.ts`: hand-computed cases, the AGI→SS→IRMAA/ACA cascade where relevant,
   and a **"feature-off is unchanged"** regression (default value ⇒ identical output).

## Recommendation income-coverage checklist

Every recommendation source must price the same ledger-known income and cash-flow sources that projection
prices. When adding or changing a candidate evaluator, scenario patch, detector, optimizer approximation, or
insight preview:

1. Start from the full `Plan`; do not rebuild a simplified income model.
2. Preserve recurring income, one-time income, pensions/annuities, Social Security taxability, taxable gains
   and qualified dividends, scheduled contributions, employer match, and account-level yield/cash-flow fields.
3. Run candidate comparisons through `simulate` / `compareScenarios` unless the code is intentionally only
   creating a patch preview.
4. Add or update a named fixture that proves a ledger-known source changes the recommendation when it should
   or remains intentionally irrelevant when it should not.
5. If a feature affects AGI, MAGI, taxable income, account balances, or spending need, include at least one
   integration assertion through the projection ledger.

## Rules, citations, and currency

- Every rule the engine encodes is documented in [domain/domain-rules-reference.md](domain/domain-rules-reference.md)
  with its current-year figure and a **source URL**.
- Parameter values carry **provenance** (`engine/params/provenance.ts`, shown via
  `planner/ProvenancePanel.tsx`) — source + date visible to the user.
- Anything date-sensitive gets an entry in [maintenance-schedule.md](maintenance-schedule.md). Don't bake
  current-year numbers into prose or logic where a pack value or a date-stamp will do.

## Testing

- Vitest, **co-located** as `*.test.ts(x)` beside the code. The test taxonomy (oracle vs
  characterization, golden/external/adversarial naming) and the expected-value rule are in
  [testing.md](testing.md) — a correctness test never uses RetireGolden's own output as its expected value.
- Cover the **edges**: bracket boundaries, IRMAA/ACA cliffs, RMD start cohorts, FRA cohorts, zero/low
  earnings years.
- Add **property-style** checks where they fit (ledger conservation: sources = uses each year; monotonicity:
  more conversion never raises the traditional balance).
- Owl / PolicyEngine-US / Open Social Security are **offline, dev-time oracles** for golden fixtures — never
  a runtime or required build dependency. Sourcing, tolerances, and fixture records:
  [external-oracles.md](external-oracles.md); the optimizer cross-check harness:
  [operations/owl-parity.md](operations/owl-parity.md).
- CI gates on lint + tests + a type-checked build, plus Semgrep (SAST) and ZAP (DAST); see
  [operations/security-scanning.md](operations/security-scanning.md).

## UI conventions

- State is React context + the IndexedDB store. No Redux / React Query (there is no server).
- Charts use **Recharts**. Reports are a print-styled route (browser print-to-PDF) — there is no PDF
  library; don't reintroduce one.
- **Educational framing is mandatory.** "Not tax/legal/financial/medical advice" stays visible; show
  uncertainty (bands, ranges) over false precision.
- **Accessibility baseline:** keyboard-navigable, labelled controls, text equivalents for visuals, no
  color-only meaning, mobile-safe layout.
- **Field help ladder:** plain label → one-line `hint` → a single `HelpTip` (ⓘ) carrying a one–two sentence
  `help` and an optional "Learn more" link. Help links reference a `LEARN.*` entry in
  `planner/learnLinks.ts` (covered by a broken-slug test), never a raw article slug.

## Adding a Learning Center article

Content is **structured TypeScript** under `packages/planner-ui/src/learn/content/` registered in `learningRegistry.ts` —
not Markdown/MDX. Each article carries metadata (`slug`, `category`, `status`, `lastReviewed`,
`reviewCadence`, `currentYearSensitive`, `sourceUrls`, `relatedPlannerRoutes`). Rule-heavy articles must set
`currentYearSensitive` and a `reviewCadence`, cite primary sources (IRS/SSA/CMS), and avoid hardcoding
current-year dollars in evergreen prose. Follow the full style guide and topic inventory in
[features/learning-center.md](features/learning-center.md). Link from the planner via `LearnLink` /
`LearnAboutScreen`; a broken-slug test fails the build on a dead link.

## Documentation

Keep these docs **ground truth**. When you ship a feature, update the relevant `features/*` doc and
[domain/domain-rules-reference.md](domain/domain-rules-reference.md) in the same change — describe what the
code does and why, not a plan to build it. If you find the docs and code disagree, fix the doc immediately
to match the implementation. Do not trust a roadmap-style status line over the code — verify against the source (`packages/*/src`, `app/src`).
Historical audits are preserved in git history.
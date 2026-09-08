`packages/engine` is pure TypeScript for Node and browser: no React, DOM, storage
APIs, or network I/O. ESLint enforces the boundary. All money math lives here;
stochastic paths use injected RNG for reproducibility. Monte Carlo and the optimizer
wrap the same `simulate` ledger — never a simplified parallel model. Dollar limits
and tables live in versioned parameter packs, not inline code. Plan schemas (Zod)
and migrations must stay backward compatible per [DOCS/standards.md](../../DOCS/standards.md).

Calculation findings need expected values derived independently from cited primary
rules, IRS/SSA/CMS sources, or [DOCS/domain](../../DOCS/domain/) — mirrored tests are
regression, not proof ([DOCS/testing.md](../../DOCS/testing.md)). Rules are documented
in DOCS/domain and encoded via `src/rules/records/` and `taxRuleRegistry.ts`. Reviewers
flag missing or unsourced correctness tests; do not enact new tax requirements.

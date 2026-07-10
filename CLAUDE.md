# RetireGolden — agent notes

Engineering ground truth lives in [DOCS/README.md](DOCS/README.md); read
[DOCS/standards.md](DOCS/standards.md) before changing code.

## Design Context

Before any UI or design work, read:

- **[PRODUCT.md](PRODUCT.md)** — strategic context: register (product), users, brand personality
  (trustworthy, clear, candid · expert, rigorous, precise), anti-references (retirement clichés,
  AI-SaaS gloss), design principles, and the AA + age-friendly accessibility bar.
- **[DESIGN.md](DESIGN.md)** — the visual system ("The Candid Ledger"): tokens, typography,
  elevation, component vocabulary, and do's/don'ts. Tokens are defined in
  `app/src/index.css` and contrast-guarded by `app/src/tokenContrast.test.ts`.

New UI must use the existing tokens and component classes; keep light and dark themes in parity.

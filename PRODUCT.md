# Product

## Register

product

## Users

Pre-retirees and retirees (mostly 50+) planning their own retirement, plus the DIY-finance-curious who
distrust advisor upsells. They arrive with real anxiety — "will my money last?" — and often with a
spreadsheet they've outgrown. Many are privacy-conscious by conviction: the no-account, no-server,
data-stays-on-device promise is a primary reason they're here. Their context is a desktop or tablet
session of focused planning work: entering a household plan section by section, then studying
projections, Monte Carlo bands, and scenario comparisons. The job to be done is confident
decision-making about claiming ages, Roth conversions, withdrawal order, and spending — understood,
not just computed.

## Product Purpose

RetireGolden is a free, privacy-first, full-service retirement planner that runs entirely in the
browser. It projects a household's finances year by year — federal and state taxes, Social Security,
RMDs, Roth conversions, ACA/IRMAA, insurance, Monte Carlo, and an optimizer — with an integrated
Learning Center. It is educational by mandate: not tax, legal, financial, or medical advice. Success
looks like a user who leaves understanding *why* a strategy works, trusting the numbers because every
rule carries provenance and every projection shows its uncertainty honestly.

## Brand Personality

**Trustworthy, clear, candid · Expert, rigorous, precise.**

The voice of a fiduciary who is also a domain expert: plain language first, exact numbers when they
matter, and honest uncertainty always — bands and ranges over false precision, sources cited, no
overselling. The interface earns trust the way the engine does: by showing its work (provenance
panels, citations, "assumptions change the answer" framing). Emotionally, the goal is calm
confidence — retirement math is scary, and the app answers with rigor and candor, never hype or hand-holding
condescension.

## Anti-references

- **Retirement clichés.** No stock-photo beaches, golf, sailboats, or silver-haired couples laughing
  at laptops. No condescending "senior-friendly" oversized kiddie UI — the audience is older, not
  less capable.
- **AI-SaaS gloss.** No gradient heroes, glassmorphism, gradient text, or dark-mode-default startup
  aesthetics. Trendy reads as untrustworthy here; this is a tool people bring their life savings to.
- (Secondary, from the product's own stance:) no brokerage-style urgency banners, cross-sells, or
  gamified net-worth widgets — there is nothing to sell.

## Design Principles

1. **Show your work.** Every number can explain itself — provenance, sources, assumptions. Trust is
   built by transparency, not polish.
2. **Honest uncertainty over false precision.** Bands, ranges, and percentiles are first-class; a
   single confident number without context is a design bug.
3. **Educate in place.** The help ladder (label → hint → HelpTip → Learn more) meets users at their
   level without leaving the workflow. Learning is part of the task, not a detour.
4. **Calm, not bland.** The gold identity and clear hierarchy carry warmth; no urgency mechanics, no
   decoration for its own sake. The tool disappears into the planning work.
5. **Respect the reader's age and attention.** Readable body sizes, strong contrast, generous
   targets, familiar affordances. Density where experts need it, guidance where newcomers do.

## Accessibility & Inclusion

WCAG 2.1 AA baseline (contrast is guarded in CI by `tokenContrast.test.ts`), plus explicit
age-friendly commitments for the 50+ audience:

- Body text ≥16px; no low-contrast muted text for meaningful content.
- Generous tap/click targets; mobile-safe layout.
- Keyboard-navigable throughout; labelled controls; text equivalents for visuals.
- No color-only meaning (existing standard — chart palette is distinctness-checked).
- `prefers-reduced-motion` respected on all animation.
- Light and dark themes both maintained to the same contrast bar.

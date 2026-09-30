## Claim

Kind: model. `projection/internal/types/result.ts#YearResult.rothConversion`, sized by `strategies/rothConversion.ts#sizeRothConversion`, fills a selected federal bracket. The type comment states that the household amount is found by bisection to $0.01, returning the lower bound: the largest amount that keeps federal taxable income at or under the bracket's upper bound. Without Social Security that root is bracket upper bound minus `(ordinary income - deduction)`; with benefits taxable Social Security phases in, so only the bisection's root is the answer. The household amount is then split between the owners of traditional balances, and each share converts only into that owner's own Roth IRA; the published figure is what converted.

## Justification

For a 2026 single filer selecting the 22% bracket, the upper bound is the next bracket's `lowerBound`, `$105,700`, from `year2026.federalTax.brackets.single`. The base deduction is the 2026 single standard deduction, `$16,100`, from `year2026.federalTax.standardDeduction.single`.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Tax year / filing status | 2026 / single | year / status |
| Selected bracket | 22 | percent |
| Selected bracket upper bound | 105,700 | dollars taxable income |
| Ordinary income before conversion | 70,000 | dollars |
| Standard deduction | 16,100 | dollars |
| Social Security benefits | 0 | dollars |
| Available traditional balance after RMD reserve | 100,000 | dollars |

## Arithmetic

Taxable ordinary income before conversion `= $70,000 - $16,100 = $53,900`. Bracket headroom `= $105,700 - $53,900 = $51,800`. The available balance is sufficient, so the annual conversion is `$51,800`.

Benefits branch: when Social Security benefits are positive, the comment requires bisection against the federal engine because an added conversion may make additional benefits taxable; no closed-form numeric result is asserted for that branch.

## Expected

Exact root for the no-benefits case: `$51,800`. Tolerance, as the `YearResult.rothConversion` contract states it: the household amount is at or below the root and within `$0.01` of it, because the bisection stops at a `$0.01` bracket and returns its lower bound. With one convertible owner, as here, the published figure is that amount itself, so the band is one-sided. With two or more convertible owners the amount is split in exact cents, so the executed total is the amount rounded half-up to the cent (when every share converts): it can sit up to half a cent above the root and up to a cent and a half below it (the bracket-fill walkthrough's 2027 publishes 191,772.98 against a root of 191,772.9793). This case lands on the root exactly (the first midpoint of the expanded bracket is `$51,800`, as the record's limits note), so its evidence also holds it within `$0.005`; that is a property of this case, not of the contract. A projected year shows the difference: its ceiling is the indexed bracket bound, which binary floating point need not represent exactly (12,400 × 1.025 evaluates a hair under 12,710 in the early-retiree walkthrough's 2027), and the landing there is 0.0051 below the closed form, inside the contract's `$0.01` and outside `$0.005`. Benefits branch: no numeric expectation; evidence must show the bisection result for its full tax input.

## Wrong readings

- Ignoring the deduction gives `$105,700 - $70,000 = $35,700`.
- Using the 22% bracket's lower bound `$50,400` as its upper bound gives `$50,400 - $53,900 = -$3,500`, commonly clamped to `$0`.
- Applying the no-benefits subtraction when benefits are present can overstate headroom because taxable Social Security can rise with the conversion.
- Holding a bisection-sized conversion to `$0.005` of the closed form in general: the contract promises `$0.01` below the root, and a projected year's landing can sit more than `$0.005` below it.
- Reading the household amount as the published figure when an owner holds no Roth IRA of their own: that owner's share is dropped, so the published figure is the converting owners' shares only.
- Holding a two-owner executed total one-sided at or below the root: the split rounds the household amount half up to the cent, so the total can sit up to half a cent above it.

## Family

outputs: `roth-conversion-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.

Revision, 2026-09-27 (decision D-WALKTHROUGH-WORKSHEET-WORDING): the claim now states the bisection's one-sided $0.01 and the owner split the type comment gives, the Expected section states the contract's tolerance rather than this case's $0.005, and three wrong readings are added (the third after the bracket-fill walkthrough's independent check). The worked case and its value do not change. The early-retiree walkthrough (DOCS/walkthroughs/early-retiree-aca.md, part II) found the gap. The same day the re-derived bracket-fill walkthrough found the first rewording ("at or below the root") wrong for a household with two convertible owners, whose executed total is the amount rounded to the cent; the Expected section now says both. The rewording is unreviewed until the review lane recomputes it, so the record carries reviewedBy 'unreviewed'.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-2-cash-flow.md`.

## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` publishes ending estate heir tax as the sum of every `EstateAccountBreakdown.heirTax` amount, in nominal horizon dollars with no stated rounding. For each account, heir tax is `taxablePretaxBase × (1 − charity fraction) × heir rate`, except that a spouse destination produces zero heir tax; the charity fraction is the share of gross balance passing to charity and reduces both what heirs receive and the taxable pre-tax base exposed to heir tax.

## Justification

The interface comments give both the exact identity `endingEstateHeirTax=sum_a estateBreakdown[a].heirTax` and the per-account rule. Applying the charity fraction to the taxable pre-tax base matters when that base differs from gross balance: the charity carve-out is not merely subtracted from gross balance while leaving the full pre-tax base taxable. The domain is a finite estate breakdown with finite nonnegative balances, bases, rates, and charity fractions.

## Inputs

| Account | Gross balance | Taxable pre-tax base | Charity fraction (share of gross) | Destination | Heir rate | Unit |
|---|---:|---:|---:|---|---:|---|
| Traditional IRA | 300,000.00 | 240,000.00 | 10% | charity (10% to charity, the remainder to a non-spouse heir) | 22% | nominal dollars |
| Non-spouse HSA | 40,000.00 | 40,000.00 | 0% | non-spouse | 22% | nominal dollars |
| Roth IRA | 125,000.00 | 0.00 | 0% | non-spouse | 22% | nominal dollars |

The charity fraction is nonzero only when the account's destination is `charity`: the schema's `charityPct` is the charity share for that destination and the remainder passes to a non-spouse heir. The second Expected case sets every destination to `non-spouse`.

## Arithmetic

- Traditional IRA: `$240,000.00 × (1 − 0.10) × 0.22 = $47,520.00`.
- Non-spouse HSA: `$40,000.00 × (1 − 0) × 0.22 = $8,800.00`.
- Roth IRA: `$0.00 × (1 − 0) × 0.22 = $0.00`.
- Sum: `$47,520.00 + $8,800.00 + $0.00 = $56,320.00`.

## Expected

For the inputs above, ending estate heir tax is `$56,320.00`, with absolute tolerance `$0.005` because the products are computed in binary floating point.

As a second case, with no charity destination on any account, the rule collapses to taxable pre-tax base times heir rate for each non-spouse account, and ending estate heir tax is `$61,600.00`, with the same absolute tolerance `$0.005`.

## Wrong readings

- Carving the charity from gross balance only while taxing the full taxable pre-tax base gives `$52,800.00 + $8,800.00 = $61,600.00` in the charity case.
- Subtracting the `$30,000.00` charity amount from the correctly computed summed tax again gives `$56,320.00 − $30,000.00 = $26,320.00`.
- Taxing the Roth balance despite its zero taxable pre-tax base adds `$125,000.00 × 0.22 = $27,500.00` and gives `$83,820.00` in the charity case.

## Family

outputs: `estate-heir-income-tax`.

feeds: `projection-summary-ending-after-tax-estate`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 heirTax doc comment) and the orchestrator's contract statement, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory (the first review, and the re-check section for this re-derivation).

Revision note: The first derivation assumed each account's heir tax was a supplied input and therefore taxed the traditional IRA's full `$240,000.00` taxable pre-tax base despite its 10% charity fraction; the implementation's fixture found that mismatch. Revision 2026-09-22 (pull-request review of #727): the Inputs row for the traditional IRA named a `non-spouse` destination beside its 10% charity fraction, while production applies the fraction only under a `charity` destination, which is what the fixture supplies; the row now says so. No expected value changed.

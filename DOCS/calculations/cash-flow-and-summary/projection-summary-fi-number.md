## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` publishes the FI number in projection-start-year dollars as one selected year's nominal funded expenses plus tax and penalties, discretely deflated by general inflation, divided by the safe-withdrawal-rate decimal; an empty ledger instead divides base annual lifestyle spending alone by that rate.

## Justification

Let `s=max(startYear,birthYear+retirementAge)`, using the ISO year of the first person's date of birth (month and day ignored), or birth year 1980 and retirement age 65 when absent. The spending row is year `s` when present and otherwise the first ledger row. On a nonempty ledger, `fiNumber=((expenses.total+tax+penalties)/(1+inflationPct/100)^(s_used-startYear))/(safeWithdrawalRatePct/100)`. `expenses.total` is published funded spending after guardrails, including the contract's listed funded lifestyle, goals, debt, property, healthcare, premiums and net LTC components; it is neither intended spending nor reduced by income. The empty-ledger identity is `baseAnnual/(safeWithdrawalRatePct/100)`. The valid domain requires a positive withdrawal rate and a positive inflation base.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection start year | 2026 | calendar year |
| First person's date of birth | 1980-12-31 | ISO date |
| First person's retirement age | 50 | years |
| Selected ledger year (`max(2026,1980+50)`) | 2030 | calendar year |
| Published funded `expenses.total` in 2030 | 80,000 | nominal dollars |
| Published tax in 2030 | 10,000 | nominal dollars |
| Published penalties in 2030 | 2,000 | nominal dollars |
| General inflation rate | 3 | percent/year |
| Safe withdrawal rate | 4 | percent/year |
| Base annual lifestyle spending, for the empty-ledger case | 60,000 | start-year dollars |

The 2030 ledger row is present. The date's month and day do not change `birthYear=1980`; healthcare extra inflation is not an input.

## Arithmetic

Nominal outflows are `$80,000+$10,000+$2,000=$92,000`. Four discrete inflation steps give `1.03^(2030-2026)=1.12550881`, so start-year outflows are `$92,000/1.12550881=$81,740.8084082434`. Therefore `fiNumber=$81,740.8084082434/0.04=$2,043,520.21020608`. With an empty ledger, `fiNumber=$60,000/0.04=$1,500,000` with no tax, penalties or deflation.

## Expected

For the nonempty ledger, FI number is `$2,043,520.21020608`, absolute tolerance `$0.000001`; that bound is comfortably above binary floating-point error from one integer power and two divisions while far below one cent. For the empty ledger, FI number is `$1,500,000.00` with the same absolute tolerance, covering its floating-point division while still discriminating any cent-level difference.

## Wrong readings

- Subtracting guaranteed income or using net portfolio need understates the gross-outflow target.
- Using intended spending instead of published funded `expenses.total` ignores guardrail cuts and the stated spending base.
- Applying healthcare extra inflation, continuous inflation, or rounding intermediate values changes `$2,043,520.21020608`.
- Treating an empty ledger like the normal path invents tax, penalties or deflation; its contract is base lifestyle only.
- When the retirement spending year is absent, interpolating it or returning no value is wrong: the first ledger row is used.

## Family

outputs: `projection-summary-fi-number`.

feeds: `spending-total-annual`, `tax-total-annual`, `tax-penalties-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract with the 2026-09-18 doc-comment contracts, without executing the engine or reading any implementation body. Reviewed by: unreviewed.

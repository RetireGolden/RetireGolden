## Claim

Kind: model. `projection/survivorTransition.ts#survivorTransitionAnalysis` prices, for each death timing of a two-adult married-filing-jointly plan, the convert-early lever: the same death timing run with Roth conversions that fill the 12% bracket **added to** the plan's own conversions, from the start year through the year of the first death.

- **The lever run.** `projection/simulate.ts#simulatePlan` with the timing's death override, the plan's own SSA-44 setting and `SimulateOptions.additionalBracketFill { bracketPct: 12, startYear, endYear: the death year }`. In each window year `projection/internal/annualAggregateRothConversionTargetPlan.ts#annualAggregateRothConversionTargetPlan` sizes the plan's own aggregate target and a fill of federal taxable income to the top of the 12% bracket for the year's filing status on the same state of the year, caps the fill at the convertible traditional balance, and keeps the larger. Outside the window, and in a year a named conversion action suppresses the aggregate strategy, the plan's own strategy runs unchanged.
- **The figures.** `estateDelta` = the lever run's ending after-tax estate minus the base run's, in nominal dollars of the timing's last year (the row's `endYear`); `lifetimeTaxDelta` = the lever run's lifetime taxes and penalties minus the base run's, an undiscounted sum of nominal dollars.
- **What each window year did, and why.** `#leverYears` reads the lever run's window rows (`ProjectionResult.additionalBracketFill`) against executed dollars (`YearResult.rothConversion`), with own = the plan's own target capped at the convertible balance and fill = the capped 12% fill, each comparison within the ledger's conversion epsilon, in this order: `named-conversions` when a named conversion action suppressed the aggregate strategy; `raised` when the year converted more than own; `covered` when it converted something and at least the fill (the plan already converts at or past the top of the bracket); `short` when it converted less than the fill asked; and, with no fill asked, `no-balance` with no convertible balance (none left, or only an employer plan not yet distributable), `fill-limited` when the fill's own sizing cut it to nothing (its message says why, for example a trim that keeps the conversion's tax payable above the taxable safety-net floor), and `no-room` otherwise (taxable income already at the top of the bracket). Each year carries the ledger's own messages: the fill's sizing messages on a `fill-limited` year (`AdditionalBracketFillYear.fillNotes`), and on any year the messages the ledger raised when it converted less than the year's target asked (`ledgerNotes`: an owner with no Roth account for the share to land in, an employer balance not yet distributable, a traditional balance short of the request). `raisedYears` and `coveredYears` are the `raised` and `covered` years. The page prints the years of each reason and every message once, so nothing the ledger skipped goes unsaid.
- **Revision 2026-09-28 (the review's M1).** The first cut read covered years from the plan's own target, not from executed dollars, and printed one sentence for the whole row. On example-couple it said "your plan already converts past the 12% bracket in these years" where the ledger had skipped Sam's share of every conversion because Sam has no Roth account. When Alex dies at 90: 2026 and 2027 have no room in the bracket; 2028 to 2032 convert at least the fill; 2033 to 2036 convert $91,946, $75,290, $51,535 and $0 against fills of $94,775 to $102,062, and 2037 to 2041 convert $0 against fills of $90,038 to $107,229, all short for that reason; 2042 to 2052 have no balance left.

New 2026-09-28 (B2-P1 slice 5, owner decision R16). Until then planner-ui's `survivorAnalysis.ts#buildTimingRow` priced the lever as a plan patch that replaced the plan's conversion strategy with the 12% fill: on a plan already converting past 12% it measured converting less, and stopping at the death.

## Justification

- The window: a joint return may be made for the year of a death, "if such taxable years begin on the same day and end on different days because of the death of either or both" (26 U.S.C. 6013(a)(2)); the survivor files singly afterwards unless 26 U.S.C. 2(a) applies (a surviving spouse with a dependent child, joint rates for two more years), which the window does not extend into.
- The bracket: Rev. Proc. 2025-32 sec. 4.01, Table 1, married filing jointly, "Over $24,800 but not over $100,800 ... $2,480 plus 12% of the excess over $24,800" and "Over $100,800 but not over $211,400 ... $11,600 plus 22% of the excess over $100,800"; sec. 4.14, the joint standard deduction of $32,200; later years from the ledger's parameter pack.
- "In addition" is owner decision R16. Taking the larger of the two targets is the same as "the plan's conversions, then whatever 12% room is left": the room left after own(y) is fill(y) − own(y) when positive, because taxable income increases with the conversion.
- The cap: the fill's gross-up returns more than the convertible balance when the balance cannot reach the bracket top (it keeps the reduced-conversion signal), so an uncapped fill would win the comparison in every year with room left even with no pre-tax money, and raise the reduced-conversion warning (independent check C1).

## Inputs

Case L-A: a married couple filing jointly, both born in 1966 (Pat 1966-06-15, Sam 1966-08-01), planning ages 61, priced with the federal calculator alone, $92,200 of wages in 2026, $500,000 cash, a $500,000 traditional IRA and an empty Roth IRA, no spending and no health costs. Taxable income before any conversion: 92,200 − 32,200 = 60,000. The lever's window is 2026 alone. The plan's own strategy:

| Variant | Plan's own 2026 conversion |
|---|---:|
| none | 0 |
| manual 30,000 | 30,000 |
| manual 55,000 | 55,000 |
| cash only | 0, and no traditional balance |

## Arithmetic

The 12% fill reaches taxable income 100,800: 100,800 − 60,000 = 40,800.

- none: max(0, 40,800) = 40,800; tax at 100,800 = 2,480 + 0.12 × 76,000 = 11,600 (the plan alone: 2,480 + 0.12 × 35,200 = 6,704).
- manual 30,000: max(30,000, 40,800) = 40,800; tax 11,600 (the plan alone at 90,000: 2,480 + 0.12 × 65,200 = 10,304).
- manual 55,000: max(55,000, 40,800) = 55,000, the plan's own; tax at 115,000 = 11,600 + 0.22 × 14,200 = 14,724, the same as the plan alone. The lever raises nothing and the year is covered. The retired replacement lever converted 40,800, 14,200 **less** than the plan.
- cash only: the fill is capped at the convertible balance, 0; nothing is raised or covered.

Case L-B, each a variant of L-A with the window 2026 alone and no strategy of its own unless named:

- none: converts the fill, 40,800 > own 0: raised.
- manual 55,000: converts 55,000, which is more than 0 and at least the fill 40,800, and not more than own: covered.
- cash only: no convertible balance, so the fill is 0 and nothing converts: no-balance.
- The Roth IRA is Sam's: the IRA is Pat's, and a conversion lands only in the same person's own Roth (26 U.S.C. 408A(d)(3), the ledger's owner policy), so Pat's share, all of the 40,800, is skipped: 0 < 40,800, short, with the ledger's message naming Pat.
- No Roth account at all: the household refusal, the same 0 against 40,800: short, with its message.
- Wages 140,000: taxable income 140,000 − 32,200 = 107,800 is already past 100,800, so the fill is 0, while the IRA holds 500,000: no-room.
- A taxable safety-net floor of 600,000: $500,000 of cash leaves no headroom above the floor for the conversion's tax, so the fill's sizing trims it to 0 and says so: fill-limited, with that message.
- A named 10,000 conversion in 2026: the named action takes the year and suppresses the aggregate strategy, and so the fill: named-conversions (the year converts the named 10,000).

## Expected

| Case | Conversion | Federal tax | Reason | Ledger's words |
|---|---:|---:|---|---|
| L-A none | 40,800 | 11,600 | | |
| L-A manual 30,000 | 40,800 | 11,600 | | |
| L-A manual 55,000 | 55,000 | 14,724 | | |
| L-A replacement, manual 55,000 | 40,800 | 11,600 | | |
| L-A raised years, none | 1 | | | |
| L-A raised years, manual 55,000 | 0 | | | |
| L-A covered years, manual 55,000 | 1 | | | |
| L-A raised years, cash only | 0 | | | |
| L-A covered years, cash only | 0 | | | |
| L-B none | 40,800 | | raised | |
| L-B manual 55,000 | 55,000 | | covered | |
| L-B cash only | 0 | | no-balance | |
| L-B Roth IRA is Sam's | 0 | | short | "Pat has no Roth account, so Pat’s share of the Roth conversion was skipped — a conversion has to land in the same person’s own Roth. Opening a Roth IRA for Pat would let that share convert." |
| L-B no Roth account | 0 | | short | "Roth conversions were requested but the plan has no Roth account; conversions skipped." |
| L-B wages 140,000 | 0 | | no-room | |
| L-B safety-net floor 600,000 | 0 | | fill-limited | "Roth conversions were trimmed so their tax bill stays payable without breaching the taxable safety-net floor." |
| L-B named conversion | 10,000 | | named-conversions | |

Tolerance: 0.005 dollars on the conversions and taxes (the ledger's funding tolerance); the year counts, reasons and words exact.

## Wrong readings

- The lever as a replacement of the plan's strategy (the retired lever): L-A manual 55,000 converts 40,800.
- The lever continuing past the death year.
- "No added conversions" judged from the sum of conversions: converting earlier moves growth into the Roth, so a lever can convert less in total while raising a year (no-annuity-brokerage's converts $39,678.22 less).
- An uncapped fill: every window year with room left counts as raised, even with no pre-tax balance (the cash-only variant).
- Reading the estate change in today's dollars: it is nominal at the timing's last year, which differs between the two people's tables.
- Counting a year as covered because the plan's own target is past the fill, when the ledger converted less than the fill: example-couple's 2033 to 2036 would read as covered, though Sam's share was skipped each year.
- One sentence for the whole window ("no pre-tax balance, or no room"): the years differ, and a skipped conversion is neither.

## Family

outputs: `survivor-scenario-row-estate-delta`, `survivor-scenario-row-lifetime-tax-delta`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 5 derivation (worksheet `survivor-transition.md`, case L-A by hand from Rev. Proc. 2025-32, and a scratch prototype of the rule); independently checked (evidence/b2p1-slice5-check.md, item 4: L-A reproduced, and correction C1, raised years on executed dollars with the fill capped). The cash-only variant is the implementation's, from C1. Implemented by: claude (opus 5.5), 2026-09-28. Reviewed by: not yet reviewed.

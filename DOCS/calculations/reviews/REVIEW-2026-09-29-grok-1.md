# Review, 2026-09-29 (grok-1: the first half of the Codex-derived records)

Reviewer: Grok (grok-4.7, xAI), headless and read-only, by independent recomputation without executing the engine, its tests or its scripts, on a snapshot of RetireGolden main at commit `6f668e06`. Scope: the 13 records below, derived by codex, so the reviewer is of a different agent family from the deriver (catalog gate 7): `accounts-ending-balance-by-category`, `allocation-glidepath-interpolation`, `allocation-total-return-drift`, `allocation-weight-normalization`, `income-annuity-annual`, `income-one-time-annual`, `spending-debt-service-annual`, `spending-one-time-goals-annual`, `spending-property-costs-annual`, `sustainable-spending-bisection`, `insight-impact-estate-and-lifetime-tax-deltas`, `income-tips-ladder-and-ladder-value-annual`, `aca-400-percent-cliff`. Verdicts: 13 approve, 0 reject. The reviewer's scripts are in `DOCS/calculations/reviews/scripts/grok-1/` (recompute.py), and each runs from the repository root. The only edits to the report below replace the reviewer's own scratch-folder paths with those repository paths. Verbatim output follows.

---

# Independent review of calculation records

Reviewer: Grok (grok-4.7, xAI), headless, read-only.
Date: 2026-09-29.
Repository commit: `6f668e06`.
Scope: thirteen records — `accounts-ending-balance-by-category`, `allocation-glidepath-interpolation`, `allocation-total-return-drift`, `allocation-weight-normalization`, `income-annuity-annual`, `income-one-time-annual`, `spending-debt-service-annual`, `spending-one-time-goals-annual`, `spending-property-costs-annual`, `sustainable-spending-bisection`, `insight-impact-estate-and-lifetime-tax-deltas`, `income-tips-ladder-and-ladder-value-annual`, `aca-400-percent-cliff`.

The engine, its tests, and its scripts were not run. No file under `packages/` was imported. Function bodies listed in `implementedByFunctions` were not read; signatures, doc comments, and the evidence tests' assertions were. Arithmetic is in `DOCS/calculations/reviews/scripts/grok-1/recompute.py`. Primary-source quotes below are text fetched and read for this review, not paraphrases of the worksheets.

## accounts-ending-balance-by-category

### Recomputed

Last-year balances, summed by the five published types:

- cash = 10,000
- taxable = 20,000 + 5,000 = 25,000
- traditional = 30,000
- roth = 40,000
- hsa = 6,000

### Match

Each category equals the worksheet's expected object. Difference is zero.

### Tolerance

Absolute $0.005 per member. The sums are exact integers of exact integer inputs, so the bound is a binary-float allowance around an exact result, not a rounding rule. It is justified and not consumed.

### Wrong readings checked

- A penultimate-year fold of the evidence's sentinel balance of $1 on each account is {cash: 1, taxable: 2, traditional: 1, roth: 1, hsa: 1}, not the last-year object. The worksheet does not name that earlier row's dollars; the difference is the claim, and it holds.
- Keeping the two taxable accounts separate publishes 20,000 and 5,000, not the required 25,000.
- Adding property or insurance cash value adds a category the five-key object does not have. That is a shape difference, not a dollar on one of the five keys.

### Sources

No statute, regulation, or published table is cited. The method is the summary's own composition convention: last ledger row, five logical account types. The record's statement matches that convention. Nothing in the method departs from a cited source, because none is cited.

### Record consistency

Statement, formula, and limits say what the worksheet derives: last-row sums into cash, taxable, traditional, Roth, and HSA, with equity compensation, property, debt, ladder, and insurance excluded. The empty-ledger five zeros are a stated edge, not a worked case. The 2026-09-26 note that `balancesByCategory` refuses an account id that collides with a property, debt, or permanent-life policy id changes no expected value and does not overclaim the worksheet's six accounts.

### Evidence binding

`packages/engine/src/projection/compareSummary.evidence.test.ts` (`describeCalculation` for this id) asserts 10,000 / 25,000 / 30,000 / 40,000 / 6,000 within $0.005, asserts the taxable total is not the penultimate row's, and asserts the published object has exactly the five category keys.

### Verdict

Approve.

## allocation-glidepath-interpolation

### Recomputed

t = (2025 − 2020) / (2030 − 2020) = 5/10 = 1/2.

- US stocks = 0.8 + (1/2)(0.6 − 0.8) = 0.7
- Bonds = 0.2 + (1/2)(0.4 − 0.2) = 0.3
- 2015, before the start, clamps to [0.8, 0.2]
- 2035, after the end, clamps to [0.6, 0.4]

The knots 2020 and 2030 are the endpoints themselves. A staged reading of the same two years holds [0.8, 0.2] through 2025 and steps to [0.6, 0.4] at 2030. A custom pair with the same years interpolates identically at 2025. Renormalization after the mix does not move a result whose components already sum to 1.

### Match

2025 [0.7, 0.3], 2015 [0.8, 0.2], 2035 [0.6, 0.4]. Difference is zero. The evidence pads the unused international and cash classes with zeros; that is the four-class vector of the same two-class result.

### Tolerance

Absolute 1e-12 per component. The arithmetic is dyadic rationals (halves of tenths) that binary floating point represents exactly. The bound is a comparison allowance, not a rounding rule.

### Wrong readings checked

- Integer step selection at 2025 returns [0.8, 0.2], which differs from [0.7, 0.3] by 0.1 on each class. That reading is the staged rule, and the worksheet rules it out for the linear probe.
- Extrapolation one span before 2020 is 0.8 + (−0.5)(−0.2) = 0.9 and 0.2 + (−0.5)(0.2) = 0.1, the worksheet's [0.9, 0.1], not the clamped [0.8, 0.2].

### Sources

No statute or published table is cited. The worksheet calls this a policy compilation convention, not an optimal-allocation claim. The method is the linear mix it states, with flat endpoints. No cited source is departed from.

### Record consistency

The statement covers static, linear, staged, and custom. The worksheet works the linear interior and the two clamps, and states the staged step in the claim. The record's extra branches (degenerate linear policy, a single custom target, renormalization when the mix does not already sum to 1) are limits, not extra expected values. It does not list `bucket-lens-allocation`, and the limit says why. No overclaim.

### Evidence binding

`packages/engine/src/allocation/assetClasses.evidence.test.ts` asserts [0.7, 0, 0.3, 0] at 2025, the clamped endpoints at 2015 and 2035, the knots at 2020 and 2030, the staged step, and the matching custom interpolation, each within 1e-12.

### Verdict

Approve.

## allocation-total-return-drift

### Recomputed

Beginning wealth 1. Ending amounts: 0.6 × 1.10 = 0.66 and 0.4 × 0.95 = 0.38. Total 1.04.

- Stocks = 0.66 / 1.04 = 66/104 = 33/52 = 0.6346153846153846…
- Bonds = 0.38 / 1.04 = 38/104 = 19/52 = 0.3653846153846154…

Sum of the two fractions is 1. The unused classes stay at 0.

### Match

The worksheet's [33/52, 19/52] and the printed decimals match. Difference is zero in exact arithmetic. The printed decimals are the first 15 digits of those rationals.

### Tolerance

Absolute 1e-12 per weight. 33/52 and 19/52 are not binary-exact, so a float evaluation of the division can differ in the last bits. 1e-12 is far larger than that error and far smaller than either wrong reading. Justified.

### Wrong readings checked

- Adding the returns to the weights gives [0.7, 0.35], sum 1.05, not 1, and each component differs from 33/52 and 19/52.
- Leaving the grown amounts unnormalized gives [0.66, 0.38], sum 1.04, not the shares.

### Sources

No statute or published table is cited. The justification states the total-return convention: distributions treated as reinvested, so weight moves with total return. The record's limit says the same. No cited source is departed from.

### Record consistency

Statement and formula are the worksheet's grow-and-renormalize rule, including the floor at a zero factor and the unchanged-weights branch when the total is not positive. Those branches are limits, not worked cases. `bucket-lens-allocation` is explained and not listed. No overclaim.

### Evidence binding

`assetClasses.evidence.test.ts` asserts the drifted vector [33/52, 0, 19/52, 0] within 1e-12 and asserts the components sum to 1.

### Verdict

Approve.

## allocation-weight-normalization

### Recomputed

W = 60 + 20 + 20 + 0 = 100. Vector = [60/100, 20/100, 20/100, 0/100] = [0.6, 0.2, 0.2, 0]. Sum = 1.

A magnitude sort of the same weights is not unique (two classes share 20) and, on the discriminating 20/0/60/20 record, would put 0.6 in a different slot than the bonds index. Class order keeps [0.2, 0, 0.6, 0.2].

### Match

[0.6, 0.2, 0.2, 0], sum 1. Difference is zero.

### Tolerance

Absolute 1e-12 per component. 60/100, 20/100, and 0/100 are binary-exact. The bound is a comparison allowance, not a rounding rule.

### Wrong readings checked

- Returning percentages gives [60, 20, 20, 0], sum 100, not the fraction vector.
- Sorting by magnitude rather than class order can move a 20 percent bond weight into another class. On the worksheet's own inputs the two 20s make that sort ambiguous; the distinct number is the 20/0/60/20 order case, which the evidence asserts and the worksheet's wording allows.

### Sources

No statute or published table is cited. Normalization of nonnegative weights by their positive sum is the stated convention. The record separately states the all-cash vector when the sum is not positive; the worksheet's domain excludes that case. No cited source is departed from.

### Record consistency

Statement and formula match the worksheet, including the floor of a negative weight at zero before the sum. The schema bound (each weight in [0, 100], total 100 ± 0.5) and the zero-total branch are named as limits. The worksheet's "no direct engine weight-vector family yet" matches the empty `outputs`. No overclaim.

### Evidence binding

`assetClasses.evidence.test.ts` asserts [0.6, 0.2, 0.2, 0] and sum 1 within 1e-12, asserts the positional 20/0/60/20 vector, and asserts the zero-total all-cash vector the record's limit names.

### Verdict

Approve.

## income-annuity-annual

### Recomputed

One year after the start age: full annual payment = 1,500 × 12 × 1.02 = 18,000 × 1.02 = 18,360. Owner dead, joint annuitant alive, survivor share 60 percent: 18,360 × 0.60 = 11,016.

The start year itself, owner alive, has had no COLA year: 1,500 × 12 = 18,000. That figure is in the evidence, not in the worksheet's expected line. It follows the same formula.

Pre-start purchase worked case, as the worksheet states it: from a 2026 start the brokerage row is $100,000 lower with the contract than without it, and no warning is added. From a 2027 start the 2027 row is the same with and without the contract, and the warning naming the $100,000 premium and Joint brokerage is added. Those two comparisons are identities of the stated convention (premium taken only when the purchase year is a projected year). I did not recompute the separate U1 ending-net-worth pair (−$147,622.51 from a 2026 start, +$455,165.79 from a 2027 start): that pair is a full-horizon estate effect the worksheet attributes to another test, not a value this worksheet's method derives from its inputs.

### Match

$11,016 equals the expected value. Difference is zero. The two pre-start comparisons match the worked case as stated.

### Tolerance

Absolute $0.005. 1,500 × 12 × 1.02 is an integer times a binary-exact hundredth, and the product is the integer 18,360; 60 percent of that is the integer 11,016. The bound is a float allowance around an exact dollar result.

### Wrong readings checked

- Life-only after the owner's death pays $0, not $11,016.
- Paying the full post-COLA amount after death pays $18,360, not $11,016.
- 60 percent of the monthly amount with the COLA omitted: 1,500 × 0.60 × 12 = 10,800, not $11,016.

### Sources

No statute is cited for the joint-survivor fraction, the annualization, or the COLA. The worksheet derives those from the plan's stated form, the monthly amount, and the annual-COLA convention. A life-only stop and a period-certain window are named as the other forms and are not this record's claim. The pre-start treatment is stated as a registered modeling limit, not as a statute. No cited source is departed from.

### Record consistency

Statement and formula match the worksheet: start at the owner's start age, compound monthlyAmount × 12 by the annual COLA over the years since that age, then apply survivorPct/100 after the owner's death. Units are nominal dollars per year. The pre-start double-count is named as a limit and is not corrected, which is what the worksheet says. The U1 cent figures are attributed to `preStartEvents.figures.test.ts` rather than derived here. No overclaim of the $11,016 case.

### Evidence binding

`packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts` asserts annuity income of 11,016 within $0.005, rejects 18,360 and 10,800, and asserts the start-year 18,000. The pre-start block asserts the $100,000 brokerage difference from a 2026 start, the unchanged 2027 row, and the warning text the worksheet quotes.

### Verdict

Approve.

## income-one-time-annual

### Recomputed

Year gate passes (2031 = 2031) and someone is alive. Amount = 50,000 × 1.12 = 56,000.

A neighbouring year fails the exact-year gate: $0.

Pre-start worked case: a $50,000 stream dated 2026, not inflation-adjusted, pays $50,000 in 2026 from a 2026 start and pays $0 in every projected year from a 2027 start. That is the same exact-year gate, plus the warning the worksheet quotes.

### Match

$56,000 equals the expected value. Neighbouring years are $0. Difference is zero.

### Tolerance

Absolute $0.005. 50,000 × 1.12 is an integer times a binary-exact hundredth and equals the integer 56,000. The bound is a float allowance around an exact result.

### Wrong readings checked

- Treating the amount as already nominal pays $50,000, not $56,000.
- Paying the inflated amount in 2030 or 2032 would publish $56,000 in the wrong year; the exact-year gate publishes $0 there.
- Treating capital-gain character as an exclusion from cash income pays $0. The cash amount does not depend on tax treatment, so the published cash is still $56,000.

### Sources

No statute is cited. The method is the worksheet's year gate, household-alive gate, and inflation election. Tax treatment is stated to route the income, not to change the cash amount. No cited source is departed from.

### Record consistency

Statement and formula match: amount × inflFactor only when inflationAdjusted, only in the named year, only while someone is alive, otherwise 0. The pre-start warning is a limit and does not change the $56,000 case. No overclaim.

### Evidence binding

`packages/engine/src/projection/internal/otherIncomeStreams.evidence.test.ts` asserts 56,000 in 2031 within $0.005, rejects 50,000, asserts the income total equals the cash amount, and asserts $0 in 2030 and 2032. The pre-start block asserts $50,000 from a 2026 start and [0, 0] from a 2027 start, with the warning text the worksheet quotes.

### Verdict

Approve.

## spending-debt-service-annual

### Recomputed

Debt A grows to 10,000 × 1.12 = 11,200. Level payment is min(500 × 12, 11,200) = min(6,000, 11,200) = 6,000. Remaining 11,200 − 6,000 = 5,200.

Debt B grows to 1,000 × 1.12 = 1,120. 2030 is its payoff year, so it pays 1,120 and leaves 0.

Total = 6,000 + 1,120 = 7,120.

Payoff dated 2029 in a projection that starts in 2030: the stated rule reaches that payoff in the first projected year and pays the same grown balance, 1,120. The warning names $1,120 and the $1,000 balance with a year of interest. I did not recompute the reviewer's −$189,695.85 ending-net-worth movement; the worksheet reports that figure from another review and does not give the mortgage inputs needed to recompute it here.

### Match

$7,120 equals the expected total. The component payments and remaining balances match the arithmetic the worksheet shows. Difference is zero.

### Tolerance

Absolute $0.005. Both products are integers (10,000 × 1.12 = 11,200, 1,000 × 1.12 = 1,120) and the fold is an integer sum. The bound is a float allowance around an exact result. The record says the ordered fold is a binary float and states no rounding rule, which matches.

### Wrong readings checked

- Paying before growing: Debt A still pays min(6,000, 10,000) = 6,000, and Debt B's payoff pays the un-grown 1,000, so the total is 7,000, not 7,120. Remaining on A would also differ (4,000 rather than 5,200).
- Treating Debt B's payoff as the ordinary annual payment of 1,200 gives 6,000 + 1,200 = 7,200, which is $80 above the grown balance.
- Ignoring payoffYear and capping Debt B at min(1,120, 1,200) = 1,120 happens to equal the right payment at these inputs. The worksheet says so. A lower annual payment, for example $50 a month, would pay 600 under that reading and 1,120 under the payoff rule. The record's limit says the test discriminates the first two numerically and states the third as a rule. That is accurate, not an overclaim.

### Sources

No statute is cited. Interest-before-payment, a scheduled payoff replacing the level payment, and a level payment that cannot exceed the balance then due are the stated convention. The pre-start payoff is a disclosed modeling choice ("nothing moves" on the dollars; the projection names it). No cited source is departed from.

### Record consistency

Statement and formula match the grow-then-pay rule, including payoff reached when the year is at or after payoffYear. The pre-start limit says the ledger pays the whole grown balance in the first year, which is the worked case. No overclaim of the $7,120.

### Evidence binding

`packages/engine/src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts` asserts Debt A 6,000, Debt B 1,120, remainders 5,200 and 0, and the total 7,120 within $0.005; rejects 7,000 and 7,200; asserts the same 7,120 as published `expenses.debtService`; and asserts the pre-start case pays 1,120 with the warning text naming $1,120 and the $1,000 balance.

### Verdict

Approve.

## spending-one-time-goals-annual

### Recomputed

Roof = 10,000 × 1.10 = 11,000. Trip = 5,000 × 1.10 = 5,500. Car's target year is 2031, so it contributes 0 in 2030. Total = 16,500.

With no scheduler, nothing is skipped, so a skipped amount cannot enter this field.

Pre-start worked case: a $30,000 goal dated 2026, zero inflation, funds $30,000 from a 2026 start and funds $0 in every projected year from a 2027 start.

### Match

$16,500 equals the expected value. Difference is zero.

### Tolerance

Absolute $0.005. 10,000 × 1.10 and 5,000 × 1.10 are exact integers. The bound is a float allowance around an exact result.

### Wrong readings checked

- Adding the 2031 car at the same factor: 16,500 + 20,000 × 1.10 = 16,500 + 22,000 = 38,500, not 16,500.
- Failing to inflate the two 2030 goals: 10,000 + 5,000 = 15,000, not 16,500.
- Adding a skipped $7,000 to the funded field would publish 23,500. Under the worksheet's null scheduler that skipped amount is not produced; the evidence asserts four zero skip accumulators, so the funded field cannot contain it. The wrong reading is a different number from 16,500, as claimed.

### Sources

No statute is cited. Amounts in today's dollars, inflated, funded in the target year, with skipped dollars kept out of the funded field, is the stated convention. No cited source is departed from.

### Record consistency

Statement and formula match the no-scheduler case the worksheet works. The guardrail skip is a limit, and the evidence binding for "nothing skipped" is named. The pre-start warning does not change the $16,500. No overclaim.

### Evidence binding

`packages/engine/src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts` asserts 16,500 within $0.005, asserts it equals 11,000 + 5,500 + 0, asserts the four skip accumulators are zero, and rejects 38,500, 15,000, and 23,500. The pre-start block asserts $30,000 from a 2026 start and [0, 0] from a 2027 start, with the warning text the worksheet quotes.

### Verdict

Approve.

## spending-property-costs-annual

### Recomputed

Home A is still owned in 2030 (sale year 2031): (3,000 + 1,200) × 1.10 = 4,200 × 1.10 = 4,620. Home B's sale year is 2030, so it contributes 0. Total = 4,620.

Sale dated the year before a projection that starts in 2030: the stated effective sale year is the start year, 2030, so Home B is again charged nothing and Home A is still 4,620.

A household with nobody alive produces no row. That is in the record and the evidence, and it follows the worksheet's ownership-and-alive convention.

### Match

$4,620 equals the expected value. Difference is zero. The pre-start sale case does not move that number, which is what the worksheet says.

### Tolerance

Absolute $0.005. 4,200 × 1.10 is the integer 4,620. The bound is a float allowance around an exact result.

### Wrong readings checked

- Charging Home B through its sale year: 4,620 + (2,000 + 800) × 1.10 = 4,620 + 3,080 = 7,700, not 4,620.
- Inflating tax but not insurance: 3,000 × 1.10 + 1,200 = 3,300 + 1,200 = 4,500, not 4,620.
- Stopping Home A's costs because its mortgage is paid: $0, not $4,620. The formula does not read a mortgage balance.

### Sources

The worksheet says no source governs a sale date that has passed, and it states the modeling choice (a property still on the plan is sold in the first year, and costs stop from that year). I found no cited statute that this method claims to follow and then departs from. The carrying-cost formula itself is the plan convention the claim states.

### Record consistency

Statement and formula match: sum of (tax + insurance) × the cumulative factor over properties still owned, nothing from the effective sale year onward, nothing when nobody is alive. The pre-start rule is the same rule, and the $1,017,839 figure is reported as the reviewer's measured estate effect of the old disagreement, not as a value this worksheet derives. No overclaim of the $4,620.

### Evidence binding

`packages/engine/src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts` asserts Home A's 4,620 and the total 4,620 within $0.005, rejects 7,700, 4,500, and 0, asserts an empty row list when nobody is alive, and asserts the pre-start sale still charges only Home A at 4,620.

### Verdict

Approve.

## sustainable-spending-bisection

### Recomputed

Independent boundary: spending is feasible at or below $63,000. Initial bracket $60,000 feasible, $70,000 infeasible. Resolution $1,000. Integer midpoint is the floor of the average, which is what "integer-dollar midpoint" produces on these even sums (floor and ceiling coincide until the last probe).

| Probe | Bracket before | Midpoint | Feasible? | Bracket after |
|---|---|---:|---|---|
| 1 | 60,000 / 70,000 | 65,000 | no (65,000 > 63,000) | 60,000 / 65,000 |
| 2 | 60,000 / 65,000 | 62,500 | yes | 62,500 / 65,000 |
| 3 | 62,500 / 65,000 | 63,750 | no | 62,500 / 63,750 |
| 4 | 62,500 / 63,750 | 63,125 | no | 62,500 / 63,125 |

Width 63,125 − 62,500 = 625, which is not greater than 1,000, so the search stops. Feasible lower bound = 62,500. Slack = 62,500 − 40,000 = 22,500. Converged, because the width met the resolution. $62,500 is already a multiple of $100, so rounding the published answer down to $100 does not move it.

`simulationCount` is not determined by this contract. I did not invent one.

The guardrail counterexample ($164,391 depletes, $166,971 does not) and the unpriced-credit gaps are reported measurements, not values this bracket derives. I did not recompute those ledgers; the worksheet does not give their inputs as a worked case of this bisection.

### Match

maxBaseAnnual $62,500, spendingSlackDollars $22,500, converged true. The four probes are 65,000, 62,500, 63,750, 63,125. Difference is zero.

### Tolerance

Exact dollars. Every probe is an integer, the predicate is a comparison with an integer boundary, and slack is an integer difference. Exact tolerance is the right one. A float bound would be looser than the arithmetic supports.

### Wrong readings checked

- Returning the infeasible upper bound gives $63,125, which the predicate rejects (63,125 > 63,000).
- Averaging the final bracket gives (62,500 + 63,125) / 2 = $62,812.50, which was never probed and is not an integer dollar.

### Sources

The only statute the worksheet cites is 26 U.S.C. 36B(b)(2), for the limit that an unpriced premium tax credit lies between 0 and the full premium. I read that section's operative rule on the Cornell text of 26 U.S.C. 36B fetched for the cliff record: the credit is the excess of the adjusted monthly premium over the taxpayer's contribution amount, and not more than the excess of the premiums paid. A credit between 0 and the premium follows from that cap. The bisection itself cites no statute. The method is the stated integer bracketing under a monotone predicate. The worksheet says monotonicity is assumed only at fixed-target spending, and it gives a guardrail counterexample. That is a stated limit, not a silent departure.

### Record consistency

Statement and formula match the worked search: integer midpoint, keep the feasible lower and the infeasible upper, stop when the width is within the resolution, publish the feasible lower bound, and round that bound down to $100 when it is known to pass. The limits name the undocumented simulation count, the public API's own bracket (the evidence reaches 60,000/70,000 before the four probes), the non-monotone guardrail case, the unpriced-credit direction, and the required-spending floor. The worked example has a feasible seed, no floor, no Marketplace year, and fixed-target spending, so those limits do not change $62,500. No overclaim.

### Evidence binding

`packages/engine/src/decisions/spendingSolver.evidence.test.ts` asserts maxBaseAnnual 62,500, spendingSlackDollars 22,500, and converged true, at exact tolerance, and asserts the four worksheet probes in order after the bracket has reached 60,000 and 70,000.

### Verdict

Approve.

## insight-impact-estate-and-lifetime-tax-deltas

### Recomputed

Estate delta = 530,000 − 500,000 = +30,000. Lifetime tax delta = 185,000 − 200,000 = −15,000. The negative sign is candidate minus baseline, so a tax saving is negative.

### Match

Both expected values. Difference is zero.

### Tolerance

Absolute $0.005. Both differences are exact integers of exact integer inputs. The bound is a float allowance around an exact result.

### Wrong readings checked

- Reversing both subtractions gives estate −30,000 and lifetime tax +15,000.
- Reporting the candidate totals themselves gives 530,000 and 185,000, not the deltas.
- Writing an IRMAA annual premium cliff of $2,400 into the estate-delta field is a different number and a different meaning. The worksheet and the record both say that exception belongs to the IRMAA record and is not exercised here. I did not recompute that detector.

### Sources

No statute is cited. The subtraction order is the field convention the worksheet states: an estate improvement is positive and a tax saving is negative. No cited source is departed from.

### Record consistency

Statement and formula are candidate minus baseline on both summary fields. The 2026-09-27 restatement corrects the unit from today's dollars to nominal dollars of the plan's last year (estate) and each year's own dollars summed (lifetime tax). The worksheet says the evidence plan runs at zero inflation, so no worked value moves. That correction removes an overclaim; the record now says what the differences are. The limits name the flat-rate test double and the IRMAA exception. No remaining overclaim.

### Evidence binding

`packages/engine/src/decisions/evaluateCandidate.evidence.test.ts` asserts both deltas (30,000 and −15,000) within $0.005, asserts the four summary inputs the subtraction uses, asserts the estate delta is positive and the tax delta is negative, and rejects the reversed signs and the candidate totals.

### Verdict

Approve.

## income-tips-ladder-and-ladder-value-annual

### Recomputed

Rung A: face 10,000, coupon 1 percent, maturity offset 1. Rung B: face 20,000, coupon 2 percent, maturity offset 3. Scale 0.8. Factors: offset 0 = 1, offset 1 = 1.05, offset 2 = 1.10.

Purchase year, offset 0: cash = 0 by the stated rule. Value = (10,000 + 20,000) × 0.8 × 1 = 24,000.

Offset 1: coupons = 10,000 × 0.01 + 20,000 × 0.02 = 100 + 400 = 500, because the maturing rung's coupon is included (maturityOffset ≥ offset). Maturing principal = 10,000. Cash = (500 + 10,000) × 0.8 × 1.05 = 10,500 × 0.84 = 8,820. Value = 20,000 × 0.8 × 1.05 = 16,800. Rung A has matured, so it is out of year-end face.

Offset 2: only Rung B pays a coupon, 400, and nothing matures. Cash = 400 × 0.8 × 1.10 = 352. Value = 20,000 × 0.8 × 1.10 = 17,600.

The plan-constructible purchase-year branch the worksheet also states — cash exactly 0 in the purchase year, value equal to the whole face times scale times that year's factor — is the offset-0 row above. The evidence's real projection uses a different ladder (a planned $10,000 real payout at offset 1) and asserts cash 0 in the purchase year and the planned amount at offset 1. That $10,000 is the planned income, not a second derivation of the 8,820 case. I did not reprice that ladder off the yield curve; the worksheet does not ask this composition to.

Pre-start purchase: the worksheet's worked case is qualitative (from a 2026 start more than $100,000 leaves the brokerage; from a 2027 start no cost is taken and the warning names $114,426). The $114,426 is a quote of a different ladder, not a value of the two-rung arithmetic. I did not recompute it. The warning text and the "no cost taken" comparison are what this worksheet adds, and they do not move 8,820 or 16,800.

### Match

Purchase year 0 and 24,000; offset 1 8,820 and 16,800; offset 2 352 and 17,600. Difference is zero on every stated value.

### Tolerance

Absolute $0.005. Every product here is an integer: 0.8 × 1.05 = 0.84, and 10,500 × 0.84 = 8,820; 16,000 × 1.05 = 16,800; 320 × 1.10 = 352; 16,000 × 1.10 = 17,600. The bound is a float allowance around exact dollar results. The factors 1.05 and 1.10 are not a constant inflation rate; the record says that, and the arithmetic uses them as given.

### Wrong readings checked

- Dropping the maturing rung's own coupon: (400 + 10,000) × 0.8 × 1.05 = 10,400 × 0.84 = 8,736, not 8,820.
- Keeping the matured face in offset-1 year-end value: 30,000 × 0.8 × 1.05 = 25,200, not 16,800.
- Paying the first coupons in the purchase year: 500 × 0.8 = 400, against the stated purchase-year cash of 0.

### Sources

The composition cites no statute for the cash and face identities. Domain rule 18, which this catalog points at for the ladder, states the same construction: earlier years funded by principal plus the coupons of every still-outstanding rung, unmatured face reported as ladder value, a short funding account scaling every rung. The worksheet follows that convention. It also records the documented simplification that coupons are annual (real TIPS pay semiannually). This record's cash identity uses the annual coupon the inputs state. I did not find a cited table this method misreads. The minimum-coupon regulation and the real-yield curve belong to the construction record, not to these two given rungs.

### Record consistency

Statement and formula match: coupons on rungs with maturityOffset ≥ offset, principal on rungs maturing at the offset, year-end face on rungs with maturityOffset > offset, cash forced to 0 at offset 0, both scaled and inflated. The non-constructible rung set, the direct-call scale of 0.8, and the non-constant factors are named as limits. Taxable income (coupons plus accretion) is named as a different quantity. The pre-start double-count is a registered limit and does not change the worked dollars. No overclaim.

### Evidence binding

`packages/engine/src/projection/internal/tipsLadderAnnualCashFlow.evidence.test.ts` asserts purchase-year value 24,000 and no cash field, offset-1 cash 8,820 and value 16,800, offset-2 cash 352 and value 17,600, each within $0.005, and rejects 8,736 and 25,200. The real-projection block asserts purchase-year cash of 0. The pre-start block asserts the warning text naming $114,426 and that no cost leaves the brokerage from a 2027 start.

### Verdict

Approve.

## aca-400-percent-cliff

### Recomputed

Two-person contiguous poverty line, as published: 15,650 + 5,500 = 21,150. Confirmed in the Federal Register text read for this review (90 FR 5917, January 17, 2025): one person $15,650, two persons $21,150, and $5,500 for each additional person.

At the cliff: 84,600 / 21,150 × 100 = 400 exactly. overCliff is false, because the test is strictly above 400.

Applicable rate at 400 percent, from the 2026 table read for this review: 9.96 percent, the flat final band. Contribution = 84,600 × 9.96 / 100 = 8,426.16. Preliminary credit = 12,000 − 8,426.16 = 3,573.84. Enrollment cap = min(10,000, 3,573.84) = 3,573.84. Allowable credit = 3,573.84.

One dollar above: 84,601 / 21,150 × 100 = 400.004728132… percent, which is greater than 400. overCliff is true. Allowable credit = 0. Economic net premium = the enrollment premium, 10,000.

2027, which this record also claims: the 2027 table ends at the same inclusive ceiling (see Sources). This worksheet does not work a 2027 dollar case. The record's limit says the 2027 dollar cliffs (63,840 for one person, 132,000 for four) are pinned by another test. I checked the arithmetic of those two figures against the 2027 guidelines the coverage-year block states (15,960 × 4 = 63,840; 15,960 + 3 × 5,680 = 33,000; 33,000 × 4 = 132,000). They are four times the stated guidelines. I did not fetch 91 FR 1797 for this review, so that check is arithmetic on the block, not a fresh reading of the 2027 notice.

### Match

Credit at the cliff $3,573.84, overCliff false, FPL percentage 400. One dollar above: credit $0, overCliff true, net premium $10,000. The above-cliff percentage 400.004728132388… matches the worksheet's printed expansion. Difference is zero within the stated bounds.

### Tolerance

Absolute $0.005 on dollar floats, 1e-9 on the FPL percentage, exact on the booleans. 84,600 / 21,150 = 4 exactly, so the at-cliff percentage is exact. 84,600 × 0.0996 = 8,426.16 exactly (9.96 percent is 996/10,000, and 84,600 × 996 = 84,261,600, divided by 10,000 is 8,426.16). The credit is an exact cent. The above-cliff percentage is not binary-exact; 1e-9 is far inside the distance from 400 to 400.0047, so it cannot flip the cliff. Justified.

### Wrong readings checked

- Treating the ceiling as exclusive denies the household at exactly 400 percent and produces a credit of $0, not $3,573.84.
- Continuing the 9.96 percent rate one dollar above the cliff: contribution = 84,601 × 0.0996 = 8,426.2596; preliminary credit = 12,000 − 8,426.2596 = 3,573.7404; the enrollment cap does not bind. That is the worksheet's approximately $3,573.7404, not $0.

### Sources

Operative sentences read for this review:

- 26 U.S.C. 36B(c)(1)(A), Cornell text of the Code fetched 2026-09-29: "The term 'applicable taxpayer' means, with respect to any taxable year, a taxpayer whose household income for the taxable year equals or exceeds 100 percent but does not exceed 400 percent of an amount equal to the poverty line for a family of the size involved." "Does not exceed 400 percent" includes a household at exactly 400 percent and excludes one strictly above. The worksheet's predicate f ≤ 400 follows that sentence.
- 26 U.S.C. 36B(c)(1)(E), same text: "In the case of a taxable year beginning after December 31, 2020, and before January 1, 2026, subparagraph (A) shall be applied without regard to 'but does not exceed 400 percent'." That suspension ends before a taxable year beginning in 2026. The restored cliff for 2026 and 2027 follows. I did not find, in the text read, a later amendment extending subparagraph (E).
- Rev. Proc. 2025-25, section 3.01, as published in Internal Revenue Bulletin 2025-32 (irs.gov/irb/2025-32_IRB, fetched 2026-09-29): "For taxable years beginning in calendar year 2026, the Applicable Percentage Table for purposes of § 36B(b)(3)(A)(i) and § 1.36B-3(g) is: … At least 300% but not more than 400% — initial percentage 9.96%, final percentage 9.96%." The row is "not more than 400%," which is the same inclusive ceiling. The 9.96 percent rate the credit uses at 400 percent is that row.
- Rev. Proc. 2026-26, section 3.01, text extracted from the IRS PDF fetched 2026-09-29: the 2027 table's last row is "At least 300% but not more than 400%," initial and final percentage 10.22%. The 2027 cliff is the same inclusive 400 percent. The worksheet's 2026 dollar example correctly does not use 10.22%.
- HHS 2025 poverty guidelines, 90 FR 5917 (January 17, 2025), Federal Register HTML fetched 2026-09-29: for the 48 contiguous states and the District of Columbia, one person $15,650 and two persons $21,150, with $5,500 added for each additional person. The worksheet's two-person line is that published figure.

The method does not depart from these texts. Two stated limits are real and already named: the below-100-percent exception pathways are outside this calculation, and the engine does not round the contribution to the whole dollar Form 8962 rounds. Neither changes the cliff comparison or this case's credit. The credit formula used here (benchmark minus contribution, floored at zero, capped by the enrollment premium) is the annual identity the companion credit record states; on this case the monthly and annual paths are the same because both premiums are level and the contribution is an exact cent.

### Record consistency

Statement and formula say what the worksheet derives: credit allowed at exactly 400 percent, none strictly above, overCliff true only above the ceiling, in 2026 and 2027 alike, with the 100 percent floor and the below-floor exceptions outside this record. The 2027 dollar cliffs are attributed to another test rather than smuggled into this worksheet's expected values. The rounding note (exact percentage, not the whole number the applicable-percentage table is read at) matches the form's cliff comparison and does not move this case, which lands on an integer percentage. No overclaim.

### Evidence binding

`packages/engine/src/tax/aca.evidence.test.ts` asserts the 2026 block's ceiling is 400 and the two-person poverty line is 21,150, asserts overCliff false and credit 3,573.84 at MAGI 84,600 (FPL percentage within 1e-9 of 400), and asserts overCliff true, credit 0, and net premium 10,000 at MAGI 84,601.

### Verdict

Approve.

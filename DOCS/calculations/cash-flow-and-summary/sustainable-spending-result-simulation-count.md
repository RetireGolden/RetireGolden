## Claim

Kind: model. `decisions/spendingSolver.ts#SustainableSpendingResult.simulationCount` counts one seed probe; if feasible, each doubling probe until failure; then one bisection probe per halving while the bracket exceeds the requested resolution and the simulation budget remains. If the seed is infeasible, it counts one additional probe at zero. This sequence is stated directly by the field comment.

## Justification

Probe feasibility is supplied as fixture evidence; this worksheet derives only the deterministic count from that evidence, bracket, resolution, and budget.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Feasible seed | 10,000 | dollars/year |
| First doubling probe / result | 20,000 / feasible | dollars/year / state |
| Second doubling probe / result | 40,000 / infeasible | dollars/year / state |
| Bisection probe results | 30,000 infeasible; 25,000 infeasible; 22,500 feasible | dollars/year / state |
| Resolution | 2,500 | dollars/year |
| Maximum simulations | 25 | probes |
| Infeasible-seed case | 10,000 infeasible; zero probed and infeasible too (the plan cannot fund even zero spending) | dollars/year / state |

## Arithmetic

Feasible-seed case: seed `$10,000` is probe 1; doubling probes `$20,000` and `$40,000` are probes 2 and 3, leaving bracket `[$20,000, $40,000]`. Bisection probes `$30,000`, then the appropriate half's `$25,000`, then `$22,500` are probes 4–6; bracket widths go `$20,000 → $10,000 → $5,000 → $2,500`. Because the width is now at most the resolution, the count is `6`, below the budget of 25.

Infeasible-seed case: the seed is probe 1 and the required zero-spending probe is probe 2; that probe is infeasible too, so no bracket opens and the count is `2`. Had the zero probe been feasible, the bracket `[0, 10,000]` would have opened at a width above the resolution and the bisection would have continued, so the count of `2` rests on the stated infeasible zero probe.

## Expected

Exact values: feasible-seed case `6`; infeasible-seed case `2`. Fixture tolerance: exact, because simulation count is an integer.

## Wrong readings

- Not counting the seed gives `5` for the feasible case.
- Counting bracket endpoints again during bisection gives `8`.
- Continuing once width equals the `$2,500` resolution adds an unnecessary probe and gives `7`.

## Family

outputs: `sustainable-spending-result-simulation-count`.

feeds: none.
(m, a) => a + "\n\nRevision note (2026-09-22, pull-request review of #730): the infeasible-seed case left the zero probe's outcome unstated; it is infeasible (the fixture makes zero spending unfundable with a one-time goal the balance cannot cover), which is what stops the search at two probes. No value changed.\n"
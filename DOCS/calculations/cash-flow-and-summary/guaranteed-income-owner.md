## Claim

Kind: model. Every pension and annuity names its owner (schema v7, decision D-PEOPLE-ORDER, rule R2): a pension's participant, an annuity's first annuitant. `projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome` reads that owner through `model/plan.ts#guaranteedIncomeOwnerId`, never the first-listed person: payments start in the owner's birth year plus `startAge` (not before a purchase year), a pension pays in full while the owner lives and `survivorPct` to the other household member after, and an annuity pays by its payout form on the owner's life (a joint-and-survivor form continues to the other member, the second annuitant). The parse refuses an owner-less pension or annuity, a qualified annuity named for anyone but the owner of the traditional account that paid for it, and a pension lump sum rolled into another person's account.

## Justification

An annuity's payments are measured on named lives. IRC 72(c)(3)(A): "If the expected return under the contract, for the period on and after the annuity starting date, depends in whole or in part on the life expectancy of one or more individuals, the expected return shall be computed with reference to actuarial tables prescribed by the Secretary." Treas. Reg. 1.72-5(b)(1) names the two lives of a joint contract in order: "a joint and survivor annuity contract involving two annuitants which provides the first annuitant with a fixed monthly income for life and, after the death of the first annuitant, provides an identical monthly income for life to a second annuitant". A pension belongs to the participant who earned it. "Joint" therefore names no one whose age starts the payments or whose death ends or reduces them, and the engine used to pick the first-listed person without saying so.

An IRA is "a trust created or organized in the United States for the exclusive benefit of an individual or his beneficiaries" (IRC 408(a)), and an individual retirement annuity "is not transferable by the owner" and "The entire interest of the owner is nonforfeitable" (IRC 408(b)(1), (4)). So an annuity bought from one person's IRA is that person's, and a lump sum rolls into the participant's own IRA. The quotes are held and verified in `irc-72-c-3-A-annuity-measured-on-named-lives`.

After the owner's death the surviving spouse stands in the owner's place: "If any distribution attributable to an employee is paid to the spouse of the employee after the employee's death, the preceding provisions of this subsection shall apply to such distribution in the same manner as if the spouse were the employee" (IRC 402(c)(9)), and an IRA is inherited, and so not the spouse's own, only if "such individual was not the surviving spouse of such other individual" (IRC 408(d)(3)(C)(ii)(II)). The plan keeps an account under its dead owner's id, so a qualified purchase from it after the owner's planning age has ended may name the living spouse (revision 2026-09-28, the independent review's M2). A purchase named for a person whose planning age has ended by its purchase year is refused, because it would never pay, and no load repair names such a person. A stored plan of that shape still opens (revision later on 2026-09-28, the independent review's N1): whatever its tax qualification, the contract is given the other person when that person is alive in the purchase year, the only one who could have bought it (`annuityOwnerNamedLivingPerson`, or `guaranteedIncomeOwnerBackFilled` with basis `livingPerson` for an owner-less one), and is removed, its premium left in the account it was to come from, when nobody is (`annuityPurchaseDropped`). Each notice says the figures change.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection start, inflation, account returns | 2026; 0; 0 | year; percent; percent |
| Alex (listed first): date of birth, planning age | 1962-04-15, 92 | ISO date, years |
| Sam (listed second): date of birth, planning age | 1964-09-02, 70 | ISO date, years |
| Pension owned by Sam: start age, monthly amount, COLA, survivor | 65; 2,000; 0; 50 | years; nominal dollars; percent; percent |
| Life-only annuity owned by Sam: start age, monthly amount, COLA | 66; 1,000; 0 | years; nominal dollars; percent |

## Arithmetic

Sam's pension starts in 1964 + 65 = 2029 and pays 2,000 x 12 = 24,000 a year while Sam is alive, through 1964 + 70 = 2034. From 2035 it pays 24,000 x 50/100 = 12,000 to Alex, who is alive through 2054, because Sam reached the start age before dying.

Sam's annuity starts in 1964 + 66 = 2030 and pays 1,000 x 12 = 12,000 a year while Sam lives, through 2034; life-only, it pays nothing from 2035.

## Expected

| Quantity | Value |
|---|---:|
| Pension income, 2028 | 0 |
| Pension income, 2029 | 24,000 |
| Pension income, 2035 | 12,000 |
| Annuity income, 2029 | 0 |
| Annuity income, 2030 | 12,000 |
| Annuity income, 2034 | 12,000 |
| Annuity income, 2035 | 0 |

Exact to the cent (no COLA or inflation, so no non-integer arithmetic): absolute tolerance 0.005.

## Wrong readings

- Timing both on the first-listed person, Alex (1962): the pension would start in 2027 and pay 24,000 in 2028; the annuity would start in 2028 and, life-only, pay until Alex's death after 2054 rather than stopping after Sam's in 2034.
- Reading "Joint" as either person alive: the life-only annuity would keep paying after Sam's death.
- Paying the pension survivor share only while the first-listed person lives: it is paid to the member who outlives the owner.

## Family

outputs: none.

feeds: `income-pension-annual`, `income-annuity-annual`.

## Provenance

Derived by: claude (Opus 5.5), 2026-09-28, from decision D-PEOPLE-ORDER (decisions-2026-09-25.md) and the independent check's rule R2 (evidence/people-order-check.md), the statute and regulation quoted from the texts the check fetched (uscode.house.gov, the eCFR). Implemented by the same session. Reviewed by: unreviewed.

Revision 2026-09-28 (independent review M2): the surviving-spouse exception and the dead-at-purchase refusal; the quotes are held in `irc-72-c-3-A-annuity-measured-on-named-lives`. Reviewed by: unreviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-2-cash-flow.md`.

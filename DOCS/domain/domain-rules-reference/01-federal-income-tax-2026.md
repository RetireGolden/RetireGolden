## 1. Federal income tax (2026)

The optional `annualFederalTaxFacts` Plan field stores separate foreign-income
adjustments and provenance by year. Its internal resolver does not yet feed tax
pricing or published results. The direct calculator now accepts broad
`foreignExclusionAddback` and optional narrow `niitSection911A1NetAddback` inputs;
when the narrow input is omitted, it reuses the broad value as a compatibility
approximation and exposes `niitMagi` separately. Because the annual projection does
not yet transport the resolved narrow value, this delivery does not close
`irc-1411-d-modified-agi-foreign-exclusion-addback` for annual planner results.
See [Taxes](../../features/taxes.md#federal-engine).

### Annual federal-tax facts — phase-one product policy

The resolver records routing and evidence only; it does not calculate statutory
exclusions or change current tax pricing. Populated annual facts currently leave
published projection results unchanged.

The following broad-evidence cases make the compatibility policy explicit:

| Situation | Resolved broad amounts | Broad support and retained evidence |
|---|---|---|
| General `unknown` or `missing`; eligible ACA `known` or `notApplicable` | ACA amount, or zero for `notApplicable` | `characterized`; source quality `legacyContract`; raw general state retained |
| General `missing`; eligible ACA `unknown` | Zero | `approximate` / `legacyZeroFallback`; raw ACA `unknown` retained; no determinate source entry; ACA producer retains `foreign-exclusion-addback-unknown` |
| General `unknown`; no determinate eligible ACA source | Zero | `nonActionable` / `explicitUnknownFallback`; raw states retained |
| Determinate general and eligible ACA amounts disagree | General amount in `generalFederalAmount`; ACA amount in `acaHouseholdMagiAmount` | `nonActionable`; `broad-determinate-source-conflict`; both raw states, amounts, and sources retained |

NIIT `known` uses its supplied amount, including zero; `notApplicable` uses zero.
Both have `characterized` NIIT support, with source quality retained. NIIT
`unknown` or `missing` instead uses `max(0, generalFederalAmount)`, including in
a broad conflict; it never reads `acaHouseholdMagiAmount` directly. The raw NIIT
state remains visible. `unknown` has `explicitUnknownFallback` / `nonActionable`
support; `missing` has `legacyBroadFallback` or `legacyZeroFallback` / `approximate`
support. Both fallback states retain `niit-fallback-used-general-broad`; the
year-level result also retains any broad conflict code.

Year-level `federalTaxSupport` is the worse of broad and NIIT support. NIIT numeric
continuity from broad carries no directional guarantee; consumers must gate on support.

**ACA general-tax compatibility eligibility** is independent of structural PTC support
codes only. All four conditions must hold:

1. `healthcare.applyAcaCredit === true` (dormant when false)
2. Exactly one `acaYears` contract for the year (duplicate contracts or legacy premium
   fallback without a contract → ineligible)
3. That contract passes the runtime example-input comparison (mismatch → ineligible)
4. Gross enrollment premium from that contract is greater than zero (zero gross →
   ineligible)

Structural codes such as `tax-family-structure-unsupported` or
`covered-member-duplicate` affect ACA/PTC readiness separately and do not flip
compatibility eligibility when the four conditions hold. `acaActive` reflects gross
premium presence under `applyAcaCredit`; it is not the compatibility predicate. A
characterized broad leaf from a compatible contract does not certify the full ACA/PTC
contract.

Seven rates: 10/12/22/24/32/35/37%. 2026 thresholds (taxable income):

| Rate | Single | Married filing jointly |
|------|--------|------------------------|
| 10% | $0 | $0 |
| 12% | $12,400 | $24,800 |
| 22% | $50,400 | $100,800 |
| 24% | $105,700 | $211,400 |
| 32% | $201,775 | $403,550 |
| 35% | $256,225 | $512,450 |
| 37% | $640,600 | $768,700 |

- **Standard deduction 2026:** $16,100 single / $32,200 MFJ; additional age-65+ amounts $2,050 (single) / $1,650 (each spouse, MFJ). Itemized deductions are a user-entered SALT / mortgage-interest / charitable total where that beats the standard; qualified mortgage-insurance premiums are omitted from that total even though the statute treats them as qualified residence interest (`irc-163-h-3-E-i-pmi-qualified-residence-interest-restart`, approximated / `overstatesTax`).
- **Charitable deductions (itemizers):** Statutory ordering — percentage ceiling first, then the OBBBA 0.5% floor (`irc-170-b-1-I-floor-ordering`, `irc-170-b-1-I-half-percent-floor`) — is enforced in the staged section 170 ledger. Live projection applies the floor but omits the 60% combined cash ceiling and carryforward (`irc-170-b-1-G-projection-cash-ceiling-not-applied`).
- **Senior deduction (OBBBA, tax years 2025–2028):** $6,000 per person 65+, available whether itemizing or not. IRC §151(d)(5)(C)(iii)(I) reduces the **per-person** $6,000 by 6% of MAGI above $75,000 single / $150,000 MFJ, so each qualifying person's share phases out separately: a couple with two people 65+ reaches zero at $250,000 of MAGI, the same point one person does, not $350,000. MAGI here is AGI plus amounts excluded under §§911/931/933. Because the deduction is allowed under §151, §56(b)(1)(D) disallows it for AMT whether or not the return itemizes (`irc-151-d-5-C-iii-I-senior-deduction-per-individual-phase-out`, `irc-56-b-1-D-section-151-deduction-disallowed-for-amt`). A major Roth-conversion interaction for 65+ planners.
- **Filing status after a spouse dies:** married couples can use MFJ treatment for the year of death when the survivor does not remarry. Qualifying-surviving-spouse treatment can preserve MFJ brackets/deduction for the next two years when a dependent qualifies; RetireGolden models this as an opt-in dependent flag because dependents are otherwise out of scope.
- **Alternative minimum tax (AMT) 2026:** exemption $90,100 single / $140,200 MFJ; exemption phase-out starts at $500,000 single / $1,000,000 MFJ and phases out at 50%; the 28% AMT ordinary-income rate begins above $244,500 of AMT taxable excess. RetireGolden uses these figures as a planning-grade AMT screen with modeled add-backs/preference items and preferential-rate-aware LTCG/QDI treatment, not a full Form 6251 worksheet.
- **Indexing in projected years:** the ledger is nominal, so for a year with no published parameter pack
  `indexFederalTaxPack` carries the annually-indexed figures forward at the plan's inflation rate before income
  meets them — rate-bracket bounds (`irc-1-j-3-B-rate-tables-adjusted-each-year`), the standard deduction and the
  age-65 addition, the 15%/20% capital-gain breakpoints, the AMT exemption and phase-out threshold (§55(d)(4)(A),
  indexed by §55(d)(4)(B)), and the 26/28-percent AMT breakpoint (§55(b)(1)(A), indexed by §55(d)(3)(A) and
  §55(d)(3)(B)(i)). The statutory rounding steps and the C-CPI-U basis are not reproduced. Figures with **no** indexing
  provision are deliberately left flat and creep by design: the §86 provisional-income tiers, the §1411 NIIT
  thresholds, the §121 exclusion, the §1211(b) $3,000 ordinary offset, and the senior deduction with its MAGI
  threshold (`irc-151-d-5-C-senior-deduction-not-indexed`). The SALT cap follows its own schedule instead
  (`irc-164-b-7-salt-cap-schedule`): $40,000 for 2025, the pack figure compounding at 1%/yr through 2029, then
  reverting to $10,000 from 2030. The high-MAGI SALT phasedown is not modeled
  (`irc-164-b-7-B-magi-phasedown`).
- Sources: [Tax Foundation 2026 brackets](https://taxfoundation.org/data/all/federal/2026-tax-brackets/), [IRS 2026 inflation adjustments](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill), [IRS Rev. Proc. 2025-32](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf), [IRS final return / qualifying surviving spouse](https://www.irs.gov/newsroom/filing-a-final-federal-tax-return-for-someone-who-has-died), [Bipartisan Policy Center 2026 explainer](https://bipartisanpolicy.org/explainer/2026-federal-income-tax-brackets-and-interactive-calculator/).

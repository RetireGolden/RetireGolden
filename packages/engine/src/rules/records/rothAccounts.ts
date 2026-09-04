/**
 * Roth account records: the section 408A contribution ceiling and phase-out, the
 * qualified-distribution and conversion-recapture tests, the distribution ordering
 * layers, and the designated Roth and PLESA subaccounts under section 402A.
 *
 * One slice of the tax rule registry. `../taxRuleRegistry.ts` composes every
 * slice into `TAX_RULE_REGISTRY`; read it for what a record must carry and why.
 * Records and the commentary attached to them were moved here verbatim, so a
 * block that says "above" or "below" may now point across a module boundary.
 */
import type { TaxRuleRecord } from '../taxRuleRegistry.js'

// `satisfies` without `as const`, matching the composed registry: keys and the
// union-typed fields (classification, kind, volatility) stay literal for
// describeRule's conditional typing, while the prose strings widen to `string`.
export const rothAccountRecords = {
  'irc-408A-c-2-roth-shares-the-section-219-ceiling': {
    title: 'Roth and traditional IRA contributions share one annual ceiling',
    statement:
      'Section 408A(c)(2) limits aggregate contributions to all Roth IRAs to the maximum amount allowable as a deduction under section 219 reduced by contributions made for the same year to all other individual retirement plans. Holding both a traditional and a Roth IRA does not create a second ceiling.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine expresses this by putting traditional and Roth IRAs owned by the same person into a single annual limit group rather than by ordering one before the other. Ordering would matter if the two ceilings differed, and under this section they do not.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(c)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'The aggregate amount of contributions for any taxable year to all Roth IRAs maintained for the benefit of an individual shall not exceed the excess (if any) of - (A) the maximum amount allowable as a deduction under section 219 with respect to such individual for such taxable year (computed without regard to subsection (g) of such section), over (B) the aggregate amount of contributions for such taxable year to all other individual retirement plans (other than Roth IRAs) maintained for the benefit of the individual.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch',
    ],
  },
  'irc-408A-c-3-roth-contribution-agi-phase-out': {
    title: 'The Roth contribution income phase-out is not modeled',
    statement:
      'Section 408A(c)(3) reduces the Roth contribution limit ratably once adjusted gross income, determined under 408A(c)(3)(B), exceeds an applicable dollar amount. The band is 15,000 dollars, but 10,000 dollars on a joint return or for a married individual filing separately, so a couple loses the contribution over a shorter run of income than a single filer does. The engine does not apply this reduction, so a projected Roth IRA contribution is allowed at any income level.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'Recorded as an explicit gap rather than left silent, because the direction of the error is knowable: a high income household will show Roth contributions it could not actually make, and the overstatement grows with income. It is out of scope rather than settled because the reduction runs off adjusted gross income, which the projection computes after the contribution loop has already run.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(c)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408A&num=0&edition=prelim',
      quotedText:
        'The amount determined under paragraph (2) for any taxable year shall not exceed an amount equal to the amount determined under paragraph (2)(A) for such taxable year, reduced (but not below zero) by the amount which bears the same ratio to such amount as- (i) the excess of- (I) the taxpayer\'s adjusted gross income for such taxable year, over (II) the applicable dollar amount, bears to (ii) $15,000 ($10,000 in the case of a joint return or a married individual filing a separate return).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#rothAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch',
    ],
  },

  'irc-408A-d-2-roth-qualified-distribution': {
    title: 'Roth qualified distribution and the five-taxable-year period',
    statement:
      'A Roth distribution escapes gross income only if it is qualified, and that takes two things at once: one of the events in 408A(d)(2)(A), which are attaining age 59.5, death, disability, and a qualified special purpose distribution, and a distribution made after the 5-taxable year period beginning with the first taxable year for which the individual made any Roth IRA contribution. The engine tests one thing, whether attained age has reached 60, so it models neither the event date nor the five-year period.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'Two independent errors sit under the single age test, and this record states both because neither covers the other. The five-taxable-year period is not modelled at all, and its absence under-taxes: a 62-year-old whose first Roth IRA was opened two years ago is shown tax-free earnings that the statute makes ordinary income and exposes to the 72(t) tax, which is exactly the case a conversion ladder started late in life produces. The attained-age-60 test is a second and separate error: it is the same annual proxy registered for the traditional path as irc-72-t-2-A-i-age-59-half-annual-proxy, appearing here as ROTH_QUALIFIED_AGE, and because attained age is the calendar-year age it runs both ways by up to about six months depending on the birth month rather than in a single direction. The five-year period cannot be recovered from account state the projection already holds, because 408A(d)(2)(B) runs it per individual from the first contribution to any Roth IRA rather than per account; closing this needs a household-level first-Roth-year fact, not a change to the withdrawal split. Until then nothing from this path is filing-grade on the taxability of Roth earnings.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(d)(2)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'The term “qualified distribution” means any payment or distribution- (i) made on or after the date on which the individual attains age 59½, (ii) made to a beneficiary (or to the estate of the individual) on or after the death of the individual, (iii) attributable to the individual’s being disabled (within the meaning of section 72(m)(7)), or (iv) which is a qualified special purpose distribution.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(2)(B)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'A payment or distribution from a Roth IRA shall not be treated as a qualified distribution under subparagraph (A) if such payment or distribution is made within the 5-taxable year period beginning with the first taxable year for which the individual made a contribution to a Roth IRA (or such individual’s spouse, or employer in the case of a simple retirement account (as defined in section 408(p)) or simplified employee pension (as defined in section 408(k)), made a contribution to a Roth IRA) established for such individual.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText: 'Any qualified distribution from a Roth IRA shall not be includible in gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/strategies/rothBasis.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/strategies/rothBasis.ts#ROTH_QUALIFIED_AGE',
      'packages/engine/src/strategies/rothBasis.ts#splitRothWithdrawal',
    ],
  },

  'irc-408A-d-3-F-roth-conversion-recapture': {
    title: 'Five-year recapture on a conversion layer tapped early',
    statement:
      'Where a portion of a Roth distribution is properly allocable to a conversion and the distribution falls within the 5-taxable year period beginning with the taxable year of that conversion, section 72(t) applies as if that portion were includible in gross income, even though the conversion itself was not a taxable distribution and the portion is not taxed again. The recapture reaches only so much of the conversion as was includible in income at the time, so converted nondeductible basis recaptures nothing.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Each conversion runs its own clock, because 408A(d)(3)(F)(i)(II) begins the period with the taxable year of that contribution and not with the year the Roth was opened. That is why the layers are held separately and drawn oldest first, and it is why this record is distinct from the account-level five-year period in irc-408A-d-2-roth-qualified-distribution: one decides whether earnings are taxable, this one decides whether already-taxed conversion principal carries the additional tax. Two things about the surrounding code so this is not read as broader than it is. The period is counted in calendar years, which is exact for the calendar-year taxpayers the engine models and would not be for a fiscal-year taxpayer it does not. And the recapture lifts through the 72(t) exceptions themselves, so the 59.5 boundary applies to it; the engine uses its attained-age-60 proxy for that boundary, recorded under irc-408A-d-2-roth-qualified-distribution.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(F)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'If- (I) any portion of a distribution from a Roth IRA is properly allocable to a qualified rollover contribution described in this paragraph; and (II) such distribution is made within the 5-taxable year period beginning with the taxable year in which such contribution was made, then section 72(t) shall be applied as if such portion were includible in gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(F)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'Clause (i) shall apply only to the extent of the amount of the qualified rollover contribution includible in gross income under subparagraph (A)(i).',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(C)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'The conversion of an individual retirement plan (other than a Roth IRA) to a Roth IRA shall be treated for purposes of this paragraph as a distribution to which this paragraph applies.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/strategies/rothBasis.ts',
      // A committed named conversion starts its own clock like any other. Its
      // layer carries the whole gross as the taxable portion, which is what
      // (F)(ii) requires of a conversion made at a zero basis numerator:
      // nothing was excluded from income, so nothing escapes the recapture.
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/rothBasis.ts#ROTH_SEASONING_YEARS',
      'packages/engine/src/strategies/rothBasis.ts#splitRothWithdrawal',
    ],
  },
  'irc-408A-d-3-A-i-zero-basis-conversion-includible': {
    title: 'A zero-basis traditional-IRA conversion is wholly includible',
    statement:
      'A Roth conversion includes in gross income what the distribution would have included absent the qualified rollover. With a proven zero annual traditional-IRA basis numerator, section 408(d)(2) returns no basis, so the conversion’s full gross is includible.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408A&num=0&edition=prelim',
      quotedText:
        'Notwithstanding sections 402(c), 403(b)(8), 408(d)(3), and 457(e)(16), in the case of any distribution to which this paragraph applies- (i) there shall be included in gross income any amount which would be includible were it not part of a qualified rollover contribution,',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408A-4, A-7(a)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408A-4',
      quotedText:
        'Any amount that is converted to a Roth IRA is includible in gross income as a distribution according to the rules of section 408(d)(1) and (2) for the taxable year in which the amount is distributed or transferred from the traditional IRA. Thus, any portion of the distribution or transfer that is treated as a return of basis under section 408(d)(1) and (2) is not includible in gross income as a result of the conversion.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/actions/rothConversionExecution.ts',
      'packages/engine/src/actions/ownedNonRothIraWithdrawalCharacter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraWithdrawalCharacter.ts#classifyOwnedNonRothIraAnnualWithdrawals',
      'packages/engine/src/actions/rothConversionExecution.ts#executeRothConversions',
    ],
  },

  'irc-408A-d-4-B-roth-distribution-ordering': {
    title: 'Roth withdrawals consume contributions, conversions, then earnings',
    statement:
      'For a nonqualified Roth distribution, regular contributions are consumed first, qualified rollover contributions are consumed next on a first-in, first-out basis, and earnings are reached last. The engine therefore spends direct contribution basis before conversion layers and conversion principal before earnings. The within-conversion allocation is registered separately because the engine currently does not consume its taxable portion first.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(d)(4)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408A&num=0&edition=prelim',
      quotedText:
        'For purposes of applying this section and section 72 to any distribution from a Roth IRA, such distribution shall be treated as made- (i) from contributions to the extent that the amount of such distribution, when added to all previous distributions from the Roth IRA, does not exceed the aggregate contributions to the Roth IRA; and (ii) from such contributions in the following order: (I) Contributions other than qualified rollover contributions to which paragraph (3) applies. (II) Qualified rollover contributions to which paragraph (3) applies on a first-in, first-out basis.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B (2025), Ordering Rules for Distributions',
      url: 'https://www.irs.gov/publications/p590b',
      quotedText:
        'Order the distributions as follows. Regular contributions. Conversion and rollover contributions, on a first-in, first-out basis (generally, total conversions and rollovers from the earliest year first). … Earnings on contributions.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: ['packages/engine/src/strategies/rothBasis.ts'],
    implementedByFunctions: [
      'packages/engine/src/strategies/rothBasis.ts#splitRothWithdrawal',
    ],
  },

  'irc-408A-d-4-B-converted-layer-taxable-portion-first': {
    title: 'A converted Roth layer must consume its taxable portion first',
    statement:
      'Within a qualified rollover contribution, a Roth distribution must be allocated first to the portion included in gross income at conversion. For an unseasoned conversion, that portion is subject to section 72(t) as if currently includible, and section 72(t) imposes its additional tax on the includible portion. The engine instead prorates taxable principal across each partial withdrawal. Thus, from a 10,000 conversion with 4,000 taxable principal, a 4,000 early withdrawal produces 160 of additional tax rather than the statutory 400, understating tax.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. `splitRothWithdrawal` computes each partial taxable take as take × taxableAmount / layer.amount, so it leaves 2,400 taxable principal after a 4,000 withdrawal from the 10,000/4,000 layer. Section 408A(d)(4)(B) instead allocates that withdrawal entirely to the taxable portion first. The 240 of additional tax that reading would have imposed is deferred only if the remaining taxable principal is tapped while still unseasoned and pre-59½; otherwise it is permanently omitted. The same pro-rata take lives in `applyConversionPrincipalDebt` and `assumedSeedConsequentialSpill` in this file — a fix must change those copies together. The fixture pins the current 160 produced value until a separately authorized implementation fix changes it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(d)(4)(B)(ii)(II), final sentence',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408A&num=0&edition=prelim',
      quotedText:
        'Any distribution allocated to a qualified rollover contribution under clause (ii)(II) shall be allocated first to the portion of such contribution required to be included in gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(F)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408A&num=0&edition=prelim',
      quotedText:
        'If- (I) any portion of a distribution from a Roth IRA is properly allocable to a qualified rollover contribution described in this paragraph; and (II) such distribution is made within the 5-taxable year period beginning with the taxable year in which such contribution was made, then section 72(t) shall be applied as if such portion were includible in gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'If any taxpayer receives any amount from a qualified retirement plan (as defined in section 4974(c)), the taxpayer\'s tax under this chapter for the taxable year in which such amount is received shall be increased by an amount equal to 10 percent of the portion of such amount which is includible in gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: ['packages/engine/src/strategies/rothBasis.ts'],
    implementedByFunctions: [
      'packages/engine/src/strategies/rothBasis.ts#applyConversionPrincipalDebt',
      'packages/engine/src/strategies/rothBasis.ts#assumedSeedConsequentialSpill',
      'packages/engine/src/strategies/rothBasis.ts#splitRothWithdrawal',
    ],
  },

  'irc-408A-d-4-B-same-year-conversion-aggregation': {
    title: 'Same-year Roth conversions are ordered in aggregate, taxable portion first',
    statement:
      'Within a single conversion year, Publication 590-B orders that year’s conversions and rollovers in aggregate and allocates the year’s taxable portion before its nontaxable portion. The engine instead pushes one conversion layer per named action and consumes layers in array order, so a same-year nontaxable layer can be consumed before a same-year taxable layer and understate section 72(t) on an early withdrawal.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. Pub 590-B’s year-aggregate reading takes the year’s taxable conversion principal before any nontaxable principal from that year. The engine records one layer per named conversion action (projection/internal/annualForcedDistributionQcdAndRetirementActionsPhase.ts) and `splitRothWithdrawal` walks those layers in array order, so a nontaxable 2024 layer ahead of a taxable 2024 layer can be fully consumed first. On the fixture — two same-year $5,000 layers with the nontaxable one first, then a $5,000 draw at age 50 — year-aggregate taxable-first yields $500 of additional tax; array order yields $0. The per-contribution FIFO record cannot carry this gap because both layers share a year.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(d)(4)(B)(ii)(II)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408A&num=0&edition=prelim',
      quotedText:
        '(II) Qualified rollover contributions to which paragraph (3) applies on a first-in, first-out basis. Any distribution allocated to a qualified rollover contribution under clause (ii)(II) shall be allocated first to the portion of such contribution required to be included in gross income.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B (2025), Ordering Rules for Distributions',
      url: 'https://www.irs.gov/publications/p590b',
      quotedText:
        'Order the distributions as follows. Regular contributions. Conversion and rollover contributions, on a first-in, first-out basis (generally, total conversions and rollovers from the earliest year first). … Taxable portion (the amount required to be included in gross income because of the conversion or rollover) first. Nontaxable portion. Earnings on contributions.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/strategies/rothBasis.ts',
      'packages/engine/src/projection/internal/annualForcedDistributionQcdAndRetirementActionsPhase.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualForcedDistributionQcdAndRetirementActionsPhase.ts#annualForcedDistributionQcdAndRetirementActionsPhase',
      'packages/engine/src/strategies/rothBasis.ts#splitRothWithdrawal',
    ],
  },
  'irc-408A-d-3-B-conversion-destination-must-be-a-roth-ira': {
    title: 'A conversion must land in a Roth IRA, never a designated Roth account',
    statement:
      'The paragraph that makes a conversion taxable is 408A(d)(3), and (B) applies it only to a distribution which is contributed to a Roth IRA maintained for the benefit of such individual; (C) then treats the conversion of an individual retirement plan other than a Roth IRA to a Roth IRA as a distribution to which the paragraph applies, and (A)(i) is what includes the amount in gross income. A Roth IRA is an individual retirement plan designated as a Roth IRA at the time the plan is established. A designated Roth account is a different thing: it is a separate account the employer’s applicable retirement plan establishes for that employee’s designated Roth contributions and the earnings on them. Treas. Reg. 1.408A-4 A-1(b) names the three methods by which an amount can be converted, and each of the three ends in a Roth IRA. The only route by which a designated Roth account takes a taxable rollover is 402A(c)(4), and (B) confines that route to a distribution from the same plan which maintains the account, so a distribution out of an IRA cannot reach one; 408A(c)(5)(A) closes the same question from the receiving side, admitting nothing into a Roth IRA that is not a qualified rollover contribution. The aggregate drain also takes employer traditional balances, for which the 402A(c)(4) in-plan route does exist in law -- but only into the designated Roth account maintained under the same plan, an identity the Plan schema cannot establish, so the destination policy is one rule for every source. The projection reads the vehicle and not only the type: the aggregate destination search keeps each owner’s first account of kind ira in Plan order, so an employer designated Roth account is never credited, and an owner who holds no Roth IRA -- including one whose only Roth is a designated Roth account -- has their slice trimmed and is named in a warning saying the conversion can land only in that person’s own Roth IRA and that opening one would let the share convert. The caller-supplied destination on the named-action path is refused separately, by the conversion-employer-destination-unsupported eligibility reason.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Two choices sit under this record and only one of them is the engine’s. WHICH of an owner’s several Roth IRAs receives the dollars remains a convention -- the first in Plan order, arbitrary between two accounts of the same kind, exactly as the sibling record irc-408-d-3-A-i-conversion-benefits-the-distributee already states. WHETHER an employer designated Roth account may receive them is not a convention at all, because 402A(c)(4)(B) settles it. Where the engine did have to choose is what to do for an owner who holds both kinds with the designated Roth account earlier in Plan order, and it passes over that account rather than refusing the slice. Plan order is insertion order and nothing else in this codebase reads it as a preference, so refusing would let array position decide a five-figure answer: a household holding a Roth 401(k) at index 1 and a Roth IRA at index 3 would convert nothing, while the same household with the two swapped converted in full. Trimming is kept for the owner who genuinely has no lawful destination, and that owner is named. A second reason keeps designated Roth accounts out of the candidate set entirely: a pre-tax employer balance CAN reach a designated Roth account under 402A(c)(4), but only the one maintained under the same plan, and the Plan schema carries no plan-identity link between an employer traditional account and an employer Roth account -- kind ira against kind employer is the whole discriminant -- so the engine cannot establish "such plan" from its data even where the route exists. A Roth IRA is the only destination whose lawfulness this engine can verify. Reading the vehicle also files the conversion layer in the right basis pool: rothPoolKey aggregates an owner’s Roth IRAs under one key and gives each employer Roth account its own, so a layer credited to the wrong account would carry its 408A(d)(3)(F) five-year clock into a pool that later Roth withdrawals never read. What this record does NOT reach is whether the source balance was distributable in the first place; that is registered separately as irc-401-k-2-B-i-employer-plan-conversion-source-not-gated-by-distributability.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(A), complete',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408A.htm',
      quotedText:
        'Notwithstanding sections 402(c), 403(b)(8), 408(d)(3), and 457(e)(16), in the case of any distribution to which this paragraph applies— (i) there shall be included in gross income any amount which would be includible were it not part of a qualified rollover contribution, (ii) section 72(t) shall not apply, and (iii) unless the taxpayer elects not to have this clause apply, any amount required to be included in gross income for any taxable year beginning in 2010 by reason of this paragraph shall be so included ratably over the 2-taxable-year period beginning with the first taxable year beginning in 2011. Any election under clause (iii) for any distributions during a taxable year may not be changed after the due date for such taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(B), complete',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408A.htm',
      quotedText:
        'This paragraph shall apply to a distribution from an eligible retirement plan (as defined by section 402(c)(8)(B)) maintained for the benefit of an individual which is contributed to a Roth IRA maintained for the benefit of such individual in a qualified rollover contribution. This paragraph shall not apply to a distribution which is a qualified rollover contribution from a Roth IRA or a qualified rollover contribution from a designated Roth account which is a rollover contribution described in section 402A(c)(3)(A).',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(C)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408A.htm',
      quotedText:
        'The conversion of an individual retirement plan (other than a Roth IRA) to a Roth IRA shall be treated for purposes of this paragraph as a distribution to which this paragraph applies.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(b)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408A.htm',
      quotedText:
        'For purposes of this title, the term "Roth IRA" means an individual retirement plan (as defined in section 7701(a)(37)) which is designated (in such manner as the Secretary may prescribe) at the time of establishment of the plan as a Roth IRA. Such designation shall be made in such manner as the Secretary may prescribe.',
    }, {
      kind: 'statute',
      citation: 'IRC 402A(b)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'A program shall not be treated as a qualified Roth contribution program unless the applicable retirement plan- (A) establishes separate accounts ("designated Roth accounts") for the designated Roth contributions of each employee and any earnings properly allocable to the contributions, and (B) maintains separate recordkeeping with respect to each account.',
    }, {
      kind: 'statute',
      citation: 'IRC 402A(c)(4)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'In the case of an applicable retirement plan which includes a qualified Roth contribution program, this paragraph shall apply to a distribution from such plan other than from a designated Roth account which is contributed in a qualified rollover contribution (within the meaning of section 408A(e)) to the designated Roth account maintained under such plan for the benefit of the individual to whom the distribution is made.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408A-4, A-1(b), complete',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408A-4',
      quotedText:
        'An amount can be converted by any of three methods— (1) An amount distributed from a traditional IRA is contributed (rolled over) to a Roth IRA within the 60-day period described in section 408(d)(3)(A)(i); (2) An amount in a traditional IRA is transferred in a trustee-to-trustee transfer from the trustee of the traditional IRA to the trustee of the Roth IRA; or (3) An amount in a traditional IRA is transferred to a Roth IRA maintained by the same trustee. For purposes of sections 408 and 408A, redesignating a traditional IRA as a Roth IRA is treated as a transfer of the entire account balance from a traditional IRA to a Roth IRA.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(c)(5)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408A&num=0&edition=prelim',
      quotedText:
        'No rollover contribution may be made to a Roth IRA unless it is a qualified rollover contribution.',
    }, {
      kind: 'statute',
      citation: 'IRC 402A(c)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'A rollover contribution of any payment or distribution from a designated Roth account which is otherwise allowable under this chapter may be made only if the contribution is to- (i) another designated Roth account of the individual from whose account the payment or distribution was made, or (ii) a Roth IRA of such individual.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2010-84, A-1',
      url: 'https://www.irs.gov/irb/2010-51_IRB',
      quotedText:
        'An “in-plan Roth rollover” is a distribution from an individual’s plan account, other than a designated Roth account, that is rolled over to the individual’s designated Roth account in the same plan, pursuant to new § 402A(c)(4) of the Code.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/actions/aggregateRothConversionOwnerAllocation.ts',
      'packages/engine/src/projection/internal/annualAggregateRothConversionPlan.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/retirementActionCandidateIdentityAllocator.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualPhysicalTransaction.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/aggregateRothConversionOwnerAllocation.ts#allocateAggregateRothConversionByOwner',
      'packages/engine/src/projection/internal/annualAggregateRothConversionPlan.ts#annualAggregateRothConversionPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateRetirementActionEligibility',
      'packages/engine/src/actions/retirementActionCandidateIdentityAllocator.ts#conversionDestinationIssue',
      'packages/engine/src/actions/ownedNonRothIraAnnualPhysicalTransaction.ts#preparePlanOwnedNonRothIraAnnualPhysicalTransaction',
    ],
  },

  'irc-402A-c-4-E-in-plan-roth-transfer-not-modeled': {
    title: 'Optional in-plan transfer of otherwise nondistributable amounts is not modeled',
    statement:
      'Section 402A(c)(4)(E) permits, but does not require, an applicable retirement plan with a qualified Roth contribution program to let an individual elect a transfer of an amount not otherwise distributable under the plan to that individual\'s designated Roth account. The transfer is treated as a distribution to which section 402A(c)(4) applies and as contributed in a qualified rollover contribution. Notice 2013-74 confirms that the transferred amount and its applicable earnings retain the distribution restrictions that applied before the in-plan Roth rollover. The Plan cannot express the plan\'s optional feature, the source amount\'s pre-transfer distribution restriction, or an identity linking the employer traditional and designated Roth accounts to one plan, and the retirement-action contract has no in-plan-Roth-transfer vocabulary. No accepted engine input therefore reaches this rule.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is a schema boundary, not a conversion result. traditionalAccountSchema and rothAccountSchema record only an employer account kind and an optional plan class; neither records a particular employer-plan identity, an in-plan-Roth feature election, or the restriction carried by a transferred amount. retirementActionRequestSchema and the separately persisted request union have no in-plan transfer arm. The vocabulary gates are asserted in model/plan.test.ts and actions/contract.test.ts; named Roth conversions separately refuse an employer designated Roth destination in actions/rothConversionExecution.test.ts.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402A(c)(4)(E)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'the plan may allow an individual to elect to have the plan transfer any amount not otherwise distributable under the plan to a designated Roth account maintained for the benefit of the individual,',
    }, {
      kind: 'statute',
      citation: 'IRC 402A(c)(4)(E)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'such transfer shall be treated as a distribution to which this paragraph applies which was contributed in a qualified rollover contribution (within the meaning of section 408A(e)) to such account, and',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2013-74, Q&A-3',
      url: 'https://www.irs.gov/pub/irs-drop/n-13-74.pdf',
      quotedText:
        'Yes. If an amount is rolled over to a designated Roth account pursuant to § 402A(c)(4)(E), then, notwithstanding Revenue Ruling 2004-12, the amount rolled over and applicable earnings remain subject to the distribution restrictions that were applicable to the amount before the in-plan Roth rollover.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/actions/contract.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRetirementActionRequestSchema',
      'packages/engine/src/model/plan.ts#rothAccountSchema',
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateConversion',
    ],
  },

  'irc-402A-e-1-A-plesa-optional-designated-roth-subaccount': {
    title: 'A PLESA is an optional designated-Roth subaccount of an employer plan',
    statement:
      'An applicable retirement plan may include a pension-linked emergency savings account (PLESA), which section 402A(e) generally treats as a designated Roth account. RetireGolden does not model a PLESA subaccount, its separate contribution and earnings records, or a plan feature election, so no accepted plan input reaches this rule.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is a schema refusal, not a zero-dollar result: traditionalAccountSchema and rothAccountSchema have no PLESA subaccount, separate earnings, or plan-feature fields, and the retirement-action unions have no PLESA arm. The absent account vocabulary is pinned in model/plan.test.ts and the absent action vocabulary in actions/contract.test.ts. The enacting provision is SECURE 2.0 section 127(e)(1), not section 115.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402A(e)(1)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'An applicable retirement plan- (A) may- (i) include a pension-linked emergency savings account established pursuant to section 801 of the Employee Retirement Income Security Act of 1974, which, except as otherwise provided in this subsection, shall be treated for purposes of this title as a designated Roth account, and',
    }, {
      kind: 'legislativeHistory',
      citation: 'P.L. 117-328, division T, title I, section 127(e)(1)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-117publ328/pdf/PLAW-117publ328.pdf',
      quotedText:
        'Section 402A is amended by redesignating subsection (e) as subsection (f) and by inserting after subsection (d) the following new subsection: "(e) PENSION-LINKED EMERGENCY SAVINGS ACCOUNTS.--"',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/actions/contract.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRetirementActionRequestSchema',
      'packages/engine/src/model/plan.ts#rothAccountSchema',
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
    ],
  },

  'irc-402A-e-3-A-plesa-participant-contribution-cap': {
    title: 'PLESA participant contributions stop at the indexed or sponsor-set lower cap',
    statement:
      'No contribution may be accepted to a PLESA if participant contributions would exceed the lesser of the indexed 2,500-dollar amount or the lower amount selected by the plan sponsor. RetireGolden cannot accept a PLESA contribution, balance, or sponsor cap, so it produces no cap result.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The cap turns on a PLESA-only participant-contribution balance and a sponsor-selected lower cap. Neither field exists on traditionalAccountSchema or rothAccountSchema, and there is no PLESA contribution action; model/plan.test.ts and actions/contract.test.ts explicitly gate those vocabulary surfaces. Notice 2024-22 confirms that the lower sponsor amount is an independent statutory limb, not an inferred account limit.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402A(e)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'Subject to subparagraph (B), no contribution shall be accepted to a pension-linked emergency savings account to the extent such contribution would cause the portion of the account balance attributable to participant contributions to exceed the lesser of- (i) $2,500; or (ii) an amount determined by the plan sponsor of the pension-linked emergency savings account. In the case of contributions made in taxable years beginning after December 31, 2024, the Secretary shall adjust the amount under clause (i) at the same time and in the same manner as the adjustment made under section 415(d), except that the base period shall be the calendar quarter beginning July 1, 2023. Any increase under the preceding sentence which is not a multiple of $100 shall be rounded to the next lowest multiple of $100.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2024-22, section II.B',
      url: 'https://www.irs.gov/pub/irs-drop/n-24-22.pdf',
      quotedText:
        'Subject to certain excess contribution rules, section 402A(e)(3)(A) provides that no contribution shall be accepted to a PLESA to the extent such contribution would cause the portion of the account balance attributable to participant contributions to exceed the lesser of (i) $2,500 or (ii) an amount determined by the plan sponsor of the PLESA.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/actions/contract.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRetirementActionRequestSchema',
      'packages/engine/src/model/plan.ts#rothAccountSchema',
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
    ],
  },

  'irc-402A-e-7-B-i-plesa-distribution-qualified-roth-treatment': {
    title: 'A PLESA distribution receives designated-Roth qualified-distribution treatment',
    statement:
      'A PLESA distribution made under section 402A(e)(7)(A) is treated as a qualified distribution for section 402A(d), whose qualified designated-Roth distributions are not includible in gross income. RetireGolden has no PLESA earnings ledger or distribution path, so it cannot apply that treatment.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This rule requires the PLESA source, separately allocated earnings, and a PLESA withdrawal. The plan schema has none of those fields, and the action contract has no PLESA distribution kind; their absences are the schema and vocabulary gates in model/plan.test.ts and actions/contract.test.ts.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402A(e)(7)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'Any distribution from a pension-linked emergency savings account in accordance with subparagraph (A)- (i) shall be treated as a qualified distribution for purposes of subsection (d), and',
    }, {
      kind: 'statute',
      citation: 'IRC 402A(d)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'Any qualified distribution from a designated Roth account shall not be includible in gross income.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/actions/contract.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRetirementActionRequestSchema',
      'packages/engine/src/model/plan.ts#rothAccountSchema',
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

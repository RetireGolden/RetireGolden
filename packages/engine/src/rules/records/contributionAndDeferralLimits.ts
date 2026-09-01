/**
 * Contribution and deferral limit records: the section 219 IRA ceilings, the section
 * 402(g) elective deferral aggregate, the section 414(v) catch-up regime, the section
 * 415 annual additions cap, and the excise taxes on excess contributions.
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
export const contributionAndDeferralLimitRecords = {
  'irc-402-e-4-B-lump-sum-employer-securities-nua-exclusion': {
    title: 'NUA in employer securities: distribution exclusion and sale treatment',
    statement:
      'For a lump sum distribution that includes employer-corporation securities, section 402(e)(4)(B) excludes the attributable net unrealized appreciation from gross income for purposes of section 72 unless the taxpayer elects otherwise. Because section 72(t)(1) reaches only the includible portion, excluded NUA is outside the additional-tax base. Current sale treatment of that excluded NUA is long-term capital gain without regard to the qualified plan’s holding period; post-distribution appreciation uses the distributee’s actual holding period. Notice 98-24 remains historical authority for that without-regard-to-plan-holding principle, but its “more than 18 months” language is the notice’s 1998-era long-term threshold under TRA 1997, not the 2026 more-than-one-year long-term rule. Not modelled: no plan input or retirement-action type can express employer securities, NUA, the qualified-lump-sum fact, an NUA elect-out, the distribution date, or a later securities sale, so employer-plan withdrawals still classify as basisReturn/ordinaryIncome and still run section 72(t) on the includible ordinary portion without any NUA adjustment.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The plan model carries an employer-plan balance only: traditionalAccountSchema\'s nondeductibleBasis is IRA-only, and the schema comment says employer-plan after-tax money is not modeled. After-tax employee basis exists only as runtime classifier evidence (afterTaxEmployeeBasisBeforeDistribution) on traditionalEmployerPlanWithdrawalCharacter, whose withdrawal character is basis return or ordinary income. The action contract rejects a NUA action kind. The action-kind refusal is covered in actions/contract.test.ts. Notice 98-24 now extends this record because its sale-side holding-period treatment is inseparable from the excluded NUA whose amount the Plan cannot state; it does not warrant a computed result or a separate record when the engine has neither the NUA/security facts nor the later sale facts.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402(e)(4)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'For purposes of subsection (a) and section 72, in the case of any lump sum distribution which includes securities of the employer corporation, there shall be excluded from gross income the net unrealized appreciation attributable to that part of the distribution which consists of securities of the employer corporation. In accordance with rules prescribed by the Secretary, a taxpayer may elect, on the return of tax on which a lump sum distribution is required to be included, not to have this subparagraph apply to such distribution.',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'If any taxpayer receives any amount from a qualified retirement plan (as defined in section 4974(c)), the taxpayer\'s tax under this chapter for the taxable year in which such amount is received shall be increased by an amount equal to 10 percent of the portion of such amount which is includible in gross income.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 98-24, 1998-17 I.R.B.',
      url: 'https://www.irs.gov/pub/irs-irbs/irb98-17.pdf',
      quotedText:
        'Under this notice, the amount of net unrealized appreciation which is not included in the basis of the securities in the hands of the distributee at the time of distribution is considered a gain from the sale or exchange of a capital asset held for more than 18 months to the extent that such appreciation is realized in a subsequent taxable transaction. Accordingly, for a sale or other disposition of employer securities that occurs after May 6, 1997, the actual period that an employer security was held by a qualified plan need not be calculated in order to determine whether, with respect to the net unrealized appreciation, the disposition qualifies for the rate for capital assets held for more than 18 months. However, with respect to any further appreciation in the employer securities after distribution from the plan, the actual holding period in the hands of the distributee determines the capital gains rate that applies.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/actions/contract.ts',
      'packages/engine/src/actions/traditionalEmployerPlanWithdrawalCharacter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRetirementActionRequestSchema',
      'packages/engine/src/actions/traditionalEmployerPlanWithdrawalCharacter.ts#classifyTraditionalEmployerPlanWithdrawal',
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
    ],
  },

  'irc-402-a-employer-plan-distribution-receipt-year-taxability': {
    title: 'Employer-plan distributions are taxable in the year received',
    statement:
      'An amount actually distributed from an exempt section 401(a) employees\' trust is taxable under section 72 in the distributee\'s taxable year in which distributed. An elected first distribution-calendar-year RMD held until April 1 enters the engine\'s ordinary-income recognition in the following receipt year, alongside that year\'s separately required RMD, rather than in the earlier distribution calendar year.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'Except as otherwise provided in this section, any amount actually distributed to any distributee by any employees\' trust described in section 401(a) which is exempt from tax under section 501(a) shall be taxable to the distributee, in the taxable year of the distributee in which distributed, under section 72 (relating to annuities).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-404-a-3-a-employer-deduction-limit': {
    title: 'Employer plan-contribution deduction is a sponsor-side limit',
    statement:
      'Section 404(a) supplies the employer\'s deduction gate for contributions to or under a retirement plan. For a stock-bonus or profit-sharing trust, the amount deductible in the payment year is no more than the greater of 25 percent of compensation paid or accrued to plan beneficiaries or the required section 401(k)(11) contribution. Not modelled: the Plan is a participant/household projection, not the sponsor\'s return; it has no sponsor taxpayer, employer deduction or carryover ledger, employer taxable-income surface, trust-exemption fact, or contribution-payment facts. An employer match is therefore only a participant account in-flow, not a conclusion about what the sponsor may deduct.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'IRC 404(a)\'s general deduction gate and 404(a)(3)(A)(i)\'s amount limit both address the same absent employer-return surface, so they are deliberately one record rather than two non-dispositive fragments. Household wages and a configured employer match are participant-side facts the Plan does carry; they neither identify the sponsor nor make a sponsor deduction calculation reachable.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 404(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section404&num=0&edition=prelim',
      quotedText:
        'If contributions are paid by an employer to or under a stock bonus, pension, profit-sharing, or annuity plan, or if compensation is paid or accrued on account of any employee under a plan deferring the receipt of such compensation, such contributions or compensation shall not be deductible under this chapter; but, if they would otherwise be deductible, they shall be deductible under this section, subject, however, to the following limitations as to the amounts deductible in any year:',
    }, {
      kind: 'statute',
      citation: 'IRC 404(a)(3)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section404&num=0&edition=prelim',
      quotedText:
        'In the taxable year when paid, if the contributions are paid into a stock bonus or profit-sharing trust, and if such taxable year ends within or with a taxable year of the trust with respect to which the trust is exempt under section 501(a), in an amount not in excess of the greater of- (I) 25 percent of the compensation otherwise paid or accrued during the taxable year to the beneficiaries under the stock bonus or profit-sharing plan, or (II) the amount such employer is required to contribute to such trust under section 401(k)(11) for such year.',
    }, {
      kind: 'statute',
      citation: 'IRC 404(a)(3)(A)(i)(I)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section404&num=0&edition=prelim',
      quotedText:
        '(I) 25 percent of the compensation otherwise paid or accrued during the taxable year to the beneficiaries under the stock bonus or profit-sharing plan, or',
    }, {
      kind: 'statute',
      citation: 'IRC 404(a)(3)(A)(i)(II)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section404&num=0&edition=prelim',
      quotedText:
        '(II) the amount such employer is required to contribute to such trust under section 401(k)(11) for such year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
    ],
  },

  'irc-414-v-2-E-super-catch-up-window': {
    title: 'The higher catch-up covers ages 60 to 63 and stops at 64',
    statement:
      'A participant who would attain age 60 but would not attain age 64 before the close of the taxable year takes the adjusted dollar amount in place of the ordinary catch-up. The window closes at 64: a participant that age reverts to the ordinary age-50 catch-up rather than keeping the higher one. The adjusted dollar amount is the greater of 10,000 dollars and 150 percent of the catch-up in effect for 2024 — not 150 percent of the current year figure.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The two legs of 414(v)(2)(E)(i) are a 10,000 dollar amount and 150 percent of the 2024 amount, and the greater of them governs. That is why the 2026 figure is 11,250 rather than 150 percent of the current 8,000 catch-up, as IRS Notice 2025-67 confirms. Only the first leg moves: 414(v)(2)(C)(i) adjusts the (E) amounts for years after 2025 off a July 1 2024 base quarter, while the second leg is computed off a 2024 figure that will never change, so it is 11,250 forever. The engine therefore projects the indexed leg and takes the greater of it and the pack-year amount, rather than carrying the inflation factor onto the operative figure — Notice 2025-67 is the discriminating evidence, since it held the ages 60-63 amount flat for 2026 in the same year the ordinary catch-up rose from 7,500 to 8,000. Two simplifications remain. The engine projects the indexed leg on the smooth plan inflation path and does not apply the statutory rounding down to a multiple of 500, so the year the leg overtakes 11,250 can land early by up to a step. And the pack carries that leg at 10,000 for 2026, which is a derivation rather than a published figure: the IRS notices state only the operative amount, and one year of cost-of-living from the July 2024 base quarter falls well short of the 10,500 step. The age-55 HSA addition is registered separately because section 223(g) omits it from indexing entirely — the same shape of rule with a third answer again.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 414(v)(2)(B)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/414',
      quotedText:
        'In the case of an applicable employer plan other than a plan described in section 401(k)(11) or 408(p), the applicable dollar amount is $5,000 (the adjusted dollar amount, in the case of an eligible participant who would attain age 60 but would not attain age 64 before the close of the taxable year).',
    }, {
      kind: 'statute',
      citation: 'IRC 414(v)(2)(E)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/414',
      quotedText:
        'For purposes of subparagraph (B), the adjusted dollar amount is\u2014 (i) in the case of clause (i) of subparagraph (B), the greater of\u2014 (I) $10,000, or (II) an amount equal to 150 percent of the dollar amount which would be in effect under such clause for 2024 for eligible participants not described in the parenthetical in such clause ...',
    }, {
      kind: 'statute',
      citation: 'IRC 414(v)(2)(C)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/414',
      quotedText:
        'In the case of a year beginning after December 31, 2025, the Secretary shall adjust annually the adjusted dollar amounts applicable under clauses (i) and (ii) of subparagraph (E) for increases in the cost-of-living at the same time and in the same manner as adjustments under the preceding sentence; except that the base period taken into account shall be the calendar quarter beginning July 1, 2024.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-415-c-1-annual-additions-lesser-of': {
    title: 'Annual additions are capped by pay as well as by the dollar limit',
    statement:
      'Contributions and other additions to a participant account may not exceed the lesser of the indexed dollar amount or 100 percent of the participant compensation. A participant paid less than the dollar limit is bound by their pay, so a generous match cannot push total additions above what they earned.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Section 415(c)(3) compensation is broader than wages, and the engine uses wages as the stand-in, so the pay prong binds slightly earlier here than under the statute. Annual additions under 415(c)(2) are employer contributions, employee contributions and forfeitures; the engine models the first two and has no concept of forfeitures.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 415(c)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/415',
      quotedText:
        'Contributions and other additions with respect to a participant exceed the limitation of this subsection if, when expressed as an annual addition (within the meaning of paragraph (2)) to the participant\u2019s account, such annual addition is greater than the lesser of\u2014 (A) $40,000, or (B) 100 percent of the participant\u2019s compensation.',
    }, {
      kind: 'statute',
      citation: 'IRC 415(c)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/415',
      quotedText:
        'For purposes of paragraph (1), the term \u201cannual addition\u201d means the sum of any year of\u2014 (A) employer contributions, (B) the employee contributions, and (C) forfeitures.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-402-g-1-elective-deferral-aggregate': {
    title: 'The elective deferral limit is per individual, not per plan',
    statement:
      'Elective deferrals of any individual for a taxable year are included in gross income to the extent they exceed the applicable dollar amount. The limit attaches to the individual and aggregates every arrangement they participate in, so holding two employer plans does not double the room.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Section 402(g)(3) counts 401(k), 403(b), SARSEP and SIMPLE deferrals in the same total. The engine groups by owner rather than by plan for exactly this reason, and does not model the separate 457(b) limit, which genuinely does sit alongside rather than inside this one.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402(g)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'Notwithstanding subsections (e)(3) and (h)(1)(B), the elective deferrals of any individual for any taxable year shall be included in such individual\'s gross income to the extent the amount of such deferrals for the taxable year exceeds the applicable dollar amount.',
    }, {
      kind: 'statute',
      citation: 'IRC 402(g)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "elective deferrals" means, with respect to any taxable year, the sum of- (A) any employer contribution under a qualified cash or deferred arrangement (as defined in section 401(k)) to the extent not includible in gross income for the taxable year under subsection (e)(3) (determined without regard to this subsection), (B) any employer contribution to the extent not includible in gross income for the taxable year under subsection (h)(1)(B) (determined without regard to this subsection), (C) any employer contribution to purchase an annuity contract under section 403(b) under a salary reduction agreement (within the meaning of section 3121(a)(5)(D)), and (D) any elective employer contribution under section 408(p)(2)(A)(i).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/projection/employerRothCatchUp.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/employerRothCatchUp.ts#allocateEmployerElectiveDeferrals',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irs-notice-2014-54-employer-plan-after-tax-rollover-allocation': {
    title: 'After-tax employer-plan rollover allocation to multiple destinations is not modeled',
    statement:
      'Notice 2014-54 treats same-time benefit disbursements from one employer plan to one recipient as a single distribution and assigns pretax dollars to direct rollovers before the recipient’s other destinations. The Plan cannot express one employer-plan disbursement split across multiple simultaneous destinations — its named conversion path is single-destination — so no engine input reaches this allocation and the engine produces no figure for it. Employer-plan after-tax basis elsewhere in the engine is governed by its own records, not this one.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2014-54, section III, first paragraph',
      url: 'https://www.irs.gov/pub/irs-drop/n-14-54.pdf',
      quotedText:
        'For purposes of determining the portion of a disbursement of benefits from a plan to a participant, beneficiary, or alternate payee that is not includible in gross income under the rules of § 72, all disbursements of benefits from the plan to the recipient that are scheduled to be made at the same time (disregarding differences due to reasonable delays to facilitate plan administration) are treated as a single distribution without regard to whether the recipient has directed that the disbursements be made to a single destination or multiple destinations.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2014-54, section III, second paragraph',
      url: 'https://www.irs.gov/pub/irs-drop/n-14-54.pdf',
      quotedText:
        'If the pretax amount with respect to the aggregated disbursements that are treated as a single distribution is less than the amount of the distribution that is directly rolled over to one or more eligible retirement plans, the entire pretax amount is assigned to the amount of the distribution that is directly rolled over.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/actions/contract.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRothConversionRequestSchema',
      'packages/engine/src/model/plan.ts#strategiesSchema',
    ],
  },
  'irc-219-b-1-ira-limit-lesser-of-compensation': {
    title: 'An IRA contribution is capped by compensation, not only by the dollar limit',
    statement:
      'Section 219(b)(1) caps the amount for a taxable year at the lesser of the deductible amount or the compensation includible in the individual gross income for that year. A participant whose compensation is below the dollar limit is held to compensation, so the dollar limit alone is not the ceiling.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is the same shape as the section 415(c) annual additions cap: a two prong lesser of where applying only the dollar prong silently overstates. The engine previously applied only the dollar prong here. Wages are the engine only compensation source, so the compensation prong reads from projected wages for the year.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(b)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/219',
      quotedText:
        'shall not exceed the lesser of - (A) the deductible amount, or (B) an amount equal to the compensation includible in the individual’s gross income for such taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-219-c-1-spousal-ira-combined-compensation': {
    title: 'A jointly filing couple funds both IRAs from combined compensation',
    statement:
      'Section 219(c) lets a married individual who files jointly, and whose own compensation is the lesser of the two, measure the limit against the combined compensation of both spouses, reduced by the contributions already made by the other spouse. The household ceiling is therefore combined compensation, while each spouse remains separately held to the dollar limit.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Two prongs pull in opposite directions and both must hold. Capping each spouse at their own wages alone would deny a non-earning spouse an IRA the statute plainly allows; pooling without a per-person dollar limit would let one spouse absorb the whole household ceiling. The engine models the pool only when the projected filing status is married filing jointly and both spouses are alive, since section 219(c)(2) conditions the rule on a joint return.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(c)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/219',
      quotedText:
        'shall be equal to the lesser of - (A) the dollar amount in effect under subsection (b)(1)(A) for the taxable year, or (B) the sum of - (i) the compensation includible in such individual’s gross income for the taxable year, plus (ii) the compensation includible in the gross income of such individual’s spouse for the taxable year reduced by ...',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-219-b-5-C-iii-ira-catch-up-indexed': {
    title: 'The age-50 IRA catch-up is indexed, unlike the HSA catch-up',
    statement:
      'Section 219(b)(5)(B) increases the deductible amount by 1,000 dollars for an individual who has attained age 50 before the close of the taxable year, and section 219(b)(5)(C)(iii) subjects that 1,000 dollars to a cost of living adjustment for taxable years beginning after 2023, with calendar year 2022 as the base.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Worth a record precisely because the neighbouring HSA catch-up under section 223(b)(3) is not indexed and must stay flat. The two look alike and behave differently, so the engine projects this one and holds the other. The indexing here was added by SECURE 2.0 section 108; before 2024 this amount was flat as well, which is why older secondary sources describe it that way.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(b)(5)(C)(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section219&num=0&edition=prelim',
      quotedText:
        'In the case of any taxable year beginning in a calendar year after 2023, the $1,000 amount under subparagraph (B)(ii) shall be increased by an amount equal to- (I) such dollar amount, multiplied by (II) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which the taxable year begins, determined by substituting "calendar year 2022" for "calendar year 2016" in subparagraph (A)(ii) thereof.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-219-f-1-compensation-excludes-deferred-income': {
    title: 'Pension, annuity and deferred income are not compensation for IRA purposes',
    statement:
      'Section 219(f)(1) defines compensation to include earned income and to exclude any amount received as a pension or annuity or as deferred compensation. Retirement income therefore does not create IRA contribution room, so a person whose only income is a pension or Social Security has a compensation ceiling of zero.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is what makes the compensation prong bite in a retirement projection. Most years in a plan have no wages at all, and a reading that counted any income as compensation would leave the section 219(b)(1) cap inert for exactly the span the projection is about.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(f)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section219&num=0&edition=prelim',
      quotedText:
        'For purposes of this section, the term "compensation" includes earned income (as defined in section 401(c)(2)). The term "compensation" does not include any amount received as a pension or annuity and does not include any amount received as deferred compensation.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-401-c-2-earned-income-not-modeled': {
    title: 'Self-employment earned income is not a modeled compensation source',
    statement:
      'Compensation under section 219(f)(1) includes earned income as defined in section 401(c)(2), which is net earnings from self-employment in a trade or business in which personal services are a material income producing factor. The engine models wages only, so a self-employed plan has no compensation and therefore no IRA contribution room.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'The direction of this gap is the opposite of the Roth phase-out gap: it understates rather than overstates, denying contribution room to a self-employed household that is entitled to it. It is recorded here so the section 219(b)(1) compensation prong is not read as complete. The engine income model has no self-employment stream to read from, so closing this needs a model change and not a calculation change.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(c)(2)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term \u201cearned income\u201d means the net earnings from self-employment (as defined in section 1402(a)), but such net earnings shall be determined\u2014 (i) only with respect to a trade or business in which personal services of the taxpayer are a material income-producing factor ...',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#wagesIncomeSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-414-v-3-A-catch-up-excluded-from-415c': {
    title: 'Section 414(v) catch-up is not an annual addition under 415(c)',
    statement:
      'A contribution to an applicable employer plan under 414(v)(1) — the additional elective deferral an eligible participant may make — is not subject to section 415(c) in the year it is made, and is not taken into account in applying 415(c) to other contributions or benefits. Designated Roth catch-up under 414(v)(7) is still a paragraph (1) contribution; paragraph (7) conditions whether paragraph (1) applies, it does not displace paragraph (3). The §402(g) base remains countable. Employer match therefore sees leftover 415(c) room after that base, not after the base plus catch-up. How much catch-up paragraph (1) permits in the first place is 414(v)(2)(A), registered separately.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine already split the §402(g) base from the 414(v) catch-up slice for the Roth-character mandate. That same slice is the paragraph (1) contribution paragraph (3)(A) names. IRA catch-up under 219(b)(5) is outside 414(v) and never enters this carve-out. Current-year wages stand in for 415(c)(3) compensation, as they already do for the 415(c) pay prong.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 414(v)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'In the case of any contribution to a plan under paragraph (1)- (A) such contribution shall not, with respect to the year in which the contribution is made- (i) be subject to any otherwise applicable limitation contained in sections 401(a)(30), 402(h), 403(b), 408, 415(c), and 457(b)(2) (determined without regard to section 457(b)(3)), or (ii) be taken into account in applying such limitations to other contributions or benefits under such plan or any other such plan',
    }, {
      kind: 'statute',
      citation: 'IRC 414(v)(7)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'paragraph (1) shall apply only if any additional elective deferrals are designated Roth contributions (as defined in section 402A(c)(1)) made pursuant to an employee election.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-19',
    implementedBy: [
      'packages/engine/src/projection/employerRothCatchUp.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/employerRothCatchUp.ts#allocateEmployerElectiveDeferrals',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-414-v-2-A-catch-up-limited-to-compensation-excess': {
    title: 'Catch-up cannot exceed compensation minus other elective deferrals',
    statement:
      'Additional elective deferrals under 414(v)(1) cannot exceed the lesser of the applicable dollar amount and the excess of the participant\'s section 415(c)(3) compensation for the year over other elective deferrals made without regard to subsection (v). The dollar amount is 414(v)(2)(A)(i); this record is the compensation excess in (A)(ii). A participant paid 30,000 who has already deferred the 24,500 section 402(g) base may catch up only 5,500, not the full 8,000 age-50 dollar amount. Designated Roth catch-up under 414(v)(7) is still that additional elective deferral and is subject to the same ceiling.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Wages are the engine\'s only 415(c)(3) compensation source, the same stand-in the 415(c) pay prong already uses. IRA catch-up under 219(b)(5) is outside 414(v).',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 414(v)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'A plan shall not permit additional elective deferrals under paragraph (1) for any year in an amount greater than the lesser of- (i) the applicable dollar amount, or (ii) the excess (if any) of- (I) the participant\'s compensation (as defined in section 415(c)(3)) for the year, over (II) any other elective deferrals of the participant for such year which are made without regard to this subsection.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-19',
    implementedBy: [
      'packages/engine/src/projection/employerRothCatchUp.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/employerRothCatchUp.ts#allocateEmployerElectiveDeferrals',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-414-v-7-E-roth-catch-up-wage-threshold': {
    title: 'The Roth catch-up wage threshold moves in five-thousand-dollar steps',
    statement:
      'A participant whose wages from the sponsoring employer for the preceding calendar year exceed the threshold in IRC 414(v)(7)(A) may make catch-up contributions only as designated Roth contributions. The base figure is 145,000, and 414(v)(7)(E) adjusts it annually in the same time and manner as the section 415(d) limits, from a base period of the calendar quarter beginning July 1, 2023, with any increase that is not a multiple of 5,000 rounded to the next lower multiple. Notice 2025-67 sets the threshold at 150,000 for 2026. The round-down is what makes the figure hard to guess: it stands still for a year or more at a time and then jumps a whole step, so it is never the base amount scaled by a year of inflation.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The pack carries the published 2026 step. The projection now reads that figure for the 414(v)(7)(A) wage test; the character mandate and the Box 3 input proxy are registered separately at irc-414-v-7-A-high-earner-roth-catch-up-mandate and irc-414-v-7-A-prior-year-fica-wage-proxy. What remains settled here is the FIGURE and the five-thousand-dollar rounding, not the character of the catch-up.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 414(v)(7)(A), (v)(7)(E)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'Except as provided in subparagraph (C), in the case of an eligible participant whose wages (as defined in section 3121(a)) for the preceding calendar year from the employer sponsoring the plan exceed $145,000, paragraph (1) shall apply only if any additional elective deferrals are designated Roth contributions (as defined in section 402A(c)(1)) made pursuant to an employee election. ... In the case of a year beginning after December 31, 2024, the Secretary shall adjust annually the $145,000 amount in subparagraph (A) for increases in the cost-of-living at the same time and in the same manner as adjustments under 415(d); except that the base period taken into account shall be the calendar quarter beginning July 1, 2023, and any increase under this subparagraph which is not a multiple of $5,000 shall be rounded to the next lower multiple of $5,000.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, section on the Roth catch-up wage threshold',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The Roth catch-up wage threshold for 2025, which under section 414(v)(7)(A) is used to determine whether an individual’s catch-up contributions to an applicable employer plan (other than a plan described in section 408(k) or (p)) for 2026 must be designated as Roth contributions, is increased from $145,000 to $150,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/params/types.ts',
      'packages/engine/src/projection/employerRothCatchUp.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/params/types.ts#rothCatchUpWageThreshold',
      'packages/engine/src/projection/employerRothCatchUp.ts#indexRothCatchUpWageThreshold',
    ],
  },
  'irc-414-v-7-A-high-earner-roth-catch-up-mandate': {
    title: 'High-earner employer-plan catch-up must be designated Roth in 2026 and later',
    statement:
      'For contribution years beginning after December 31, 2025, a participant in an applicable employer plan other than a SEP or SIMPLE IRA whose section 3121(a) wages from the employer sponsoring the plan for the preceding calendar year exceed the 414(v)(7)(A) threshold — 150,000 for 2026 per Notice 2025-67 — may make additional elective deferrals under 414(v)(1) only as designated Roth contributions. Exactly 150,000 does not exceed. A participant with no such FICA wages is not subject. If the plan has no qualified Roth contribution program, the high earner\'s catch-up maximum is 0 rather than a pre-tax catch-up. The ages 60-63 super catch-up is the same 414(v) additional elective deferral and is Roth-mandated when the wage test is met. IRA catch-up under 219(b)(5) is outside 414(v). T.D. 10033 generally applies to contributions in years beginning after December 31, 2026, but that regulatory applicability date does not postpone the statutory mandate; 2026 is statute plus reasonable good-faith after Notice 2023-62\'s administrative transition expired December 31, 2025.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The wage figure the engine compares to the threshold is a user-entered prior-calendar-year FICA amount on the employer account, not a Form W-2 Box 3 retrieved per sponsoring employer; that input gap is registered separately at irc-414-v-7-A-prior-year-fica-wage-proxy. Roth capability is inferred from the presence of a Roth employer account for the same owner, because the plan model has no employer identity and no qualified-Roth-contribution-program flag. Catch-up redirected onto that sibling remains elective deferral of the source plan for employer match. SEP and SIMPLE IRA are the IRA kind and never enter this allocator. Regular (non-catch-up) elective deferrals keep the account type the plan already states. Named-arm RMD coordination and the age-70½ proxy are outside this record.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 414(v)(7)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'Except as provided in subparagraph (C), in the case of an eligible participant whose wages (as defined in section 3121(a)) for the preceding calendar year from the employer sponsoring the plan exceed $145,000, paragraph (1) shall apply only if any additional elective deferrals are designated Roth contributions (as defined in section 402A(c)(1)) made pursuant to an employee election.',
    }, {
      kind: 'statute',
      citation: 'IRC 414(v)(7)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'Subparagraph (A) shall not apply in the case of an applicable employer plan described in paragraph (6)(A)(iv).',
    }, {
      kind: 'statute',
      citation: 'IRC 414(v)(6)(A)(iv)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'The term "applicable employer plan" means- (i) an employees\' trust described in section 401(a) which is exempt from tax under section 501(a), (ii) a plan under which amounts are contributed by an individual\'s employer for an annuity contract described in section 403(b), (iii) an eligible deferred compensation plan under section 457 of an eligible employer described in section 457(e)(1)(A), and (iv) an arrangement meeting the requirements of section 408(k) or (p).',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, section on the Roth catch-up wage threshold',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The Roth catch-up wage threshold for 2025, which under section 414(v)(7)(A) is used to determine whether an individual’s catch-up contributions to an applicable employer plan (other than a plan described in section 408(k) or (p)) for 2026 must be designated as Roth contributions, is increased from $145,000 to $150,000.',
    }, {
      kind: 'regulation',
      citation: 'T.D. 10033, 26 CFR 1.414(v)-2(b)(2)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-09-16/html/2025-17865.htm',
      quotedText:
        'if an applicable employer plan does not include a qualified Roth contribution program (within the meaning of section 402A(b)), then, for a catch-up eligible participant who is subject to the Roth catch-up requirement under paragraph (a)(2) of this section, the maximum amount of catch-up contributions permitted under section 414(v) is $0.',
    }, {
      kind: 'regulation',
      citation: 'T.D. 10033, DATES / Applicability Dates',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-09-16/html/2025-17865.htm',
      quotedText:
        'These regulations generally apply with respect to contributions in taxable years beginning after December 31, 2026. ... Prior to the applicability date of the final regulations, a reasonable, good faith interpretation standard applies with respect to the statutory provisions reflected in the final regulations. ... Under section 603(c) of the SECURE 2.0 Act, the amendments made by section 603 of the SECURE 2.0 Act apply to taxable years beginning after December 31, 2023. ... the first two taxable years beginning after December 31, 2023, are regarded as an administrative transition period with respect to the Roth catch-up requirement.',
    }, {
      kind: 'regulation',
      citation: 'T.D. 10033, preamble on FICA wages and self-employment',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-09-16/html/2025-17865.htm',
      quotedText:
        'an individual who did not have any FICA wages from the employer sponsoring the plan for the preceding calendar year (for example, a partner who had only self-employment income ... ) would not be subject to the Roth catch-up requirement under the plan in the current year. ... FICA wages that are Social Security wages reported in Box 3 of Form W-2',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-19',
    implementedBy: [
      'packages/engine/src/projection/employerRothCatchUp.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/employerRothCatchUp.ts#allocateEmployerElectiveDeferrals',
      'packages/engine/src/projection/employerRothCatchUp.ts#highEarnerRothCatchUpMandated',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-414-v-7-A-prior-year-fica-wage-proxy': {
    title: 'The 414(v)(7) wage test uses a user-entered Box 3 proxy, and omission fails closed',
    statement:
      'Section 414(v)(7)(A) turns on wages as defined in section 3121(a) from the employer sponsoring the plan for the preceding calendar year — Social Security wages reported in Form W-2 Box 3, not MAGI and not the section 414(q) highly compensated employee dollar amount. The plan model has no W-2 and no employer identity, so the engine compares a user-entered prior-calendar-year FICA wage figure on the employer account to the published threshold. When that field is omitted it defaults to zero, and a zero figure does not exceed the threshold, so the participant is treated as not subject. That is the statutory result for a new hire or a partner with only self-employment income, and it understates tax whenever the omitted Box 3 would have exceeded the threshold: the catch-up remains pre-tax, ordinary income and MAGI fall, and later section 86, ACA, and IRMAA readings follow the flatter income. Current-year wages are not substituted.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'The mandate itself is enacted; the approximation is the input. Inferring Box 3 from current-year wages, MAGI, or the HCE test would invent a wage test the statute does not use and would over-apply the mandate to self-employment and to wages from a different employer. Leaving the field at zero matches T.D. 10033\'s no-FICA result and is the fail-closed reading the fixtures pin. The field is a single static figure for every contribution year 2026 and later; the engine does not reconstruct a year-by-year Box 3 series.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 414(v)(7)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'in the case of an eligible participant whose wages (as defined in section 3121(a)) for the preceding calendar year from the employer sponsoring the plan exceed $145,000',
    }, {
      kind: 'regulation',
      citation: 'T.D. 10033, preamble on FICA wages and self-employment',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-09-16/html/2025-17865.htm',
      quotedText:
        'an individual who did not have any FICA wages from the employer sponsoring the plan for the preceding calendar year (for example, a partner who had only self-employment income ... ) would not be subject to the Roth catch-up requirement under the plan in the current year. ... FICA wages that are Social Security wages reported in Box 3 of Form W-2',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, section on the Roth catch-up wage threshold',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The Roth catch-up wage threshold for 2025, which under section 414(v)(7)(A) is used to determine whether an individual’s catch-up contributions to an applicable employer plan (other than a plan described in section 408(k) or (p)) for 2026 must be designated as Roth contributions, is increased from $145,000 to $150,000.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-19',
    implementedBy: [
      'packages/engine/src/projection/employerRothCatchUp.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/projection/employerRothCatchUp.ts#priorYearFicaExceedsRothCatchUpThreshold',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-415-d-cost-of-living-adjustment-anchor': {
    title: 'Section 415(d) is the adjustment mechanism the other retirement limits borrow',
    statement:
      'IRC 415(d) directs the Secretary to adjust the defined benefit limit and the 40,000 defined contribution limit in 415(c)(1)(A) for cost of living, measured on the calendar quarter ending September 30 of the preceding year against a base period of the calendar quarter beginning July 1, 2001, by procedures similar to those used for Social Security benefit adjustments, with any increase in the 415(c)(1)(A) amount rounded down to a multiple of 1,000. For 2026 that limit is 72,000, up from 70,000. The reason to record the mechanism rather than only the figure is that the 402(g) elective deferral limit, the 414(v) catch-up amounts, the Roth catch-up wage threshold and the QLAC premium cap all adjust by reference back to this same subsection, each with its own base period and its own rounding step. They move together, and none of them is ever a smooth multiple of the prior year.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The statutory adjustment lands on rounded steps while the projection multiplies the pack figure by a continuous inflation factor, so a projected year can sit between two published steps. Holding the step exactly would require index values for years that have not happened, which do not exist at planning time, so the continuous factor is a deliberate approximation. It is bounded by one rounding step, unbiased over a long horizon, and never reverses the direction of a limit. What it must not be extended to is a figure with no adjustment provision at all, where the same multiplication produces a number the statute never allows.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 415(d)(1), (d)(2), (d)(3)(D), (d)(4)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section415&num=0&edition=prelim',
      quotedText:
        'The Secretary shall adjust annually- (A) the $160,000 amount in subsection (b)(1)(A), (B) in the case of a participant who is separated from service, the amount taken into account under subsection (b)(1)(B), and (C) the $40,000 amount in subsection (c)(1)(A), for increases in the cost-of-living in accordance with regulations prescribed by the Secretary. (2) Method The regulations prescribed under paragraph (1) shall provide for- (A) an adjustment with respect to any calendar year based on the increase in the applicable index for the calendar quarter ending September 30 of the preceding calendar year over such index for the base period, and (B) adjustment procedures which are similar to the procedures used to adjust benefit amounts under section 215(i)(2)(A) of the Social Security Act. ... The base period taken into account for purposes of paragraph (1)(C) is the calendar quarter beginning July 1, 2001. ... Any increase under subparagraph (C) of paragraph (1) which is not a multiple of $1,000 shall be rounded to the next lowest multiple of $1,000.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, section on the section 415 limitations',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The limitation for defined contribution plans under section 415(c)(1)(A) is increased in 2026 from $70,000 to $72,000. The Code provides that various other amounts are to be adjusted at the same time and in the same manner as the limitation of section 415(b)(1)(A).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-219-f-3-prior-year-contribution-window': {
    title: 'A prior-year IRA contribution must be made by the unextended due date',
    statement:
      'A contribution made on account of a taxable year is deemed made on the last day of that year only if it is made no later than the time prescribed for filing that year return, not including extensions. An extension of the return does not extend the contribution window, so a contribution designated for the prior year but made after the ordinary April deadline is not a prior-year contribution and does not enter that year Form 8606 basis at all.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(f)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section219&num=0&edition=prelim',
      quotedText:
        'For purposes of this section, a taxpayer shall be deemed to have made a contribution to an individual retirement plan on the last day of the preceding taxable year if the contribution is made on account of such taxable year and is made not later than the time prescribed by law for filing the return for such taxable year (not including extensions thereof).',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-A, When Can Contributions Be Made',
      url: 'https://www.irs.gov/publications/p590a',
      quotedText:
        'Contributions can be made to your traditional IRA for a year at any time during the year or by the due date for filing your return for that year, not including extensions.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraAnnualFilingEvidence.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualPostCandidateEvidence.ts',
      'packages/engine/src/model/retirementActionAnnualTaxFacts.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraAnnualFilingEvidence.ts#buildPlanOwnedNonRothIraAnnualFilingEvidence',
      'packages/engine/src/actions/ownedNonRothIraAnnualPostCandidateEvidence.ts#buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput',
      'packages/engine/src/model/retirementActionAnnualTaxFacts.ts#ordinaryFederalFilingDeadline',
    ],
  },

  // --- Registered 2026-08-05; settled 2026-08-20 -----------------------------
  //
  // Found while settling the conversion DESTINATION question above, and kept
  // apart from it on purpose. That record says the engine picks a lawful
  // account to convert INTO; this one says it now asks whether the dollars
  // could have come OUT on the Roth-IRA path. Folding the second into the
  // first would have let a destination record carry a source claim.

  'irc-401-k-2-B-i-employer-plan-conversion-source-not-gated-by-distributability': {
    title: 'A pre-tax employer plan balance may be converted to a Roth IRA only when a 401(k)(2)(B)(i) event is provable',
    statement:
      'A qualified cash or deferred arrangement must provide that amounts attributable to the employee’s elective contributions are not distributable earlier than one of a closed list of events: severance from employment, death or disability, a 401(k)(10) event, the attainment of age 59½ in a profit-sharing or stock bonus plan, hardship, and three narrower cases. A conversion out of an employer plan into a Roth IRA is a qualified rollover contribution only under 408A(e)(1)(B)(ii), which admits it only if the rollover meets the requirements of section 402(c), 403(b)(8) or 457(e)(16) -- every one of which operates on a distribution. A balance the plan may not distribute therefore cannot be rolled to a Roth IRA at all. Hardship is on that distributable list but is not an eligible rollover distribution, so it is not a conversion path. Rule of 55 is a 72(t) exception after severance, not a new distributable event. The engine now gates the Roth-IRA path: isConvertibleToRoth refuses an owned employer traditional account unless the projection year can prove severance (attained age at or past the Plan retirementAge) or age 59½ (attained-age-60 proxy). The aggregate conversion path uses that predicate twice -- to weight an owner’s slice and to drain -- so a participant who has neither separated nor reached 59½ converts nothing, and the year names the refusal. In-plan Roth of otherwise nondistributable amounts under 402A(c)(4)(E) is a different enacted act, plan-optional, taxable now, remaining a designated Roth account in the same plan with the old distribution lock; it is not modelled and this record does not claim it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The authority fixes that a Roth-IRA rollover needs a distribution, and that elective deferrals are not distributable before a 401(k)(2)(B)(i) event. It selects nothing about how a year-granularity projection proves those events from the facts a Plan already carries, so those two proofs are engine conventions. Separation is the owner’s attained age at or past retirementAge, the same proxy the Rule of 55 and the 72(t)(3)(B) SEPP path already use; no separation-from-service schema field was added. Age 59½ is the attained-age-60 threshold the 72(t) additional-tax path already uses, because the aggregate conversion has no day-of-year execution date on which a half-year test could be proved. kind employer is the only discriminant a traditional account carries, so 403(b) and governmental 457(b) balances fail closed under the same gate rather than being told apart. Hardship is not treated as convertible: it is distributable but not rollable. 402A(c)(4)(E), added by ATRA section 902 for transfers after 2012-12-31, is a different act -- an optional in-plan transfer of otherwise nondistributable amounts to a designated Roth account in the same plan, which Notice 2013-74 Q-3 keeps under the old distribution lock -- and is not this path. Match and nonelective in-service distributions, and a real in-plan feature flag, are later splits.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(k)(2)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'under which amounts held by the trust which are attributable to employer contributions made pursuant to the employee\'s election- (i) may not be distributable to participants or other beneficiaries earlier than- (I) severance from employment, death, or disability, (II) an event described in paragraph (10), (III) in the case of a profit-sharing or stock bonus plan, the attainment of age 59½, (IV) subject to the provisions of paragraph (14), upon hardship of the employee, (V) in the case of a qualified reservist distribution (as defined in section 72(t)(2)(G)(iii)), the date on which a period referred to in subclause (III) of such section begins, (VI) except as may be otherwise provided by regulations, with respect to amounts invested in a lifetime income investment (as defined in subsection (a)(38)(B)(ii)), the date that is 90 days prior to the date that such lifetime income investment may no longer be held as an investment option under the arrangement, or (VII) as provided in section 401(a)(39),',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(e)(1)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408A&num=0&edition=prelim',
      quotedText:
        'The term "qualified rollover contribution" means a rollover contribution- ... (B) from an eligible retirement plan, but only if- ... (ii) in the case of any eligible retirement plan (as defined in section 402(c)(8)(B) other than clauses (i) and (ii) thereof), such rollover contribution meets the requirements of section 402(c), 403(b)(8), or 457(e)(16), as applicable',
    }, {
      kind: 'statute',
      citation: 'IRC 402(c)(4), lead-in and (C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "eligible rollover distribution" means any distribution to an employee of all or any portion of the balance to the credit of the employee in a qualified trust; except that such term shall not include- … (C) any distribution which is made upon hardship of the employee.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-20',
    implementedBy: [
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/aggregateRothConversionOwnerAllocation.ts',
      'packages/engine/src/projection/internal/annualAggregateRothConversionPlan.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/optimizerAggregateConversionPromotion.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/aggregateRothConversionOwnerAllocation.ts#allocateAggregateRothConversionByOwner',
      'packages/engine/src/projection/internal/annualAggregateRothConversionPlan.ts#annualAggregateRothConversionPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/accountEligibility.ts#isConvertibleToRoth',
      'packages/engine/src/projection/optimizerAggregateConversionPromotion.ts#promoteOneYear',
    ],
  },

  'irc-401-m-employee-contribution-mega-backdoor-roth-not-modeled': {
    title: 'Employer-plan employee-contribution mega-backdoor Roth path is not modeled',
    statement:
      'Section 401(m) separately recognizes employee contributions and matching contributions. A Roth path from an employer plan needs an eligible rollover distribution that is transferred to an eligible retirement plan, or the separate optional in-plan transfer section 402A(c)(4)(E) permits. The Plan has no employer-plan employee-contribution or after-tax-basis field, no plan-feature or distribution-eligibility facts for that source, and no retirement-action vocabulary for a connected employer-plan-to-Roth movement. A commonly called mega-backdoor Roth fact pattern therefore cannot be expressed or priced by the engine.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The IRA-only nondeductibleBasis field is intentionally not an employer-plan after-tax contribution record: model/plan.ts rejects it on an employer traditional account. The employer-account schemas retain neither a separate employee-contribution/basis pool nor the plan permission and distribution facts that select a route. model/plan.test.ts pins that schema vocabulary, and actions/contract.test.ts pins the absence of a corresponding action from both request unions. The existing Notice 2014-54 record remains narrower: it covers allocation of an already-expressible simultaneous employer-plan disbursement to multiple destinations, not the absent source and feature facts here.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(m)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'the sum of the matching contributions and employee contributions paid under the plan on behalf of each such employee for such plan year, to',
    }, {
      kind: 'statute',
      citation: 'IRC 402(c)(1)(A)-(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'If- (A) any portion of the balance to the credit of an employee in a qualified trust is paid to the employee in an eligible rollover distribution, (B) the distributee transfers any portion of the property received in such distribution to an eligible retirement plan,',
    }, {
      kind: 'statute',
      citation: 'IRC 402A(c)(4)(E)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'the plan may allow an individual to elect to have the plan transfer any amount not otherwise distributable under the plan to a designated Roth account maintained for the benefit of the individual,',
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
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateConversion',
    ],
  },

  'irc-401-k-11-simple-401-k-elective-deferral-limit': {
    title: 'SIMPLE 401(k) elective deferrals use the separate SIMPLE limit',
    statement:
      'A SIMPLE 401(k) participant election may not exceed the section 408(p)(2)(A)(ii) amount. Notice 2025-67 sets the generally applicable section 408(p)(2)(E)(i)(III) amount at 17,000 dollars for 2026, rather than the general 24,500-dollar section 402(g)(1) limit; a section 408(p)(2)(E)(i)(II) election that permits the enhanced adjusted-dollar amount is a separate claim registered at irc-408-p-2-E-i-II-simple-enhanced-elective-deferral-election. Not modelled: an employer account can be labelled only 401k, 403b, or 457b; it cannot establish that a 401(k) is a SIMPLE 401(k), so the projection cannot select the separate limit.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The generic 402(g) aggregate record is deliberately not extended to call a 401(k) SIMPLE: that plan-document status is absent. model/plan.test.ts gates the employer-plan-type membership, and actions/contract.test.ts gates the absence of a plan-term correction/action arm. The enhanced-limit election under 408(p)(2)(E)(i)(II) is not carried here — one claim per record.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(k)(11)(B)(i)(I)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'an employee may elect to have the employer make elective contributions for the year on behalf of the employee to a trust under the plan in an amount which is expressed as a percentage of compensation of the employee but which in no event exceeds the amount in effect under section 408(p)(2)(A)(ii) (after the application of any election under section 408(p)(2)(E)(i)(II)),',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, SIMPLE retirement account and SIMPLE 401(k) limitation',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The limitation under section 408(p)(2)(E)(i)(III) that generally applies to salary reduction contributions under a SIMPLE retirement account or elective contributions under a SIMPLE 401(k) plan is increased from $16,500 to $17,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-408-p-2-E-i-II-simple-enhanced-elective-deferral-election': {
    title: 'A SIMPLE plan may elect the enhanced elective-deferral dollar amount',
    statement:
      'Section 408(p)(2)(E)(i)(II) lets an eligible employer that is not described in subclause (I) elect the adjusted dollar amount — 110 percent of the section 408(p)(2)(E)(i)(III) amount in effect for calendar year 2024, as further indexed — and section 401(k)(11)(B)(i)(I) applies that election to a SIMPLE 401(k). Notice 2025-67 distinguishes that enhanced limb from the generally applicable section 408(p)(2)(E)(i)(III) amount. Not modelled: the Plan has no SIMPLE status, employer-size fact, or 408(p)(2)(E)(i)(II) election, so the projection cannot select the enhanced limit.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Separated from irc-401-k-11-simple-401-k-elective-deferral-limit so each record carries one claim: that record is the generally applicable (i)(III) amount; this one is the election limb. model/plan.test.ts gates employer-plan-type membership against a simple401k arm, and actions/contract.test.ts gates the absence of a plan-term election/action.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(k)(11)(B)(i)(I)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'an employee may elect to have the employer make elective contributions for the year on behalf of the employee to a trust under the plan in an amount which is expressed as a percentage of compensation of the employee but which in no event exceeds the amount in effect under section 408(p)(2)(A)(ii) (after the application of any election under section 408(p)(2)(E)(i)(II)),',
    }, {
      kind: 'statute',
      citation: 'IRC 408(p)(2)(E)(i)(II)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'the adjusted dollar amount in the case of an eligible employer described in clause (iii) which is not described in subclause (I) and which elects, at such time and in such manner as prescribed by the Secretary, the application of this subclause for the year, and',
    }, {
      kind: 'statute',
      citation: 'IRC 408(p)(2)(E)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'For purposes of clause (i), the adjusted dollar amount is an amount equal to 110 percent of the dollar amount in effect under clause (i)(III) for calendar year 2024.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, SIMPLE retirement account and SIMPLE 401(k) limitation',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The limitation under section 408(p)(2)(E)(i)(III) that generally applies to salary reduction contributions under a SIMPLE retirement account or elective contributions under a SIMPLE 401(k) plan is increased from $16,500 to $17,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-401-a-17-plan-compensation-cap': {
    title: 'Qualified-plan compensation taken into account is capped',
    statement:
      'For a qualified trust, section 401(a)(17) limits the annual compensation of an employee taken into account under the plan; Notice 2025-67 sets that indexed limit at 360,000 dollars for 2026. The projection instead applies a simple employer-match percentage to uncapped household wages, so a 500,000-dollar wage year with a 100-percent-of-deferral match capped at 6 percent of pay and a 24,500-dollar elective receives a 24,500-dollar match rather than the 21,600-dollar match that 6 percent of the 360,000-dollar compensation cap would allow. Section 415(c) does not repair the overstatement when the combined annual additions remain under the 415(c) dollar limit. The Plan has no plan-defined compensation amount or qualified-plan terms from which to determine what the employer actually takes into account under 401(a)(17).',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DEFECT — no behavior change in this registration slice. The match dollars are not current-year taxable income; they inflate tax-deferred balances and therefore defer and understate future tax while overstating resources. That is the same resource-inflating / future-tax-understating shape as irc-414-v-1-plan-permitted-catch-up and irc-408A-c-3-roth-contribution-agi-phase-out, which also use understatesTax when the engine admits more tax-advantaged contribution than the authority allows. The fixture pins employerMatch at the uncapped 24,500 against the statute\'s 21,600 until a separately authorized implementation fix changes it. model/plan.test.ts still gates the absent plan-defined compensation field.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(17)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'A trust shall not constitute a qualified trust under this section unless, under the plan of which such trust is a part, the annual compensation of each employee taken into account under the plan for any year does not exceed $200,000.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, annual compensation limitation',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The annual compensation limitation under sections 401(a)(17), 404(l), 408(k)(3)(C), and 408(k)(6)(D)(ii) is increased from $350,000 to $360,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#employerMatchSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-402-g-2-excess-elective-deferral-correction': {
    title: 'A timely excess-elective-deferral distribution avoids taxing the deferral twice',
    statement:
      'After an excess elective deferral is included in gross income under section 402(g)(1), the individual may allocate and notify plans by March 1 and each plan may distribute the allocated deferral and allocable income by April 15. The deferral distribution itself is not again included in gross income, while its income is income in the distribution year and bears no section 72(t) tax. Not modelled: the Plan has no original payroll deferral, plan allocation or notice, corrective-distribution date, or allocable-income fact, and no retirement-action arm can execute that correction.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The contribution allocator prevents modeled requests from exceeding its aggregate ceiling; it is not a record of an actual excess or a corrective distribution. actions/contract.test.ts gates the request and persisted action unions against a correction kind, while model/plan.test.ts gates the missing correction facts.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402(g)(2)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'not later than the 1st March 1 following the close of the taxable year, the individual may allocate the amount of such excess deferrals among the plans under which the deferrals were made and may notify each such plan of the portion allocated to it, and',
    }, {
      kind: 'statute',
      citation: 'IRC 402(g)(2)(A)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'not later than the 1st April 15 following the close of the taxable year, each such plan may distribute to the individual the amount allocated to it under clause (i) (and any income allocable to such amount through the end of such taxable year).',
    }, {
      kind: 'statute',
      citation: 'IRC 402(g)(2)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'except as provided in clause (ii), such distribution shall not be included in gross income, and',
    }, {
      kind: 'statute',
      citation: 'IRC 402(g)(2)(C)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'any income on the excess deferral shall, for purposes of this chapter, be treated as earned and received in the taxable year in which such income is distributed.',
    }, {
      kind: 'statute',
      citation: 'IRC 402(g)(2)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText: 'No tax shall be imposed under section 72(t) on any distribution described in the preceding sentence.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/actions/contract.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRetirementActionRequestSchema',
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
    ],
  },

  'irc-4973-a-b-f-ira-and-roth-excess-contribution-excise': {
    title: 'Uncorrected IRA and Roth IRA excess contributions incur the section 4973 excise',
    statement:
      'Section 4973(a) imposes a 6-percent excise on excess contributions at year end. For a traditional IRA, section 4973(b) uses amounts contributed above the section 219 deduction amount computed without regard to section 219(g); for a Roth IRA, section 4973(f) uses contributions above the amount allowable under 408A(c)(2) and (c)(3). Form 5329 carries prior-year excess forward and prices 6 percent of the lesser of the excess and the December 31 value. The engine lets a high-income Roth IRA contribution land but does not price this section 4973 excise, understating tax. A contribution distributed in a distribution to which 408(d)(4) applies is treated as not contributed, but the conditions and deadline for that correction are not registered here because a primary-source copy of 408(d)(4) and 408A(d)(6) was not supplied.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DEFECT — no behavior change in this registration slice. projection/simulate.ts has a Roth contribution path and a penalties total, but no section 4973 IRA/Roth excess-contribution term. The companion fixture uses a 100-dollar Roth contribution at income already above the 2026 Roth phase-out and derives 6 dollars as 100 × 0.06; the observed produced value is 0 — no excise term exists, so penalties stay untouched — pinned until a separately authorized implementation fix changes it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 4973(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4973&num=0&edition=prelim',
      quotedText:
        'there is imposed for each taxable year a tax in an amount equal to 6 percent of the amount of the excess contributions to such individual\'s accounts or annuities (determined as of the close of the taxable year). The amount of such tax for any taxable year shall not exceed 6 percent of the value of the account or annuity (determined as of the close of the taxable year).',
    }, {
      kind: 'statute',
      citation: 'IRC 4973(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4973&num=0&edition=prelim',
      quotedText:
        '(1) the excess (if any) of- (A) the amount contributed for the taxable year to the accounts or for the annuities (other than a contribution to a Roth IRA or a rollover contribution described in section 402(c), 403(a)(4), 403(b)(8), 408(d)(3), or 457(e)(16)), over (B) the amount allowable as a deduction under section 219 for such contributions, and (2) the amount determined under this subsection for the preceding taxable year reduced by the sum of-',
    }, {
      kind: 'statute',
      citation: 'IRC 4973(f)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4973&num=0&edition=prelim',
      quotedText:
        '(1) the excess (if any) of- (A) the amount contributed for the taxable year to Roth IRAs (other than a qualified rollover contribution described in section 408A(e)), over (B) the amount allowable as a contribution under sections 408A(c)(2) and (c)(3), and (2) the amount determined under this subsection for the preceding taxable year, reduced by the sum of-',
    }, {
      kind: 'statute',
      citation: 'IRC 4973(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4973&num=0&edition=prelim',
      quotedText:
        'For purposes of paragraphs (1)(B) and (2)(C), the amount allowable as a deduction under section 219 shall be computed without regard to section 219(g).',
    }, {
      kind: 'statute',
      citation: 'IRC 4973(f)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4973&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, any contribution which is distributed from a Roth IRA in a distribution described in section 408(d)(4) shall be treated as an amount not contributed.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form 5329, Part IV, line 25',
      url: 'https://www.irs.gov/pub/irs-pdf/f5329.pdf',
      quotedText:
        'Additional tax. Enter 6% (0.06) of the smaller of line 24 or the value of your Roth IRAs on December 31, 2025 (including 2025 contributions made in 2026). Include this amount on Schedule 2 (Form 1040), line 8',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#rothAccountSchema',
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-411-a-2-vesting-schedule-maximums': {
    title: 'Employer contributions are subject to section 411 vesting maxima',
    statement:
      'A defined-contribution plan must provide either 100-percent vesting after three years of service or a nonforfeitable percentage under the two-to-six-year schedule for benefits derived from employer contributions. Not modelled: the Plan records an employer-plan balance and a simple current match formula, not a plan document, service history, contribution-source vesting ledger, or a vesting election, so it cannot determine a vested balance or test a plan schedule.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'A projected account balance is not evidence that each underlying employer contribution is vested. model/plan.test.ts gates the absence of vesting schedule and service fields, and actions/contract.test.ts gates the absence of a vesting action or certification.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 411(a)(2)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section411&num=0&edition=prelim',
      quotedText:
        'A plan satisfies the requirements of this clause if an employee who has completed at least 3 years of service has a nonforfeitable right to 100 percent of the employee\'s accrued benefit derived from employer contributions.',
    }, {
      kind: 'statute',
      citation: 'IRC 411(a)(2)(B)(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section411&num=0&edition=prelim',
      quotedText:
        'A plan satisfies the requirements of this clause if an employee has a nonforfeitable right to a percentage of the employee\'s accrued benefit derived from employer contributions determined under the following table:',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/actions/contract.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRetirementActionRequestSchema',
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
    ],
  },

  'irc-402-g-7-403b-15-year-catch-up': {
    title: 'The special 403(b) 15-year catch-up has independent eligibility and caps',
    statement:
      'For a qualified employee of a qualified organization, section 402(g)(7) increases the 402(g)(1) limit by the least of 3,000 dollars, the remaining 15,000-dollar cumulative amount, or the service-based amount. The regulation requires a qualifying employee to have at least 15 years of service and treats a contribution eligible for both this special catch-up and an age-50 catch-up first as the special catch-up. Not modelled: the Plan has no qualified-organization status, plan-document election, years-of-service record, prior special-catch-up history, or ordering election.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'employerPlanType: 403b is an RMD-aggregation label only; it does not establish any of the section 402(g)(7) predicates. model/plan.test.ts gates those absent membership fields and actions/contract.test.ts gates the absence of a catch-up certification/action.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402(g)(7)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'In the case of a qualified employee of a qualified organization, with respect to employer contributions described in paragraph (3)(C) made by such organization, the limitation of paragraph (1) for any taxable year shall be increased by whichever of the following is the least:',
    }, {
      kind: 'statute',
      citation: 'IRC 402(g)(7)(A)(i)-(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        '$3,000, … $15,000 reduced by the sum of- … the excess of $5,000 multiplied by the number of years of service of the employee with the qualified organization over the employer contributions described in paragraph (3) made by the organization on behalf of such employee for prior taxable years (determined in the manner prescribed by the Secretary).',
    }, {
      kind: 'regulation',
      citation: '26 CFR 1.403(b)-4(c)(3)(iii)-(iv)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.403(b)-4',
      quotedText:
        'qualified employee means an employee who has completed at least 15 years of service … any catch-up amount contributed by an employee who is eligible for both an age 50 catch-up and a special section 403(b) catch-up is treated first as an amount contributed as a special section 403(b) catch-up to the extent a special section 403(b) catch-up is permitted, and then as an amount contributed as an age 50 catch-up',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-414-v-7-402-g-7-403b-15-year-catch-up-exclusion': {
    title: 'The 403(b) 15-year catch-up is not the 414(v)(1) Roth-mandated catch-up',
    statement:
      'Section 414(v)(7)(A) limits its Roth condition to the additional elective deferrals under section 414(v)(1), while section 402(g)(7) independently increases the section 402(g)(1) limitation for a qualified 403(b) employee. The special 403(b) 15-year catch-up is therefore not made a designated-Roth contribution solely by the section 414(v)(7) high-earner rule. Not modelled: the Plan cannot establish that a contribution is a qualified 402(g)(7) amount, so it cannot label or act on this exclusion.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is not a duplicate of irc-414-v-7-A-high-earner-roth-catch-up-mandate: that record covers the 414(v)(1) catch-up, including SIMPLE IRA and Roth-program limbs. The missing 402(g)(7) membership facts are gated in model/plan.test.ts.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 414(v)(7)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'Except as provided in subparagraph (C), in the case of an eligible participant whose wages (as defined in section 3121(a)) for the preceding calendar year from the employer sponsoring the plan exceed $145,000, paragraph (1) shall apply only if any additional elective deferrals are designated Roth contributions (as defined in section 402A(c)(1)) made pursuant to an employee election.',
    }, {
      kind: 'statute',
      citation: 'IRC 402(g)(7)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'In the case of a qualified employee of a qualified organization, with respect to employer contributions described in paragraph (3)(C) made by such organization, the limitation of paragraph (1) for any taxable year shall be increased by whichever of the following is the least:',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-219-g-traditional-ira-deduction-phaseout': {
    title: 'Traditional-IRA deductions phase out for workplace-plan participants',
    statement:
      'When an individual or spouse is an active participant in a listed workplace plan, section 219(g) reduces the traditional-IRA deduction limit by a MAGI ratio, with a 10,000-dollar single and 20,000-dollar joint band. Notice 2025-67 sets the 2026 active-participant phase-out ranges at 81,000 to 91,000 dollars for a single or head-of-household filer and 129,000 to 149,000 dollars for a joint filer; it sets the nonparticipant-with-active-spouse range at 242,000 to 252,000 dollars. The engine treats every allowed traditional IRA deposit as pre-tax and does not apply this deduction phase-out, understating tax for a participant above the applicable range.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DEFECT — no behavior change in this registration slice. The Plan can carry a traditional IRA, wages, filing status, and an employer account, but has no active-participant fact or section 219(g) MAGI calculation. projection/simulate.ts nevertheless adds an allowed traditional IRA deposit to preTaxContributions. The fixture supplies a one-dollar employer deferral to establish actual participation, uses 100,000 dollars of wages, and derives the accepted 99,999-dollar 100-percent-flat-tax base by allowing the employer deferral but no 100-dollar IRA deduction; the observed engine output is 99,899 — the deposit is deducted despite the phaseout — pinned until a separately authorized implementation fix changes it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(g)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section219&num=0&edition=prelim',
      quotedText:
        'If (for any part of any plan year ending with or within a taxable year) an individual or the individual\'s spouse is an active participant, each of the dollar limitations contained in subsections (b)(1)(A) and (c)(1)(A) for such taxable year shall be reduced (but not below zero) by the amount determined under paragraph (2).',
    }, {
      kind: 'statute',
      citation: 'IRC 219(g)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section219&num=0&edition=prelim',
      quotedText:
        'The amount determined under this paragraph with respect to any dollar limitation shall be the amount which bears the same ratio to such limitation as- … the excess of- … the taxpayer\'s adjusted gross income for such taxable year, over … the applicable dollar amount, bears to … $10,000 ($20,000 in the case of a joint return).',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, traditional IRA deduction phase-out ranges',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'the deduction for taxpayers making contributions to a traditional IRA is phased out for single individuals and heads of household who are active participants in a qualified plan (or another retirement plan specified in section 219(g)(5)) and have adjusted gross incomes (as defined in section 219(g)(3)(A)) between $81,000 and $91,000, increased from between $79,000 and $89,000. For married couples filing jointly, if the spouse who makes the IRA contribution is an active participant, the income phase-out range is between $129,000 and $149,000, increased from between $126,000 and $146,000. For an IRA contributor who is not an active participant and is married to someone who is an active participant, the deduction is phased out if the couple\'s income is between $242,000 and $252,000, increased from between $236,000 and $246,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'pl-116-94-div-o-title-I-sec-107-traditional-ira-age-cap-repeal': {
    title: 'Traditional IRA contributions have no maximum contribution age',
    statement:
      'Public Law 116-94 repealed section 219(d)(1), removing the traditional-IRA contribution age ceiling. An otherwise eligible individual may contribute after age 70.5; the ordinary section 219 dollar, compensation, and deduction limitations still apply.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'legislativeHistory',
      citation: 'P.L. 116-94, division O, title I, section 107(a)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-116publ94/pdf/PLAW-116publ94.pdf',
      quotedText:
        'Paragraph (1) of section 219(d) of the Internal Revenue Code of 1986 is repealed.',
    }, {
      kind: 'statute',
      citation: 'IRC 219(d)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section219&num=0&edition=prelim',
      quotedText:
        '[(1) Repealed. Pub. L. 116–94, div. O, title I, §107(a), Dec. 20, 2019, 133 Stat. 3148 ]',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#planSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-457-b-3-final-three-year-catch-up': {
    title: 'An eligible 457(b) plan may provide a final-three-taxable-year catch-up',
    statement:
      'Section 457(b)(3) lets an eligible deferred compensation plan provide a special ceiling for one or more of the participant\'s last three taxable years before normal retirement age: the lesser of twice the ordinary ceiling or the current ordinary ceiling plus unused earlier ceiling. Eligible employers include both a State, political subdivision, agency, or instrumentality under section 457(e)(1)(A) and any other organization (other than a governmental unit) exempt from tax under the subtitle under section 457(e)(1)(B). Not modelled: an employerPlanType of 457b does not establish eligible-employer status, normal retirement age under the plan, plan provision, or prior unused ceiling, so the projection cannot apply the special catch-up.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The generic employer-deferral allocator treats 457b only as a plan class and has no final-three-year state. model/plan.test.ts gates the missing sponsor, normal-retirement-age, and unused-deferral fields; actions/contract.test.ts gates the absence of an attested special-catch-up action. The id drops "governmental" because section 457(b)(3) is not limited to governmental sponsors.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 457(e)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section457&num=0&edition=prelim',
      quotedText:
        'a State, political subdivision of a State, and any agency or instrumentality of a State or political subdivision of a State, and',
    }, {
      kind: 'statute',
      citation: 'IRC 457(e)(1)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section457&num=0&edition=prelim',
      quotedText:
        'any other organization (other than a governmental unit) exempt from tax under this subtitle.',
    }, {
      kind: 'statute',
      citation: 'IRC 457(b)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section457&num=0&edition=prelim',
      quotedText:
        'which may provide that, for 1 or more of the participant\'s last 3 taxable years ending before he attains normal retirement age under the plan, the ceiling set forth in paragraph (2) shall be the lesser of- … twice the dollar amount in effect under subsection (b)(2)(A), or … the sum of- … the plan ceiling established for purposes of paragraph (2) for the taxable year (determined without regard to this paragraph), plus … so much of the plan ceiling established for purposes of paragraph (2) for taxable years before the taxable year as has not previously been used under paragraph (2) or this paragraph,',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-83-a-equity-compensation-execution-character': {
    title: 'Equity-compensation execution is not universally ordinary income at execution',
    statement:
      'Section 61 includes compensation for services in gross income, but for property transferred for services section 83(a) includes the excess value in the first taxable year when the rights become transferable or no longer carry a substantial risk of forfeiture. The named ordinary-withdrawal executor instead classifies every available equity-compensation execution as its full amount of ordinary income at execution, without a transfer date, section 83(b) election, amount paid, grant type, or post-vesting basis/holding-period facts. For already vested property, that convention can charge section 83 compensation after the statutory inclusion year and overstates tax. For a zero-basis cliff account that vests in the execution year, section 83(a) includes the full vested value even when only part is executed, so classifying only the executed amount understates tax in that year.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'DEFECT — no behavior change in this registration slice. actions/execution.ts emits fullyTaxableCompensationAtExecution with ordinaryIncomeAmount equal to the whole executed amount. One fixture drives the alreadyVested path and derives a zero section 83(a) compensation amount in the later execution year while the engine classifies the whole 75-dollar execution as ordinary income (overstates tax). A second fixture drives a zero-basis cliff vesting 100 dollars in the execution year with only 75 executed: section 83(a) includes the full 100 of vested value, but the executor reports ordinary income only on the executed 75 (understates tax). Both signs are pinned until a separately authorized implementation fix changes them.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 61(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section61&num=0&edition=prelim',
      quotedText: 'Compensation for services, including fees, commissions, fringe benefits, and similar items;',
    }, {
      kind: 'statute',
      citation: 'IRC 83(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section83&num=0&edition=prelim',
      quotedText:
        'the fair market value of such property (determined without regard to any restriction other than a restriction which by its terms will never lapse) at the first time the rights of the person having the beneficial interest in such property are transferable or are not subject to a substantial risk of forfeiture, whichever occurs earlier, over … the amount (if any) paid for such property, … shall be included in the gross income of the person who performed such services in the first taxable year in which the rights of the person having the beneficial interest in such property are transferable or are not subject to a substantial risk of forfeiture, whichever is applicable.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/actions/execution.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/execution.ts#executeOrdinaryWithdrawals',
      'packages/engine/src/model/plan.ts#equityCompAccountSchema',
    ],
  },

  'irc-6433-a-1-savers-match-qualified-retirement-savings-contributions': {
    title: 'Saver\'s Match is a post-2026 contribution for eligible savers',
    statement:
      'For taxable years beginning after December 31, 2026, an eligible individual who makes qualified retirement savings contributions receives the section 6433 matching contribution, paid to an applicable retirement savings vehicle. RetireGolden models neither Saver\'s Match eligibility, qualifying contributions, matching contribution, nor the receiving account treatment, so it produces no Saver\'s Match result.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is deliberately registered ahead of the first statutory tax year rather than projected as a 2026 credit. The plan model has no Saver\'s Match eligibility, qualifying-contribution, match-payment, or match-account fields, and the action contract has no claim or deposit kind. Those schema and action-vocabulary refusals are covered in model/plan.test.ts and actions/contract.test.ts. effectiveFrom is 2027 because the enacting applicability is taxable years beginning after December 31, 2026 — the rule cannot govern a 2026 pack year.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 6433(a)(1)-(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section6433&num=0&edition=prelim',
      quotedText:
        'Any eligible individual who makes qualified retirement savings contributions for the taxable year shall be allowed a matching contribution for such taxable year in an amount equal to the applicable percentage of so much of the qualified retirement savings contributions made by such eligible individual for the taxable year as does not exceed $2,000.',
    }, {
      kind: 'legislativeHistory',
      citation: 'P.L. 117-328, division T, title I, section 103(a), (f)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-117publ328/pdf/PLAW-117publ328.pdf',
      quotedText:
        'SEC. 103. SAVER\'S MATCH. (a) IN GENERAL.--Subchapter B of chapter 65 is amended by adding at the end the following new section: "SEC. 6433. SAVER\'S MATCH." ... The amendments made by this section shall apply to taxable years beginning after December 31, 2026.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2026-48, section I',
      url: 'https://www.irs.gov/pub/irs-drop/n-26-48.pdf',
      quotedText:
        'For taxable years beginning after December 31, 2026, section 6433 of the Code allows certain low- and moderate-income individuals who make qualified retirement savings contributions to receive matching contributions of up to $1,000 (Saver\u2019s Match contributions) paid by the Secretary of the Treasury or the Secretary\u2019s delegate (Secretary) to applicable retirement savings vehicles.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2027,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/actions/contract.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRetirementActionRequestSchema',
      'packages/engine/src/model/plan.ts#planSchema',
    ],
  },

  'irc-6433-f-6-savers-match-early-distribution-recovery-tax': {
    title: 'Certain early Saver\'s Match distributions create a recovery tax',
    statement:
      'When Saver\'s Match contributions exceed the end-of-year balance after a specified early distribution, section 6433(f)(6) increases chapter 1 tax by that excess, reduced by any overlapping section 72(t)(1) increase. RetireGolden has no Saver\'s Match contribution or recovery-distribution facts, so it cannot calculate this recovery tax.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The recovery rule depends on a section 6433(a)(2) contribution history, end-of-year Saver\'s Match balance, and the specified-early-distribution classification. None is expressible on an account or a retirement action. The missing Saver\'s Match schema and action vocabulary are refused by the additive gates in model/plan.test.ts and actions/contract.test.ts. effectiveFrom is 2027 because the enacting applicability is taxable years beginning after December 31, 2026 — the rule cannot govern a 2026 pack year.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 6433(f)(6)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section6433&num=0&edition=prelim',
      quotedText:
        'In the case of an applicable retirement savings vehicle to which contributions have been made under subsection (a)(2), and from which a specified early distribution has been made during the taxable year, if the aggregate amount of such contributions exceeds the account balance of such savings vehicle at the end of the such taxable year, the tax imposed by chapter 1 shall be increased by an amount equal to such excess (reduced by the amount by which the tax under such chapter was increased under section 72(t)(1) with respect to such distribution).',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2026-48, section I',
      url: 'https://www.irs.gov/pub/irs-drop/n-26-48.pdf',
      quotedText:
        'For taxable years beginning after December 31, 2026, section 6433 of the Code allows certain low- and moderate-income individuals who make qualified retirement savings contributions to receive matching contributions of up to $1,000 (Saver\u2019s Match contributions) paid by the Secretary of the Treasury or the Secretary\u2019s delegate (Secretary) to applicable retirement savings vehicles.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2027,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/actions/contract.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/contract.ts#persistedRetirementActionRequestSchema',
      'packages/engine/src/model/plan.ts#planSchema',
    ],
  },

  'irc-414-v-1-plan-permitted-catch-up': {
    title: 'An employer plan may permit, but need not offer, a catch-up contribution',
    statement:
      'Section 414(v)(1) says an applicable employer plan is not disqualified merely because it permits an eligible participant to make additional elective deferrals; the plan term therefore controls whether a catch-up, including the ages-60-through-63 amount, is available. RetireGolden has no plan-term input and applies the catch-up to every employer account at the eligible age, so it can admit a pre-tax catch-up an actual plan does not permit.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'The input model identifies an account as kind employer but has no plan-permits-catch-up fact. simulate.ts consequently assigns employerCatchUpForAge to every employer account at the eligible age. The fixture in employerRothCatchUp.test.ts uses an age-62 participant who requests 24,500 plus 11,250: a plan without the optional feature allows only 24,500, but the engine accepts 35,750 as a pre-tax contribution and understates tax. The published 11,250 figure used by that fixture is Notice 2025-67\'s 2026 figure, not a reconstruction of SECURE 2.0\'s formula.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 414(v)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'An applicable employer plan shall not be treated as failing to meet any requirement of this title solely because the plan permits an eligible participant to make additional elective deferrals in any plan year.',
    }, {
      kind: 'legislativeHistory',
      citation: 'P.L. 117-328, division T, title I, section 109(a)(1)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-117publ328/pdf/PLAW-117publ328.pdf',
      quotedText:
        'Section 414(v)(2)(B)(i) is amended by inserting the following before the period: \u2018\u2018(the adjusted dollar amount, in the case of an eligible participant who would attain age 60 but would not attain age 64 before the close of the taxable year)\u2019\u2019',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2025-67',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The limitation under section 414(v)(2)(E)(i) for catch-up contributions to an applicable employer plan other than a plan described in section 401(k)(11) or section 408(p) that applies for individuals who attain … age 60, 61, 62, or 63 in 2026 remains $11,250.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#rothAccountSchema',
      'packages/engine/src/model/plan.ts#traditionalAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-219-b-5-B-ira-catch-up-excludes-employer-plan-super-catch-up': {
    title: 'An IRA receives its section 219 age-50 catch-up, not the employer-plan super catch-up',
    statement:
      'The ages-60-through-63 adjusted amount is a section 414(v) limit for applicable employer plans, while section 219(b)(5) supplies the age-50 catch-up for an IRA. RetireGolden gives an account whose kind is ira only the pack\'s IRA catch-up and never applies the employer-plan super catch-up to it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'simulate.ts separates employer accounts, which call employerCatchUpForAge, from traditional and Roth IRA accounts, which add only contributionLimits.iraCatchUp50 at age 50 or later. The fixture in employerRothCatchUp.test.ts discriminates the published 2026 7,500 plus 1,100 IRA total from the employer-plan 7,500 plus 11,250 reading for an age-62 owner. The 11,250 comparison value comes from Notice 2025-67; it is not calculated from the statutory formula.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(b)(5)(B)(i)-(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section219&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who has attained the age of 50 before the close of the taxable year, the deductible amount for such taxable year shall be increased by the applicable amount. … For purposes of clause (i), the applicable amount is $1,000.',
    }, {
      kind: 'statute',
      citation: 'IRC 414(v)(6)(A)(i)-(iv)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'The term "applicable employer plan" means- (i) an employees\' trust described in section 401(a) which is exempt from tax under section 501(a), (ii) a plan under which amounts are contributed by an individual\'s employer for an annuity contract described in section 403(b), (iii) an eligible deferred compensation plan under section 457 of an eligible employer described in section 457(e)(1)(A), and (iv) an arrangement meeting the requirements of section 408(k) or (p).',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2025-67, IRA catch-up limit',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The deductible amount pursuant to section 219(b)(5)(B)(ii) for individuals who have attained age 50 before the close of the taxable year is increased from $1,000 to $1,100.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2025-67, ages 60-63 catch-up limit',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The limitation under section 414(v)(2)(E)(i) for catch-up contributions to an applicable employer plan other than a plan described in section 401(k)(11) or section 408(p) that applies for individuals who attain … age 60, 61, 62, or 63 in 2026 remains $11,250.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

/**
 * Medicare and health coverage records: Part B and Part D premiums, the IRMAA
 * applicable percentages and their two-year MAGI lookback, the enrollment periods
 * and late-enrollment penalties, the ACA premium credit inputs, and the medical
 * expense deduction.
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
export const medicareAndHealthCoverageRecords = {
  'rev-proc-2025-25-aca-applicable-percentage-2026': {
    title: 'ACA applicable percentage table for 2026',
    statement:
      'The premium tax credit applicable percentage runs 2.10 percent below 133 percent of the federal poverty line, then in bands opening at 3.14, 4.19, 6.60, 8.44 and 9.96 percent. The bands are stated as "at least X but less than Y", so 133 percent is a real step rather than a continuation of the 2.10 percent floor, and the schedule ends at "not more than 400 percent", making 400 inclusive.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine interpolates linearly between the published breakpoints. The revenue procedure gives an initial and a final percentage per band rather than a formula, and linear interpolation is the construction that reproduces both endpoints of every band. Section 3.01 presents those percentages as a table, so the quotation carries only the sentence introducing it; the bands and rates are stated above in this record rather than rewritten into prose and attributed to the revenue procedure.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-25, section 3.01',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-25.pdf',
      quotedText:
        'Applicable Percentage Table for 2026. For taxable years beginning in calendar year 2026, the Applicable Percentage Table for purposes of \u00a7 36B(b)(3)(A)(i) and \u00a7 1.36B-3(g) is:',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/aca.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/aca.ts#acaApplicablePct',
    ],
  },

  'usc-42-1395w-113-b-pl-117-169-part-d-penalty-and-cost-sharing': {
    title: 'Part D late-enrollment and drug-cost rules are not modeled',
    statement:
      'The Part D late-enrollment penalty is the greater of an actuarially sound amount for each uncovered month or 1 percent of the base beneficiary premium for each such month; an uncovered month depends on the timing of enrollment and creditable coverage. The Inflation Reduction Act sets the annual out-of-pocket threshold at $2,000 for 2025 and then increases it annually, but the staged enactment contains no published 2026 annual percentage, so this record does not assert the queue row\'s $2,100 figure. For 2026 and later, the insulin-product copayment ceiling is the lesser of $35, 25 percent of the maximum fair price, or 25 percent of the negotiated price. The Plan has no Part D enrollment, creditable-coverage history, base-premium, drug-claim, product, negotiated-price, maximum-fair-price, or cost-sharing inputs, so it produces none of these rule-derived figures.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'Part D enrollment and its timing',
      'creditable-coverage history and the uncovered months it leaves',
      'the base beneficiary premium',
      'drug claims, the products behind them, negotiated prices, and maximum fair prices',
      'any cost-sharing input the out-of-pocket threshold and insulin ceiling would apply to',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'healthcareConfigSchema admits a generic medicareExtrasMonthlyPerPerson amount, but it is a user-entered aggregate expense rather than a Part D result. model/plan.ts and params/types.ts have no accepted fields for uncovered months, a national base beneficiary premium, a PDP or MA-PD plan, drug claims, a covered insulin product, negotiated or maximum-fair prices, or incurred cost sharing; simulate.ts consequently cannot derive a late penalty, annual threshold, or product-level copayment. The annual-index formula cannot by itself establish the 2026 dollar amount without the missing annual percentage determination, while the 2026 insulin ceiling is fully stated in the enacted text.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 1395w-113(b)(3)(A)-(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395w-113&num=0&edition=prelim',
      quotedText:
        'The amount determined under this paragraph for a part D eligible individual for a continuous period of eligibility is the greater of- (i) an amount that the Secretary determines is actuarially sound for each uncovered month (as defined in subparagraph (B)) in the same continuous period of eligibility; or (ii) 1 percent of the base beneficiary premium (computed under paragraph (2) or (8) of subsection (a) (as applicable)) for each such uncovered month in such period.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395w-113(b)(3)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395w-113&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "uncovered month" means, with respect to a part D eligible individual, any month beginning after the end of the initial enrollment period under section 1395w-101(b)(2) of this title unless the individual can demonstrate that the individual had creditable prescription drug coverage (as defined in paragraph (4)) for any portion of such month.',
    }, {
      kind: 'statute',
      citation: 'P.L. 117-169, section 11201(a)(1)(A)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-117publ169/pdf/PLAW-117publ169.pdf',
      quotedText:
        'for a year preceding 2025 and for costs above the annual deductible specified in paragraph (1) and up to the annual out-of-pocket threshold specified in paragraph (4)(B) for 2025 and each subsequent year',
    }, {
      kind: 'statute',
      citation: 'P.L. 117-169, section 11201(a)(3)(B)(i)(III)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-117publ169/pdf/PLAW-117publ169.pdf',
      quotedText:
        '``(VII) for 2025, is equal to $2,000; or ``(VIII) for a subsequent year, is equal to the amount specified in this subparagraph for the previous year, increased by the annual percentage increase described in paragraph (6) for the year involved.\'\'',
    }, {
      kind: 'statute',
      citation: 'P.L. 117-169, section 11406(a), adding 1860D-2(b)(9)(B)(ii)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-117publ169/pdf/PLAW-117publ169.pdf',
      quotedText:
        'For a plan year beginning on or after January 1, 2025, the coverage provides benefits for any covered insulin product, prior to an individual reaching the out-of-pocket threshold under paragraph (4), with cost-sharing for a month\'s supply that does not exceed the applicable copayment amount.',
    }, {
      kind: 'statute',
      citation: 'P.L. 117-169, section 11406(a), adding 1860D-2(b)(9)(D)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-117publ169/pdf/PLAW-117publ169.pdf',
      quotedText:
        'In this paragraph, the term `applicable copayment amount\' means, with … respect to a covered insulin product under a prescription drug plan or an … plan dispensed-- ``(i) during plan years 2023, 2024, and 2025, $35; and ``(ii) during plan year 2026 and each subsequent plan year, the lesser of-- ``(I) $35; ``(II) an amount equal to 25 percent of the maximum fair price established for the covered insulin product in accordance with part E of title XI; or ``(III) an amount equal to 25 percent of the negotiated price of the covered insulin product under the prescription drug plan or …',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/types.ts',
      'packages/engine/src/projection/internal/annualHealthcareExpenses.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#healthcareConfigSchema',
      'packages/engine/src/params/types.ts#ParameterPack',
      'packages/engine/src/projection/internal/annualHealthcareExpenses.ts#annualHealthcareExpenses',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'usc-42-1395r-b-part-b-late-enrollment-penalty': {
    title: 'Part B late-enrollment premium increase is not modeled',
    statement:
      'When Part B coverage begins from an enrollment after the initial enrollment period and not from a qualifying special enrollment period, the monthly premium under subsection (a) (without IRMAA) is increased by 10 percent of that premium for each full 12 months in the same continuous period of eligibility in which the individual could have been but was not enrolled. The Plan and the Medicare premium path have no delayed-enrollment, uncovered-month, continuous-period, or late-enrollment-increase input, and medicare.ts / the parameter pack emit only the standard Part B premium scaled by IRMAA, so the engine produces no Part B late-enrollment penalty.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a delayed Part B enrollment and the enrollment period it fell in',
      'the uncovered months within a continuous period of eligibility',
      'a late-enrollment increase input on the Medicare premium path, which emits only the standard Part B premium scaled by IRMAA',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Absence surface is model/plan.ts, tax/medicare.ts, and the pack Medicare table: annualHealthcareExpenses starts Part B months from attained age 65 with no enrollment-election fact, and medicareAnnualPremiumPerPerson multiplies the pack standard premium by the IRMAA applicable-percentage scale only. A late-enrollee history is not expressible, so there is no mispriced penalty figure to approximate — only the absent increase.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 1395r(b)',
      url: 'https://www.law.cornell.edu/uscode/text/42/1395r',
      quotedText:
        'In the case of an individual whose coverage period began pursuant to an enrollment after his initial enrollment period (determined pursuant to subsection (c) or (d) of section 1395p of this title) and not pursuant to a special enrollment period under subsection (i)(4), (l), or (m) of section 1395p of this title, the monthly premium determined under subsection (a) (without regard to any adjustment under subsection (i)) shall be increased by 10 percent of the monthly premium so determined for each full 12 months (in the same continuous period of eligibility) in which he could have been but was not enrolled.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/tax/medicare.ts',
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/projection/internal/annualHealthcareExpenses.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#healthcareConfigSchema',
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/internal/annualHealthcareExpenses.ts#annualHealthcareExpenses',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/tax/medicare.ts#medicareAnnualPremiumPerPerson',
    ],
  },

  'usc-42-1395p-enrollment-periods': {
    title: 'Part B initial, general, and special enrollment periods are not modeled',
    statement:
      'Section 1395p fixes the initial enrollment period as the seven months centered on first eligibility, a general enrollment period from January 1 through March 31 each year, and special enrollment periods when group-health or other qualifying coverage ends. The Plan carries no enrollment-month, enrollment-period, deemed-enrollment, or coverage-period facts, so the engine produces no enrollment-timing result from those rules.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'the enrollment month and the enrollment period it belongs to',
      'deemed enrollment',
      'coverage-period facts, including the group-health coverage whose end opens a special enrollment period',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Absence surface is model/plan.ts and projection/internal/annualHealthcareExpenses.ts: healthcareConfigSchema and person demographics have no IEP/GEP/SEP election or enrollment month, and annualHealthcareExpenses derives Medicare months solely from attained age 65 (and birth month in the attainment year). This record is the enrollment-period umbrella; the separate Part B late-enrollment premium increase is registered at usc-42-1395r-b-part-b-late-enrollment-penalty.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 1395p(d)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395p&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who first satisfies paragraph (1) or (2) of section 1395o(a) of this title on or after March 1, 1966, his initial enrollment period shall begin on the first day of the third month before the month in which he first satisfies such paragraphs and shall end seven months later.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395p(e)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395p&num=0&edition=prelim',
      quotedText:
        'There shall be a general enrollment period during the period beginning on January 1 and ending on March 31 of each year.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395p(i)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395p&num=0&edition=prelim',
      quotedText:
        'The special enrollment period referred to in the first sentences of paragraphs (1) and (2) is the period including each month during any part of which the individual is enrolled in a group health plan described in section 1395y(b)(1)(A)(v) of this title by reason of current employment status ending with the last day of the eighth consecutive month in which the individual is at no time so enrolled.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/internal/annualHealthcareExpenses.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#healthcareConfigSchema',
      'packages/engine/src/projection/internal/annualHealthcareExpenses.ts#annualHealthcareExpenses',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'cfr-20-418-1205-1230-irmaa-life-change-redetermination': {
    title: 'IRMAA life-changing-event evidence and redetermination request is not modeled',
    statement:
      'The regulation recognizes a spouse\'s death, marriage, divorce or annulment, work stoppage or reduction, loss of qualifying income-producing property, an employer pension cessation/termination/reorganization, and an employer settlement as major life-changing events. It makes an initial determination based on a more recent tax year effective when modified adjusted gross income is significantly reduced as a result of one of those events; POMS lists eight leaves by naming work reduction and work stoppage separately. The staged regulation and POMS index do not define “significantly reduced” as a named IRMAA-tier crossing, so the registry does not assert that extra condition. The engine already has a planning-grade SSA-44 election surface — healthcareConfigSchema.ssa44 (survivorYears / retirementYears) and annualHealthcareExpenses\' min(year-2, year-1) lookback for the two premium years after a qualifying event, named on usc-42-1395r-i-4-b-two-year-magi-lookback. What this record registers as absent is only the 20 CFR 418.1205 / 418.1230 evidence-and-redetermination-request surface: the full qualifying-event category set, documentation, and a redetermination request that SSA adjudicates under 418.1230(a).',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'the full qualifying-event category set: healthcareConfigSchema.ssa44 carries only survivorYears and retirementYears',
      'the documentation the regulation requires for a qualifying event',
      'a redetermination request for SSA to adjudicate under 418.1230(a)',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Keep outOfScope because the remaining claim is genuinely an absent administrative redetermination-request surface, not a mispriced MAGI. The planning toggles and min lookback are accepted Plan/annualHealthcareExpenses behavior already disclosed on the sibling lookback record; model/plan.ts and annualHealthcareExpenses.ts still have no fields or results for event-category evidence, supporting documentation, or a filed redetermination request under 418.1230. This record deliberately does not re-settle the SSA-44 lookback math.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 418.1205',
      url: 'https://www.ecfr.gov/current/title-20/section-418.1205',
      quotedText:
        'For the purposes of this subpart, we will consider the following to be major life-changing events: (a) Your spouse dies; (b) You marry; (c) Your marriage ends through divorce or annulment; (d) You or your spouse stop working or reduce the hours you work; (e) You or your spouse experiences a loss of income-producing property, provided the loss is not at the direction of you or your spouse (e.g., due to the sale or transfer of the property) and is not a result of the ordinary risk of investment. Examples of the type of property loss include, but are not limited to: Loss of real property within a Presidentially or Gubernatorially-declared disaster area, destruction of livestock or crops by natural disaster or disease, loss from real property due to arson, or loss of investment property as a result of fraud or theft due to a criminal act by a third party; (f) You or your spouse experiences a scheduled cessation, termination, or reorganization of an employer\'s pension plan; (g) You or your spouse receives a settlement from an employer or former employer because of the employer\'s closure, bankruptcy, or reorganization.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 418.1230(a)',
      url: 'https://www.ecfr.gov/current/title-20/section-418.1230',
      quotedText:
        'Subject to paragraph (b) of this section, when your modified adjusted gross income for the more recent tax year is significantly reduced as a result of a major life-changing event, our initial determination is generally effective on January 1 of the year in which you make your request. If your first month of enrollment or reenrollment in Medicare Part B is after January of the year for which you make your request, our initial determination is effective on the first day of your Medicare Part B enrollment or reenrollment.',
    }, {
      kind: 'agencyGuidance',
      citation: 'POMS HI 01120.000, New Initial Determinations Using Beneficiary Information, table of contents',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0601120000',
      quotedText:
        'HI 01120.010 Life Changing Event (LCE) – Death of Spouse TN 3 02-09 HI 01120.015 Life Changing Event (LCE) – Marriage TN 3 02-09 HI 01120.020 Life Changing Event (LCE) – Divorce or Annulment TN 3 02-09 HI 01120.025 Life Changing Event (LCE) – Work Reduction TN 16 10-23 HI 01120.030 Life Changing Event (LCE) – Work Stoppage TN 25 01-25 HI 01120.035 Life Changing Event (LCE) – Loss of Income-Producing Property TN 24 06-24 HI 01120.040 Life Changing Event (LCE) – Reduction or Loss of Pension Income TN 21 06-24 HI 01120.043 Life Changing Event (LCE) – Employer Settlement Payment TN 23 06-24',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/tax/medicare.ts',
      'packages/engine/src/projection/internal/annualHealthcareExpenses.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#healthcareConfigSchema',
      'packages/engine/src/projection/internal/annualHealthcareExpenses.ts#annualHealthcareExpenses',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/tax/medicare.ts#medicareAnnualPremiumPerPerson',
    ],
  },

  'usc-42-1395r-i-irmaa-applicable-percentage': {
    title: 'IRMAA raises the beneficiary share of cost from 25 percent',
    statement:
      'The standard Part B premium covers 25 percent of program cost. A high-income beneficiary pays 35, 50, 65, 80 or 85 percent of that cost instead, so the premium is the standard one scaled by the applicable percentage over 25 rather than the standard one plus that percentage. Income is taken from the second calendar year preceding the premium year.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The statute expresses the result as an adjustment amount, the applicable percentage minus 25 percentage points; the engine computes the whole premium as the standard one times the applicable percentage over 25. Those are the same quantity written from different ends, which is why no explicit 25-point subtraction appears in the code.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(3)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/42/1395r',
      quotedText:
        'the monthly adjustment amount specified in this paragraph for an individual for a month in a year is equal to the product of the following: (i) Sliding scale percentage Subject to paragraph (6), the applicable percentage specified in the applicable table in subparagraph (C) for the individual minus 25 percentage points.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(4)',
      url: 'https://www.law.cornell.edu/uscode/text/42/1395r',
      quotedText:
        'the individual\u2019s modified adjusted gross income shall be such income determined for the individual\u2019s last taxable year beginning in the second calendar year preceding the year involved.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/medicare.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/medicare.ts#medicareAnnualPremiumPerPerson',
    ],
  },

  'usc-42-1395r-i-4-b-two-year-magi-lookback': {
    title: 'IRMAA uses modified AGI from the second preceding tax year',
    statement:
      'For an individual’s premiums in a month of a calendar year, subject to clause (ii) and subparagraph (C), IRMAA uses modified adjusted gross income from the last taxable year beginning in the second calendar year preceding the year involved. Under that default lookback an income spike therefore changes the premium two years later, not in the spike year itself.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The quoted text is expressly subject to clause (ii) and subparagraph (C). The engine’s opt-in SSA-44 path (`expenses.healthcare.ssa44`) can select the more-recent year−1 MAGI after a qualifying event, but that (C) exception surface is a queued residual with no registry record of its own rather than a claim settled here.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(4)(B)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/42/1395r',
      quotedText:
        'In applying this subsection for an individual’s premiums in a month in a year, subject to clause (ii) and subparagraph (C), the individual’s modified adjusted gross income shall be such income determined for the individual’s last taxable year beginning in the second calendar year preceding the year involved.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/internal/annualHealthcareExpenses.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualHealthcareExpenses.ts#annualHealthcareExpenses',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'usc-42-1395r-i-4-a-magi-agi-plus-tax-exempt-interest': {
    title: 'IRMAA MAGI tax-exempt-interest addback',
    statement:
      'For IRMAA, modified adjusted gross income means adjusted gross income as defined in section 62, increased by interest received or accrued during the taxable year that is exempt from tax. Municipal-bond interest can therefore raise the IRMAA income figure without entering federal AGI. The independent (A)(i) without-regard addback for sections 135, 911, 931, and 933 is registered separately at usc-42-1395r-i-4-a-i-irmaa-magi-foreign-exclusion-addback.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(4)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/42/1395r',
      quotedText:
        'For purposes of this subsection, the term “modified adjusted gross income” means adjusted gross income (as defined in section 62 of the Internal Revenue Code of 1986)—',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(4)(A)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/42/1395r',
      quotedText:
        'increased by the amount of interest received or accrued during the taxable year which is exempt from tax under such Code.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#annualFundingApplicationAndClosePhase',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'usc-42-1395r-i-4-a-i-irmaa-magi-foreign-exclusion-addback': {
    title: 'IRMAA MAGI without-regard addback is omitted from the lookback feed',
    statement:
      'Clause (A)(i) requires IRMAA modified adjusted gross income to be determined without regard to sections 135, 911, 931, and 933, so amounts excluded under those sections are added back for the IRMAA income figure. Not modelled in the IRMAA feed: annualFundingApplicationAndClosePhase commits the accepted year’s magiHistory entry from the AGI-path income plus tax-exempt interest only, while the same year’s foreign-exclusion addback that raises ACA household MAGI and section 86 provisional income never enters that history. simulatePlan owns and threads that longitudinal history into later IRMAA lookbacks. Omitting the addback understates IRMAA MAGI and therefore understates the Medicare premium surcharge relative to the statute.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'Matches the shipped usc-42-1395r-* premium-direction pattern: understatesTax names fisc exposure that includes the Medicare premium surcharge (the type’s fisc referent already spans that channel; the statement’s premium understatement is the same sign).',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(4)(A)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/42/1395r',
      quotedText:
        'determined without regard to sections 135, 911, 931, and 933 of such Code, and',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#annualFundingApplicationAndClosePhase',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-36B-c-1-A-applicable-taxpayer-range': {
    title: 'The premium credit band includes both 100 and 400 percent',
    statement:
      'An applicable taxpayer is one whose household income equals or exceeds 100 percent of the federal poverty line and does not exceed 400 percent of it. Both ends are inclusive, so a household sitting exactly on 400 percent is still eligible and the cliff falls on the first dollar past it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The enhanced credits that suspended the 400 percent ceiling expired at the end of 2025, so the cliff is live again for 2026. The engine also treats the below-100-percent exception pathways as out of scope rather than modelling them, which is why the floor is a hard cutoff here.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 36B(c)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section36B&num=0&edition=prelim',
      quotedText:
        'The term "applicable taxpayer" means, with respect to any taxable year, a taxpayer whose household income for the taxable year equals or exceeds 100 percent but does not exceed 400 percent of an amount equal to the poverty line for a family of the size involved.',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/tax/aca.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/aca.ts#acaEconomicPremiumByMonth',
    ],
  },

  'irc-36B-d-2-B-aca-household-magi-composition': {
    title: 'What enters ACA household modified adjusted gross income',
    statement:
      'For the premium tax credit, household income sums modified adjusted gross income over the taxpayer and the dependents required to file, where modified AGI is AGI increased by amounts excluded under section 911, tax-exempt interest received or accrued, and the portion of Social Security benefits not included in gross income under section 86. Tax-exempt interest therefore raises ACA household MAGI without ever entering AGI or ordinary taxable income.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 36B(d)(2)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section36B&num=0&edition=prelim',
      quotedText:
        'The term "modified adjusted gross income" means adjusted gross income increased by- (i) any amount excluded from gross income under section 911, (ii) any amount of interest received or accrued by the taxpayer during the taxable year which is exempt from tax, and (iii) an amount equal to the portion of the taxpayer\'s social security benefits (as defined in section 86(d)) which is not included in gross income under section 86 for the taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: ['packages/engine/src/tax/aca.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/aca.ts#buildAcaHouseholdMagi',
    ],
  },
  'irc-213-a-medical-expense-deduction': {
    title: 'Medical expense deduction above 7.5 percent of AGI',
    statement:
      'Unreimbursed expenses for medical care of the taxpayer, a spouse, or a dependent are deductible to the extent they exceed 7.5 percent of adjusted gross income, and they are not a miscellaneous itemized deduction, so 67(h) does not disallow them. Amounts paid for medicine or a drug are taken into account under 213(a) only if the medicine or drug is a prescribed drug or insulin; medical care does not include cosmetic surgery or similar procedures except to ameliorate a congenital abnormality, a personal injury from accident or trauma, or disfiguring disease; and only eligible long-term care premiums, limited by the attained-age table in 213(d)(10) as restated each year, are taken into account as medical care. Not modelled: TaxYearInput and itemizedTotal have no medical field, so none of those limbs has a figure to apply to. Plan healthcare premiums, net care costs, and kind-ltc insurance premiums are spending, not itemized medical, and never enter the deduction. A household with large unreimbursed qualifying medical costs has its itemized total understated by the full deductible amount and its tax overstated, which for a retiree in long-term care can be tens of thousands of dollars of deduction at a marginal rate of 22 to 32 percent.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'This is the highest-value omission in the itemized set for this engine audience, because the deduction is largest exactly when income is drawn down to pay care costs. It also interacts with the itemize election: a year of heavy medical spending can flip a household from the standard deduction to itemizing, which the engine cannot see, so the error is not confined to households that already itemize. IRC 213(b), 213(d)(9), and 213(d)(10) are folded onto this record as input-granularity, not separate approximations: there is no drug, cosmetic, or LTC-premium tax input on which those filters could run. Omitting the whole deduction overstates tax whenever any qualifying medical remains after those filters; the filters never reverse the sign, because they only reduce the statutory deduction toward the engine\'s zero. The produced pin is the existing describeRule fixture (statute 124,000 versus engineOmitsMedicalEntirely 59,000). The annually restated 2026 attained-age caps live on the companion record irc-213-d-10-eligible-ltc-premium-caps-2026.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 213(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section213&num=0&edition=prelim',
      quotedText:
        'There shall be allowed as a deduction the expenses paid during the taxable year, not compensated for by insurance or otherwise, for medical care of the taxpayer, his spouse, or a dependent (as defined in section 152, determined without regard to subsections (b)(1), (b)(2), and (d)(1)(B) thereof), to the extent that such expenses exceed 7.5 percent of adjusted gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 67(b)(5)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section67&num=0&edition=prelim',
      quotedText: 'the deduction under section 213 (relating to medical, dental, etc., expenses),',
    }, {
      kind: 'statute',
      citation: 'IRC 213(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section213&num=0&edition=prelim',
      quotedText:
        'An amount paid during the taxable year for medicine or a drug shall be taken into account under subsection (a) only if such medicine or drug is a prescribed drug or is insulin.',
    }, {
      kind: 'statute',
      citation: 'IRC 213(d)(9)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section213&num=0&edition=prelim',
      quotedText:
        'The term "medical care" does not include cosmetic surgery or other similar procedures, unless the surgery or procedure is necessary to ameliorate a deformity arising from, or directly related to, a congenital abnormality, a personal injury resulting from an accident or trauma, or disfiguring disease.',
    }, {
      kind: 'statute',
      citation: 'IRC 213(d)(1), flush',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section213&num=0&edition=prelim',
      quotedText:
        'In the case of a qualified long-term care insurance contract (as defined in section 7702B(b)), only eligible long-term care premiums (as defined in paragraph (10)) shall be taken into account under subparagraph (D).',
    }, {
      kind: 'statute',
      citation: 'IRC 213(d)(10)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section213&num=0&edition=prelim',
      quotedText:
        'For purposes of this section, the term "eligible long-term care premiums" means the amount paid during a taxable year for any qualified long-term care insurance contract (as defined in section 7702B(b)) covering an individual, to the extent such amount does not exceed the limitation determined under the following table: In the case of an individual with an attained age before the close of the taxable year of: The limitation is:',
    }, {
      kind: 'statute',
      citation: 'IRC 213(d)(10)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section213&num=0&edition=prelim',
      quotedText:
        'In the case of any taxable year beginning in a calendar year after 1997, each dollar amount contained in subparagraph (A) shall be increased by the medical care cost adjustment of such amount for such calendar year. If any increase determined under the preceding sentence is not a multiple of $10, such increase shall be rounded to the nearest multiple of $10.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#itemizedDeductionsSchema',
      'packages/engine/src/tax/federalTax.ts#itemizedTotal',
    ],
  },

  'irc-213-d-10-eligible-ltc-premium-caps-2026': {
    title: '2026 eligible long-term care premium attained-age caps',
    statement:
      'For taxable years beginning in 2026, Rev. Proc. 2025-32 section 4.27 restates the section 213(d)(10) attained-age limitations on eligible long-term care premiums includible as medical care. The engine has no LTC-premium tax input, so those caps never run; they remain disclosed here on the annually indexed cadence.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'an eligible long-term-care premium line on itemizedDeductionsSchema for the attained-age caps to limit',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The 2026 attained-age caps ($500 / $930 / $1,860 / $4,960 / $6,200) are read from the revenue procedure’s table rather than rewritten into quotedText. The quotation carries the introducing sentence; the table rows are not linearized into prose. Companion to irc-213-a-medical-expense-deduction, which folds the missing medical-input filter without publishing these dollars on a staticStatute record.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-32, section 4.27',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
      quotedText:
        'For taxable years beginning in 2026, the limitations under § 213(d)(10), regarding eligible long-term care premiums includible in the term "medical care" are as follows:',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#itemizedDeductionsSchema',
      'packages/engine/src/tax/federalTax.ts#itemizedTotal',
    ],
  },

  // --- Registered 2026-08-27: WS4c Cluster 4 (162(l), 199A) -----------------

  'irc-162-l-1-self-employed-health-insurance-not-modeled': {
    title: 'Self-employed health insurance is not an above-the-line deduction surface',
    statement:
      'A taxpayer who is an employee within the meaning of section 401(c)(1) may deduct amounts paid during the year for insurance that constitutes medical care for the taxpayer, a spouse, dependents, and children who have not attained age 27, limited to earned income from the trade or business with respect to which the coverage is established. Not modelled: the income model has wages, Social Security, and unlabeled recurring or one-time streams, but no self-employment, 401(c)(1) employee, or earned-income-from-a-trade-or-business fact, and federal tax has no above-the-line self-employed health-insurance line. The ACA year-contract assertion selfEmployedHealthInsuranceDeduction is a typed refusal for premium-tax-credit MAGI (notApplicable or unsupported); unsupported fails that credit closed and never computes a 162(l) figure. No accepted input reaches this deduction.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 162(l)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section162&num=0&edition=prelim',
      quotedText:
        'In the case of a taxpayer who is an employee within the meaning of section 401(c)(1), there shall be allowed as a deduction under this section an amount equal to the amount paid during the taxable year for insurance which constitutes medical care for- (A) the taxpayer, (B) the taxpayer\'s spouse, (C) the taxpayer\'s dependents, and (D) any child (as defined in section 152(f)(1)) of the taxpayer who as of the end of the taxable year has not attained age 27.',
    }, {
      kind: 'statute',
      citation: 'IRC 162(l)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section162&num=0&edition=prelim',
      quotedText:
        'No deduction shall be allowed under paragraph (1) to the extent that the amount of such deduction exceeds the taxpayer\'s earned income (within the meaning of section 401(c)) derived by the taxpayer from the trade or business with respect to which the plan providing the medical care coverage is established.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#acaYearContractSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'usc-42-1395r-i-5-C-top-irmaa-threshold-frozen': {
    title: 'The top IRMAA threshold is frozen through 2027, then indexed off a later base',
    statement:
      'Every IRMAA dollar threshold is indexed under 42 USC 1395r(i)(5)(A) to consumer prices measured against an August 2006 base and rounded to the nearest 1,000, but that subparagraph is expressly subject to (i)(5)(C), which treats the 500,000 amounts twice. Subparagraph (i)(5)(C)(i) removes them from the (i)(5)(A) adjustment outright. Subparagraph (i)(5)(C)(ii) brings them back for calendar years after 2027, measured against August 2026 rather than August 2006. Because both provisions read the August of the preceding calendar year, an August 2026 base is exactly one year behind the general one, so from 2028 the top row grows at the same rate as the rows beneath it but from a position one year further back. The carve-out reaches only the 500,000 amounts, not paragraph (3) at large, so the four lower rows never pause. The joint figure follows from (i)(3)(C)(ii), which sets the last row at 150 percent of the individual amount rather than twice it, which is why the pack carries 500,000 and 750,000 where every lower row is an exact double. CMS says the same in its own words when it promulgates the table: the top threshold levels are to be inflation-adjusted beginning in 2028, which is why that row has stood at 500,000 and 750,000 since it was created for 2019 while every row beneath it rose each year. Both errors bite on a long horizon. Scaling all five boundaries by one factor sweeps into the top tier a household whose income never reached it; freezing the top boundary forever does the same thing more slowly and never stops, because a nominal projection keeps rising past a threshold the statute does allow to move again.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Three things are decided here rather than dictated. First, the index: the resumed adjustment is measured on the plan assumed general inflation rather than the consumer price index the statute names, which is the same stand-in the lower rows already take, and the pack year of 2026 is what makes the general inflation series readable at the August 2026 base period without an offset. Second, the rounding: (i)(5)(B) rounds a dollar amount increased under subparagraph (C) to the nearest 1,000, and that is reproduced for the top row. The identical rounding (i)(5)(B) applies to the (i)(5)(A) adjustment of the four lower rows is not reproduced, which is pre-existing behaviour and is named here rather than left as a silent asymmetry between two branches of one function. Third, the Federal Register determination that publishes the table is registered under the regulation authority kind. It is neither a statute nor an IRS notice, and the enum has no member for an agency determination published in the Federal Register; introducing one is a schema decision rather than a research finding, so the nearest existing member is used and the choice is named rather than left silent.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 USC 1395r(i)(5)(A), (i)(5)(B), (i)(5)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395r&num=0&edition=prelim',
      quotedText:
        'Subject to subparagraph (C), in the case of any calendar year beginning after 2007 (other than 2018 and 2019), each dollar amount in paragraph (2) or (3) shall be increased by an amount equal to- (i) such dollar amount, multiplied by (ii) the percentage (if any) by which the average of the Consumer Price Index for all urban consumers (United States city average) for the 12-month period ending with August of the preceding calendar year exceeds such average for the 12-month period ending with August 2006 (or, in the case of a calendar year beginning with 2020, August 2018). (B) Rounding If any dollar amount after being increased under subparagraph (A) or (C) is not a multiple of $1,000, such dollar amount shall be rounded to the nearest multiple of $1,000. (C) Treatment of adjustments for certain higher income individuals (i) In general Subparagraph (A) shall not apply with respect to each dollar amount in paragraph (3) of $500,000. (ii) Adjustment beginning 2028 In the case of any calendar year beginning after 2027, each dollar amount in paragraph (3) of $500,000 shall be increased by an amount equal to- (I) such dollar amount, multiplied by (II) the percentage (if any) by which the average of the Consumer Price Index for all urban consumers (United States city average) for the 12-month period ending with August of the preceding calendar year exceeds such average for the 12-month period ending with August 2026.',
    }, {
      kind: 'statute',
      citation: '42 USC 1395r(i)(3)(C)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395r&num=0&edition=prelim',
      quotedText:
        'In the case of a joint return, clause (i) shall be applied by substituting dollar amounts which are twice the dollar amounts otherwise applicable under clause (i) for the calendar year except, with respect to the dollar amounts applied in the last row of the table under subclause (III) of such clause (and the second dollar amount specified in the second to last row of such table), clause (i) shall be applied by substituting dollar amounts which are 150 percent of such dollar amounts for the calendar year.',
    }, {
      kind: 'regulation',
      citation: 'CMS, Medicare Part B Monthly Actuarial Rates, Premium Rates, and Annual Deductible Beginning January 1, 2026, 90 FR 52063 (Nov. 19, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-19/html/2025-20251.htm',
      quotedText:
        'For years beginning in 2019, the BBA of 2018 established a new income threshold. If a beneficiary\'s modified adjusted gross income is greater than or equal to $500,000 for a beneficiary filing an individual income tax return and $750,000 for a beneficiary filing a joint tax return, the beneficiary is responsible for 85 percent of the estimated total cost of Part B coverage. The BBA of 2018 specified that these new income threshold levels be inflation-adjusted beginning in 2028.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2019,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/index.ts',
      'packages/engine/src/tax/medicare.ts',
      'packages/engine/src/insights/detectors/irmaaTierEdge.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/insights/detectors/irmaaTierEdge.ts#irmaaTierEdge',
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/params/index.ts#IRMAA_TOP_TIER_FROZEN_THROUGH_YEAR',
      'packages/engine/src/params/index.ts#irmaaTierThreshold',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/tax/medicare.ts#medicareAnnualPremiumPerPerson',
    ],
  },
  'usc-42-1395r-a-3-part-b-standard-premium': {
    title: 'The standard Part B premium is half the aged actuarial rate plus a repayment amount',
    statement:
      'The Secretary determines the monthly actuarial rate for enrollees age 65 and over each September as the amount needed for those enrollees to fund one half of the benefits and administrative costs attributable to them, and then promulgates a standard monthly premium equal to 50 percent of that rate, which is why the standard premium is described as roughly 25 percent of program cost. For 2026 the aged actuarial rate is 405.40 and the promulgated standard premium is 202.90, which is 50 percent of the rate plus a 0.20 repayment amount required under current law. The premium is re-determined every year against projected program cost and tracks no published price index, so a projected year needs a medical cost path rather than general inflation, and the promulgated figure must be read rather than re-derived: halving the actuarial rate alone loses the repayment amount.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The repayment amount rides on the standard premium but is not part of the income-related scaling, so deriving a tier premium as the standard premium times the applicable percentage over 25 reproduces the promulgated table only to within a few cents. That residual is accepted as planning-grade rather than carrying a separate per-tier premium table. The Federal Register determination is registered under the regulation authority kind because the enum has no member for an agency determination published in the Federal Register, and adding one is a schema decision rather than a research finding; the choice is named here rather than left silent.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 USC 1395r(a)(1), (a)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395r&num=0&edition=prelim',
      quotedText:
        'The Secretary shall, during September of 1983 and of each year thereafter, determine the monthly actuarial rate for enrollees age 65 and over which shall be applicable for the succeeding calendar year. Subject to paragraphs (5), (6), and (7), such actuarial rate shall be the amount the Secretary estimates to be necessary so that the aggregate amount for such calendar year with respect to those enrollees age 65 and older will equal one-half of the total of the benefits and administrative costs which he estimates will be payable from the Federal Supplementary Medical Insurance Trust Fund for services performed and related administrative costs incurred in such calendar year with respect to such enrollees ... The Secretary, during September of each year, shall determine and promulgate a monthly premium rate for the succeeding calendar year that (except as provided in subsection (g)) is equal to 50 percent of the monthly actuarial rate for enrollees age 65 and over, determined according to paragraph (1), for that succeeding calendar year.',
    }, {
      kind: 'regulation',
      citation: 'CMS, Medicare Part B Monthly Actuarial Rates, Premium Rates, and Annual Deductible Beginning January 1, 2026, 90 FR 52063 (Nov. 19, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-19/html/2025-20251.htm',
      quotedText:
        'The monthly actuarial rates for 2026 are $405.40 for aged enrollees and $548.60 for disabled enrollees. The standard monthly Part B premium rate for all enrollees for 2026 is $202.90, which is equal to 50 percent of the monthly actuarial rate for aged enrollees (or approximately 25 percent of the expected average total cost of Part B coverage for aged enrollees) plus the $0.20 repayment amount required under current law.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/params/index.ts',
      'packages/engine/src/tax/medicare.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/params/index.ts#partBMonthlyPremium',
      'packages/engine/src/tax/medicare.ts#medicareAnnualPremiumPerPerson',
    ],
  },

  'usc-42-1395r-i-5-optimizer-uniform-threshold-indexing': {
    title: 'The optimizer uniformly scales every IRMAA MAGI threshold, including the frozen top row',
    statement:
      '1839(i)(5)(A) indexes the IRMAA dollar amounts subject to (C): (C)(i) keeps each $500,000 amount out of that adjustment through 2027, (C)(ii) indexes those amounts only after 2027 from the August 2026 base, and (B) rounds an amount increased under (A) or (C) to the nearest $1,000. 1860D-13(a)(7)(A) and (B)(i)(I) apply the same paragraph (5) amounts to the Part D adjustment. The optimizer instead multiplies every pack MAGI floor, including the $500,000 row, by the premium year\'s inflationScale, so the local LP combined Part B and Part D surcharge at held planning prices understates when MAGI is above the statutory top and below the uniformly scaled top, and overstates when MAGI is above a scaled-down top the freeze still holds.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The LP carries one inflationScale per premium year and has no separate top-row path. The exact-ledger helper already implements the freeze and the one-year-earlier resumed base (usc-42-1395r-i-5-C-top-irmaa-threshold-frozen); this record pins only buildOptimizerModel\'s uniform multiply and does not add a formula to that helper. The fixture holds 2026 pack prices and compares local LP surcharge cost, not recommendation quality, a complete household premium, or a promulgated future table.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(5)(A)',
      url: 'https://www.ssa.gov/OP_Home/ssact/title18/1839.htm',
      quotedText:
        'Subject to subparagraph (C), in the case of any calendar year beginning after 2007 (other than 2018 and 2019), each dollar amount in paragraph (2) or (3) shall be increased by an amount equal to',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(5)(B)',
      url: 'https://www.ssa.gov/OP_Home/ssact/title18/1839.htm',
      quotedText:
        'If any dollar amount after being increased under subparagraph (A) or (C) is not a multiple of $1,000, such dollar amount shall be rounded to the nearest multiple of $1,000.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(5)(C)(i)',
      url: 'https://www.ssa.gov/OP_Home/ssact/title18/1839.htm',
      quotedText:
        'Subparagraph (A) shall not apply with respect to each dollar amount in paragraph (3) of $500,000.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(5)(C)(ii)',
      url: 'https://www.ssa.gov/OP_Home/ssact/title18/1839.htm',
      quotedText:
        'In the case of any calendar year beginning after 2027, each dollar amount in paragraph (3) of $500,000 shall be increased by an amount equal to- (I) such dollar amount, multiplied by (II) the percentage (if any) by which the average of the Consumer Price Index for all urban consumers (United States city average) for the 12- month period ending with August of the preceding calendar year exceeds such average for the 12- month period ending with August 2026.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395w-113(a)(7)(A)',
      url: 'https://www.ssa.gov/OP_Home/ssact/title18/1860D-13.htm',
      quotedText:
        'In the case of an individual whose modified adjusted gross income exceeds the threshold amount applicable under paragraph (2) of section 1839(i) (including application of paragraph (5) of such section) for the calendar year, the monthly amount of the beneficiary premium applicable under this section for a month after December 2010 shall be increased by the monthly adjustment amount specified in subparagraph (B).',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395w-113(a)(7)(B)(i)(I)',
      url: 'https://www.ssa.gov/OP_Home/ssact/title18/1860D-13.htm',
      quotedText:
        'the applicable percentage determined under paragraph (3)(C) of section 1839(i) (including application of paragraph (5) of such section) for the individual for the calendar year reduced by 25.5 percent',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-05',
    implementedBy: ['packages/engine/src/strategies/optimizer.ts'],
    implementedByFunctions: [
      'packages/engine/src/strategies/optimizer.ts#buildOptimizerModel',
    ],
  },

  'usc-42-1395r-i-3-1395w-113-a-7-optimizer-beneficiary-month-exposure': {
    title: 'The optimizer prices IRMAA as one full-year household coefficient, not per enrolled individual-month',
    statement:
      '1839(a)(2) prices the monthly premium of each individual enrolled for each month; 1839(i)(3)(A) sets the income-related adjustment for an individual for a month; 1860D-13(a)(7)(A) and (B) raise that individual\'s monthly Part D beneficiary premium by an individual-for-a-month amount. The optimizer annualizes one household coefficient of 12 months of the pack\'s combined Part B increment and Part D surcharge and applies that same coefficient in the premium year and in the lifetimeTax readout, so a MAGI trip is always priced as 12 beneficiary-months at held planning prices. It has no beneficiary-month input; peopleAged65Plus sizes the age-65 deduction, not IRMAA exposure. Relative to stipulated Part B and Part D months the local LP surcharge therefore overstates a year with no enrollee or a mid-year start and understates a two-enrollee year.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'irmaaIncrements builds one 12-month combined increment from the pack standard Part B premium scaled by the applicable-percentage step plus the Part D monthly surcharge. That planning first-tier combined $95.66 (202.90 × (35 − 25) / 25 + 14.50) is the 4¢-under CMS published $95.70 residual already named on usc-42-1395r-a-3-part-b-standard-premium; this record preserves it and does not change prices. buildOptimizerModel applies that coefficient once per premium year; irmaaSurchargeFor reads the same sum into lifetimeTax. Holding the price isolates the month-count omission from premium-table rounding. The stipulated month counts are fixture metadata the engine cannot express. Referent is local LP surcharge cost, not recommendation quality or a complete household premium. Age 65 is not asserted as legal enrollment.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 1395r(a)(2)',
      url: 'https://www.ssa.gov/OP_Home/ssact/title18/1839.htm',
      quotedText:
        'The monthly premium of each individual enrolled under this part for each month after December 1983 shall be the amount determined under paragraph (3). adjusted as required in accordance with subsections (b), (c), (f), and (i) of this section, and to reflect any credit provided under section 1854(b)(1)(C)(ii)(III).',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(3)(A)',
      url: 'https://www.ssa.gov/OP_Home/ssact/title18/1839.htm',
      quotedText:
        'Subject to subparagraph (B), the monthly adjustment amount specified in this paragraph for an individual for a month in a year is equal to the product of the following',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395w-113(a)(7)(A)',
      url: 'https://www.ssa.gov/OP_Home/ssact/title18/1860D-13.htm',
      quotedText:
        'In the case of an individual whose modified adjusted gross income exceeds the threshold amount applicable under paragraph (2) of section 1839(i) (including application of paragraph (5) of such section) for the calendar year, the monthly amount of the beneficiary premium applicable under this section for a month after December 2010 shall be increased by the monthly adjustment amount specified in subparagraph (B).',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395w-113(a)(7)(B)',
      url: 'https://www.ssa.gov/OP_Home/ssact/title18/1860D-13.htm',
      quotedText:
        'The monthly adjustment amount specified in this subparagraph for an individual for a month in a year is equal to the product of',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-05',
    implementedBy: ['packages/engine/src/strategies/optimizer.ts'],
    implementedByFunctions: [
      'packages/engine/src/strategies/optimizer.ts#irmaaIncrements',
      'packages/engine/src/strategies/optimizer.ts#buildOptimizerModel',
      'packages/engine/src/strategies/optimizer.ts#irmaaSurchargeFor',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

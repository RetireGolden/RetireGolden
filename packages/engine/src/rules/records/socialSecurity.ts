/**
 * Social Security records: the PIA formula and its adjustments, the claiming ages and
 * deemed filing, the spousal, survivor and disability benefit families, the earnings
 * test, the contribution and benefit base, and the taxation of benefits under
 * section 86.
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
export const socialSecurityRecords = {
  'irc-86-a-taxable-social-security-two-tier': {
    title: 'Social Security inclusion is two tiers with a capped carry',
    statement:
      'Below the base amount no benefit is included. Between the base and adjusted base amounts the inclusion is the lesser of half the benefits or half the excess over the base. Above the adjusted base amount it is the lesser of 85 percent of the benefits or 85 percent of the excess over the adjusted base plus the tier-one amount, and that carried tier-one amount is itself capped.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The statute caps the carried amount at 4,500 dollars single and 6,000 joint. The engine computes half the spread between the base and adjusted base amounts instead, which equals those figures exactly -- 0.5 x (34,000 - 25,000) and 0.5 x (44,000 - 32,000) -- so the cap stays correct if the thresholds are ever re-indexed, rather than drifting from two hard-coded constants.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 86(a)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/86',
      quotedText:
        'the amount included in gross income under this section shall be equal to the lesser of - (A) the sum of - (i) 85 percent of such excess, plus (ii) the lesser of the amount determined under paragraph (1) or an amount equal to one-half of the difference between the adjusted base amount and the base amount of the taxpayer, or (B) 85 percent of the social security benefits received during the taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 86(b)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/86',
      quotedText:
        'adjusted gross income - (A) determined without regard to this section and sections 85(c), 135, 137, 221, 911, 931, and 933, and (B) increased by the amount of interest received or accrued by the taxpayer during the taxable year which is exempt from tax.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#taxableSocialSecurity',
    ],
  },

  'usc-42-415-a-1-pia-bend-point-formula': {
    title: 'The PIA formula is marginal across two bend points',
    statement:
      'The primary insurance amount is 90 percent of average indexed monthly earnings up to the first bend point, plus 32 percent of the part between the first and second, plus 15 percent of the part above the second, rounded down to the nearest 10 cents. Each rate reaches only the earnings inside its own band.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The bend points are not fixed dollar figures. Section 415(a)(1)(B) sets them at 180 and 1,085 dollars for 1979 eligibility and re-derives them for every later year from the ratio of the national average wage index two years prior to the 1977 index, which is why the engine carries a table by eligibility year rather than a constant.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 415(a)(1)(A), (a)(1)(A)(i)-(iii)',
      url: 'https://www.law.cornell.edu/uscode/text/42/415',
      quotedText:
        'The primary insurance amount of an individual shall (except as otherwise provided in this section) be equal to the sum of\u2014 (i) 90 percent of the individual\u2019s average indexed monthly earnings (determined under subsection (b)) to the extent that such earnings do not exceed the amount established for purposes of this clause by subparagraph (B), (ii) 32 percent of the individual\u2019s average indexed monthly earnings to the extent that such earnings exceed the amount established for purposes of clause (i) but do not exceed the amount established for purposes of this clause by subparagraph (B), and (iii) 15 percent of the individual\u2019s average indexed monthly earnings to the extent that such earnings exceed the amount established for purposes of clause (ii), rounded, if not a multiple of $0.10, to the next lower multiple of $0.10, and thereafter increased as provided in subsection (i).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
      'packages/engine/src/socialSecurity/ssaWageData.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#piaMonthlyFromAime',
      'packages/engine/src/socialSecurity/ssaWageData.ts#PIA_BEND_POINTS',
    ],
  },

  'cfr-20-404-410-early-retirement-reduction': {
    title: 'The early-claim reduction changes rate after 36 months',
    statement:
      'A retirement benefit claimed before full retirement age is reduced by 5/9 of 1 percent for each of the first 36 months of early entitlement and by 5/12 of 1 percent for each month beyond 36. The second rate is smaller, so the reduction slows rather than continuing at the initial pace.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine works in whole months before full retirement age and does not model the special rules for a benefit that is later recomputed, so the factor is a pure function of the month count.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.410(a)',
      url: 'https://www.law.cornell.edu/cfr/text/20/404.410',
      quotedText:
        'The reduction is 5/9 of 1 percent for each of the first 36 months and 5/12 of 1 percent for each month in excess of 36.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/socialSecurity/benefitFactor.ts',
      'packages/engine/src/socialSecurity/claimFactor.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/benefitFactor.ts#earlyRetirementFactor',
      'packages/engine/src/socialSecurity/claimFactor.ts#claimFactor',
    ],
  },

  'cfr-20-404-313-delayed-retirement-credit': {
    title: 'Delayed retirement credits accrue at 2/3 of 1 percent and stop at 70',
    statement:
      'A retirement benefit claimed after full retirement age is increased by 2/3 of 1 percent for each month of delay, beginning with the month full retirement age is attained and ending with the month age 70 is attained. Delaying past 70 earns nothing further.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The 2/3 of 1 percent rate applies to individuals born after 1 January 1943; earlier cohorts have lower rates that the engine does not model, because a person reaching full retirement age in a projected year is necessarily in the later group.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.313(b)(1), (b)(2)',
      url: 'https://www.law.cornell.edu/cfr/text/20/404.313',
      quotedText:
        'You may earn a credit for each month during the period beginning with the month you attain full retirement age (as defined in \u00a7 404.409) and ending with the month you attain age 70 (72 before 1984). ... Credit percentages. The applicable credit amount for each month of delayed retirement can be found in the table below. If your date of birth is: The credit for each month you delay retirement is: ... After 1/1/1943 2/3 of 1%',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/socialSecurity/benefitFactor.ts',
      'packages/engine/src/socialSecurity/claimFactor.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/benefitFactor.ts#delayedRetirementFactor',
      'packages/engine/src/socialSecurity/claimFactor.ts#claimFactor',
    ],
  },

  'usc-42-416-l-retirement-age-schedule': {
    title: 'Retirement age keys on attaining age 62, not on birth year',
    statement:
      'Retirement age is 66 for an individual attaining early retirement age after 2004 and before 2017, 66 plus an age increase factor for one attaining it after 2016 and before 2022, and 67 for one attaining it after 2021. Early retirement age is 62 for an old-age benefit and 60 for a widow benefit, which is why survivors run a separate and earlier schedule.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Because the statute turns on attaining age 62 rather than on a birth year, the boundary moves for anyone born on 1 January: the Social Security Administration treats a person as attaining an age on the day before their birthday, so a 1 January 1960 birth attains 62 in 2021 and falls under the 66-plus-factor branch rather than the flat 67. The engine expresses this as an effective birth year of the prior calendar year.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 416(l)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section416&num=0&edition=prelim',
      quotedText:
        'The term "retirement age" means- (A) with respect to an individual who attains early retirement age (as defined in paragraph (2)) before January 1, 2000, 65 years of age; (B) with respect to an individual who attains early retirement age after December 31, 1999, and before January 1, 2005, 65 years of age plus the number of months in the age increase factor (as determined under paragraph (3)) for the calendar year in which such individual attains early retirement age; (C) with respect to an individual who attains early retirement age after December 31, 2004, and before January 1, 2017, 66 years of age; (D) with respect to an individual who attains early retirement age after December 31, 2016, and before January 1, 2022, 66 years of age plus the number of months in the age increase factor (as determined under paragraph (3)) for the calendar year in which such individual attains early retirement age; and (E) with respect to an individual who attains early retirement age after December 31, 2021, 67 years of age.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 416(l)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section416&num=0&edition=prelim',
      quotedText:
        'The term "early retirement age" means age 62 in the case of an old-age, wife\'s, or husband\'s insurance benefit, and age 60 in the case of a widow\'s or widower\'s insurance benefit.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: ['packages/engine/src/socialSecurity/nra.ts'],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/nra.ts#fraForBirthYear',
    ],
  },

  'usc-42-403-a-2-family-maximum-formula': {
    title: 'The family maximum is marginal across three bend points',
    statement:
      'The maximum family benefit is 150 percent of the primary insurance amount up to the first bend point, plus 272 percent of the part between the first and second, plus 134 percent of the part between the second and third, plus 175 percent of the part above the third, decreased to the next lower multiple of ten cents. Each rate reaches only the amount inside its own band.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The bend points here are not the ones used for the primary insurance amount itself; section 403(a)(2) has its own set, indexed separately, which is why the engine carries a second table rather than reusing the PIA bend points.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 403(a)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/42/403',
      quotedText:
        'the total monthly benefits to which beneficiaries may be entitled under section 402 or 423 of this title for a month on the basis of the wages and self-employment income of such individual shall, except as provided by paragraphs (3) and (6) (but prior to any increases resulting from the application of paragraph (2)(A)(ii)(III) of section 415(i) of this title), be reduced as necessary so as not to exceed\u2014 (A) 150 percent of such individual\u2019s primary insurance amount to the extent that it does not exceed the amount established with respect to this subparagraph by paragraph (2), (B) 272 percent of such individual\u2019s primary insurance amount to the extent that it exceeds the amount established with respect to subparagraph (A) but does not exceed the amount established with respect to this subparagraph by paragraph (2), (C) 134 percent of such individual\u2019s primary insurance amount to the extent that it exceeds the amount established with respect to subparagraph (B) but does not exceed the amount established with respect to this subparagraph by paragraph (2), and (D) 175 percent of such individual\u2019s primary insurance amount to the extent that it exceeds the amount established with respect to subparagraph (C). Any such amount that is not a multiple of $0.10 shall be decreased to the next lower multiple of $0.10.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/socialSecurity/familyMaximum.ts',
      'packages/engine/src/socialSecurity/ssaWageData.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/familyMaximum.ts#familyMaximumMonthlyFromPia',
      'packages/engine/src/socialSecurity/ssaWageData.ts#FAMILY_MAXIMUM_BEND_POINTS',
    ],
  },

  'usc-42-403-f-3-retirement-earnings-test': {
    title: 'The earnings test withholds half the excess, a third in the FRA year',
    statement:
      'Benefits are reduced by 50 percent of earnings above the exempt amount for a beneficiary who is under full retirement age throughout the year, and by 33 and one-third percent of earnings above a higher exempt amount in the year full retirement age is attained. Both the rate and the exempt amount change in that year, so the two cases cannot be collapsed. The rate fixes the size of the deduction, not the amount paid out: section 403(b) makes the deduction from the payments the beneficiary is entitled to, so it stops at the benefits payable and never runs negative or reaches beyond the year’s benefit.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Withholding is applied annually against annual wages rather than month by month, and the withheld months are credited back at full retirement age through an adjustment-reduction-factor approximation. The statute operates on monthly benefits payable, so this is an annual-granularity convention rather than a reading of section 403(f). The cap at benefits payable is not part of that convention -- it is section 403(b) -- but it is worth naming here because it means a fixture whose wages are high enough for the cap to bind tests the cap rather than the 403(f)(3) rate.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 403(f)(3)',
      url: 'https://www.law.cornell.edu/uscode/text/42/403',
      quotedText:
        'For purposes of paragraph (1) and subsection (h), an individual\u2019s excess earnings for a taxable year shall be 33\u2153 percent of his earnings for such year in excess of the product of the applicable exempt amount as determined under paragraph (8) in the case of an individual who has attained (or, but for the individual\u2019s death, would have attained) retirement age (as defined in section 416(l) of this title) before the close of such taxable year, or 50 percent of his earnings for such year in excess of such product in the case of any other individual, multiplied by the number of months in such year ...',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 403(b)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/42/403',
      quotedText:
        'Deductions, in such amounts and at such time or times as the Commissioner of Social Security shall determine, shall be made from any payment or payments under this subchapter to which an individual is entitled, and from any payment or payments to which any other persons are entitled on the basis of such individual\u2019s wages and self-employment income, until the total of such deductions equals\u2014 (A) such individual\u2019s benefit or benefits under section 402 of this title for any month, and (B) if such individual was entitled to old-age insurance benefits under section 402(a) of this title for such month, the benefit or benefits of all other persons for such month under section 402 of this title based on such individual\u2019s wages and self-employment income, if for such month he is charged with excess earnings, under the provisions of subsection (f) of this section, equal to the total of benefits referred to in clauses (A) and (B).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'usc-42-402-b-2-spousal-half-of-pia': {
    title: 'A spousal benefit is half the PIA and earns no delayed credits',
    statement:
      'The wife or husband insurance benefit is one-half of the worker primary insurance amount. Because it is measured against the PIA rather than against what the worker actually receives, a worker who delays past full retirement age raises their own benefit but not the spousal one, and the spouse gains nothing by claiming after their own full retirement age.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Section 402(b)(2) is expressly subject to subsection (q), which supplies the early-claim reduction. The engine applies a steeper schedule for the spousal case than for a retirement benefit -- 25/36 of 1 percent for the first 36 months rather than 5/9 -- and models the deemed-filing era only, assuming on the current-spouse path that the worker has already filed so the spouse is eligible. Living-divorced entitlement is governed by `cfr-20-404-331-living-divorced-spouse-eligibility`.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(b)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/42/402',
      quotedText:
        'such wife\u2019s insurance benefit for each month shall be equal to one-half of the primary insurance amount of her husband (or, in the case of a divorced wife, her former husband) for such month.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/socialSecurity/claimFactor.ts',
      'packages/engine/src/socialSecurity/maritalBenefits.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/claimFactor.ts#spousalBenefitFactor',
      'packages/engine/src/socialSecurity/maritalBenefits.ts#maritalBenefitFor',
    ],
  },
  'usc-42-402-worker-claim-window-62-to-70': {
    title: 'Worker old-age benefits are claimable from 62, and delayed credits stop at 70',
    statement:
      'Old-age insurance entitlement requires attaining age 62, and delayed retirement credit increment months accrue only for months prior to the month age 70 is attained. The floor is statutory: no worker claim exists before 62. The ceiling is economic: a claim after 70 remains lawful but pays the same monthly benefit as a claim at 70 with months of benefits forgone, so the engine models no claim age above 70.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The claim-age refusal above 70y0m is an engine convention, not a statutory bar: 402(w)(2)(A) stops increment months at 70, which makes every later claim weakly dominated, and the planner prices only claim ages that can change the benefit. The refusal below 62y0m tracks 402(a)(2) directly.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'Every individual who- (1) is a fully insured individual (as defined in section 414(a) of this title ), (2) has attained age 62, and (3) has filed application for old-age insurance benefits or was entitled to disability insurance benefits for the month preceding the month in which he attained retirement age (as defined in section 416(l) of this title ), shall be entitled to an old-age insurance benefit for each month \u2026',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(w)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the number of increment months for any individual shall be a number equal to the total number of the months- (A) which have elapsed after the month before the month in which such individual attained retirement age (as defined in section 416(l) of this title ) or (if later) December 1970 and prior to the month in which such individual attained age 70 \u2026',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/socialSecurity/claimFactor.ts',
      'packages/engine/src/socialSecurity/benefitFactor.ts',
      'packages/engine/src/decisions/generators.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/claimFactor.ts#claimFactor',
      'packages/engine/src/socialSecurity/benefitFactor.ts#retirementBenefitPiaFactor',
      'packages/engine/src/decisions/generators.ts#SS_GRID_CLAIM_AGES',
    ],
  },
  'ssa-2026-trustees-oasdi-depletion-default-haircut': {
    title: 'The prebuilt Social Security haircut scenario is the 2026 Trustees combined-OASDI projection',
    statement:
      'The 2026 Trustees Report intermediate projection has the combined OASDI reserves depleted in the third quarter of 2034 with 83 percent of scheduled benefits payable at that time. The engine exports that projection as a constant - a 17 percent cut from 2034 - and the planning surface builds its prebuilt what-if scenario from it; the engine itself applies whatever haircut a plan carries, including none.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'A projection scenario, not law: current law simply stops paying beyond trust fund income once reserves deplete, and Congress may act before 2034. Two simplifications are deliberate. The scenario holds the cut flat at 17 percent, where the report projects payability declining from 83 percent at depletion to 65 percent by 2100 - a one-step stand-in for a declining path. And the combined OASDI basis is used rather than the OASI-standalone projection (fourth quarter of 2032, 78 percent payable) because the combined basis is the conventional indicator of the program as a whole.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'agencyGuidance',
      citation: 'A Summary of the 2026 Annual Reports, Social Security and Medicare Boards of Trustees',
      url: 'https://www.ssa.gov/oact/trsum/',
      quotedText:
        'If these two legally separate trust funds were combined, then the OASDI reserves would be projected to become depleted in the third quarter of 2034 and 83 percent of scheduled Social Security benefits would be payable at that time, declining to 65 percent by 2100.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/params/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/index.ts#TRUSTEES_DEFAULT_SS_HAIRCUT',
    ],
  },
  'ssa-table-4c6-period-life-table-vintage': {
    title: 'The longevity tables are the SSA period life table, one vintage behind the live host',
    statement:
      'The engine\'s baseline life expectancies are SSA\'s Actuarial Life Table (Table 4C6) as published for the 2025 Trustees Report - the 2022 period table. The live page now presents the 2023 period table used in the 2026 Trustees Report, so the embedded vintage trails the published one until the next table refresh (life expectancy at 65: male 17.48 embedded versus 18.12 published, female 20.12 embedded versus 20.66 published).',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The table is refreshed deliberately, not silently: longevity feeds Monte Carlo horizons and annuitization comparisons, so a vintage bump changes results and belongs in a reviewed change, and this record is what goes stale to force that review. Direction is both ways - longer published expectancies lengthen horizons for some households and shift claiming and conversion comparisons in either direction.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'agencyGuidance',
      citation: 'SSA Actuarial Life Table (Table 4C6)',
      url: 'https://www.ssa.gov/oact/STATS/table4c6.html',
      quotedText:
        'Here we present the 2023 period life table for the Social Security area population , as used in the 2026 Trustees Report (TR). \u2026 65 0.016455 79,084 18.12 0.010188 87,399 20.66',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/longevity/ssaPeriod2022.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/longevity/ssaPeriod2022.ts#MALE',
      'packages/engine/src/longevity/ssaPeriod2022.ts#FEMALE',
    ],
  },

  'usc-42-402-r-1-2-deemed-filing-old-age-and-spousal': {
    title: 'Current eligible old-age and current-spouse benefits are deemed filed together',
    statement:
      'For a current deemed-filing claim, when an individual is eligible for a wife’s or husband’s insurance benefit and entitled to an old-age insurance benefit for a month, section 402(r) deems an application for the spouse benefit; it reciprocally deems an old-age application when the individual is entitled to the spouse benefit, subject to the provision’s stated exceptions. The post-2015 regime applies to individuals who attain age 62 in any calendar year after 2015, so every not-yet-claimed cohort in a 2026-or-later projection is inside it and no grandfathered restricted application survives. The engine represents a current-spouse claimant with one `claimAge` on their Social Security stream and pays the higher of own and spousal amounts at that age, rather than allowing a restricted current-spouse-only claim that leaves the own old-age benefit unclaimed.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(r)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'If an individual is eligible for a wife\'s or husband\'s insurance benefit (except in the case of eligibility pursuant to clause (ii) of subsection (b)(1)(B) or subsection (c)(1)(B), as appropriate), in any month for which the individual is entitled to an old-age insurance benefit, such individual shall be deemed to have filed an application for wife\'s or husband\'s insurance benefits for such month.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(r)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'If an individual is eligible (but for subsection (k)(4)) for an old-age insurance benefit in any month for which the individual is entitled to a wife\'s or husband\'s insurance benefit (except in the case of entitlement pursuant to clause (ii) of subsection (b)(1)(B) or subsection (c)(1)(B), as appropriate), such individual shall be deemed to have filed an application for old-age insurance benefits- (A) for such month, or (B) if such individual is also entitled to a disability insurance benefit for such month, in the first subsequent month for which such individual is not entitled to a disability insurance benefit.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(r)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, an individual shall be deemed eligible for a benefit for a month if, upon filing application therefor in such month, he would be entitled to such benefit for such month.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402, Editorial Notes, Effective Date of 2015 Amendment (BBA 2015 § 831(a)(3))',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'The amendments made by this subsection [amending this section] shall apply with respect to individuals who attain age 62 in any calendar year after 2015.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'pl-118-273-sec-2-3-wep-gpo-repeal': {
    title: 'WEP and GPO are repealed for title II monthly benefits after December 2023',
    statement:
      'Public Law 118-273 repealed the Government Pension Offset by striking section 202(k)(5) and repealed the Windfall Elimination Provisions by striking section 215(a)(7), (d)(3), and (f)(9). Its applicability rule makes those amendments apply to monthly insurance benefits payable under title II for months after December 2023. The Plan has no non-covered-pension fact, WEP/GPO flag, or covered-service fact that would trigger those adjustments, so no accepted input reaches the repealed rule for any projection year and the engine produces no figure from it rather than an approximation.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a non-covered pension on socialSecurityIncomeSchema',
      'a WEP or GPO flag',
      'covered-service facts that would have triggered either adjustment',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Absence-record surface is model/plan.ts: the Plan has no WEP/GPO flag, non-covered-pension fact, or covered-service fact. A code sweep found no WEP or GPO adjustment in socialSecurity/benefitFactor.ts, socialSecurity/claimFactor.ts, socialSecurity/disability.ts, socialSecurity/familyMaximum.ts, socialSecurity/maritalBenefits.ts, socialSecurity/nra.ts, socialSecurity/piaFromEarnings.ts, socialSecurity/ssaWageData.ts, socialSecurity/survivorBenefit.ts, projection/internal/annualSocialSecurity.ts, or projection/simulate.ts — consistent with those trigger facts being unrepresentable for any startYear.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'P.L. 118-273, § 2(a)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-118publ273/pdf/PLAW-118publ273.pdf',
      quotedText:
        'Section 202(k) of the Social Security Act (42 U.S.C. 402(k)) is amended by striking paragraph (5).',
    }, {
      kind: 'statute',
      citation: 'P.L. 118-273, § 3(a)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-118publ273/pdf/PLAW-118publ273.pdf',
      // The enrolled text continues immediately into subsection (b), so the
      // terminal U+2026 honestly discloses that omitted continuation.
      quotedText:
        'Section 215 of the Social Security Act (42 U.S.C. 415) is amended-- (1) in subsection (a), by striking paragraph (7); (2) in subsection (d), by striking paragraph (3); and (3) in subsection (f), by striking paragraph (9)…',
    }, {
      kind: 'statute',
      citation: 'P.L. 118-273, § 4',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-118publ273/pdf/PLAW-118publ273.pdf',
      quotedText:
        'The amendments made by this Act shall apply with respect to monthly insurance benefits payable under title II of the Social Security Act for months after December 2023.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
    ],
  },

  'usc-42-402-r-survivor-deemed-filing-exemption': {
    title: 'Survivor benefits are exempt from deemed filing, but a whole-plan survivor/own switch is not representable',
    statement:
      'Section 402(r) addresses only old-age and wife’s or husband’s insurance benefits, not survivor benefits. SSA confirms that deemed filing does not apply to survivor benefits: a widow(er) entitled to survivor benefits is not deemed to file for retirement insurance benefits and may restrict the widow(er) application while delaying retirement insurance benefits. A survivor↔own claim-age sequence is therefore legally available, but the Plan has only one `claimAge` on each Social Security stream (clamped to ages 62–70) and no separate survivor claim age, so a survivor-only claim at 60 is independently unrepresentable. The whole-plan ledger consequently cannot price the sequence and produces no figure from it.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a survivor claim age separate from the stream\'s single claimAge, which is clamped to ages 62 through 70',
      'a restricted widow(er) application that delays retirement insurance benefits',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'model/plan.ts defines a Social Security stream with one `claimAge` whose years are schema-clamped to 62–70. annualSocialSecurity.ts derives both the own and survivor ages from that same stream field, so no accepted Plan can supply the two claim dates a switch requires (including a survivor-only claim at 60). The separate planner-ui survivorSwitching view illustrates two dates but does not make them ledger inputs.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(r)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'If an individual is eligible for a wife\'s or husband\'s insurance benefit (except in the case of eligibility pursuant to clause (ii) of subsection (b)(1)(B) or subsection (c)(1)(B), as appropriate), in any month for which the individual is entitled to an old-age insurance benefit, such individual shall be deemed to have filed an application for wife\'s or husband\'s insurance benefits for such month.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(r)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'If an individual is eligible (but for subsection (k)(4)) for an old-age insurance benefit in any month for which the individual is entitled to a wife\'s or husband\'s insurance benefit (except in the case of entitlement pursuant to clause (ii) of subsection (b)(1)(B) or subsection (c)(1)(B), as appropriate), such individual shall be deemed to have filed an application for old-age insurance benefits-',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS GN 00204.035, § B',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0200204035',
      quotedText:
        'Deemed filing does not apply to survivor benefits. For example, when a claimant becomes entitled to widow(er)s benefits (WIB), they are not deemed to file for RIB. The claimant may restrict the WIB application and delay filing for RIB.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'usc-42-402-e-2-widow-full-pia': {
    title: 'A widow benefit is the whole PIA, not half of it',
    statement:
      'The widow or widower insurance benefit is equal to the primary insurance amount of the deceased individual, that amount being the one determined after the subsection\u2019s own subparagraphs (B) and (C) have been applied. It is not the one-half fraction that applies to a spouse of a living worker, so the amount payable roughly doubles at the moment the relationship changes from spousal to survivor. The whole primary insurance amount is a floor on the survivor base rather than a ceiling on it: subparagraph (C) can deem it up to the deceased’s delayed-retirement-increased benefit, a limb registered and fixture-pinned separately at cfr-20-404-338-survivor-deceased-drc-pass-through.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This record covers the whole-PIA limb only: its fixture holds the deceased at FRA so the whole-versus-half readings discriminate without delayed credits in play. The subparagraph (C) deeming that carries the deceased\u2019s delayed credits into the survivor base is fixture-pinned at cfr-20-404-338-survivor-deceased-drc-pass-through. The early-deceased RIB-LIM amount and its ordering relative to the survivor\u2019s own age reduction are registered separately at poms-rs-00615-320-rib-lim-after-survivor-reduction.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(2)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/42/402',
      quotedText:
        'such widow\u2019s insurance benefit for each month shall be equal to the primary insurance amount (as determined for purposes of this subsection after application of subparagraphs (B) and (C)) of such deceased individual.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: ['packages/engine/src/socialSecurity/survivorBenefit.ts'],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/survivorBenefit.ts#survivorBenefitMonthly',
    ],
  },

  'usc-42-402-q-1-widow-survivor-early-reduction-schedule': {
    title: 'A survivor claim at 60 starts at 71.5 percent and rises to the survivor FRA amount',
    statement:
      'survivorBenefit.ts applies a 71.5 percent factor at age 60 and raises it linearly by month to 100 percent at the supplied survivor full retirement age. Section 402 permits widow(er) entitlement from age 60, measures the reduction period from the later of entitlement or age 60 through the month before retirement age, and reduces the benefit for that period; POMS confirms that the maximum reduction remains 28.5 percent as the survivor FRA changes. The helper therefore pays 71.5–100 percent of its deceased-benefit base by claim age, conditional on the separately registered survivor-FRA schedule.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This record is confined to the reduction curve after a survivor FRA has been supplied. The nra.ts age-60-cohort error for 1961-and-later survivors is recorded separately at usc-42-416-l-survivor-fra-age-60-attainment-cohorts; it is not a competing reading of this helper’s month interpolation.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(1)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        '(B)(i) has attained age 60, or (ii) has attained age 50 but has not attained age 60 and is under a disability',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(q)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'if the first month for which an individual is entitled to an old-age, wife\'s, husband\'s, widow\'s, or widower\'s insurance benefit is a month before the month in which such individual attains retirement age, the amount of such benefit for such month and for any subsequent month shall, subject to the succeeding paragraphs of this subsection, be reduced by-',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(q)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        '19/40 of 1 percent of such amount if such benefit is a widow\'s or widower\'s insurance benefit, multiplied by',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(q)(1)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'the number of months in the reduction period for such benefit (determined under paragraph (6)), if such benefit is for a month before the month in which such individual attains retirement age, or',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(q)(6)(A)(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'in the case of a widow\'s or widower\'s insurance benefit, with the first day of the first month for which such individual is entitled to such benefit or the first day of the month in which such individual attains age 60, whichever is the later, and',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(q)(6)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'ending with the last day of the month before the month in which such individual attains retirement age.',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS RS 00615.301, § B.1.b',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0300615301',
      quotedText:
        'For people born after 1/1/40, FRA is gradually increased to age 67. However, the maximum reduction is still set at 28.5%. This causes the fractions involved in widow(er) reduction to vary depending on the date of birth.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: ['packages/engine/src/socialSecurity/survivorBenefit.ts'],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/survivorBenefit.ts#survivorReductionFactor',
    ],
  },

  'poms-rs-00615-320-rib-lim-after-survivor-reduction': {
    title: 'RIB-LIM is tested after the widow(er) age reduction',
    statement:
      'survivorBenefit.ts first chooses the greater of the deceased’s actual reduced benefit and 82.5 percent of the PIA, then applies the survivor’s age-reduction factor. POMS RS 00615.320 instead tests RIB-LIM when the widow(er) benefit after reduction for age is greater than both limits, at which point the payable amount is the greater limit. When both the deceased and survivor claimed early and the limit binds, the engine consequently understates the survivor benefit. The benefit error moves taxable Social Security income directly (at most 85 percent taxable), but when spending is instead funded from a traditional account the engine replaces each missing benefit dollar with a fully taxable withdrawal dollar, so the sign of the tax error depends on how the shortfall is funded.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. The code evaluates `max(deceasedActualMonthly, 0.825 × deceasedPiaMonthly)` before `survivorReductionFactor`, while POMS evaluates the widow(er) benefit after the age reduction before imposing the larger RIB-LIM amount. The companion fixture sets a 2,000-dollar PIA, a 1,400-dollar deceased reduced benefit, and a survivor claim at 63 against a 66-year survivor FRA: the authority-derived amount is 1,650 dollars because the widow(er) amount after reduction for age (2,000 x .8575 = 1,715) exceeds both limits, while the engine reduces that 1,650-dollar limit again. The observed engine amount is 1,414.875 - the 1,650-dollar limit reduced again by the .8575 age factor - pinned in the companion fixture.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(2)(D)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'If the deceased individual (on the basis of whose wages and self-employment income a widow or surviving divorced wife is entitled to widow\'s insurance benefits under this subsection) was, at any time, entitled to an old-age insurance benefit which was reduced by reason of the application of subsection (q), the widow\'s insurance benefit of such widow or surviving divorced wife for any month shall, if the amount of the widow\'s insurance benefit of such widow or surviving divorced wife (as determined under subparagraph (A) and after application of subsection (q)) is greater than-',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.338(c)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.338',
      quotedText:
        'Your monthly benefit will be reduced if the insured person chooses to receive old-age benefits before reaching full retirement age. If so, your benefit will be reduced to the amount the insured person would be receiving if alive, or 82 1⁄2 percent of his or her primary insurance amount, whichever is larger.',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS RS 00615.320, § A.2',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0300615320',
      quotedText: 'A widow(er)\'s benefit is limited to the larger of:',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS RS 00615.320, § A.2',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0300615320',
      quotedText: '82 1/2 percent of the NH\'s death PIA, or',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS RS 00615.320, § A.2',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0300615320',
      quotedText:
        'the reduced RIB or DIB amount to which the NH would have been entitled if they had lived (RIB LIM).',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS RS 00615.320, § A.3',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0300615320',
      quotedText:
        'The RIB LIM will apply when the WIB after adjustment for the family maximum and reduction for age is more than BOTH 82 1/2 percent of the NH\'s death PIA and the RIB or DIB if they were alive.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: ['packages/engine/src/socialSecurity/survivorBenefit.ts'],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/survivorBenefit.ts#survivorBenefitMonthly',
    ],
  },

  'usc-42-402-i-lump-sum-death-payment': {
    title: 'The $255 Social Security lump-sum death payment is outside the Plan',
    statement:
      'The engine emits no Social Security lump-sum death payment. Section 402(i) and 20 CFR 404.390 permit a payment of up to $255 only for a fully or currently insured deceased worker and condition the normal widow(er) payment on living in the same household at death, with alternative payees and application rules if that condition is absent. A married couple where one dies is expressible as a same-household fact, but no accepted Plan input supplies fully or currently insured status as such, an application within two years, or the statutory alternative payee facts, and the engine has no death-payment surface, so no accepted Plan reaches this rule.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'fully or currently insured status as such',
      'an application filed within two years of death',
      'the statutory alternative-payee facts when the same-household condition is absent',
      'a death-payment surface for the engine to pay it out of',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine has no death-payment surface at all — no simulate.ts pass emits a lump sum and no accepted input feeds one — and the further statutory facts (fully or currently insured status as such, the application within two years, alternative payees) have no Plan fields. A married couple where one dies is expressible, so outOfScope does not rest on unrepresentable household facts. A one-time $255 payment is an absence, not an approximation, because the engine emits no figure the rule could correct.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'Upon the death, after August 1950, of an individual who died a fully or currently insured individual, an amount equal to three times such individual\'s primary insurance amount (as determined without regard to the amendments made by section 2201 of the Omnibus Budget Reconciliation Act of 1981, relating to the repeal of the minimum benefit provisions), or an amount equal to $255, whichever is the smaller, shall be paid in a lump sum to the person, if any, determined by the Commissioner of Social Security to be the widow or widower of the deceased and to have been living in the same household with the deceased at the time of death.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'No payment shall be made to any person under this subsection unless application therefor shall have been filed, by or on behalf of such person (whether or not legally competent), prior to the expiration of two years after the date of death of such insured individual, or unless such person was entitled to wife\'s or husband\'s insurance benefits, on the basis of the wages and self-employment income of such insured individual, for the month preceding the month in which such individual died.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.390',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR1c2245c503cd9d5/section-404.390',
      quotedText:
        'If a person is fully or currently insured when he or she dies, a lump-sum death payment of $255 may be paid to the widow or widower of the deceased if he or she was living in the same household with the deceased at the time of his or her death. If the insured is not survived by a widow(er) who meets this requirement, all or part of the $255 payment may be made to someone else as described in § 404.392.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
    ],
  },

  'usc-42-402-e-1-a-current-survivor-remarriage-before-60': {
    title: 'A current-spouse survivor’s later remarriage is outside the Plan',
    statement:
      'The current-couple survivor step-up has no accepted fact for a survivor’s remarriage after the worker dies, so it cannot apply the rule that remarriage before 60 ends widow(er) eligibility while remarriage after 60 is disregarded. The narrower former-spouse path does carry `remarriedAtAge` and rejects a deceased former-spouse survivor claim below 60; this out-of-scope record is limited to the unrepresentable current-spouse transition.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a remarriage of the surviving member of the current couple after the worker\'s death: only formerSpouseSchema carries remarriedAtAge',
      'the age at that remarriage, which decides whether widow(er) eligibility ends',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Absence-record surface is model/plan.ts: a Social Security stream for a current household spouse has no post-death remarriage age, date, or status. formerSpouseSchema has `remarriedAtAge` only for an already-deceased former spouse, which is why maritalBenefits.ts can model that separate input path but cannot supply the missing future fact for the current-couple survivor pass. No accepted Plan can therefore trigger the current-spouse rule without inventing a remarriage.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'of an individual who died a fully insured individual, if such widow or such surviving divorced wife- (A) is not married,',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'a widow or surviving divorced wife marries after attaining age 60 (or after attaining age 50 if she was entitled before such marriage occurred to benefits based on disability under this subsection), or',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText: 'such marriage shall be deemed not to have occurred.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.336(e)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.336',
      quotedText:
        'You are unmarried, unless for benefits for months after 1983 you meet one of the conditions in paragraphs (e)(1) through (3) of this section:',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.336(e)(1)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.336',
      quotedText: 'You remarried after you became 60 years old.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
    ],
  },

  'usc-42-402-d-2-child-survivor-benefit': {
    title: 'Child survivor benefits are outside the Plan',
    statement:
      'The engine does not create a child survivor benefit. A deceased worker’s eligible child receives three-fourths of the worker’s primary insurance amount under section 402(d)(2), and section 403(a) can reduce benefits on that worker’s record to the family maximum; the Plan has no child person, dependency, age/student/disability eligibility, or child Social Security stream through which either amount can be reached.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a child person in the household',
      'the child\'s dependency on the worker',
      'the age, student, or disability eligibility the benefit turns on',
      'a child Social Security stream to pay three-fourths of the PIA into',
      'the section 403(a) family maximum applied across one worker\'s record',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Absence-record surface is model/plan.ts: `household.hasQualifyingDependent` is a tax-filing boolean, not a child identity, dependency, age, student, disability, or Social Security-benefit record. familyMaximum.ts therefore caps only a modeled current-spouse auxiliary and has no child allocation to price. No accepted Plan supplies the trigger facts for a child survivor benefit.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(d)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'Such child\'s insurance benefit for each month shall, if the individual on the basis of whose wages and self-employment income the child is entitled to such benefit has not died prior to the end of such month, be equal to one-half of the primary insurance amount of such individual for such month. Such child\'s insurance benefit for each month shall, if such individual has died in or prior to such month, be equal to three-fourths of the primary insurance amount of such individual.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 403(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section403&num=0&edition=prelim',
      quotedText:
        'the total monthly benefits to which beneficiaries may be entitled under section 402 or 423 of this title for a month on the basis of the wages and self-employment income of such individual shall, except as provided by paragraphs (3) and (6) (but prior to any increases resulting from the application of paragraph (2)(A)(ii)(III) of section 415(i) of this title), be reduced as necessary so as not to exceed-',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
    ],
  },

  'usc-42-416-l-survivor-fra-age-60-attainment-cohorts': {
    title: 'Survivor FRA follows age-60 attainment cohorts, reaching 67 for 1962+',
    statement:
      'nra.ts correctly keeps a survivor FRA separate from retirement FRA, but it stops at 66 years and 8 months for every effective birth year from 1960 onward. Section 416(l) keys retirement age to the calendar year the claimant attains early retirement age, and sets that early age at 60 for survivor benefits: the statutory schedule is 66 years and 10 months for a 1961 cohort and 67 for a 1962-and-later cohort. The engine consequently makes a 1962-and-later survivor unreduced up to four months too early. The benefit error moves taxable Social Security income directly (at most 85 percent taxable), but when spending is instead funded from a traditional account the engine replaces each missing benefit dollar with a fully taxable withdrawal dollar, so the sign of the tax error depends on how the shortfall is funded (and symmetrically for the too-early-unreduced FRA case).',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. survivorFraForBirthYear returns 66y8m for 1960 and every later effective birth year. For an effective 1962 birth, age 60 is attained in 2022, so section 416(l)(1)(E) supplies age 67; the companion fixture pins the statute-derived 804 months against the observed engine value of 800 months.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 416(l)(1)(D)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section416&num=0&edition=prelim',
      quotedText:
        'with respect to an individual who attains early retirement age after December 31, 2016, and before January 1, 2022, 66 years of age plus the number of months in the age increase factor (as determined under paragraph (3)) for the calendar year in which such individual attains early retirement age; and',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 416(l)(1)(E)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section416&num=0&edition=prelim',
      quotedText:
        'with respect to an individual who attains early retirement age after December 31, 2021, 67 years of age.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 416(l)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section416&num=0&edition=prelim',
      quotedText:
        'The term "early retirement age" means age 62 in the case of an old-age, wife\'s, or husband\'s insurance benefit, and age 60 in the case of a widow\'s or widower\'s insurance benefit.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 416(l)(3)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section416&num=0&edition=prelim',
      quotedText:
        'With respect to an individual who attains early retirement age in the 5-year period consisting of the calendar years 2017 through 2021, the age increase factor shall be equal to two-twelfths of the number of months in the period beginning with January 2017 and ending with December of the year in which the individual attains early retirement age.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: ['packages/engine/src/socialSecurity/nra.ts'],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/nra.ts#survivorFraForBirthYear',
    ],
  },

  'usc-42-402-e-2-a-survivor-own-delay-no-drc': {
    title: 'A survivor’s own delay past survivor FRA earns no delayed-retirement credits',
    statement:
      'survivorBenefit.ts stops the survivor age-reduction factor at 100 percent at survivor FRA and does not add a delayed-retirement-credit factor when the survivor waits longer. Section 402(e)(2)(A) fixes the widow(er) amount at the deceased worker’s PIA as adjusted under that subsection, while the DRC regulation defines credits as an increase to an old-age benefit. The survivor’s own delay after survivor FRA therefore does not increase the survivor amount.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This rule is intentionally distinct from the deceased worker’s DRC pass-through. The survivor amount is not a retirement claim by the survivor, so the helper permits the deceased’s already-earned credits in the base but does not manufacture new credits from the survivor’s post-FRA delay.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'Except as provided in subsection (q) and subparagraph (D) of this paragraph, such widow\'s insurance benefit for each month shall be equal to the primary insurance amount (as determined for purposes of this subsection after application of subparagraphs (B) and (C)) of such deceased individual.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.313(a)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR545f4aa361a6356/section-404.313',
      quotedText:
        'Delayed retirement credits (DRCs) are credits we use to increase the amount of your old-age benefit amount.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: ['packages/engine/src/socialSecurity/survivorBenefit.ts'],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/survivorBenefit.ts#survivorBenefitMonthly',
    ],
  },

  'cfr-20-404-338-survivor-deceased-drc-pass-through': {
    title: 'The deceased worker’s delayed-retirement credits pass through to the survivor base',
    statement:
      'survivorBenefit.ts accepts the deceased worker’s actual claim-age-adjusted amount as the survivor base and preserves it when it exceeds 82.5 percent of PIA. Section 404.338 expressly permits an increased survivor monthly amount where the insured person delayed filing and earned delayed-retirement credits. The engine therefore carries a deceased worker’s earned DRCs into the survivor base; it does not grant DRCs for the survivor’s own delay.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The general DRC-accrual rule is registered at cfr-20-404-313-delayed-retirement-credit. This narrower record covers its survivor consequence and is tested without a survivor reduction so the fixture isolates whether the deceased worker’s actual increased amount survives into the base.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(2)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'If such deceased individual was (or upon application would have been) entitled to an old-age insurance benefit which was increased (or subject to being increased) on account of delayed retirement under the provisions of subsection (w), then, for purposes of this subsection, such individual\'s primary insurance amount, if less than the old-age insurance benefit (increased, where applicable, under paragraph (5) or (6) of section 415(f) of this title and under section 415(i) of this title as if such individual were still alive in the case of an individual who has died) which he was receiving (or would upon application have received) for the month prior to the month in which he died, shall be deemed to be equal to such old-age insurance benefit, and (notwithstanding the provisions of paragraph (3) of such subsection (w)) the number of increment months shall include any month in the months of the calendar year in which he died, prior to the month in which he died, which satisfy the conditions in paragraph (2) of such subsection (w).',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.338(b)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.338',
      quotedText:
        'We may increase your monthly benefit amount if the insured person delays filing for benefits or requests voluntary suspension of benefits, and thereby earns delayed retirement credit (see § 404.313), and/or works before the year 2000 after reaching full retirement age (as defined in § 404.409(a)). The amount of your monthly benefit may change as explained in § 404.304.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/socialSecurity/survivorBenefit.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/socialSecurity/survivorBenefit.ts#survivorBenefitMonthly',
    ],
  },

  'usc-42-402-k-3-a-survivor-own-dual-entitlement-offset': {
    title: 'Own retirement and survivor benefits combine to the higher amount, not both full amounts',
    statement:
      'annualSocialSecurity.ts pays a survivor the larger of their own retirement benefit and the survivor amount, not their sum. Section 402(k)(3)(A) reaches the same payable total by reducing the other monthly benefit, but not below zero, by the old-age benefit; POMS describes a widow(er) technically entitled on both records as paid at the higher rate. The engine’s max representation is therefore the benefit-total equivalent of the statutory offset.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The ledger publishes one Social Security amount rather than separate technical-entitlement components. That representation is valid for this rule because the statutory offset leaves the total equal to the larger amount; it must not be read as allowing both unreduced full benefits.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(k)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'If an individual is entitled to an old-age or disability insurance benefit for any month and to any other monthly insurance benefit for such month, such other insurance benefit for such month, after any reduction under subsection (q), subsection (e)(2) or (f)(2), and any reduction under section 403(a) of this title, shall be reduced, but not below zero, by an amount equal to such old-age or disability insurance benefit (after reduction under such subsection (q)).',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS RS 00615.301, § A.1',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0300615301',
      quotedText:
        'If the widow(er) files on both records and does not restrict their application, they will be technically entitled on both but paid the higher rate. Months of technical entitlement for which no payment was made cannot be eliminated from the widow(er)\'s RF at FRA.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'poms-rs-00615-482-arf-crediting-months': {
    title: 'ARF credits every full or partial work-deduction month',
    statement:
      'annualSocialSecurity.ts does credit earnings-test withholding back at full retirement age by moving the retirement claim age later and reusing claimFactor.ts. POMS RS 00615.482, however, credits a month with either a full or a partial work deduction. The engine derives one rounded count from annual withholding dollars divided by annual benefit dollars. The annualized count can fall short of or exceed the deduction-month record depending on how withholding lands across the year — for example when the annual test withholds the whole year the engine credits all payable months while POMS credits only work-deduction months (six work months, full withholding: engine +12, POMS +6, benefit overstated). Whether that understates or overstates tax depends on how the spending shortfall is funded, since a traditional-account withdrawal replacing at-most-85-percent-taxable benefit dollars is fully taxable.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The annualized convention is explicit in annualSocialSecurity.ts: after applying one annual earnings-test amount, it calculates `Math.round((withheld / benefit) * payableMonths)` and caps that integer to the year\'s payable months. That is not a record of the calendar months carrying a full or partial work deduction. The companion fixture withholds 2,000 dollars in each of the five below-FRA working years: the statute charges 1,400 dollars to the first month and 600 to the next, so POMS credits two months per year, ten in all, and a post-FRA year pays 17,800 dollars. The engine\'s annual ratio rounds to one credited month per year, five in all, and observably pays 17,300.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 403(f)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section403&num=0&edition=prelim',
      quotedText:
        'There shall be charged to the first month of such taxable year an amount of his excess earnings equal to the sum of the payments to which he and all other persons (excluding divorced spouses referred to in subsection (b)(2)) are entitled for such month under section 402 of this title on the basis of his wages and self-employment income (or the total of his excess earnings if such excess earnings are less than such sum), and the balance, if any, of such excess earnings shall be charged to each succeeding month in such year to the extent, in the case of each such month, of the sum of the payments to which such individual and all such other persons are entitled for such month under section 402 of this title on the basis of his wages and self-employment income, until the total of such excess has been so charged.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.415(a)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-E/section-404.415',
      quotedText:
        'Under the annual earnings test, we will reduce your monthly benefits (except disability insurance benefits based on the beneficiary\'s disability) by the amount of your excess earnings (as described in § 404.434), for each month in a taxable year (calendar year or fiscal year) in which you are under full retirement age (as defined in § 404.409(a)).',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS RS 00615.482, § C.1',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0300615482',
      quotedText:
        'Grant crediting months in RIB cases for months of: • full or partial work deduction; or • simultaneous RIB-Disability Insurance Benefit (DIB) entitlement.',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS RS 00615.482, § C.1 note',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0300615482',
      quotedText:
        'Proration of work deductions has no effect on the adjustment of the reduction factor, as stated under RS 02501.120B.3.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/socialSecurity/claimFactor.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/claimFactor.ts#claimFactor',
    ],
  },

  'usc-42-403-f-1-earnings-test-month-charging': {
    title: 'Excess earnings are charged to calendar months, not annual benefit fractions',
    statement:
      'Section 403(f)(1) first charges excess earnings to the first month\'s benefits and then to succeeding months. annualSocialSecurity.ts instead computes a single annual withholding amount and converts its annual-benefit ratio into a rounded number of withheld months. Its annualized proxy can disagree with the statutory charging sequence and feed the ARF credit count; the annualized count can fall short of or exceed the deduction-month record depending on how withholding lands across the year, while whether that understates or overstates tax depends on how the spending shortfall is funded, since a traditional-account withdrawal replacing at-most-85-percent-taxable benefit dollars is fully taxable.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The annual earnings amount itself is implemented by the existing `usc-42-403-f-3-retirement-earnings-test` record. This distinct convention record covers its missing month-charging unit: annualSocialSecurity.ts neither carries an ordered sequence of monthly entitlements nor consumes excess earnings against that sequence. In the companion fixture each below-FRA working year\'s 2,000 dollars of excess earnings must charge a 1,400-dollar first month and a 600-dollar second month, two partial-or-full deduction months per year; the annual ratio rounds to one per year, and the observed post-FRA benefit is 17,300 dollars against the statute-derived 17,800. This record and `poms-rs-00615-482-arf-crediting-months` share a single engine observable (the annualized month count feeds the ARF), so their fixtures intentionally pin the same produced figure from distinct legal limbs. A charging-only implementation could not be verified apart from the ARF credit with this observable — reclassifying either record requires a distinct charging observable (ordered months or unequal monthly entitlements).',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 403(f)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section403&num=0&edition=prelim',
      quotedText:
        'There shall be charged to the first month of such taxable year an amount of his excess earnings equal to the sum of the payments to which he and all other persons (excluding divorced spouses referred to in subsection (b)(2)) are entitled for such month under section 402 of this title on the basis of his wages and self-employment income (or the total of his excess earnings if such excess earnings are less than such sum), and the balance, if any, of such excess earnings shall be charged to each succeeding month in such year to the extent, in the case of each such month, of the sum of the payments to which such individual and all such other persons are entitled for such month under section 402 of this title on the basis of his wages and self-employment income, until the total of such excess has been so charged.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'cfr-20-404-435-grace-year-monthly-earnings-test': {
    title: 'The grace-year monthly earnings test preserves non-service-month benefits',
    statement:
      'The first grace year can pay a full benefit for a non-service month even when annual earnings are substantial. The Plan accepts one annual wage amount and optional annual stop age, but no month-by-month wages, self-employment service, grace-year, or non-service-month facts; annualSocialSecurity.ts consequently applies only its annual earnings-test pass. Because a first-retirement-year claimant still reaches that pass and receives an annual projected figure, this is an approximation rather than an out-of-scope rule. In an affected grace year the engine pays less benefit than the monthly test; whether that understates or overstates the resulting tax depends on how the spending shortfall is funded, since a traditional-account withdrawal replacing at-most-85-percent-taxable benefit dollars is fully taxable.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The accepted Plan surface is model/plan.ts: `wagesIncomeSchema` has `annualGross` and `endAge`, while a Social Security stream has one `claimAge`; neither carries service by calendar month, monthly wages, a grace-year designation, or non-service months. annualSocialSecurity.ts applies its annual earnings test to the emitted annual wage amount. The companion fixture gives the engine one 60,000-dollar annual wage total and stands that single observed annual figure against both authority limbs: (1) six July-through-December non-service months and (2) service in all twelve months. The monthly rule pays 8,400 dollars only in the first limb; the annual proxy observably pays zero for both, because the Plan carries no service-month fact and the annual test withholds the entire year\'s benefit. That collapse of one engine input against both limbs is the approximation.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.435(a), (a)(7)',
      url: 'https://www.ecfr.gov/current/title-20/section-404.435',
      quotedText:
        'We will not reduce your benefits on account of excess earnings for any month in which you, the beneficiary— ... (7) Had a non-service month in your grace year (see paragraph (b) of this section). A non-service month is any month in which you, while entitled to retirement or survivors benefits: (i) Do not work in self-employment (see paragraphs (c) and (d) of this section); (ii) Do not perform services for wages greater than the monthly exempt amount set for that month (see paragraph (e) of this section and § 404.430); and (iii) Do not work in non-covered remunerative activity on 7 or more days in a month while outside the United States. A non-service month occurs even if there are no excess earnings in the year.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.435(b)(1)',
      url: 'https://www.ecfr.gov/current/title-20/section-404.435',
      quotedText:
        'A beneficiary\'s initial grace year is the first taxable year in which the beneficiary has a non-service month (see paragraph (a)(7) of this section) in or after the month in which the beneficiary is entitled to a retirement, auxiliary, or survivor\'s benefit.',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS RS 02501.030, § A',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0302501030',
      quotedText:
        'The MET allows payment of benefits to a beneficiary even if they have substantial earnings prior to the month of entitlement (MOE). It allows a beneficiary who returns to substantial work later in that year to keep the benefits paid during those months when they were not working.',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS RS 02501.030, § C',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0302501030',
      quotedText:
        'A NSM is any month of entitlement, before FRA, that an entitled beneficiary neither earns wages of more than the monthly exempt amount nor performs substantial services in self-employment.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
      'packages/engine/src/model/plan.ts#wagesIncomeSchema',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'cfr-20-404-640-application-withdrawal-repayment': {
    title: 'Withdrawal of a benefit application with repayment is outside the Plan',
    statement:
      'A timely approved withdrawal with repayment treats the benefit application as never filed. The Plan represents one claim age per Social Security stream and has no application, withdrawal request, approval, repayment, claim reset, or replacement-claim action. No accepted Plan can therefore trigger this rule; changing a scalar claim age is not evidence that an already-filed application was withdrawn and repaid.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a benefit application distinct from the stream\'s scalar claimAge',
      'a withdrawal request and its approval',
      'the repayment of benefits already received',
      'a claim reset or replacement-claim action',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Absence-record surface is model/plan.ts: `socialSecurityIncomeSchema` stores a single `claimAge` alongside PIA and earnings inputs, with no first-entitlement month, written withdrawal request, approval/consent status, repayment amount, prior withdrawal, claim reset, or replacement-claim date. Its `strategiesSchema.retirementActions` accepts no Social Security application-withdrawal or repayment action. No accepted Plan can supply the conjunctive trigger facts without inventing them.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.640(b)(3)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-G/subject-group-ECFR25e4230c435dfbf/section-404.640',
      quotedText:
        'All benefits already paid based on the application being withdrawn are repaid or we are satisfied that they will be repaid.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.640(b)(4)(i)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-G/subject-group-ECFR25e4230c435dfbf/section-404.640',
      quotedText:
        'The request for withdrawal is filed within 12 months of the first month of entitlement; and',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.640(d)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-G/subject-group-ECFR25e4230c435dfbf/section-404.640',
      quotedText:
        'If we approve a request to withdraw an application, the application will be considered as though it was never filed. If we disapprove a request for withdrawal, the application is treated as though the request was never filed.',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS GN 00206.005, § A first bullet (12-month RIB filing)',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0200206005',
      quotedText:
        'The NH receiving Retirement Insurance Benefits (RIB) must submit the withdrawal request within 12 months of the first month of entitlement;',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS GN 00206.005, § A second bullet (repayment)',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0200206005',
      quotedText:
        'The beneficiary who requests a WD of their benefit application must repay all benefits he or she received, before we approve the withdrawal request. This includes Medicare payments (i.e., Hospital Insurance (HI) expenses paid by CMS, and Supplementary Medical Insurance (SMI) premiums withheld by SSA) and voluntary tax withholding (VTW) for closed tax years.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
    ],
  },

  'usc-42-415-f-2-post-entitlement-pia-recomputation': {
    title: 'Post-entitlement covered earnings can recompute a higher PIA',
    statement:
      'Covered earnings in a year for any part of which a worker is entitled to old-age benefits can require a PIA recomputation, effective the following January when it raises the PIA by at least one dollar. Higher post-entitlement earnings can enter the computation base and replace lower indexed years. simulate.ts resolves earnings-derived PIA once before the projection loop and never feeds projected wage income back into piaFromEarnings.ts, so it omits an otherwise higher benefit; whether that understates or overstates tax depends on how the spending shortfall is funded, since a traditional-account withdrawal replacing at-most-85-percent-taxable benefit dollars is fully taxable.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'simulate.ts has a real PIA-from-earnings path, so this is not an absence record: before projecting any year it resolves each Social Security stream\'s PIA once from `socialSecurityIncomeSchema.earnings` and optional pre-retirement `earningsProjection`. Later `wagesIncomeSchema` income is not appended to that history or recomputed. Closing 415(f)(2) also requires widening the base-year window in piaFromEarnings.ts (`computePiaFromEarnings` clamps `lastBaseYear` to eligibility-1), which is why that file stays in implementedBy. The companion fixture gives a fully insured worker ten AWI-level covered years (2013-2022), claims at 2029 FRA, and supplies 10,000 dollars of covered wages in 2030. The authority-side recomputation replaces a zero in the top-35 set: indexed earnings rise by 10,000, AIME from 1,518 to 1,542, and 2024 second-band PIA from 1,166.60 to 1,174.30 (delta 7.70, above the one-dollar threshold), so 2031 pays 14,091.60; the engine observably leaves the initially resolved 1,166.60 PIA in force and pays 13,999.20.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 415(a)(1)(A)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        '32 percent of the individual\'s average indexed monthly earnings to the extent that such earnings exceed the amount established for purposes of clause (i) but do not exceed the amount established for purposes of this clause by subparagraph (B), and',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(a)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'rounded, if not a multiple of $0.10, to the next lower multiple of $0.10, and thereafter increased as provided in subsection (i).',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(2)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'The number of an individual\'s benefit computation years equals the number of elapsed years reduced- (i) in the case of an individual who is entitled to old-age insurance benefits (except as provided in the second sentence of this subparagraph), or who has died, by 5 years, and',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(2)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'the term "benefit computation years" means those computation base years, equal in number to the number determined under subparagraph (A), for which the total of such individual\'s wages and self-employment income, after adjustment under paragraph (3), is the largest;',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(2)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'the term "computation base years" means the calendar years after 1950 and before- (I) in the case of an individual entitled to old-age insurance benefits, the year in which occurred (whether by reason of section 402(j)(1) of this title or otherwise) the first month of that entitlement; or (II) in the case of an individual who has died (without having become entitled to old-age insurance benefits), the year succeeding the year of his death; except that such term excludes any calendar year entirely included in a period of disability; and',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(f)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'If an individual has wages or self-employment income for a year after 1978 for any part of which he is entitled to old-age or disability insurance benefits, the Commissioner of Social Security shall, at such time or times and within such period as the Commissioner may by regulation prescribe, recompute the individual\'s primary insurance amount for that year.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(f)(2)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'A recomputation of any individual\'s primary insurance amount under this paragraph shall be made as provided in subsection (a)(1) as though the year with respect to which it is made is the last year of the period specified in subsection (b)(2)(B)(ii); and subsection (b)(3)(A) shall apply with respect to any such recomputation as it applied in the computation of such individual\'s primary insurance amount prior to the application of this subsection.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(f)(2)(D)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'in the case of an individual who did not die in that year, for monthly benefits beginning with benefits for January of the following year; or',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(f)(4)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'A recomputation shall be effective under this subsection only if it increases the primary insurance amount by at least $1.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.211(b)(2)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-C/subject-group-ECFR7fa0e3667334188/section-404.211',
      quotedText:
        'The year you become entitled to benefits and following years may be used as computation base years in a recomputation if their use would result in a higher primary insurance amount.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.211(e)(2)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-C/subject-group-ECFR7fa0e3667334188/section-404.211',
      quotedText:
        'For benefit computation years, we use the years with the highest amounts of earnings after indexing. They may include earnings from years that were not indexed, and must include years of no earnings if you do not have sufficient years with earnings.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings',
    ],
  },

  'usc-42-402-e-1-b-ii-cfr-20-404-335-disabled-widow-age-50-prescribed-period': {
    title: 'A disabled widow(er) may qualify at 50 only with timely statutory disability',
    statement:
      'A widow(er) may be entitled from age 50 rather than age 60 only while disabled and only when the disability began within the prescribed seven-year period. The Plan cannot make that claim: its Social Security stream has a single retirement `claimAge` clamped to 62–70, a worker-SSDI `disability.onsetAge` that is not linked to a deceased-worker record, and no DWB disability determination, death/last-entitlement date, prescribed-period, waiting-period, SSI, or application facts. No accepted Plan therefore reaches the disabled-widow(er) branch or produces a DWB amount.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a survivor claim age below 62: claimAge is clamped to ages 62 through 70',
      'a disabled-widow(er) disability determination linked to a deceased worker\'s record, rather than the worker\'s own disability.onsetAge',
      'the death or last-entitlement date the prescribed seven-year period runs from',
      'the waiting period, SSI, and application facts the branch also turns on',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This folds the age-50 and seven-year limbs into one record. Section 402(e)(1)(B)(ii) makes the age exception conditional on disability beginning before paragraph (4)\'s period ends, and 20 CFR 404.335(c)(1) supplies the seven-year timing test. A separate record would name the same missing DWB claim surface and would not identify an independent implemented calculation. The generic survivor path and the generic worker-SSDI onset field do not make a DWB claim: formerSpouseSchema has no death date or prescribed-period anchor, and the disability object has only an onset age.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(1)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'has attained age 50 but has not attained age 60 and is under a disability (as defined in section 423(d) of this title) which began before the end of the period specified in paragraph (4),',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(c), (c)(1)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        "You are at least 60 years old; or you are at least 50 years old and have a disability as defined in § 404.1505 and you meet all of the conditions in paragraphs (c)(1) through (4) of this section: (1) Your disability started not later than 7 years after the insured died or 7 years after you were last entitled to mother's or father's benefits or to widow's or widower's benefits based upon a disability, whichever occurred last.",
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS DI 10110.001, § A',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0410110001',
      quotedText:
        'To be eligible for DWB benefits, a widow(er) must have attained age 50, but not attained age 60.',
    }, {
      kind: 'agencyGuidance',
      citation: 'SSA POMS DI 10110.001, § D',
      url: 'https://secure.ssa.gov/poms.nsf/lnx/0410110001',
      quotedText:
        'To qualify for disability benefits, a widow(er) (including certain surviving divorced spouses) must be found disabled before the end of a certain prescribed period as defined in the law.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
    ],
  },

  'usc-42-403-a-6-ssdi-family-maximum': {
    title: 'The SSDI family maximum is AIME-based, not the retirement/survivor bend-point formula',
    statement:
      'For a worker entitled to disability insurance benefits, the family maximum is the smaller of 85 percent of AIME (but no less than 100 percent of PIA) and 150 percent of PIA. The engine instead applies the retirement/survivor marginal bend-point formula whenever its generic current-spouse path calls `capAuxiliaryForFamilyMaximum`, including when the worker is receiving SSDI. That produces a family-benefit figure for an expressible SSDI household but can be materially different from the disability maximum; for example, an AIME of 500 and PIA of 450 gives a statutory maximum of 450 a month (5,400 a year), while the retirement first tier gives 675, and the companion household observably receives 8,100 a year.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'Section 403(a)(6)\'s 85/100/150 percentages are the controlling disability-family formula. POMS RS 00615.736 is omitted here because it instructs the ordinary PIA bend-point maximum for people who become disabled — the exact retirement/survivor reading this record rejects. The sign is not one-sided in taxpayer-tax terms: a too-large or too-small Social Security amount changes taxable benefits, and a spending shortfall can instead be funded with withdrawals whose tax character depends on the account used.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 403(a)(6)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section403&num=0&edition=prelim',
      quotedText:
        "Notwithstanding any of the preceding provisions of this subsection other than paragraphs (3)(A), (3)(C), (3)(D), (4), and (5) (but subject to section 415(i)(2)(A)(ii) of this title), the total monthly benefits to which beneficiaries may be entitled under sections 402 and 423 of this title for any month on the basis of the wages and self-employment income of an individual entitled to disability insurance benefits shall be reduced (before the application of section 424a of this title) to the smaller of- (A) 85 percent of such individual's average indexed monthly earnings (or 100 percent of his primary insurance amount, if larger), or (B) 150 percent of such individual's primary insurance amount.",
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/socialSecurity/familyMaximum.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/familyMaximum.ts#capAuxiliaryForFamilyMaximum',
      'packages/engine/src/socialSecurity/familyMaximum.ts#familyMaximumMonthlyFromPia',
    ],
  },

  'usc-42-402-c-2-ssdi-spouse-auxiliary': {
    title: 'An SSDI spouse auxiliary is one-half PIA before the disability-family reduction',
    statement:
      'A qualifying husband on a living disabled worker\'s record has a one-half-PIA auxiliary amount before the family maximum reduces it. The generic current-spouse code does compute a 50-percent PIA top-up, but it applies a retirement `claimAge` gate to the disabled worker and uses the retirement/survivor family maximum. Thus an expressible 58-year-old SSDI worker with a 67-year-old spouse receives no auxiliary until the worker\'s irrelevant retirement claim age. The engine returns a benefit figure, so this is an approximation rather than a refused auxiliary rule.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The disability limb of section 402(c)(1) quoted on this record lets a husband qualify on a worker entitled to disability insurance benefits without waiting for that worker to claim old-age benefits. annualSocialSecurity.ts nevertheless calculates `higherPayableMonths` from the worker stream\'s 62–70 `claimAge`, even though the SSDI branch disregards it for the worker payment. Section 425(a) also makes the worker\'s disability-benefit suspension suspend auxiliaries on that wage record, while the generic post-top-up SGA pass zeros only the worker. Benefit errors can affect taxable Social Security or trigger a taxable, tax-free, or gain-bearing replacement withdrawal, so the taxpayer-tax sign varies.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(c)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        "in the case of a husband or divorced husband (as so defined) of- (I) an individual entitled to old-age insurance benefits, if such husband or divorced husband has not attained retirement age (as defined in section 416(l) of this title), or (II) an individual entitled to disability insurance benefits, the first month throughout which he is such a husband or divorced husband and meets the criteria specified in subparagraphs (B), (C), and (D) (if in such month he meets the criterion specified in subparagraph (A)), whichever is earlier, and ending with the month preceding the month in which any of the following occurs:",
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(c)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        "Except as provided in subsection (q), such husband's insurance benefit for each month shall be equal to one-half of the primary insurance amount of his wife (or, in the case of a divorced husband, his former wife) for such month.",
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 425(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section425&num=0&edition=prelim',
      quotedText:
        'Whenever the benefits of an individual entitled to a disability insurance benefit are suspended for any month, the benefits of any individual entitled thereto under subsection (b), (c), or (d) of section 402 of this title, on the basis of the wages and self-employment income of such individual, shall be suspended for such month.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/socialSecurity/familyMaximum.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/familyMaximum.ts#capAuxiliaryForFamilyMaximum',
    ],
  },

  'usc-42-402-d-2-ssdi-child-auxiliary': {
    title: 'Living-child SSDI auxiliary benefits are outside the Plan',
    statement:
      'The engine does not create a child SSDI auxiliary. A living disabled worker\'s eligible child receives one-half of the worker\'s primary insurance amount under section 402(d)(2), and section 403(a) can reduce benefits on that worker\'s record to the family maximum; the Plan has no child person, dependency, age/student/disability eligibility, or child Social Security stream through which either amount can be reached.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a child person in householdSchema',
      'the child\'s dependency on the disabled worker',
      'the age, student, or disability eligibility the benefit turns on',
      'a child Social Security stream to pay one-half of the PIA into',
      'the section 403(a) family maximum applied across one worker\'s record',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Absence-record surface is model/plan.ts: `household.hasQualifyingDependent` is a tax-filing boolean, not a child identity, dependency, age, student, disability, or Social Security-benefit record. familyMaximum.ts therefore caps only a modeled current-spouse auxiliary and has no child allocation to price. No accepted Plan supplies the trigger facts for a living-child SSDI auxiliary.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(d)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        "Such child's insurance benefit for each month shall, if the individual on the basis of whose wages and self-employment income the child is entitled to such benefit has not died prior to the end of such month, be equal to one-half of the primary insurance amount of such individual for such month.",
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#householdSchema',
    ],
  },

  'cfr-20-404-1584-blind-sga-monthly-amount': {
    title: 'Blind SGA is a separate wage-indexed monthly amount',
    statement:
      'For 2026, the statutorily blind SGA amount is 2,830 dollars per month, distinct from the 1,690-dollar non-blind amount in the parameter pack. The regulation supplies a separate blindness rule whose post-1995 increases depend on the national average wage index. The Plan has no statutory-blindness fact and the parameter pack has only `sgaMonthlyNonBlind`, so no accepted input can select the blind amount or route it to the SSDI gate; the engine does not produce a blind-SGA figure.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a statutory-blindness fact on socialSecurityIncomeSchema',
      'a blind SGA monthly amount in the parameter pack, which carries only sgaMonthlyNonBlind',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This follows the authority shape of cfr-20-404-1574-b-2-sga-non-blind-monthly-amount: the current-year amount is a wage-indexed determination, not an OACT table lookup. The staged eCFR text establishes that blindness has a distinct guideline and wage-indexing method. The implementation surface is absent in both model/plan.ts and params/types.ts/year2026.ts: there is no blindness input, `sgaMonthlyBlind`, or branch selecting one.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.1584(d)(3)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-P/subject-group-ECFR3694c7fc1368ec8/section-404.1584',
      quotedText:
        'For taxable years beginning 1978, if you are blind, the law provides different earnings guidelines for determining if your earnings from your work activities are substantial gainful activity. Ordinarily, we consider your work to be substantial gainful activity, if your average monthly earnings are more than those shown in Table I. For years after 1977 and before 1996, increases in the substantial gainful activity guideline were linked to increases in the monthly exempt amount under the retirement earnings test for individuals aged 65 to 69. Beginning with 1996, increases in the substantial gainful activity amount have depended only on increases in the national average wage index.',
    }, {
      kind: 'regulation',
      citation: 'SSA, Cost-of-Living Increase and Other Determinations for 2026, 90 FR 49047 (Nov. 3, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-03/html/2025-19763.htm',
      quotedText:
        'Because $2,830 exceeds the current amount of $2,700, the monthly SGA amount for statutorily blind individuals is $2,830 for 2026.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/types.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/params/types.ts#sgaMonthlyNonBlind',
    ],
  },

  'cfr-20-404-1592-trial-work-period': {
    title: 'The nine-service-month trial work period preserves SSDI',
    statement:
      'During one trial work period, a disabled beneficiary may perform services in as many as nine nonconsecutive months without those services showing that disability ended. The annual engine instead suspends every pre-FRA SSDI benefit when annual wages exceed twelve non-blind SGA months, with no service-month count, trial-work start, application, entitlement, self-employment-hours, or monthly wage facts. A working-SSDI Plan is expressible and returns zero benefits where a first qualifying service month is still protected, so the annual output is an approximation.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The companion fixture assigns the same 20,281-dollar 2026 total either to a first January service month or to a ninth December service month after entitlement, leaving the other eleven months at zero in each case. Both are still protected trial-work months, so the authority-side annual benefit remains 24,000 dollars on a 2,000-dollar PIA. The annual Plan makes those distinct monthly cases identical and annualSocialSecurity.ts treats both as annual SGA, returning a suspended annual benefit. The opposite monthly concentration can make an annual total look harmless while an SGA month is payable differently, and replacement-spending taxation depends on its funding source; neither tax direction is one-sided.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.1592(a)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-P/subject-group-ECFR47cbdc321ec526a/section-404.1592',
      quotedText:
        'The trial work period is a period during which you may test your ability to work and still be considered disabled. It begins and ends as described in paragraph (e) of this section. During this period, you may perform services (see paragraph (b) of this section) in as many as 9 months, but these months do not have to be consecutive. We will not consider those services as showing that your disability has ended until you have performed services in at least 9 months.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.1592(b)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-P/subject-group-ECFR47cbdc321ec526a/section-404.1592',
      quotedText:
        'When used in this section, services means any activity (whether legal or illegal), even though it is not substantial gainful activity, which is done in employment or self-employment for pay or profit, or is the kind normally done for pay or profit.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/socialSecurity/disability.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/disability.ts#ssdiSuspendedBySga',
    ],
  },

  'cfr-20-404-1592a-extended-period-of-eligibility': {
    title: 'The 36-month extended period of eligibility tests SGA by month',
    statement:
      'After nine months of trial work, the extended period of eligibility can run for 36 months. The first post-trial-work SGA month and the next two months remain payable, later payments stop only for months with SGA, and benefits restart in a non-SGA month without a new application. The engine has no trial-work completion or reentitlement state and compares only annual wages to annualized SGA, so it returns an annual SSDI amount that can disagree with the required monthly sequence for an otherwise expressible working-SSDI Plan.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The companion fixtures use the same expressible 20,281-dollar annual wage total after trial work has ended. When it is earned in January alone, January and the next two months are payable under the grace rule and payment restarts from April, for a 24,000-dollar annual benefit on a 2,000-dollar PIA. When it is spread at more than monthly SGA across all twelve months, only the three grace months are payable, for 6,000 dollars. annualSocialSecurity.ts cannot distinguish the two monthly histories and produces its whole-year SGA suspension for both. The taxpayer-tax direction changes with the monthly pattern and with the account used to fill any spending shortfall.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.1592a(a)(2)(i)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-P/subject-group-ECFR47cbdc321ec526a/section-404.1592a',
      quotedText:
        'If we determine under paragraph (a)(1) of this section that your disability ceased during the reentitlement period because you perform substantial gainful activity, you will be paid benefits for the first month after the trial work period in which you do substantial gainful activity (i.e., the month your disability ceased) and the two succeeding months, whether or not you do substantial gainful activity in those succeeding months. After those three months, we will stop your benefits for any month in which you do substantial gainful activity.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.1592a(a)(2)(i)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-P/subject-group-ECFR47cbdc321ec526a/section-404.1592a',
      quotedText:
        'If your benefits are stopped because you do substantial gainful activity, they may be started again without a new application and a new determination of disability if you stop doing substantial gainful activity in a month during the reentitlement period. In determining whether you do substantial gainful activity in a month for purposes of stopping or starting benefits during the reentitlement period, we will consider only your work in, or earnings for, that month.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.1592a(b)(2)(ii)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-P/subject-group-ECFR47cbdc321ec526a/section-404.1592a',
      quotedText:
        'The last day of the 36th month following the end of your trial work period if you were entitled to benefits after December 1987 or if the 15-month period described in paragraph (b)(2)(i) of this section had not ended as of January 1988.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/socialSecurity/disability.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/disability.ts#ssdiSuspendedBySga',
    ],
  },

  'cfr-20-404-1592b-expedited-reinstatement': {
    title: 'Expedited reinstatement is available within 60 months of work termination',
    statement:
      'A former disability beneficiary whose entitlement terminated because of work may request reinstatement if substantial gainful activity stops within 60 months, the current impairment is the same as or related to the prior impairment, and the person is disabled. The Plan has no prior termination, termination date, request, current/prior-impairment relationship, or reinstatement state, so no accepted input reaches expedited reinstatement and the engine produces no EXR figure.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a prior disability entitlement that terminated because of work, and its termination date',
      'a reinstatement request',
      'the relationship between the current impairment and the prior one',
      'a reinstatement state for the projection to carry',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'A `disability.onsetAge` is a prospective worker-SSDI switch, not a terminated-entitlement history or a medical finding. Treating a new onset age as a reinstatement would invent all of the facts that distinguish EXR from a new application. The annual SGA suspension is not EXR workflow and must not be presented as one.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.1592b',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-P/subject-group-ECFR47cbdc321ec526a/section-404.1592b',
      quotedText:
        'The expedited reinstatement provision provides you another option for regaining entitlement to benefits when we previously terminated your entitlement to disability benefits due to your work activity. The expedited reinstatement provision provides you the option of requesting that your prior entitlement to disability benefits be reinstated, rather than filing a new application for a new period of entitlement.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.1592b',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-P/subject-group-ECFR47cbdc321ec526a/section-404.1592b',
      quotedText:
        'Since January 1, 2001, you can request to be reinstated to benefits if you stop doing substantial gainful activity within 60 months of your prior termination. You must not be able to do substantial gainful activity because of your medical condition. Your current impairment must be the same as or related to your prior impairment and you must be disabled.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
    ],
  },

  'usc-42-415-b-2-b-disability-freeze-aime-exclusion': {
    title: 'A disability freeze excludes disability years from AIME computation',
    statement:
      'Benefit-computation and elapsed-year definitions exclude calendar years entirely or partly within a period of disability, so disability zeros do not remain in the AIME divisor. The Plan\'s Social Security stream already carries `disability.onsetAge`, but piaFromEarnings.ts builds the ordinary age-22-through-61 base window, removes only five low years, and never reads that onset when computing AIME, and simulate.ts resolves earnings-derived PIA through that same helper before the projection loop. The engine therefore returns an AIME (and the SSDI benefit derived from it) for an expressible earnings-and-onset input that is lower than the disability-freeze reading when disability years contain zero earnings.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The fixture uses a 1964 worker with 33 pre-disability earnings years indexed to 69,846 dollars each and seven wholly disabled zero-earnings years from 2019 through 2025, with `disability.onsetAge` 55 (2019 onset). The statutory reading excludes the seven disability years, then applies the ordinary five-year dropout to 33 elapsed years: 28 × 69,846 ÷ (28 × 12), floored, equals an AIME of 5,820. The code has the onset fact but no exclusion pass; it carries two of the seven zeros after its five-year dropout and observably returns an AIME of 5,487 (33 × 69,846 ÷ 420, floored). The simulate-level companion observes the benefit paid from that unfrozen AIME against the freeze-side benefit. A lower or higher Social Security benefit can alter taxable benefits or the tax character of replacement withdrawals, so the taxpayer-tax sign varies.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(2)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'the term "computation base years" means the calendar years after 1950 and before- (I) in the case of an individual entitled to old-age insurance benefits, the year in which occurred (whether by reason of section 402(j)(1) of this title or otherwise) the first month of that entitlement; or (II) in the case of an individual who has died (without having become entitled to old-age insurance benefits), the year succeeding the year of his death; except that such term excludes any calendar year entirely included in a period of disability; and',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(2)(B)(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'the term "number of elapsed years" means (except as otherwise provided by section 104(j)(2) of the Social Security Amendments of 1972) the number of calendar years after 1950 (or, if later, the year in which the individual attained age 21) and before the year in which the individual died, or, if it occurred earlier (but after 1960), the year in which he attained age 62; except that such term excludes any calendar year any part of which is included in a period of disability.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings',
    ],
  },

  'usc-42-423-c-2-ssdi-five-month-waiting-period': {
    title: 'SSDI begins only after a five-month waiting period',
    statement:
      'Disability insurance benefits begin with the first month after a five consecutive calendar-month waiting period throughout which the worker has been under a disability. The Plan\'s integer-year `disability.onsetAge` is modeled as a January-equivalent onset, so the statutory waiting period is January through May and at most seven post-waiting months are payable in the onset year. disability.ts and annualSocialSecurity.ts instead pay the full annual SSDI amount from the onset year with no waiting-period proration.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. For a January-equivalent onset and a 2,000-dollar PIA, section 423 pays at most seven months (14,000) in the onset year while the engine observably pays twelve (24,000). Extra early benefit raises taxable Social Security income; when spending is instead funded from a traditional account the missing-benefit case replaces each dollar with a fully taxable withdrawal, so the taxpayer-tax sign flips with the funding channel.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 423(c)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section423&num=0&edition=prelim',
      quotedText:
        'The term "waiting period" means, in the case of any application for disability insurance benefits, the earliest period of five consecutive calendar months- (A) throughout which the individual with respect to whom such application is filed has been under a disability, and',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 423(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section423&num=0&edition=prelim',
      quotedText:
        'shall be entitled to a disability insurance benefit (i) for each month beginning with the first month after his waiting period (as defined in subsection (c)(2)) in which he becomes so entitled to such insurance benefits,',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/socialSecurity/disability.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/disability.ts#inSsdiWindow',
    ],
  },

  'usc-42-423-a-2-402-q-retirement-claim-before-disability-onset': {
    title: 'A reduced retirement claim before later disability onset carries into DIB',
    statement:
      'When a worker claims reduced old-age benefits at 62 and later becomes entitled to disability insurance benefits before FRA, section 423(a)(2)\'s 402(q) exception and section 402(q)(2) keep a reduction on the disability benefit, and the reduced retirement benefit remains payable until disability onset. annualSocialSecurity.ts enters the SSDI branch whenever `disability.onsetAge` is set below FRA years and `continue`s past the retirement-claim path, so it pays nothing before onset and the full unreduced PIA from onset.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. For claimAge 62, onsetAge 65, FRA 67, and a 2,000-dollar PIA, the authority-side amounts are 16,800 before onset (70 percent retirement factor) and 19,200 from onset (402(q)(2) treats retirement age as attained in the first DIB month, so a 36-month reduction period yields an 80 percent factor). The engine observably pays 0 before onset and 24,000 from onset. Extra or missing benefit changes taxable Social Security income, and a spending shortfall can be funded from accounts whose tax character differs, so the taxpayer-tax sign is not one-sided.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 423(a)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section423&num=0&edition=prelim',
      quotedText:
        "Except as provided in section 402(q) of this title and section 415(b)(2)(A)(ii) of this title, such individual's disability insurance benefit for any month shall be equal to his primary insurance amount for such month determined under section 415 of this title",
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(q)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'Subject to paragraph (9), if the first month for which an individual is entitled to an old-age, wife\'s, husband\'s, widow\'s, or widower\'s insurance benefit is a month before the month in which such individual attains retirement age, the amount of such benefit for such month and for any subsequent month shall, subject to the succeeding paragraphs of this subsection, be reduced by-',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(q)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'If an individual is entitled to a disability insurance benefit for a month after a month for which such individual was entitled to an old-age insurance benefit, such disability insurance benefit for each month shall be reduced by the amount such old-age insurance benefit would be reduced under paragraphs (1) and (4) for such month had such individual attained retirement age (as defined in section 416(l) of this title) in the first month for which he most recently became entitled to a disability insurance benefit.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'usc-42-423-a-2-cfr-20-404-317-ssdi-full-pia-fra-conversion': {
    title: 'SSDI pays the full PIA until retirement age, then the PIA continues as retirement',
    statement:
      'The monthly SSDI benefit equals the worker\'s PIA, not an early-retirement-reduced amount. Disability entitlement ends before the month retirement age is attained; the engine changes the published source from SSDI to own retirement at FRA but preserves the same PIA amount and does not award delayed credits. That is the correct payable-dollar continuation for the modeled worker-only SSDI path when onset is already active and the five-month waiting period is ignored. This record is limited to that unreduced-amount identity: the five-month waiting period is registered separately at usc-42-423-c-2-ssdi-five-month-waiting-period; the Subpart C eligibility-year computation, which treats the worker as attaining 62 at the start of the waiting period where piaFromEarnings.ts uses the ordinary age-62 year, is unmodeled and deliberately unregistered here pending its own record; and a retirement claim that precedes a later pre-FRA disability onset is registered at usc-42-423-a-2-402-q-retirement-claim-before-disability-onset. Workers\'-compensation and public-disability offsets remain unmodeled and unregistered.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The stream\'s `claimAge` is deliberately ignored while its disability onset is active before FRA, so importing the ordinary age-62 factor would give the wrong amount. At FRA the code stays on the SSDI branch and only relabels the published source to own retirement at the same full PIA, rather than treating the change as a new claim or a DRC opportunity. The companion fixture extends the observed object through the first post-FRA year so the no-DRC continuation is pinned, and adds a 1959-born (FRA 66y10m) cohort observation for the fra.years-only gate.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 423(a)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section423&num=0&edition=prelim',
      quotedText:
        "Except as provided in section 402(q) of this title and section 415(b)(2)(A)(ii) of this title, such individual's disability insurance benefit for any month shall be equal to his primary insurance amount for such month determined under section 415 of this title",
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 423(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section423&num=0&edition=prelim',
      quotedText:
        'ending with the month preceding whichever of the following months is the earliest: the month in which he dies, the month in which he attains retirement age (as defined in section 416(l) of this title), or, subject to subsection (e), the termination month.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.317',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR545f4aa361a6356/section-404.317',
      quotedText:
        'Your monthly benefit is equal to the primary insurance amount (PIA). This amount is computed under the rules in subpart C of this part as if it was an old-age benefit',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/socialSecurity/disability.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/disability.ts#ssdiMonthlyBenefit',
    ],
  },

  'usc-42-426-b-disability-trial-work-medicare-continuation': {
    title: 'Disabled-worker Medicare continuation after trial work is not modeled',
    statement:
      'For a disabled worker whose trial-work period has ended and whose entitlement later terminates, section 426(b) deems the worker still entitled for qualifying consecutive months, capped at 78 months; it also substitutes 15 months for the 36-month termination rule when fixing that end point. The staged statute does not state the queue row\'s standalone 93-month continuation, so the registry does not assert that number. The Plan has only an integer SSDI onset age: it cannot represent trial-work timing, termination, continuing impairment, the substantial-gainful-activity counterfactual, or a Medicare Part A entitlement interval, and the engine produces no coverage result from those facts.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'trial-work-period timing: the stream carries only an integer disability.onsetAge',
      'the later termination of entitlement',
      'continuing impairment after that termination',
      'the substantial-gainful-activity counterfactual the deeming rule turns on',
      'a Medicare Part A entitlement interval to extend',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is an input and result boundary. socialSecurityIncomeSchema carries only disability.onsetAge, and disability.ts/annualSocialSecurity.ts use it to price an annual SSDI stream; neither accepts a trial-work ending date, subsequent termination, continuing impairment, counterfactual inability to engage in substantial gainful activity, or Part A coverage. A generic healthcare expense cannot turn those absent facts into an entitlement interval. The 78-month cap and the substituted 15-month rule are quoted exactly; no CMS guidance establishing the queue\'s 93-month formulation was staged.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 426(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section426&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, an individual who has had a period of trial work which ended as provided in section 422(c)(4)(A) of this title, and whose entitlement to benefits or status as a qualified railroad retirement beneficiary as described in paragraph (2) has subsequently terminated, shall be deemed to be entitled to such benefits or to occupy such status (notwithstanding the termination of such entitlement or status) for the period of consecutive months throughout all of which the physical or mental impairment, on which such entitlement or status was based, continues, and throughout all of which such individual would have been entitled to monthly insurance benefits under this subchapter or as a qualified railroad retirement beneficiary had such individual been unable to engage in substantial gainful activity, but not in excess of 78 such months.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 426(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section426&num=0&edition=prelim',
      quotedText:
        'In determining when an individual\'s entitlement or status terminates for purposes of the preceding sentence, the term "36 months" in the second sentence of section 423(a)(1) of this title, in section 402(d)(1)(G)(i) of this title, in the last sentence of section 402(e)(1) of this title, and in the last sentence of section 402(f)(1) of this title shall be applied as though it read "15 months".',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/socialSecurity/disability.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#socialSecurityIncomeSchema',
      'packages/engine/src/socialSecurity/disability.ts#inSsdiWindow',
    ],
  },
  'irc-86-b-2-provisional-income-modified-agi': {
    title: 'What enters provisional income for taxing Social Security',
    statement:
      'The figure compared against the base amounts is modified adjusted gross income plus one-half of the benefits received, where modified AGI is AGI computed without regard to sections 85(c), 135, 137, 221, 911, 931, and 933 and increased by tax-exempt interest. Tax-exempt interest and excluded foreign earned income therefore raise the taxable share of benefits without ever entering AGI.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine adds back only the 911, 931, and 933 exclusions and tax-exempt interest. The other four add-backs in 86(b)(2)(A) are sections 85(c), 135, 137, and 221, which cover unemployment compensation, education savings bond interest, adoption assistance, and student loan interest. None can plausibly appear in a household this engine models alongside Social Security benefits, so omitting them is a scope decision rather than a reading of the statute. Note the base amounts in 86(c) carry no inflation adjustment and have not moved since 1983 and 1993, which is why the engine holds them as unindexed constants.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 86(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section86&num=0&edition=prelim',
      quotedText:
        'A taxpayer is described in this subsection if- (A) the sum of- (i) the modified adjusted gross income of the taxpayer for the taxable year, plus (ii) one-half of the social security benefits received during the taxable year, exceeds (B) the base amount.',
    }, {
      kind: 'statute',
      citation: 'IRC 86(b)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section86&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "modified adjusted gross income" means adjusted gross income- (A) determined without regard to this section and sections 85(c), 135, 137, 221, 911, 931, and 933, and (B) increased by the amount of interest received or accrued by the taxpayer during the taxable year which is exempt from tax.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
    implementedByFunctions: [
      'packages/engine/src/tax/federalTax.ts#taxableSocialSecurity',
    ],
  },
  'irc-86-c-provisional-income-thresholds': {
    title: 'The Social Security base amounts are fixed dollars, and the joint figure is not double',
    statement:
      'The two provisional-income thresholds that gate benefit taxation are the base amount, 25,000 for an unmarried filer and 32,000 on a joint return, and the adjusted base amount, 34,000 and 44,000. Section 86 contains no cost-of-living provision of any kind, so all four figures have stood in the same nominal dollars since 1993 and move only by legislation. Two errors follow from forgetting that. Scaling them with an inflation factor understates taxable Social Security in every projected year, because the whole design of the section is that a rising nominal benefit crosses a still threshold. And the joint amounts are not twice the unmarried ones -- 32,000 against 25,000 and 44,000 against 34,000 -- so the doubling that holds for the standard deduction must not be carried across to these.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The base amount is zero rather than 25,000 for a married taxpayer who files separately and did not live apart from the spouse for the whole year, which makes the whole benefit taxable at the 85 percent rate. The engine has no married-filing-separately status, so that case cannot arise; the record notes it because a later filing status added without reading 86(c)(1)(C) would inherit the unmarried figure and understate the tax by the largest margin the section allows.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 86(c)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section86&num=0&edition=prelim',
      quotedText:
        'Base amount and adjusted base amount For purposes of this section- (1) Base amount The term "base amount" means- (A) except as otherwise provided in this paragraph, $25,000, (B) $32,000 in the case of a joint return, and (C) zero in the case of a taxpayer who- (i) is married as of the close of the taxable year (within the meaning of section 7703) but does not file a joint return for such year, and (ii) does not live apart from his spouse at all times during the taxable year. (2) Adjusted base amount The term "adjusted base amount" means- (A) except as otherwise provided in this paragraph, $34,000, (B) $44,000 in the case of a joint return, and (C) zero in the case of a taxpayer described in paragraph (1)(C).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 1994,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/tax/federalTax.ts#taxableSocialSecurity',
    ],
  },
  'usc-42-430-b-contribution-and-benefit-base': {
    title: 'The OASDI contribution and benefit base is wage-indexed, not price-indexed',
    statement:
      'The Social Security taxable wage base for 2026 is 184,500. It is not a price-indexed figure. Section 230(b) of the Act sets it to the larger of the base already in effect and the 1994 base of 60,600 multiplied by the ratio of the national average wage index for the second preceding year to that for 1992, rounded to the nearest multiple of 300. For 2026 that product is 184,548.71 and it rounds to 184,500. Average wages have grown faster than consumer prices over almost every long window, so a projection that carries the base forward on a consumer-price factor understates it, and because the two rates compound the gap widens every year rather than staying a fixed percentage.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The parameter pack carries the base but no engine calculator reads it yet, and the engine has no national-average-wage path to carry it forward on: the plan supplies a general inflation assumption and nothing else. When a calculator does read it, scaling by general inflation will be a stand-in for wage indexing rather than a reading of section 230, and this record is where that has to be said. The same caution applies to the retirement earnings test exempt amounts, which are wage-indexed by the same ratio.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 USC 430(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section430&num=0&edition=prelim',
      quotedText:
        'The amount of such contribution and benefit base shall (subject to subsection (c)) be the amount of the contribution and benefit base in effect in the year in which the determination is made or, if larger, the product of- (1) $60,600, and (2) the ratio of (A) the national average wage index (as defined in section 409(k)(1) of this title) for the calendar year before the calendar year in which the determination under subsection (a) is made to (B) the national average wage index (as so defined) for 1992, with such product, if not a multiple of $300, being rounded to the next higher multiple of $300 where such product is a multiple of $150 but not of $300 and to the nearest multiple of $300 in any other case.',
    }, {
      kind: 'regulation',
      citation: 'SSA, Cost-of-Living Increase and Other Determinations for 2026, 90 FR 49047 (Nov. 3, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-03/html/2025-19763.htm',
      quotedText:
        'Multiplying the 1994 OASDI contribution and benefit base ($60,600) by the ratio of the national average wage index for 2024 ($69,846.57 as determined above) to that for 1992 ($22,935.42) produces $184,548.71. We round this amount to $184,500. Because $184,500 exceeds the current base amount of $176,100, the OASDI contribution and benefit base is $184,500 for 2026.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/params/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/params/types.ts#ParameterPack',
    ],
  },
  'usc-42-403-f-8-earnings-test-exempt-amounts': {
    title: 'The earnings test exempt amounts are wage-indexed, and the higher one is not a multiple of the lower',
    statement:
      'Section 203(f)(8)(B) of the Act sets each monthly exempt amount to the larger of the amount already in effect and a base monthly amount scaled by the ratio of the national average wage index for the second preceding year to that for a fixed reference year, rounded to the nearest multiple of 10. The two amounts run off different bases and different reference years: 670 against 1992 for a beneficiary below normal retirement age throughout the year, and 2,500 against 2000 for the year normal retirement age is attained. The annual amounts are exactly twelve times the monthly ones, giving 24,480 and 65,160 for 2026. Because the index is wages rather than prices, and because the two amounts are separately derived, neither one can be obtained by scaling the other or by applying the benefit cost-of-living increase to last year figure.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The projection carries both exempt amounts forward on the general inflation assumption because the engine has no national-average-wage path, and the plan supplies no wage growth input from which one could be built. That is a stand-in rather than a reading of section 203(f)(8)(B), and it biases the projected exempt amount low in the direction that withholds more benefit than the Act would, since wages have historically outrun prices. It is recorded here rather than left in the code because the fix is a new assumption rather than a change of formula.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 USC 403(f)(8)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section403&num=0&edition=prelim',
      quotedText:
        'Except as otherwise provided in subparagraph (D), the exempt amount which is applicable to individuals described in such subparagraph and the exempt amount which is applicable to other individuals, for each month of a particular taxable year, shall each be whichever of the following is the larger- (i) the corresponding exempt amount which is in effect with respect to months in the taxable year in which the determination under subparagraph (A) is made, or (ii) the product of the corresponding exempt amount which is in effect with respect to months in the taxable year ending after 2001 and before 2003 (with respect to individuals described in subparagraph (D)) or the taxable year ending after 1993 and before 1995 (with respect to other individuals), and the ratio of- (I) the national average wage index (as defined in section 409(k)(1) of this title) for the calendar year before the calendar year in which the determination under subparagraph (A) is made, to (II) the national average wage index (as so defined) for 2000 (with respect to individuals described in subparagraph (D)) or 1992 (with respect to other individuals), with such product, if not a multiple of $10, being rounded to the next higher multiple of $10 where such product is a multiple of $5 but not of $10 and to the nearest multiple of $10 in any other case.',
    }, {
      kind: 'regulation',
      citation: 'SSA, Cost-of-Living Increase and Other Determinations for 2026, 90 FR 49047 (Nov. 3, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-03/html/2025-19763.htm',
      quotedText:
        'Multiplying the 1994 retirement earnings test monthly exempt amount of $670 by the ratio of the national average wage index for 2024 ($69,846.57) to that for 1992 ($22,935.42) produces $2,040.39. We round this to $2,040. Because $2,040 exceeds the current exempt amount of $1,950, the lower retirement earnings test monthly exempt amount is $2,040 for 2026. The lower annual exempt amount is $24,480 under the retirement earnings test. ... Multiplying the 2002 retirement earnings test monthly exempt amount of $2,500 by the ratio of the national average wage index for 2024 ($69,846.57) to that for 2000 ($32,154.82) produces $5,430.49. We round this to $5,430. Because $5,430 exceeds the current exempt amount of $5,180, the higher retirement earnings test monthly exempt amount is $5,430 for 2026. The higher annual exempt amount is $65,160 under the retirement earnings test.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'cfr-20-404-1574-b-2-sga-non-blind-monthly-amount': {
    title: 'The non-blind substantial gainful activity amount is set by regulation and wage-indexed',
    statement:
      'The monthly earnings level that ordinarily shows substantial gainful activity for a non-blind beneficiary is fixed by regulation rather than by the Act, which supplies a formula only for the statutorily blind amount. Under 20 CFR 404.1574(b)(2)(ii) it is redetermined each year as the larger of the amount for the previous year and 700 multiplied by the ratio of the national average wage index for the second preceding year to that for 1998, rounded to the nearest multiple of 10. For 2026 that product is 1,694.05 and the amount is 1,690 a month, which the determination states supersedes 1,620. Two consequences follow. The figure moves with wages rather than prices, so carrying it forward on a consumer-price factor drifts low. And because it gates the whole SSDI benefit for the year rather than reducing it, an amount one year stale flips the benefit off for a beneficiary earning between the old and new levels.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The projection compares annual wages against twelve times the monthly amount, which is an annual-granularity stand-in: the regulation applies the level to average monthly earnings, so a beneficiary whose earnings are concentrated in part of the year is treated differently by the two. The regulation is also carried forward on the general inflation assumption rather than on the national average wage index, for want of a wage path in the engine. The Federal Register determination that fixes the year figure is registered under the regulation authority kind, which is also where the underlying 20 CFR provision sits; the enum has no member for an agency determination published in the Federal Register, and adding one is a schema decision rather than a research finding.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.1574(b)(2)(ii)',
      url: 'https://www.ecfr.gov/current/title-20/section-404.1574',
      quotedText:
        'Beginning January 1, 2001, and each year thereafter, they average more than the larger of: (A) The amount for the previous year, or (B) An amount adjusted for national wage growth, calculated by multiplying $700 by the ratio of the national average wage index for the year 2 calendar years before the year for which the amount is being calculated to the national average wage index for the year 1998. We will then round the resulting amount to the next higher multiple of $10 where such amount is a multiple of $5 but not of $10 and to the nearest multiple of $10 in any other case.',
    }, {
      kind: 'regulation',
      citation: 'SSA, Cost-of-Living Increase and Other Determinations for 2026, 90 FR 49047 (Nov. 3, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-03/html/2025-19763.htm',
      quotedText:
        'Section 223(d)(4)(A) of the Act specifies the formula for determining the SGA amount for statutorily blind individuals under title II while our regulations (20 CFR 404.1574 and 416.974) specify the formula for determining the SGA amount for non-blind individuals with a determined disability. ... Multiplying the 2000 monthly SGA amount for non-blind individuals with a determined disability ($700) by the ratio of the national average wage index for 2024 ($69,846.57) to that for 1998 ($28,861.44) produces $1,694.05. We then round this amount to $1,690. Because $1,690 exceeds the current amount of $1,620, the monthly SGA amount for non-blind individuals with a determined disability is $1,690 for 2026.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/socialSecurity/disability.ts',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/disability.ts#ssdiSuspendedBySga',
    ],
  },
  'irc-3101-a-oasdi-employee-tax-rate': {
    title: 'The employee-side OASDI rate is a flat statutory percentage',
    statement:
      'IRC 3101(a) imposes the old-age, survivors, and disability insurance tax on the employee at 6.2 percent of wages. The subsection states a single percentage, with no table of future rates and no cost-of-living provision, so the rate has been 6.2 percent since 1990 and moves only by legislation. The employer pays the same again under 3111(a) and a self-employed individual pays the combined 12.4 percent under 1401(a), which is why a lifetime-contributions readout has to say which side of the payroll tax it is describing: quoting 12.4 for an employee doubles what the person actually paid, and quoting 6.2 for a self-employed person halves it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The rate is carried in the parameter pack and consumed outside the engine, by the Social Security analysis page in the planner package, which the registry cannot name because implementedBy is checked against engine sources. The pack and its type are listed instead, which are the files a later reader would change.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 3101(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section3101&num=0&edition=prelim',
      quotedText:
        'In addition to other taxes, there is hereby imposed on the income of every individual a tax equal to 6.2 percent of the wages (as defined in section 3121(a)) received by the individual with respect to employment (as defined in section 3121(b)).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 1990,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/params/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/params/types.ts#ParameterPack',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

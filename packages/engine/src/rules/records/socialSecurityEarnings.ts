/**
 * Social Security earnings-history AIME records: the initial-computation
 * base-year window, annual wage-index rounding, computation-year count
 * with the five-year dropout and 1951 floor, and the contribution and benefit
 * base above which a year's earnings are not counted, and the cost-of-living
 * increases a PIA from earnings receives from its eligibility year.
 *
 * One slice of the tax rule registry. `../taxRuleRegistry.ts` composes every
 * slice into `TAX_RULE_REGISTRY`; read it for what a record must carry and why.
 * Disability-freeze exclusion and post-entitlement recomputation stay on the
 * `socialSecurity` shard; this module does not restate those records.
 */
import type { TaxRuleRecord } from '../taxRuleRegistry.js'

// `satisfies` without `as const`, matching the composed registry: keys and the
// union-typed fields (classification, kind, volatility) stay literal for
// describeRule's conditional typing, while the prose strings widen to `string`.
export const socialSecurityEarningsRecords = {
  'usc-42-415-b-2-b-ii-iii-initial-computation-base-window': {
    title: 'Initial-computation AIME can include years outside the age-22-to-61 elapsed span',
    statement:
      'For an ordinary initial old-age computation for a living worker with no period of disability and no prior disability-insurance entitlement, computation base years are the calendar years after 1950 and before the year of first old-age entitlement, while elapsed years run after 1950 or the year age 21 is attained, whichever is later, and before the year age 62 is attained. Benefit computation years are the highest indexed years drawn from that computation-base set, so a year that is a computation-base year but not an elapsed year — the year age 21 is attained, and years from age 62 through the year before first entitlement — can enter AIME. piaInputFromEarnings clamps lastEarningsYear to the age-61 year, and computePiaFromEarnings iterates only from 1951 or the year the worker turns 22, whichever is later, through the year before age 62 and does not take the first-entitlement year, so those earlier and later initial-computation earnings never enter the average. This is the initial-computation window, not the post-entitlement recomputation registered at usc-42-415-f-2-post-entitlement-pia-recomputation.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'A 1962-06-15 worker has first entitlement in 2029 at FRA 67 on the stream, which this helper projects out and treats as 2024 age-62 eligibility; indexing year 2022 AWI is 63,795.13. One three-cell test shares ten published-AWI years 2013-2022. Cell 1 adds 1983 (age 21, AWI 15,239.24) for authority AIME floor(11 × 63,795.13 / 420) = 1,670. Cell 2 adds explicit 2024 (age 62, pre-entitlement) at 42,000 unindexed for floor((10 × 63,795.13 + 42,000) / 420) = 1,618 and pins piaInputFromEarnings, which clamps lastEarningsYear to the age-61 year (2023) even when reported earnings include 2024. Cell 3 keeps last reported year 2023 with zero 2023 earnings and projects 42,000 through age 63 (only 2024), giving the same authority 1,618 while independently pinning computePiaFromEarnings, which iterates only 1984-2023 and ignores projected 2024 unless lastBaseYear is widened (mutation to 2028 yields 1,618 with projectedYearCount 1). Both clamps exclude age-21 and age-62 pre-entitlement earnings, so all three cells observably return 1,518. A competing lower-boundary-only reading includes 1983 but still ends at the year before 62, predicting 1,670, 1,518, 1,518. claimAge is expressible on the stream and unused by this helper. A lower or higher Social Security benefit can alter taxable benefits or the tax character of replacement withdrawals, so the taxpayer-tax sign varies.',
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
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(2)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'the term "benefit computation years" means those computation base years, equal in number to the number determined under subparagraph (A), for which the total of such individual\'s wages and self-employment income, after adjustment under paragraph (3), is the largest;',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.211(b)(2)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-C/subject-group-ECFR7fa0e3667334188/section-404.211',
      quotedText:
        'All years after 1950 up to (but not including) the year you become entitled to old-age or disability insurance benefits, and through the year you die if you had not been entitled to old-age or disability benefits, are computation base years for you.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.211(e)(1)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-C/subject-group-ECFR7fa0e3667334188/section-404.211',
      quotedText:
        'We count the years beginning with 1951, or (if later) the year you reach age 22, and ending with the earliest of the year before you reach age 62, become disabled, or die.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#piaInputFromEarnings',
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings',
    ],
  },

  'cfr-20-404-211-d-3-indexed-earnings-nearer-penny': {
    title: 'Each year\'s indexed earnings are rounded to the nearer penny',
    statement:
      'For an ordinary initial old-age computation for a living worker with no period of disability and no prior disability-insurance entitlement, covered earnings in each computation-base year through the indexing year are multiplied by the ratio of the national average wage index for the second year before eligibility to that year\'s index, and 20 CFR 404.211(d)(3) rounds each such product to the nearer penny; a year after the indexing year enters at its actual dollar amount. Average indexed monthly earnings are then the total of those amounts in the benefit-computation years divided by the months in those years, reduced to the next lower whole dollar. indexCoveredEarnings instead applies Math.floor to each indexed annual amount before that monthly average, so a published-AWI year whose unrounded product sits just below a dollar boundary can drop AIME by a dollar relative to nearer-penny indexing. Future unpublished AWI years are a separate latest-table stand-in and are not this rounding gap.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'A 1962-06-15 worker with 2020 earnings of 55,628.60 (that year\'s AWI) and 2023 earnings of 44.88, last year 2023, indexes 2020 to 63,795.13 and leaves 2023 nominal. Authority AIME is floor((63,795.13 + 44.88) / 420) = floor(63,840.01 / 420) = 152. The annual whole-dollar floor yields 63,795 + 44.88 = 63,839.88 and observably 151. Using unindexed nominals instead predicts floor((55,628.60 + 44.88) / 420) = 132. A lower or higher Social Security benefit can alter taxable benefits or the tax character of replacement withdrawals, so the taxpayer-tax sign varies.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'Except as provided by subparagraph (B), the wages paid in and self-employment income credited to each of an individual\'s computation base years for purposes of the selection therefrom of benefit computation years under paragraph (2) shall be deemed to be equal to the product of- (i) the wages and self-employment income paid in or credited to such year (as determined without regard to this subparagraph), and (ii) the quotient obtained by dividing- (I) the national average wage index (as defined in section 409(k)(1) of this title) for the second calendar year preceding the earliest of the year of the individual\'s death, eligibility for an old-age insurance benefit, or eligibility for a disability insurance benefit (except that the year in which the individual dies, or becomes eligible, shall not be considered as such year if the individual was entitled to disability insurance benefits for any month in the 12-month period immediately preceding such death or eligibility, but there shall be counted instead the year of the individual\'s eligibility for the disability insurance benefit to which he was entitled in such 12-month period), by (II) the national average wage index (as so defined) for the computation base year for which the determination is made.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(3)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'Wages paid in or self-employment income credited to an individual\'s computation base year which- (i) occurs after the second calendar year specified in subparagraph (A)(ii)(I), or (ii) is a year treated under subsection (f)(2)(C) as though it were the last year of the period specified in paragraph (2)(B)(ii), shall be available for use in determining an individual\'s benefit computation years, but without applying subparagraph (A) of this paragraph.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.211(d)(3)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-C/subject-group-ECFR7fa0e3667334188/section-404.211',
      quotedText:
        'We round the results to the nearer penny. (The quotient for your indexing year is 1.0; this means that your earnings in that year are used in their actual dollar amount; any earnings after your indexing year that may be used in computing your average indexed monthly earnings are also used in their actual dollar amount.)',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'An individual\'s average indexed monthly earnings shall be equal to the quotient obtained by dividing- (A) the total (after adjustment under paragraph (3)) of his wages paid in and self-employment income credited to his benefit computation years (determined under paragraph (2)), by (B) the number of months in those years.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(e)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'if an individual\'s average indexed monthly earnings or, in the case of an individual whose primary insurance amount is computed under subsection (a) as in effect prior to January 1979, average monthly wage, computed under subsection (b) or for the purposes of subsection (d) is not a multiple of $1, it shall be reduced to the next lower multiple of $1.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.211(f)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-C/subject-group-ECFR7fa0e3667334188/section-404.211',
      quotedText:
        'After we have indexed your earnings and found your benefit computation years, we compute your average indexed monthly earnings by\u2014 (1) Totalling your indexed earnings in your benefit computation years; (2) Dividing the total by the number of months in your benefit computation years; and (3) Rounding the quotient to the next lower whole dollar. if not already a multiple of $1.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#indexCoveredEarnings',
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings',
    ],
  },

  'usc-42-415-i-2-A-pia-cost-of-living-since-eligibility': {
    title: 'A PIA computed from earnings is raised by every cost-of-living increase since eligibility',
    statement:
      'Section 415(i)(2)(A)(ii) increases the primary insurance amount of each individual on which entitlement is based by each year’s cost-of-living increase, effective December, and floors each increased amount to a multiple of 10 cents; (iii) applies the increase of the year a person becomes eligible, and every later one, to that person’s PIA whatever the time of entitlement. computePiaFromEarnings gives the PIA of the eligibility year, the year the worker turns 62. simulate.ts raises it by piaFromEarnings.ts#piaWithCostOfLivingIncreases, one year at a time from the eligibility year through the year before the projection’s first year, at SSA’s published increase for each year (ssaWageData.ts#COLA_PCT_BY_YEAR, 1975 through 2025), flooring to the dime after each step, and the ledger’s own COLA factor then carries it on from the first year. A year SSA has not yet announced uses the plan’s COLA assumption and the projection warns. An entered PIA is taken to be in the first year’s dollars already.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Until 2026-09-27 the projection used the eligibility-year PIA of an earnings history as if it were in the first year’s dollars, and a person past 62 at the start lost every increase since. The companion test prices a single man born 1960-05-01 with 50,000 dollars of covered earnings in each year from 1982 through 2021, claiming at 67, from a 2026 start with no inflation. His 2022 PIA of 2,846.40 is raised by the December 2022 through 2025 increases, 8.7, 3.2, 2.5 and 2.8 percent, to 3,094.00, 3,193.00, 3,272.80 and 3,364.40, so 2027 pays 40,372.80 dollars where the old reading paid 34,156.80. The same chain takes a 1956 birth’s 2018 PIA of 2,551.90 through the eight increases 2018 to 2025 to 3,379.20. The increases are transcribed from SSA’s Cost-Of-Living Adjustments series (ssa.gov/oact/cola/colaseries.html), including the 2.5 percent Public Law 106-554 made effective for December 1999; the 1975 to 1982 increases were effective for June, which does not change a yearly product. The same stand-in convention as the other SSA tables fills a year not yet announced. The series in COLA_PCT_BY_YEAR ends with the increase effective December 2025: from 2027-01-01, when the planner’s first year is 2027, every earnings-history PIA past eligibility takes the plan’s COLA assumption for the December 2026 increase, with the projection’s warning, until SSA’s 2026 increase, announced in October 2026, is added to the table.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 415(i)(2)(A)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        '(II) the primary insurance amount of each other individual on which benefit entitlement is based under this subchapter, and',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(i)(2)(A)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'The increase shall be derived by multiplying each of the amounts described in subdivisions (I), (II), and (III) (including each of those amounts as previously increased under this subparagraph) by the applicable increase percentage; and any amount so increased that is not a multiple of $0.10 shall be decreased to the next lower multiple of $0.10.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(i)(2)(A)(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who becomes eligible for an old-age or disability insurance benefit, or who dies prior to becoming so eligible, in a year in which there occurs an increase provided under clause (ii), the individual\'s primary insurance amount (without regard to the time of entitlement to that benefit) shall be increased (unless otherwise so increased under another provision of this subchapter and, with respect to a primary insurance amount determined under subsection (a)(1)(C)(i)(I) in the case of an individual to whom that subsection (as in effect in December 1981) applied, subject to the provisions of subsection (a)(1)(C)(i) and clauses (iv) and (v) of this subparagraph (as then in effect)) by the amount of that increase and subsequent applicable increases, but only with respect to benefits payable for months after November of that year.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-27',
    implementedBy: [
      'packages/engine/src/insights/detectors/ssClaimMilestone.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
      'packages/engine/src/socialSecurity/ssaWageData.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/insights/detectors/ssClaimMilestone.ts#resolveOwnPiaMonthly',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#piaWithCostOfLivingIncreases',
      'packages/engine/src/socialSecurity/ssaWageData.ts#COLA_PCT_BY_YEAR',
    ],
  },

  'usc-42-415-e-1-earnings-above-the-base-not-counted': {
    title: 'A year’s earnings above that year’s contribution and benefit base are not counted, back to 1951',
    statement:
      'Section 415(e)(1) excludes from the average indexed monthly earnings the part of a year’s wages and self-employment income above that year’s limit: 3,600 dollars for 1951 through 1954, 4,200 for 1955 through 1958, 4,800 for 1959 through 1965, 6,600 for 1966 and 1967, 7,800 for 1968 through 1971, 9,000 for 1972, 10,800 for 1973, 13,200 for 1974, and the section 430 contribution and benefit base from 1975. computePiaFromEarnings caps each year at ssaWageData.ts#WAGE_BASE_BY_YEAR, which carries SSA’s published bases for every year from 1937 (3,000 dollars for 1937 through 1950) through 2026, before the year is wage-indexed, and uses the latest published base only for a later year SSA has not yet set. Computation base years are the calendar years after 1950 (section 415(b)(2)(B)(ii)), so no year before 1951 enters the average.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Until 2026-09-27 the base table started at 1979 and the helper capped any earlier year at the latest base, 184,500 dollars, so a 1978 wage of 50,000 dollars was counted in full rather than at that year’s 17,700 dollar base. The companion test prices a worker born in August 1956 with 50,000 dollars of covered earnings in every year from 1978 through 2017: 1978 counts 17,700, indexed by 48,642.15 over 10,556.03 to 81,561 dollars, the average indexed monthly earnings are 7,436 and the PIA 2,551.90 dollars, where counting the whole 50,000 gave 7,790 and 2,605.00. A second case, a worker born in 1925 with 20,000 dollars in 1960 and 1970, counts 4,800 and 7,800 over 31 computation years from 1951: 111 and 99.90 dollars, where the old window from 1947 and uncapped years gave 329 and 285.00. The planner’s paid-in estimate reads the same table. The bases are transcribed from SSA’s Contribution and Benefit Bases, 1937-2026 (ssa.gov/oact/cola/cbb.html, read 2026-09-27), and every row from 1979 already matched it. The old-start computation of 20 CFR 404.240 through 404.243, which can count earnings from 1937 through 1950 for a worker born in 1929 or earlier, is not modeled (the aime-covered-earnings-cap calculation states it as a limit).',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 415(e)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'in computing an individual\'s average indexed monthly earnings or, in the case of an individual whose primary insurance amount is computed under subsection (a) as in effect prior to January 1979, average monthly wage, there shall not be counted the excess over $3,600 in the case of any calendar year after 1950 and before 1955, the excess over $4,200 in the case of any calendar year after 1954 and before 1959, the excess over $4,800 in the case of any calendar year after 1958 and before 1966, the excess over $6,600 in the case of any calendar year after 1965 and before 1968, the excess over $7,800 in the case of any calendar year after 1967 and before 1972, the excess over $9,000 in the case of any calendar year after 1971 and before 1973, the excess over $10,800 in the case of any calendar year after 1972 and before 1974, the excess over $13,200 in the case of any calendar year after 1973 and before 1975, and the excess over an amount equal to the contribution and benefit base (as determined under section 430 of this title ) in the case of any calendar year after 1974 with respect to which such contribution and benefit base is effective,',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(2)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'the term "computation base years" means the calendar years after 1950 and before-',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-27',
    implementedBy: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
      'packages/engine/src/socialSecurity/ssaWageData.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings',
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#FIRST_COMPUTATION_BASE_YEAR',
      'packages/engine/src/socialSecurity/ssaWageData.ts#WAGE_BASE_BY_YEAR',
      'packages/engine/src/socialSecurity/ssaWageData.ts#wageBaseForYearOrLatest',
    ],
  },

  'usc-42-415-b-2-a-i-computation-years-five-year-dropout': {
    title: 'Old-age computation years are elapsed years reduced by five, starting at 1951',
    statement:
      'For an ordinary initial old-age computation for a living worker with no period of disability and no prior disability-insurance entitlement, the number of old-age benefit computation years equals the number of elapsed years reduced by 5, and those years are the computation-base years with the largest indexed earnings. Elapsed years are the calendar years after 1950, or after the year age 21 is attained if later, and before the year age 62 is attained, equivalently counted beginning with 1951, or the year the worker reaches 22 if later, through the year before 62. computePiaFromEarnings starts its window at 1951 or the year the worker turns 22, whichever is later, drops the five lowest indexed years and averages the rest, so a worker whose elapsed years start at the 1951 floor (39 elapsed years) is averaged over 34 years and 408 months.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'A 1962-06-15 worker with official AWI in 1984-2023 except zeros in 1984, 1992, 2000, 2008, and 2016 has 35 positive years: 34 index to 63,795.13 and 2023 stays 66,621.80, so floor((34 x 63,795.13 + 66,621.80) / 420) = 5,322. A 1928-06-15 worker with 1979-1988 AWI has 39 elapsed years 1951-1989 and 34 computation years: floor(10 x 19,334.04 / 408) = 473. Until 2026-09-27 the engine did not floor its window at 1951, started this worker at 1950 and averaged over 35 years, giving 460; the floor came with the extension of the contribution and benefit base table to 1937 (decision D-SS-LAW-2), which would otherwise have let a pre-1951 year be counted. Dropping no years predicts floor(2,235,656.22 / 480) = 4,657 and floor(193,340.40 / 468) = 413. Dropping the first five calendar years of each elapsed span predicts 4,715 and 473. The statutory minimum of two computation years cannot bind for an eligibility year the helper accepts (1979 or later).',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(2)(A), (b)(2)(A)(i)',
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
      citation: '42 U.S.C. 415(b)(2)(B)(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'the term "number of elapsed years" means (except as otherwise provided by section 104(j)(2) of the Social Security Amendments of 1972) the number of calendar years after 1950 (or, if later, the year in which the individual attained age 21) and before the year in which the individual died, or, if it occurred earlier (but after 1960), the year in which he attained age 62; except that such term excludes any calendar year any part of which is included in a period of disability.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 415(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section415&num=0&edition=prelim',
      quotedText:
        'An individual\'s average indexed monthly earnings shall be equal to the quotient obtained by dividing- (A) the total (after adjustment under paragraph (3)) of his wages paid in and self-employment income credited to his benefit computation years (determined under paragraph (2)), by (B) the number of months in those years.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.211(e)(1)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-C/subject-group-ECFR7fa0e3667334188/section-404.211',
      quotedText:
        'We count the years beginning with 1951, or (if later) the year you reach age 22, and ending with the earliest of the year before you reach age 62, become disabled, or die.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.211(e)(1)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-C/subject-group-ECFR7fa0e3667334188/section-404.211',
      quotedText:
        'These are your elapsed years. From your elapsed years, we then subtract up to 5 years, the exact number depending on the kind of benefits to which you are entitled.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.211(e)(2)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-C/subject-group-ECFR7fa0e3667334188/section-404.211',
      quotedText:
        'For computing old-age insurance benefits and survivors insurance benefits, we subtract 5 from the number of your elapsed years.',
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
    verifiedOn: '2026-09-27',
    implementedBy: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

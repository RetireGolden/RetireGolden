/**
 * Social Security earnings-history AIME records: the initial-computation
 * base-year window, annual wage-index rounding, and computation-year count
 * with the five-year dropout and 1951 floor.
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
      'For an ordinary initial old-age computation for a living worker with no period of disability and no prior disability-insurance entitlement, computation base years are the calendar years after 1950 and before the year of first old-age entitlement, while elapsed years run after 1950 or the year age 21 is attained, whichever is later, and before the year age 62 is attained. Benefit computation years are the highest indexed years drawn from that computation-base set, so a year that is a computation-base year but not an elapsed year — the year age 21 is attained, and years from age 62 through the year before first entitlement — can enter AIME. piaInputFromEarnings clamps lastEarningsYear to the age-61 year, and computePiaFromEarnings iterates only from the year the worker turns 22 through the year before age 62 and does not take the first-entitlement year, so those earlier and later initial-computation earnings never enter the average. This is the initial-computation window, not the post-entitlement recomputation registered at usc-42-415-f-2-post-entitlement-pia-recomputation.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'A 1962-06-15 worker has first entitlement in 2029 at FRA 67 on the stream, which this helper projects out and treats as 2024 age-62 eligibility; indexing year 2022 AWI is 63,795.13. One three-cell fixture shares ten published-AWI years 2013-2022. Cell 1 adds 1983 (age 21, AWI 15,239.24) for authority AIME floor(11 × 63,795.13 / 420) = 1,670. Cell 2 adds explicit 2024 (age 62, pre-entitlement) at 42,000 unindexed for floor((10 × 63,795.13 + 42,000) / 420) = 1,618 and pins piaInputFromEarnings, which clamps lastEarningsYear to the age-61 year (2023) even when reported earnings include 2024. Cell 3 keeps last reported year 2023 with zero 2023 earnings and projects 42,000 through age 63 (only 2024), giving the same authority 1,618 while independently pinning computePiaFromEarnings, which iterates only 1984-2023 and ignores projected 2024 unless lastBaseYear is widened (mutation to 2028 yields 1,618 with projectedYearCount 1). Both clamps exclude age-21 and age-62 pre-entitlement earnings, so all three cells observably return 1,518. A competing lower-boundary-only reading includes 1983 but still ends at the year before 62, predicting 1,670, 1,518, 1,518. claimAge is expressible on the stream and unused by this helper. A lower or higher Social Security benefit can alter taxable benefits or the tax character of replacement withdrawals, so the taxpayer-tax sign varies.',
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

  'usc-42-415-b-2-a-i-computation-years-five-year-dropout': {
    title: 'Old-age computation years are elapsed years reduced by five, starting at 1951',
    statement:
      'For an ordinary initial old-age computation for a living worker with no period of disability and no prior disability-insurance entitlement, the number of old-age benefit computation years equals the number of elapsed years reduced by 5, and those years are the computation-base years with the largest indexed earnings. Elapsed years are the calendar years after 1950, or after the year age 21 is attained if later, and before the year age 62 is attained — equivalently counted beginning with 1951, or the year the worker reaches 22 if later, through the year before 62. computePiaFromEarnings instead drops the five lowest years from a fixed age-22-through-61 window and then takes at most 35 remaining years, so a worker whose elapsed years start at the 1951 floor (39 elapsed years, 34 computation years) is still averaged over 35 years and 420 months.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'A 1962-06-15 worker with official AWI in 1984-2023 except zeros in 1984, 1992, 2000, 2008, and 2016 has 35 positive years: 34 index to 63,795.13 and 2023 stays 66,621.80, so authority and the always-35 path both give floor((34 × 63,795.13 + 66,621.80) / 420) = 5,322. A 1928-06-15 worker with 1979-1988 AWI has 39 elapsed years 1951-1989 and 34 computation years: floor(10 × 19,334.04 / 408) = 473, while the engine still uses 35 years and observably 460. Dropping no years predicts floor(2,235,656.22 / 480) = 4,657 and floor(193,340.40 / 468) = 413. Dropping the first five calendar years of each elapsed span predicts 4,715 and 473. A lower or higher Social Security benefit can alter taxable benefits or the tax character of replacement withdrawals, so the taxpayer-tax sign varies.',
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
    verifiedOn: '2026-09-04',
    implementedBy: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

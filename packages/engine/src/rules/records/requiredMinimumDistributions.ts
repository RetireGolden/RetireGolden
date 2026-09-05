/**
 * Required minimum distribution records: section 401(a)(9) and its regulations —
 * applicable age, the life expectancy tables, the ten-year rule, QLACs, the
 * section 4974 excise tax, and the accounts that carry no lifetime RMD.
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
export const requiredMinimumDistributionRecords = {
  'treas-reg-1-408-8-b-3-rmd-first-dollars-out': {
    title: 'Distributions satisfy the RMD in the order they occur',
    statement:
      'Any amount distributed from an IRA during a year for which an RMD is required is treated as a required minimum distribution to the extent the year total has not already been satisfied. A QCD counts toward the RMD, but only against what remains unsatisfied when it occurs.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The consequence the engine must honour is derived rather than stated: because the RMD is satisfied in the order distributions actually occur, an ordinary withdrawal taken before a QCD in the same year irrevocably consumes RMD dollars, and the later QCD cannot retroactively displace it or make it nontaxable. No IRS pronouncement states that negative proposition directly; it follows from combining 1.408-8(b)(3) with 1.408-8(g)(1), and is uniform practitioner understanding. Note the annual-aggregation rule of 408(d)(2) does not extend here - that provision governs basis recovery under section 72, not RMD satisfaction, and an engine reasoning from it alone would wrongly conclude the ordering is irrelevant.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(b)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'any amount distributed during a calendar year from an IRA of that IRA owner is treated as a required minimum distribution under section 401(a)(9) to the extent that the total required minimum distribution for the year under section 401(a)(9) from all of that IRA owner\'s IRAs has not been satisfied (either by a distribution from the IRA or, as permitted under paragraph (e) of this section, from another IRA).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(g)(1)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'all amounts distributed from an IRA are taken into account in determining whether section 401(a)(9) is satisfied, regardless of whether the amount is includible in income. Thus, for example, a qualified charitable distribution made pursuant to section 408(d)(8) is taken into account in determining whether section 401(a)(9) is satisfied.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2007-7, Q&A-42',
      url: 'https://www.irs.gov/pub/irs-drop/n-07-07.pdf',
      quotedText:
        'The amount distributed in a qualified charitable distribution is an amount distributed from the IRA for purposes of sections 408(a)(6), 408(b)(3), and 408A(c)(5).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/actions/annualQcdPhysicalExecution.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdPhysicalExecution.ts#stageAnnualQcdPhysicalExecution',
    ],
  },

  'treas-reg-1-408-8-c-2-spousal-deemed-election': {
    title: 'Spousal deemed election on an undistributed post-death-year amount',
    statement:
      'A surviving spouse is deemed to have elected to treat the IRA as their own if an amount required to be distributed to them as beneficiary for a calendar year following the year of death is not distributed within the required time, or if a non-rollover contribution is made to the IRA. The election is not an act the spouse takes; it happens to them.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The regulation measures the trigger per calendar year, so an unobserved year is refused rather than assumed satisfied: an unobserved year is exactly the year in which the deemed election would have occurred.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(c)(2)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'Alternatively, a surviving spouse eligible to make the election is deemed to have made the election if, at any time, either of the following occurs\u2014 (i) Any amount in the IRA that would be required to be distributed to the surviving spouse as beneficiary under section 401(a)(9)(B) for a calendar year following the calendar year of the IRA owner\'s death is not distributed within the time period required under section 401(a)(9)(B); or (ii) A contribution (other than a rollover of a distribution from an eligible retirement plan of the decedent) is made to the IRA.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/actions/beneficiarySpousalElectionStatus.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/beneficiarySpousalElectionStatus.ts#evaluateBeneficiarySpousalElection',
    ],
  },

  'treas-reg-1-408-8-c-3-spouse-treated-as-owner': {
    title: 'After the election the spouse is the owner for all Code purposes',
    statement:
      'Following an election under 1.408-8(c)(1) or a deemed election under (c)(2), the surviving spouse is the IRA owner for all purposes under the Code, section 72(t) expressly included. The zero additional-tax rate that IRC 72(t)(2)(A)(ii) gives a death beneficiary no longer applies, and the balance folds into the spouse’s own 408(d)(2) aggregation pool.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(c)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'Following an election described in paragraph (c)(1) of this section, the surviving spouse is considered the IRA owner for whose benefit the trust is maintained for all purposes under the Internal Revenue Code (including section 72(t)).',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'made to a beneficiary (or to the estate of the employee) on or after the death of the employee',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/actions/beneficiarySpousalElectionStatus.ts',
      'packages/engine/src/actions/beneficiaryTraditionalIraDeathPenalty.ts',
      'packages/engine/src/projection/internal/annualSeppDistributions.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/actions/beneficiarySpousalElectionStatus.ts#evaluateBeneficiarySpousalElection',
      'packages/engine/src/actions/beneficiaryTraditionalIraDeathPenalty.ts#evaluateBeneficiaryTraditionalIraDeathPenalty',
      'packages/engine/src/projection/internal/annualSeppDistributions.ts#annualSeppDistributions',
    ],
  },

  'treas-reg-1-401-a-9-5-joint-life-spouse-sole-beneficiary': {
    title: 'Joint and Last Survivor Table needs a spouse more than 10 years younger',
    statement:
      'An owner lifetime RMD uses the Uniform Lifetime Table unless the sole beneficiary is a spouse more than 10 years younger, in which case the Joint and Last Survivor Table gives the applicable denominator. Exactly ten years younger is not enough: the test is strict, so that case stays on the Uniform table.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The regulation measures the age gap between individuals; the engine compares ages attained in the calendar year, which is the granularity the projection runs at and can differ from the exact gap by under a year around a birthday.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'If the employee\'s surviving spouse who is more than 10 years younger than the employee is the employee\'s sole beneficiary, then the applicable denominator is the joint and last survivor life expectancy for the employee and spouse determined using the Joint and Last Survivor Table in \u00a7 1.401(a)(9)-9(d) for the employee\'s and spouse\'s ages as of their birthdays in the relevant distribution calendar year (rather than the applicable denominator determined under paragraph (c)(1) of this section).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/rmd/rmd.ts',
      'packages/engine/src/rmd/jointLifeTable.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/rmd/jointLifeTable.ts#jointLifeTableDivisor',
      'packages/engine/src/rmd/rmd.ts#requiredMinimumDistribution',
    ],
  },

  'treas-reg-1-408-8-e-4-i-year-of-death-proportionate-shortfall': {
    title: 'Year-of-death RMD shortfall is shared proportionately',
    statement:
      'Where the owner died before taking the calendar year total and the aggregated IRAs did not all carry identical beneficiary designations, each IRA must distribute a proportionate share of the shortfall based on its account balance. Draining one account before touching the next satisfies only the free-choice branch of (e)(1).',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine never models other beneficiaries designations, so it cannot observe whether (e)(4)(i) binds in a given year. It allocates proportionately unconditionally instead: where designations are identical, (e)(1) free choice permits any split including the proportionate one, so the proportionate split is correct under both branches while an account-order drain is correct under only one.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(4)(i)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'each of the owner’s IRAs is subject to a requirement to distribute a proportionate share of the shortfall for the calendar year to a beneficiary of that IRA, with the proportions based on the account balances determined under paragraph (b)(2) of this section.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/beneficiaryTraditionalIraResidualRmdAllocation.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/beneficiaryTraditionalIraResidualRmdAllocation.ts#prepareBeneficiaryTraditionalIraResidualRmdAllocation',
    ],
  },

  'treas-reg-1-401-a-9-2-b-2-ii-iii-applicable-age-70-half-and-72': {
    title: 'Applicable age 70½ before July 1, 1949 and age 72 through 1950',
    statement:
      'An IRA owner born before July 1, 1949 has applicable age 70½; an owner born on or after July 1, 1949 and before January 1, 1951 has applicable age 72. For the 70½ cohort the attain year is the calendar year in which age 70½ falls: birth months January–June place it in birthYear+70, and birth months July–December place it in birthYear+71. The IRA required beginning date is April 1 of the calendar year after that attain year; historical 401(a)(9)(C)(ii)(II) and former Treas. Reg. 1.408-8 Q&A-3 keep the retirement limb off IRAs. SECURE Act §114 moved the statutory age from 70½ to 72 for distributions required after December 31, 2019 with respect to individuals who attain age 70½ after that date, which is why the July 1, 1949 birth-date cut exists.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'RECORD SCOPE AND PROJECTION CONVENTIONS. When year-only 1949 precision leaves both the 70½ and age-72 candidates open and they disagree on death-versus-RBD for a given death year, the engine refuses rather than guessing. The year-granular comparison consumes an asserted RBD-status fact when death falls in the RBD calendar year; it does not observe an exact death date inside that year. This record does not settle the born-1959 73/75 contest, the SECURE 2.0 73/75 tiers, or QCD day-level 70½ month-end arithmetic. YEAR-GRANULAR 70½ PLACEMENT. Former Treas. Reg. 1.401(a)(9)-2 Q&A-3 (T.D. 8987) states that age 70½ is attained six calendar months after the 70th anniversary of birth and works the June 30, 1933 → December 30, 2003 → April 1, 2004 and July 1, 1933 → January 1, 2004 → April 1, 2005 examples. Former 1.408-8 Q&A-1(a)–(b) incorporates those general RMD rules into IRAs and substitutes the IRA owner for the employee; former 1.408-8 Q&A-3 then fixes the IRA RBD as April 1 following the 70½ year. At month granularity the engine therefore places a January–June birth\'s 70½ attain year at birthYear+70 and a July–December birth\'s at birthYear+71. The unsettled QCD record (irc-408-d-8-B-ii-age-70-half) keeps month-end and leap-day day-resolution; this record does not claim day-level QCD eligibility. HISTORICAL APPLICABILITY. T.D. 10001\'s preamble states that the final regulations under section 401(a)(9) apply for distribution calendar years beginning on or after January 1, 2025, and that for earlier distribution calendar years taxpayers must apply the 2002 final regulations and 2004 final regulations, taking into account a reasonable, good faith interpretation of the amendments made by sections 114 and 401 of the SECURE Act. Current 1.401(a)(9)-2(b)(2)(ii)–(iii) and 1.408-8(b)(1)(i) corroborate the cohort cut and IRA April-1 form under present numbering; they are not claimed to have governed distribution year 2020. OWNER LIVING RMD PROJECTION SURFACE. The owner living RMD pass uses params/index.ts#rmdStartAgeForBirthYear as a distinct birth-year-only surface: it compares calendar-year age attained against that table rather than recomputing applicable age from month and day on every owned account. That collapses the SECURE §114 July 1949 cut and the 70½ tier, which is correct for nearly all living owners in a forward projection but wrong for inherited-regime classification when decedent birth precision matters — hence this record and applicableAge.ts. The 1951–1958 → 73 and 1960+ → 75 limbs rest on irc-401-a-9-C-v-applicable-age; the 1959 selection rests on treas-reg-1-401-a-9-2-b-2-v-applicable-age-1959. Pre-72 historical owner cohorts still in force before the projection start are out of scope for that birth-year table: the calculator does not attempt to re-derive whether a living owner born in 1948 should already be in year fifteen of distributions when the plan begins in 2026. BOUNDARY VERSUS SIBLINGS. irc-401-a-9-C-v-applicable-age and treas-reg-1-401-a-9-2-b-2-v-applicable-age-1959 own the 73/75 tiers and the 1959 contest; first-distribution-calendar-year booking and April 1 deferral elections stay on their existing C(i) / 1.401(a)(9)-5(a)(2) records; the employer-plan still-working exception stays on irc-401-a-9-C-i-II-still-working-exception. EFFECTIVE SCOPE. effectiveFrom is 2020 as the first distribution-applicability year of the SECURE §114 transition: both §114(d) conditions must hold — distributions required after December 31, 2019, and individuals attaining 70½ after that date. It is not the enactment date of the older 70½ rule, not T.D. 10001\'s 2025 applicability, and not the first required-distribution year of the age-72 cohort (a July 1949 birth attains 72 in 2021 with IRA RBD April 1, 2022; a July 1948 birth attains 70½ in 2019 and retains the historical IRA RBD of April 1, 2020). Dating this record 2026 would invent a represented-horizon convention the authority does not use.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(i) (2011 ed., pre-SECURE)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2011-title26/html/USCODE-2011-title26-subtitleA-chap1-subchapD-partI-subpartA-sec401.htm',
      quotedText:
        'The term “required beginning date” means April 1 of the calendar year following the later of— (I) the calendar year in which the employee attains age 70½, or (II) the calendar year in which the employee retires.',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(ii) (2011 ed., pre-SECURE)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2011-title26/html/USCODE-2011-title26-subtitleA-chap1-subchapD-partI-subpartA-sec401.htm',
      quotedText:
        'Subclause (II) of clause (i) shall not apply— (I) except as provided in section 409(d), in the case of an employee who is a 5-percent owner (as defined in section 416) with respect to the plan year ending in the calendar year in which the employee attains age 70½, or (II) for purposes of section 408(a)(6) or (b)(3).',
    }, {
      kind: 'statute',
      citation: 'Pub. L. 116-94, div. O, sec. 114(a), (d) (SECURE Act)',
      url: 'https://www.govinfo.gov/content/pkg/PLAW-116publ94/html/PLAW-116publ94.htm',
      quotedText:
        '(a) In General.--Section 401(a)(9)(C)(i)(I) of the Internal Revenue Code of 1986 <<NOTE: 26 USC 401.>> is amended by striking ``age 70\\1/ 2\\\'\' and inserting ``age 72\'\'.…(d) <<NOTE: 26 USC 401 note.>> Effective Date.--The amendments made by this section shall apply to distributions required to be made after December 31, 2019, with respect to individuals who attain age 70\\1/2\\ after such date.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-2, Q&A-3 (T.D. 8987, 67 FR 18988, 18996)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2002-04-17/html/02-8963.htm',
      quotedText:
        'An employee attains age 70\\1/2\\ as of the date six calendar months after the 70th anniversary of the employee\'s birth. For example, if an employee\'s date of birth was June 30, 1933, the 70th anniversary of such employee\'s birth is June 30, 2003. Such employee attains age 70\\1/2\\ on December 30, 2003. Consequently, if the employee is a 5- percent owner or retired, such employee\'s required beginning date is April 1, 2004. However, if the employee\'s date of birth was July 1, 1933, the 70th anniversary of such employee\'s birth would be July 1, 2003. Such employee would then attain age 70\\1/2\\ on January 1, 2004 and such employee\'s required beginning date would be April 1, 2005.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8, Q&A-1(a)-(b) (T.D. 8987, 67 FR 18988, 19024)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2002-04-17/html/02-8963.htm',
      quotedText:
        '(a) Yes, an IRA is subject to the required minimum distribution rules provided in section 401(a)(9). In order to satisfy section 401(a)(9) for purposes of determining required minimum distributions for calendar years beginning on or after January 1, 2003, the rules of Secs. 1.401(a)(9)-1 through 1.401(a)(9)-9 and 1.401(a)(9)- 6T for defined contribution plans must be applied, except as otherwise provided in this section. For example, whether the 5-year rule or the life expectancy rule applies to distributions after death occurring before the IRA owner\'s required beginning date is determined in accordance with Sec. 1.401(a)(9)-3 and the rules of Sec. 1.401(a)(9)-4 apply for purposes of determining an IRA owner\'s designated beneficiary. Similarly, the amount of the minimum distribution required for each calendar year from an individual account is determined in accordance with Sec. 1.401(a)(9)-5. For purposes of this section, the term IRA means an individual retirement account or annuity described in section 408(a) or (b). The IRA owner is the individual for whom an IRA is originally established by contributions for the benefit of that individual and that individual\'s beneficiaries. (b) For purposes of applying the required minimum distribution rules in Secs. 1.401(a)(9)-1 through 1.401(a)(9)-9 and 1.401(a)(9)-6T for qualified plans, the IRA trustee, custodian, or issuer is treated as the plan administrator, and the IRA owner is substituted for the employee.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8, Q&A-3 (T.D. 8987, 67 FR 18988, 19025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2002-04-17/html/02-8963.htm',
      quotedText:
        'In the case of distributions from an IRA, the term required beginning date means April 1 of the calendar year following the calendar year in which the individual attains age 70\\1/2\\.',
    }, {
      kind: 'regulation',
      citation: 'T.D. 10001, preamble on distribution-calendar-year applicability',
      url: 'https://www.govinfo.gov/content/pkg/FR-2024-07-19/html/2024-14542.htm',
      quotedText:
        'In response to these comments, the final regulations under section 401(a)(9) apply for distribution calendar years beginning on or after January 1, 2025. For earlier distribution calendar years, taxpayers must apply the 2002 final regulations and 2004 final regulations, but taking into account a reasonable, good faith interpretation of the amendments made by sections 114 and 401 of the SECURE Act.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-2(b)(2)(ii), (iii) (current corroboration; T.D. 10001 numbering)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-2',
      quotedText:
        '(ii) Employees born before July 1, 1949. In the case of an employee born before July 1, 1949, the applicable age is age 701⁄2. (iii) Other employees born before 1951. In the case of an employee born on or after July 1, 1949, but before January 1, 1951, the applicable age is age 72;',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(b)(1)(i) (current corroboration)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'An IRA owner\'s required beginning date is determined using the rules for employees who are 5-percent owners under § 1.401(a)(9)-2(b)(3). Thus, the IRA owner\'s required beginning date is April 1 of the calendar year following the calendar year in which the individual attains the applicable age.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2020,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: [
      'packages/engine/src/rmd/applicableAge.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/rmd/applicableAge.ts#applicableAgeAttainYears',
      'packages/engine/src/rmd/applicableAge.ts#deriveRbdComparison',
    ],
  },

  'irc-401-a-9-C-v-applicable-age': {
    title: 'The RMD applicable age steps 72 to 73 to 75, never 74',
    statement:
      'An individual who attains age 72 after 2022 and age 73 before 2033 has an applicable age of 73. An individual who attains age 74 after 2032 has an applicable age of 75. Nobody has an applicable age of 74: the statute is written on attainment windows rather than a rising sequence, and 74 is skipped entirely.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine maps birth year to applicable age rather than restating the attainment windows, which is equivalent: a 1959 birth attains 73 in 2032, inside the window, while a 1960 birth attains 73 in 2033 and 74 in 2034, landing in the later rule. Expressing it by birth year is why no 74 appears anywhere in the code, and that absence is correct rather than a missing case.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(v)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        '(I) In the case of an individual who attains age 72 after December 31, 2022, and age 73 before January 1, 2033, the applicable age is 73. (II) In the case of an individual who attains age 74 after December 31, 2032, the applicable age is 75.',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/params/index.ts',
      'packages/engine/src/insights/detectors/rothBridgeHeadroom.ts',
      'packages/engine/src/decisions/objectives.ts',
      'packages/engine/src/rmd/applicableAge.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/params/index.ts#rmdStartAgeForBirthYear',
      'packages/engine/src/insights/detectors/rothBridgeHeadroom.ts#rothBridgeHeadroom',
      'packages/engine/src/decisions/objectives.ts#bridgeYearFilter',
      'packages/engine/src/rmd/applicableAge.ts#applicableAgeAttainYears',
    ],
  },

  'treas-reg-1-408-8-e-1-i-aggregate-ira-rmd-sum': {
    title: 'The sum of separately calculated IRA RMDs must leave some IRA',
    statement:
      'The required minimum distribution is calculated separately for each IRA, but the sum of those separately calculated amounts may be distributed from any one or more of the IRAs. An IRA whose own balance cannot cover its calculated amount therefore leaves a shortfall that the other IRAs of the same owner must still distribute; it is not extinguished. Only IRAs the individual holds as owner aggregate, so an inherited IRA, a spouse IRA, and an employer plan each stand outside that sum.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Paragraph (e)(1)(i) leaves a living owner free to choose which IRAs the sum comes from, so the engine has to pick an order that the regulation permits but does not select. It sweeps an unmet amount across the remaining owned IRAs in plan account order, which is one of the permitted choices; no ordering here is more correct than another, and none of them changes the total distributed or its tax character. The proportionate allocation of 1.408-8(e)(4)(i) is deliberately not borrowed, because that paragraph governs the year-of-death shortfall passing to beneficiaries rather than a living owner free choice.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(1)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'Except as provided in paragraph (e)(1)(ii) of this section, the required minimum distribution must be calculated separately for each IRA and the sum of those separately calculated required minimum distributions may be distributed from any one or more of the IRAs under the rules set forth in this paragraph (e).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(2)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'Generally, only amounts in IRAs that an individual holds as the IRA owner are aggregated for purposes of paragraph (e)(1) of this section. ... Thus, for example, for purposes of satisfying the minimum distribution requirements with respect to one IRA by making distributions from another IRA, IRAs for which the individual is the IRA owner are not aggregated with IRAs for which the individual is a beneficiary.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408A-4, A-6(b)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408A-4',
      quotedText:
        'Thus, in a year for which a minimum distribution is required (including the calendar year in which the individual attains age 70 1/2), an individual may not convert the assets of an IRA (or any portion of those assets) to a Roth IRA to the extent that the required minimum distribution for the traditional IRA for the year has not been distributed.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/internal/annualAggregateRothConversionPlan.ts',
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/projection/simulate.ts',
      // A named conversion does not inherit the aggregate pass's position in
      // the annual loop as its proof of A-6(b). It reads the owner's
      // aggregated-IRA RMD outcome from bound evidence and refuses to move
      // without it, and it cites that evidence on every committed allocation.
      'packages/engine/src/actions/rothConversionExecution.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/rothConversionExecution.ts#executeRothConversions',
      'packages/engine/src/projection/internal/annualAggregateRothConversionPlan.ts#annualAggregateRothConversionPlan',
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-401-a-9-H-designated-beneficiary-ten-year-rule': {
    title: 'SECURE Act ten-year rule for a designated beneficiary',
    statement:
      'Where an employee dies before the entire interest in a defined contribution plan has been distributed, a designated beneficiary who is not an eligible designated beneficiary must have the whole interest distributed within ten years of the death, and that deadline applies whether or not distributions had already begun. An inherited account therefore leaves the owner Uniform Lifetime schedule entirely rather than continuing it under a different divisor: it runs a separate forced-distribution clock from the death year, so the engine excludes it from the owner RMD pass and drives it from the ten-year deadline instead.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Two limits on how far this record reaches, stated so it is not read as covering more than it does. First, the engine treats every inherited account as held by a beneficiary who is not an eligible designated beneficiary, because the plan model carries no beneficiary category. A surviving spouse, a minor child of the employee, a disabled or chronically ill beneficiary, or a beneficiary not more than ten years younger than the decedent is entitled under 401(a)(9)(H)(ii) to the life-expectancy payout in (B)(iii), and will be shown a faster forced drawdown than the law requires. Second, the size of the annual amount required in years one through nine when the decedent had reached the required beginning date is a separate question from the ten-year deadline registered here. The divisor is registered as treas-reg-1-401-a-9-5-d-3-beneficiary-single-life-denominator, and the greater-of test it does not apply as treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(H)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'In the case of a defined contribution plan, if an employee dies before the distribution of the employee’s entire interest- (i) In general.-Except in the case of a beneficiary who is not a designated beneficiary, subparagraph (B)(ii)- (I) shall be applied by substituting "10 years" for "5 years", and (II) shall apply whether or not distributions of the employee’s interests have begun in accordance with subparagraph (A).',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'A trust shall not constitute a qualified trust under this section unless the plan provides that, if an employee dies before the distribution of the employee’s interest has begun in accordance with subparagraph (A)(ii), the entire interest of the employee will be distributed within 5 years after the death of such employee.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(a)(6)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'Under regulations prescribed by the Secretary, rules similar to the rules of section 401(a)(9) and the incidental death benefit requirements of section 401(a) shall apply to the distribution of the entire interest of an individual for whose benefit the trust is maintained.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/accountEligibility.ts#followsOwnerRmds',
      'packages/engine/src/strategies/inheritedIra.ts#inheritedTenYearDeadline',
    ],
  },

  'treas-reg-1-408-8-b-2-prior-december-31-balance': {
    title: 'RMD numerator is the prior December 31 balance',
    statement:
      'The required minimum distribution for a calendar year is computed on the IRA balance as of December 31 of the preceding calendar year, with no adjustment for contributions or distributions occurring after that date. A rebalance, an annuity purchase, or a withdrawal taken during the distribution year therefore does not reduce the amount required.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(b)(2)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'For purposes of determining the required minimum distribution from an IRA for any calendar year, the account balance of the IRA as of December 31 of the calendar year preceding the calendar year for which distributions are required to be made is substituted for the account balance of the employee under § 1.401(a)(9)-5(b). Except as provided in paragraph (d) of this section, no adjustments are made for contributions or distributions after that date.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(b)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'In the case of an individual account under a defined contribution plan, the benefit used in determining the required minimum distribution for a distribution calendar year is the account balance as of the last valuation date in the calendar year preceding that distribution calendar year (valuation calendar year) adjusted in accordance with this paragraph (b). For this purpose, all of an employee’s accounts under the plan are aggregated.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(a)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'However, the required minimum distribution amount will never exceed the entire account balance on the date of the distribution.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/rmd/rmd.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/rmd/rmd.ts#requiredMinimumDistribution',
    ],
  },
  'treas-reg-1-408A-4-a-6-rmd-precedes-conversion': {
    title: 'A required minimum distribution cannot be converted to a Roth IRA',
    statement:
      'In a year for which an RMD is required, the first dollars distributed from the IRA are the RMD, an RMD is not eligible for rollover, and so no amount may be converted until the whole RMD for that year has been distributed. The order in which the annual ledger runs RMDs before Roth conversions is required by the regulation, not chosen for convenience.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408A-4, A-6(a)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408A-4',
      quotedText:
        'No. In order to be eligible for a conversion, an amount first must be eligible to be rolled over. Section 408(d)(3) prohibits the rollover of a required minimum distribution. If a minimum distribution is required for a year with respect to an IRA, the first dollars distributed during that year are treated as consisting of the required minimum distribution until an amount equal to the required minimum distribution for that year has been distributed.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408A-4, A-6(c)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408A-4',
      quotedText:
        'If a required minimum distribution is contributed to a Roth IRA, it is treated as having been distributed, subject to the normal rules under section 408(d)(1) and (2), and then contributed as a regular contribution to a Roth IRA. The amount of the required minimum distribution is not a conversion contribution.',
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
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/projection/internal/annualAggregateRothConversionPlan.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/rothConversionExecution.ts',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/actions/rothConversionExecution.ts#executeRothConversions',
      'packages/engine/src/projection/internal/annualAggregateRothConversionPlan.ts#annualAggregateRothConversionPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/accountEligibility.ts#resolveOwnerIraRmdSatisfaction',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
    ],
  },
  'treas-reg-1-401-a-9-2-b-2-v-applicable-age-1959': {
    title: 'Applicable age for an owner born in 1959',
    statement:
      'A person born in 1959 satisfies both prongs of the SECURE 2.0 applicable-age definition at once, so the statute names age 73 and age 75 for the same individual. The owner living-RMD path uses 73, following the proposed regulation that would fill the paragraph the final regulation left reserved. The inherited RBD comparison retains both candidate RBD dates (April 1, 2033 at age 73; April 1, 2035 at age 75) and refuses with born-1959-applicable-age-contested only where those candidates disagree on whether death is before or on-or-after the required beginning date; deaths outside both candidate RBD years resolve when the asserted fact agrees, and at the same candidate RBD year the existing year-only asserted-status tie-break applies. The applicable age remains legally contested even when a particular comparison resolves.',
    classification: 'unsettled',
    contraryReading:
      'IRC 401(a)(9)(C)(v)(II) applies on its own terms to a 1959 birth, because such a person attains age 74 in 2033, after December 31, 2032. Read alone it makes the applicable age 75 and defers the first distribution calendar year by two years. The enacted text leaves both prongs in force for the same individual; Treas. Reg. 1.401(a)(9)-2(b)(2)(v) is [Reserved]; Prop. Treas. Reg. 1.401(a)(9)-2(b)(2)(v) (REG-103529-23) would choose 73. The two readings differ by two distribution calendar years of forced ordinary income for the whole 1959 cohort. The quoted sentence from Announcement 2026-7 section III (2026-11 I.R.B. 697) gives the anticipated applicability for final amendments to 1.401(a)(9)-4, -5, and -6.',
    errorDirection: null,
    conventionRationale:
      'OWNER VERSUS INHERITED. The owner living-RMD path has to select one start age and follows the proposed 73. The inherited deriveRbdComparison path keeps both candidate RBD dates (April 1, 2033 at age 73; April 1, 2035 at age 75) and refuses with born-1959-applicable-age-contested only where those candidates disagree on before versus on-or-after; deaths outside both candidate RBD years resolve when the asserted fact agrees, and at the same candidate RBD year the existing year-only asserted-status tie-break applies. The applicable age remains legally contested even when a particular comparison resolves. The two paths are independent: collapsing the inherited candidates onto the owner\'s 73 would change the between-RBD-years outcome from the contest refusal into the ordinary assertion-contradicts-derivation guard, and collapsing onto 75 would treat that same death year as before-rbd. This slice registers only deriveRbdComparison for born 1959; applicableAgeAttainYears stays listed on treas-reg-1-401-a-9-2-b-2-ii-iii-applicable-age-70-half-and-72, irc-401-a-9-C-v-applicable-age, and treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy unchanged.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(i)-(ii)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec401.htm',
      quotedText:
        'The term "required beginning date" means April 1 of the calendar year following the later of— (I) the calendar year in which the employee attains the applicable age, or (II) the calendar year in which the employee retires. (ii) Exception.—Subclause (II) of clause (i) shall not apply— (I) except as provided in section 409(d), in the case of an employee who is a 5-percent owner (as defined in section 416) with respect to the plan year ending in the calendar year in which the employee attains the applicable age, or (II) for purposes of section 408(a)(6) or (b)(3).',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(v)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec401.htm',
      quotedText:
        'Applicable age.— (I) In the case of an individual who attains age 72 after December 31, 2022, and age 73 before January 1, 2033, the applicable age is 73. (II) In the case of an individual who attains age 74 after December 31, 2032, the applicable age is 75.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-2(b)(2)(iv), (v), (vi)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-2',
      quotedText:
        '(iv) Employees born in 1951 through 1958. In the case of an employee born on or after January 1, 1951, but before January 1, 1959, the applicable age is age 73; (v) [Reserved] (vi) Employees born after 1959. In the case of an employee born on or after January 1, 1960, the applicable age is age 75.',
    }, {
      kind: 'regulation',
      citation: 'Prop. Treas. Reg. 1.401(a)(9)-2(b)(2)(v), REG-103529-23, 89 FR 58644',
      url: 'https://www.govinfo.gov/content/pkg/FR-2024-07-19/html/2024-14543.htm',
      quotedText:
        '(v) Employees born in 1959. In the case of an employee born in 1959, the applicable age is age 73.',
    }, {
      kind: 'irsNotice',
      citation: 'Announcement 2026-7 section III, 2026-11 I.R.B. 697',
      url: 'https://www.irs.gov/irb/2026-11_IRB',
      quotedText:
        'Final regulations amending \u00a7\u00a7 1.401(a)(9)-4, 1.401(a)(9)-5, and 1.401(a)(9)-6, issued pursuant to the 2024 proposed regulations, are anticipated to apply for purposes of determining required minimum distributions for the distribution calendar year that begins no earlier than 6 months after the date that final regulations are issued in the Federal Register.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-05',
    implementedBy: [
      'packages/engine/src/params/index.ts',
      'packages/engine/src/rmd/applicableAge.ts',
      'packages/engine/src/rmd/rmd.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/index.ts#rmdStartAgeForBirthYear',
      'packages/engine/src/rmd/applicableAge.ts#deriveRbdComparison',
      'packages/engine/src/rmd/rmd.ts#requiredMinimumDistribution',
    ],
  },
  'treas-reg-1-401-a-9-9-c-uniform-lifetime-table': {
    title: 'Uniform Lifetime Table denominator for a lifetime required minimum distribution',
    statement:
      'The lifetime required minimum distribution is the prior year-end account balance divided by the Uniform Lifetime Table denominator for the age the employee attains on the birthday falling in that distribution calendar year, not the age at the start of the year and not the age at the distribution date. The table in force runs from age 72 at 27.4 to age 120 and over at 2.0 and governs distribution calendar years beginning on or after 1 January 2022; the table it replaced is a different set of numbers at every age.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(c)(1)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'the applicable denominator for required minimum distributions for each distribution calendar year beginning with the employee\'s first distribution calendar year ... is determined using the Uniform Lifetime Table in § 1.401(a)(9)-9(c) for the employee\'s age as of the employee\'s birthday in the relevant distribution calendar year.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-9(c)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-9',
      quotedText:
        'Uniform Lifetime Table. The following table, referred to as the Uniform Lifetime Table, sets forth the applicable denominator that applies for lifetime distributions to an employee in situations in which the employee\'s surviving spouse is not the sole designated beneficiary.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-9(f)(1)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-9',
      quotedText:
        'The life expectancy tables and Uniform Lifetime Table set forth in this section apply for distribution calendar years beginning on or after January 1, 2022. For life expectancy tables and the Uniform Lifetime Table applicable for earlier distribution calendar years, see § 1.401(a)(9)-9, as set forth in 26 CFR part 1 revised as of April 1, 2020 (formerly applicable § 1.401(a)(9)-9).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/rmd/rmd.ts',
      'packages/engine/src/params/index.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/params/index.ts#uniformLifetimeDivisor',
      'packages/engine/src/rmd/rmd.ts#requiredMinimumDistribution',
    ],
  },
  'treas-reg-1-401-a-9-5-a-2-first-distribution-calendar-year': {
    title: 'First distribution calendar year is the year the applicable age is attained',
    statement:
      'Where the required beginning date is April 1 of the year following attainment of the applicable age, the first distribution calendar year is the attainment year itself. A required minimum distribution is therefore due for the attainment year, computed on the prior year-end balance and the denominator for the age attained in that year, even though the payment may lawfully be made as late as the following April 1. The deadline moves; the year the amount belongs to does not.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term “required beginning date” means April 1 of the calendar year following the later of— (I) the calendar year in which the employee attains the applicable age, or (II) the calendar year in which the employee retires.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(a)(2)(ii)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'If an employee\'s required beginning date is April 1 of the calendar year following the calendar year in which the employee attains the applicable age, then the employee\'s first distribution calendar year is the year the employee attains the applicable age.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(a)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'The distribution required for the employee\'s first distribution calendar year (as described in paragraph (a)(2)(ii) of this section) may be made on or before April 1 of the following calendar year. The required minimum distribution for any other distribution calendar year ... must be made on or before the end of that distribution calendar year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/rmd/rmd.ts',
      'packages/engine/src/params/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/params/index.ts#rmdStartAgeForBirthYear',
      'packages/engine/src/rmd/rmd.ts#requiredMinimumDistribution',
    ],
  },
  'irc-401-a-9-C-i-first-year-april-1-deferral': {
    title: 'Deferral of the first required minimum distribution to April 1',
    statement:
      'The distribution for the first distribution calendar year may be paid as late as April 1 of the following year. The engine offers an opt-in `rmdFirstYearDeferrals` election. This record settles only the pinned paths: (1) the default books the first-year amount (distribution and ordinary-income recognition) entirely in the attainment year; (2) when the election is set for that distribution calendar year and applicable plan and the taxpayer takes no IRA distribution or QCD in the attainment year, the amount is held until the following year and booked there beside that year’s separately required RMD. When an elected deferral coincides with an attainment-year IRA distribution or QCD, the engine’s handling is registered separately at irc-401-a-9-C-i-elected-deferral-ignores-attainment-year-distributions. Receipt-year income recognition for a clean elected deferral is registered at irc-402-a-employer-plan-distribution-receipt-year-taxability.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Paying in the attainment year is always permitted under Treas. Reg. 1.401(a)(9)-5(a)(3); the remaining engineering choice is only the default when no election is supplied. The engine defaults to attainment-year booking and requires an explicit opt-in for the April 1 path rather than inventing a household preference. The settled claim stops at the default and the clean elected path; an intervening attainment-year distribution is not part of either fixture.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term “required beginning date” means April 1 of the calendar year following the later of— (I) the calendar year in which the employee attains the applicable age, or (II) the calendar year in which the employee retires.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(a)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'The distribution required for the employee\'s first distribution calendar year (as described in paragraph (a)(2)(ii) of this section) may be made on or before April 1 of the following calendar year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/rmd/rmd.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/rmd/rmd.ts#requiredMinimumDistribution',
    ],
  },
  'irc-401-a-9-C-i-elected-deferral-ignores-attainment-year-distributions': {
    title: 'Elected first-year deferral ignores attainment-year IRA distributions',
    statement:
      'Amounts distributed from an IRA during the first distribution calendar year count toward that year’s required minimum. The year-crediting machinery is carried by treas-reg-1-401-a-9-5-a-2-first-distribution-calendar-year (which year the first required amount belongs to) and treas-reg-1-408-8-b-3-rmd-first-dollars-out (distributions, including a QCD, satisfy the year total in the order they occur); the staged source corpus for this slice does not include Treas. Reg. 1.401(a)(9)-5, so the limbs below reuse spans already quoted on those sibling records and on irc-401-a-9-C-i-first-year-april-1-deferral. Not modelled under an elected `rmdFirstYearDeferrals` path: annualOwnerRmdPlan stores the full calculated first-year RMD at the deferral branch and continues, so an attainment-year IRA withdrawal or QCD does not reduce the deferred obligation; the following receipt year then withdraws that full amount again beside the separately required second-year RMD. Double-counting the deferred amount overstates receipt-year ordinary income and tax. The second-year required amount is still computed on the reduced prior year-end balance, so the overstatement is the re-booked first-year dollars rather than a funding-channel flip. The default attainment-year path and the clean elected path with no intervening attainment-year distribution remain under irc-401-a-9-C-i-first-year-april-1-deferral.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term “required beginning date” means April 1 of the calendar year following the later of— (I) the calendar year in which the employee attains the applicable age, or (II) the calendar year in which the employee retires.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(a)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'The distribution required for the employee\'s first distribution calendar year (as described in paragraph (a)(2)(ii) of this section) may be made on or before April 1 of the following calendar year.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(b)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'any amount distributed during a calendar year from an IRA of that IRA owner is treated as a required minimum distribution under section 401(a)(9) to the extent that the total required minimum distribution for the year under section 401(a)(9) from all of that IRA owner\'s IRAs has not been satisfied (either by a distribution from the IRA or, as permitted under paragraph (e) of this section, from another IRA).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-401-a-9-C-i-II-still-working-exception': {
    title: 'Required beginning date deferred while still employed by the plan sponsor',
    statement:
      'For an employer plan, the required beginning date is April 1 following the later of the attainment year or the year the employee retires, so a participant who keeps working past the applicable age has no required minimum distribution from that plan. The deferral is unavailable to a 5-percent owner and never reaches an IRA. Not modelled: the engine forces an employer-plan distribution from the applicable age alone and never consults employment status, so for a non-5-percent owner still employed it overstates forced ordinary income every year until retirement and understates the balance carried forward. It cannot err the other way. The plan schema already carries a retirement age for each person, so the fact the rule turns on is present and unused.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(i)(II)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term “required beginning date” means April 1 of the calendar year following the later of— (I) the calendar year in which the employee attains the applicable age, or (II) the calendar year in which the employee retires.',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'Subclause (II) of clause (i) shall not apply— (I) except as provided in section 409(d), in the case of an employee who is a 5-percent owner (as defined in section 416) with respect to the plan year ending in the calendar year in which the employee attains the applicable age, or (II) for purposes of section 408(a)(6) or (b)(3).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/model/plan.ts#personSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/accountEligibility.ts#followsOwnerRmds',
    ],
  },
  'irc-401-a-9-H-ii-annual-distributions-inside-ten-year-window': {
    title: 'Whether annual distributions are also required inside the 10-year window',
    statement:
      'The ten-year deadline is not the only obligation. Where the employee died on or after the required beginning date, the at-least-as-rapidly rule survives, so an annual life-expectancy distribution is required in each year of the window in addition to the year-ten sweep. Where the employee died before the required beginning date, no annual distribution is required at all and the sole obligation is to be empty by the deadline. The two cases differ in the shape of the taxable income the window produces, not merely in its total.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(B)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'A trust shall not constitute a qualified trust under this section unless the plan provides that if— (I) the distribution of the employee’s interest has begun in accordance with subparagraph (A)(ii), and (II) the employee dies before his entire interest has been distributed to him, the remaining portion of such interest will be distributed at least as rapidly as under the method of distributions being used under subparagraph (A)(ii) as of the date of his death.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(1)(i)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'If an employee dies after distribution has begun as determined under § 1.401(a)(9)-2(a)(3) (generally, on or after the employee\'s required beginning date), distributions must satisfy section 401(a)(9)(B)(i). ... The requirement to take an annual distribution in accordance with the preceding sentence continues to apply for every distribution calendar year until the employee\'s interest is fully distributed. ... If section 401(a)(9)(H) applies to the employee\'s interest in the plan, then the distributions also must satisfy either section 401(a)(9)(B)(ii) (applied by substituting 10 years for 5 years) or, if the beneficiary is an eligible designated beneficiary, section 401(a)(9)(B)(iii) (taking into account sections 401(a)(9)(E)(iii) and 401(a)(9)(H)(iii)).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(2)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'If an employee dies before distributions have begun (as determined under § 1.401(a)(9)-2(a)(3)) and the life expectancy rule described in § 1.401(a)(9)-3(c)(4) applies, then the applicable denominator for distribution calendar years beginning with the first distribution calendar year for the designated beneficiary ... is the designated beneficiary\'s remaining life expectancy (or is determined under the rules of paragraph (g)(3) of this section, if applicable).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/inheritedIra.ts#classifyInheritedRegime',
      'packages/engine/src/strategies/inheritedIra.ts#inheritedForcedAmount',
      'packages/engine/src/strategies/inheritedIra.ts#inheritedRequirementForYear',
    ],
  },
  'treas-reg-1-401-a-9-5-d-3-beneficiary-single-life-denominator': {
    title: 'Beneficiary remaining life expectancy: which table, and whether it is fixed',
    statement:
      'Paragraph (d)(3) answers two independent questions about the beneficiary remaining life expectancy that sizes an annual distribution after a death on or after the required beginning date. Where the number comes from: the unisex Single Life Table of 1.401(a)(9)-9(b), and no other table, since (d)(3)(i) makes that table govern all life expectancies determined under paragraph (d). How it moves: for a designated beneficiary who is not the surviving spouse, (d)(3)(iii) reads it once, at the age the beneficiary reaches in the calendar year following the year of death, and reduces it by one for each later calendar year. Annual redetermination at the current age is the (d)(3)(iv) treatment and belongs only to a surviving spouse who is the sole beneficiary. A table can be right while the method is wrong and the errors run in opposite directions, so the two questions carry a fixture each.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Three notes on how far this reaches. First, the subtract-one branch is the only one an inherited account in this engine can take: a surviving spouse does not hold an inherited IRA at all under IRC 408(d)(3)(C)(ii), so the (d)(3)(iv) redetermination has no path here, and the engine holds no beneficiary-category fact that could select it. Second, the table is read at a whole age, as singleLifeExpectancyYears in params/index.ts does, and the fixed entry may fall to zero or below for a beneficiary who inherits past about 110; the module then requires the whole remaining interest, since there is nothing left to divide by. Third, this record covers the beneficiary expectancy only. The greater-of test that compares it against the employee expectancy is a separate paragraph and is registered separately as treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy, where it remains out of scope. Until this record was settled the module divided by a sex-specific SSA period life expectancy looked up at the beneficiary current age, described in its own header as a documented proxy for the Single Life Table; the fixture asserting that behaviour called the same SSA function the module called and could not have failed.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(3)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'Life expectancy table. For purposes of this paragraph (d), all life expectancies are determined using the Single Life Table in § 1.401(a)(9)-9(b).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(3)(iii)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'If the designated beneficiary is not the employee\'s surviving spouse, then the designated beneficiary\'s remaining life expectancy is determined initially using the beneficiary\'s age as of the beneficiary\'s birthday in the calendar year following the calendar year of the employee\'s death. Except as otherwise provided in paragraph (d)(3)(iv) of this section, for subsequent calendar years, the designated beneficiary\'s remaining life expectancy is determined by reducing that initial life expectancy by one for each calendar year that has elapsed after that first calendar year.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(3)(iv)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'If the surviving spouse of the employee is the employee\'s sole beneficiary, then the surviving spouse\'s remaining life expectancy is redetermined each distribution calendar year up to and including the calendar year of the spouse\'s death using the surviving spouse\'s age as of the surviving spouse\'s birthday in the distribution calendar year.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-9(b)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-9',
      quotedText:
        'Single Life Table. The following table, referred to as the Single Life Table, sets forth the life expectancy of an individual at each age.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/params/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/index.ts#singleLifeExpectancyYears',
      'packages/engine/src/strategies/inheritedIra.ts#beneficiaryRemainingLifeExpectancy',
    ],
  },
  'treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy': {
    title: 'Greater of the beneficiary and the employee remaining life expectancy',
    statement:
      'Where the employee died on or after the required beginning date and has a designated beneficiary, the applicable denominator is not the beneficiary expectancy but the greater of that and the employee own remaining life expectancy. The employee expectancy comes from the same Single Life Table, read at the employee age on their birthday in the calendar year of death and reduced by one for each later calendar year, so it is read a year earlier than the beneficiary expectancy and has one more reduction applied by any given window year. Not modelled on the labeled legacy path: accounts with only the two-field inherited block (no beneficiary facts) and classifier-refusal fallbacks still project through inheritedForcedAmount without the owner arm; those rows carry regime legacy-planning-approximation or the refusal on their evidence. Classified schedules execute the greater-of arm in the exact ledger via classifyInheritedRegime and inheritedRequirementForYear in strategies/inheritedIra.ts, consumed by projection/simulate.ts. The direction is one-sided on that legacy path. A greater-of can only raise a denominator, never lower it, so omitting it can only make the forced annual distribution too large, and it bites exactly when the beneficiary is older than the decedent was — the case where the beneficiary short expectancy is the one being displaced. It cannot change the total distributed, because the ten-year deadline empties the account either way; it pulls taxable ordinary income forward into the early window years.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(1)(ii)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'Employee with designated beneficiary. If the employee has a designated beneficiary as of the date determined under § 1.401(a)(9)-4(c), the applicable denominator is the greater of— (A) The designated beneficiary\'s remaining life expectancy; and (B) The employee\'s remaining life expectancy.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(3)(ii)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'Employee\'s life expectancy. The employee\'s remaining life expectancy is determined initially using the employee\'s age as of the employee\'s birthday in the calendar year of the employee\'s death. In subsequent calendar years, the remaining life expectancy is determined by reducing that initial life expectancy by one for each calendar year that has elapsed after that first calendar year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/rmd/applicableAge.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/model/plan.ts#inheritedAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/rmd/applicableAge.ts#applicableAgeAttainYears',
      'packages/engine/src/strategies/inheritedIra.ts#inheritedRequirementForYear',
    ],
  },
  'irc-401-a-9-E-ii-eligible-designated-beneficiary': {
    title: 'Eligible designated beneficiary escapes the 10-year rule',
    statement:
      'A designated beneficiary who is the surviving spouse, a minor child of the employee, disabled, chronically ill, or not more than ten years younger than the employee is an eligible designated beneficiary, and the life-expectancy exception applies only to such a beneficiary. Status is fixed at the date of death. Not modelled on the labeled legacy path: accounts with only the two-field inherited block (no beneficiary facts) and classifier-refusal fallbacks still compress onto the ten-year approximation; those rows carry regime legacy-planning-approximation or the refusal on their evidence. Classified schedules execute eligible-designated-beneficiary life-expectancy rows (R3, S1, K2, and related) in the exact ledger via classifyInheritedRegime and inheritedRequirementForYear in strategies/inheritedIra.ts, consumed by projection/simulate.ts. On that legacy path the error runs one way — forced ordinary income inside the window is overstated, the balance that should have survived past the window is understated, and the income the window should have produced in later decades disappears.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(E)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term “eligible designated beneficiary” means, with respect to any employee, any designated beneficiary who is— (I) the surviving spouse of the employee, (II) subject to clause (iii), a child of the employee who has not reached majority (within the meaning of subparagraph (F)), (III) disabled (within the meaning of section 72(m)(7)), (IV) a chronically ill individual ..., or (V) an individual not described in any of the preceding subclauses who is not more than 10 years younger than the employee. The determination of whether a designated beneficiary is an eligible designated beneficiary shall be made as of the date of death of the employee.',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(H)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'Exception for eligible designated beneficiaries.—Subparagraph (B)(iii) shall apply only in the case of an eligible designated beneficiary.',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(E)(iii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'Subject to subparagraph (F), an individual described in clause (ii)(II) shall cease to be an eligible designated beneficiary as of the date the individual reaches majority and any remainder of the portion of the individual’s interest to which subparagraph (H)(ii) applies shall be distributed within 10 years after such date.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/inheritedIra.ts#classifyInheritedRegime',
      'packages/engine/src/strategies/inheritedIra.ts#inheritedRequirementForYear',
    ],
  },
  'irc-275-a-6-chapter-43-excise-taxes-nondeductible': {
    title: 'Chapter 43 excise taxes are not deductible',
    statement:
      'Section 275(a)(6) disallows a deduction for taxes imposed by chapter 43. The RMD-shortfall excise under section 4974 therefore remains outside AGI, MAGI, taxable income, and deductions: the annual ledger adds it after the federal-income-tax calculation in the penalties channel and only then funds that cash cost.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 275(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section275&num=0&edition=prelim',
      quotedText: 'No deduction shall be allowed for the following taxes:',
    }, {
      kind: 'statute',
      citation: 'IRC 275(a)(6)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section275&num=0&edition=prelim',
      quotedText:
        '(6) Taxes imposed by chapters 37, 41, 42, 43, 44, 45, 46, 50A, and 54.',
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

  'irc-4974-rmd-shortfall-excise-tax': {
    title: 'Excise tax on a required minimum distribution shortfall',
    statement:
      'A payee who takes less than the required minimum distribution by its statutory deadline owes an excise tax of 25 percent of the shortfall, not of the whole required amount when part was paid. Ten percent applies only if the whole shortfall is distributed from the same applicable plan or legally aggregable plan group and a return reflecting the reduced tax is filed inside the correction window, which ends at the earliest of notice-of-deficiency mailing, assessment, or the end of the second taxable year beginning after the tax year. A reasonable-error waiver request does not set the tax to zero; an explicit modeled grant does. For tax years beginning in 2025 or later, the final regulation supplies only two automatic-waiver fact patterns: an eligible designated beneficiary whose owner died before the required beginning date and who defaulted to life expectancy without an affirmative election then timely elects the 10-year rule, and a beneficiary who timely corrects the decedent’s year-of-death miss. A first-year amount deferred to April 1 creates no excise in the attainment year; a miss is taxed in the RBD year alongside any separate current-year shortfall. If a balance remains after a 5-year or 10-year emptying deadline, the entire remaining benefit is required in that deadline year and every subsequent year. The engine prices each computed applicable-plan shortfall on the year row’s penalties channel, defaults to 25 percent, and exposes explicit correction and waiver evidence seams. The tax remains outside tax, AGI and MAGI; corrective-distribution evidence prices relief only and never fabricates the separate account movement or its income character.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The law fixes the arithmetic, applicable-plan restriction, correction-window endpoints, and relief fact patterns. Three implementation choices remain. First, ordinary employer plans fail closed per account; only an account explicitly classified as a 403(b) joins the owner’s other explicit 403(b)s. Second, inherited IRAs join only when the Plan carries the same explicit decedentId; absent identity fails closed per account, because matching birth/death facts cannot prove one decedent. Third, correction and waiver inputs are evidence, not money movements. The §4974 calculator therefore cannot manufacture a distribution, tax character, or cash flow: callers model the corrective distribution separately in the year received and use the evidence seam only to price the original excise. That separation keeps the chapter 43 tax out of MAGI and prevents a correction from silently satisfying a current-year RMD while proposed §1.401(a)(9)-5(g)(2)(iv) remains reserved in the final regulations.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 4974(a)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleD-chap43-sec4974.htm',
      quotedText:
        'If the amount distributed during the taxable year of the payee under any qualified retirement plan or any eligible deferred compensation plan (as defined in section 457(b)) is less than the minimum required distribution for such taxable year, there is hereby imposed a tax equal to 25 percent of the amount by which such minimum required distribution exceeds the actual amount distributed during the taxable year. The tax imposed by this section shall be paid by the payee.',
    }, {
      kind: 'statute',
      citation: 'IRC 4974(e)(1)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleD-chap43-sec4974.htm',
      quotedText:
        'In the case of a taxpayer who— (A) receives a distribution, during the correction window, of the amount which resulted in imposition of a tax under subsection (a) from the same plan to which such tax relates, and (B) submits a return, during the correction window, reflecting such tax (as modified by this subsection), the first sentence of subsection (a) shall be applied by substituting “10 percent” for “25 percent”.',
    }, {
      kind: 'statute',
      citation: 'IRC 4974(d)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleD-chap43-sec4974.htm',
      quotedText:
        'If the taxpayer establishes to the satisfaction of the Secretary that— (1) the shortfall described in subsection (a) in the amount distributed during any taxable year was due to reasonable error, and (2) reasonable steps are being taken to remedy the shortfall, the Secretary may waive the tax imposed by subsection (a) for the taxable year.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 54.4974-1(a)(2)(iii)',
      url: 'https://www.law.cornell.edu/cfr/text/26/54.4974-1',
      quotedText:
        'For purposes of paragraph (a)(2) of this section, the correction window ends on the earliest of— (A) The date a notice of deficiency under section 6212 with respect to the tax imposed by section 4974(a) is mailed; (B) The date on which the tax imposed by section 4974(a) is assessed; or (C) The last day of the second taxable year that begins after the end of the taxable year in which the tax under section 4974(a) is imposed.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 54.4974-1(e)',
      url: 'https://www.law.cornell.edu/cfr/text/26/54.4974-1',
      quotedText:
        'If there is any remaining benefit with respect to an employee (or IRA owner) after the calendar year in which the entire remaining benefit is required to be distributed, the required minimum distribution for each calendar year subsequent to that calendar year is the entire remaining benefit.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 54.4974-1(h)',
      url: 'https://www.law.cornell.edu/cfr/text/26/54.4974-1',
      quotedText:
        'This section applies for taxable years beginning on or after January 1, 2025.',
    }, {
      kind: 'formInstruction',
      citation: '2025 Instructions for Form 5329, Part IX',
      url: 'https://www.irs.gov/pub/irs-pdf/i5329.pdf',
      quotedText:
        'The tax is due for the tax year that includes the last day by which the minimum required distribution must be taken.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-21',
    implementedBy: [
      'packages/engine/src/rmd/rmdApplicablePlanForAccount.ts',
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/rmd/rmdShortfallExcise.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/rmd/rmdApplicablePlanForAccount.ts#rmdApplicablePlanForAccount',
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/rmd/rmdShortfallExcise.ts#computeRmdShortfallExcise',
    ],
  },
  'treas-reg-1-401-a-9-6-q-2-qlac-premium-dollar-limit': {
    title: 'The QLAC premium cap is a household-wide running total that moves in ten-thousand-dollar steps',
    statement:
      'Premiums paid for a qualifying longevity annuity contract satisfy the limitation only if they do not exceed 200,000 as adjusted, reduced by every premium already paid for that contract and for any other contract intended to be a QLAC purchased under the plan or under any other plan, annuity, or account described in section 401(a), 403(a), 403(b), or 408, or under an eligible governmental plan. The cap is therefore one running total across all of the retirement accounts of an individual, not a per-contract or per-account allowance. The 200,000 amount is adjusted at the same time and in the same manner as the section 415(d) limits, from a base period of the calendar quarter beginning July 1, 2022, with any increment that is not a multiple of 10,000 rounded down, so the cap sits on a whole ten-thousand-dollar step. Notice 2025-67 confirms it remains 210,000 for 2026.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The regulation moves the cap as a step function while the projection multiplies it by a continuous inflation factor, so a projected year can sit between two published steps and a premium within one step of the cap can read as eligible when the regulation would refuse it, or the reverse. The error is bounded by a single ten-thousand-dollar step. Holding the step would require index values for years that have not happened, so the continuous factor is the same deliberate approximation taken for every other limit that borrows the section 415(d) mechanism. WHAT THIS RECORD DOES NOT COVER, added 2026-08-07 so the statement above is not read for more than it settles. The statement describes the cap as one running total across every retirement arrangement of an individual, and that is what the subsection says; it is not what this engine enforces. The projection holds each purchase to the cap on its own and never reads what another contract has already used, so a household with two QLACs can exceed the total without anything objecting. That gap is registered and pinned separately at treas-reg-1-401-a-9-6-q-2-ii-qlac-premium-cap-across-every-contract. What remains settled here is the FIGURE the pack carries and the indexing mechanism that produces it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(q)(2)(ii), (q)(4)(ii)(A)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-6',
      quotedText:
        'Dollar limitation. The dollar limitation as of a premium payment date is an amount by which $200,000 (as adjusted under paragraph (q)(4)(ii)(A) of this section), exceeds the sum of- (A) The premiums paid before that date with respect to the contract, and (B) The premiums paid on or before that date with respect to any other contract that is intended to be a QLAC and that is purchased for the employee under the plan, or any other plan, annuity, or account described in section 401(a), 403(a), 403(b), or 408 or eligible governmental plan under section 457(b). ... Dollar limitation. The $200,000 amount under paragraph (q)(2)(ii) of this section will be adjusted at the same time and in the same manner as the limits are adjusted under section 415(d), except that- (1) The base period is the calendar quarter beginning July 1, 2022; and (2) The amount of any increment to the limit that is not a multiple of $10,000 will be rounded to the next lowest multiple of $10,000.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, section on the qualifying longevity annuity contract limitation',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The limitation on premiums paid for a qualifying longevity annuity contract under § 1.401(a)(9)-6(q)(2)(ii) remains $210,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/decisions/generators.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/decisions/generators.ts#annuityPurchaseGenerator',
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts#annualAnnuityPurchaseFunding',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  // ---------------------------------------------------------------------------
  // Sub-cent forced distributions — 2026-08-05.
  //
  // One record, registered because the engine now declines to distribute an
  // amount the regulation's arithmetic produces. That is a deviation from a
  // computed requirement rather than a rounding of a presented figure, and it
  // is knowable and bounded, so it belongs here rather than in a comment.
  //
  // The reason it arises at all is worth stating once. This engine carries Plan
  // balances as floats and publishes movements through an exact-cent ledger, so
  // any movement that drains an account leaves behind whatever the float held
  // after the last whole cent came out. That residue is real, it never grows,
  // and every year the owner is past the applicable age it produces a required
  // amount of a few ten-thousandths of a dollar.
  // ---------------------------------------------------------------------------

  'treas-reg-1-408-8-projection-sub-cent-distribution-discharge': {
    title: 'Required distribution below one cent is discharged rather than distributed',
    statement:
      'Treas. Reg. 1.408-8(e)(1)(i) requires the required minimum distribution to be calculated separately for each IRA and the sum of those separately calculated amounts to be distributed. Not modelled for an owned-IRA requirement: an amount that rounds to zero whole cents is not distributed at all. The projection skips the movement entirely — no balance change, no runtime occurrence, and nothing added to the year published required-distribution figure — and treats the undistributed quantum as settled rather than as an outstanding owner-side reserve. The deviation is bounded below half a cent per owned account per year and arises only where a balance has already fallen below a cent, which happens when an earlier exact-cent movement drained the account and left the fraction the ledger cannot express. The same discharge applies to a 72(t) series payment, an aggregate charitable distribution, an aggregate Roth conversion, and a need-based withdrawal, each on the same ground. It does not apply to an inherited §4974 obligation: an inherited amount that produces no movement remains an excise shortfall.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'Direction of error: permissive, and bounded below half a cent per owned account per year. The undistributed fraction stays in the account rather than entering income, so ordinary income is understated by it and the year-end balance overstated by the same amount, and both persist for as long as the residue does. Nothing compounds: the residue never grows, and the fraction is below the smallest unit any published figure carries. What the convention buys is that the movement is representable at all. A fraction of a cent is not transferable in currency, no custodian can move it, and the exact-cent runtime journal has no way to hold a gross that rounds to nothing — so the alternatives were to record an occurrence for a movement that did not happen, or to move dollars with no occurrence explaining them, and the journal contract that every movement is explained forbids the second while the first is a false record. The half that is a decision rather than a consequence is the owner-side DISCHARGE. Reserve and QCD-coordination seams do not read that zero movement as an outstanding owned-IRA requirement, because doing so would refuse lawful conversions and misreport lawful gifts under this registered approximation. The convention stops at the inherited §4974 boundary. There the planner aggregates required amounts and actual movements by applicable plan, reports zero distributed for every zero-movement residue, and the excise calculator prices the resulting shortfall. The retirement path is an exact-cent balance ledger, which would remove the owner-side residue rather than manage it; until then the fixtures pin the bounded owner-side deviation and the inherited shortfall separately.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(1)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'Except as provided in paragraph (e)(1)(ii) of this section, the required minimum distribution must be calculated separately for each IRA and the sum of those separately calculated required minimum distributions may be distributed from any one or more of the IRAs under the rules set forth in this paragraph (e).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      // Where forced distributions and aggregate conversion sweeps size draws
      // and decide the discharge.
      'packages/engine/src/projection/internal/annualForcedDistributionQcdAndRetirementActionsPhase.ts',
      // Where need-based withdrawals size candidate account drains and decide
      // the same discharge before the caller commits accepted movements.
      'packages/engine/src/projection/internal/annualWithdrawalPlanning.ts',
      // Where an annual SEPP payment applies the same no-ledger-cent discharge.
      'packages/engine/src/projection/internal/annualSeppDistributions.ts',
      // Where the aggregate scalar-QCD source planner applies that discharge.
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts',
      // Where "rounds to zero whole cents" is defined, against the same
      // conversion every journal consumer measures a movement with.
      'packages/engine/src/actions/planBalanceAdapter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/planBalanceAdapter.ts#planDollarsMoveNoLedgerCent',
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts#annualLegacyQcdGiftPlan',
      'packages/engine/src/projection/internal/annualSeppDistributions.ts#annualSeppDistributions',
      'packages/engine/src/projection/internal/annualWithdrawalPlanning.ts#annualWithdrawalPlan',
      'packages/engine/src/projection/internal/annualForcedDistributionQcdAndRetirementActionsPhase.ts#annualForcedDistributionQcdAndRetirementActionsPhase',
    ],
  },

  'treas-reg-1-401-a-9-6-a-3-i-annuity-payments-commence-by-the-required-beginning-date': {
    title: 'Only a QLAC may sit outside the RMD account balance while its payments are deferred',
    statement:
      'Treas. Reg. 1.401(a)(9)-5(a)(5)(iii) lets a portion of an account buy an annuity contract while the rest stays behind, and then requires only the REMAINING account balance to be distributed under the account rules — but the permission is conditional on the contract itself satisfying 1.401(a)(9)-6, whose paragraph (a)(3)(i) requires annuity payments to commence on or before the required beginning date. A contract that defers past that date has one exemption available to it and only one: paragraph (q)(1)(iii) excuses a QLAC from (a)(3), and 1.401(a)(9)-5(b)(4) is the matching rule that keeps a QLAC’s value out of the account balance. A non-QLAC contract with a deferred start has neither, and this engine no longer lets a Plan express one. Plan validation refuses a qualified annuity purchase that is not flagged qlac and whose payments commence later than the owner may defer them, so the shape that used to receive the QLAC’s treatment cannot be authored, cannot be patched in by a scenario or a decision candidate, and cannot survive a load: a stored document carrying it is repaired on the way in. The single mechanism the engine has — the premium leaves the traditional balance at purchase and an annuity account holds no balance of its own — is therefore applied only to contracts the regulation actually permits to sit outside the base.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'THE TEST IS DERIVED, NOT DECLARED, which is what made the refusal cheap enough to be worth taking. A Plan carries the contract’s startAge, the purchase year and the owner’s date of birth, and that is everything the required beginning date needs: 1.401(a)(9)-2(b)(1) puts it at April 1 of the calendar year FOLLOWING the year the owner attains the applicable age, and the projection pays a contract twelve monthly amounts in the year the owner attains startAge, so the engine’s own model of commencement is January 1 of that year. The last permissible start is therefore the year the owner attains the applicable age plus one, and no new field is added. THE SECOND TERM, AND WHY IT IS NOT OPTIONAL. The bound above is the later of that year and the PURCHASE year. An owner who annuitizes at 80 passed their required beginning date years ago, so every contract they could buy commences after it; the first term alone would refuse the ordinary immediate annuity, which the regulation plainly allows and which this engine’s own Form 8606 fixtures are built on. What (a)(3)(i) forbids is using the annuity form to postpone distributions, and a contract paying from the year its premium is paid postpones nothing — the account was already distributing under the account rules and the contract takes over on purchase. A refusal stricter than its authority would not have been this rule. WHAT THE ACCEPTED READING ASSUMES, kept from the approximated version because it is still the load-bearing step. A contract failing 1.401(a)(9)-6(a)(3) is a qualification failure rather than a valuation rule, and the regulation does not spell out an arithmetic remedy; the reading taken is that a bifurcation the regulation does not permit does not happen. The alternative — that the value leaves the base anyway and the failure is the custodian’s problem — would make 1.401(a)(9)-5(b)(4) and 1.401(a)(9)-6(q)(1)(iii) do no work at all, since every deferred contract would already enjoy what the QLAC rules were written to grant. That is a reading which erases its own authority, which is why refusing the shape rather than pricing it is not a shortcut. HISTORY, APPENDED RATHER THAN DELETED. Until 2026-08-07 this record was classified approximated with errorDirection understatesTax, and it pinned these figures: a 76-year-old with a 1,000,000 dollar traditional IRA and a 0 percent return pays a 200,000 dollar qualified premium in 2026 for a contract whose payments start at age 85, nine years past the required beginning date and not declared a QLAC. The 2026 requirement was unaffected either way, resting on the prior December 31 balance; the 2027 requirement parted, the accepted reading leaving the contract in the base for 41,825.59 on 957,805.91 while the engine computed 33,091.96 on 757,805.91 — a shortfall of 8,733.62 in the second year alone, recurring and compounding. The same household with qlac: true produced the identical 33,091.96, which was the sharpest statement of the defect available: the engine had exactly one mechanism and could not tell a QLAC from a non-QLAC because it never had a second one. THE REMEDY AS THE RECORD STATED IT, AND WHAT WAS ACTUALLY BUILT. The approximated version offered a two-way choice and named no migration: "Either a contract value the RMD base can re-include when the contract is not a QLAC and its payments start after the required beginning date, or a plan-validation refusal of that combination. The second is much cheaper and loses only a shape the regulation does not permit anyway; neither is done here." The cheaper arm is the one taken. Extending it with a load-time repair and a projection warning is this slice’s design decision rather than something the record had registered: parse alone would have locked every household holding the old shape out of the plan the new message tells them to fix, and the repair discipline this repo settled on for the pension lump-sum election and the inherited-funded annuity premium is what that seam already exists for. THE REPAIR, AND WHY IT IS A STAND-DOWN. A stored document carrying the shape has its purchase cleared and its monthly amount zeroed, so the premium never leaves the funding balance and the contract pays nothing. Two other repairs were available and both are refused by the never-richer bar the load seam is under. Marking the contract a QLAC would confer precisely the grant the regulation withholds — the household never chose it, the relabel would keep the exclusion the refusal exists to remove, and it is not even safe on its own terms, since the premium would then be clamped to the statutory cap and a start past 85 would still fail (q)(1)(ii). Advancing the start age to the required beginning date would pay a monthly amount quoted for a deferred start across years nobody bought it for. The stand-down is the strictly poorer direction and it leaves the account in the plan, so the household can see what happened and re-author it either way. TWO CORRECTIONS ENTERED 2026-08-07 when the companion ceiling landed at treas-reg-1-401-a-9-6-q-1-ii-qlac-commences-by-the-85th-birthday, so that neither sentence above is read for more than it can carry. First, the aside that "a start past 85 would still fail (q)(1)(ii)" is true of every owner but one: (q)(1)(ii)’s deadline is the first day of the month after the 85th anniversary, which for a DECEMBER birthday falls on January 1 of the next calendar year, and the engine’s January-1 model of commencement puts a start age of 86 exactly on it. The ceiling is 85, and 86 for a December birth; the relabel argument is unaffected, because the ceiling is a ceiling either way. Second, the refusal message quoted here as an unconditional "lower Start age, or tick QLAC" is now conditional. Ticking the box is a real remedy only where the start age also clears the (q)(1)(ii) ceiling, so the message names it only then and otherwise says why it would not help — the same treatment the companion record’s message gives to unticking.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(a)(3)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-6',
      quotedText:
        'Annuity payments must commence on or before the employee\'s required beginning date (within the meaning of § 1.401(a)(9)-2(b)).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(a)(5)(iii)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'A portion of an employee\'s account balance under a defined contribution plan is permitted to be used to purchase an annuity contract while another portion remains in the account, provided that the requirements of paragraphs (a)(5)(i) and (ii) of this section are satisfied (other than the requirement that the contract be purchased with the employee\'s entire individual account). In that case, in order to satisfy section 401(a)(9) for calendar years after the calendar year of purchase, the remaining account balance under the plan must be distributed in accordance with this section.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(q)(1)(iii)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-6',
      quotedText:
        'The contract provides that, after distributions under the contract commence, those distributions must satisfy the requirements of this section (other than the requirement in paragraph (a)(3) of this section that annuity payments commence on or before the required beginning date);',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(a)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'An IRA is subject to the required minimum distribution requirements of section 401(a)(9). In order to satisfy section 401(a)(9), the rules of §§ 1.401(a)(9)-1 through 1.401(a)(9)-9 must be applied, except as otherwise provided in this section.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/model/migrations.ts',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/migrations.ts#migratePlanToCurrent',
      'packages/engine/src/model/plan.ts#annuitySchema',
      'packages/engine/src/model/plan.ts#latestNonQlacQualifiedAnnuityStartAge',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts#annualAnnuityPurchaseFunding',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'treas-reg-1-401-a-9-6-q-1-ii-qlac-commences-by-the-85th-birthday': {
    title: 'A QLAC may defer, but not past the first of the month after the owner’s 85th birthday',
    statement:
      'Treas. Reg. 1.401(a)(9)-6(q)(1)(iii) excuses a QLAC from the requirement that annuity payments commence by the required beginning date, and that excuse is the whole reason a deferred contract may sit outside the required-distribution account balance under 1.401(a)(9)-5(b)(4). It is not a licence to defer without end. Paragraph (q)(1)(ii) puts a second requirement on the same contract: it must PROVIDE a specified annuity starting date no later than the first day of the month next following the 85th anniversary of the employee’s birth. A contract naming a later date fails (q)(1), is therefore not a QLAC, and so holds neither the excuse nor the exclusion — the engine’s single mechanism (the premium leaves the traditional balance at purchase and an annuity account holds no balance of its own) would hand it both. Plan validation refuses the shape, so it cannot be authored, cannot be patched in by a scenario or a decision candidate, and cannot survive a load: a stored document carrying it is repaired on the way in. This is the companion bound to treas-reg-1-401-a-9-6-a-3-i-annuity-payments-commence-by-the-required-beginning-date, and between them every qualified annuity purchase is under exactly one ceiling — the required beginning date without the QLAC election, the 85th birthday with it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'THE BOUND IS A BIRTH MONTH, NOT THE CONSTANT 85, and the record leads with that because it is the only part a reader would otherwise assume was a bug. The regulation’s deadline is a DATE and this model’s start ages are calendar years, so the two have to be bridged, and the bridge is the same one the required-beginning-date record is built on: simulatePlan pays a contract twelve monthly amounts in the calendar year the owner attains startAge (startCalendarYear = dobYear + startAge, the guaranteed-income pass), so the engine’s model of commencement is January 1 of that year. Ask of each candidate start age whether that January 1 falls on or before the first day of the month next following the 85th anniversary. A start age of 85 or lower commences no later than January 1 of the year the owner attains 85, and the deadline is at the earliest February 1 of that same year (a January birthday), so every such contract clears it. A start age of 87 or higher is late for everyone. A start age of 86 is the whole question: it commences on January 1 of the year the owner attains 86, which for a birthday in any month but December is a full year after a deadline that fell in the previous calendar year — but for a DECEMBER birthday the 85th anniversary is in December and the first day of the next month IS that January 1, so the contract commences on the last day the regulation permits, exactly. The ceiling is therefore 85, and 86 for a December birth. WHY THE DECEMBER CASE IS NOT TIDIED AWAY. It is the same arithmetic that gives the neighbouring bound its + 1, which exists because THAT deadline — April 1 of the year following attainment of the applicable age — also falls in the calendar year after the one the age names. Refusing 86 for a December-born owner would be a refusal stricter than the authority for it, and it would force that household to model a contract commencing a full year before the one they actually hold; a refusal stricter than its authority is not this rule, which is the discipline the neighbouring record’s second term was written to state. THE TEST IS DERIVED, NOT DECLARED. A Plan already carries the contract’s startAge and the owner’s date of birth, so no new field is added, and the same owner resolution the projection uses (the named owner, or the first person in the household when the account carries none) is taken at parse, at load and in the projection. THE MESSAGE NAMES THE OTHER BOX ONLY WHEN THE OTHER BOX WOULD WORK. Each of the two refusals has two conceivable remedies — move the start age, or change which bound applies by ticking or unticking QLAC — and the second is a dead end whenever the other bound refuses the same age too. A QLAC refused at a start age of 90 cannot be rescued by unticking the box, because the required-beginning-date bound is lower still in every case but an annuitization bought at that very age; a non-QLAC refused at 90 cannot be rescued by ticking it, because 90 is past this ceiling as well. Both messages are therefore derived from which of the two shapes the plan could actually store, and the earlier message’s unconditional "or tick QLAC" was corrected to match when this bound landed. THE SAME DERIVATION GOVERNS EVERY SURFACE THAT NAMES THE BOX, added on review because two of them had been left asserting what the parse had stopped asserting. The accounts editor’s field help and the load-repair notice each carried an unconditional claim that the QLAC box is the way to start later, and neither is reliably true: the required-beginning-date ceiling is the LATER of the applicable RMD age plus one and the owner’s age in the purchase year, so it climbs with a late annuitization and overtakes the QLAC’s fixed 85 or 86 — an owner buying at 96 is held to 95 without the box and would be dropped to 85 by ticking it. Both now compare the two ceilings for the owner in front of them, offer the box only where it admits a later start, and otherwise say which age the other shape would impose. The editor reads both ceilings from one helper, and the load repair carries both numbers on the repair record, so no surface re-derives the comparison for itself. WHAT "ONE SEAM" DOES AND DOES NOT MEAN, tightened on a second review that found the migration and the editor disagreeing about a limit that is not in this record at all. A Plan will not store an annuity start age past ANNUITY_MAX_START_AGE, which is the model’s own projection range and not a tax rule — nothing here says a contract commencing at 96 is unlawful. That constant is now exported once and read by the schema that enforces it, the editor, and the load repair, because all three had been carrying their own copy. It is applied to the ceiling a message OFFERS, since a suggestion has to name a start age the household can actually store, and deliberately NOT to the ceiling that decides whether the stand-down fires: the repair exists because a shape has no legal expression, and a start age this program merely declines to project is not that shape. Capping the trigger would destroy a lawful purchase for a range limit, and would not even buy the parse, because the stand-down preserves the start age on purpose. Such a document is refused whole, with the schema naming the field that is out of range. THE REPAIR, AND WHY IT IS A STAND-DOWN. A stored document carrying the shape has its purchase cleared and its monthly amount zeroed, so the premium never leaves the funding balance and the contract pays nothing. The same three repairs were available as for the neighbouring bound and the same two are refused by the never-richer bar the load seam is under. Unticking the QLAC box is the mirror of the relabel that record refuses, and is richer for a second reason of its own: it lifts the statutory premium cap the household’s own election put the contract under, and it lands the contract on the required-beginning-date bound, which is lower than the ceiling it just failed. Advancing the start age would pay a monthly amount quoted for a deferred start across years nobody bought it for, and the argument is stronger here than next door because a QLAC’s entire pricing IS its deferral. The stand-down is the strictly poorer direction and it leaves the account in the plan carrying its name and start age, so the household can see what happened and re-author it. WHAT THIS RECORD DOES NOT COVER. How large the premium may be is a different rule, registered at treas-reg-1-401-a-9-6-q-2-qlac-premium-dollar-limit for its value and at treas-reg-1-401-a-9-6-q-2-ii-qlac-premium-cap-across-every-contract for the running total the engine does not keep. Where the contract’s value sits once paid is treas-reg-1-401-a-9-5-b-4-qlac-excluded-from-the-rmd-account-balance, whose statement has always said a QLAC may defer "as late as the month after the owner’s eighty-fifth birthday" — until 2026-08-07 that sentence described a limit nothing in the engine enforced, and it now describes one that is enforced at parse, at load and in the projection. Paragraphs (q)(1)(i), (iv) and (v) impose further conditions on a QLAC (the premium limitation, the absence of a commutation benefit or cash surrender right after the required beginning date, and the contract’s own statement that it is intended to be a QLAC) and are not modelled; a Plan has no field for the last two, and a household that ticks the QLAC box is taken at its word that the contract it bought is one.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(q)(1)(ii)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-6',
      quotedText:
        'The contract provides that distributions under the contract must commence not later than a specified annuity starting date that is no later than the first day of the month next following the 85th anniversary of the employee\'s birth;',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(q)(1)(iii)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-6',
      quotedText:
        'The contract provides that, after distributions under the contract commence, those distributions must satisfy the requirements of this section (other than the requirement in paragraph (a)(3) of this section that annuity payments commence on or before the required beginning date);',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(b)(4)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'The account balance does not include the value of any qualifying longevity annuity contract (QLAC), defined in § 1.401(a)(9)-6(q), that is held under the plan.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/model/migrations.ts',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/decisions/generators.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/migrations.ts#migratePlanToCurrent',
      'packages/engine/src/model/plan.ts#annuitySchema',
      'packages/engine/src/model/plan.ts#latestQlacAnnuityStartAge',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts#annualAnnuityPurchaseFunding',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/decisions/generators.ts#annuityPurchaseGenerator',
    ],
  },

  'treas-reg-1-401-a-9-6-q-2-ii-qlac-premium-cap-across-every-contract': {
    title: 'The QLAC premium cap is checked one contract at a time, not against the household’s running total',
    statement:
      'Treas. Reg. 1.401(a)(9)-6(q)(2)(ii) states the dollar limitation as of a premium payment date: 200,000 as adjusted, REDUCED BY the premiums already paid for that contract and by the premiums paid on or before that date for any other contract intended to be a QLAC purchased for the employee under the plan or under any other plan, annuity or account described in section 401(a), 403(a), 403(b) or 408, or an eligible governmental plan under 457(b). It is one running total across every retirement arrangement of one individual. The engine holds each purchase to the cap on its own: at the annuity-purchase pass it compares that contract’s premium against the indexed cap and reduces the premium to the cap where it is larger, and it never reads what any other contract has already used. A household that buys two QLACs therefore moves up to twice the statutory allowance out of the required-distribution base without anything objecting, and the excess is treated as QLAC-eligible premium for the rest of the projection.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'PINNED FIGURES. A 76-year-old with a 1,000,000 dollar traditional IRA and a 0 percent return pays two 150,000 dollar QLAC premiums in 2026 out of that IRA, 300,000 together against a 210,000 cap. Neither premium exceeds the cap alone, so the per-contract test the engine applies is silent and no warning fires. The 2026 requirement is unaffected either way, resting on the prior December 31 balance. In 2027 the accepted reading has 210,000 of QLAC-eligible premium outside the base and the excess 90,000 still inside it, for a base of 747,805.91 and a requirement of 32,655.28; the engine puts the whole 300,000 outside, for a base of 657,805.91 and a requirement of 28,725.15. The gap is 3,930.13 in that year and it recurs. DIRECTION. Understates tax, by the same route the QLAC carve-out itself runs: a smaller base is a smaller required distribution, less ordinary income in the year, and a larger balance compounding into later years. WHAT THE ACCEPTED READING TAKES AS GIVEN. The regulation says a premium above the limitation means the contract is not a QLAC, and it supplies a correction mechanism rather than an arithmetic haircut. This record does not re-derive that; it takes the engine’s OWN convention for a single over-cap contract — reduce the premium to the cap, warn, and treat the excess as ineligible, which treas-reg-1-401-a-9-6-q-2-qlac-premium-dollar-limit registers as settled — and asks only that the cap be the running total the subsection defines rather than a fresh allowance per contract. The departure is therefore about the AGGREGATION and nothing else, which is why the fixture holds every other term fixed and varies only the number of contracts. NOT THE SAME RULE AS THE CAP’S VALUE. That the pack carries 210,000 for 2026, and that a projected year multiplies it by a continuous inflation factor rather than stepping it, are both settled at treas-reg-1-401-a-9-6-q-2-qlac-premium-dollar-limit and are not restated here. WHAT IT WOULD TAKE TO FIX. A per-owner running total carried across the purchase pass and reduced by every QLAC premium already funded in the projection, ordered by purchase year and then by a stable account order so the reduction is deterministic; premiums in the same year would have to agree on an order before the second one could be measured against the first. It is not done here. This record was opened on 2026-08-07 while the neighbouring commence-by-the-required-beginning-date defect was being closed, because the reg was open and the gap was found rather than because it was in that slice’s scope.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(q)(2)(ii), (q)(4)(ii)(A)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-6',
      quotedText:
        'Dollar limitation. The dollar limitation as of a premium payment date is an amount by which $200,000 (as adjusted under paragraph (q)(4)(ii)(A) of this section), exceeds the sum of- (A) The premiums paid before that date with respect to the contract, and (B) The premiums paid on or before that date with respect to any other contract that is intended to be a QLAC and that is purchased for the employee under the plan, or any other plan, annuity, or account described in section 401(a), 403(a), 403(b), or 408 or eligible governmental plan under section 457(b). ... Dollar limitation. The $200,000 amount under paragraph (q)(2)(ii) of this section will be adjusted at the same time and in the same manner as the limits are adjusted under section 415(d), except that- (1) The base period is the calendar quarter beginning July 1, 2022; and (2) The amount of any increment to the limit that is not a multiple of $10,000 will be rounded to the next lowest multiple of $10,000.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(b)(4)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'The account balance does not include the value of any qualifying longevity annuity contract (QLAC), defined in § 1.401(a)(9)-6(q), that is held under the plan.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: [
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts#annualAnnuityPurchaseFunding',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'treas-reg-1-401-a-9-5-b-4-qlac-excluded-from-the-rmd-account-balance': {
    title: 'A QLAC’s value is excluded from the required-distribution account balance',
    statement:
      'The account balance used to compute a required minimum distribution does not include the value of a qualifying longevity annuity contract held under the plan, and Treas. Reg. 1.408-8(h)(1) carries that rule to an IRA. It is what lets a QLAC defer payments to as late as the month after the owner’s eighty-fifth birthday without the deferred value driving a required distribution in the meantime. The engine reaches the same base by a different route — the premium leaves the traditional balance at purchase and the contract holds no balance of its own — and the two agree exactly, because both leave the base equal to the assets that stayed behind.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'THE MECHANISM IS NOT THE RULE, and the record says so because the coincidence is load-bearing in one direction and misleading in the other. The regulation excludes the VALUE OF THE CONTRACT from a balance that still notionally contains it; the engine never puts it there, having no contract value at all. On a QLAC the two agree for every year and every return assumption, since the base is the remaining account either way, so nothing here is approximated. On a contract that is NOT a QLAC the same single mechanism produced an exclusion the regulation does not allow, and that is registered separately at treas-reg-1-401-a-9-6-a-3-i-annuity-payments-commence-by-the-required-beginning-date. UNTIL 2026-08-07 THE TWO RECORDS PINNED THE SAME PAIR OF FIGURES with the accepted and produced labels exchanged, and this record said that the day the engine learned to tell the contracts apart, one fixture would flip and the other must not. That day was 2026-08-07: the neighbouring record is now settled, because plan validation refuses a qualified non-QLAC contract that defers past the owner’s required beginning date, and the shape its produced fixture measured is unreachable through any valid plan. What flipped there was that fixture, from an arithmetic gap to the refusal itself. NOTHING HERE MOVED, which is the discipline working rather than a coincidence: this record’s accepted reading and its 33,091.96 are the same figures on the same household, and they have to be, because the mechanism the engine uses to reach them was never the thing that changed. THE AGGREGATION ELECTION IS A SEPARATE RULE and is not what this record covers. Treas. Reg. 1.408-8(e)(1)(ii) and 1.401(a)(9)-5(a)(5)(iv) let an owner ELECT to put the contract’s value back into the base and reduce the requirement by the annuity payments; Publication 590-B walks the same election through an example. It is an election, so declining it is the default and the engine’s silence is a permitted position rather than an omission — but it is a position, and a Plan has no field with which to take the other one. The QLAC premium cap is a third rule again, registered at treas-reg-1-401-a-9-6-q-2-qlac-premium-dollar-limit for its value and at treas-reg-1-401-a-9-6-q-2-ii-qlac-premium-cap-across-every-contract for the running total the engine does not keep; this record says nothing about how large the premium may be, only about where its value sits once paid. THE "AS LATE AS THE MONTH AFTER THE EIGHTY-FIFTH BIRTHDAY" IN THE STATEMENT ABOVE IS NOW AN ENFORCED LIMIT, added 2026-08-07. That clause has been in this record since it was written, and it described the deferral (q)(1)(ii) permits — but until that date nothing in the engine held a contract to it, and a plan could carry a QLAC starting at 95 and receive this exclusion for every one of those years. Plan validation now refuses a QLAC whose payments commence past that date, a stored document carrying one is repaired at load, and the projection warns for any caller that reaches the purchase pass without parsing first. That rule is registered separately at treas-reg-1-401-a-9-6-q-1-ii-qlac-commences-by-the-85th-birthday. NOTHING HERE MOVED AGAIN: this record’s accepted reading and its 33,091.96 are still the same figures on the same household, because a start age of 85 was always within the ceiling and the mechanism that reaches the base was never what changed.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(b)(4)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'The account balance does not include the value of any qualifying longevity annuity contract (QLAC), defined in § 1.401(a)(9)-6(q), that is held under the plan.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(h)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'The special rule in § 1.401(a)(9)-5(b)(4) for a QLAC, defined in § 1.401(a)(9)-6(q), applies to an IRA, subject to the modifications set forth in this paragraph (h).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(q)(1)(ii)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-6',
      quotedText:
        'The contract provides that distributions under the contract must commence not later than a specified annuity starting date that is no later than the first day of the month next following the 85th anniversary of the employee\'s birth;',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B, annuity contract purchased with a portion of the account balance',
      url: 'https://www.irs.gov/pub/irs-pdf/p590b.pdf',
      quotedText:
        'you may elect to satisfy the RMD requirement for the year by combining the value of the annuity contract with the remaining account balance and reducing the RMD by the amount of the annuity payments.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: [
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/rmd/rmd.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts#annualAnnuityPurchaseFunding',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/rmd/rmd.ts#requiredMinimumDistribution',
    ],
  },
  'irs-notice-2022-53-2023-54-2024-35-inherited-rmd-transition-relief': {
    title: 'Inherited-RMD transition relief ended after 2024',
    statement:
      'Notices 2022-53, 2023-54, and 2024-35 limited their non-enforcement relief to specified RMDs for 2021 through 2024. Notice 2024-35 announced that the final regulations apply for calendar years beginning on or after January 1, 2025, so the engine does not carry the transition relief into a 2025-or-later annual RMD inside a ten-year window.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'Notice 2022-53, section IV.B',
      url: 'https://www.irs.gov/pub/irs-drop/n-22-53.pdf',
      quotedText:
        'To the extent a taxpayer did not take a specified RMD (as defined in Section IV.C of this notice), the IRS will not assert that an excise tax is due under section 4974.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2022-53, section IV.C',
      url: 'https://www.irs.gov/pub/irs-drop/n-22-53.pdf',
      quotedText:
        'For purposes of this notice only, a specified RMD is any distribution that, under the interpretation included in the proposed regulations, would be required to be made pursuant to section 401(a)(9) in 2021 or 2022 under a defined contribution plan or IRA that is subject to the rules of 401(a)(9)(H) for the year in which the employee (or designated beneficiary) died if that payment would be required to be made to: … the employee (or IRA owner) died in 2020 or 2021 and on or after the employee\'s (or IRA owner\'s) required beginning date, and (2) the designated beneficiary is not taking lifetime or life expectancy payments pursuant to section 401(a)(9)(B)(iii)',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2023-54, section V.B',
      url: 'https://www.irs.gov/pub/irs-drop/n-23-54.pdf',
      quotedText:
        'To the extent a taxpayer did not take a specified RMD (as defined in section V.C of this notice), the IRS will not assert that an excise tax is due under § 4974.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2023-54, section V.C',
      url: 'https://www.irs.gov/pub/irs-drop/n-23-54.pdf',
      quotedText:
        'For purposes of this notice, a specified RMD is any distribution that, under the interpretation included in the proposed regulations, would be required to be made pursuant to § 401(a)(9) in 2023 under a defined contribution plan or IRA that is subject to the rules of § 401(a)(9)(H) for the year in which the employee (or designated beneficiary) died if that payment would be required to be made to: … the employee (or IRA owner) died in 2020, 2021, or 2022, and on or after the employee\'s (or IRA owner\'s) required beginning date, and (2) the designated beneficiary is not using the lifetime or life expectancy payments exception under § 401(a)(9)(B)(iii)',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2024-35, section IV.B',
      url: 'https://www.irs.gov/pub/irs-drop/n-24-35.pdf',
      quotedText:
        'To the extent a taxpayer did not take a specified RMD (as defined in section IV.C of this notice), the IRS will not assert that an excise tax is due under § 4974.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2024-35, section IV.C',
      url: 'https://www.irs.gov/pub/irs-drop/n-24-35.pdf',
      quotedText:
        'For purposes of this notice, a specified RMD is any distribution that, under the interpretation included in the proposed regulations, would be required to be made pursuant to § 401(a)(9) in 2024 under a defined contribution plan or IRA that is subject to the rules of § 401(a)(9)(H) for the year in which the employee (or designated beneficiary) died if that payment would be required to be made to: … the employee (or IRA owner) died in 2020, 2021, 2022, or 2023, and on or after the employee\'s (or IRA owner\'s) required beginning date, and (2) the designated beneficiary is not using the lifetime or life expectancy payments exception under § 401(a)(9)(B)(iii)',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2024-35, section I',
      url: 'https://www.irs.gov/pub/irs-drop/n-24-35.pdf',
      quotedText:
        'This notice provides guidance relating to certain specified required minimum distributions (RMDs) for 2024. In addition, this notice announces that the final regulations that the Department of the Treasury (Treasury Department) and the Internal Revenue Service (IRS) intend to issue related to RMDs will apply for purposes of determining RMDs for calendar years beginning on or after January 1, 2025.',
    }],
    // The relief has already ended; the record states a settled historical
    // boundary rather than a window still waiting to close.
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/inheritedIra.ts#inheritedRequirementForYear',
    ],
  },

  'irc-401-a-9-B-ii-non-designated-beneficiary-five-year-rule': {
    title: 'Non-designated beneficiary uses the five-year rule before the RBD',
    statement:
      'A beneficiary that is not a designated beneficiary remains under the five-year rule when the employee dies before distributions begin: the entire interest must be distributed within five years. For an individual account, the §4974 required amount is the amount §1.401(a)(9)-5 requires for that calendar year. Classification refuses every estate, trust, and entity beneficiary class alike (X3) — including a see-through trust that would qualify under Treas. Reg. 1.401(a)(9)-4(f) — because the five-year/non-designated regime itself is not implemented. Projection then falls back to the separately registered legacy planning approximation in treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy and irc-401-a-9-E-ii-eligible-designated-beneficiary (inheritedForcedAmount), and the refusal reason rides the evidence rows so no consumer can read the schedule as compliant.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The plan schema records the non-individual category but has no facts to establish a qualifying trust or to calculate its separate five-year distribution schedule. The inherited classifier therefore emits its typed X3 refusal; projection still routes that refusal through the registered inheritedForcedAmount fallback so a plan that parsed still projects. inheritedRegime.test.ts covers the classification refusal on the driven path.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(E)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'The term "designated beneficiary" means any individual designated as a beneficiary by the employee.',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(H)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'In the case of a defined contribution plan, if an employee dies before the distribution of the employee\'s entire interest- (i) In general.-Except in the case of a beneficiary who is not a designated beneficiary, subparagraph (B)(ii)- (I) shall be applied by substituting "10 years" for "5 years", and (II) shall apply whether or not distributions of the employee\'s interests have begun in accordance with subparagraph (A).',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'A trust shall not constitute a qualified trust under this section unless the plan provides that, if an employee dies before the distribution of the employee\'s interest has begun in accordance with subparagraph (A)(ii), the entire interest of the employee will be distributed within 5 years after the death of such employee.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 54.4974-1(c)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-54.4974-1',
      quotedText:
        'Except as otherwise provided in this paragraph (c), if a payee\'s interest under a qualified retirement plan or any eligible deferred compensation plan is in the form of an individual account (and distribution of that account is not being made under an annuity contract purchased in accordance with § 1.401(a)(9)-5(a)(5) and § 1.401(a)(9)-6(d)), the amount of the required minimum distribution for any calendar year for purposes of section 4974 is the amount required to be distributed to that payee for that calendar year determined in accordance with § 1.401(a)(9)-5 as provided in the following (whichever applies)—',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/model/plan.ts#inheritedBeneficiarySchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/inheritedIra.ts#classifyInheritedRegime',
    ],
  },

  'treas-reg-1-401-a-9-8-a-1-ii-separate-account-deadline': {
    title: 'Separate-account treatment requires a timely separate account',
    statement:
      'Section 401(a)(9) applies separately to each beneficiary only when its interest is held in a separate account satisfying the regulatory requirements. The quoted (a)(1)(ii)(A) rule governs separate accounts established after the end of the calendar year following the employee\'s death: once those late-established accounts satisfy the separate-accounting requirements, later aggregate required distributions are determined without the separate-account rule of (a)(1)(i). Never-established accounts never switch that (a)(1)(i) rule on and are a different failure. Classification refuses multiple-beneficiary facts without separate-account facts (X4) rather than infer that any deadline was met; projection then falls back to the separately registered legacy planning approximation in treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy and irc-401-a-9-E-ii-eligible-designated-beneficiary (inheritedForcedAmount), and the refusal reason rides the evidence rows so no consumer can read the schedule as compliant.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The account model has no dated separate-account establishment fact. Its typed multiple-beneficiary refusal is already exercised in inheritedRegime.test.ts; projection still routes that refusal through the registered inheritedForcedAmount fallback so a plan that parsed still projects. No numeric describeRule is lawful for this out-of-scope record.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-8(a)(1)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-8',
      quotedText:
        'Except as otherwise provided in this paragraph (a)(1), for calendar years beginning after the calendar year in which the employee dies, section 401(a)(9) is applied separately with respect to the separate interests of each of the employee\'s beneficiaries under the plan provided that those interests are held in separate accounts that satisfy the separate accounting requirements of paragraphs (a)(2)(i) and (ii) of this section.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-8(a)(1)(ii)(A)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-8',
      quotedText:
        'If the separate accounts that satisfy the separate accounting requirements of paragraph (a)(2) of this section are not established until after the end of the calendar year following the calendar year of the employee\'s death, then for distribution calendar years after those requirements are satisfied— (A) The aggregate required distribution for a distribution calendar year is determined without regard to the separate account rule in paragraph (a)(1)(i) of this section;',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/model/plan.ts#inheritedAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/inheritedIra.ts#classifyInheritedRegime',
    ],
  },

  'treas-reg-54-4974-1-c-five-year-deadline-rmd': {
    title: 'Five-year deadline carries the remaining interest as its RMD',
    statement:
      'For an individual account, the §4974 required amount for a calendar year is the amount §1.401(a)(9)-5 requires. Where the five-year rule applies after a pre-RBD death, there is no required minimum distribution until the fifth-anniversary calendar year, and the required amount due in that year is the employee\'s entire interest. The unmodeled claim here is only that five-year application: the tenth-year entire-interest emptying is already modeled on the inheritedFinalSweep path and registered as irc-401-a-9-H-designated-beneficiary-ten-year-rule. Classification refuses every estate, trust, and entity beneficiary class alike (X3) for the five-year regime; projection then falls back to the separately registered legacy planning approximation in treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy and irc-401-a-9-E-ii-eligible-designated-beneficiary (inheritedForcedAmount), and the refusal reason rides the evidence rows so no consumer can read the schedule as compliant.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is the deadline-year limb of irc-401-a-9-B-ii-non-designated-beneficiary-five-year-rule. The same unmodeled estate/trust/entity facts make a numeric five-year fixture unavailable; inheritedRegime.test.ts exercises the classification refusal, and projection still routes that refusal through the registered inheritedForcedAmount fallback.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 54.4974-1(c)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-54.4974-1',
      quotedText:
        'Except as otherwise provided in this paragraph (c), if a payee\'s interest under a qualified retirement plan or any eligible deferred compensation plan is in the form of an individual account (and distribution of that account is not being made under an annuity contract purchased in accordance with § 1.401(a)(9)-5(a)(5) and § 1.401(a)(9)-6(d)), the amount of the required minimum distribution for any calendar year for purposes of section 4974 is the amount required to be distributed to that payee for that calendar year determined in accordance with § 1.401(a)(9)-5 as provided in the following (whichever applies)—',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 54.4974-1(c)(2)',
      url: 'https://www.ecfr.gov/current/title-26/section-54.4974-1',
      quotedText:
        'If an employee dies before the required beginning date and either § 1.401(a)(9)-3(c)(2) or (3) applies to the employee\'s beneficiary, there is no required minimum distribution until the end of the calendar year described in whichever of those paragraphs applies to the beneficiary (that is, the calendar year that includes the fifth anniversary or the tenth anniversary of the date of the employee\'s death, as applicable). The required minimum distribution due in that fifth or tenth calendar year is the employee\'s entire interest in the plan.',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'A trust shall not constitute a qualified trust under this section unless the plan provides that, if an employee dies before the distribution of the employee\'s interest has begun in accordance with subparagraph (A)(ii), the entire interest of the employee will be distributed within 5 years after the death of such employee.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/model/plan.ts#inheritedBeneficiarySchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/inheritedIra.ts#classifyInheritedRegime',
    ],
  },

  'treas-reg-1-401-a-9-9-d-joint-life-table-divisor-literals': {
    title: 'Joint and Last Survivor Table divisor literals',
    statement:
      'The Joint and Last Survivor Table supplies the literal divisor once the qualifying sole-beneficiary-spouse condition in treas-reg-1-401-a-9-5-joint-life-spouse-sole-beneficiary is met. Its row for owner age 75 and spouse age 64 is 25.3; its row for owner age 73 and spouse age 19 is 66.1.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-9(d), Table 3',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-9',
      quotedText:
        'Table 3 to Paragraph (d) Ages 18 19 20 21 22 23 24 25 26 … 73 67.1 66.1 65.1 64.2 63.2 62.2 61.2 60.3 59.3',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-9(d), Table 3',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-9',
      quotedText:
        'Table 3 to Paragraph (d) Ages 63 64 65 66 67 68 69 70 71 … 75 26.1 25.3 24.6 24.0 23.3 22.7 22.1 21.5 20.9',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/rmd/rmd.ts',
      'packages/engine/src/rmd/jointLifeTable.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/rmd/jointLifeTable.ts#jointLifeTableDivisor',
      'packages/engine/src/rmd/rmd.ts#requiredMinimumDistribution',
    ],
  },

  'irc-408A-c-4-roth-ira-no-lifetime-rmd': {
    title: 'Roth IRA owner has no lifetime RMD',
    statement:
      'Section 401(a)(9)(A) does not apply to a Roth IRA, so a living Roth IRA owner has no lifetime RMD or lifetime §4974 shortfall obligation.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(c)(4)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408A&num=0&edition=prelim',
      quotedText:
        'Notwithstanding subsections (a)(6) and (b)(3) of section 408 (relating to required distributions), the following provisions shall not apply to any Roth IRA: (A) Section 401(a)(9)(A).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-402A-d-5-designated-roth-account-no-lifetime-rmd': {
    title: 'Designated Roth employer account has no lifetime RMD after 2023',
    statement:
      'For taxable years beginning after December 31, 2023, section 401(a)(9)(A) does not apply to a designated Roth account. A living owner therefore has no lifetime RMD or lifetime section 4974 shortfall obligation for a Roth employer account. The projection reaches that result because its owner-RMD gate admits traditional accounts only, never a Roth account of either kind.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402A(d)(5)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'Notwithstanding sections 403(b)(10) and 457(d)(2), the following provisions shall not apply to any designated Roth account: (A) Section 401(a)(9)(A).',
    }, {
      kind: 'statute',
      citation: 'IRC 402A, Editorial Notes, Effective Date of 2022 Amendment (SECURE 2.0 Act § 325(b)(1))',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402A&num=0&edition=prelim',
      quotedText:
        'Except as provided in paragraph (2), the amendment made by this section [amending this section] shall apply to taxable years beginning after December 31, 2023.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/accountEligibility.ts#followsOwnerRmds',
    ],
  },

  'irc-402-c-4-B-rmd-not-eligible-rollover-distribution': {
    title: 'Required distributions are not eligible rollover distributions',
    statement:
      'A distribution is an eligible rollover distribution only to the extent it is not required under §401(a)(9). For an IRA, the regulation likewise treats the required-minimum-distribution portion as not eligible for rollover. The engine\'s implemented pension lump-sum path (projection/internal/pensionLumpSumRollovers.ts selects the electing pensions and reports the offer amount; projection/simulate.ts applies the credit) moves the entire lumpSumElection offer to the traditional account as a tax-free direct rollover with no 402(c)(4)(B) carve-out, even when the participant is past the required beginning date, so the required-distribution portion is rolled anyway and current-year tax is deferred.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. projection/simulate.ts\'s pension lump-sum rollover phase (model/plan.ts validates the election into an owned traditional account; projection/internal/pensionLumpSumRollovers.ts selects and sizes it and projection/simulate.ts credits it) moves the entire lumpSumOffer.amount as a tax-free direct rollover. Section 402(c)(4)(B) excludes the §401(a)(9)-required portion from the eligible-rollover-distribution definition; on the fixture an owner past the RBD with a 237,000 offer has a 10,000 RMD portion (237,000 ÷ Uniform Lifetime 23.7 at age 76) that should stay taxable and only 227,000 should roll. The engine rolls the full 237,000 and pays no taxable pension income in the election year. The fixture pins the produced zero taxable pension income and bounds the rolled balance above the eligible 227,000 until a separately authorized implementation fix changes it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402(c)(4)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "eligible rollover distribution" means any distribution to an employee of all or any portion of the balance to the credit of the employee in a qualified trust; except that such term shall not include-',
    }, {
      kind: 'statute',
      citation: 'IRC 402(c)(4)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'any distribution to the extent such distribution is required under section 401(a)(9), and',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(b)(3)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'The portion of a distribution from an IRA that is a required minimum distribution and thus not eligible for rollover is determined in the same manner as provided in § 1.402(c)-2(f) and (j) for a distribution from a qualified plan.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/pensionLumpSumRollovers.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#pensionSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/pensionLumpSumRollovers.ts#pensionLumpSumRollovers',
    ],
  },

  'treas-reg-54-4974-1-f-first-year-rbd-excise-tax': {
    title: 'Deferred first-year RMD shortfall is taxed in the RBD year',
    statement:
      'A first distribution-calendar-year RMD deferred to April 1 remains the preceding calendar year\'s RMD, but a shortfall is subject to §4974 in the calendar year containing the April 1 deadline. The separately due RMD for that RBD year remains its own required distribution.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 54.4974-1(f)',
      url: 'https://www.ecfr.gov/current/title-26/section-54.4974-1',
      quotedText:
        'If the amount not paid is an amount required to be paid by April 1 of a calendar year that includes the employee\'s required beginning date, the missed distribution is a required minimum distribution for the previous calendar year (that is, for the employee\'s or the individual\'s first distribution calendar year as determined in accordance with § 1.401(a)(9)-5(a)(2)(ii)). However, the excise tax under section 4974 is calculated with respect to the calendar year that includes the last day by which the amount is required to be distributed (that is, the calendar year that includes the employee\'s or individual\'s required beginning date) even though the preceding calendar year is the calendar year for which the amount is required to be distributed. There is also a required minimum distribution for the calendar year that includes the employee\'s or individual\'s required beginning date, and that distribution is also required to be made during the calendar year that includes the employee\'s or individual\'s required beginning date.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts',
      'packages/engine/src/rmd/rmdShortfallExcise.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/rmd/rmdShortfallExcise.ts#computeRmdShortfallExcise',
    ],
  },

  'treas-reg-54-4974-1-g-2-edb-ten-year-election-automatic-waiver': {
    title: 'EDB ten-year election automatic waiver has stated conditions',
    statement:
      'Unless the Commissioner determines otherwise, the automatic waiver applies only when the decedent died before the RBD; the payee is an individual eligible designated beneficiary whose annual amount used the default life-expectancy rule without an affirmative life-expectancy election; the payee missed that requirement; and the payee elects the ten-year rule by the end of the ninth calendar year after death. The regulation does not resolve whether a shortfall in the election year itself is waived; the engine denies the waiver when obligation.taxYear >= electionYear (including the election year) as a conservative reading — that denial can only raise the excise, never lower it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 54.4974-1(g)(2)',
      url: 'https://www.ecfr.gov/current/title-26/section-54.4974-1',
      quotedText:
        'Unless the Commissioner determines otherwise, the tax under paragraph (a) of this section is waived automatically if— (i) The employee\'s or individual\'s death is before the employee\'s or individual\'s required beginning date; (ii) The payee is an individual— (A) Who is an eligible designated beneficiary (as defined in § 1.401(a)(9)-4(e)); (B) Whose required minimum distribution amount for a calendar year is determined under the life expectancy rule described in § 1.401(a)(9)-3(c)(4); and (C) Who did not make an affirmative election to have the life expectancy rule apply as described in § 1.401(a)(9)-3(c)(5)(iii); (iii) The payee fails to satisfy the minimum distribution requirement; and (iv) The payee elects the 10-year rule described in § 1.401(a)(9)-3(c)(3) by the end of the ninth calendar year following the calendar year of the employee\'s death.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/rmd/rmdShortfallExcise.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/rmd/rmdShortfallExcise.ts#automaticWaiverReason',
    ],
  },

  'treas-reg-54-4974-1-g-3-year-of-death-automatic-waiver': {
    title: 'Year-of-death automatic waiver has stated conditions',
    statement:
      'Unless the Commissioner determines otherwise, the automatic year-of-death waiver applies only if an individual had a §1.401(a)(9)-3 or §1.401(a)(9)-5 distribution requirement, died in that same year without satisfying it, and the beneficiary takes the full corrective distribution by the stated later-of tax-filing or following-calendar-year deadline.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 54.4974-1(g)(3)',
      url: 'https://www.ecfr.gov/current/title-26/section-54.4974-1',
      quotedText:
        'Unless the Commissioner determines otherwise, the tax under paragraph (a) of this section is waived automatically if— (i) A distribution is required to be made to an individual under § 1.401(a)(9)-3 or § 1.401(a)(9)-5 in a calendar year; (ii) The individual who was required to take the distribution described in paragraph (g)(3)(i) of this section died in that calendar year without satisfying that distribution requirement; and (iii) The beneficiary of the individual described in paragraph (g)(3)(ii) of this section takes a corrective distribution in the amount needed to satisfy that distribution requirement no later than the tax filing deadline (including extensions thereof) for the taxable year of that beneficiary that begins with or within that calendar year (or, if later, the last day of the calendar year following that calendar year).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/rmd/rmdShortfallExcise.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/rmd/rmdShortfallExcise.ts#automaticWaiverReason',
    ],
  },

  'treas-reg-1-408-8-c-3-spouse-as-own-death-year-rmd': {
    title: 'Death-year spouse election retains the decedent’s unsatisfied RMD',
    statement:
      'After a spouse’s treat-as-own election, later RMDs use the spouse as owner. But when the election occurs in the calendar year of death, the spouse has no owner RMD for that year and instead must take the decedent’s unsatisfied year-of-death RMD.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(c)(3)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'Following an election described in paragraph (c)(1) of this section, the surviving spouse is considered the IRA owner for whose benefit the trust is maintained for all purposes under the Internal Revenue Code (including section 72(t)). Thus, for example, the required minimum distribution for the calendar year of the election and each subsequent calendar year is determined under section 401(a)(9)(A) with the spouse as IRA owner and not section 401(a)(9)(B) with the surviving spouse as the deceased IRA owner\'s beneficiary. However, if the election is made in the calendar year that includes the date of the IRA owner\'s death, the spouse is not required to take a required minimum distribution as the IRA owner for that calendar year. Instead, the spouse is required to take a required minimum distribution for that year, determined with respect to the deceased IRA owner under the rules of § 1.401(a)(9)-5(c), to the extent the distribution was not made to the IRA owner before death.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/accountEligibility.ts#isTreatAsOwnEffective',
      'packages/engine/src/strategies/inheritedIra.ts#classifyInheritedRegime',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

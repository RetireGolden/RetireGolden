/**
 * Social Security marital eligibility records: living divorced-spouse
 * entitlement on a worker's record, ordinary-widow duration and remarriage
 * gates, and the inexpressible duration-exception and divorced-remarriage
 * continuation limbs.
 *
 * One slice of the tax rule registry. `../taxRuleRegistry.ts` composes every
 * slice into `TAX_RULE_REGISTRY`; read it for what a record must carry and why.
 */
import type { TaxRuleRecord } from '../taxRuleRegistry.js'

// `satisfies` without `as const`, matching the composed registry: keys and the
// union-typed fields (classification, kind, volatility) stay literal for
// describeRule's conditional typing, while the prose strings widen to `string`.
export const socialSecurityMaritalEligibilityRecords = {
  'cfr-20-404-331-living-divorced-spouse-eligibility': {
    title: 'A living divorced spouse is entitled on a disability-entitled worker under 62, and independently only after two years when the worker is not entitled',
    statement:
      'A divorced wife or husband is entitled on a worker already entitled to old-age or disability insurance benefits when the 10-year marriage, currently-unmarried, and other paragraphs (a) through (e) conditions are met, with no worker-age-62 and no two-year-divorce requirement on that path. Independently of that, a divorced spouse of a worker who is not yet entitled is entitled only when that worker has attained 62 and is fully insured and the claimant has been divorced at least two years. isDivorcedSpouseEligible applies a 10-year marriage gate, a currently-single gate, and a calendar-year age-62 gate on the living ex, and has no worker-entitlement, fully-insured, or divorce-date facts, so it rejects an already-disability-entitled ex under 62 and admits a not-yet-entitled age-62 ex divorced only one year. This candidate-menu function does not adjudicate the claimant\'s own age-62 condition or the own-PIA versus half-PIA restriction. Because the engine both withholds a payable benefit and pays one the authority would refuse, the tax error including replacement withdrawals runs both ways.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. 20 CFR 404.331 splits the worker-entitled path (paragraphs (a) through (e), including a disability-entitled worker under 62) from the independently entitled path (paragraphs (a) through (f), worker at least 62 and not yet entitled, two years divorced). formerSpouseSchema carries relationship, dob, piaMonthly, and marriageYears, and has no worker-entitlement, fully-insured, or divorce-date fact, so isDivorcedSpouseEligible substitutes a calendar-year age-62 blanket. The companion fixture holds the claimant at FRA so the half-PIA amount is 1,500; worksheet-only facts projected out of the schema are an already-disability-entitled ex at 61 and a not-yet-entitled ex at 62 divorced one year. The claimant age-62 condition is supplied by a valid Plan claimAge and by spousalBenefitFactor, not by an explicit 62 predicate here, and the own-PIA restriction is a dual-entitlement offset this menu does not adjudicate.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.331',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.331',
      quotedText:
        'You are entitled to wife\'s or husband\'s benefits as the divorced wife or divorced husband of an insured person who is entitled to old-age or disability benefits if you meet the requirements of paragraphs (a) through (e). You are entitled to these benefits even though the insured person is not yet entitled to benefits, if the insured person is at least age 62 and if you meet the requirements of paragraphs (a) through (f). The requirements are that—',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.331(a)(2)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.331',
      quotedText:
        'You were married to the insured for at least 10 years immediately before your divorce became final;',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.331(c)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.331',
      quotedText:
        'You are not married. (For purposes of meeting this requirement, you will be considered not to be married throughout the month in which the divorce occurred);',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.331(f)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.331',
      quotedText:
        'You have been divorced from the insured person for at least 2 years.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'The wife (as defined in section 416(b) of this title) and every divorced wife (as defined in section 416(d) of this title) of an individual entitled to old-age or disability insurance benefits, if such wife or such divorced wife-',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(b)(4)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'Notwithstanding the preceding provisions of this subsection, except as provided in subparagraph (B), the divorced wife of an individual who is not entitled to old-age or disability insurance benefits, but who has attained age 62 and is a fully insured individual (as defined in section 414 of this title), if such divorced wife- (i) meets the requirements of subparagraphs (A) through (D) of paragraph (1), and (ii) has been divorced from such insured individual for not less than 2 years, shall be entitled to a wife\'s insurance benefit under this subsection for each month, in such amount, and beginning and ending with such months, as determined (under regulations of the Commissioner of Social Security) in the manner otherwise provided for wife\'s insurance benefits under this subsection, as if such insured individual had become entitled to old-age insurance benefits on the date on which the divorced wife first meets the criteria for entitlement set forth in clauses (i) and (ii).',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(c)(4)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'Notwithstanding the preceding provisions of this subsection, except as provided in subparagraph (B), the divorced husband of an individual who is not entitled to old-age or disability insurance benefits, but who has attained age 62 and is a fully insured individual (as defined in section 414 of this title), if such divorced husband- (i) meets the requirements of subparagraphs (A) through (D) of paragraph (1), and (ii) has been divorced from such insured individual for not less than 2 years, shall be entitled to a husband\'s insurance benefit under this subsection for each month, in such amount, and beginning and ending with such months, as determined (under regulations of the Commissioner of Social Security) in the manner otherwise provided for husband\'s insurance benefits under this subsection, as if such insured individual had become entitled to old-age insurance benefits on the date on which the divorced husband first meets the criteria for entitlement set forth in clauses (i) and (ii).',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 416(d)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section416&num=0&edition=prelim',
      quotedText:
        'The term "divorced wife" means a woman divorced from an individual, but only if she had been married to such individual for a period of 10 years immediately before the date the divorce became effective.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: ['packages/engine/src/socialSecurity/maritalBenefits.ts'],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/maritalBenefits.ts#isDivorcedSpouseEligible',
    ],
  },

  'cfr-20-404-335-ordinary-widow-eligibility': {
    title: 'Ordinary widow nine-month duration, age-60, and remarriage gates, including currently unmarried after an intervening marriage ends',
    statement:
      'Subject to the other entitlement requirements in 20 CFR 404.335(a) through (e), an ordinary widow or widower of a person who died fully insured is entitled on the ordinary nine-month duration, age-60, and currently-unmarried gates, except that a remarriage after age 60 is disregarded. Those other requirements include that the application requirement is met — a new application is not required when one of the conditions in 404.335(b)(1) through (4) applies — and that the claimant is not entitled to an old-age benefit equal to or larger than the insured person\'s primary insurance amount. isWidowEligible applies the nine-month duration and the age-60 gate to every deceased formerSpouse. It ignores claimantIsSingle entirely: a schema-valid coupled context with remarriedAtAge null still receives a candidate without establishing any 404.335(e) remarriage exception, because a null remarriedAtAge does not prove a marriage before 60 and does not carry the facts of a later remarriage. Independently, a historical remarriage before 60 is treated as an unconditional forfeiture even when the claimant is now single, so an intervening marriage that has ended is expressible via claimantIsSingle and qualifies under the currently-unmarried lead-in but is rejected. A remarriage at or after 60 is preserved even if the claimant is still married. The helper does not adjudicate the claimant\'s own old-age benefit against the deceased\'s PIA; that pricing comparison lives elsewhere. It assumes this ordinary-widow branch rather than the surviving-divorced ten-year duration. The disabled-widow age-50 limb is `usc-42-402-e-1-b-ii-cfr-20-404-335-disabled-widow-age-50-prescribed-period`. Because the engine can pay a candidate the authority would refuse on coupled remarriedAtAge-null facts and can withhold a payable benefit on now-single pre-60 remarriage facts, and because a missing or extra benefit dollar can be replaced by or avoid a fully taxable withdrawal, the tax error including replacement withdrawals runs both ways.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. 20 CFR 404.335(e) starts from currently unmarried; a later marriage that has ended leaves the claimant unmarried and inside that lead-in. isWidowEligible instead rejects whenever remarriedAtAge is below 60, including when claimantIsSingle is true. Independently, isWidowEligible never reads claimantIsSingle, so a schema-valid coupled context with remarriedAtAge null still receives a candidate; a null remarriedAtAge lacks the facts of any 404.335(e) exception and does not prove a marriage before 60. maritalBenefits.test.ts already characterizes that coupled-null admission. The companion fixture holds the deceased at FRA so RIB-LIM and the survivor-FRA cohort error are not in play: 9-month ordinary, 8-month with no duration exception, remarried at 59 now single, remarried at 60 still married, the same 9-month no-remarriage facts at claimant age 59 and 60, then the same FRA-67 9-month facts with claimantIsSingle false and remarriedAtAge null where the worksheet current pre-60 marriage is projected out. The age-60 gate is the helper\'s own claimantAge test. The age-59 and age-60 cells use a direct helper contract (claimantClaimAge equal to claimantAge so the claim-age guard passes and age 59 is refused by isWidowEligible); a whole-plan stream claimAge is clamped to 62–70 and is outside this fixture. Fully-insured status, application (including the 404.335(b)(1) through (4) exceptions), and the 404.335(d) own-old-age-benefit restriction have no formerSpouse or stream fields and are not adjudicated here; the dual-entitlement offset is a pricing comparison elsewhere. The disabled-widow age-50 limb is `usc-42-402-e-1-b-ii-cfr-20-404-335-disabled-widow-age-50-prescribed-period`; the 9-month statutory exceptions are `cfr-20-404-335-a-widow-duration-exceptions`.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.335',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'We will find you entitled to benefits as the widow or widower of a person who died fully insured if you meet the requirements in paragraphs (a) through (e) of this section:',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(a)(1)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'Your relationship to the insured as a wife or husband lasted for at least 9 months immediately before the insured died.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(b)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'You apply, except that you need not apply again if you meet one of the conditions in paragraphs (b)(1) through (4) of this section:',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(c)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'You are at least 60 years old; or you are at least 50 years old and have a disability as defined in § 404.1505 and you meet all of the conditions in paragraphs (c)(1) through (4) of this section:',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(d)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'You are not entitled to an old-age benefit that is equal to or larger than the insured person\'s primary insurance amount.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(e), (e)(1)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'You are unmarried, unless for benefits for months after 1983 you meet one of the conditions in paragraphs (e)(1) through (3) of this section: (1) You remarried after you became 60 years old.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'The widow (as defined in section 416(c) of this title) and every surviving divorced wife (as defined in section 416(d) of this title) of an individual who died a fully insured individual, if such widow or such surviving divorced wife- (A) is not married, (B)(i) has attained age 60, or (ii) has attained age 50 but has not attained age 60 and is under a disability (as defined in section 423(d) of this title) which began before the end of the period specified in paragraph (4),',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(1)(C)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'has filed application for widow\'s insurance benefits,',
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
      kind: 'statute',
      citation: '42 U.S.C. 416(c)(1)(E)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section416&num=0&edition=prelim',
      quotedText:
        'except as provided in paragraph (2), she was married to him for a period of not less than nine months immediately prior to the day on which he died, or',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: ['packages/engine/src/socialSecurity/maritalBenefits.ts'],
    implementedByFunctions: [
      'packages/engine/src/socialSecurity/maritalBenefits.ts#isWidowEligible',
    ],
  },

  'cfr-20-404-335-a-widow-duration-exceptions': {
    title: 'The statutory alternatives to the ordinary widow nine-month duration are outside the Plan',
    statement:
      'The ordinary nine-month widow duration in 404.335(a)(1) is not the only way to qualify the widow or widower relationship. Under 404.335(a)(2), a shorter marriage still qualifies when, at the time of the marriage, the insured was reasonably expected to live for nine months and (i) the death was accidental, (ii) the death occurred in the line of duty while serving on active duty as a member of the uniformed services, or (iii) the claimant had been previously married to the same insured for at least nine months; or when (iv) the insured\'s prior spouse was institutionalized during that prior marriage due to mental incompetence or similar incapacity, the insured would have divorced that prior spouse and married the claimant but did not because the divorce would have been unlawful by reason of the institutionalization under the laws of the State in which the insured was then domiciled, the prior spouse remained institutionalized up to death, and the insured married the claimant within 60 days after that death. Independently of those (a)(2) duration exceptions, 404.335(a)(3) and (a)(4) are alternative relationship qualifications, not a deemed nine-month duration: the claimant and the insured were the natural parents of a child, or were married when either adopted the other\'s child or both adopted a child then under 18; or, in the month before this marriage, the claimant was entitled to, or if the claimant had applied and had been old enough could have been entitled to, a listed widow\'s, widower\'s, father\'s, mother\'s, wife\'s, husband\'s, parent\'s, or disabled-child benefit or a qualifying Railroad Retirement annuity. formerSpouseSchema carries only marriageYears, so none of those exception facts can be expressed and no accepted Plan reaches this limb; the engine produces no figure from it. The ordinary nine-month duration itself is the modeled gate on `cfr-20-404-335-ordinary-widow-eligibility`; this record is the exception limb only.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'accidental death of the insured with a reasonable nine-month life expectancy at the time of the marriage',
        'death in the line of duty while serving on active duty as a member of the uniformed services, with a reasonable nine-month life expectancy at the time of the marriage',
        'a prior marriage to the same insured that had already lasted at least nine months, with a reasonable nine-month life expectancy at the time of the later marriage',
        'a prior spouse institutionalized during the marriage to the insured due to mental incompetence or similar incapacity; that the insured would have divorced that prior spouse and married the claimant but did not because the divorce would have been unlawful by reason of the institutionalization under the laws of the State in which the insured was then domiciled; that the prior spouse remained institutionalized up to death; and that the insured married the claimant within 60 days after that death',
        'that the claimant and the insured were the natural parents of a child, or were married when either adopted the other\'s child or both adopted a child then under 18',
        'that in the month before this marriage the claimant was entitled to, or if the claimant had applied and had been old enough could have been entitled to, a listed widow\'s, widower\'s, father\'s, mother\'s, wife\'s, husband\'s, parent\'s, or disabled-child benefit or a qualifying Railroad Retirement annuity',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Absence-record surface is model/plan.ts: formerSpouseSchema has marriageYears and no accident, life-expectancy, active-duty, prior-marriage, institutionalization, legal-impediment, 60-day-marriage-timing, child-in-common, adoption, prior-entitlement, or could-have-been-entitled fact. An 8-month marriage with no exception is already refused by the ordinary duration gate; an 8-month marriage that would qualify only through one of these 404.335(a)(2) exceptions, or a marriage that would qualify only through the (a)(3) or (a)(4) alternative relationship qualifications, cannot be represented. The disabled-widow age-50 limb is a different record.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.335(a)(2)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'Your relationship to the insured as a wife or husband did not last 9 months before the insured died, but you meet one of the conditions in paragraphs (a)(2)(i) through (iv) of this section.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(a)(2)(i)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'At the time of your marriage the insured was reasonably expected to live for 9 months, and the death of the insured was accidental. The death is accidental if it was caused by an event that the insured did not expect, if it was the result of bodily injuries received from violent and external causes, and if, as a direct result of these injuries, death occurred not later than 3 months after the day on which the bodily injuries were received. An intentional and voluntary suicide will not be considered an accidental death.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(a)(2)(ii)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'At the time of your marriage the insured was reasonably expected to live for 9 months, and the death of the insured occurred in the line of duty while he or she was serving on active duty as a member of the uniformed services as defined in § 404.1019.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(a)(2)(iii)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'At the time of your marriage the insured was reasonably expected to live for 9 months, and you had been previously married to the insured for at least 9 months.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(a)(2)(iv)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'The insured had been married prior to his or her marriage to you and the prior spouse was institutionalized during the marriage to the insured due to mental incompetence or similar incapacity. During the period of the prior spouse\'s institutionalization, the insured, as determined based on evidence satisfactory to the Agency, would have divorced the prior spouse and married you, but the insured did not do so because the divorce would have been unlawful, by reason of the institutionalization, under the laws of the State in which the insured was domiciled at the time. Additionally, the prior spouse must have remained institutionalized up to the time of his or her death and the insured must have married you within 60 days after the prior spouse\'s death.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(a)(3)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'You and the insured were the natural parents of a child; or you were married to the insured when either of you adopted the other\'s child or when both of you adopted a child who was then under 18 years old.',
    }, {
      kind: 'regulation',
      citation: '20 CFR 404.335(a)(4)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.335',
      quotedText:
        'In the month before you married the insured, you were entitled to or, if you had applied and had been old enough, could have been entitled to any of these benefits or payments: widow\'s, widower\'s, father\'s (based on the record of a fully insured individual), mother\'s (based on the record of a fully insured individual), wife\'s, husband\'s, parent\'s, or disabled child\'s benefits; or annuity payments under the Railroad Retirement Act for widows, widowers, parents, or children age 18 or older.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 416(k)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section416&num=0&edition=prelim',
      quotedText:
        'The requirement in clause (E) of subsection (c)(1) or clause (E) of subsection (g)(1) that the surviving spouse of an individual have been married to such individual for a period of not less than nine months immediately prior to the day on which such individual died in order to qualify as such individual\'s widow or widower, and the requirement in subsection (e) that the stepchild of a deceased individual have been such stepchild for not less than nine months immediately preceding the day on which such individual died in order to qualify as such individual\'s child, shall be deemed to be satisfied, where such individual dies within the applicable nine-month period, if- (1) his death- (A) is accidental, or (B) occurs in line of duty while he is a member of a uniformed service serving on active duty (as defined in section 410(l)(2) of this title), unless the Commissioner of Social Security determines that at the time of the marriage involved the individual could not have reasonably been expected to live for nine months, or (2)(A) the widow or widower of such individual had been previously married to such individual and subsequently divorced and such requirement would have been satisfied at the time of such divorce if such previous marriage had been terminated by the death of such individual at such time instead of by divorce;…',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#formerSpouseSchema',
    ],
  },

  'cfr-20-404-332-b-3-divorced-spouse-remarriage-continuation': {
    title: 'A divorced-spouse benefit can continue after remarriage to another entitled beneficiary',
    statement:
      'A divorced wife\'s or husband\'s already-established entitlement does not end merely because the claimant marries someone other than the insured, when that other person is entitled to benefits as a wife, husband, widow, widower, father, mother, parent, or disabled child; it does end if the claimant remarries the insured who is not yet entitled to old-age benefits. formerSpouseSchema and the household have no prior divorced-spouse entitlement, no subsequent-remarriage-to-a-beneficiary fact, and no identity of the new spouse as one of those entitled persons, so no accepted Plan reaches this continuation exception and the engine produces no figure from it. New entitlement while currently married remains the separate 404.331(c) unmarried gate on the living-divorced eligibility record.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'a prior divorced-spouse entitlement that could continue after a later marriage',
        'a subsequent remarriage to someone other than the insured',
        'that new spouse\'s entitlement as a wife, husband, widow, widower, father, mother, parent, or disabled child',
        'whether a remarriage to the same insured occurred while that insured was not yet entitled to old-age benefits',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Absence-record surface is model/plan.ts: claimantIsSingle is derived from household size, and formerSpouseSchema has no prior-entitlement or new-spouse-beneficiary fact. 404.331(c) still requires a new divorced-spouse claim to start from currently unmarried; this record is only the 404.332(b)(3) / 402(b)(3) continuation exception after entitlement already exists. Treating a currently-married household as a refused new claim is the living-divorced eligibility gate, not this exception.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.332(b)(3)',
      url: 'https://www.ecfr.gov/current/title-20/chapter-III/part-404/subpart-D/subject-group-ECFR219bf3e41a78e9f/section-404.332',
      quotedText:
        'You are the divorced wife or divorced husband and you marry someone, other than the insured who is entitled to old-age benefits, unless that other person is someone entitled to benefits as a wife, husband, widow, widower, father, mother, parent or disabled child. Your benefits will end if you remarry the insured who is not yet entitled to old-age benefits.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(b)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'In the case of any divorced wife who marries- (A) an individual entitled to benefits under subsection (c), (f), (g), or (h) of this section, or (B) an individual who has attained the age of 18 and is entitled to benefits under subsection (d), such divorced wife\'s entitlement to benefits under this subsection shall, notwithstanding the provisions of paragraph (1) (but subject to subsection (s)), not be terminated by reason of such marriage.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(c)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section402&num=0&edition=prelim',
      quotedText:
        'In the case of any divorced husband who marries- (A) an individual entitled to benefits under subsection (b), (e), (g), or (h) of this section, or (B) an individual who has attained the age of 18 and is entitled to benefits under subsection (d), by reason of paragraph (1)(B)(ii) thereof, such divorced husband\'s entitlement to benefits under this subsection, notwithstanding the provisions of paragraph (1) (but subject to subsection (s)), shall not be terminated by reason of such marriage.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: ['packages/engine/src/model/plan.ts'],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#formerSpouseSchema',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

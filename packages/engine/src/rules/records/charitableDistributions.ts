/**
 * Qualified charitable distribution records: section 408(d)(8) in full — the annual
 * limit, the age gate, the eligible source and recipient tests, the taxable-first
 * ordering, and the projection-level proxies for each.
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
export const charitableDistributionRecords = {
  'irc-408-d-8-D-qcd-taxable-first': {
    title: 'A QCD is drawn from pre-tax dollars first',
    statement:
      'Notwithstanding section 72, a charitable distribution is deemed to consist of otherwise-includible dollars up to the aggregate pre-tax balance across all of the owner’s IRAs. The QCD therefore leaves the Form 8606 pro-rata denominator entirely and full basis survives for the year’s other distributions; only the portion exceeding aggregate pre-tax dollars is not a QCD and does receive basis.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(D)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'Notwithstanding section 72, in determining the extent to which a distribution is a qualified charitable distribution, the entire amount of the distribution shall be treated as includible in gross income without regard to subparagraph (A) to the extent that such amount does not exceed the aggregate amount which would have been so includible if all amounts in all individual retirement plans of the individual were distributed during such taxable year and all such plans were treated as 1 contract for purposes of determining under section 72 the aggregate amount which would have been so includible. Proper adjustments shall be made in applying section 72 to other distributions in such taxable year and subsequent taxable years.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B (2025), Are Distributions Taxable?',
      url: 'https://www.irs.gov/publications/p590b',
      quotedText:
        'The amount of the QCD is limited to the amount of the distribution that would otherwise be included in income. If your IRA includes nondeductible contributions, the distribution is first considered to be paid out of otherwise taxable income.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), Line 7',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText: 'Don’t include any of the following on line 7 ... Qualified charitable distributions (QCDs).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: [
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts',
      // The legacy projection reaches the same result structurally rather than
      // arithmetically: a moving QCD carries no Form 8606 line, so its gross
      // never enters the annual denominator and no basis is allocated to it.
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts#stageAnnualQcdTaxCharacterPostPass',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
    ],
  },

  'irc-408-d-8-includible-qcd-basis': {
    title: 'Basis treatment of a QCD that is only partly excludable',
    statement:
      'The portion of a QCD not excluded — because it exceeds the annual limit or was reduced by the post-70.5 deductible-contribution offset — remains a QCD, was already deemed pre-tax by 408(d)(8)(D), stays off Form 8606 line 7, and recovers no basis.',
    classification: 'unsettled',
    contraryReading:
      'The Form 1040 instructions direct the filer to enter "the part that is not a QCD" on line 4b and treat "QCD" as the capped amount, which would route the over-limit excess to Form 8606 line 7 and give it pro-rata basis. No regulation, ruling, or IRS example addresses a partly-excludable QCD from an IRA that also carries basis. The readings differ in current-year taxable income and in whether basis is consumed or preserved; the engine takes the statutory reading, which is also the conservative one.',
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(E)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'Qualified charitable distributions which are not includible in gross income pursuant to subparagraph (A) shall not be taken into account in determining the deduction under section 170.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 1040 (2025), line 4a/4b Exception 3',
      url: 'https://www.irs.gov/pub/irs-pdf/i1040gi.pdf',
      quotedText:
        'If only part of the distribution is a QCD, enter the part that is not a QCD on line 4b unless Exception 2 applies to that part.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts#stageAnnualQcdTaxCharacterPostPass',
    ],
  },

  'form-1040-line-4b-and-form-8606-line-7-qcd-remainder': {
    title: 'A non-QCD charitable remainder does not create a line-8 conversion',
    statement:
      'When a charitable distribution exceeds the amount that can be a QCD because it would otherwise be includible, Form 1040 directs the part that is not a QCD to line 4b unless its Exception 2 applies. Form 8606 excludes QCDs from line 7 and asks for a net amount converted to a Roth IRA on line 8. A named QCD action with a non-QCD remainder but no Roth conversion therefore carries that remainder in the line-7 distribution total and produces zero line 8.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B), flush text',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'A distribution shall be treated as a qualified charitable distribution only to the extent that the distribution would be includible in gross income without regard to subparagraph (A).',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 1040 (2025), line 4a/4b Exception 3',
      url: 'https://www.irs.gov/pub/irs-pdf/i1040gi.pdf',
      quotedText:
        'If only part of the distribution is a QCD, enter the part that is not a QCD on line 4b unless Exception 2 applies to that part.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), Line 7',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText:
        'Don’t include any of the following on line 7 … Qualified charitable distributions (QCDs).',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), Line 8',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText:
        'If, in 2025, you converted any amounts from traditional IRAs to a Roth IRA, enter on line 8 the net amount you converted.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts',
      'packages/engine/src/actions/annualQcdResidualForm8606.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdResidualForm8606.ts#stageAnnualQcdResidualForm8606',
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts#stageAnnualQcdTaxCharacterPostPass',
    ],
  },

  'irc-408-d-8-E-excluded-qcd-no-section-170-double-benefit': {
    title: 'An excluded QCD cannot also produce a section 170 deduction',
    statement:
      'A qualified charitable distribution excluded from gross income under section 408(d)(8)(A) is not taken into account in determining the charitable-contribution deduction under section 170. The engine therefore leaves the section 170 eligible amount at zero for a wholly excluded QCD. The portion not excluded under 408(d)(8)(A) — the includible QCD slice and any non-QCD remainder — is outside this bar; whether it is deductible is governed by section 170\'s own requirements, and the engine separately requires the entire-distribution-otherwise-deductible attestation before treating any of it as eligible.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(E)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'Qualified charitable distributions which are not includible in gross income pursuant to subparagraph (A) shall not be taken into account in determining the deduction under section 170.',
    }, {
      kind: 'statute',
      citation: 'IRC 170(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'There shall be allowed as a deduction any charitable contribution (as defined in subsection (c)) payment of which is made within the taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts',
      'packages/engine/src/actions/annualQcdDerivedTaxCharacter.ts',
      'packages/engine/src/actions/annualQcdDeductionTreatmentCoordinator.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdDeductionTreatmentCoordinator.ts#coordinateAnnualQcdDeductionTreatment',
      'packages/engine/src/actions/annualQcdDerivedTaxCharacter.ts#finalizeAnnualQcdDerivedTaxCharacter',
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts#stageAnnualQcdTaxCharacterPostPass',
    ],
  },

  'irc-408-d-8-A-annual-qcd-limit': {
    title: 'Annual QCD exclusion limit',
    statement:
      'The aggregate amount of qualified charitable distributions excludable from gross income is $111,000 per taxpayer for 2026, indexed annually.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2025-67',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The aggregate amount of qualified charitable distributions that are not includible in gross income under section 408(d)(8)(A) is increased from $108,000 to $111,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/params/data/year2026.ts'],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
    ],
  },

  // --- Registered 2026-08-03 from the WS1 rule-matrix audit ---------------

  'irc-408-d-8-B-ii-age-70-half': {
    title: 'Date a donor attains age 70.5 for QCD eligibility',
    statement:
      'QCD eligibility begins on the date six calendar months after the 70th anniversary of birth. The engine computes it as 846 calendar months from the birth date and clamps a nonexistent target day to the last day of that month. Every published QCD age record names that arithmetic in its own field, calculation: addCalendarMonths846WithMonthEndClamp, so a consumer reading the threshold date can see it was chosen rather than found; the age 59.5 and age 65 thresholds already publish the same disclosure for the same reason.',
    classification: 'unsettled',
    contraryReading:
      'A two-step computation (70th anniversary, then six months) diverges from the one-step 846-month form for a 29 February birth, because the 70th anniversary of a leap-day birth never falls in a leap year. For a 1956-02-29 birth the defensible answers are 2026-08-28 (clamped anniversary plus six months), 2026-08-29 (one step), and 2026-09-01 (rolled anniversary plus six months): five days apart, with nothing selecting among them.',
    errorDirection: null,
    conventionRationale:
      'The six-calendar-months sentence survives, but only in a provision written for something else: T.D. 10001 removed it from Treas. Reg. 1.401(a)(9)-2 and it now sits in 1.401(a)(9)-6(g)(1)(iv), a defined-benefit actuarial-increase rule. It has also been dropped from current IRS publications and survives there only in Publication 575 (2019). So the convention is sourced, but not from any provision addressed to IRC 408(d)(8)(B)(ii). What no source resolves at any level is a month-end or leap-day birth: no IRS guidance, ruling, case, publication example, or practitioner source addresses what "six calendar months after" means when the target day does not exist. The month-end clamp is chosen because it matches 29 CFR 4000.43, the one federal regulation resolving this class of problem, and because it is the prevailing practitioner convention. That regulation governs PBGC filings under ERISA Title IV and the IRS has never adopted it here, so the clamp is an engineering convention and not a legal conclusion. It errs permissive: for an August 31 birth it falls up to three days before a roll-forward reading, and a QCD taken in that window would not be a QCD at all. The date is load-bearing twice, because the SECURE 1.0 offset in 408(d)(8)(A) also keys the sweep of section 219 deductions to it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'which is made on or after the date that the individual for whose benefit the plan is maintained has attained age 70 1/2.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(g)(1)(iv) (relocated from 1.401(a)(9)-2 A-3 by T.D. 10001)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-6',
      quotedText:
        'An employee attains age 70 1/2 as of the date six calendar months after the 70th anniversary of the employee’s birth.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 575 (2019)',
      url: 'https://www.irs.gov/pub/irs-prior/p575--2019.pdf',
      quotedText:
        'You reach age 70 1/2 on the date that is 6 calendar months after the date of your 70th birthday.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      'packages/engine/src/actions/annualQcdActionExecutionEvidence.ts',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts',
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdActionExecutionEvidence.ts#publishAnnualQcdActionExecutionEvidence',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts#evaluateAnnualQcdExecutionPrerequisites',
      'packages/engine/src/model/plan.ts#personSchema',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    ],
  },

  'irc-408-d-8-beneficiary-ira-source': {
    title: 'Inherited IRA as a QCD source',
    statement:
      'A beneficiary who has personally attained age 70.5 may make a QCD from an inherited IRA; the controlling fact is the beneficiary’s own age, not the decedent’s. Not modelled in v1: separate beneficiary basis history is required and is never borrowed from the donor’s own pool, so an inherited source is classification-only and non-actionable.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2007-7, Q&A-37',
      url: 'https://www.irs.gov/pub/irs-drop/n-07-07.pdf',
      quotedText:
        'The exclusion from gross income for qualified charitable distributions is available for distributions from an IRA maintained for the benefit of a beneficiary after the death of the IRA owner if the beneficiary has attained age 70 1/2 before the distribution is made.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(2)(i)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'IRAs for which the individual is the IRA owner are not aggregated with IRAs for which the individual is a beneficiary.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts',
      // The replay enforces the same confinement structurally rather than by
      // reading the request: a named gift's occurrence is source-compatible
      // only with an owned, non-inherited IRA, so an inherited source cannot
      // reach the owned pool's basis history however the request was authored.
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/annualQcdPhysicalExecution.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts#evaluateAnnualQcdExecutionPrerequisites',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
      'packages/engine/src/actions/annualQcdPhysicalExecution.ts#stageAnnualQcdPhysicalExecution',
    ],
  },

  'irc-408-d-8-roth-ira-source': {
    title: 'Roth IRA as a QCD source',
    statement:
      'A QCD may legally be made from a Roth IRA, but only to the extent the distribution would otherwise be includible in gross income. Not modelled in v1: the engine cannot prove the Roth tax character that would make any part otherwise includible, so a Roth source is unsupported rather than refused.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2007-7, Q&A-36',
      url: 'https://www.irs.gov/pub/irs-drop/n-07-07.pdf',
      quotedText:
        'Generally, the exclusion for qualified charitable distributions is available for distributions from any type of IRA (including a Roth IRA described in section 408A and a deemed IRA described in section 408(q)) that is neither an ongoing SEP IRA described in section 408(k) nor an ongoing SIMPLE IRA described in section 408(p).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts',
      // The same structural confinement: the replay's source-compatibility
      // switch admits a named gift only from a traditional owned IRA, so a
      // Roth source is refused before any question of tax character arises.
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/annualQcdPhysicalExecution.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts#evaluateAnnualQcdExecutionPrerequisites',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
      'packages/engine/src/actions/annualQcdPhysicalExecution.ts#stageAnnualQcdPhysicalExecution',
    ],
  },

  'irc-408-d-8-B-ongoing-sep-simple-source-exclusion': {
    title: 'An ongoing SEP or SIMPLE IRA is not a QCD source',
    statement:
      'A QCD is not available from an ongoing SEP IRA or ongoing SIMPLE IRA. The statutory parenthetical excludes "a plan described in subsection (k) or (p)" without a temporal qualifier; Notice 2007-7 Q&A-36 construes it as reaching only an ongoing plan, defined by an employer contribution for the plan year ending with or within the owner\'s taxable year. The engine follows the notice: it requires year-specific employer-contribution evidence for a SEP or SIMPLE source, refuses the source when the plan is ongoing, and fails closed when that activity is unknown.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'For purposes of this paragraph, the term "qualified charitable distribution" means any distribution from an individual retirement plan (other than a plan described in subsection (k) or (p))-',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2007-7, Q&A-36',
      url: 'https://www.irs.gov/pub/irs-drop/n-07-07.pdf',
      quotedText:
        'Generally, the exclusion for qualified charitable distributions is available for distributions from any type of IRA (including a Roth IRA described in § 408A and a deemed IRA described in § 408(q)) that is neither an ongoing SEP IRA described in § 408(k) nor an ongoing SIMPLE IRA described in § 408(p). For this purpose, a SEP IRA or a SIMPLE IRA is treated as ongoing if it is maintained under an employer arrangement under which an employer contribution is made for the plan year ending with or within the IRA owner’s taxable year in which the charitable contributions would be made.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B (2025), Qualified charitable distributions (QCDs)',
      url: 'https://www.irs.gov/publications/p590b',
      quotedText:
        'A QCD is generally a nontaxable distribution made directly by the trustee of your IRA (other than an ongoing SEP or SIMPLE IRA) to an organization eligible to receive tax-deductible contributions.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts',
      'packages/engine/src/actions/annualQcdDerivedTaxCharacter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdDerivedTaxCharacter.ts#finalizeAnnualQcdDerivedTaxCharacter',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts#evaluateAnnualQcdExecutionPrerequisites',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    ],
  },

  'irc-408-d-8-B-employer-plan-source-exclusion': {
    title: 'An employer-plan distribution is not a QCD source',
    statement:
      'A QCD is a distribution from an individual retirement plan as defined in section 7701(a)(37) — an individual retirement account described in section 408(a) or an individual retirement annuity described in section 408(b). An employer plan is neither, so a distribution from an employer-plan account is never a QCD. The engine refuses a named QCD whose source is an employer-plan account before any charitable exclusion is calculated.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'For purposes of this paragraph, the term "qualified charitable distribution" means any distribution from an individual retirement plan (other than a plan described in subsection (k) or (p))-',
    }, {
      kind: 'statute',
      citation: 'IRC 7701(a)(37)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section7701&num=0&edition=prelim',
      quotedText:
        'The term "individual retirement plan" means- (A) an individual retirement account described in section 408(a), and (B) an individual retirement annuity described in section 408(b).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts',
      'packages/engine/src/actions/annualQcdDerivedTaxCharacter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdDerivedTaxCharacter.ts#finalizeAnnualQcdDerivedTaxCharacter',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts#evaluateAnnualQcdExecutionPrerequisites',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    ],
  },

  'irc-408-d-8-B-i-qualified-recipient': {
    title: 'A QCD recipient must be a qualified direct charity recipient',
    statement:
      'A direct QCD recipient must be an organization described in section 170(b)(1)(A), not a section 509(a)(3) supporting organization or a section 4966(d)(2) donor-advised fund. Section 170(b)(1)(A)(vii) includes a private foundation described in subparagraph (F). The engine requires direct-custodian, eligible-organization, and no-DAF/supporting-organization attestations and does not make an unconfirmed recipient actionable; the distinct split-interest election is separately out of scope. Not modelled: the engine\'s charity designations have no private-foundation kind and evaluateQcd accepts only an attested \'eligiblePublicCharity\', so an accurately described §170(b)(1)(F) private foundation — legally an eligible recipient — is unsupported and the QCD is refused (fails closed; conservative direction).',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'which is made directly by the trustee to an organization described in section 170(b)(1)(A) (other than any organization described in section 509(a)(3) or any fund or account described in section 4966(d)(2)), and',
    }, {
      kind: 'statute',
      citation: 'IRC 170(b)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'Any charitable contribution to- ... (vii) a private foundation described in subparagraph (F),',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts#evaluateAnnualQcdExecutionPrerequisites',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    ],
  },

  'irc-408-d-8-F-i-split-interest-direct-payment': {
    title: 'A split-interest QCD must be paid directly to the entity and carry a nonassignable income interest',
    statement:
      'The split-interest election under section 408(d)(8)(F) applies only to an IRA distribution made directly by the trustee to the selected charitable remainder annuity trust, charitable remainder unitrust, or charitable gift annuity, and requires the income interest in that entity to be nonassignable; its one-time character is registered on the sibling sublimit record. Not modelled: the engine refuses every known split-interest destination, so it never produces a QCD or a tax result from an indirect or direct split-interest transfer or from an assignable income interest.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(F)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'A taxpayer may for a taxable year elect under this subparagraph to treat as meeting the requirement of subparagraph (B)(i) any distribution from an individual retirement account which is made directly by the trustee to a split-interest entity, but only if-',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(F)(ii)(I)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        '(I) a charitable remainder annuity trust (as defined in section 664(d)(1)), but only if such trust is funded exclusively by qualified charitable distributions,',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(F)(ii)(II)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        '(II) a charitable remainder unitrust (as defined in section 664(d)(2)), but only if such unitrust is funded exclusively by qualified charitable distributions, or',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(F)(ii)(III)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        '(III) a charitable gift annuity (as defined in section 501(m)(5)), but only if such annuity is funded exclusively by qualified charitable distributions and commences fixed payments of 5 percent or greater not later than 1 year from the date of funding.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(F)(iv)(II)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        '(II) the income interest in the split-interest entity is nonassignable.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts',
      'packages/engine/src/actions/annualRetirementActionPublication.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts#evaluateAnnualQcdExecutionPrerequisites',
      'packages/engine/src/actions/annualRetirementActionPublication.ts#publishAnnualRetirementActions',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    ],
  },

  'irc-408-d-8-F-split-interest-sublimit': {
    title: 'One-time split-interest entity QCD sublimit',
    statement:
      'A one-time election permits QCDs to a split-interest entity up to $55,000 for 2026, counted within the $111,000 overall annual limit. Not modelled: the engine requires an affirmative attestation that the destination is not a split-interest entity and treats a known split-interest destination as unsupported.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2025-67',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The amount of qualified charitable distributions made directly to a split-interest entity that are not includible in gross income under section 408(d)(8)(F)(i)(II) pursuant to a one-time election is increased from $54,000 to $55,000.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 1040 (2025), line 4a/4b Exception 3',
      url: 'https://www.irs.gov/pub/irs-pdf/i1040gi.pdf',
      quotedText:
        'Generally, your total QCDs for the year can’t be more than $108,000. This includes any amount (up to $54,000) of a one-time QCD to a split-interest entity (SIE).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts#evaluateAnnualQcdExecutionPrerequisites',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    ],
  },

  'irc-72-t-1-qcd-not-early-distribution-exception': {
    title: 'A QCD does not create an under-59.5 penalty exception',
    statement:
      'Section 72(t)(1) increases tax by 10 percent of the includible portion of an early distribution from a qualified retirement plan, and section 72(t)(2)(A)(i) excepts distributions made on or after the employee attains age 59½. Section 408(d)(8)(B)(ii) requires that a qualified charitable distribution be made on or after the date the individual for whose benefit the plan is maintained has attained age 70½. The engine refuses any QCD before that threshold, so every accepted QCD is past age 59½ and its includible portion falls within the 72(t)(2)(A)(i) exception; the qcdDirectTransfer penalty-coverage marker is emitted only for an already-executed age-eligible QCD.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'If any taxpayer receives any amount from a qualified retirement plan (as defined in section 4974(c)), the taxpayer\'s tax under this chapter for the taxable year in which such amount is received shall be increased by an amount equal to 10 percent of the portion of such amount which is includible in gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Except as provided in paragraphs (3) and (4), paragraph (1) shall not apply to any of the following distributions:',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Distributions which are- (i) made on or after the date on which the employee attains age 59½,',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'which is made on or after the date that the individual for whose benefit the plan is maintained has attained age 70½.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts',
      'packages/engine/src/actions/annualQcdActionExecutionEvidence.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdActionExecutionEvidence.ts#publishAnnualQcdActionExecutionEvidence',
      'packages/engine/src/actions/annualQcdExecutionPrerequisite.ts#evaluateAnnualQcdExecutionPrerequisites',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    ],
  },

  // --- Registered 2026-08-05, with the first committed named QCD ----------

  'irc-408-d-8-A-named-qcd-limit-after-the-pack-year': {
    title: 'Named QCD in a tax year with no sourced exclusion limit',
    statement:
      'The QCD exclusion limit is a per-taxpayer dollar amount indexed annually, and the sourced figure exists only for a year the IRS has published. Not modelled: a named QCD scheduled for a year past the parameter pack is refused qcd-tax-year-limit-unsupported and moves nothing, because the projection has no sourced limit for that year and general plan inflation is not a source. The aggregate qcdAnnual arm does extrapolate its limit by plan inflation; the named arm does not inherit that, because the aggregate arm never claims an action executed and the named arm claims exactly that. A named request also stands the aggregate arm down for its year, so such a year gives nothing at all and the projection warns.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(A)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'So much of the aggregate amount of qualified charitable distributions with respect to a taxpayer made during any taxable year which does not exceed $100,000 shall not be includible in gross income of such taxpayer for such taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(G)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'In the case of any taxable year beginning after 2023, each of the dollar amounts in subparagraphs (A) and (F) shall be increased by an amount equal to—',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2025-67',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The aggregate amount of qualified charitable distributions that are not includible in gross income under section 408(d)(8)(A) is increased from $108,000 to $111,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      // The refusal itself: the post-pass requires an exact sourced limit for
      // the action's own tax year and fails `taxParameterUnavailable` on a
      // stand-in pack, which stops the executor from committing.
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts',
      // The named request's presence stands the recurring scalar planner down
      // before it can debit a second gift in that same unsupported year.
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts',
      // The user-visible consequence, including the warning that says the
      // recurring amount stood down as well.
      'packages/engine/src/projection/internal/annualForcedDistributionQcdAndRetirementActionsPhase.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts#stageAnnualQcdTaxCharacterPostPass',
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts#annualLegacyQcdGiftPlan',
      'packages/engine/src/projection/internal/annualForcedDistributionQcdAndRetirementActionsPhase.ts#annualForcedDistributionQcdAndRetirementActionsPhase',
    ],
  },

  'treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd': {
    title: 'Named QCD modelled as beyond the required distribution',
    statement:
      'A qualified charitable distribution counts toward the year required minimum distribution, so a donor with a required amount can satisfy part of it with a gift and take only the balance as taxable cash. Not modelled in the named QCD arm: the annual pass distributes the whole required amount in cash before any gift is sized, so a named gift only ever meets a requirement the donor own IRAs could not, and every scheduled gift is modelled as an additional distribution beyond the required one. The aggregate qcdAnnual arm does model the coordination, through its nonmoving qcdFromRmd overlay, so the two arms answer the same household differently.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'Direction of error: restrictive, by the amount of the required distribution the gift could have satisfied, and the balance sheet is drawn down by that same amount again. A donor with a $21,097 required distribution who schedules a $20,000 gift intends to give $20,000 out of the requirement and take $1,097 in cash: $1,097 of ordinary income and $21,097 out of the IRA. The projection distributes all $21,097 in cash first and then debits the gift separately: $21,097 of ordinary income and $41,097 out of the IRA. Ordinary income is overstated by the satisfiable amount and the IRA is understated by it, so the error compounds through every figure that reads either. The cause is ordering, not missing facts. The gift settles at phase rank 6 and the forced distributions at rank 3, and the ranks are themselves statutory: Treas. Reg. 1.408A-4 A-6(b) forbids a conversion from absorbing an unsatisfied requirement, which puts the gift ahead of the conversions, and 1.408-8(b)(3) satisfies the requirement in the order distributions actually occur, which is what makes an earlier cash distribution irrevocable. The retirement path is an RMD reserve: hold a scheduled same-year gift amount out of the forced cash distribution before rank 3 runs, which is the shape the plan already contemplates for conversion-linked withdrawals. Until it lands the executed record states the coordination truthfully rather than omitting it - `rmdSatisfiedAmount` is zero and the typed `coordination` field says the requirement had already been distributed before the gift.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(g)(1)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'all amounts distributed from an IRA are taken into account in determining whether section 401(a)(9) is satisfied, regardless of whether the amount is includible in income. Thus, for example, a qualified charitable distribution made pursuant to section 408(d)(8) is taken into account in determining whether section 401(a)(9) is satisfied.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(b)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'any amount distributed during a calendar year from an IRA of that IRA owner is treated as a required minimum distribution under section 401(a)(9) to the extent that the total required minimum distribution for the year under section 401(a)(9) from all of that IRA owner\'s IRAs has not been satisfied (either by a distribution from the IRA or, as permitted under paragraph (e) of this section, from another IRA).',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(A)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'So much of the aggregate amount of qualified charitable distributions with respect to a taxpayer made during any taxable year which does not exceed $100,000 shall not be includible in gross income of such taxpayer for such taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-05',
    implementedBy: [
      // Where the ordering is decided: the forced distributions run well above
      // the gift, and the RMD pool the gift is offered is what is left of the
      // requirement by then.
      'packages/engine/src/projection/simulate.ts',
      // Where the consequence is published: `rmdSatisfiedAmount` with the typed
      // disclosure that says why it is zero.
      'packages/engine/src/actions/annualQcdExecution.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdExecution.ts#executeAnnualQcds',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-408-d-8-A-post-70-half-deduction-offset': {
    title: 'Post-70.5 deductible IRA contributions reduce the excludable QCD',
    statement:
      'The excludable amount is reduced by the excess of the taxpayer aggregate section 219 deductions for all years ending on or after the date they attained age 70.5, over the aggregate reductions already made in earlier years. Netting off the prior reductions is what makes a given deduction dollar offset a QCD exactly once across a lifetime rather than in every subsequent year.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The statute measures the offset against deductions allowed to the taxpayer, so it is an individual-level figure even on a joint return, and the engine tracks it per donor for that reason. The registered annual limit is likewise per taxpayer, which can read as though the two use different bases; they do not.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(A), flush sentence',
      url: 'https://www.law.cornell.edu/uscode/text/26/408',
      quotedText:
        'The amount of distributions not includible in gross income by reason of the preceding sentence for a taxable year (determined without regard to this sentence) shall be reduced (but not below zero) by an amount equal to the excess of - (i) the aggregate amount of deductions allowed to the taxpayer under section 219 for all taxable years ending on or after the date the taxpayer attains age 70 1/2, over (ii) the aggregate amount of reductions under this sentence for all taxable years preceding the current taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/actions/qcdDeductibleContributionOffset.ts',
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts',
      'packages/engine/src/actions/annualQcdActionExecutionEvidence.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdActionExecutionEvidence.ts#publishAnnualQcdActionExecutionEvidence',
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts#stageAnnualQcdTaxCharacterPostPass',
      'packages/engine/src/actions/qcdDeductibleContributionOffset.ts#applyIrc408d8AContributionOffset',
    ],
  },
  'irc-408-d-8-B-ii-projection-annual-age-proxy': {
    title: 'Annual-ledger stand-in for the age 70.5 QCD date',
    statement:
      'QCD eligibility begins on the date the donor attains age 70.5, which the exact-cent path computes as 846 calendar months from birth. Not modelled in the aggregate qcdAnnual arm, which this record is about: eligibility is a property of the whole calendar year, so a donor who crosses 70.5 in July is treated as eligible from 1 January of that year and a gift dated before the half-birthday is excluded. A named QCD request does not inherit the proxy — it is admitted or refused against the exact threshold date, and a gift dated before it is refused qcd-before-age-70-half.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'Direction of error: uniformly permissive, by up to twelve months, and the same sign for every birth month. The ledger reads the birth month rather than rounding to the calendar age — a donor born in months 1 through 6 is admitted in the year the calendar age is 70, and one born in months 7 through 12 in the year it is 71 — so the year the half-birthday falls in is always the year eligibility is granted. What annual granularity cannot express is where in that year it starts: a January-born donor is treated as eligible from 1 January though 70.5 arrives in July, and a December-born donor from the following 1 January though 70.5 arrives that June. There is no offsetting restrictive case, because no birth month puts the half-birthday in a year the ledger refuses. Superseded claim: this record previously said the ledger gates on a calendar age of at least 71 and so denies the whole crossing year, erring restrictively. That gate was replaced when the pre-RMD window was opened, and the argument that the permissive half was harmless — that no QCD could arise before the applicable age anyway, since a positive RMD was required — fell with the condition it rested on. The threshold date itself is the subject of irc-408-d-8-B-ii-age-70-half, whose leap-day and month-end convention is an engineering decision; this record is only about the annual proxy layered on top of it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B)(ii)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'which is made on or after the date that the individual for whose benefit the plan is maintained has attained age 70½.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(g)(1)(iv)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-6',
      quotedText:
        'An employee attains age 70 1/2 as of the date six calendar months after the 70th anniversary of the employee’s birth.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts#annualLegacyQcdGiftPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-408-d-8-A-projection-post-70-half-contribution-offset': {
    title: 'Reduction of the QCD exclusion by post-70.5 deductible IRA contributions',
    statement:
      'The second sentence of 408(d)(8)(A) reduces the exclusion, but not below zero, by the excess of deductible section 219 contributions made for all taxable years ending on or after the donor attains age 70.5 over the reductions already taken in prior years. The aggregate qcdAnnual arm now applies that lifetime running total, the same reading the named arm settles under irc-408-d-8-A-post-70-half-deduction-offset. Projected deductible traditional IRA contributions in the run count only for tax years ending on or after the donor\'s 70½ threshold year (846 calendar months from the birth date), plus Plan-declared deductibleIraContributions for pre-start years that are themselves on or after that threshold; Roth contributions, employer deferrals, and nondeductible basis are not. When a named QCD the Plan declares before the projection starts makes limb (ii) unprovable and section 219 is positive, the aggregate arm does not claim the exclusion — the gift still moves; the qualified amount stays includible — rather than treating already-taken reductions as zero. YearResult.qcd remains the gross distribution; the exclusion is the MAGI / qcdIncomeOffset channel. Leftover after the reduction is ordinary income and does not lower MAGI. HISTORY, APPENDED RATHER THAN DELETED. Until 2026-08-17 this record was classified approximated and said the aggregate arm excluded the full gift no matter how much the donor had deducted since 70.5 and kept no running total. A named QCD request already applied the offset from declared per-donor history and failed closed where that history could not be proved. The first aggregate-arm close counted every in-run traditional IRA contribution regardless of the 70½ threshold year, treated limb (ii) as zero when a pre-start named QCD had made prior reductions unprovable, and published the excludable remainder on YearResult.qcd.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'TWO CONVENTIONS THE STATUTE DOES NOT SUPPLY, because the aggregate arm is a household scalar and section 408(d)(8)(A) speaks only of an individual\'s deductions and gifts. DATA. The projection is the authority for years it simulates, so in-run traditional IRA contributions for years ending on or after the 70½ threshold year are counted and a declared fact for the same year is not added on top of them; years before the projection starts can be seen only through declared deductibleIraContributions, and those facts are themselves refused when they precede the threshold year. Roth, employer, and HSA deposits are omitted because they are not deductions allowed under section 219. LIMB (ii). The Plan records no sourced already-taken reductions. Reconstructing them from a pre-start named request amount would invent execution the run never performed. When that history is unprovable and section 219 is positive, both arms fail closed: the named arm refuses the gift, and the aggregate arm — whose gift has already moved — claims none of the exclusion and writes no guessed leftover into consumed. Zero consumed is used only when there is no section 219 total to have been reduced. LEFTOVER. The leftover after the reduction is ordinary income. A section 170 itemized deduction for those dollars is not booked on this arm — the household may enter itemized charitable separately — and that leftover does not lower MAGI. The named arm still fails closed when a scalar year has made its declared-fact history unprovable, because the two arms do not share one contribution ledger. PUBLICATION. YearResult.qcd is the physical gift so the owned-IRA source series can exact-rejoin overlay plus moving occurrences; shrinking it to the excludable remainder would break that settlement.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(A)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'So much of the aggregate amount of qualified charitable distributions with respect to a taxpayer made during any taxable year which does not exceed $100,000 shall not be includible in gross income of such taxpayer for such taxable year. The amount of distributions not includible in gross income by reason of the preceding sentence for a taxable year (determined without regard to this sentence) shall be reduced (but not below zero) by an amount equal to the excess of— (i) the aggregate amount of deductions allowed to the taxpayer under section 219 for all taxable years ending on or after the date the taxpayer attains age 70½, over (ii) the aggregate amount of reductions under this sentence for all taxable years preceding the current taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-17',
    implementedBy: [
      'packages/engine/src/actions/qcdDeductibleContributionOffset.ts',
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts',
      'packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts#stageAnnualQcdTaxCharacterPostPass',
      'packages/engine/src/actions/qcdDeductibleContributionOffset.ts#applyIrc408d8AContributionOffset',
      'packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts#annualLegacyQcdOwnerCharacterPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-408-d-8-A-projection-household-qcd-aggregation': {
    title: 'Annual-ledger attribution of a household QCD scalar to its donors',
    statement:
      'The 408(d)(8)(A) exclusion limit runs per taxpayer and (G) indexes that per-taxpayer amount, eligibility turns on the age of the individual for whose benefit the plan is maintained, and IRA required distributions are aggregated only within one individual’s own IRAs. The aggregate qcdAnnual arm now takes all three: the household ask is capped at the sum of the LIVING DONORS’ own indexed limits rather than at one of them, the routed half of the gift is charged to owners in proportion to their own owned-IRA required distributions and to no more than each owner’s own requirement, and the beyond-requirement half is drained only from accounts owned by an eligible donor. Each donor is then held to their own limit on both halves. A married couple with two eligible donors may therefore exclude up to twice the indexed figure, and a household with one eligible donor is held to one however large an ineligible spouse’s IRA is. A named QCD request carries its own donor, its own source IRA, its own personal limit and its own contribution offset, so there is no pooled figure for it to be held to: the limit, the offset, the age test and the required-distribution pool are each keyed to the request’s own donorPersonId. CORRECTION, APPENDED 2026-08-07. Until this date this sentence closed by saying that a request that would pool a spouse is refused qcd-spouse-pooling-refused. That reason id is declared in the reason catalogue and is never produced: no code path anywhere in the engine raises it, and the only construction of it is in a publication test. The one form of pooling a named request can even express — donor A naming spouse B’s IRA as the source — is refused in two different places, and which one is operative depends on where the request is. For a SAVED Plan it is plan validation itself: parsePlan rejects any retirement action whose allocation names an account owned by a different person, so a Plan carrying that shape never parses and no projection of it exists to refuse. qcd-source-owner-mismatch is the candidate-evaluation answer, raised before a request is saved — by the eligibility evaluator when the source account’s owner is not the donor, and by the candidate identity allocator, which additionally treats a source with no individual owner at all as ambiguous rather than ineligible. Naming only the second, as this correction first did on 2026-08-07, overstates it: it is what the editor tells you, not what stops a stored Plan. Every other spousal figure is unrepresentable rather than refused in either place, because the request has no field in which to name a second person’s age, limit, offset or requirement. HISTORY, APPENDED RATHER THAN DELETED. Until 2026-08-07 this record was classified approximated and described three departures in this arm, all of them permissive. First, the eligibility gate asked only whether ANY living member of the household was old enough, and the gift was then funded out of a pooled figure that could include a younger spouse’s distributions. Second, one annual dollar limit was applied to the whole household ask, so a couple giving more than a single taxpayer’s limit from genuinely separate IRAs was understated. Third, required distributions were pooled across spouses, which the regulation never aggregates. The first and third closed on 2026-08-07 with the per-owner attribution added for 408(d)(8)(D), and the second closed the same day with the per-donor limit; both changes landed in the same block for the same reason, which is that the limit cannot be applied per donor until the gift has a donor.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'TWO CONVENTIONS THE STATUTE DOES NOT SUPPLY, because the plan input is a household scalar and section 408(d)(8) speaks only of an individual’s gift. Neither affects how much the household may exclude; both decide which donor’s pool pays, and therefore which donor’s Form 8606 fraction moves. ATTRIBUTION. The routed half is charged in proportion to each owner’s share of the owned-IRA required distribution it is capped against, clamped at that owner’s own requirement so no share can reach past what Treas. Reg. 1.408-8(e)(2)(i) aggregates for them, with the last owner in sorted id order taking the rounding residue. The beyond-requirement half is charged exactly, at the account it drains, in the arm’s existing plan-account balance order. REALLOCATION. What one donor’s own limit refuses is offered to the other donors, in sorted owner id order, up to what each may still route — their unrouted requirement and their unspent limit. Sorted order rather than a second proportional pass because the scalar carries no donor intent to honour: nothing in the section says whose gift it is, so the tie is broken by the same stable key the residue rule already uses rather than by plan account ordering, which would make WHICH DONOR GIVES depend on how the accounts happen to be listed. THAT MUCH IS ORDER-FREE AND THE NEXT STEP IS NOT, which an earlier version of this sentence elided by stopping one clause too soon. Once an owner’s share is fixed, it is carved out of that owner’s own required distributions greedily in mutation order — plan account order — and each entry’s Form 8606 line-7 gross is rounded to cents on its own. Every entry the carve consumes whole lands on zero and one entry is left partly consumed, so which entry carries the fractional remainder moves with the account listing, and the SUM of the independently rounded grosses can differ by one cent: a household with three IRAs and a routed gift publishes a line-9 denominator of 62,666,600 or 62,666,601 cents depending on the permutation, and exactly one figure in all six with no gift at all. The bound is one cent on the year’s denominator and it is not removable without cost: the annual ledger carves in plan dollars at the commit site and the settlement matches an assumed character only when its gross agrees to the cent, so rounding the carve earlier would make the two arms disagree and stop the year settling at all. A one-cent denominator spread is smaller than the cent-level tolerance every settled fixture on this engine already asserts at; a year that stopped settling is not. Whatever no donor can route falls through to the beyond-requirement arm, which charges it against the same capacities; whatever that arm cannot place either is not given, because giving it would mean excluding dollars past a taxpayer’s limit. Every eligible donor takes the same indexed figure, because (A) states one amount and (G) indexes that one amount — nothing in the section makes it depend on the donor’s age, filing status, or which IRA gave.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(A)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'So much of the aggregate amount of qualified charitable distributions with respect to a taxpayer made during any taxable year which does not exceed $100,000 shall not be includible in gross income of such taxpayer for such taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B)(ii)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'which is made on or after the date that the individual for whose benefit the plan is maintained has attained age 70½.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(2)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'Generally, only amounts in IRAs that an individual holds as the IRA owner are aggregated for purposes of paragraph (e)(1) of this section.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: [
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts#annualLegacyQcdGiftPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'irc-408-d-8-D-projection-qcd-after-pro-rata': {
    title: 'Annual-ledger ordering of the QCD against pro-rata basis recovery',
    statement:
      'A QCD is deemed to consist of otherwise-includible dollars up to the aggregate amount that would be includible if all of the owner’s individual retirement plans were distributed in the year and treated as one contract, so the gift leaves the section 72 computation entirely: it returns no basis, it is absent from the Form 8606 line-7 numerator and from the annual denominator, and the whole of the year’s basis survives for the other distributions, which pro-rate over the reduced denominator. The aggregate qcdAnnual arm now implements exactly that, the same reading the exact-cent named arm settles under irc-408-d-8-D-qcd-taxable-first. HISTORY, APPENDED RATHER THAN DELETED. Until 2026-08-07 this record was classified approximated and described two halves of one departure in that arm. It applied pro-rata basis recovery to the entire required distribution first, including the part later routed to charity, and then subtracted the gift from ordinary income at a ceiling of its own: qcdIncomeOffset = min(qcdFromRmd, ownedIraRmdTotal − rmdNontaxable), the taxable share of THIS YEAR REQUIRED DISTRIBUTION rather than the statutory aggregate. Because a required distribution is a small fraction of a balance, that ceiling bound whenever the gift exceeded the taxable part of the requirement and silently clamped away exclusion the statute allows. Both halves closed together on that date, as the record predicted they would: deeming the gift pre-tax under (D) replaced the computation outright and the ceiling went with it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Two engineering conventions survive inside the corrected arm, because this arm’s gift is a household scalar the statute has no way to read. FIRST, ATTRIBUTION. Section 408(d)(8)(D) measures against ONE individual’s plans, and every owner has their own Form 8606 denominator, so the scalar has to be charged to owners before it can be measured. The part routed out of the required distribution is charged in proportion to each owner’s share of the owned-IRA required-distribution total the gift is already capped against; the part taken beyond the requirement is charged exactly, at the account it drains. Nothing in the authority selects a proportion, but every owner carrying an owned-IRA required distribution has reached the applicable age, which is above 70 and a half in every year the parameter pack covers, so no share of the gift can land on an IRA that could not lawfully have funded it under 408(d)(8)(B)(ii). SECOND, THE EXCESS. A gift larger than the owner’s whole aggregate includible amount is not a QCD in the excess, and that excess is an ordinary distribution which stays in the denominator, stays on line 7, and recovers basis. Where the year has both a routed and a beyond-requirement gift, the engine charges the excess against the routed half first. No authority orders them; the ordering is chosen because those dollars are already inside the year’s required-distribution gross and its line-7 gross, so the treatment needs no separate income term and the household’s reported income is identical either way. CORRECTION HISTORY. The figures this record carried while it was approximated were: on a $10,000 required distribution from an IRA that is 20 percent basis with a $5,000 gift, $3,000 of income and $2,000 of basis consumed, against a statutory $4,000 and $1,000 stated at the time; and on a $1,000,000 IRA carrying $200,000 of basis, a 76-year-old with a $42,194.09 requirement giving $40,000, $0 of income and $8,438.82 of basis consumed, against a statutory $1,755.27 and $438.82 stated at the time. THE STATUTORY FIGURES THEMSELVES WERE ALSO WRONG, and were corrected on 2026-08-07 when they were re-derived rather than inherited: both applied the UNREDUCED basis fraction to the residual distribution, which keeps the gift in the pro-rata denominator it has just been held to leave. The Form 8606 line-7 instructions exclude a QCD by name and line 6 is already net of it, so the denominator is the pre-distribution pool less the qualified gift. The corrected statutory answers, which the engine now produces and both fixtures pin, are $3,980.77 of income with $1,019.23 of basis on the first shape (53,000 / 260,000) and $1,736.99 of income with $457.10 of basis on the second (200,000 / 960,000).',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(D)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'Notwithstanding section 72, in determining the extent to which a distribution is a qualified charitable distribution, the entire amount of the distribution shall be treated as includible in gross income without regard to subparagraph (A) to the extent that such amount does not exceed the aggregate amount which would have been so includible if all amounts in all individual retirement plans of the individual were distributed during such taxable year and all such plans were treated as 1 contract for purposes of determining under section 72 the aggregate amount which would have been so includible. Proper adjustments shall be made in applying section 72 to other distributions in such taxable year and subsequent taxable years.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B), flush text',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'A distribution shall be treated as a qualified charitable distribution only to the extent that the distribution would be includible in gross income without regard to subparagraph (A).',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'For purposes of applying section 72 to any amount described in paragraph (1)- (A) all individual retirement plans shall be treated as 1 contract, (B) all distributions during any taxable year shall be treated as 1 distribution, and (C) the value of the contract, income on the contract, and investment in the contract shall be computed as of the close of the calendar year in which the taxable year begins. For purposes of subparagraph (C), the value of the contract shall be increased by the amount of any distributions during the calendar year.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), Line 7',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText: 'Don’t include any of the following on line 7 ... Qualified charitable distributions (QCDs).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: [
      'packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts#annualLegacyQcdOwnerCharacterPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-408-d-8-A-qcd-exclusion-composition-order': {
    title: 'Order of the QCD taxable trim, the annual limit, and the deduction offset',
    statement:
      'The three adjustments to a charitable distribution compose in exactly one order, and the text fixes it rather than leaving it to be chosen. The flush sentence of 408(d)(8)(B) runs first, because it is definitional: a distribution is a qualified charitable distribution only to the extent it would be includible without regard to (A), so there is no QCD to limit until the trim has been taken. The first sentence of (A) then excludes so much of that amount as does not exceed the annual dollar limit. The second sentence of (A) runs last, and says so in its own subject: it reduces "the amount of distributions not includible in gross income by reason of the preceding sentence", determined without regard to itself, but not below zero. The excludable amount is therefore max(0, min(min(Q, T), L) - F), the outer floor being the "but not below zero" of that second sentence, which bites whenever the offset exceeds the limited amount. The rejected compositions are min(min(Q, L) - F, T) and min(min(Q, T) - F, L), each floored the same way; the floor is common to all three and so is never what separates them. Because the offset is a subtraction and not a cap, it does not commute with either trim, and the three orderings differ in dollars on ordinary inputs.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(A), both sentences',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'So much of the aggregate amount of qualified charitable distributions with respect to a taxpayer made during any taxable year which does not exceed $100,000 shall not be includible in gross income of such taxpayer for such taxable year. The amount of distributions not includible in gross income by reason of the preceding sentence for a taxable year (determined without regard to this sentence) shall be reduced (but not below zero) by an amount equal to the excess of - (i) the aggregate amount of deductions allowed to the taxpayer under section 219 for all taxable years ending on or after the date the taxpayer attains age 70 1/2, over (ii) the aggregate amount of reductions under this sentence for all taxable years preceding the current taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B), flush sentence',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'A distribution shall be treated as a qualified charitable distribution only to the extent that the distribution would be includible in gross income without regard to subparagraph (A).',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(D)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'Notwithstanding section 72, in determining the extent to which a distribution is a qualified charitable distribution, the entire amount of the distribution shall be treated as includible in gross income without regard to subparagraph (A) to the extent that such amount does not exceed the aggregate amount which would have been so includible if all amounts in all individual retirement plans of the individual were distributed during such taxable year and all such plans were treated as 1 contract for purposes of determining under section 72 the aggregate amount which would have been so includible.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts',
      'packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts#stageAnnualQcdTaxCharacterPostPass',
      'packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts#annualLegacyQcdOwnerCharacterPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

/**
 * Early distribution records: the section 72(t) additional tax and each exception to
 * it, together with the substantially-equal-periodic-payment mechanics Notice 2022-6
 * settles.
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
export const earlyDistributionAndSeppRecords = {
  'irc-72-t-2-A-v-rule-of-55': {
    title: 'Rule of 55 separation test',
    statement:
      'The early-distribution penalty does not apply to an employer-plan distribution after separation from service, where the separation occurs in or after the calendar year the participant attains age 55, from the employer maintaining that plan, and the distribution follows the separation. It never applies to an IRA. The quoted Form 5329 exception also carries the age-50/25-years-of-service variant for qualified public safety employees and private-sector firefighters; that substitution is IRC 72(t)(10) law, registered separately at `irc-72-t-10-public-safety-early-age`, not part of this rule\'s claim.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The calendar-year form of the test is IRS administrative position rather than statutory text: 72(t)(2)(A)(v) says only "after attainment of age 55", which read literally would require the participant to have turned 55 before separating. The calendar-year gloss comes from Notice 87-13 Q&A-20 and is restated in Publication 575, the Form 5329 instructions, and the IRS exceptions chart. The engine follows the IRS position.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(v)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText: 'made to an employee after separation from service after attainment of age 55',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Subparagraphs (A)(v) and (C) of paragraph (2) shall not apply to distributions from an individual retirement plan.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 5329, exception 01',
      url: 'https://www.irs.gov/instructions/i5329',
      quotedText:
        'Qualified retirement plan distributions (doesn’t apply to IRAs) you received after separation from service when the separation from service occurs in or after the year you reach age 55 (age 50 for qualified public safety employees and private sector firefighters) or 25 years of service under the plan, whichever is earlier.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: ['packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts#evaluateTraditionalEmployerPlanPenaltyPrerequisite',
    ],
  },

  'irc-72-t-6-simple-two-year-rate': {
    title: 'SIMPLE IRA 25 percent rate during the initial two-year period',
    statement:
      'A distribution from a SIMPLE IRA during the two-year period beginning when the individual first participated substitutes a 25 percent rate for the 10 percent rate in IRC 72(t)(1). It is a rate substitution and not an independent penalty gate, so every 72(t)(2) exception still applies first and zeroes the tax entirely.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(6)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'In the case of any amount received from a simple retirement account (within the meaning of section 408(p)) during the 2-year period beginning on the date such individual first participated in any qualified salary reduction arrangement maintained by the individual\'s employer under section 408(p)(2), paragraph (1) shall be applied by substituting "25 percent" for "10 percent".',
    }, {
      kind: 'irsPublication',
      citation: 'IRS SIMPLE IRA plan FAQs',
      url: 'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-simple-ira-plans',
      quotedText:
        'The 2-year period begins on the first day on which your employer deposits contributions in your SIMPLE IRA.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts#evaluateOwnedNonRothIraPenaltyPrerequisites',
    ],
  },

  'irc-72-t-3-B-sepp-separation': {
    title: 'Employer-plan SEPP must begin after separation from service',
    statement:
      'A substantially equal periodic payment series from a 401(a) trust, 403(a) annuity plan, or 403(b) contract qualifies for the 72(t)(2)(A)(iv) exception only if it begins after the employee separates from service. The requirement does not reach IRAs, so an IRA SEPP may begin while the owner is still employed.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(3)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Paragraph (2)(A)(iv) shall not apply to any amount paid from a trust described in section 401(a) which is exempt from tax under section 501(a) or from a contract described in section 72(e)(5)(D)(ii) unless the series of payments begins after the employee separates from service.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts#evaluateTraditionalEmployerPlanPenaltyPrerequisite',
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts#seppSeriesBeginsAfterSeparation',
    ],
  },

  'irc-72-t-2-A-i-age-59-half': {
    title: 'Age 59.5 exception to the early-distribution tax',
    statement:
      'The 10 percent additional tax does not apply to a distribution made on or after the date the individual attains age 59.5. The test is inclusive of that date and reaches both IRAs and employer plans, unlike the Rule of 55.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'No authority at any level defines when age 59.5 is attained: there is no section 1.72(t) regulation series, and the threshold appears throughout the regulations without ever being defined. The engine applies the six-calendar-months convention by analogy to Treas. Reg. 1.401(a)(9)-6(g)(1)(iv), which defines it for age 70.5 inside a defined-benefit provision addressed to something else. That analogy is universal industry practice but the IRS has never stated it for 59.5, and it carries the same unresolved month-end and leap-day edge as the age-70.5 rule - here against a 10 percent penalty rather than QCD eligibility.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText: 'Distributions which are- (i) made on or after the date on which the employee attains age 59 1/2,',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(5)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "employee" includes any participant, and in the case of an individual retirement plan, the individual for whose benefit such plan was established.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts',
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts#evaluateOwnedNonRothIraPenaltyPrerequisites',
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts#evaluateTraditionalEmployerPlanPenaltyPrerequisite',
    ],
  },

  'irc-72-t-10-public-safety-early-age': {
    title: 'Age 50 or 25 years of service for qualified public safety employees',
    statement:
      'For a qualified public safety employee taking a governmental-plan distribution, and for an employee providing firefighting services from a 401(a) trust, 403(a) annuity plan, or 403(b) contract, the Rule of 55 substitutes age 50 or 25 years of service under the plan, whichever is earlier. Not modelled: the engine holds no public-safety or years-of-service fact, so such a distribution must fail closed through the other-exception attestation rather than be assessed against the age-55 threshold.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(10)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'In the case of a distribution to a qualified public safety employee from a governmental plan (within the meaning of section 414(d)) or a distribution from a plan described in clause (iii), (iv), or (vi) of section 402(c)(8)(B) to an employee who provides firefighting services, paragraph (2)(A)(v) shall be applied by substituting "age 50 or 25 years of service under the plan, whichever is earlier" for "age 55".',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-28',
    implementedBy: ['packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts#evaluateTraditionalEmployerPlanPenaltyPrerequisite',
    ],
  },

  'irc-72-t-4-sepp-modification-recapture': {
    title: 'Retroactive recapture when a SEPP series is modified',
    statement:
      'Modifying a SEPP series before the later of five years from the first payment or age 59.5 increases tax in the modification year by the tax that would have applied to every prior payment, plus interest for the deferral period. Not modelled: the engine reports a final penalty of zero for qualified SEPP payments and has no path to revise them, so a modification is outside the supported model rather than costless.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(4)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'the taxpayer\'s tax for the 1st taxable year in which such modification occurs shall be increased by an amount, determined under regulations, equal to the tax which (but for paragraph (2)(A)(iv)) would have been imposed, plus interest for the deferral period.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts#evaluateTraditionalEmployerPlanPenaltyPrerequisite',
    ],
  },

  'irc-72-t-2-A-iii-disability-exception': {
    title: 'Disability waives the 10 percent additional tax, not the income',
    statement:
      'A distribution attributable to the individual being disabled is not subject to the 10 percent additional tax. Disabled means unable to engage in any substantial gainful activity by reason of a medically determinable impairment expected to result in death or to be of long-continued and indefinite duration. The distribution remains ordinary income; only the additional tax is waived.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The statutory test is any substantial gainful activity, which is materially stricter than an occupation-specific disability determination of the kind a private policy uses. Section 72(m)(7) also requires the individual to furnish proof in such form and manner as the Secretary may require, which is why the engine takes a dated attestation with an evidence id rather than inferring disability from plan data.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(iii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'Except as provided in paragraphs (3) and (4), paragraph (1) shall not apply to any of the following distributions: ... (iii) attributable to the employee\u2019s being disabled within the meaning of subsection (m)(7)',
    }, {
      kind: 'statute',
      citation: 'IRC 72(m)(7)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'an individual shall be considered to be disabled if he is unable to engage in any substantial gainful activity by reason of any medically determinable physical or mental impairment which can be expected to result in death or to be of long-continued and indefinite duration. An individual shall not be considered to be disabled unless he furnishes proof of the existence thereof in such form and manner as the Secretary may require.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts',
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts#evaluateOwnedNonRothIraPenaltyPrerequisites',
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts#evaluateTraditionalEmployerPlanPenaltyPrerequisite',
    ],
  },

  'irc-72-t-1-additional-tax-on-includible-portion': {
    title: 'The 10 percent additional tax falls on the includible portion',
    statement:
      'The tax is increased by 10 percent of the portion of the distribution which is includible in gross income, not 10 percent of the amount distributed. Where nondeductible basis comes back with the distribution, the returned basis carries no additional tax because it is not includible.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The includible portion is whatever the annual section 408(d)(2) pro-rata calculation produces, so this rule sits downstream of the basis-recovery rule rather than restating it. That is also why the additional tax cannot be computed from the distribution alone.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'If any taxpayer receives any amount from a qualified retirement plan (as defined in section 4974(c)), the taxpayer\u2019s tax under this chapter for the taxable year in which such amount is received shall be increased by an amount equal to 10 percent of the portion of such amount which is includible in gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts#evaluateOwnedNonRothIraPenaltyPrerequisites',
    ],
  },

  'irc-72-t-1-qualified-retirement-plan-scope': {
    title: 'Section 72(t) does not reach non-retirement withdrawal sources',
    statement:
      'Section 72(t)(1) applies only when a taxpayer receives an amount from a qualified retirement plan, so cash, taxable-account, and equity-compensation ordinary withdrawals do not enter its additional-tax calculation. The executor instead emits typed notApplicable nonRetirementSource coverage with zero penalty exposure for those sources.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The executor represents the absence of the statutory predicate rather than computing a zero section 72(t) tax. Its one-cent cash fixture in actions/execution.test.ts makes both the notApplicable status and nonRetirementSource reason observable, while also proving that no penalty exposure enters the result.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'If any taxpayer receives any amount from a qualified retirement plan (as defined in section 4974(c)), the taxpayer\'s tax under this chapter for the taxable year in which such amount is received shall be increased by an amount equal to 10 percent of the portion of such amount which is includible in gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 4974(c)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4974&num=0&edition=prelim',
      quotedText:
        'For purposes of this section, the term "qualified retirement plan" means- (1) a plan described in section 401(a) which includes a trust exempt from tax under section 501(a), (2) an annuity plan described in section 403(a), (3) an annuity contract described in section 403(b), (4) an individual retirement account described in section 408(a), or (5) an individual retirement annuity described in section 408(b). Such term includes any plan, contract, account, or annuity which, at any time, has been determined by the Secretary to be such a plan, contract, account, or annuity.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: ['packages/engine/src/actions/execution.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/execution.ts#evaluateRetirementActionSchedule',
    ],
  },

  'irc-72-t-2-A-ii-death-beneficiary-exception': {
    title: 'Death exception to the early-distribution tax',
    statement:
      'The 10 percent additional tax does not apply to a distribution made to a beneficiary, or to the estate of the employee, on or after the death of the employee. The exception turns on the death and on nothing else, so neither the age of the decedent nor the age of the beneficiary enters it, and a distribution from an inherited account is penalty-free at any age.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The engine reads this exception off the inherited marker on the account rather than off the identity of the person receiving the distribution. Those are the same test only for so long as an account a surviving spouse has elected to treat as their own stops being marked inherited. That election is registered separately as irc-408-d-3-C-ii-surviving-spouse-not-inherited and treas-reg-1-408-8-c-3-spouse-treated-as-owner; once it is made the spouse takes distributions in their own right and 72(t) applies to them normally, so a plan that left the marker in place would waive a tax that is actually due. The exact-cent beneficiary path is stricter than the marker proxy: beneficiaryTraditionalIraDeathPenalty.ts requires recipient death-beneficiary evidence with a death date on or before evaluation and refuses once spousal owner treatment has begun, and beneficiaryTraditionalIraAnnualSimulatorDelta.ts propagates that zero only when the upstream module produced it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Except as provided in paragraphs (3) and (4), paragraph (1) shall not apply to any of the following distributions: (A) In general Distributions which are- ... (ii) made to a beneficiary (or to the estate of the employee) on or after the death of the employee,',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(5)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "employee" includes any participant, and in the case of an individual retirement plan, the individual for whose benefit such plan was established.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/beneficiaryTraditionalIraDeathPenalty.ts',
      'packages/engine/src/actions/beneficiaryTraditionalIraAnnualSimulatorDelta.ts',
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/beneficiaryTraditionalIraAnnualSimulatorDelta.ts#prepareBeneficiaryTraditionalIraAnnualSimulatorDelta',
      'packages/engine/src/actions/beneficiaryTraditionalIraDeathPenalty.ts#evaluateBeneficiaryTraditionalIraDeathPenalty',
      'packages/engine/src/strategies/accountEligibility.ts#traditionalWithdrawalPenaltyRate',
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts#evaluateOwnedNonRothIraPenaltyPrerequisites',
    ],
  },

  'irc-72-t-2-A-i-age-59-half-annual-proxy': {
    title: 'Age 59.5 modelled as an annual attained-age-60 threshold',
    statement:
      'Section 72(t)(2)(A)(i) waives the 10 percent additional tax for a distribution made on or after the date the individual attains age 59.5, which is a date inside a calendar year. The need-based withdrawal path in strategies/accountEligibility.ts waives it instead from the first calendar year in which the owner attains age 60, so it is not modelling the statutory boundary and must not be presented as doing so.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The direction of the error is knowable but it is not one-sided, and a reader who assumes it is will mis-state the exposure. Attained age here is the calendar-year age, the projection year minus the birth year, so the proxy waives from January 1 of the year the owner turns 60 while the statute waives from the date six calendar months after the 59th birthday. For a birthday in the first half of the year that statutory date falls in the preceding calendar year, so the proxy waives late and over-penalizes, by up to about six months at a January 1 birth. For a birthday in the second half it falls inside the same calendar year the proxy is already waiving, so the proxy waives early and under-penalizes, again by up to about six months at a December 31 birth. Only a July 1 birthday makes the two agree exactly. It is out of scope rather than settled because the annual projection carries an attained age and no distribution date, so there is no boundary to compare anything against. Two reachable paths therefore disagree about the same taxpayer: the exact-cent path in actions/ownedNonRothIraPenaltyPrerequisite.ts and actions/traditionalEmployerPlanPenaltyPrerequisite.ts computes the boundary as addCalendarMonths(dob, 714) with the month-end clamp and accepts equality, which is the reading registered as irc-72-t-2-A-i-age-59-half. Only that path is filing-relevant; a penalty figure produced from the annual proxy must not be reported as one.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Except as provided in paragraphs (3) and (4), paragraph (1) shall not apply to any of the following distributions: (A) In general Distributions which are- (i) made on or after the date on which the employee attains age 59½,',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'If any taxpayer receives any amount from a qualified retirement plan (as defined in section 4974(c)), the taxpayer’s tax under this chapter for the taxable year in which such amount is received shall be increased by an amount equal to 10 percent of the portion of such amount which is includible in gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/strategies/accountEligibility.ts'],
    implementedByFunctions: [
      'packages/engine/src/strategies/accountEligibility.ts#traditionalWithdrawalPenaltyRate',
    ],
  },

  'irc-72-t-2-A-v-rule-of-55-separation-proxy': {
    title: 'Rule of 55 modelled from the plan retirement age',
    statement:
      'Section 72(t)(2)(A)(v) waives the 10 percent tax on an employer-plan distribution made to an employee after separation from service after attainment of age 55, and reaches only the plan of the employer separated from. The annual path in strategies/accountEligibility.ts has no separation event and no employer identity: it waives the tax whenever the account is an employer plan, the plan retirement age is at least 55, and the owner attained age has reached that retirement age.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'Unlike the two age proxies, this one errs in both directions and neither direction is bounded by a fixed number of months. It under-penalizes where the employer plan is one the owner left well before age 55, because the statute reaches only the plan maintained by the employer separated from and the code tests no employer identity at all: a 401(k) left behind at 40 is waived at the modelled retirement age like any other. It over-penalizes where the owner separates from an employer at or after 55 but keeps working elsewhere, because the waiver is withheld until the attained age reaches the modelled retirement age: an owner who left an employer at 56 and plans to retire at 62 is charged the tax on that abandoned plan for six years. It is approximated rather than settled because the plan model carries a single household retirement age and no employment history, so no separation date and no employer for the plan exist to test. Note that the crossing case the IRS calendar-year gloss addresses cannot arise here at all: retirementAge in this model is a calendar-year age, resolved as dobYear + retirementAge, so a separation during the year of attaining 55 is recorded as a retirement age of 55 and is waived — agreeing with the gloss, and erring permissively rather than restrictively against the strict statutory date. The engine does get the one structural limit right: 72(t)(3)(A) denies the exception to individual retirement plans, and the code waives only for an account of employer kind. The exact-date reading lives in actions/traditionalEmployerPlanPenaltyPrerequisite.ts.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(v)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText: 'made to an employee after separation from service after attainment of age 55,',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Subparagraphs (A)(v) and (C) of paragraph (2) shall not apply to distributions from an individual retirement plan.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/strategies/accountEligibility.ts'],
    implementedByFunctions: [
      'packages/engine/src/strategies/accountEligibility.ts#traditionalWithdrawalPenaltyRate',
    ],
  },
  'irc-72-t-2-A-iv-sepp-exception': {
    title: 'The substantially equal periodic payment exception itself',
    statement:
      'The 10 percent additional tax does not reach a distribution that is part of a series of substantially equal periodic payments, made not less frequently than annually, over the life or life expectancy of the participant or the joint lives or joint life expectancies of the participant and a designated beneficiary. Membership in the series is the operative fact, so a tax year whose distributions do not add up to the annual payment the chosen method determined excepts nothing: the annual reconciliation reports the year incomplete, and no payment in it reaches a zero penalty.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(iv)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'part of a series of substantially equal periodic payments (not less frequently than annually) made for the life (or life expectancy) of the employee or the joint lives (or joint life expectancies) of such employee and his designated beneficiary,',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 2.02',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'Under section 72(t)(2)(A)(iv), one of the exceptions to the 10% additional tax is for distributions that are part of a series of substantially equal periodic payments (not less frequently than annually) made for the life (or life expectancy) of the employee or the joint lives (or joint life expectancies) of the employee and designated beneficiary.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts',
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts#evaluateOwnedNonRothIraPenaltyPrerequisites',
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts#reconcileOwnedNonRothIraSeppAnnualSchedule',
    ],
  },
  'irc-72-t-5-sepp-participant-scope': {
    title: 'A SEPP series belongs to one participant and one source account',
    statement:
      'For section 72(t) the term employee includes any participant, and for an individual retirement plan it means the individual for whose benefit the plan was established, so SEPP qualification is settled per participant and per source account and never on a household total. Amounts another household member took, or amounts taken from another account, are outside the series and can neither complete it nor enlarge it: the annual reconciliation binds the participant, the election, and the source account, and treats an inventory member belonging to a different person or account as foreign.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(5)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "employee" includes any participant, and in the case of an individual retirement plan, the individual for whose benefit such plan was established.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.02(f)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'In the case of distributions from an IRA, the IRA owner is treated as an employee for purposes of applying this notice.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts',
      'packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts#reconcileOwnedNonRothIraSeppAnnualSchedule',
      'packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts#validateOwnedNonRothIraSeppCurrentPaymentCandidate',
    ],
  },
  'notice-2022-6-3-01-three-permitted-methods': {
    title: 'The three methods that produce a qualifying series',
    statement:
      'Exactly three methods determine substantially equal periodic payments: the required minimum distribution method, the fixed amortization method, and the fixed annuitization method. The fixed annuitization method stands on the same footing as the other two, and an election naming anything else is refused with a typed unsupportedMethod nonconformance rather than reconciled.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The notice names the methods in prose, so the token spelling is an engineering choice, and the engine made it twice. The owned-IRA path spells them requiredMinimumDistribution, fixedAmortization, and fixedAnnuitization; the employer-plan path spells the first two rmd and amortization. Both admit exactly the three the notice names and reject everything else, so the vocabularies differ without the rule differing. A reader comparing the two evidence shapes should not read the shorter spellings as a narrower method set.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.01',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'Payments in a series are considered substantially equal periodic payments within the meaning of section 72(t)(2)(A)(iv) if they are determined in accordance with one of the three methods described in section 3.01(a) through (c) of this notice (which are based on the three methods described in Rev. Rul. 2002-62).',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 2.05',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'Q&A-12 of Notice 89-25, 1989-1 CB 662, provides that payments are considered to be substantially equal periodic payments under section 72(t)(2)(A)(iv) if they are made in accordance with one of the following three methods: (1) the required minimum distribution method; (2) the fixed amortization method; or (3) the fixed annuitization method.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts',
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts#validateOwnedNonRothIraSeppCurrentPaymentCandidate',
      'packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts#evaluateTraditionalEmployerPlanPenaltyPrerequisite',
    ],
  },
  'notice-2022-6-3-01-annual-payment-completeness': {
    title: 'The annual payment is a yearly total, and annually is a floor on frequency',
    statement:
      'Each of the three methods determines an annual payment for a distribution year, and the statute requires payments not less frequently than annually. Several distributions inside one year are therefore one annual payment measured by their total rather than several competing series, and the year qualifies only when that total equals the annual scheduled amount exactly. The annual reconciliation sums every scheduled payment in the year and reports the year incomplete when the total falls short, exceeded when it runs over.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.01(a)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'The annual payment for each distribution year is determined by dividing the account balance for that distribution year by the number of years from the chosen life expectancy table in section 3.02(a) of this notice for that distribution year.',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(iv)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'part of a series of substantially equal periodic payments (not less frequently than annually) made for the life (or life expectancy) of the employee or the joint lives (or joint life expectancies) of such employee and his designated beneficiary,',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts#reconcileOwnedNonRothIraSeppAnnualSchedule',
    ],
  },
  'notice-2022-6-3-02-c-interest-rate-ceiling': {
    title: 'Interest rate ceiling for the fixed amortization and fixed annuitization methods',
    statement:
      'Any interest rate at or below the greater of 5 percent or 120 percent of the federal mid-term rate may be used to apply the fixed amortization or the fixed annuitization method. Because 5 percent is the floor of that ceiling, a flat 5 percent is permitted in every rate environment, and the projection uses it. The 5 percent leg exists only under Notice 2022-6: the superseded Rev. Rul. 2002-62 capped the rate at 120 percent of the federal mid-term rate alone, under which a flat 5 percent would have been impermissible in a low-rate year.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The authority fixes a ceiling, not a rate, so the engine had to pick one. It carries no section 1274(d) federal mid-term rate series, and 5 percent is the highest rate permitted without knowing that rate, so a flat 5 percent needs no feed and can never exceed the ceiling. A projection wanting a larger payment would have to source the mid-term rate for one of the two months immediately preceding the month the series begins. The engine source comment used to describe the ceiling as 120 percent of the mid-term rate, which is the superseded Rev. Rul. 2002-62 rule rather than the Notice 2022-6 rule; it was corrected to state both legs when this record was verified.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.02(c)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'The interest rate that may be used to apply the fixed amortization method or the fixed annuitization method is any interest rate that is not more than the greater of (i) 5% or (ii) 120% of the federal mid-term rate (determined in accordance with section 1274(d) for either of the two months immediately preceding the month in which the distribution begins).',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 2.06',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'Section 2.02(c) of Rev. Rul. 2002-62 modifies the application of the fixed amortization method and the fixed annuitization method by providing that the interest rate that may be used to apply the fixed amortization method or the fixed annuitization method is any interest rate that is not greater than 120% of the federal mid-term rate (determined in accordance with section 1274(d) for either of the two months immediately preceding the month in which the distribution begins).',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, sections 4 and 5',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'The guidance in this notice replaces the guidance in Rev. Rul. 2002-62 and Notice 2004-15 for any series of payments commencing on or after January 1, 2023, and it may be used for a series of payments commencing in 2022. ... Rev. Rul. 2002-62 and Notice 2004-15 are modified and superseded.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/strategies/sepp.ts'],
    implementedByFunctions: [
      'packages/engine/src/strategies/sepp.ts#SEPP_AMORTIZATION_RATE_PCT',
    ],
  },
  'notice-2022-6-3-02-e-single-account-balance-scope': {
    title: 'The series runs against one account balance and is proven against every distribution from it',
    statement:
      'Payments are first calculated with respect to one account balance as of the first valuation date, and only amounts that are part of the resulting series are excepted. A distribution from that account which is not a scheduled payment is therefore not merely a separately penalized withdrawal; it leaves the year unproven. The reconciliation is closed over the complete inventory of distributions from the source account for the year and reports the year incomplete when an inventory member has no matching scheduled payment, so no payment in that year reaches a zero penalty.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.02(e)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'Under all three methods, substantially equal periodic payments are first calculated with respect to an account balance as of the first valuation date selected as described in section 3.02(d) of this notice. A modification to the series of payments will occur if, after such date, there is (1) any addition to the account balance other than by reason of investment experience, (2) any transfer of a portion of the account balance to another retirement plan, or (3) a rollover of the amount received by the employee.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.02(d)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'For the fixed amortization and fixed annuitization methods, the account balance must be determined in a reasonable manner based on the facts and circumstances. The account balance will be treated as determined in a reasonable manner if it is the account balance on any date within the period that begins on December 31 of the year prior to the date of the first distribution and ends on the date of the first distribution.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts',
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts#evaluateOwnedNonRothIraPenaltyPrerequisites',
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts#reconcileOwnedNonRothIraSeppAnnualSchedule',
    ],
  },
  'irc-72-t-4-sepp-modification-proof-window': {
    title: 'Absence of a disqualifying modification must be proven through the payment date',
    statement:
      'Section 72(t)(4) withdraws the exception retroactively from every prior payment once the series is modified inside the window, so the exception cannot be established for a payment on facts that stop short of that payment date. The reconciliation requires an explicit no-modification proof whose through date reaches the distribution date and refuses the payment when the proof ends earlier.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Section 72(t)(4) sets the consequence of a modification but no evidentiary standard for proving one did not happen, so the engine had to choose what suffices. It takes a dated attestation covering the payment and refuses anything earlier, because a proof running only to the start of the year cannot speak to a modification made in March. That is an engineering decision rather than a legal conclusion, and the attestation is not a test of the three events section 3.02(e) of Notice 2022-6 enumerates.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(4)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'If- (i) paragraph (1) does not apply to a distribution by reason of paragraph (2)(A)(iv), and (ii) the series of payments under such paragraph are subsequently modified (other than by reason of death or disability or a distribution to which paragraph (10) applies)- (I) before the close of the 5-year period beginning with the date of the first payment and after the employee attains age 59 1/2, or (II) before the employee attains age 59 1/2, the taxpayer’s tax for the 1st taxable year in which such modification occurs shall be increased by an amount, determined under regulations, equal to the tax which (but for paragraph (2)(A)(iv)) would have been imposed, plus interest for the deferral period.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts',
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts#reconcileOwnedNonRothIraSeppAnnualSchedule',
      'packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts#validateOwnedNonRothIraSeppCurrentPaymentCandidate',
    ],
  },
  'notice-2022-6-3-02-e-modification-trigger-detection': {
    title: 'Events that modify a series are not detected by the engine',
    statement:
      'After the first valuation date a modification occurs on any addition to the account balance other than by reason of investment experience, any transfer of part of the balance to another retirement plan, or a rollover of the amount received. Not modelled: the engine tests none of the three. The annual reconciliation consumes a caller-supplied attestation that no disqualifying modification occurred and derives nothing from the account history, so an attestation supplied for a series that in fact took a contribution, a partial transfer out, or a rollover produces a zero penalty the statute would not allow. The error runs toward understating tax, and it omits the section 72(t)(4) recapture as well.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.02(e)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'A modification to the series of payments will occur if, after such date, there is (1) any addition to the account balance other than by reason of investment experience, (2) any transfer of a portion of the account balance to another retirement plan, or (3) a rollover of the amount received by the employee.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts',
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts#reconcileOwnedNonRothIraSeppAnnualSchedule',
      'packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts#validateOwnedNonRothIraSeppCurrentPaymentCandidate',
    ],
  },
  'notice-2022-6-3-03-b-one-time-method-change': {
    title: 'One-time switch to the required minimum distribution method',
    statement:
      'A participant who began with the fixed amortization or the fixed annuitization method may switch once, in any later distribution year, to the required minimum distribution method without that switch being a modification; any later change away from the required minimum distribution method is a modification. Not modelled: an election carries one method for the life of the series, the plan model offers no way to record the year of a switch, and the annual reconciliation binds one method to every payment in the year. The error runs toward larger later payments and faster depletion, because the engine keeps paying the level fixed amount in years when a real participant could have dropped to the smaller redetermined required minimum distribution payment.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.03(b)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'An individual who begins distributions using either the fixed amortization method or the fixed annuitization method is permitted in any subsequent distribution year to switch to the required minimum distribution method to determine the payment for the distribution year of the switch and all subsequent distribution years, and this change in method will not be treated as a modification within the meaning of section 72(t)(4). Once a change is made under this paragraph, any subsequent change from the required minimum distribution method will be a modification for purposes of section 72(t)(4).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/strategies/sepp.ts',
      'packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraSeppCurrentPaymentCandidate.ts#validateOwnedNonRothIraSeppCurrentPaymentCandidate',
      'packages/engine/src/model/plan.ts#seppElectionSchema',
      'packages/engine/src/strategies/sepp.ts#seppAnnualAmount',
    ],
  },
  'notice-2022-6-3-03-a-complete-depletion': {
    title: 'Exhausting the account is not a modification',
    statement:
      'When following a qualifying method exhausts the assets in the account, the resulting reduction in the final payment and the cessation of payments that follows are not a modification, and the section 72(t)(4)(A) recapture tax does not apply. Not modelled: the annual reconciliation qualifies a year only when the distributions total the annual scheduled amount exactly, and it receives no fact distinguishing a shortfall caused by an exhausted account from a shortfall caused by underpayment, so it refuses both. The error runs toward refusing a series the notice would preserve, overstating penalty rather than understating it, and a caller can avoid it only by restating the annual scheduled amount as the reduced final payment.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.03(a)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'If, as a result of following a method of determining substantially equal periodic payments that qualifies for the exception of section 72(t)(2)(A)(iv), an individual’s assets in an individual account plan or an IRA are exhausted, any resulting reduction in the amount of the final payment (and the subsequent cessation of payments) is not a modification within the meaning of section 72(t)(4). Accordingly, the recapture tax described in section 72(t)(4)(A) will not apply in this case.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraSeppAnnualReconciliation.ts#reconcileOwnedNonRothIraSeppAnnualSchedule',
    ],
  },

  // --- Registered 2026-08-04 with the SEPP projection corrections ----------
  // These three could not be registered with the batch above. Each of them
  // turns on the size of a payment, and every payment the projection produced
  // came out of a life expectancy table Notice 2022-6 does not permit, so a
  // fixture asserting one would have pinned the defect instead of the rule.

  'notice-2022-6-3-02-a-permitted-life-expectancy-tables': {
    title: 'The three life expectancy tables a SEPP may be sized from',
    statement:
      'Exactly three tables may determine the distribution period under the required minimum distribution and fixed amortization methods: the Uniform Lifetime Table in Appendix A of Notice 2022-6, the Single Life Table in Treas. Reg. 1.401(a)(9)-9(b), and the Joint and Last Survivor Table in 1.401(a)(9)-9(d). All three are unisex, and the number used is the entry for the participant age reached on that birthday, taken whole. The projection uses the Single Life Table, which is the table section 3.02(b) leaves in place for a distribution year with no designated beneficiary. It is the shortest of the three, and the payment is the balance over the divisor, so that choice sizes the largest payment any permitted table would allow rather than the smallest.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The notice permits three tables and never says which to use, so the engine had to pick one. Single Life is chosen because the election carries no designated beneficiary: section 3.02(b) lets the Joint and Last Survivor Table be used only against an actual designated beneficiary of the account, and says that where there is none in a distribution year the Single Life Table is the table for that year. The Uniform Lifetime Table in Appendix A stays permitted and would shrink every payment on the same facts, because it is longer at every age (43.6 years at 55 against Single Life 31.6). That is the direction of this convention and it is worth stating plainly: Single Life is the shortest of the three, and the payment is the balance over the divisor, so the engine sizes the largest payment any permitted table would allow. What is not a convention is the exclusion of everything else: this engine previously divided by its SSA 2022 period table (longevity/ssaPeriod2022.ts), averaging the male and female columns, which produced 26.64 years at age 55 against the Single Life entry of 31.6 and so oversized every payment by about 19 percent beyond even the largest figure the notice allows.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.02(a)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'The life expectancy tables that can be used to determine distribution periods under the required minimum distribution and fixed amortization methods are: (1) the Uniform Lifetime Table in Appendix A of this notice; (2) the Single Life Table in § 1.401(a)(9)-9(b); or (3) the Joint and Last Survivor Table in § 1.401(a)(9)-9(d) (which can be used even if the designated beneficiary is not the spouse). The number of years that is used for the required minimum distribution method for a distribution year is the entry from the table for the employee’s age on the employee’s birthday in that distribution year.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-9(b)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-9',
      quotedText:
        'Single Life Table. The following table, referred to as the Single Life Table, sets forth the life expectancy of an individual at each age.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/strategies/sepp.ts',
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/params/index.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/params/index.ts#singleLifeExpectancyYears',
      'packages/engine/src/strategies/sepp.ts#seppAnnualAmount',
    ],
  },

  'notice-2022-6-3-01-b-level-amortization': {
    title: 'The fixed amortization method is a level payment, fixed for the series',
    statement:
      'The fixed amortization payment is the amount that level-amortizes the account balance over the number of years the chosen permitted table gives for the participant age in the FIRST distribution year, at an interest rate section 3.02(c) permits. Once those three inputs are set, the annual payment is the same amount in every succeeding distribution year. It is not the balance divided by the years, which would drop the interest rate and collapse the method onto the required minimum distribution method, and it is not redetermined annually, which is what distinguishes it from that method.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.01(b)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'The annual payment for each distribution year is determined as the amount that will result in the level amortization of the account balance over a specified number of years determined using the chosen life expectancy table under section 3.02(a) of this notice and an interest rate that is permitted pursuant to section 3.02(c) of this notice. Under this method, once the account balance, the number of years from the chosen life expectancy table, and the resulting annual payment are determined for the first distribution year, the annual payment is the same amount in each succeeding distribution year.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.02(a)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'The number of years that is used to apply the fixed amortization method is the entry from the table for the employee’s age on the employee’s birthday in the first distribution year (and, if applicable, the designated beneficiary’s age on the designated beneficiary’s birthday in that year).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/strategies/sepp.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualSeppDistributions.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSeppDistributions.ts#annualSeppDistributions',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/sepp.ts#seppAnnualAmount',
    ],
  },

  'notice-2022-6-3-02-d-account-balance-valuation-window': {
    title: 'Which account balance the first payment is calculated from',
    statement:
      'For the fixed amortization and fixed annuitization methods the account balance must be determined in a reasonable manner on the facts, and it is treated as reasonable if it is the balance on any date in the window that opens on December 31 of the year before the first distribution and closes on the date of that distribution. The projection amortizes the account balance it captures before any of the first distribution year flows, which is the prior December 31 balance and therefore the opening of that window.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The authority states a safe-harbour window, not a date, so the engine had to choose a point inside it. It takes the earliest, the prior December 31, because that is the only date in the window the annual projection actually holds a balance for: it resolves a year at a time and has no notion of the day the first distribution is paid. Choosing the earliest point also makes the choice the least favourable one available in a growing account, since a later date in the window carries more growth and would size a larger payment.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.02(d)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'For purposes of applying the required minimum distribution method, the account balance for a distribution year is determined under § 1.401(a)(9)-5. For the fixed amortization and fixed annuitization methods, the account balance must be determined in a reasonable manner based on the facts and circumstances. The account balance will be treated as determined in a reasonable manner if it is the account balance on any date within the period that begins on December 31 of the year prior to the date of the first distribution and ends on the date of the first distribution.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualSeppDistributions.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/internal/annualSeppDistributions.ts#annualSeppDistributions',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'notice-2022-6-3-02-e-1-projection-contribution-during-series': {
    title: 'The projection contributes to an account with a running SEPP series',
    statement:
      'After the first valuation date, any addition to the account balance other than by reason of investment experience modifies the series. The projection applies no such test: its contribution pass admits any account that is not inherited, so a plan that states both an annual contribution and a SEPP election on the same traditional account deposits into it every year the series runs and still reports every SEPP distribution as penalty-free. Not modelled, and the error runs toward understating tax in two ways at once: the current year distribution is shown penalty-free when the statute has ended the exception, and the section 72(t)(4) recapture of every earlier payment in the series, plus interest, is not charged at all.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'Left as it stands because the two available repairs are product decisions rather than engineering ones, and each is wrong in a way the engine cannot adjudicate. Refusing the contribution keeps the series intact but silently overrides a stated plan input, and would change every projection that carries both facts without telling the user which of their two instructions was dropped. Treating the series as modified is the statutory consequence, but it needs the 72(t)(4) recapture and the interest for the deferral period, which is machinery this engine does not have and which the modification-trigger record already reports as absent. A third option, computing as now and warning, still publishes a penalty-free series the statute has already busted. The decision belongs with the product: which of two contradictory instructions wins, and what the planner tells the user when it drops one. Note that the actions layer does not share this defect for its own reason rather than a better one, recorded under notice-2022-6-3-02-e-modification-trigger-detection: it consumes a caller attestation instead of deriving anything from account history.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2022-6, section 3.02(e)(1)',
      url: 'https://www.irs.gov/irb/2022-05_IRB',
      quotedText:
        'Under all three methods, substantially equal periodic payments are first calculated with respect to an account balance as of the first valuation date selected as described in section 3.02(d) of this notice. A modification to the series of payments will occur if, after such date, there is (1) any addition to the account balance other than by reason of investment experience,',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(4)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'the taxpayer’s tax for the 1st taxable year in which such modification occurs shall be increased by an amount, determined under regulations, equal to the tax which (but for paragraph (2)(A)(iv)) would have been imposed, plus interest for the deferral period.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/accountEligibility.ts#acceptsContributions',
    ],
  },

  'irc-72-t-3-B-sepp-separation-annual-proxy': {
    title: 'Employer-plan SEPP separation modelled from the plan retirement age',
    statement:
      'Section 72(t)(3)(B) withholds the substantially equal periodic payment exception from a 401(a) trust or a 72(e)(5)(D)(ii) contract unless the series begins after the employee separates from service, and does not reach IRAs. The annual projection has no separation event and no employer identity, so it orders calendar years instead of days: an employer-plan series is recognised only where the plan states a retirement age and the year the series begins is at or after the first year the wage model stops paying the participant, and an IRA series is recognised whatever the retirement age. That first unpaid year is the attained age the retirement age rounds UP to, because wages are paid while attained age is below the retirement age, so a retirement age of 65.5 is paid for the year the participant attains 65 and separated from the year they attain 66. A plan stating no retirement age states no separation, and no employer-plan series is recognised on it.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'Registered as out of scope rather than settled for the same reason as the Rule of 55 proxy alongside it: the plan model carries one retirement age per person and no employment history, so there is no separation date and no employer for the plan to test. It errs in both directions. It under-refuses where the employer plan is one the participant left long ago, because the statute reaches only the plan of the employer separated from and no employer identity is tested. It under-refuses again inside the year of separation, because the projection resolves years rather than days and cannot see a series that began in March from a job left in September; the first year the wage model stops paying the participant is treated as a separated year throughout, which is the same convention that lets the Rule of 55 waive the penalty in that year. Both layers name that year by rounding the retirement age UP to an attained age, which is not a rounding preference but the only reading that agrees with the other two: wages are paid while attained age is below the retirement age and the Rule of 55 waives from the first attained age that is not, so a retirement age of 65.5 is paid for the year the participant attains 65 and separated from the year they attain 66. Rounding down would separate them in a year the plan still pays them wages. It over-refuses where a participant has genuinely separated but the plan states no retirement age, which is how the plan model spells someone with no wages to stop. The exact-date reading lives in actions/traditionalEmployerPlanPenaltyPrerequisite.ts, and both layers order the two events through the same seppSeriesBeginsAfterSeparation predicate. What is not a proxy is the structural limit: 72(t)(3)(B) does not reach individual retirement accounts, and the projection tests separation only for an account of employer kind.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(3)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Paragraph (2)(A)(iv) shall not apply to any amount paid from a trust described in section 401(a) which is exempt from tax under section 501(a) or from a contract described in section 72(e)(5)(D)(ii) unless the series of payments begins after the employee separates from service.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualSeppDistributions.ts',
      'packages/engine/src/actions/annualRetirementPhysicalEventInventory.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualRetirementPhysicalEventInventory.ts#buildAnnualRetirementPhysicalEventInventory',
      'packages/engine/src/projection/internal/annualSeppDistributions.ts#annualSeppDistributions',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-72-t-2-J-plesa-withdrawal-early-distribution-exception': {
    title: 'A PLESA withdrawal is excepted from the section 72(t) additional tax',
    statement:
      'Section 72(t)(2)(J) excepts a distribution from a PLESA made under section 402A(e) from the early-distribution additional tax, subject to section 72(t)(3) and (4). RetireGolden has neither a PLESA account nor a PLESA withdrawal action, so it cannot determine or price that exception.',
    classification: 'outOfScope',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The necessary distribution source and its section 402A(e) status cannot be represented. The absent PLESA account surface is tested in model/plan.test.ts; the absent withdrawal-action surface is tested in actions/contract.test.ts. This avoids treating an ordinary employer-plan withdrawal as proof of the PLESA exception.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(J)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Distributions from a pension-linked emergency savings account pursuant to section 402A(e).',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2024-22, section II.C',
      url: 'https://www.irs.gov/pub/irs-drop/n-24-22.pdf',
      quotedText:
        'Section 72(t)(2)(J) provides that, except as provided in … section 72(t)(3) and (4), the ten-percent additional tax on early distributions from qualified retirement plans under section 72(t)(1) does not apply to distributions from a PLESA pursuant to section 402A(e).',
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

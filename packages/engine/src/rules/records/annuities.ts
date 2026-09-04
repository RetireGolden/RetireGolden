/**
 * Annuity records: the section 72 exclusion ratio, the expected-return and
 * refund-feature adjustments, the employer-plan basis recovery rules, and
 * pension direct-rollover eligibility.
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
export const annuityRecords = {
  'irc-72-b-annuity-exclusion-ratio': {
    title: 'Exclusion ratio for a non-qualified annuity, and the cap at unrecovered investment',
    statement:
      'The part of each annuity payment excluded from gross income is the payment multiplied by the ratio of investment in the contract to expected return, both measured once at the annuity starting date and never revised. For a single life the expected return is the total annual payment multiplied by the Table V expectancy multiple for the age at that date. The cumulative exclusion may never exceed the unrecovered investment, so once the whole investment has been returned every later payment is fully taxable, and the same fixed share carries to a survivor or beneficiary until that point is reached.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Table V rather than Table I is the correct table because Tables V through VIII govern any contract whose investment includes post-June-1986 money, which is every contract a plan under this engine could be buying. The distinction is load-bearing and not cosmetic: at age 66 the Table I male multiple is 14.4 and the Table V multiple is 19.2, a difference of about a third in the expected return and therefore in the ratio.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(b)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'Gross income does not include that part of any amount received as an annuity under an annuity, endowment, or life insurance contract which bears the same ratio to such amount as the investment in the contract (as of the annuity starting date) bears to the expected return under the contract (as of such date).',
    }, {
      kind: 'statute',
      citation: 'IRC 72(b)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'The portion of any amount received as an annuity which is excluded from gross income under paragraph (1) shall not exceed the unrecovered investment in the contract immediately before the receipt of such amount.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.72-5(a)(1)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.72-5',
      quotedText:
        'If a contract to which section 72 applies provides that one annuitant is to receive a fixed monthly income for life, the expected return is determined by multiplying the total of the annuity payments to be received annually by the multiple shown in Table I or V (whichever is applicable) of § 1.72-9 under the age (as of the annuity starting date) and, if applicable, sex of the measuring life ... If, however, the taxpayer had purchased the contract after June 30, 1986, the expected return would be $23,040, determined by multiplying 19.2 (multiple shown in Table V, age 66) by $1,200.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.72-9',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.72-9',
      quotedText:
        'Tables I, II, IIA, III, and IV are to be used if the investment in the contract does not include a post-June 1986 investment in the contract (as defined in § 1.72-6(d)(3)). Tables V, VI, VIA, VII, and VIII are to be used if the investment in the contract includes a post-June 1986 investment in the contract (as defined in § 1.72-6(d)(3)).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts',
      'packages/engine/src/projection/annuityForms.ts',
      'packages/engine/src/params/index.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/params/index.ts#annuityExpectedReturnMultiple',
      'packages/engine/src/projection/annuityForms.ts#annuityExclusionMultiple',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts#annualAnnuityPurchaseFunding',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'treas-reg-1-72-7-refund-feature-investment-adjustment': {
    title: 'Adjustment for a period-certain guarantee on a life annuity',
    statement:
      'A life annuity with a minimum period of payments certain is a refund feature. The prescribed treatment reduces the numerator: take the Table VII percentage for the annuitant age and the whole number of guaranteed years, multiply it by the smaller of the investment or the total guaranteed, subtract that from the investment, and compute an ordinary single-life exclusion ratio on the reduced investment. Not modelled as prescribed: the engine leaves the investment untouched and instead raises the denominator, using the greater of the single-life multiple and the certain period. Where the guarantee is shorter than the life multiple — the ordinary case for a ten- or twenty-year certain bought at 65 — the engine makes no adjustment at all while the regulation prescribes a positive one, so the exclusion ratio is too high and taxable income too low in the early payment years. Where the guarantee is longer the engine at least moves the ratio downward, but by a quantity no authority prescribes. The cap at unrecovered investment bounds the total excluded, so the error is a timing shift unless the annuitant dies before recovery, where it becomes permanent.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(c)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'then the value (computed without discount for interest) of such payments on the annuity starting date shall be subtracted from the amount determined under paragraph (1). Such value shall be computed in accordance with actuarial tables prescribed by the Secretary. For purposes of this paragraph and of subsection (e)(2)(A), the term “refund of the consideration paid” includes amounts payable after the death of an annuitant by reason of a provision in the contract for a life annuity with minimum period of payments certain, ...',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.72-7(b)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.72-7',
      quotedText:
        '(1) Determine the number of years necessary for the guaranteed amount to be fully paid by dividing the maximum amount guaranteed as of the annuity starting date by the amount to be received annually under the contract ... (2) Consult Table III or VII (whichever is applicable) of § 1.72-9 for the appropriate percentage under the whole number of years found in subparagraph (1) of this paragraph and the age (as of the annuity starting date) ... (3) Multiply the percentage found in subparagraph (2) of this paragraph by whichever of the following is the smaller: (i) The investment in the contract found in accordance with § 1.72-6 or (ii) the total amount guaranteed as of the annuity starting date. (4) Subtract the amount found in subparagraph (3) of this paragraph from the investment in the contract found in accordance with § 1.72-6.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/annuityForms.ts',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/annuityForms.ts#annuityExclusionMultiple',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
  'treas-reg-1-72-5-b-2-joint-and-survivor-expected-return': {
    title: 'Expected return for a joint and survivor annuity paying a reduced survivor amount',
    statement:
      'Where the survivor receives a different amount from the first annuitant, the expected return is the first annuitant annual payment times the Table V single-life multiple, plus the survivor annual payment times the excess of the Table VI joint and last survivor multiple over that single-life multiple. The engine reproduces that decomposition exactly, which is worth recording because it is easy to mistake for an ad hoc blend. What it does not do is take the joint multiple from Table VI: it derives a joint last-survivor expectancy from the SSA-based mortality model instead, and does so per sex where Table VI is unisex. Not modelled as prescribed for that reason. SSA population mortality is heavier than the annuitant mortality standing behind Table VI, so the survivor tail comes out shorter than prescribed, expected return is understated, the exclusion ratio overstated, and taxable income understated in the early payment years. The cap at unrecovered investment turns most of that into a timing shift; it is permanent only where the annuitant dies before the investment is recovered.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.72-5(b)(2)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.72-5',
      quotedText:
        'The applicable multiple in Table II or VI (whichever is applicable) is first found ... The multiple applicable to the first annuitant is then found in Table I or V (whichever is applicable) as though the contract were for a single life annuity. The multiple from Table I or V is then subtracted from the multiple obtained from Table II or VI and the resulting multiple is applied to the total payments to be received annually under the contract by the second annuitant. ... The expected returns with respect to each of the annuitants separately are then aggregated to obtain the expected return under the entire contract.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.72-5(b)(2), Example 2',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.72-5',
      quotedText:
        'Multiple from Table VI (ages 70, 67) 22.0 Multiple from Table V (age 70) 16.0 Difference (multiple applicable to second annuitant) 6.0 Portion of expected return, second annuitant ($600 × 6.0) $3,600 Plus: Portion of expected return, first annuitant ($1,200 × 16.0) $19,200 Expected return under the contract $22,800',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/annuityForms.ts',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts',
      'packages/engine/src/montecarlo/mortality.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/montecarlo/mortality.ts#jointLastSurvivorExpectancy',
      'packages/engine/src/projection/annuityForms.ts#annuityExclusionMultiple',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome',
    ],
  },

  'irc-72-e-8-B-employer-plan-pro-rata-basis': {
    title: 'Employer-plan after-tax basis comes out pro rata, not first',
    statement:
      'For an amount received from a qualified plan before the annuity starting date, the portion allocated to the investment in the contract bears the same ratio to the amount received as the investment in the contract bears to the account balance. After-tax employee basis is therefore recovered proportionally across the whole distribution and the remainder is ordinary income; basis is not recovered first, and a distribution smaller than the basis does not come out tax free.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(e)(8)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'For purposes of paragraph (2)(B), the amount allocated to the investment in the contract shall be the portion of the amount described in subparagraph (A) which bears the same ratio to such amount as the investment in the contract bears to the account balance. The determination under the preceding sentence shall be made as of the time of the distribution or at such other time as the Secretary may prescribe.',
    }, {
      kind: 'statute',
      citation: 'IRC 72(e)(8)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Notwithstanding any other provision of this subsection, in the case of any amount received before the annuity starting date from a trust or contract described in paragraph (5)(D), paragraph (2)(B) shall apply to such amounts.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/traditionalEmployerPlanWithdrawalCharacter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/traditionalEmployerPlanWithdrawalCharacter.ts#classifyTraditionalEmployerPlanWithdrawal',
    ],
  },

  'irc-72-e-8-D-pre-1987-employee-contributions': {
    title: 'Pre-1987 employee contributions are recovered before the pro-rata rule bites',
    statement:
      'Where a plan on May 5, 1986 permitted withdrawal of employee contributions before separation from service, the pro-rata allocation applies only to amounts received in excess of the investment in the contract as of December 31, 1986. Such a participant recovers the grandfathered basis first and reaches pro-rata treatment only once it is exhausted. Not modelled: the basis snapshot carries a single after-tax figure with no pre-1987 component and no plan-terms flag, so the engine applies the pro-rata rule to the first dollar. The error runs toward overstating tax in the early years, because basis the statute would return in full is instead spread across the whole account and only a fraction of it is recovered. It reverses in later years as the remaining basis comes out, so it is a timing error rather than a permanent one, but the deferral is exactly the years a retiree is drawing on the account.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'Approximated rather than out of scope because the engine applies the ordinary pro-rata rule and returns a number; it never refuses for want of the grandfathered layer. The direction is recorded as both because this is a timing error: tax is overstated in the early withdrawal years while basis the statute would return in full is instead spread across the account, and understated later as that basis comes out. It nets to zero over a full drawdown, but an annual projection is exactly where the year matters, and the overstated years are the ones a retiree is drawing on the account. Worth recording rather than dismissing as historical, because this engine audience is the cohort it reaches: a participant who made after-tax contributions to a plan that allowed in-service withdrawals in 1986 is in their late sixties or older today, and the balance has had forty years to grow, so the grandfathered layer can be large in dollars even where it is small as a fraction of the account. It is not modelled because the two facts it needs, the December 31, 1986 investment in the contract and whether the plan permitted pre-separation withdrawal on May 5, 1986, appear on no statement a household can produce and would have to come from the plan administrator.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(e)(8)(D)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'In the case of a plan which on May 5, 1986, permitted withdrawal of any employee contributions before separation from service, subparagraph (A) shall apply only to the extent that amounts received before the annuity starting date (when increased by amounts previously received under the contract after December 31, 1986) exceed the investment in the contract as of December 31, 1986.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/traditionalEmployerPlanWithdrawalCharacter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/traditionalEmployerPlanWithdrawalCharacter.ts#classifyTraditionalEmployerPlanWithdrawal',
    ],
  },
  'irc-402-c-1-pension-lump-sum-direct-rollover-eligibility': {
    title: 'Pension lump-sum direct-rollover eligibility is assumed',
    statement:
      'A distribution from a qualified trust is excluded from gross income only to the extent an eligible rollover distribution is transferred to an eligible retirement plan; a qualified trust and an individual retirement account described in §408(a) are within those definitions, and a specified direct rollover is not includible in gross income. The engine treats every modeled pension lump-sum offer elected into a traditional account as satisfying those conditions: it credits the whole offer to the destination and reports no current-year pension income or MAGI from it. The Plan carries only the offer amount, election year, and destination account id; it carries no qualified-plan, exemption, distributability, or eligible-rollover-distribution facts. A nonqualifying or ineligible offer can instead be currently taxable, so the reported zero understates tax. The separate §402(c)(4)(B) required-minimum-distribution portion is governed by irc-402-c-4-B-rmd-not-eligible-rollover-distribution and is not duplicated here.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DEFECT — no behavior change in this registry slice. checkAccountCrossFieldRules requires an election to have an offer and an existing non-inherited traditional destination, and pensionTakeLumpSumPatch selects or creates an owned traditional IRA destination, but neither can establish that the source is a qualified trust, that the offer is an eligible rollover distribution, or that a plan may distribute it. pensionLumpSumRollovers then selects every elected offer in its election year at its full amount; simulatePlan credits that amount; and annualPensionAndAnnuityIncome suppresses the pension stream from that year forward. The approximation fixture uses a 300,000 offer for a 60-year-old, deliberately outside the RMD regime: facts the Plan cannot encode hide a genuinely nonqualifying or ineligible offer, for which the statutory reading is a 300,000 currently taxable pension distribution with no rollover credit, while the engine instead credits 300,000 to the traditional destination with zero pension income and MAGI. The RMD-specific sibling remains the only record for a qualifying offer whose required-distribution portion must be carved out.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402(c)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'If— (A) any portion of the balance to the credit of an employee in a qualified trust is paid to the employee in an eligible rollover distribution, (B) the distributee transfers any portion of the property received in such distribution to an eligible retirement plan, … then such distribution (to the extent so transferred) shall not be includible in gross income for the taxable year in which paid.',
    }, {
      kind: 'statute',
      citation: 'IRC 402(c)(4)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "eligible rollover distribution" means any distribution to an employee of all or any portion of the balance to the credit of the employee in a qualified trust; except that such term shall not include-',
    }, {
      kind: 'statute',
      citation: 'IRC 402(c)(8)(A)-(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'The term "qualified trust" means an employees\' trust described in section 401(a) which is exempt from tax under section 501(a). … The term "eligible retirement plan" means— (i) an individual retirement account described in section 408(a),',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(31)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'A trust shall not constitute a qualified trust under this section unless the plan of which such trust is a part provides that if the distributee of any eligible rollover distribution— (i) elects to have such distribution paid directly to an eligible retirement plan, and (ii) specifies the eligible retirement plan to which such distribution is to be paid (in such form and at such time as the plan administrator may prescribe), such distribution shall be made in the form of a direct trustee-to-trustee transfer to the eligible retirement plan so specified.',
    }, {
      kind: 'statute',
      citation: 'IRC 402(e)(6)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section402&num=0&edition=prelim',
      quotedText:
        'Any amount transferred in a direct trustee-to-trustee transfer in accordance with section 401(a)(31) shall not be includible in gross income for the taxable year of such transfer.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: [
      'packages/engine/src/decisions/pensionElection.ts',
      'packages/engine/src/model/planCrossFieldChecks.ts',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts',
      'packages/engine/src/projection/internal/pensionLumpSumRollovers.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/decisions/pensionElection.ts#pensionTakeLumpSumPatch',
      'packages/engine/src/model/planCrossFieldChecks.ts#checkAccountCrossFieldRules',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome',
      'packages/engine/src/projection/internal/pensionLumpSumRollovers.ts#pensionLumpSumRollovers',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

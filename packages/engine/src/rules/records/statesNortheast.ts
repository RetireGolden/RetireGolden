/**
 * State records for the Northeast: CT, ME, MA, NH, NJ, NY, PA, RI, VT.
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
export const northeastStateRecords = {
  'pa-pit-retirement-benefits-not-compensation': {
    title: 'Pennsylvania does not tax a retired employee’s plan distributions',
    statement:
      'A distribution from an old age or retirement benefit plan — the regulation names IRAs, SEPs, Keoghs and federally qualified employer plans — is outside Pennsylvania compensation when it is made upon or after the recipient\'s retirement from service after reaching a specific age or after a stated period of employment. The test is the PLAN\'s age or service condition, not any single age fixed by Pennsylvania law. Approximated: the pack encodes it as `{ kind: \'full\', minAge: 60 }`, a flat age test, which is why a Pennsylvania retiree pays no state tax on retirement income here at all.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'state:PA',
    authority: [{
      kind: 'regulation',
      citation: '61 Pa. Code 101.6(c)(8)(iii)(A)',
      url: 'https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/061/chapter101/s101.6.html',
      quotedText:
        'Amounts distributed to an individual from a plan shall be included in income to the extent that contributions were not previously included in this income except for either of the following: (I) Distributions made upon or after his retirement from service after reaching a specific age or after a stated period of employment. (II) Distributions transferred into another plan, where the transferred amounts are not included in income for Federal income tax purposes.',
    }, {
      kind: 'regulation',
      citation: '61 Pa. Code 101.6(c)(8)(i)',
      url: 'https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/061/chapter101/s101.6.html',
      quotedText:
        'Scope. For the purpose of this section, the term plan includes Individual Retirement plans (IRA), Simplified Employee Pension Plans (SEP), Keogh plans, Federally qualified employe pension plans and similar old age or retirement benefit plans.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'pa-pit-no-capital-loss-carryforward': {
    title: 'A Pennsylvania capital loss is recognized only in its own year',
    statement:
      'Pennsylvania taxes the net of a year\'s own gains and losses on the disposition of property, and a loss is recognized only in the taxable year in which the transaction giving rise to it is closed and completed. A loss therefore has nowhere to go once its year ends: it neither carries back nor carries forward, and a prior-year federal carryforward cannot reduce a Pennsylvania gain. This is the sole consumer of `capitalLossCarryforwardConformity: \'currentYearOnly\'`, which makes the state base read `realizedCapitalGainsBeforeCarryforward` instead of the carryforward-netted `capitalGains` the federal ledger produces.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:PA',
    authority: [{
      kind: 'regulation',
      citation: '61 Pa. Code 103.13(a)',
      url: 'https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/061/chapter103/s103.13.html',
      quotedText:
        'Gain or loss. A gain on the disposition of property is recognized in the taxable year in which the amount realized from the conversion of the property into cash or other property exceeds the adjusted basis of the property. A loss is recognized only with respect to transactions entered into for gain, profit or income and only in the taxable year in which the transaction, in respect to which loss is claimed, is closed and completed by an identifiable event which fixes the amount of the loss so there is no possibility of eventual recoupment.',
    }, {
      kind: 'regulation',
      citation: '61 Pa. Code 103.13(e)',
      url: 'https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/061/chapter103/s103.13.html',
      quotedText:
        'Gain or loss on property acquired on or after June 1, 1971. The amount subject to tax shall be the net gains or net income less net losses derived from the sale, exchange or other disposition of property … real or personal, tangible or intangible … to the extent that the value of that which is received or receivable is greater than or, in the case of a loss, less than the basis of the taxpayer.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'pa-pit-social-security-not-compensation': {
    title: 'Pennsylvania never taxes Social Security as compensation',
    statement:
      'Pennsylvania\'s Personal Income Tax Guide lists Social Security payments among income items never taxable as Pennsylvania compensation. That is what `taxesSocialSecurity: false` encodes: the benefit never reaches the compensation base the flat rate applies to. This record settles only that treatment; it does not certify Pennsylvania\'s complete income taxonomy, retirement-plan eligibility, or Railroad Retirement routing from the shared `ssBenefits` input.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:PA',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Pennsylvania Department of Revenue, Personal Income Tax Guide — Gross Compensation, Income Items Never Taxable as PA Compensation',
      url: 'https://www.pa.gov/agencies/revenue/forms-and-publications/pa-personal-income-tax-guide/gross-compensation',
      quotedText:
        'Income Items Never Taxable as PA Compensation \u2026 Retirement income, such as: distributions from eligible Pennsylvania retirement plans* after retirement age; Social Security payments; railroad retirement benefits',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.PA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ny-tax-612-c-3-a-pension-annuity-exclusion': {
    title: 'New York’s $20,000 pension exclusion requires attaining 59½',
    statement:
      'New York subtracts up to $20,000 of pension and annuity income, including IRA and self-employed plan distributions, received by an individual who has ATTAINED THE AGE OF FIFTY-NINE AND ONE-HALF. Half a year is the whole of the condition, and the pack cannot express it: `StateRetirementExclusion.minAge` is compared against an integer age, so `{ capPerPerson: 20000, minAge: 59 }` grants the full exclusion from the birthday rather than six months later. A New Yorker who is 59 but not yet 59½ is given a $20,000 subtraction the statute does not allow them, and the engine reports less New York tax than they owe.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:NY',
    authority: [{
      kind: 'statute',
      citation: 'N.Y. Tax Law 612(c)(3-a)',
      url: 'https://www.nysenate.gov/legislation/laws/TAX/612',
      quotedText:
        'Pensions and annuities received by an individual who has attained the age of fifty-nine and one-half, not otherwise excluded pursuant to paragraph three of this subsection, to the extent includible in gross income for federal income tax purposes, but not in excess of twenty thousand dollars, which are periodic payments attributable to personal services performed by such individual prior to his retirement from employment, which arise (i) from an employer-employee relationship or (ii) from contributions to a retirement plan which are deductible for federal income tax purposes.',
    }, {
      kind: 'statute',
      citation: 'N.Y. Tax Law 612(c)(3-a), second sentence',
      url: 'https://www.nysenate.gov/legislation/laws/TAX/612',
      quotedText:
        'However, the term "pensions and annuities" shall also include distributions received by an individual who has attained the age of fifty-nine and one-half from an individual retirement account or an individual retirement annuity, as defined in section four hundred eight of the internal revenue code, and distributions received by an individual who has attained the age of fifty-nine and one-half from self-employed individual and owner-employee retirement plans which qualify under section four hundred one of the internal revenue code, whether or not the payments are periodic in nature.',
    }, {
      kind: 'statute',
      citation: 'N.Y. Tax Law 612(c)',
      url: 'https://www.nysenate.gov/legislation/laws/TAX/612',
      quotedText:
        'Modifications reducing federal adjusted gross income. There shall be subtracted from federal adjusted gross income:',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.NY',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ny-dtf-qualified-government-pension-full-subtraction': {
    title: 'DTF allows a full subtraction for qualifying New York State, local, or federal-government pension when correctly routed',
    statement:
      'Given an independently established qualifying New York State or local government pension or federal-government pension, including a qualifying military pension, and only its federally included qualifying amount correctly routed to `publicPensionIncome`, the supported calculation subtracts that amount in full through `retirementPublic: { kind: \'full\' }` without the private $20,000 cap or private age gate registered at `ny-tax-612-c-3-a-pension-annuity-exclusion`. The `public` enum is a caller routing category, not evidence of a qualifying governmental issuer or eligible portion; when those facts are absent the coarse public bucket instead subtracts every routed dollar and is registered as approximated at `ny-government-pension-issuer-qualification-not-modeled`. This record certifies only that conditional subtraction calculation, not issuer eligibility, automatic routing, every public pension, a military input feature, Optional Retirement Program employment-attributable limits beyond what the source states, or whole-return correctness. Social Security is registered at `ny-dtf-social-security-subtraction`; non-Tier-1 railroad benefits are registered at `ny-it225-s122-non-ss-railroad-benefits-not-modeled`. The annual pension producer routes explicit `source: \'public\'` to `publicPensionIncome` and is a read-only routing dependency, not a statutory issuer enforcer.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NY',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'New York State Department of Taxation and Finance, Information for retired persons — Pensions of New York State, local governments, and the federal government',
      url: 'https://www.tax.ny.gov/pit/file/information_for_seniors.htm',
      quotedText:
        'If you received a pension or other distribution from a New York State or local government pension plan or federal government pension plan, you may subtract the amount of distribution that was included in your federal adjusted gross income, regardless of your age or of the form the payment(s) take.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'New York State Department of Taxation and Finance, Information for retired persons — federal government pensions including military',
      url: 'https://www.tax.ny.gov/pit/file/information_for_seniors.htm',
      quotedText:
        'The United States, its territories, possessions (or political subdivisions thereof), or any agency, instrumentality of the United States (including the military), or the District of Columbia.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'New York State Department of Taxation and Finance, Information for retired persons — Optional Retirement Program limitation',
      url: 'https://www.tax.ny.gov/pit/file/information_for_seniors.htm',
      quotedText:
        'New York State, including the State and City Universities of New York and the New York State Education Department, who belongs to the Optional Retirement Program. Optional Retirement Program members may only subtract that portion attributable to employment with the State or City University of New York or the New York State Education Department.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/params/state/data/year2026.ts#states.NY',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ny-government-pension-issuer-qualification-not-modeled': {
    title: 'New York subtracts qualifying governmental pensions only, but the coarse public bucket removes every `publicPensionIncome` dollar',
    statement:
      'New York Department of Taxation and Finance guidance allows a full subtraction only for distributions from a New York State or local government pension plan or a federal government pension plan, including military pensions under the United States or its agencies, to the extent included in federal adjusted gross income — and, for Optional Retirement Program members, only the portion attributable to employment with the State, City University of New York, or the New York State Education Department. Approximated: the 2026 pack sets `retirementPublic: { kind: \'full\' }` through `PUBLIC_PENSION_OVERRIDES`, so `retirementExclusion` subtracts every `publicPensionIncome` dollar without an issuer check or an ORP employment-attributable portion check. `pensionSchema.source` is only `private` or `public`, `incomeStreamSchema` has no governmental issuer, plan, military-service, or eligible-portion fields, and `StateTaxParams` / `StateRetirementExclusion` carry no New York issuer or portion facts — missing eligibility is a caller assumption, not a typed field. That coarse bucket understates tax when a routed `public` amount is not a qualifying governmental pension or includes a non-qualifying ORP excess; it does not claim every out-of-state public pension is taxable. The conditional full subtraction once eligibility is established is registered at `ny-dtf-qualified-government-pension-full-subtraction`.',
    classification: 'approximated',
    contraryReading:
      'Department guidance ties the full subtraction to qualifying New York State, local, or federal-government issuers and, for Optional Retirement Program members, to the employment-attributable portion only. A $60,000 ORP distribution fully included in federal adjusted gross income but entirely outside SUNY, CUNY, or New York State Education Department employment adds $60,000 to New York adjusted gross income relative to the same household without that distribution; age 40 keeps the private $20,000 exclusion from applying.',
    errorDirection: 'understatesTax',
    conventionRationale:
      'The public bucket is one `{ kind: \'full\' }` flag because `pensionSchema.source` carries no issuer, plan, or ORP portion facts and `annualPensionAndAnnuityIncome` routes explicit `source: \'public\'` to `publicPensionIncome` without validating them. The pin uses the 2026 observed model window — baseline ordinary income $90,000 at age 40, scenario ordinary income $150,000 with $60,000 routed `publicPensionIncome` — not a new enactment. Absolute totals of $82,000 in both limbs on main are a routing observation, not the legal oracle.',
    jurisdiction: 'state:NY',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'New York State Department of Taxation and Finance, Information for retired persons — Pensions of New York State, local governments, and the federal government',
      url: 'https://www.tax.ny.gov/pit/file/information_for_seniors.htm',
      quotedText:
        'If you received a pension or other distribution from a New York State or local government pension plan or federal government pension plan, you may subtract the amount of distribution that was included in your federal adjusted gross income, regardless of your age or of the form the payment(s) take.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'New York State Department of Taxation and Finance, Information for retired persons — federal government pensions including military',
      url: 'https://www.tax.ny.gov/pit/file/information_for_seniors.htm',
      quotedText:
        'The United States, its territories, possessions (or political subdivisions thereof), or any agency, instrumentality of the United States (including the military), or the District of Columbia.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'New York State Department of Taxation and Finance, Information for retired persons — Optional Retirement Program limitation',
      url: 'https://www.tax.ny.gov/pit/file/information_for_seniors.htm',
      quotedText:
        'New York State, including the State and City Universities of New York and the New York State Education Department, who belongs to the Optional Retirement Program. Optional Retirement Program members may only subtract that portion attributable to employment with the State or City University of New York or the New York State Education Department.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
      'packages/engine/src/model/plan.ts#pensionSchema',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome',
    ],
  },

  'ny-dtf-social-security-subtraction': {
    title: 'DTF allows federally included Social Security to be subtracted in New York adjusted gross income',
    statement:
      'New York Department of Taxation and Finance guidance allows Social Security benefits included in federal adjusted gross income to be subtracted when computing New York adjusted gross income. That is what `taxesSocialSecurity: false` encodes: the pack takes the allowed full subtraction and the federally taxable share never reaches the New York base. Tier I Railroad Retirement provenance, part-year allocation, and unsupported filing statuses remain outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NY',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'New York State Department of Taxation and Finance, Information for retired persons — Social Security',
      url: 'https://www.tax.ny.gov/pit/file/information_for_seniors.htm',
      quotedText:
        'Social security benefits that are included in federal adjusted gross income may be subtracted from your federal adjusted gross income when computing your New York adjusted gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.NY',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ny-it225-s122-non-ss-railroad-benefits-not-modeled': {
    title: 'New York subtracts non-Tier-1 railroad benefits on IT-225 S-122; the engine cannot identify them',
    statement:
      'New York Department of Taxation and Finance guidance allows a subtraction from federal adjusted gross income when computing New York adjusted gross income for supplemental annuity or Tier 2 benefits received under the Railroad Retirement Act of 1974, or benefits received under the Railroad Unemployment Insurance Act, that were included in federal adjusted gross income and are exempt from state income taxes under Title 45 of the United States Code, using Form IT-225 code S-122. Social Security-equivalent Tier 1 railroad retirement benefits are a separate subtraction registered at `ny-dtf-social-security-subtraction`. Out of scope: `incomeStreamSchema` has no railroad-retirement type, `pensionSchema.source` is only `private` or `public`, `TaxYearInput` carries no Railroad Retirement Act category, Railroad Unemployment Insurance Act provenance, or Title 45 exemption flag, and `StateTaxParams` carries no railroad-benefit classification — so no accepted `socialSecurity`, `pension`, `wages`, or generic ordinary income input can identify qualifying S-122 benefits. Generic amounts entered through those channels are still priced under the pack\'s existing rules; the engine emits no law-specific refusal for this limb. This record does not certify part-year allocation, unsupported filing statuses, or whole-return IT-225 accuracy.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'whether a benefit is supplemental annuity or Tier 2 under the Railroad Retirement Act of 1974, as distinct from Social Security-equivalent Tier 1 railroad retirement benefits',
        'whether a benefit is received under the Railroad Unemployment Insurance Act',
        'whether the benefit is exempt from state income taxes under Title 45 of the United States Code',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NY',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'New York State Department of Taxation and Finance, Information for retired persons — Railroad Retirement benefits (IT-225 code S-122)',
      url: 'https://www.tax.ny.gov/pit/file/information_for_seniors.htm',
      quotedText:
        'If you included in your federal adjusted gross income either: supplemental annuity or Tier 2 benefits received under the Railroad Retirement Act of 1974, or benefits received under the Railroad Unemployment Insurance Act, and those benefits are exempt from state income taxes under Title 45 of the United States Code, you may subtract the amount of those benefits from your federal adjusted gross income when computing your New York adjusted gross income using Form IT-225 . See IT-225-I , New York State Modifications , code S-122 Certain railroad retirement income and railroad unemployment insurance benefits.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'New York State Department of Taxation and Finance, Information for retired persons — Social Security equivalent Railroad Retirement benefits',
      url: 'https://www.tax.ny.gov/pit/file/information_for_seniors.htm',
      quotedText:
        'Social Security equivalent Tier 1 railroad retirement benefits that are included in federal adjusted gross income may be subtracted from your federal adjusted gross income when computing your New York adjusted gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/state/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#incomeStreamSchema',
      'packages/engine/src/model/plan.ts#pensionSchema',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
    ],
  },

  'mrs-36-5124-c-1-b-decoupled-standard-deduction': {
    title: 'Maine’s 2026 standard deduction uses Maine’s basic plus the federal age-65 addition',
    statement:
      'For tax years beginning on or after January 1, 2026, and for Maine adjusted gross income below the §5124-C(2) phase-out, a Maine resident\'s standard deduction uses Maine\'s published basic standard deduction amount plus the IRC 63(f)(1) age additional amount incorporated through IRC 63(c)(3) for a taxpayer — and, on a joint return, an eligible spouse — who has attained age 65 before the close of the taxable year, and is no longer the whole federal standard deduction that subsection 1-A carried through 2025. This settled component is age-only and filing-status-scoped to the single and married amounts the engine models; it does not settle blindness under IRC 63(f)(2) or head-of-household basic amounts.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This record settles only the published-basic-plus-age-65-addition component for tax years beginning 2026. The combined total is then subject to the §5124-C(2) phase-out through sibling `mrs-36-5124-c-2-standard-deduction-phaseout`. The unmodeled personal exemption can move complete-return tax the other way, so this record does not assert a net Form 1040ME tax direction. Pre-2026 inputs use the sole 2026 state pack as a parameter stand-in and are not certified historical Maine dollar amounts; projected future age amounts scale with assumed plan inflation rather than a statutory COLA oracle. It does not register Maine\'s personal exemption, blindness (not modeled — the engine\'s age counter drives only IRC 63(f) age relief, not blindness), head-of-household amounts, or any other return line. A fixture taxable income in this subset is pack taxable income, not Form 1040ME taxable income. The statutory $12,000 basic in §5124-C(1-B)(A) is the statutory base subject to index; the pack\'s $15,700 / $31,400 are the MRS-published figures for 2026 — reconciling that indexed statutory base to the published table is separate research beyond this record. Maine must NOT be tagged `standardDeductionConformity: \'federal\'`: that tag federally scales a borrowed basic amount and is not how Maine adopts only the federal age additional amount while setting its own basic. The federal conformity sibling (`irc-63-c-7-B-ii-conformed-state-deduction-tracks-federal`) does not decide Maine\'s roster; decoupling the basic is untagging, while Maine\'s IRC 63(c)(3)/63(f)(1) age adoption is registered here. Implementation is filing-status-scoped to single and married amounts the engine models; MFS and HOH are not represented.',
    jurisdiction: 'state:ME',
    authority: [{
      kind: 'statute',
      citation: '36 M.R.S. 5124-C(1-B)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5124-C.html',
      quotedText:
        'Amount; on or after January 1, 2026. For tax years beginning on or after January 1, 2026, the standard deduction of a resident individual is equal to the sum of the basic standard deduction and the additional standard deduction, subject to the phase-out under subsection 2.',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. 5124-C(1-B)(A)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5124-C.html',
      quotedText:
        'The basic standard deduction is: (1) For single individuals and married persons filing separate returns, $12,000; (2) For individuals filing as heads of households, the amount allowed under subparagraph (1) multiplied by 1.5; and (3) For individuals filing married joint returns or surviving spouses, the amount allowed under subparagraph (1) multiplied by 2.',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. 5124-C(1-B)(B)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5124-C.html',
      quotedText:
        'The additional standard deduction is the amount allowed under the Code, Section 63(c)(3).',
    }, {
      kind: 'statute',
      citation: 'IRC 63(c)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'For purposes of paragraph (1), the additional standard deduction is the sum of each additional amount to which the taxpayer is entitled under subsection (f).',
    }, {
      kind: 'statute',
      citation: 'IRC 63(f)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'The taxpayer shall be entitled to an additional amount of $600- (A) for himself if he has attained age 65 before the close of his taxable year, and (B) for the spouse of the taxpayer if the spouse has attained age 65 before the close of the taxable year and an additional exemption is allowable to the taxpayer for such spouse under section 151(b).',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. 5124-C(1-A)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5124-C.html',
      quotedText:
        'Amount; before January 1, 2026. For tax years beginning on or after January 1, 2020 and before January 1, 2026, the standard deduction of a resident individual is equal to the federal standard deduction, subject to the phase-out under subsection 2.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'MRS 2026 individual income tax rate schedule (rev. May 20, 2026), Standard Deduction',
      url: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/2026-05/ind_tax_rate_sched_2026_rev.pdf',
      quotedText:
        'Standard Deduction: Single - $15,700 Married Filing Jointly - $31,400',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'MRS 2026 individual income tax rate schedule (rev. May 20, 2026), Additional Amount for Age or Blindness',
      url: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/2026-05/ind_tax_rate_sched_2026_rev.pdf',
      quotedText:
        'Additional Amount for Age or Blindness: $1,650 if married … $2,050 if unmarried (single or head of household)',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. 5403(2)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5403.html',
      quotedText:
        'On or about September 15th of each year as specified in this section, the assessor shall multiply the cost-of-living adjustment for taxable years beginning in the succeeding calendar year by the following: … Standard deductions. In 2025 and each year thereafter, by the dollar amount contained in section 5124-C, subsection 1-B, paragraph A, subparagraph (1)',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-06',
    implementedBy: [
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#ME',
      'packages/engine/src/params/state/index.ts#conformStateStandardDeduction',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'mrs-36-5124-c-2-standard-deduction-phaseout': {
    title: 'Maine’s standard deduction phases out proportionally above the published Maine AGI start',
    statement:
      'For tax years beginning on or after January 1, 2026, a resident individual\'s Maine standard deduction — the sum of the basic standard deduction and the additional standard deduction under §5124-C(1-B) — must be reduced by an amount equal to that total standard deduction multiplied by a fraction whose numerator is the taxpayer\'s Maine adjusted gross income less the inflation-adjusted start amount for the filing status, except that the numerator may not be less than zero, and whose denominator is the statutory range for that status, capped so the fraction is never more than one. For single individuals and married persons filing separate returns the statutory start base is $80,000 and the denominator is $75,000; for individuals filing married joint returns or surviving spouses permitted to file a joint return the statutory start base is $160,000 and the denominator is $150,000. The 2026 published starts are $102,250 if single or married filing separately and $204,550 if married filing jointly or qualifying surviving spouse, with those same statutory ranges. This record settles only that proportional reduction given a supplied annual Maine AGI and those applicable published parameters for the single and married filing statuses the engine models.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Narrow formula record: it settles the §5124-C(2) proportional reduction of the already-determined total standard deduction once annual Maine AGI and the applicable published start/range parameters are supplied. It does not certify construction of Maine AGI, Form 1040ME additions or subtractions, the personal exemption, blindness, or any other return line — a fixture taxable income here is the modeled pack taxable-income component after that phased standard deduction, not Form 1040ME taxable income. The StateTax consumer remains partial: the engine\'s modeled Maine AGI is a proxy (§5122 additions not all representable), and part-year residency is the existing month-proration approximation rather than certified statutory apportionment — but the annual phase-out fraction is now chosen from full-year modeled income before residency scaling, so split-year segments no longer compare prorated income to annual thresholds. Effective 2026+; the sole 2026 pack is the parameter stand-in for other years. Starts are annually indexed under §5403(4) while the statutory range widths stay fixed; projected or historical pack fallbacks are nominal and are not certified future or historical Maine figures. The worksheet displays the fraction to four decimal places; this engine retains the exact ratio and does not claim cent-for-cent form reproduction at arbitrary incomes. Sibling `mrs-36-5124-c-1-b-decoupled-standard-deduction` remains the basic-plus-age component before this phase-out. Implementation is filing-status-scoped to single and married amounts the engine models; MFS and HOH are not represented.',
    jurisdiction: 'state:ME',
    authority: [{
      kind: 'statute',
      citation: '36 M.R.S. 5124-C(1-B)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5124-C.html',
      quotedText:
        'Amount; on or after January 1, 2026. For tax years beginning on or after January 1, 2026, the standard deduction of a resident individual is equal to the sum of the basic standard deduction and the additional standard deduction, subject to the phase-out under subsection 2.',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. 5124-C(2)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5124-C.html',
      quotedText:
        'Phase-out. The standard deduction of the taxpayer must be reduced by an amount equal to the total standard deduction multiplied by the following fraction:',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. 5124-C(2)(A)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5124-C.html',
      quotedText:
        'For single individuals and married persons filing separate returns, the numerator is the taxpayer\'s Maine adjusted gross income less $80,000, except that the numerator may not be less than zero, and the denominator is $75,000. In no case may the fraction calculated pursuant to this paragraph produce a result that is more than one. The $80,000 amount used to calculate the numerator in this paragraph must be adjusted for inflation in accordance with section 5403, subsection 4;',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. 5124-C(2)(C)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5124-C.html',
      quotedText:
        'For individuals filing married joint returns or surviving spouses permitted to file a joint return, the numerator is the taxpayer\'s Maine adjusted gross income less $160,000, except that the numerator may not be less than zero, and the denominator is $150,000. In no case may the fraction calculated pursuant to this paragraph produce a result that is more than one. The $160,000 amount used to calculate the numerator in this paragraph must be adjusted for inflation in accordance with section 5403, subsection 4.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'MRS 2026 Estimated Tax Worksheet, Line 6a — Phaseout of Itemized / Standard Deductions Worksheet (rev. December 2025)',
      url: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_item_stand_%20ded_phaseout_wksht_0.pdf',
      quotedText:
        'You must use this Worksheet to calculate the reduction of your standard deduction amount or itemized deduction amount if your estimated Maine adjusted gross income for 2026 is greater than $102,250 if single or married filing separately; $153,400 if head of household; or $204,550 if married filing jointly or qualifying surviving spouse.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'MRS 2026 Estimated Tax Worksheet, Line 6a — Phaseout worksheet lines 7–8 (rev. December 2025)',
      url: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_item_stand_%20ded_phaseout_wksht_0.pdf',
      quotedText:
        'Multiply line 6 by line 5.…Subtract line 7 from line 6. Enter this amount on your 2026 Estimated Tax Worksheet, line 6a.',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. 5403(4)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5403.html',
      quotedText:
        'On or about September 15th of each year as specified in this section, the assessor shall multiply the cost-of-living adjustment for taxable years beginning in the succeeding calendar year by the following: … Individual income tax standard deduction and itemized deduction phase-out. Beginning in 2018 and each year thereafter, by the dollar amount contained in the numerator of the fraction specified in section 5124-C, subsection 2, paragraphs A, B and C',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-06',
    implementedBy: [
      'packages/engine/src/tax/stateStandardDeduction.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/tax/stateStandardDeduction.ts#phaseOutStandardDeduction',
      'packages/engine/src/params/state/data/year2026.ts#ME',
    ],
  },

  'me-mrs-36-5122-2-m2-m3-2026-pension-deduction': {
    title: 'Maine’s 2026 nonmilitary pension deduction maximum is $49,824 before offset and phaseout',
    statement:
      'For tax year 2026, Maine\'s nonmilitary pension deduction amount is $49,824 before the statutory Social Security and Railroad Retirement reduction and the federal-adjusted-gross-income phaseout in §5122(2)(M-3), and the deductible amount may not exceed qualifying retirement-plan benefits included in federal adjusted gross income. Approximated: the pack models retirement as one flat per-person cap at the published maximum and cannot classify every eligible distribution, subtract gross Social Security or Railroad Retirement from the nonmilitary maximum, apply the separate full military deduction, or enforce the M-3 phaseout — so it can misstate tax in either direction outside isolated fixtures where federal AGI is below the unindexed M-3 applicable-amount base for the filing status, a single qualifying primary recipient is represented, and there is no gross Social Security or Railroad Retirement. Approximated further: on MFJ returns `retirementExclusion` multiplies `capPerPerson` by `agesAlive.length` because the plan schema cannot attribute retirement income to each spouse separately, so a one-recipient household can be over-excluded when both spouses are marked alive.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The July 2026 MRS Form 1040ES-ME instructions publish the exact 2026 maximum; the parameter refresh aligned the flat cap to $49,824. The statutory limbs in §5122(2)(M-2) and (M-3) still bound what the flat cap omits. M-3 phases on federal AGI against an indexed applicable amount defined in the quoted authority, not Maine\'s §5124-C standard-deduction phaseout. This record settles only that published TY2026 maximum and the lesser-of-benefits-included-in-federal-AGI limb for the nonmilitary deduction before offset and phaseout. It does not certify plan qualification under M-2, military separation under M-2(1)(b), the gross Social Security/RRB reduction, the M-3 AGI phaseout, per-recipient MFJ attribution, personal exemption, blindness, unsupported filing statuses, historical or future years, or whole Form 1040ME accuracy. A fixture taxable income here is modeled pack taxable income after the flat cap, not Form 1040ME taxable income. The gross-benefit offset remains unmodeled, so the with-offset fixture stays discriminating; `agesAlive.length` doubling remains unmodeled for MFJ one-recipient cases.',
    jurisdiction: 'state:ME',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Maine Revenue Services, 2026 Form 1040ES-ME Instructions, revised July 2026, worksheet line 2 note',
      url: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_1040es_fillable.pdf',
      quotedText:
        'Note that the maximum pension income deduction is increased to $49,824 for tax year 2026.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Maine Revenue Services, 2026 Form 1040ES-ME Instructions, revised July 2026, pension maximum basis',
      url: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_1040es_fillable.pdf',
      quotedText:
        'The maximum pension income deduction is equal to the annual social security benefit for an individual at the retirement age, as defined in 42 USC § 416(l), as of January 1, 2026.',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. §5122(2)(M-2)(1)(a)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5122.html',
      quotedText:
        'Excluding military retirement plan benefits, an amount that is the lesser of: (i) The aggregate of retirement plan benefits under employee retirement plans or individual retirement accounts included in the individual’s federal adjusted gross income; and (ii) The pension deduction amount reduced by the total amount of the individual’s social security benefits and railroad retirement benefits paid by the United States, but not less than $0; and',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. §5122(2)(M-2)(1)(b)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5122.html',
      quotedText:
        'An amount equal to the aggregate of retirement benefits under military retirement plans included in the individual’s federal adjusted gross income; and',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. §5122(2)(M-2)(2)(d)(iv)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5122.html',
      quotedText:
        'For tax years beginning on or after January 1, 2024, the maximum annual benefit that an individual eligible to retire at the retirement age, as defined in 42 United States Code, Section 416(l), as of January 1st of the tax year may receive under the federal Social Security Act and amendments to that Act as of June 28, 2023.',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. §5122(2)(M-3)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5122.html',
      quotedText:
        'For tax years beginning on or after January 1, 2025, the amount in paragraph M-2, subparagraph (1), division (a) must be reduced by an amount equal to the total amount in paragraph M-2, subparagraph (1), division (a) multiplied by a fraction, the numerator of which is the taxpayer\'s federal adjusted gross income less the applicable amount, except that the numerator may not be less than zero, and the denominator of which is $50,000 in the case of a married individual filing a separate return and $100,000 in all other filing cases. The fraction contained in this paragraph may not produce a result that is more than one. The applicable amount must be adjusted for inflation in accordance with section 5403, subsection 11.',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. §5122(2)(M-3), applicable amount definition',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5122.html',
      quotedText:
        'For purposes of this paragraph, "applicable amount" means: (1) For individuals filing as single individuals, $125,000; (2) For individuals filing as heads of households, $187,500; (3) For individuals filing married joint returns or as surviving spouses, $250,000; or (4) For married individuals filing separate returns, 1/2 of the applicable amount under subparagraph (3);',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. §5403(11)',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5403.html',
      quotedText:
        'Beginning in 2025 and each year thereafter, by the dollar amount of the applicable amounts specified in section 5122, subsection 2, paragraph M-3, except that for the purposes of this subsection, notwithstanding section 5402, subsection 1-B, the "cost-of-living adjustment" is the Chained Consumer Price Index for the 12-month period ending June 30th of the preceding calendar year divided by the Chained Consumer Price Index for the 12-month period ending June 30, 2024.',
    }, {
      kind: 'statute',
      citation: '36 M.R.S. §5403, COLA rounding',
      url: 'https://legislature.maine.gov/statutes/36/title36sec5403.html',
      quotedText:
        'Except for subsection 5, paragraph A and subsection 9, if the dollar amount of each item, adjusted by the application of the cost-of-living adjustment, is not a multiple of $50, any increase must be rounded to the next lowest multiple of $50.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Maine Revenue Services, 2025 Form 1040ME General Instructions, Schedule 1S line 4 instructions, PDF page 7 (MFJ per-recipient allocation)',
      url: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/25_1040me_gen_instr_w_cover_pg.pdf',
      quotedText:
        'Eligible pension income does not include benefits earned by another person, except in the case of a surviving spouse. Only the individual who earned the benefit from prior employment may claim the pension income for the deduction.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-08',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#ME',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ct-cgs-12-701-20-b-social-security-retirement': {
    title: 'Connecticut’s Social Security and pension subtractions are income-tested',
    statement:
      'Connecticut subtracts all federally taxable Social Security for a single filer with federal adjusted gross income below $75,000, but above that threshold subtracts only the difference between the federally includable amount and the lesser of twenty-five percent of benefits received or twenty-five percent of the IRC §86(b)(1) excess — so a high-AGI filer retains part of the federally taxable share in Connecticut adjusted gross income rather than receiving a full exclusion or keeping the entire federally taxable amount. Its pension and annuity schedule likewise allows 100 percent below $75,000 and zero at $100,000 and over for a single filer. Approximated in both directions: the pack always taxes federally taxable Social Security without the above-threshold partial subtraction, overstating tax relative to the statutory partial-exclusion limb and also overstating tax for the low-income full-subtraction limb; its unconditional `{ kind: \'full\' }` retirement exclusion removes a high-income pension that the schedule taxes, understating tax. The engine has no state AGI-band or retirement-subtraction-percentage field, so it cannot select either schedule from an accepted input.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'state:CT',
    authority: [{
      kind: 'statute',
      citation: 'Conn. Gen. Stat. 12-701(a)(20)(B)(x)(III)',
      url: 'https://www.cga.ct.gov/current/pub/chap_229.htm',
      quotedText:
        'For the taxable year commencing January 1, 2019, and each taxable year thereafter, for a person who files a return under the federal income tax as an unmarried individual whose federal adjusted gross income for such taxable year is less than seventy-five thousand dollars, or as a married individual filing separately whose federal adjusted gross income for such taxable year is less than seventy-five thousand dollars, or for a husband and wife who file a return under the federal income tax as married individuals filing jointly whose federal adjusted gross income for such taxable year is less than one hundred thousand dollars or a person who files a return under the federal income tax as a head of household whose federal adjusted gross income for such taxable year is less than one hundred thousand dollars, an amount equal to the Social Security benefits includable for federal income tax purposes; and',
    }, {
      kind: 'statute',
      citation: 'Conn. Gen. Stat. 12-701(a)(20)(B)(x)(IV)',
      url: 'https://www.cga.ct.gov/current/pub/chap_229.htm',
      quotedText:
        'For the taxable year commencing January 1, 2019, and each taxable year thereafter, for a person who files a return under the federal income tax as an unmarried individual whose federal adjusted gross income for such taxable year is seventy-five thousand dollars or more, or as a married individual filing separately whose federal adjusted gross income for such taxable year is seventy-five thousand dollars or more, or for a husband and wife who file a return under the federal income tax as married individuals filing jointly whose federal adjusted gross income from such taxable year is one hundred thousand dollars or more or for a person who files a return under the federal income tax as a head of household whose federal adjusted gross income for such taxable year is one hundred thousand dollars or more, an amount equal to the difference between the amount of Social Security benefits includable for federal income tax purposes and the lesser of twenty-five per cent of the Social Security benefits received during the taxable year, or twenty-five per cent of the excess described in Section 86(b)(1) of the Internal Revenue Code;',
    }, {
      kind: 'statute',
      citation: 'Conn. Gen. Stat. 12-701(a)(20)(B)(xxi), table 32',
      url: 'https://www.cga.ct.gov/current/pub/chap_229.htm',
      quotedText:
        'To the extent properly includable in gross income for federal income tax purposes, … any pension or annuity income for the taxable year commencing on or after January 1, 2024, and each taxable year thereafter, in accordance with the following schedule, for a person who files a return under the federal income tax as an unmarried individual whose federal adjusted gross income for such taxable year is less than one hundred thousand dollars … Federal Adjusted Gross Income Deduction … $100,000 and over 0.0%',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-10',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/params/state/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#CT',
      'packages/engine/src/params/state/types.ts#StateRetirementExclusion',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'ma-gen-laws-ch62-s2-public-pension-exclusion': {
    title: 'Massachusetts deducts contributory public and uniformed-services retirement, not every public pension',
    statement:
      'Massachusetts gross income deducts income from any contributory annuity, pension, endowment or retirement fund of the United States government, the commonwealth, or any political subdivision thereof to which the employee has contributed, and United States government retirement pay for a retired member of the Uniformed Services. Approximated: the pack encodes the public bucket as `{ kind: \'full\' }`, but `publicPensionIncome` carries no contributory or system identity, so a noncontributory public pension the statute leaves in the base is removed the same way a contributory Commonwealth or Uniformed-Services annuity is. The engine understates tax on every public-pension dollar the subparagraph does not reach. Private IRA, 401(k) and similar distributions stay `{ kind: \'none\' }`, which matches the absence of those sources from this subparagraph.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale: null,
    jurisdiction: 'state:MA',
    authority: [{
      kind: 'statute',
      citation: 'Mass. Gen. Laws ch. 62, §2(a)(2)',
      url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section2',
      quotedText:
        'The items to be deducted therefrom are:--',
    }, {
      kind: 'statute',
      citation: 'Mass. Gen. Laws ch. 62, §2(a)(2)(E)',
      url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section2',
      quotedText:
        'Income from any contributory annuity, pension, endowment or retirement fund of the United States government or the commonwealth or any political subdivision thereof including the optional retirement system established by section forty of chapter fifteen A, to which the employee has contributed, or any income received from the United States government as retirement pay for a retired member of the Uniformed Services of the United States, as defined in 10 U.S.C. section 1072, regardless of whether the retiree contributed to the retirement system, or any income received from the United States government as survivorship benefits under 10 U.S.C. sections 1431 to 1460, inclusive.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#PUBLIC_PENSION_OVERRIDES',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ma-gen-laws-ch62-s2-social-security': {
    title: 'Massachusetts deducts Social Security included in federal gross income',
    statement:
      'Massachusetts gross income deducts Social Security benefits included in federal gross income under IRC section 86. That is what `taxesSocialSecurity: false` encodes: the federally taxable share is subtracted back out and never reaches the Massachusetts base.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:MA',
    authority: [{
      kind: 'statute',
      citation: 'Mass. Gen. Laws ch. 62, §2(a)(2)(H)',
      url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section2',
      quotedText:
        'Social security benefits included in federal gross income under section eighty-six of the Code.',
    }, {
      kind: 'statute',
      citation: 'Mass. Gen. Laws ch. 62, §2(a)(2)',
      url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIX/Chapter62/Section2',
      quotedText:
        'The items to be deducted therefrom are:--',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.MA',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'nh-rsa-77-taxation-of-incomes-repealed': {
    title: 'New Hampshire’s Taxation of Incomes chapter is gone from 2025',
    statement:
      'RSA Chapter 77, titled Taxation of Incomes, is repealed in its entirety. The General Court’s own chapter page states the whole chapter was repealed, and the compiler’s note names the act and the date: repealed by 2021, 91:189, II, effective January 1, 2025. From that date New Hampshire levies no individual income tax, which is what the pack’s `hasIncomeTax: false` encodes for 2026 — no wage, capital gain, Social Security benefit, pension, or IRA or 401(k) distribution reaches a New Hampshire rate, because there is no Chapter 77 left to impose one. The date is 2025 and not 2021: the 2021 session law that repealed the chapter set the effective date at January 1, 2025. This negative is statutory. Nothing in the staged source is a constitutional bar, so a later session can put a tax back, and this record belongs on the annual re-verification list for that reason rather than out of routine.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NH',
    authority: [{
      // Markup-stripped text of the chapter heading on the official RSA
      // repeal page. &#150; is quoted as U+0096, which is what the numeric
      // reference names, rather than rewritten as U+2013 (the glyph a
      // browser's Windows-1252 substitution would show). 49 characters.
      kind: 'statute',
      citation: 'N.H. Rev. Stat. Ann. ch. 77 (repealed), chapter heading',
      url: 'https://www.gencourt.state.nh.us/rsa/html/V/77/77-mrg.htm',
      quotedText: 'Chapter 77 Repealed \u0096 Entire Chapter was repealed',
    }, {
      // Markup-stripped compiler’s note on the same page. 50 characters.
      kind: 'statute',
      citation: 'N.H. Rev. Stat. Ann. ch. 77 (repealed), compiler’s note',
      url: 'https://www.gencourt.state.nh.us/rsa/html/V/77/77-mrg.htm',
      quotedText: '[Repealed by 2021, 91:189, II, eff. Jan. 1, 2025.]',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2025,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#NH',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'nj-njit12-social-security-exclusion': {
    title: 'New Jersey does not tax Social Security benefits',
    statement:
      'New Jersey\'s Division of Taxation lists Social Security benefits among items not subject to New Jersey tax that should not be included on a New Jersey return. That is what `taxesSocialSecurity: false` encodes: the benefit never reaches the New Jersey base. Pension exclusions and Railroad Retirement treatment remain outside this record.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:NJ',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'New Jersey Division of Taxation, Exempt (Nontaxable) Income',
      url: 'https://www.nj.gov/treasury/taxation/njit12.shtml',
      quotedText:
        'Certain items of income are not subject to New Jersey tax and should not be included when you file a New Jersey return. Below is a partial list of such items. Social Security benefits;',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#states.NJ',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },

  'nj-stat-54a-6-10-retirement-income-exclusion': {
    title: 'New Jersey\'s pension exclusion is age-62, per-return, and AGI-capped; the pack is a flat $50,000',
    statement:
      'From 2021 New Jersey excludes pension, disability, or retirement-plan payments received by a person 62 or older, but only if gross income for the year is not more than $150,000, and the dollar ceiling for a taxpayer at or below $100,000 of gross income is $100,000 joint / $75,000 single / $50,000 married-filing-separately. Between $100,000 and $150,000 the exclusion is a percentage of the payments rather than those ceilings. Approximated: the pack encodes `{ kind: \'capped\', capPerPerson: 50000, minAge: 62 }` with no AGI test, so a household over $150,000 is given a $50,000 subtraction the statute withholds (understating tax) and a single filer under $100,000 is given $50,000 rather than $75,000 (overstating tax). Social Security is registered separately at nj-njit12-social-security-exclusion.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'state:NJ',
    authority: [{
      kind: 'statute',
      citation: 'N.J.S.A. 54A:6-10(b)(1), as amended by P.L.2021, c.129',
      url: 'https://pub.njleg.gov/bills/2020/AL21/129_.HTM',
      quotedText:
        'for taxable years beginning on or after January 1, 2020, … of up to $100,000 for a married couple filing jointly, $50,000 for a married person filing separately, or $75,000 for an individual filing as a single taxpayer or an individual determining tax pursuant to subsection a. of N.J.S.54A:2-1;',
    }, {
      kind: 'statute',
      citation: 'N.J.S.A. 54A:6-10(b)(1), as amended by P.L.2021, c.129 (age and qualifying payments)',
      url: 'https://pub.njleg.gov/bills/2020/AL21/129_.HTM',
      quotedText:
        'which are received as an annuity, endowment or life insurance contract, or payments of any such amounts which are received as pension, disability, or retirement benefits, under any public or private plan, whether the consideration therefor is contributed by the employee or employer or both, by any person who is 62 years of age or older or who, by virtue of disability, is or would be eligible to receive payments under the federal Social Security Act.',
    }, {
      kind: 'statute',
      citation: 'N.J.S.A. 54A:6-10(b)(2), as amended by P.L.2021, c.129',
      url: 'https://pub.njleg.gov/bills/2020/AL21/129_.HTM',
      quotedText:
        'For taxable years beginning on or after January 1, 2021, the exclusion provided by this subsection shall only be allowed if the taxpayer has gross income for the taxable year of not more than $150,000.',
    }, {
      kind: 'statute',
      citation: 'N.J.S.A. 54A:6-10(b)(1), as amended by P.L.2021, c.129 (phase-down)',
      url: 'https://pub.njleg.gov/bills/2020/AL21/129_.HTM',
      quotedText:
        'for taxable years beginning on or after January 1, 2021, for a taxpayer with gross income in excess of $100,000, but not more than $125,000, 50 percent of payments for a married couple filing jointly, 25 percent of payments for a married couple filing separately, or 37.5 percent of payments for an individual filing as a single taxpayer or individual determining tax pursuant to subsection a. of N.J.S.54A:2-1;',
    }, {
      kind: 'statute',
      citation: 'N.J.S.A. 54A:6-10(b)(1), as amended by P.L.2021, c.129 ($125,000–$150,000 band)',
      url: 'https://pub.njleg.gov/bills/2020/AL21/129_.HTM',
      quotedText:
        'for taxable years beginning on or after January 1, 2021, for a taxpayer with gross income in excess of $125,000, but not more than $150,000, 25 percent of payments for a married couple filing jointly, 12.5 percent of payments for a married couple filing separately, or 18.75 percent of payments for an individual filing as a single taxpayer or individual determining tax pursuant to subsection a. of N.J.S.54A:2-1',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2021,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#NJ',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ri-dot-adv-2025-22-2026-deduction-and-rate-schedule': {
    title: 'Rhode Island’s TY2026 standard deduction and bracket thresholds are inflation-adjusted',
    statement:
      'For tax year 2026, Rhode Island publishes an $11,200 standard deduction for a single return and $22,400 for a married-filing-jointly return, with a uniform three-rate schedule stepping at $82,050 and $186,450 at 3.75%, 4.75%, and 5.99%. Personal exemptions, the standard-deduction phaseout calculation, unsupported filing statuses, and whole-return accuracy are outside this modeled subtotal.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'These are annually inflation-adjusted publication amounts for tax year 2026 only; later years require a later advisory. Rhode Island’s Social Security and pension modifications remain disclosed separately at `ri-gen-laws-44-30-12-social-security-and-pension-modification`.',
    jurisdiction: 'state:RI',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Rhode Island Division of Taxation, ADV 2025-22, TY2026 scope',
      url: 'https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-11/ADV_2025_22_Inflation_Adjustments.pdf',
      quotedText:
        'PROVIDENCE, R.I. – The Rhode Island Division of Taxation today provides the standard deduction amounts, tax bracket ranges, and other key items for Rhode Island Personal Income Tax for tax years beginning on or after January 1, 2026.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Rhode Island Division of Taxation, ADV 2025-22, standard deduction table',
      url: 'https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-11/ADV_2025_22_Inflation_Adjustments.pdf',
      quotedText:
        'Rhode Island standard deduction amounts by Tax Year Filing status 2025 2026 Single $10,900 $11,200 Married filing jointly* $21,800 $22,400 Head of household $16,350 $16,800 Married filing separately $10,900 $11,200 *Or qualifying widow or widower.',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Rhode Island Division of Taxation, ADV 2025-22, TY2026 uniform rate schedule',
      url: 'https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-11/ADV_2025_22_Inflation_Adjustments.pdf',
      quotedText:
        'Uniform tax rate schedule for Tax Year 2026 (Personal Income Tax) Taxable income: Over But not over Pay + percent on excess of the amount over $ 0 $ 82,050 $ -- 3.75% $ 0 82,050 186,450 3,076.88 4.75% 82,050 186,450 8,035.88 5.99% 186,450',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Rhode Island Division of Taxation, ADV 2025-22, deduction phaseout range',
      url: 'https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-11/ADV_2025_22_Inflation_Adjustments.pdf',
      quotedText:
        'Phase-out range for standard deduction, exemption amounts by Tax Year 2025 2026 $254,250 to $283,250 $261,000 to $290,800',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-09-07',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#RI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#bracketTax',
    ],
  },

  'ri-gen-laws-44-30-12-social-security-and-pension-modification': {
    title: 'Rhode Island limits Social Security and pension modifications by age, AGI, and year',
    statement:
      'Rhode Island allows an age-qualified Social Security modification only below its federal-AGI thresholds: the statute starts at $80,000 for an unmarried, head-of-household, or married-separate filer and $100,000 for a joint filer or qualifying widow(er), then requires annual inflation adjustment. It also allows a pension or annuity modification subject to the same AGI test, with a statutory ceiling of $50,000 beginning in tax years after 2025. The pack instead taxes the federally taxable Social Security share for everyone and applies a $20,000 age-67 retirement cap without the AGI test. Those omissions can move taxpayer exposure in both directions: the blanket Social Security inclusion overstates tax below the threshold, while applying a retirement cap above the threshold understates tax; the $20,000 ceiling also overstates tax for eligible pensions now reaching $50,000.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale: null,
    jurisdiction: 'state:RI',
    authority: [{
      kind: 'statute',
      citation: 'R.I. Gen. Laws §44-30-1(a)',
      url: 'https://webserver.rilegislature.gov/Statutes/TITLE44/44-30/44-I/44-30-1.htm',
      quotedText:
        'A Rhode Island personal income tax determined in accordance with the rates set forth in § 44-30-2 is imposed for each taxable year (which shall be the same as the taxable year for federal income tax purposes) on the Rhode Island income of every individual, estate, and trust.',
    }, {
      kind: 'statute',
      citation: 'R.I. Gen. Laws §44-30-12(c)(8)(i)',
      url: 'https://webserver.rilegislature.gov/Statutes/TITLE44/44-30/44-II/44-30-12.htm',
      quotedText:
        '(8) Modification for taxable Social Security income. (i) For tax years beginning on or after January 1, 2016: (A) For a person who has attained the age used for calculating full or unreduced Social Security retirement benefits who files a return as an unmarried individual, head of household, or married filing separate whose federal adjusted gross income for the taxable year is less than eighty thousand dollars ($80,000); or (B) A married individual filing jointly or individual filing qualifying widow(er) who has attained the age used for calculating full or unreduced Social Security retirement benefits whose joint federal adjusted gross income for the taxable year is less than one hundred thousand dollars ($100,000), an amount equal to the Social Security benefits includible in federal adjusted gross income.',
    }, {
      kind: 'statute',
      citation: 'R.I. Gen. Laws §44-30-12(c)(8)(ii)',
      url: 'https://webserver.rilegislature.gov/Statutes/TITLE44/44-30/44-II/44-30-12.htm',
      quotedText:
        '(ii) Adjustment for inflation. The dollar amount contained in subsections (c)(8)(i)(A) and (c)(8)(i)(B) of this section shall be increased annually by an amount equal to:',
    }, {
      kind: 'statute',
      citation: 'R.I. Gen. Laws §44-30-12(c)(9)(i)',
      url: 'https://webserver.rilegislature.gov/Statutes/TITLE44/44-30/44-II/44-30-12.htm',
      quotedText:
        '(9) Modification of taxable retirement income from certain pension plans or annuities. (i) For tax years beginning on or after January 1, 2017, until the tax year beginning January 1, 2022, a modification shall be allowed for up to fifteen thousand dollars ($15,000), and for tax years beginning on or after January 1, 2023, until the tax year beginning January 1, 2024, a modification shall be allowed for up to twenty thousand dollars ($20,000), and for tax years beginning on or after January 1, 2025, a modification shall be allowed for up to fifty thousand dollars ($50,000), of taxable pension and/or annuity income that is included in federal adjusted gross income for the taxable year:',
    }, {
      kind: 'statute',
      citation: 'R.I. Gen. Laws §44-30-12(c)(9)(i)(A)',
      url: 'https://webserver.rilegislature.gov/Statutes/TITLE44/44-30/44-II/44-30-12.htm',
      quotedText:
        '(A) For a person who has attained the age used for calculating full or unreduced Social Security retirement benefits who files a return as an unmarried individual, head of household, or married filing separate whose federal adjusted gross income for such taxable year is less than the amount used for the modification contained in subsection (c)(8)(i)(A) of this section an amount not to exceed $15,000 for tax years beginning on or after January 1, 2017, until the tax year beginning January 1, 2022, and an amount not to exceed twenty thousand dollars ($20,000) for tax years beginning on or after January 1, 2023, until the tax year beginning January 1, 2024, and an amount not to exceed fifty thousand dollars ($50,000) for tax years beginning on or after January 1, 2025, of taxable pension and/or annuity income includible in federal adjusted gross income; or',
    }, {
      kind: 'statute',
      citation: 'R.I. Gen. Laws §44-30-12(c)(9)(i)(B)',
      url: 'https://webserver.rilegislature.gov/Statutes/TITLE44/44-30/44-II/44-30-12.htm',
      quotedText:
        '(B) For a married individual filing jointly or individual filing qualifying widow(er) who has attained the age used for calculating full or unreduced Social Security retirement benefits whose joint federal adjusted gross income for such taxable year is less than the amount used for the modification contained in subsection (c)(8)(i)(B) of this section an amount not to exceed $15,000 for tax years beginning on or after January 1, 2017, until the tax year beginning January 1, 2022, and an amount not to exceed twenty thousand dollars ($20,000) for tax years beginning on or after January 1, 2023, until the tax year beginning January 1, 2024, and an amount not to exceed fifty thousand dollars ($50,000) for tax years beginning on or after January 1, 2025, of taxable pension and/or annuity income includible in federal adjusted gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#RI',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
      'packages/engine/src/tax/stateTax.ts#retirementExclusion',
    ],
  },

  'ri-code-44-30-12-c-11-military-pension-not-modeled': {
    title: 'Rhode Island exempts qualifying military-service pensions under §44-30-12(c)(11); the engine cannot certify military source or portion',
    statement:
      'For tax years beginning on or after January 1, 2023, Rhode Island allows a modification subtracting military service pension benefits included in federal adjusted gross income. The term military service follows 20 C.F.R. § 212.2, and the modification allowed under subsection (c)(11) alone or together with subsection (c)(9) cannot exceed the military service pension received in the tax year. That limb is separate from the general pension modification at `ri-gen-laws-44-30-12-social-security-and-pension-modification`, from Railroad Retirement at `ri-schedule-m-1d-railroad-benefits-not-modeled`, and from the TY2026 bracket and standard-deduction amounts registered at `ri-dot-adv-2025-22-2026-deduction-and-rate-schedule`. Out of scope: `pensionSchema.source` is only `private` or `public`, `incomeStreamSchema` has no military-service, federal-military payer, or qualifying-portion fields, and `StateTaxParams` / `StateRetirementExclusion` carry no military-pension provenance — so no accepted pension or income-stream input can establish a qualifying military-service pension, avoid duplicate use with the general pension modification, or identify the federally included portion to subtract. Generic public or private pension amounts are still priced under the pack\'s existing rules; the engine emits no law-specific refusal for this limb. This record quotes the 2025 Rhode Island retirement income tax guide and reproduced statute text only; it does not fabricate a 2026 guide or assert new annual dollar figures.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'whether a pension is a military service pension included in federal adjusted gross income, as defined through 20 C.F.R. § 212.2',
        'the amount of military service pension received in the tax year so modifications under §44-30-12(c)(9) and (c)(11) do not exceed that receipt',
        'military-service or federal-military payer provenance on pensionSchema, whose `source` enum is only private or public',
        'military-service, benefit-source, or qualifying-portion facts on incomeStreamSchema',
        'military-pension classification on StateTaxParams / StateRetirementExclusion, which carry only retirement-exclusion kind, cap, and age facts',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:RI',
    authority: [{
      kind: 'stateAgencyPublication',
      citation: 'Rhode Island Division of Taxation, Retirement Income Tax Guide, Section 2: Military Service Pension Modification (Publication 2026-01, tax year 2025)',
      url: 'https://tax.ri.gov/sites/g/files/xkgbur541/files/2026-02/PUB_2026-01_Retirement_Income_Guide.pdf',
      quotedText:
        'For tax years beginning on or after January 1, 2023, military service pensions are fully exempt from Rhode Island Personal Income Tax. R.I. Gen. Laws § 44-30-12(c)(11) allows for a modification reducing federal AGI for taxpayers receiving military service pensions. When filing a Rhode Island Personal Income Tax return, a taxpayer will be able to subtract the amount of the military service pension benefits that were included in their federal AGI.',
    }, {
      kind: 'statute',
      citation: 'R.I. Gen. Laws §44-30-12(c)(11)(i)(A)',
      url: 'https://webserver.rilegislature.gov/Statutes/TITLE44/44-30/44-II/44-30-12.htm',
      quotedText:
        'For the tax years beginning on January 1, 2023, a taxpayer may subtract from federal adjusted gross income the taxpayer\'s military service pension benefits included in federal adjusted gross income;',
    }, {
      kind: 'statute',
      citation: 'R.I. Gen. Laws §44-30-12(c)(11)(ii)',
      url: 'https://webserver.rilegislature.gov/Statutes/TITLE44/44-30/44-II/44-30-12.htm',
      quotedText:
        'As used in this subsection, the term "military service" shall have the same meaning as set forth in 20 C.F.R. § 212.2;',
    }, {
      kind: 'statute',
      citation: 'R.I. Gen. Laws §44-30-12(c)(11)(iii)',
      url: 'https://webserver.rilegislature.gov/Statutes/TITLE44/44-30/44-II/44-30-12.htm',
      quotedText:
        'At no time shall the modification allowed under this subsection alone or in conjunction with subsection (c)(9) exceed the amount of the military service pension received in the tax year for which the modification is claimed;',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2023,
    effectiveThrough: null,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/state/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#pensionSchema',
      'packages/engine/src/model/plan.ts#incomeStreamSchema',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
    ],
  },

  'ri-schedule-m-1d-railroad-benefits-not-modeled': {
    title: 'Rhode Island exempts federally included 1974 Railroad Retirement benefits on Schedule M line 1d; the engine cannot identify them',
    statement:
      'The 2025 Rhode Island resident instructions for tax year 2025 state that under the Federal 1974 Railroad Retirement Act the entire amount of Railroad Retirement benefits included in gross income for federal income tax purposes is exempt from state income taxes, reported on RI Schedule M line 1d. That limb is separate from the pension or annuity modification on Schedule M line 1t and from the Social Security and pension approximations registered at `ri-gen-laws-44-30-12-social-security-and-pension-modification`. Out of scope: `incomeStreamSchema` has no railroad-retirement type, `pensionSchema.source` is only `private` or `public`, `TaxYearInput` carries no Railroad Retirement Board payer or Federal 1974 Railroad Retirement Act provenance, and `StateTaxParams` / `StateRetirementExclusion` carry no railroad-benefit payer facts — so no accepted `socialSecurity`, `pension`, `wages`, or generic ordinary income input can identify qualifying Schedule M line 1d benefits. Generic amounts entered through those channels are still priced under the pack\'s existing rules; the engine emits no law-specific refusal for this limb. This record quotes tax year 2025 resident instructions only and does not extend that exemption to later years without a later source.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
        'whether Railroad Retirement benefits are paid by the Railroad Retirement Board under the Federal 1974 Railroad Retirement Act, as distinct from pension income reported on Schedule M line 1t',
        'the amount of Railroad Retirement benefits included in gross income for federal income tax purposes that qualify for the full state exemption',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'state:RI',
    authority: [{
      kind: 'formInstruction',
      citation: 'Rhode Island Division of Taxation, 2025 RI-1040 Resident booklet instructions, title page',
      url: 'https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-12/2025%201040R%20Instructions%20122025.pdf',
      quotedText:
        'The RI-1040 Resident booklet contains returns and instructions for filing the 2025 Rhode Island Resident Individual Income Tax Return.',
    }, {
      kind: 'formInstruction',
      citation: 'Rhode Island Division of Taxation, 2025 RI-1040 Resident booklet instructions, Schedule M line 1d',
      url: 'https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-12/2025%201040R%20Instructions%20122025.pdf',
      quotedText:
        'Line 1d – Under the Federal 1974 Railroad Retirement Act, the entire amount of Railroad Retirement benefits included in gross income for federal income tax purposes are exempt from state income taxes.',
    }, {
      kind: 'formInstruction',
      citation: 'Rhode Island Division of Taxation, 2025 RI Schedule M, line 1d',
      url: 'https://tax.ri.gov/sites/g/files/xkgbur541/files/2026-01/2025%20RI%20Schedule%20M_w.pdf',
      quotedText:
        'Railroad Retirement benefits paid by the Railroad Retirement Board',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2025,
    effectiveThrough: 2025,
    verifiedOn: '2026-09-09',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/params/state/types.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#incomeStreamSchema',
      'packages/engine/src/model/plan.ts#pensionSchema',
      'packages/engine/src/params/state/types.ts#StateTaxParams',
    ],
  },

  'vt-stat-32-5830e-social-security-inclusion': {
    title: 'Vermont excludes federally taxable Social Security only below AGI thresholds',
    statement:
      'Vermont taxable income starts with federal adjusted gross income and decreases by the portion of federally taxable Social Security that section 5830e requires to be excluded. For a single, separate, head-of-household, or surviving-spouse return, all federally taxable benefits are excluded at or below $55,000 of federal AGI, reduced proportionally through $65,000, and none is excluded at or above $65,000; joint thresholds are $70,000 and $80,000. The pack\'s `taxesSocialSecurity: true` omits that low- and middle-income subtraction and therefore overstates tax for eligible retirees.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale: null,
    jurisdiction: 'state:VT',
    authority: [{
      kind: 'statute',
      citation: '32 V.S.A. §5830e(a)(1)(A)',
      url: 'https://legislature.vermont.gov/statutes/section/32/151/05830e',
      quotedText:
        '(A) If the federal adjusted gross income of the taxpayer is less than or equal to $55,000.00, all federally taxable benefits received under the federal Social Security Act shall be excluded.',
    }, {
      kind: 'statute',
      citation: '32 V.S.A. §5830e(a)(1)',
      url: 'https://legislature.vermont.gov/statutes/section/32/151/05830e',
      quotedText:
        '(1) For taxpayers whose filing status is single, married filing separately, head of household, or surviving spouse:',
    }, {
      kind: 'statute',
      citation: '32 V.S.A. §5830e(a)(1)(B)',
      url: 'https://legislature.vermont.gov/statutes/section/32/151/05830e',
      quotedText:
        '(B) If the federal adjusted gross income of the taxpayer is greater than $55,000.00 but less than $65,000.00, the percentage of federally taxable benefits received under the Social Security Act to be excluded shall be proportional to the amount of the taxpayer’s federal adjusted gross income over $55,000.00, determined by:',
    }, {
      kind: 'statute',
      citation: '32 V.S.A. §5830e(a)(1)(C)',
      url: 'https://legislature.vermont.gov/statutes/section/32/151/05830e',
      quotedText:
        '(C) If the federal adjusted gross income of the taxpayer is equal to or greater than $65,000.00, no amount of the federally taxable benefits received under the Social Security Act shall be excluded under this section.',
    }, {
      kind: 'statute',
      citation: '32 V.S.A. §5830e(a)(2)(A)',
      url: 'https://legislature.vermont.gov/statutes/section/32/151/05830e',
      quotedText:
        '(A) If the federal adjusted gross income of the taxpayer is less than or equal to $70,000.00, all federally taxable benefits received under the Social Security Act shall be excluded.',
    }, {
      kind: 'statute',
      citation: '32 V.S.A. §5830e(a)(2)',
      url: 'https://legislature.vermont.gov/statutes/section/32/151/05830e',
      quotedText:
        '(2) For taxpayers whose filing status is married filing jointly:',
    }, {
      kind: 'statute',
      citation: '32 V.S.A. §5830e(a)(2)(B)',
      url: 'https://legislature.vermont.gov/statutes/section/32/151/05830e',
      quotedText:
        '(B) If the federal adjusted gross income of the taxpayer is greater than $70,000.00 but less than $80,000.00, the percentage of federally taxable benefits received under the Social Security Act to be excluded shall be proportional to the amount of the taxpayer’s federal adjusted gross income over $70,000.00, determined by:',
    }, {
      kind: 'statute',
      citation: '32 V.S.A. §5830e(a)(2)(C)',
      url: 'https://legislature.vermont.gov/statutes/section/32/151/05830e',
      quotedText:
        '(C) If the federal adjusted gross income of the taxpayer is equal to or greater than $80,000.00, no amount of the federally taxable benefits received under the Social Security Act shall be excluded under this section.',
    }, {
      kind: 'statute',
      citation: '32 V.S.A. §5811(21)(B)(iv)',
      url: 'https://legislature.vermont.gov/statutes/section/32/151/05811',
      quotedText:
        '(iv) the portion of certain retirement income and federally taxable benefits received under the federal Social Security Act that is required to be excluded under section 5830e of this chapter;',
    }, {
      kind: 'stateAgencyPublication',
      citation: 'Vermont Department of Taxes, Social Security Exemption',
      url: 'https://tax.vermont.gov/individuals/income-tax-returns/social-security-exemption',
      quotedText:
        'Vermont’s personal income tax exemption of Social Security benefits reduces tax liabilities mainly for lower- and middle-income Vermonters who are retired or disabled. It does this by excluding from taxable income all or part of taxable Social Security benefits reported on the federal Form 1040, U.S. Individual Income Tax Return, which are included in federal AGI.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/params/state/data/year2026.ts',
      'packages/engine/src/tax/stateTax.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/state/data/year2026.ts#VT',
      'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncome',
    ],
  },
} satisfies Record<string, TaxRuleRecord>

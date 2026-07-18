/**
 * Canonical Learning Center targets used by planner field help (V9 PR3).
 *
 * Centralizing the planner→article wiring here gives the contextual "Learn
 * more" links a single source of truth and a broken-slug test (every hook must
 * resolve to a `ready` article). Field help should reference these hooks rather
 * than inlining raw slugs, so a typo or a not-yet-written article is caught by
 * a test instead of shipping a dead link.
 *
 * Only add an entry once the target article is readable. Screen-level clusters
 * use {@link articlesForRoute} instead and need no entry here.
 */

import type { LearnHook } from '../learn/LearnLink'

export const LEARN = {
  exampleCouple: { slug: 'example-couple', label: 'Learn about this example' },
  exampleUnderSavedSingle: { slug: 'example-under-saved-single', label: 'Learn about this example' },
  exampleBracketFillRoth: { slug: 'example-bracket-fill-roth', label: 'Learn about this example' },
  exampleEarlyRetireeAca: { slug: 'example-early-retiree-aca', label: 'Learn about this example' },
  exampleRmdIrmaa: { slug: 'example-rmd-irmaa', label: 'Learn about this example' },
  exampleSurvivorYears: { slug: 'example-survivor-years', label: 'Learn about this example' },
  exampleMovingStateTax: { slug: 'example-moving-state-tax', label: 'Learn about this example' },
  exampleLtcShock: { slug: 'example-ltc-shock', label: 'Learn about this example' },
  exampleGuardrailsFlex: { slug: 'example-guardrails-flex-goals', label: 'Learn about this example' },
  exampleAnnuityEstate: { slug: 'example-annuity-purchases-estate', label: 'Learn about this example' },
  exampleGlidepathAllocation: { slug: 'example-glidepath-allocation', label: 'Learn about this example' },
  exampleHsaPropertyDepth: { slug: 'example-hsa-property-depth', label: 'Learn about this example' },
  exampleFixedTargetSpending: { slug: 'example-fixed-target-spending', label: 'Learn about this example' },
  exampleNoAnnuityBrokerage: { slug: 'example-no-annuity-brokerage', label: 'Learn about this example' },
  exampleStaticAllocationControl: { slug: 'example-static-allocation-control', label: 'Learn about this example' },
  exampleBrokerageNoHsa: { slug: 'example-brokerage-no-hsa', label: 'Learn about this example' },
  exampleAll401kNoBridge: { slug: 'example-all-401k-no-bridge', label: 'Learn about this example' },
  exampleBrokerageBridge401k: { slug: 'example-brokerage-bridge-401k', label: 'Learn about this example' },
  exampleNoHeadStartGrad: { slug: 'example-no-head-start-grad', label: 'Learn about this example' },
  exampleTrumpAccountHeadStart: { slug: 'example-trump-account-head-start', label: 'Learn about this example' },
  withdrawalOrder: { slug: 'withdrawal-order-basics', label: 'Learn about withdrawal order' },
  qcd: { slug: 'qcds-qualified-charitable-distributions', label: 'Learn about QCDs' },
  itemizedDeductions: {
    slug: 'standard-deduction-senior-deduction-and-itemizing',
    label: 'Learn: standard vs. itemized deductions',
  },
  spendingBudget: { slug: 'building-a-retirement-spending-budget', label: 'Learn about retirement spending budgets' },
  spendingProfiles: {
    slug: 'spending-profiles-and-the-retirement-smile',
    label: 'Learn about spending profiles',
  },
  survivorSpending: { slug: 'survivor-spending-in-couple-plans', label: 'Learn about survivor spending' },
  sustainableSpending: { slug: 'how-much-can-i-spend', label: 'Learn: how much can I spend?' },
  dynamicSpendingGuardrails: { slug: 'dynamic-spending-guardrails', label: 'Learn about spending flexibility' },
  riskBasedGuardrails: { slug: 'risk-based-guardrails', label: 'Learn about risk-based guardrails' },
  tipsLadders: { slug: 'tips-ladders', label: 'Learn about TIPS ladders' },
  socialSecurityBridge: { slug: 'social-security-bridge', label: 'Learn about the Social Security bridge' },
  fundedRatio: { slug: 'funded-ratio', label: 'Learn about the funded ratio' },
  healthcareBefore65: { slug: 'healthcare-before-65', label: 'Learn about healthcare before 65' },
  healthcareAfter65: { slug: 'healthcare-after-65', label: 'Learn about healthcare after 65' },
  acaCredit: { slug: 'aca-premium-tax-credits-and-magi', label: 'Learn about ACA premium credits' },
  ssa44: { slug: 'appealing-irmaa-ssa-44', label: 'Learn about SSA-44 IRMAA appeals' },
  retirementHealthcareCosts: { slug: 'what-retirement-healthcare-really-costs', label: 'Learn what healthcare really costs' },
  insuranceOverview: { slug: 'insurance-in-your-retirement-plan', label: 'Learn how insurance fits your plan' },
  permanentLife: { slug: 'permanent-life-insurance-in-a-plan', label: 'Learn about permanent life insurance' },
  ltcInsurance: { slug: 'long-term-care-insurance-as-risk-transfer', label: 'Learn about LTC insurance' },
  ltcCosts: { slug: 'long-term-care-costs-and-insurance', label: 'Learn about long-term-care costs' },
  rothConversionBasics: { slug: 'roth-conversion-basics', label: 'Learn about Roth conversions' },
  fillingTaxBracket: { slug: 'filling-a-tax-bracket-with-roth-conversions', label: 'Learn: filling a tax bracket' },
  marginalVsEffective: { slug: 'marginal-vs-effective-tax-rate', label: 'Learn: marginal vs effective rate' },
  whyConversionsRaiseCosts: {
    slug: 'why-roth-conversions-raise-other-costs',
    label: 'Learn how conversions raise other costs',
  },
  todaysDollars: { slug: 'todays-dollars-vs-future-dollars', label: "Learn: today's vs future dollars" },
  lossHarvesting: { slug: 'tax-loss-and-gain-harvesting', label: 'Learn about tax-loss harvesting' },
  fiNumber: { slug: 'fi-number-and-four-percent-rule', label: 'Learn about FI number and SWR' },
  accumulation: { slug: 'how-to-model-accumulation', label: 'Learn how to model accumulation' },
  employerMatch: { slug: 'employer-match-and-contribution-order', label: 'Learn about employer match' },
  ssTaxesVsBenefits: { slug: 'social-security-taxes-vs-benefits', label: 'Learn: Social Security taxes vs. benefits' },
  generalInflation: { slug: 'assumption-general-inflation', label: 'Learn about general inflation' },
  healthcareInflation: { slug: 'assumption-healthcare-inflation', label: 'Learn about healthcare inflation' },
  investmentReturns: { slug: 'assumption-investment-returns', label: 'Learn about investment returns' },
  ssCola: { slug: 'assumption-social-security-cola', label: 'Learn about Social Security COLA' },
  ssTrustFund: { slug: 'assumption-social-security-trust-fund', label: 'Learn about the Social Security trust fund' },
  longevity: { slug: 'assumption-longevity-planning-age', label: 'Learn about longevity planning age' },
  stateTaxOverride: { slug: 'assumption-state-tax-override', label: 'Learn about the state tax override' },
  stateIncomeTaxes: { slug: 'state-income-taxes-in-retirement', label: 'Learn about state income taxes in retirement' },
  stateRelocation: { slug: 'what-changes-when-you-move-states', label: 'Learn what changes when you move states' },
  recentMagi: { slug: 'assumption-recent-magi', label: 'Learn about recent MAGI' },
  heirTaxRate: { slug: 'assumption-heir-tax-rate', label: 'Learn about the heir tax rate' },
  optimizerObjectives: { slug: 'how-the-optimizer-thinks', label: 'Learn about optimizer objectives' },
} as const satisfies Record<string, LearnHook>

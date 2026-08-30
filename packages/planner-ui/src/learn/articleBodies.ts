/**
 * Article bodies, loaded on demand.
 *
 * Every entry is its own dynamic `import()`, so a body is fetched only when
 * its article page renders — the landing page and every `LearnLink` resolve
 * titles and slugs from ./articleIndex without pulling a single body. The map
 * is written out rather than globbed so it type-checks, and so any bundler a
 * host uses can see the graph statically.
 */

import type { ArticleBlock } from './learningRegistry'

type BodyLoader = () => Promise<ArticleBlock[] | undefined>

const BODY_LOADERS: Record<string, BodyLoader> = {
  'about-retiregolden': () => import('./content/about-retiregolden').then((m) => m.blocks),
  'how-to-read-a-retirement-projection': () => import('./content/how-to-read-a-retirement-projection').then((m) => m.blocks),
  'todays-dollars-vs-future-dollars': () => import('./content/todays-dollars-vs-future-dollars').then((m) => m.blocks),
  'what-retiregolden-models': () => import('./content/what-retiregolden-models').then((m) => m.blocks),
  'how-retiregolden-checks-its-math': () => import('./content/how-retiregolden-checks-its-math').then((m) => m.blocks),
  'reading-the-results-page': () => import('./content/reading-the-results-page').then((m) => m.blocks),
  'where-the-money-comes-from-and-goes': () => import('./content/where-the-money-comes-from-and-goes').then((m) => m.blocks),
  'understanding-monte-carlo-success-rate': () => import('./content/understanding-monte-carlo-success-rate').then((m) => m.blocks),
  'roth-conversion-basics': () => import('./content/roth-conversion-basics').then((m) => m.blocks),
  'filling-a-tax-bracket-with-roth-conversions': () => import('./content/filling-a-tax-bracket-with-roth-conversions').then((m) => m.blocks),
  'how-the-optimizer-values-after-tax-estate': () => import('./content/how-the-optimizer-values-after-tax-estate').then((m) => m.blocks),
  'marginal-vs-effective-tax-rate': () => import('./content/marginal-vs-effective-tax-rate').then((m) => m.blocks),
  'why-roth-conversions-raise-other-costs': () => import('./content/why-roth-conversions-raise-other-costs').then((m) => m.blocks),
  'social-security-claiming-age-basics': () => import('./content/social-security-claiming-age-basics').then((m) => m.blocks),
  'pia-aime-and-bend-points': () => import('./content/pia-aime-and-bend-points').then((m) => m.blocks),
  'break-even-useful-lens': () => import('./content/break-even-useful-lens').then((m) => m.blocks),
  'spousal-and-survivor-benefits': () => import('./content/spousal-and-survivor-benefits').then((m) => m.blocks),
  'ssdi-and-retirement-planning': () => import('./content/ssdi-and-retirement-planning').then((m) => m.blocks),
  'social-security-taxes-vs-benefits': () => import('./content/social-security-taxes-vs-benefits').then((m) => m.blocks),
  'earnings-test-before-fra': () => import('./content/earnings-test-before-fra').then((m) => m.blocks),
  'cola-and-inflation-protection': () => import('./content/cola-and-inflation-protection').then((m) => m.blocks),
  'divorced-spousal-and-survivor-records': () => import('./content/divorced-spousal-and-survivor-records').then((m) => m.blocks),
  'dynamic-spending-guardrails': () => import('./content/dynamic-spending-guardrails').then((m) => m.blocks),
  'risk-based-guardrails': () => import('./content/risk-based-guardrails').then((m) => m.blocks),
  'tips-ladders': () => import('./content/tips-ladders').then((m) => m.blocks),
  'social-security-bridge': () => import('./content/social-security-bridge').then((m) => m.blocks),
  'funded-ratio': () => import('./content/funded-ratio').then((m) => m.blocks),
  'building-a-retirement-spending-budget': () => import('./content/building-a-retirement-spending-budget').then((m) => m.blocks),
  'spending-profiles-and-the-retirement-smile': () => import('./content/spending-profiles-and-the-retirement-smile').then((m) => m.blocks),
  'survivor-spending-in-couple-plans': () => import('./content/survivor-spending-in-couple-plans').then((m) => m.blocks),
  'how-much-can-i-spend': () => import('./content/how-much-can-i-spend').then((m) => m.blocks),
  'trust-fund-haircut-scenarios': () => import('./content/trust-fund-haircut-scenarios').then((m) => m.blocks),
  'mortality-weighted-social-security': () => import('./content/mortality-weighted-social-security').then((m) => m.blocks),
  'irmaa-two-year-lookback': () => import('./content/irmaa-two-year-lookback').then((m) => m.blocks),
  'appealing-irmaa-ssa-44': () => import('./content/appealing-irmaa-ssa-44').then((m) => m.blocks),
  'aca-premium-tax-credits-and-magi': () => import('./content/aca-premium-tax-credits-and-magi').then((m) => m.blocks),
  'agi-magi-and-taxable-income': () => import('./content/agi-magi-and-taxable-income').then((m) => m.blocks),
  'healthcare-before-65': () => import('./content/healthcare-before-65').then((m) => m.blocks),
  'healthcare-after-65': () => import('./content/healthcare-after-65').then((m) => m.blocks),
  'what-retirement-healthcare-really-costs': () => import('./content/what-retirement-healthcare-really-costs').then((m) => m.blocks),
  'hsas-and-qualified-medical-expenses': () => import('./content/hsas-and-qualified-medical-expenses').then((m) => m.blocks),
  'long-term-care-costs-and-insurance': () => import('./content/long-term-care-costs-and-insurance').then((m) => m.blocks),
  'medicare-part-b-vs-part-d-irmaa': () => import('./content/medicare-part-b-vs-part-d-irmaa').then((m) => m.blocks),
  'withdrawal-order-basics': () => import('./content/withdrawal-order-basics').then((m) => m.blocks),
  'rmds-required-minimum-distributions': () => import('./content/rmds-required-minimum-distributions').then((m) => m.blocks),
  'qcds-qualified-charitable-distributions': () => import('./content/qcds-qualified-charitable-distributions').then((m) => m.blocks),
  'widows-penalty-and-survivor-brackets': () => import('./content/widows-penalty-and-survivor-brackets').then((m) => m.blocks),
  'paying-conversion-taxes-taxable-vs-ira': () => import('./content/paying-conversion-taxes-taxable-vs-ira').then((m) => m.blocks),
  'rule-of-55-and-72t': () => import('./content/rule-of-55-and-72t').then((m) => m.blocks),
  'inherited-ira-10-year-rule': () => import('./content/inherited-ira-10-year-rule').then((m) => m.blocks),
  'account-types-overview': () => import('./content/account-types-overview').then((m) => m.blocks),
  'traditional-vs-roth-contributions': () => import('./content/traditional-vs-roth-contributions').then((m) => m.blocks),
  'employer-match-and-contribution-order': () => import('./content/employer-match-and-contribution-order').then((m) => m.blocks),
  'hsas-as-retirement-accounts': () => import('./content/hsas-as-retirement-accounts').then((m) => m.blocks),
  'taxable-brokerage-basis-and-capital-gains': () => import('./content/taxable-brokerage-basis-and-capital-gains').then((m) => m.blocks),
  'pensions-and-annuities': () => import('./content/pensions-and-annuities').then((m) => m.blocks),
  'real-estate-home-equity-and-debt': () => import('./content/real-estate-home-equity-and-debt').then((m) => m.blocks),
  'rsus-and-espp': () => import('./content/rsus-and-espp').then((m) => m.blocks),
  'fees-expense-ratios-and-compounding-drag': () => import('./content/fees-expense-ratios-and-compounding-drag').then((m) => m.blocks),
  'long-term-care-insurance-as-risk-transfer': () => import('./content/long-term-care-insurance-as-risk-transfer').then((m) => m.blocks),
  'permanent-life-insurance-in-a-plan': () => import('./content/permanent-life-insurance-in-a-plan').then((m) => m.blocks),
  'insurance-in-your-retirement-plan': () => import('./content/insurance-in-your-retirement-plan').then((m) => m.blocks),
  'survivor-planning-for-couples': () => import('./content/survivor-planning-for-couples').then((m) => m.blocks),
  'after-tax-estate': () => import('./content/after-tax-estate').then((m) => m.blocks),
  'step-up-in-basis': () => import('./content/step-up-in-basis').then((m) => m.blocks),
  'beneficiaries-and-account-titling': () => import('./content/beneficiaries-and-account-titling').then((m) => m.blocks),
  'sequence-of-returns-risk': () => import('./content/sequence-of-returns-risk').then((m) => m.blocks),
  'what-monte-carlo-proves': () => import('./content/what-monte-carlo-proves').then((m) => m.blocks),
  'historical-vs-random-return-models': () => import('./content/historical-vs-random-return-models').then((m) => m.blocks),
  'inflation-risk': () => import('./content/inflation-risk').then((m) => m.blocks),
  'longevity-risk': () => import('./content/longevity-risk').then((m) => m.blocks),
  'three-big-questions-spending-time-risk': () => import('./content/three-big-questions-spending-time-risk').then((m) => m.blocks),
  'how-assumptions-change-the-answer': () => import('./content/how-assumptions-change-the-answer').then((m) => m.blocks),
  'planning-for-couples-and-survivor-years': () => import('./content/planning-for-couples-and-survivor-years').then((m) => m.blocks),
  'why-small-tax-cliffs-can-matter': () => import('./content/why-small-tax-cliffs-can-matter').then((m) => m.blocks),
  'planner-overview': () => import('./content/planner-overview').then((m) => m.blocks),
  'using-scenarios-to-compare-choices': () => import('./content/using-scenarios-to-compare-choices').then((m) => m.blocks),
  'reading-the-social-security-analysis-page': () => import('./content/reading-the-social-security-analysis-page').then((m) => m.blocks),
  'using-assumptions-and-provenance': () => import('./content/using-assumptions-and-provenance').then((m) => m.blocks),
  'reports-csv-exports-and-sharing': () => import('./content/reports-csv-exports-and-sharing').then((m) => m.blocks),
  'privacy-what-stays-in-your-browser': () => import('./content/privacy-what-stays-in-your-browser').then((m) => m.blocks),
  'moving-to-retiregolden': () => import('./content/moving-to-retiregolden').then((m) => m.blocks),
  'seed-your-plan-from-your-tax-return': () => import('./content/seed-your-plan-from-your-tax-return').then((m) => m.blocks),
  'troubleshooting-surprising-results': () => import('./content/troubleshooting-surprising-results').then((m) => m.blocks),
  'how-the-optimizer-thinks': () => import('./content/how-the-optimizer-thinks').then((m) => m.blocks),
  'ordinary-income-vs-capital-gains': () => import('./content/ordinary-income-vs-capital-gains').then((m) => m.blocks),
  'standard-deduction-senior-deduction-and-itemizing': () => import('./content/standard-deduction-senior-deduction-and-itemizing').then((m) => m.blocks),
  'how-social-security-is-taxed': () => import('./content/how-social-security-is-taxed').then((m) => m.blocks),
  'niit-high-income-investment-tax': () => import('./content/niit-high-income-investment-tax').then((m) => m.blocks),
  'state-income-taxes-in-retirement': () => import('./content/state-income-taxes-in-retirement').then((m) => m.blocks),
  'what-changes-when-you-move-states': () => import('./content/what-changes-when-you-move-states').then((m) => m.blocks),
  'tax-cliffs-and-bracket-edges': () => import('./content/tax-cliffs-and-bracket-edges').then((m) => m.blocks),
  'tax-loss-and-gain-harvesting': () => import('./content/tax-loss-and-gain-harvesting').then((m) => m.blocks),
  'why-95-percent-is-not-a-guarantee': () => import('./content/why-95-percent-is-not-a-guarantee').then((m) => m.blocks),
  'sensitivity-testing-what-changes-the-answer': () => import('./content/sensitivity-testing-what-changes-the-answer').then((m) => m.blocks),
  'what-is-fire': () => import('./content/what-is-fire').then((m) => m.blocks),
  'savings-rate-biggest-lever': () => import('./content/savings-rate-biggest-lever').then((m) => m.blocks),
  'fi-number-and-four-percent-rule': () => import('./content/fi-number-and-four-percent-rule').then((m) => m.blocks),
  'how-to-model-accumulation': () => import('./content/how-to-model-accumulation').then((m) => m.blocks),
  'understanding-your-plan-assumptions': () => import('./content/understanding-your-plan-assumptions').then((m) => m.blocks),
  'assumption-general-inflation': () => import('./content/assumption-general-inflation').then((m) => m.blocks),
  'assumption-healthcare-inflation': () => import('./content/assumption-healthcare-inflation').then((m) => m.blocks),
  'assumption-investment-returns': () => import('./content/assumption-investment-returns').then((m) => m.blocks),
  'assumption-social-security-cola': () => import('./content/assumption-social-security-cola').then((m) => m.blocks),
  'assumption-social-security-trust-fund': () => import('./content/assumption-social-security-trust-fund').then((m) => m.blocks),
  'assumption-longevity-planning-age': () => import('./content/assumption-longevity-planning-age').then((m) => m.blocks),
  'assumption-state-tax-override': () => import('./content/assumption-state-tax-override').then((m) => m.blocks),
  'assumption-recent-magi': () => import('./content/assumption-recent-magi').then((m) => m.blocks),
  'assumption-heir-tax-rate': () => import('./content/assumption-heir-tax-rate').then((m) => m.blocks),
  'example-couple': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-couple']),
  'example-under-saved-single': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-under-saved-single']),
  'example-bracket-fill-roth': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-bracket-fill-roth']),
  'example-early-retiree-aca': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-early-retiree-aca']),
  'example-rmd-irmaa': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-rmd-irmaa']),
  'example-inherited-ira-beneficiary': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-inherited-ira-beneficiary']),
  'example-survivor-years': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-survivor-years']),
  'example-moving-state-tax': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-moving-state-tax']),
  'example-ltc-shock': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-ltc-shock']),
  'example-early-career-match': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-early-career-match']),
  'example-aggressive-saver': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-aggressive-saver']),
  'example-coast-fire': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-coast-fire']),
  'example-barista-fire': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-barista-fire']),
  'example-bridge-early-retirement': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-bridge-early-retirement']),
  'example-lean-fat-fire': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-lean-fat-fire']),
  'example-hsa-stealth-retirement': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-hsa-stealth-retirement']),
  'example-salary-growth-escalation': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-salary-growth-escalation']),
  'example-guardrails-flex-goals': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-guardrails-flex-goals']),
  'example-annuity-purchases-estate': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-annuity-purchases-estate']),
  'example-glidepath-allocation': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-glidepath-allocation']),
  'example-hsa-property-depth': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-hsa-property-depth']),
  'example-fixed-target-spending': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-fixed-target-spending']),
  'example-no-annuity-brokerage': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-no-annuity-brokerage']),
  'example-static-allocation-control': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-static-allocation-control']),
  'example-brokerage-no-hsa': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-brokerage-no-hsa']),
  'example-all-401k-no-bridge': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-all-401k-no-bridge']),
  'example-brokerage-bridge-401k': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-brokerage-bridge-401k']),
  'example-no-head-start-grad': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-no-head-start-grad']),
  'example-trump-account-head-start': () => import('./content/examplePlanBodies').then((m) => m.EXAMPLE_PLAN_BODIES['example-trump-account-head-start']),
}

/** Slugs that have a body module, in registry order. */
export const ARTICLE_BODY_SLUGS: readonly string[] = Object.keys(BODY_LOADERS)

/** Whether `slug` has a body to render. */
export function hasArticleBody(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(BODY_LOADERS, slug)
}

/**
 * One promise per slug, so a component that reads a body during render (via
 * `use`) suspends once and resolves on the next attempt instead of starting a
 * fresh import on every render.
 */
const inFlight = new Map<string, Promise<ArticleBlock[] | undefined>>()

/** The body blocks for `slug`, or undefined when it has no body module. */
export function loadArticleBody(slug: string): Promise<ArticleBlock[] | undefined> {
  const cached = inFlight.get(slug)
  if (cached) return cached
  const loader = BODY_LOADERS[slug]
  const promise = loader ? loader() : Promise.resolve(undefined)
  inFlight.set(slug, promise)
  // Only successes are worth caching. A dropped connection mid-chunk would
  // otherwise leave the rejection in the map and rethrow it on every later
  // visit to that article, so the reader could not recover without reloading
  // the page. Dropping it means the next render issues a fresh import. The
  // identity check keeps a slower failure from evicting a newer attempt.
  void promise.catch(() => {
    if (inFlight.get(slug) === promise) inFlight.delete(slug)
  })
  return promise
}

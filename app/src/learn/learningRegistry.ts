/**
 * Learning Center registry (V9 PR1).
 *
 * Articles are authored as structured TypeScript so prose, visuals (added in
 * PR2), and metadata live together, bundle for offline use, and stay type-safe.
 * This module owns the article metadata model, the category set, the topic
 * inventory, and small selectors used by the Learning Center pages.
 */

export type LearningCategoryId =
  | 'start-here'
  | 'using-retiregolden'
  | 'example-plans'
  | 'accounts-saving'
  | 'taxes'
  | 'social-security'
  | 'healthcare'
  | 'withdrawals-roth'
  | 'risk-uncertainty'
  | 'insurance-estate'
  | 'early-investing-fire'
  | 'assumptions'
  | 'glossary'

export type ArticleStatus = 'stub' | 'draft' | 'ready' | 'needs-review'
export type ReviewCadence = 'annual' | 'rule-change' | 'stable'
export type Audience = 'beginner' | 'intermediate'
export type Priority = 'P0' | 'P1' | 'P2'

/** One variable in a {@link FormulaBlockData}: the symbol and what it means. */
export type FormulaVariable = { symbol: string; meaning: string }

/** One labelled assumption row in a {@link ScenarioBlockData}. */
export type ScenarioAssumption = { label: string; value: string }

/** A teaching figure: a registered chart or an image, with a text equivalent. */
export type FigureBlockData = {
  type: 'figure'
  /** Key into the chart registry (learn/components/charts). */
  chartId?: string
  /** Static image alternative to a chart. */
  image?: { src: string }
  /** Short descriptive caption shown under the figure. */
  caption: string
  /** Text equivalent of the figure for screen readers and no-image fallback. */
  alt: string
  /** Optional note when the figure is based on rules, data, or an assumption. */
  sourceNote?: string
}

export type FormulaBlockData = {
  type: 'formula'
  /** The formula itself, e.g. "real = nominal ÷ (1 + inflation)^years". */
  expression: string
  /** Each symbol used in the expression and its plain-language meaning. */
  where?: FormulaVariable[]
  /** Whether dollars in the formula are nominal or in today's dollars. */
  basis?: 'nominal' | 'today'
  /** What the simple formula leaves out. */
  note?: string
}

export type ScenarioBlockData = {
  type: 'scenario'
  /** A short name for the example household, e.g. "The Reyes household". */
  name: string
  assumptions: ScenarioAssumption[]
  /** Optional plain-language wrap-up of what the scenario shows. */
  summary?: string
}

export type TableBlockData = {
  type: 'table'
  caption?: string
  /** Column headers; the first column is treated as a row header. */
  columns: string[]
  /** Rows of cells, aligned to `columns`. Cells support inline markdown. */
  rows: string[][]
}

/**
 * Content blocks for a `ready` article. Text blocks render plain; the richer
 * blocks (figure, formula, scenario, table) render through dedicated components
 * in learn/components.
 */
export type ArticleBlock =
  | { type: 'prose'; md: string }
  | { type: 'heading'; text: string; level?: 2 | 3 }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'callout'; tone?: 'note' | 'warn'; md: string }
  | FigureBlockData
  | FormulaBlockData
  | ScenarioBlockData
  | TableBlockData

export type LearningArticle = {
  slug: string
  title: string
  description: string
  category: LearningCategoryId
  tags: string[]
  audience: Audience
  status: ArticleStatus
  /** ISO date (YYYY-MM-DD) the content was last reviewed. */
  lastReviewed: string
  reviewCadence: ReviewCadence
  sourceUrls: string[]
  /** Slugs of related articles. */
  relatedArticles: string[]
  /** Planner route patterns this article relates to (see KNOWN_PLANNER_ROUTES). */
  relatedPlannerRoutes: string[]
  /** True when the article leans on current-year dollar figures or rules. */
  currentYearSensitive: boolean
  priority?: Priority
  /** Surfaced in the Learning Center home "Featured" strip. */
  featured?: boolean
  /** Present once an article reaches `draft`/`ready`/`needs-review`. */
  blocks?: ArticleBlock[]
  /** When set, ArticleShell offers "Open this example in the planner". */
  exampleId?: string
}

export type LearningCategory = {
  id: LearningCategoryId
  label: string
  blurb: string
  /** Glossary is browsed via /learn/glossary rather than per-article pages. */
  isGlossary?: boolean
}

export const LEARNING_CATEGORIES: LearningCategory[] = [
  { id: 'start-here', label: 'Start Here', blurb: 'Basics, vocabulary, and how to read a retirement plan.' },
  { id: 'using-retiregolden', label: 'Using RetireGolden', blurb: 'Tool-specific workflows and screen explanations.' },
  {
    id: 'assumptions',
    label: 'Assumptions',
    blurb: 'The forward-looking defaults behind your plan — inflation, returns, longevity — and the sources for each.',
  },
  {
    id: 'example-plans',
    label: 'Example Plans',
    blurb: 'Worked example households you can open in the planner.',
  },
  {
    id: 'accounts-saving',
    label: 'Accounts and Saving',
    blurb: 'Account types, contributions, savings order, and employer match.',
  },
  { id: 'taxes', label: 'Taxes', blurb: 'Brackets, deductions, MAGI, capital gains, state tax, and cliffs.' },
  {
    id: 'social-security',
    label: 'Social Security',
    blurb: 'PIA, claiming age, spousal and survivor benefits, and break-even.',
  },
  { id: 'healthcare', label: 'Healthcare', blurb: 'ACA, Medicare, IRMAA, HSAs, and long-term-care costs.' },
  {
    id: 'withdrawals-roth',
    label: 'Withdrawals and Roth',
    blurb: 'Withdrawal order, Roth conversions, the optimizer, RMDs, and QCDs.',
  },
  {
    id: 'risk-uncertainty',
    label: 'Risk and Uncertainty',
    blurb: 'Monte Carlo, sequence risk, inflation, and longevity.',
  },
  {
    id: 'insurance-estate',
    label: 'Insurance and Estate',
    blurb: 'LTC insurance, permanent life, survivor planning, and heirs.',
  },
  {
    id: 'early-investing-fire',
    label: 'Early Investing & FIRE',
    blurb: 'Saving in your 20s–40s, savings rate, the FI number, and early-retirement strategies.',
  },
  { id: 'glossary', label: 'Glossary', blurb: 'Plain-language definitions of terms used across the app.', isGlossary: true },
]

/**
 * Planner route patterns an article may reference. Used by the registry-integrity
 * test so `relatedPlannerRoutes` cannot drift from real app routes.
 */
export const KNOWN_PLANNER_ROUTES = [
  '/',
  '/compare',
  '/import',
  '/plan/:planId/household',
  '/plan/:planId/social-security',
  '/plan/:planId/accounts',
  '/plan/:planId/insurance',
  '/plan/:planId/income',
  '/plan/:planId/income-floor',
  '/plan/:planId/spending',
  '/plan/:planId/strategy',
  '/plan/:planId/assumptions',
  '/plan/:planId/insights',
  '/plan/:planId/social-security-analysis',
  '/plan/:planId/survivor',
  '/plan/:planId/results',
  '/plan/:planId/monte-carlo',
  '/plan/:planId/scenarios',
  '/plan/:planId/relocation',
  '/plan/:planId/optimize',
  '/plan/:planId/spending-solver',
  '/plan/:planId/report',
] as const

// Articles live in ./content as pure data, keeping this module free of
// JSX/content concerns.
import { aboutRetireGoldenArticle } from './content/about-retiregolden'
import { accountTypesOverviewArticle } from './content/account-types-overview'
import { acaPremiumTaxCreditsAndMagiArticle } from './content/aca-premium-tax-credits-and-magi'
import { appealingIrmaaSsa44Article } from './content/appealing-irmaa-ssa-44'
import { afterTaxEstateArticle } from './content/after-tax-estate'
import { agiMagiAndTaxableIncomeArticle } from './content/agi-magi-and-taxable-income'
import { beneficiariesAccountTitlingArticle } from './content/beneficiaries-and-account-titling'
import { breakEvenUsefulLensArticle } from './content/break-even-useful-lens'
import { buildingRetirementSpendingBudgetArticle } from './content/building-a-retirement-spending-budget'
import { colaInflationProtectionArticle } from './content/cola-and-inflation-protection'
import { divorcedSpousalSurvivorRecordsArticle } from './content/divorced-spousal-and-survivor-records'
import { dynamicSpendingGuardrailsArticle } from './content/dynamic-spending-guardrails'
import { employerMatchAndContributionOrderArticle } from './content/employer-match-and-contribution-order'
import { earningsTestBeforeFraArticle } from './content/earnings-test-before-fra'
import { EXAMPLE_PLAN_ARTICLES } from './content/examplePlanArticles'
import { feesExpenseRatiosCompoundingDragArticle } from './content/fees-expense-ratios-and-compounding-drag'
import { fillingTaxBracketArticle } from './content/filling-a-tax-bracket-with-roth-conversions'
import { healthcareAfter65Article } from './content/healthcare-after-65'
import { healthcareBefore65Article } from './content/healthcare-before-65'
import { historicalVsRandomReturnModelsArticle } from './content/historical-vs-random-return-models'
import { howAssumptionsChangeAnswerArticle } from './content/how-assumptions-change-the-answer'
import { howMuchCanISpendArticle } from './content/how-much-can-i-spend'
import { howSocialSecurityIsTaxedArticle } from './content/how-social-security-is-taxed'
import { howTheOptimizerThinksArticle } from './content/how-the-optimizer-thinks'
import { hsasQualifiedMedicalExpensesArticle } from './content/hsas-and-qualified-medical-expenses'
import { hsasAsRetirementAccountsArticle } from './content/hsas-as-retirement-accounts'
import { optimizerAfterTaxEstateArticle } from './content/how-the-optimizer-values-after-tax-estate'
import { howToReadProjectionArticle } from './content/how-to-read-a-retirement-projection'
import { inflationRiskArticle } from './content/inflation-risk'
import { inheritedIraTenYearRuleArticle } from './content/inherited-ira-10-year-rule'
import { insuranceInYourRetirementPlanArticle } from './content/insurance-in-your-retirement-plan'
import { irmaaTwoYearLookbackArticle } from './content/irmaa-two-year-lookback'
import { longevityRiskArticle } from './content/longevity-risk'
import { longTermCareCostsInsuranceArticle } from './content/long-term-care-costs-and-insurance'
import { longTermCareInsuranceRiskTransferArticle } from './content/long-term-care-insurance-as-risk-transfer'
import { medicarePartBVsPartDIrmaaArticle } from './content/medicare-part-b-vs-part-d-irmaa'
import { mortalityWeightedSocialSecurityArticle } from './content/mortality-weighted-social-security'
import { movingToRetireGoldenArticle } from './content/moving-to-retiregolden'
import { seedYourPlanFromYourTaxReturnArticle } from './content/seed-your-plan-from-your-tax-return'
import { marginalVsEffectiveTaxRateArticle } from './content/marginal-vs-effective-tax-rate'
import { niitHighIncomeInvestmentTaxArticle } from './content/niit-high-income-investment-tax'
import { ordinaryIncomeVsCapitalGainsArticle } from './content/ordinary-income-vs-capital-gains'
import { payingConversionTaxesTaxableVsIraArticle } from './content/paying-conversion-taxes-taxable-vs-ira'
import { piaAimeBendPointsArticle } from './content/pia-aime-and-bend-points'
import { planningForCouplesAndSurvivorYearsArticle } from './content/planning-for-couples-and-survivor-years'
import { plannerOverviewArticle } from './content/planner-overview'
import { pensionsAndAnnuitiesArticle } from './content/pensions-and-annuities'
import { permanentLifeInsurancePlanArticle } from './content/permanent-life-insurance-in-a-plan'
import { privacyWhatStaysInYourBrowserArticle } from './content/privacy-what-stays-in-your-browser'
import { qcdsQualifiedCharitableDistributionsArticle } from './content/qcds-qualified-charitable-distributions'
import { readingResultsPageArticle } from './content/reading-the-results-page'
import { readingSocialSecurityAnalysisPageArticle } from './content/reading-the-social-security-analysis-page'
import { realEstateHomeEquityDebtArticle } from './content/real-estate-home-equity-and-debt'
import { reportsCsvExportsAndSharingArticle } from './content/reports-csv-exports-and-sharing'
import { fundedRatioArticle } from './content/funded-ratio'
import { riskBasedGuardrailsArticle } from './content/risk-based-guardrails'
import { socialSecurityBridgeArticle } from './content/social-security-bridge'
import { tipsLaddersArticle } from './content/tips-ladders'
import { rmdsRequiredMinimumDistributionsArticle } from './content/rmds-required-minimum-distributions'
import { rothConversionBasicsArticle } from './content/roth-conversion-basics'
import { rsusAndEsppArticle } from './content/rsus-and-espp'
import { ruleOf55And72tArticle } from './content/rule-of-55-and-72t'
import { sensitivityTestingWhatChangesAnswerArticle } from './content/sensitivity-testing-what-changes-the-answer'
import { sequenceOfReturnsRiskArticle } from './content/sequence-of-returns-risk'
import { socialSecurityClaimingAgeArticle } from './content/social-security-claiming-age-basics'
import { socialSecurityTaxesVsBenefitsArticle } from './content/social-security-taxes-vs-benefits'
import { ssdiAndRetirementPlanningArticle } from './content/ssdi-and-retirement-planning'
import { spousalSurvivorBenefitsArticle } from './content/spousal-and-survivor-benefits'
import { spendingProfilesAndRetirementSmileArticle } from './content/spending-profiles-and-the-retirement-smile'
import { standardDeductionSeniorDeductionItemizingArticle } from './content/standard-deduction-senior-deduction-and-itemizing'
import { stateIncomeTaxesRetirementArticle } from './content/state-income-taxes-in-retirement'
import { stepUpInBasisArticle } from './content/step-up-in-basis'
import { survivorPlanningForCouplesArticle } from './content/survivor-planning-for-couples'
import { survivorSpendingInCouplePlansArticle } from './content/survivor-spending-in-couple-plans'
import { taxableBrokerageBasisAndCapitalGainsArticle } from './content/taxable-brokerage-basis-and-capital-gains'
import { taxCliffsBracketEdgesArticle } from './content/tax-cliffs-and-bracket-edges'
import { taxLossGainHarvestingArticle } from './content/tax-loss-and-gain-harvesting'
import { threeBigQuestionsSpendingTimeRiskArticle } from './content/three-big-questions-spending-time-risk'
import { todaysDollarsArticle } from './content/todays-dollars-vs-future-dollars'
import { traditionalVsRothContributionsArticle } from './content/traditional-vs-roth-contributions'
import { troubleshootingSurprisingResultsArticle } from './content/troubleshooting-surprising-results'
import { trustFundHaircutScenariosArticle } from './content/trust-fund-haircut-scenarios'
import { understandingMonteCarloArticle } from './content/understanding-monte-carlo-success-rate'
import { usingAssumptionsAndProvenanceArticle } from './content/using-assumptions-and-provenance'
import { usingScenariosToCompareChoicesArticle } from './content/using-scenarios-to-compare-choices'
import { whatChangesWhenYouMoveStatesArticle } from './content/what-changes-when-you-move-states'
import { widowsPenaltyAndSurvivorBracketsArticle } from './content/widows-penalty-and-survivor-brackets'
import { whatRetireGoldenModelsArticle } from './content/what-retiregolden-models'
import { whatMonteCarloProvesArticle } from './content/what-monte-carlo-proves'
import { whatRetirementHealthcareReallyCostsArticle } from './content/what-retirement-healthcare-really-costs'
import { withdrawalOrderBasicsArticle } from './content/withdrawal-order-basics'
import { why95PercentIsNotGuaranteeArticle } from './content/why-95-percent-is-not-a-guarantee'
import { rothConversionsRaiseOtherCostsArticle } from './content/why-roth-conversions-raise-other-costs'
import { whySmallTaxCliffsCanMatterArticle } from './content/why-small-tax-cliffs-can-matter'
import { whatIsFireArticle } from './content/what-is-fire'
import { savingsRateBiggestLeverArticle } from './content/savings-rate-biggest-lever'
import { fiNumberAndFourPercentRuleArticle } from './content/fi-number-and-four-percent-rule'
import { howToModelAccumulationArticle } from './content/how-to-model-accumulation'
import { understandingYourPlanAssumptionsArticle } from './content/understanding-your-plan-assumptions'
import { assumptionGeneralInflationArticle } from './content/assumption-general-inflation'
import { assumptionHealthcareInflationArticle } from './content/assumption-healthcare-inflation'
import { assumptionInvestmentReturnsArticle } from './content/assumption-investment-returns'
import { assumptionSocialSecurityColaArticle } from './content/assumption-social-security-cola'
import { assumptionSocialSecurityTrustFundArticle } from './content/assumption-social-security-trust-fund'
import { assumptionLongevityPlanningAgeArticle } from './content/assumption-longevity-planning-age'
import { assumptionStateTaxOverrideArticle } from './content/assumption-state-tax-override'
import { assumptionRecentMagiArticle } from './content/assumption-recent-magi'
import { assumptionHeirTaxRateArticle } from './content/assumption-heir-tax-rate'

/** Every article in registry order. */
export const LEARNING_ARTICLES: LearningArticle[] = [
  aboutRetireGoldenArticle,
  howToReadProjectionArticle,
  todaysDollarsArticle,
  whatRetireGoldenModelsArticle,
  readingResultsPageArticle,
  understandingMonteCarloArticle,
  rothConversionBasicsArticle,
  fillingTaxBracketArticle,
  optimizerAfterTaxEstateArticle,
  marginalVsEffectiveTaxRateArticle,
  rothConversionsRaiseOtherCostsArticle,
  socialSecurityClaimingAgeArticle,
  piaAimeBendPointsArticle,
  breakEvenUsefulLensArticle,
  spousalSurvivorBenefitsArticle,
  ssdiAndRetirementPlanningArticle,
  socialSecurityTaxesVsBenefitsArticle,
  earningsTestBeforeFraArticle,
  colaInflationProtectionArticle,
  divorcedSpousalSurvivorRecordsArticle,
  dynamicSpendingGuardrailsArticle,
  riskBasedGuardrailsArticle,
  tipsLaddersArticle,
  socialSecurityBridgeArticle,
  fundedRatioArticle,
  buildingRetirementSpendingBudgetArticle,
  spendingProfilesAndRetirementSmileArticle,
  survivorSpendingInCouplePlansArticle,
  howMuchCanISpendArticle,
  trustFundHaircutScenariosArticle,
  mortalityWeightedSocialSecurityArticle,
  irmaaTwoYearLookbackArticle,
  appealingIrmaaSsa44Article,
  acaPremiumTaxCreditsAndMagiArticle,
  agiMagiAndTaxableIncomeArticle,
  healthcareBefore65Article,
  healthcareAfter65Article,
  whatRetirementHealthcareReallyCostsArticle,
  hsasQualifiedMedicalExpensesArticle,
  longTermCareCostsInsuranceArticle,
  medicarePartBVsPartDIrmaaArticle,
  withdrawalOrderBasicsArticle,
  rmdsRequiredMinimumDistributionsArticle,
  qcdsQualifiedCharitableDistributionsArticle,
  widowsPenaltyAndSurvivorBracketsArticle,
  payingConversionTaxesTaxableVsIraArticle,
  ruleOf55And72tArticle,
  inheritedIraTenYearRuleArticle,
  accountTypesOverviewArticle,
  traditionalVsRothContributionsArticle,
  employerMatchAndContributionOrderArticle,
  hsasAsRetirementAccountsArticle,
  taxableBrokerageBasisAndCapitalGainsArticle,
  pensionsAndAnnuitiesArticle,
  realEstateHomeEquityDebtArticle,
  rsusAndEsppArticle,
  feesExpenseRatiosCompoundingDragArticle,
  longTermCareInsuranceRiskTransferArticle,
  permanentLifeInsurancePlanArticle,
  insuranceInYourRetirementPlanArticle,
  survivorPlanningForCouplesArticle,
  afterTaxEstateArticle,
  stepUpInBasisArticle,
  beneficiariesAccountTitlingArticle,
  sequenceOfReturnsRiskArticle,
  whatMonteCarloProvesArticle,
  historicalVsRandomReturnModelsArticle,
  inflationRiskArticle,
  longevityRiskArticle,
  threeBigQuestionsSpendingTimeRiskArticle,
  howAssumptionsChangeAnswerArticle,
  planningForCouplesAndSurvivorYearsArticle,
  whySmallTaxCliffsCanMatterArticle,
  plannerOverviewArticle,
  usingScenariosToCompareChoicesArticle,
  readingSocialSecurityAnalysisPageArticle,
  usingAssumptionsAndProvenanceArticle,
  reportsCsvExportsAndSharingArticle,
  privacyWhatStaysInYourBrowserArticle,
  movingToRetireGoldenArticle,
  seedYourPlanFromYourTaxReturnArticle,
  troubleshootingSurprisingResultsArticle,
  howTheOptimizerThinksArticle,
  ordinaryIncomeVsCapitalGainsArticle,
  standardDeductionSeniorDeductionItemizingArticle,
  howSocialSecurityIsTaxedArticle,
  niitHighIncomeInvestmentTaxArticle,
  stateIncomeTaxesRetirementArticle,
  whatChangesWhenYouMoveStatesArticle,
  taxCliffsBracketEdgesArticle,
  taxLossGainHarvestingArticle,
  why95PercentIsNotGuaranteeArticle,
  sensitivityTestingWhatChangesAnswerArticle,
  whatIsFireArticle,
  savingsRateBiggestLeverArticle,
  fiNumberAndFourPercentRuleArticle,
  howToModelAccumulationArticle,
  understandingYourPlanAssumptionsArticle,
  assumptionGeneralInflationArticle,
  assumptionHealthcareInflationArticle,
  assumptionInvestmentReturnsArticle,
  assumptionSocialSecurityColaArticle,
  assumptionSocialSecurityTrustFundArticle,
  assumptionLongevityPlanningAgeArticle,
  assumptionStateTaxOverrideArticle,
  assumptionRecentMagiArticle,
  assumptionHeirTaxRateArticle,
  ...EXAMPLE_PLAN_ARTICLES,
]

const ARTICLES_BY_SLUG = new Map(LEARNING_ARTICLES.map((a) => [a.slug, a]))

export function getArticle(slug: string): LearningArticle | undefined {
  return ARTICLES_BY_SLUG.get(slug)
}

/** An article is browsable as its own page only once it has real content. */
export function isReadable(article: LearningArticle): boolean {
  return article.status === 'ready' && (article.blocks?.length ?? 0) > 0
}

export function getCategory(id: LearningCategoryId): LearningCategory | undefined {
  return LEARNING_CATEGORIES.find((c) => c.id === id)
}

export function articlesInCategory(id: LearningCategoryId): LearningArticle[] {
  return LEARNING_ARTICLES.filter((a) => a.category === id)
}

/**
 * Readable articles that relate to a planner route, for contextual "Learn about
 * this screen" links. Derived from each article's `relatedPlannerRoutes` so the
 * planner↔article wiring has a single source of truth and a screen's links
 * light up automatically as content lands. Stubs are excluded so a contextual
 * link never dead-ends on a "Planned article" placeholder.
 */
export function articlesForRoute(routePattern: string): LearningArticle[] {
  return LEARNING_ARTICLES.filter((a) => isReadable(a) && a.relatedPlannerRoutes.includes(routePattern))
}

/** Non-glossary categories paired with their article counts, for the home grid. */
export function categorySummaries(): Array<{ category: LearningCategory; count: number }> {
  return LEARNING_CATEGORIES.filter((c) => !c.isGlossary).map((category) => ({
    category,
    count: articlesInCategory(category.id).length,
  }))
}

export function featuredArticles(): LearningArticle[] {
  return LEARNING_ARTICLES.filter((a) => a.featured)
}

/** Readable articles, most recently reviewed first. */
export function recentlyReviewed(limit = 5): LearningArticle[] {
  return LEARNING_ARTICLES.filter(isReadable)
    .slice()
    .sort((a, b) => b.lastReviewed.localeCompare(a.lastReviewed))
    .slice(0, limit)
}

const PRIORITY_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 }

/** Sort for listing: readable first, then by priority, then alphabetically. */
export function byListingOrder(a: LearningArticle, b: LearningArticle): number {
  const ra = isReadable(a) ? 0 : 1
  const rb = isReadable(b) ? 0 : 1
  if (ra !== rb) return ra - rb
  const pa = a.priority ? PRIORITY_ORDER[a.priority] : 3
  const pb = b.priority ? PRIORITY_ORDER[b.priority] : 3
  if (pa !== pb) return pa - pb
  return a.title.localeCompare(b.title)
}

/** Case-insensitive search across title, description, and tags. */
export function searchArticles(query: string): LearningArticle[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return LEARNING_ARTICLES.filter((a) => {
    const haystack = [a.title, a.description, ...a.tags].join(' ').toLowerCase()
    return haystack.includes(q)
  }).sort(byListingOrder)
}

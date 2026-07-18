import type { LearningArticle, LearningCategoryId, ArticleBlock, ReviewCadence, ScenarioAssumption } from '../learningRegistry'

function exampleArticle(
  slug: string,
  title: string,
  description: string,
  exampleId: string,
  teaches: string,
  lookFor: string,
  relatedArticles: string[],
  relatedPlannerRoutes: string[],
  category: LearningCategoryId = 'example-plans',
  scenario?: { name: string; assumptions: ScenarioAssumption[]; summary?: string },
  extras?: {
    /** Extra blocks rendered after "The Basic Idea" (rules tables, callouts, …). */
    blocks?: ArticleBlock[]
    sourceUrls?: string[]
    lastReviewed?: string
    reviewCadence?: ReviewCadence
    currentYearSensitive?: boolean
  },
): LearningArticle {
  const blocks: ArticleBlock[] = [
    { type: 'heading', text: 'Quick Takeaways' },
    {
      type: 'list',
      items: [
        'Open the linked example in the planner to explore with live numbers.',
        'Edit freely — the demo stays out of Your plans until you save it.',
        lookFor,
      ],
    },
  ]

  if (scenario) {
    blocks.push(
      { type: 'heading', text: 'The Household' },
      {
        type: 'scenario',
        name: scenario.name,
        assumptions: scenario.assumptions,
        summary: scenario.summary,
      }
    )
  }

  blocks.push(
    { type: 'heading', text: 'The Basic Idea' },
    {
      type: 'prose',
      md: teaches,
    },
    ...(extras?.blocks ?? []),
    { type: 'heading', text: 'Why It Matters In RetireGolden' },
    {
      type: 'prose',
      md: `This example highlights specific modeling capabilities added in recent enhancements. Use it to see how the feature changes outcomes in Results, Monte Carlo, or the optimizer.`,
    },
    { type: 'heading', text: 'What to Look For' },
    {
      type: 'prose',
      md: `Use **Results** for the year-by-year ledger, then **Scenarios**, **Monte Carlo**, or **Optimize** to stress-test the story. The example is a teaching household, not a recommendation for your situation.`,
    },
    { type: 'heading', text: 'Common Mistakes' },
    {
      type: 'list',
      items: [
        'Do not copy the household numbers directly; use the example to learn which inputs matter.',
        'Check assumptions before comparing outcomes, especially returns, inflation, healthcare, and tax settings.',
        'Treat the scenario as an educational model, not as personal tax, investment, or insurance advice.',
      ],
    }
  )

  return {
    slug,
    title,
    description,
    category,
    tags: ['example-plan', 'worked example', 'planner', 'fire'],
    audience: 'beginner',
    status: 'ready',
    lastReviewed: extras?.lastReviewed ?? '2026-07-07',
    reviewCadence: extras?.reviewCadence ?? 'stable',
    sourceUrls: extras?.sourceUrls ?? [],
    relatedArticles,
    relatedPlannerRoutes,
    currentYearSensitive: extras?.currentYearSensitive ?? false,
    priority: 'P1',
    exampleId,
    blocks,
  }
}

export const exampleCoupleArticle = exampleArticle(
  'example-couple',
  'Example couple: the full retirement picture',
  'A married household two years from retirement — accounts, Social Security, Roth strategy, insurance, and scenarios.',
  'example-couple',
  'This is RetireGolden\'s flagship teaching household: diversified accounts, pre-retirement wages, a fill-to-bracket Roth strategy, LTC policies, and side scenarios for a Social Security haircut and higher spending.',
  'Watch Roth conversions in Strategy, then trace RMDs, taxes, and ending balances in Results.',
  ['planner-overview', 'roth-conversion-basics', 'long-term-care-insurance-as-risk-transfer'],
  ['/plan/:planId/results', '/plan/:planId/strategy', '/plan/:planId/scenarios'],
)

export const exampleUnderSavedSingleArticle = exampleArticle(
  'example-under-saved-single',
  'Under-saved single retiree',
  'When modest savings meet steady spending — depletion year and shortfall warnings.',
  'under-saved-single',
  'Jordan is a single retiree with consulting income, Social Security at 67, and spending that outpaces investable assets over time. The lesson is not pessimism — it is seeing *when* the plan runs out and what still funds cash flow.',
  'Find the depletion year on Results and compare withdrawals from cash, taxable, and traditional accounts.',
  ['how-to-read-a-retirement-projection', 'reading-the-results-page', 'three-big-questions-spending-time-risk'],
  ['/plan/:planId/results', '/plan/:planId/spending'],
)

export const exampleBracketFillRothArticle = exampleArticle(
  'example-bracket-fill-roth',
  'Bracket-fill Roth conversions',
  'Converting up to a tax bracket top while RMDs and QCDs interact.',
  'bracket-fill-roth',
  'Morgan and Riley are retired with large traditional IRAs, Social Security, and a strategy to fill the 22% bracket with Roth conversions. QCDs offset part of the RMD tax bite.',
  'Compare lifetime tax vs ending Roth balance — and watch conversion amounts year by year.',
  ['filling-a-tax-bracket-with-roth-conversions', 'rmds-required-minimum-distributions', 'qcds-qualified-charitable-distributions'],
  ['/plan/:planId/strategy', '/plan/:planId/results'],
)

export const exampleEarlyRetireeAcaArticle = exampleArticle(
  'example-early-retiree-aca',
  'Early retiree and the ACA cliff',
  'Pre-65 healthcare premiums driven by MAGI — and why conversions have a hidden cost.',
  'early-retiree-aca',
  'Casey retired before Medicare with marketplace coverage and ACA credits. Consulting income and Roth conversions both flow into MAGI, which can push premiums over the subsidy cliff.',
  'Read healthcare expense lines before 65 and any ACA cliff warnings on Results.',
  ['aca-premium-tax-credits-and-magi', 'healthcare-before-65', 'why-roth-conversions-raise-other-costs'],
  ['/plan/:planId/spending', '/plan/:planId/results', '/plan/:planId/strategy'],
)

export const exampleRmdIrmaaArticle = exampleArticle(
  'example-rmd-irmaa',
  'High balances: RMDs and IRMAA',
  'Large traditional balances, required distributions, and Medicare surcharges.',
  'rmd-irmaa',
  'Dana has a very large IRA entering RMD years. Required withdrawals boost MAGI, which can interact with IRMAA tiers on Medicare premiums. QCDs provide partial relief.',
  'Trace RMD and QCD columns, then Medicare-related healthcare costs after 65.',
  ['rmds-required-minimum-distributions', 'irmaa-two-year-lookback', 'qcds-qualified-charitable-distributions'],
  ['/plan/:planId/results', '/plan/:planId/accounts'],
)

export const exampleSurvivorYearsArticle = exampleArticle(
  'example-survivor-years',
  'Survivor years and the widow\'s penalty',
  'Unequal Social Security, a pension with survivor benefits, and higher taxes after the first death.',
  'survivor-years',
  'Lee and Chris have unequal Social Security and a pension that pays a survivor benefit. When Chris\'s planning age ends first, Lee steps into survivor benefits and single tax brackets — taxes can rise even as total income falls.',
  'Compare tax and Social Security in the last joint year vs the first survivor year.',
  ['widows-penalty-and-survivor-brackets', 'spousal-and-survivor-benefits', 'planning-for-couples-and-survivor-years'],
  ['/plan/:planId/household', '/plan/:planId/results', '/plan/:planId/social-security-analysis'],
)

export const exampleMovingStateTaxArticle = exampleArticle(
  'example-moving-state-tax',
  'Moving in retirement (state tax)',
  'Mid-plan relocation from Florida to Kentucky changes lifetime tax.',
  'moving-state-tax',
  'Avery earns consulting income while living in Florida, then relocates to Kentucky. Federal tax is unchanged, but modeled state tax adds a new layer — compare the base plan to the built-in scenarios.',
  'Open Scenarios and compare lifetime tax when the move happens sooner vs later.',
  ['state-income-taxes-in-retirement', 'using-scenarios-to-compare-choices'],
  ['/plan/:planId/household', '/plan/:planId/scenarios'],
)

export const exampleLtcShockArticle = exampleArticle(
  'example-ltc-shock',
  'Long-term-care shock',
  'A multi-year care episode and how LTC insurance offsets the hit.',
  'ltc-shock',
  'Quinn faces a care episode in late life. Without insurance, the shock drains cash quickly; with an LTC policy, benefits and premiums change the ending estate picture.',
  'Inspect care-event years on Results and Insurance for premium vs benefit flow.',
  ['long-term-care-insurance-as-risk-transfer', 'long-term-care-costs-and-insurance', 'permanent-life-insurance-in-a-plan'],
  ['/plan/:planId/insurance', '/plan/:planId/results'],
)

export const exampleEarlyCareerMatchArticle = exampleArticle(
  'example-early-career-match',
  'Just getting started (Alex)',
  'Young professional capturing employer match and building basic tax-diversified savings.',
  'early-career-match',
  'Alex is starting their career with $65,000 in wages growing at 3% real annually. By contributing $6,000 to their employer 401(k) and capturing the 4% match, plus contributing $3,000 to a Roth IRA, they compound early momentum.',
  'Verify the employerMatch amount on the Results page and watch wages increase by the raise rate.',
  ['what-is-fire', 'savings-rate-biggest-lever'],
  ['/plan/:planId/income', '/plan/:planId/accounts', '/plan/:planId/results'],
  'early-investing-fire',
)

export const exampleAggressiveSaverArticle = exampleArticle(
  'example-aggressive-saver',
  'Aggressive saver to early retirement (Taylor)',
  'A high savings rate and time-phased contribution schedules support retirement in 15 years.',
  'aggressive-saver',
  'Taylor saves 50% of their gross wages. By maxing out pre-tax and Roth options and scheduling aggressive taxable contributions, they build a portfolio to support their retirement expenses.',
  'Open Results to inspect the savings rate, FI Target, and the year they cross the FI threshold.',
  ['what-is-fire', 'savings-rate-biggest-lever', 'fi-number-and-four-percent-rule'],
  ['/plan/:planId/results', '/plan/:planId/accounts'],
  'early-investing-fire',
)

export const exampleCoastFireArticle = exampleArticle(
  'example-coast-fire',
  'Coast FIRE (Morgan)',
  'Morgan front-loads contributions during their 30s and coasts without saving until retirement.',
  'coast-fire',
  'Morgan contributes heavily until age 40, then completely stops active savings. Compounding growth carries their portfolio the rest of the way to a full retirement at age 60.',
  'Open Accounts to check the contribution schedule, and Results to see when traditional IRA coasts to goal.',
  ['what-is-fire', 'fi-number-and-four-percent-rule'],
  ['/plan/:planId/accounts', '/plan/:planId/results'],
  'early-investing-fire',
)

export const exampleBaristaFireArticle = exampleArticle(
  'example-barista-fire',
  'Barista FIRE (Robin)',
  'Robin leaves their primary career at age 40 and uses part-time income and ACA credits to bridge to age 65.',
  'barista-fire',
  'Robin transitions from a high-paying job to a $35,000 part-time barista job at age 40 and trims baseline spending. The part-time work covers much of the gap so the portfolio can keep compounding instead of carrying the whole bridge alone.',
  'Open Income to see the barista stream, and Results to track the ACA premium tax credits.',
  ['what-is-fire', 'aca-premium-tax-credits-and-magi'],
  ['/plan/:planId/income', '/plan/:planId/results'],
  'early-investing-fire',
)

export const exampleBridgeEarlyRetirementArticle = exampleArticle(
  'example-bridge-early-retirement',
  'Bridge to 59½ (Jordan\'s SEPP)',
  'Jordan retires at 45 and accesses traditional retirement balances penalty-free using 72(t) payments.',
  'bridge-early-retirement',
  'Jordan retires early and sets up a Substantially Equal Periodic Payment (SEPP) series from their traditional IRA. This unlocks early cash flow without the 10% penalty.',
  'Check the SEPP column in Results and traditional account balance drawdown starting at age 45.',
  ['rule-of-55-and-72t', 'withdrawal-order-basics'],
  ['/plan/:planId/results', '/plan/:planId/accounts'],
  'early-investing-fire',
)

export const exampleLeanFatFireArticle = exampleArticle(
  'example-lean-fat-fire',
  'Lean vs. Fat FIRE (Jessie)',
  'Comparing minimalist early retirement against a higher-spending lifestyle side-by-side.',
  'lean-fat-fire',
  'Jessie compares a baseline $45,000 early retirement budget against a $80,000 Fat FIRE lifestyle scenario, modeling the impact on assets and FI date.',
  'Open Scenarios to compare the base plan against the Fat FIRE scenario side-by-side.',
  ['what-is-fire', 'fi-number-and-four-percent-rule'],
  ['/plan/:planId/scenarios', '/plan/:planId/results'],
  'early-investing-fire',
)

export const exampleHsaStealthRetirementArticle = exampleArticle(
  'example-hsa-stealth-retirement',
  'Stealth HSA Retirement (Chris)',
  ' Chris maxes out and invests HSA contributions to form a powerful healthcare bridge.',
  'hsa-stealth-retirement',
  'Chris uses a triple-tax-advantaged HSA to build health savings. By maxing out contributions and keeping the balance invested, the HSA serves as a key bridge asset.',
  'Check the HSA contributions and final balance on the Accounts page.',
  ['hsas-as-retirement-accounts', 'hsas-and-qualified-medical-expenses'],
  ['/plan/:planId/accounts', '/plan/:planId/results'],
  'early-investing-fire',
)

export const exampleSalaryGrowthEscalationArticle = exampleArticle(
  'example-salary-growth-escalation',
  'Salary growth and escalation (Dana)',
  'Dana uses wage growth raises and auto-escalating savings schedules to accelerate FI.',
  'salary-growth-escalation',
  'Dana combines a 3% real wage raise rate with an annual 3% escalation on her 401(k) and brokerage contributions to reach FI much earlier.',
  'Trace wage raises in Income and watch the annual escalation of savings in Results.',
  ['how-to-model-accumulation', 'savings-rate-biggest-lever'],
  ['/plan/:planId/income', '/plan/:planId/accounts', '/plan/:planId/results'],
  'early-investing-fire',
)

export const exampleGuardrailsFlexArticle = exampleArticle(
  'example-guardrails-flex-goals',
  'Guardrails and flexible goals (Riley)',
  'Riley uses spending guardrails to protect a required floor while allowing adaptive flexible goals and discretionary layers.',
  'guardrails-flex-goals',
  `Riley plans on $58,000 of annual spending in today's dollars.

She sets a required floor of $34,000 that must be protected no matter what the markets do. The remaining spending is discretionary and can be cut or increased.

When markets are poor, the guardrails automatically reduce flexible spending to protect the floor. In strong markets, spending can recover.

One-time goals can be marked required, target, ideal, or excess, and some are allowed to move or be skipped.`,
  'Watch guardrailAction and guardrailFactor columns in Results, the split between requiredShortfall and targetShortfall, and the layered success rates in Monte Carlo.',
  ['dynamic-spending-guardrails', 'how-much-can-i-spend'],
  ['/plan/:planId/spending', '/plan/:planId/results', '/plan/:planId/monte-carlo'],
  'example-plans',
  {
    name: 'The Riley household',
    assumptions: [
      { label: 'Filing status', value: 'Single' },
      { label: 'Retirement age', value: '62' },
      { label: 'Base spending', value: '$58,000 (today\'s dollars)' },
      { label: 'Required floor', value: '$34,000' },
      { label: 'Spending policy', value: 'Withdrawal-rate guardrails (125% upper)' },
      { label: 'Key goals', value: 'Roof (required), trip (movable target), gift (skippable ideal)' },
      { label: 'Investable starting balance', value: '~$505,000' },
    ],
    summary: 'Shows how guardrails protect the must-fund layer while allowing flexible spending and goals to adjust.',
  }
)

export const exampleAnnuityEstateArticle = exampleArticle(
  'example-annuity-purchases-estate',
  'Annuity purchases and estate beneficiaries (Jordan & Taylor)',
  'Couple buys SPIA and QLAC contracts and designates per-account estate beneficiaries to optimize survivor and charitable outcomes.',
  'annuity-purchases-estate',
  `Jordan and Taylor have substantial traditional IRA balances and want more guaranteed lifetime income.

They use part of their savings to purchase a SPIA (non-qualified, cash-funded) that begins payments at 66 and a QLAC (qualified, traditional-funded) that starts at 80.

The QLAC premium is excluded from future RMD calculations up to the limit.

Each account has its own beneficiary designation: some go to the surviving spouse (rollover treatment), others to charity (untaxed), and some to non-spouse heirs (with tax).`,
  'Look at the annuity income streams and purchase cash flows in Results, the reduced RMDs from the QLAC, and how the after-tax estate changes based on the beneficiary choices.',
  ['after-tax-estate', 'account-types-overview'],
  ['/plan/:planId/accounts', '/plan/:planId/results', '/plan/:planId/optimize'],
  'example-plans',
  {
    name: 'The Jordan & Taylor household',
    assumptions: [
      { label: 'Filing status', value: 'Married Filing Jointly' },
      { label: 'SPIA purchase', value: '$220,000 at age 66 (non-qualified)' },
      { label: 'QLAC purchase', value: '$135,000 at age 65 (qualified, deferred)' },
      { label: 'Beneficiary setup', value: 'Mixed: spouse rollover, charity, non-spouse' },
      { label: 'Key goal', value: 'Secure lifetime income + control estate tax treatment' },
    ],
    summary: 'Illustrates trading liquidity for guaranteed income and using per-account beneficiaries to shape the after-tax estate.',
  }
)

export const exampleGlidepathAllocationArticle = exampleArticle(
  'example-glidepath-allocation',
  'Glidepath allocation and rebalancing (Morgan)',
  'Morgan runs a 4-class glidepath allocation across accounts with rebalancing and class-level taxable drag.',
  'glidepath-allocation',
  `Morgan holds accounts in taxable, traditional, and Roth wrappers.

Instead of a single expected return on each account, he assigns target weights to four asset classes: US stocks, international stocks, bonds, and cash.

A linear glidepath gradually shifts the taxable account from aggressive (70% stocks) to conservative (30% stocks) over 12 years. Rebalancing happens annually.

In the taxable account, bonds generate more interest (taxed every year) while stocks generate qualified dividends and growth. Monte Carlo now applies correlated shocks to the classes rather than a single return.`,
  'Edit the allocation policy on each account and watch the target weights change over time. Run Monte Carlo with and without the allocation to compare downside percentiles and frontiers.',
  ['assumption-investment-returns', 'reading-the-results-page'],
  ['/plan/:planId/accounts', '/plan/:planId/assumptions', '/plan/:planId/monte-carlo', '/plan/:planId/insights'],
  'example-plans',
  {
    name: 'The Morgan household',
    assumptions: [
      { label: 'Filing status', value: 'Single' },
      { label: 'Taxable allocation', value: 'Linear glide 70/30 stocks → 30/70 over 12 years, annual rebalance' },
      { label: 'Traditional 401(k)', value: 'Staged allocation, starts aggressive' },
      { label: 'Roth', value: 'Static 50/50 stocks/bonds' },
      { label: 'Starting investable', value: '~$1.465M across accounts' },
    ],
    summary: 'Demonstrates moving from single-return assumptions to class-based allocation, glidepaths, rebalancing, and class-aware Monte Carlo.',
  }
)

export const exampleHsaPropertyDepthArticle = exampleArticle(
  'example-hsa-property-depth',
  'HSA medical sub-ledger and home sale (Harper)',
  'Harper uses an HSA with explicit medical cap + reimburse-later plus a primary residence sale with basis, selling costs, and §121 treatment.',
  'hsa-property-depth',
  `Harper contributes the maximum to an HSA and invests it for growth.

She sets the HSA to cap qualified medical withdrawals by actual modeled healthcare costs plus any accumulated "reimburse later" balance.

A primary residence with a low cost basis is scheduled for sale in 7 years. The plan tracks the §121 exclusion, selling costs, and a small amount of depreciation recapture.

A traditional IRA holds nondeductible basis that will affect the taxable portion of any conversions or withdrawals.`,
  'Look at the HSA withdrawal treatment fields, the qualified vs taxable split on HSA distributions, the exact gain calculation on the home sale, and the pro-rata impact on IRA conversions.',
  ['hsas-as-retirement-accounts', 'hsas-and-qualified-medical-expenses', 'account-types-overview'],
  ['/plan/:planId/accounts', '/plan/:planId/results'],
  'example-plans',
  {
    name: 'The Harper household',
    assumptions: [
      { label: 'Filing status', value: 'Single' },
      { label: 'HSA balance + contribs', value: '$48,000 initial + $4,150/year, invested' },
      { label: 'HSA treatment', value: 'Cap by medical expenses + reimburse-later enabled' },
      { label: 'Home sale', value: '$385k value, $172k basis, 6% costs, primary residence + recapture' },
      { label: 'Traditional IRA basis', value: '$68,000 nondeductible' },
    ],
    summary: 'Shows precise HSA qualified withdrawal limits and accurate tax treatment on a primary residence sale.',
  }
)

export const exampleFixedTargetSpendingArticle = exampleArticle(
  'example-fixed-target-spending',
  'Fixed target spending control (Riley)',
  'Classic fixed spending control — identical balances and lifestyle target to the guardrails example but without any required floor or dynamic policy.',
  'fixed-target-spending',
  `This is the identical Riley household and spending target as the guardrails version, but with no required floor and no guardrail policy.

All spending is treated as a single target. In bad markets the full amount is at risk.

Compare this plan directly with the guardrails version using the Compare feature to isolate the effect of the spending policy.`,
  'Open both examples, then use Compare Plans and look at Monte Carlo success rates (overall vs any required floor distinction) and when each version depletes.',
  ['dynamic-spending-guardrails'],
  ['/plan/:planId/spending', '/plan/:planId/results', '/plan/:planId/monte-carlo'],
  'example-plans',
  {
    name: 'The Riley household (fixed target version)',
    assumptions: [
      { label: 'Filing status', value: 'Single' },
      { label: 'Retirement age', value: '62' },
      { label: 'Base spending', value: '$58,000 (today\'s dollars)' },
      { label: 'Spending policy', value: 'Fixed target (no guardrails)' },
      { label: 'Key difference', value: 'No required floor; full spending at risk' },
    ],
    summary: 'Control case for the guardrails example. Same starting point, classic all-or-nothing spending target.',
  }
)

export const exampleNoAnnuityBrokerageArticle = exampleArticle(
  'example-no-annuity-brokerage',
  'Brokerage only control (Jordan & Taylor)',
  'Same household and capital as the annuity example, except the money stays in cash/traditional instead of purchasing SPIA and QLAC.',
  'no-annuity-brokerage',
  `This is the identical Jordan & Taylor household, but the $355,000 that would have purchased the SPIA and QLAC remains invested in cash and traditional accounts.

They keep full liquidity and control over the capital, but have no guaranteed lifetime income streams from the annuities.

Compare this version side-by-side with the annuity-purchases example to see the trade-off between liquidity and income security plus estate effects.`,
  'Compare the two plans in Results (income streams and RMDs) and in the estate metric. Note the higher early balances but lack of annuity income.',
  ['after-tax-estate'],
  ['/plan/:planId/accounts', '/plan/:planId/results'],
  'example-plans',
  {
    name: 'The Jordan & Taylor household (no annuity version)',
    assumptions: [
      { label: 'Filing status', value: 'Married Filing Jointly' },
      { label: 'Key difference', value: 'Annuity premium money kept in cash + traditional' },
      { label: 'Cash balance', value: 'Higher by $220k vs annuity version' },
      { label: 'Traditional balance', value: 'Higher by $135k vs annuity version' },
      { label: 'Guaranteed income', value: 'None from purchased annuities' },
    ],
    summary: 'Control case showing the pre-purchase capital position for direct comparison with the annuity version.',
  }
)

export const exampleStaticAllocationControlArticle = exampleArticle(
  'example-static-allocation-control',
  'Static allocation control (Morgan)',
  'Identical starting balances to the glidepath example, but using a single default return with no class allocation or rebalancing.',
  'static-allocation-control',
  `This is the identical Morgan household and account balances as the glidepath version.

Every account uses a single flat expected return instead of class weights, glidepaths, and rebalancing.

Monte Carlo applies a single-factor shock rather than correlated class shocks.

Load both this plan and the glidepath version, then use Compare or run Monte Carlo on each to see the impact of the allocation model on risk metrics.`,
  'Compare Monte Carlo outcomes (especially 10th-percentile estate, depletion probability, and frontiers) between this flat-return version and the allocated glidepath version.',
  ['assumption-investment-returns', 'reading-the-results-page'],
  ['/plan/:planId/accounts', '/plan/:planId/monte-carlo'],
  'example-plans',
  {
    name: 'The Morgan household (static allocation version)',
    assumptions: [
      { label: 'Filing status', value: 'Single' },
      { label: 'Key difference', value: 'No allocation policies; single 5% return per account' },
      { label: 'Starting investable', value: 'Same as glidepath version (~$1.465M)' },
      { label: 'Rebalancing', value: 'None' },
      { label: 'MC model', value: 'Single-factor returns (no class correlation)' },
    ],
    summary: 'Control case with identical dollars but classic single-return assumptions for fair comparison.',
  }
)

export const exampleBrokerageNoHsaArticle = exampleArticle(
  'example-brokerage-no-hsa',
  'Brokerage instead of HSA control (Harper)',
  'The money that would be in the HSA (initial balance + contribution rate) is held in taxable brokerage instead. Other elements (property, traditional IRA) kept for fair comparison.',
  'brokerage-no-hsa',
  `This is the identical Harper household and other accounts (including the home sale and traditional IRA with basis).

The $48,000 initial balance plus the $4,150 annual contribution capacity that went into the HSA is instead held in a taxable brokerage account.

There is no medical-expense cap or triple-tax treatment. Withdrawals are subject to ordinary tax (and potential penalty before 65).

Compare this version directly with the HSA version to see the difference in tax drag and qualified medical access.`,
  'Compare the tax on account withdrawals and the final balances between this brokerage version and the HSA version. Note the lack of medical-qualified treatment.',
  ['hsas-as-retirement-accounts'],
  ['/plan/:planId/accounts', '/plan/:planId/results'],
  'example-plans',
  {
    name: 'The Harper household (brokerage version)',
    assumptions: [
      { label: 'Filing status', value: 'Single' },
      { label: 'Key difference', value: 'HSA dollars moved to taxable brokerage' },
      { label: 'Brokerage balance', value: 'Higher by ~$48k + ongoing contribs' },
      { label: 'Tax treatment', value: 'Ordinary income on growth and withdrawals' },
      { label: 'Medical cap', value: 'None' },
    ],
    summary: 'Control case placing the same dollars in a taxable account instead of the HSA.',
  }
)

export const exampleAll401kNoBridgeArticle = exampleArticle(
  'example-all-401k-no-bridge',
  'All-in 401(k) control (Sam & Jordan)',
  'Control half of the savings-location pair: the whole $45,000/yr savings budget goes pre-tax, and retiring at 52 exposes the bridge problem.',
  'all-401k-no-bridge',
  `Sam and Jordan earn $180,000 together and save $45,000 a year — all of it into traditional 401(k)s — planning to retire at 52.

The deduction feels great every year. The problem surfaces at 52: nearly everything they own is inaccessible before 59½ without a 10% penalty (or a rigid SEPP program).

Once their cash and small brokerage run dry, penalized 401(k) withdrawals carry the bridge years. Each withdrawal is ordinary income, so MAGI jumps — and the ACA premium credits that subsidize marketplace coverage disappear, adding tens of thousands a year in health premiums.

The identical savings budget, placed differently, avoids all of this. That comparison is the point of the pair.`,
  'Watch Results ages 52–59: penalties once the taxable money is gone, marketplace premiums jumping when MAGI clears the ACA cliff, and a depletion year the bridge version avoids.',
  ['aca-premium-tax-credits-and-magi', 'rule-of-55-and-72t', 'withdrawal-order-basics'],
  ['/plan/:planId/results', '/plan/:planId/accounts'],
  'early-investing-fire',
  {
    name: 'The Sam & Jordan household (all-401(k) version)',
    assumptions: [
      { label: 'Filing status', value: 'Married Filing Jointly' },
      { label: 'Retirement age', value: '52 (both)' },
      { label: 'Wages', value: '$105,000 + $75,000, 1% real growth' },
      { label: 'Savings', value: '$45,000/yr, all traditional 401(k) + 50%-to-6% match' },
      { label: 'Starting balances', value: '$210k + $85k in 401(k)s, $40k brokerage, $30k cash' },
      { label: 'Healthcare', value: 'Marketplace pre-65 with ACA credits enabled' },
    ],
    summary: 'Control case: identical budget and household to the bridge version — only the destination of the savings differs.',
  }
)

export const exampleBrokerageBridge401kArticle = exampleArticle(
  'example-brokerage-bridge-401k',
  '401(k) plus brokerage bridge (Sam & Jordan)',
  'Feature half of the savings-location pair: 401(k) to the match, the rest into a taxable bridge that funds ages 52–59½.',
  'brokerage-bridge-401k',
  `Same couple, same wages, same $45,000/yr gross savings budget as the control — but only enough goes into the 401(k)s to capture the full employer match. The remaining ~$30,600/yr builds a joint taxable brokerage.

Because the gross budget is held constant, this plan pays more income tax during the accumulation years — the contributions above the match lose their deduction. That honesty is the tradeoff being taught.

At 52 the brokerage is large and mostly basis. Selling it to fund the bridge years realizes modest capital gains, so MAGI stays low: ACA credits keep net marketplace premiums tiny while the control pays full price, and no early-withdrawal penalties ever apply.

The built-in scenario stress-tests the popular "convert to Roth during the bridge" advice. For this lean plan it backfires: the conversion tax plus the forfeited ACA credits drain the bridge fund and hand back most of the strategy's advantage. Cheap conversions need spare money — this household's bridge fund is the spending money.`,
  'Compare bridge-year MAGI, net healthcare premiums, penalties, and the depletion year against the all-401(k) control; then run the conversion scenario and watch the advantage evaporate.',
  ['aca-premium-tax-credits-and-magi', 'why-roth-conversions-raise-other-costs', 'withdrawal-order-basics'],
  ['/plan/:planId/results', '/plan/:planId/accounts', '/plan/:planId/scenarios'],
  'early-investing-fire',
  {
    name: 'The Sam & Jordan household (bridge version)',
    assumptions: [
      { label: 'Filing status', value: 'Married Filing Jointly' },
      { label: 'Retirement age', value: '52 (both)' },
      { label: 'Wages', value: '$105,000 + $75,000, 1% real growth' },
      { label: 'Savings', value: '$14,400/yr to 401(k)s (full match kept) + $30,600/yr brokerage' },
      { label: 'Key difference', value: 'Savings destination only — budget, balances, and household identical' },
      { label: 'Built-in scenario', value: 'Bracket-fill Roth conversions during the bridge (a cautionary tale here)' },
    ],
    summary: 'Feature case: the taxable bridge keeps MAGI low through 52–59½, preserving ACA credits and avoiding penalties.',
  }
)

export const exampleNoHeadStartGradArticle = exampleArticle(
  'example-no-head-start-grad',
  'Starting from zero control (Nova)',
  'Control half of the head-start pair: a 22-year-old starting the retirement journey with no seeded accounts.',
  'no-head-start-grad',
  `Nova is 22, earns $62,000 with strong raises, spends $44,000, and does the right things: contributes $8,000 a year to the employer 401(k) and captures the full 100%-to-4% match.

Retirement wealth starts at $0 apart from a small emergency fund. Over a full career that steady saving still compounds into a comfortable retirement at 60.

The pair partner is identical in every respect except one: it begins with a traditional IRA seeded by a childhood Trump account. Load both and use Compare Plans to price the head start.`,
  'Note where the 401(k)-only trajectory lands by 60 and beyond, then Compare ending assets against the head-start version — the delta is the value of the first 18 years.',
  ['what-is-fire', 'savings-rate-biggest-lever'],
  ['/plan/:planId/results', '/plan/:planId/accounts'],
  'early-investing-fire',
  {
    name: 'The Nova household (no head start)',
    assumptions: [
      { label: 'Filing status', value: 'Single, age 22' },
      { label: 'Wages', value: '$62,000, 2.5% real growth' },
      { label: 'Ongoing savings', value: '$8,000/yr 401(k) + 100%-to-4% employer match' },
      { label: 'Starting balances', value: '$8,000 emergency fund only' },
      { label: 'Retirement age', value: '60' },
    ],
    summary: 'Control case: everything the head-start version has except the seeded IRA.',
  }
)

export const exampleTrumpAccountHeadStartArticle = exampleArticle(
  'example-trump-account-head-start',
  'Trump account IRA head start (Nova)',
  'Feature half of the head-start pair: the same 22-year-old, plus a traditional IRA seeded by a childhood Trump account.',
  'trump-account-head-start',
  `Same Nova, same wages, spending, and ongoing savings as the control — plus one account she never had to think about: a traditional IRA that began life as a Trump account.

Her parents elected the account at birth, the government added the one-time $1,000 pilot seed, and the family contributed $2,500 a year until 18. At 7% growth that is about $88,400 on her 18th birthday, when the account automatically became a traditional IRA by operation of law. Left invested, it reaches roughly $115,800 at 22.

Because family contributions are after-tax and nondeductible, the IRA carries $45,000 of Form 8606 basis (18 × $2,500). The seed and all earnings are the pre-tax portion. Any withdrawal or Roth conversion applies the pro-rata rule — exactly the machinery this planner models on traditional IRAs.

The built-in scenario converts to Roth in the early career years: the basis portion converts tax-free and the pre-tax portion fills only the 12% bracket, showing why commentators call the age-18 conversion window a "legal backdoor" to a Roth.`,
  'Compare ending assets against the starting-from-zero control, then run the conversion scenario with and without the nondeductible basis in mind — the basis visibly lowers the conversion tax.',
  ['savings-rate-biggest-lever', 'roth-conversion-basics', 'account-types-overview'],
  ['/plan/:planId/results', '/plan/:planId/accounts', '/plan/:planId/scenarios'],
  'early-investing-fire',
  {
    name: 'The Nova household (head-start version)',
    assumptions: [
      { label: 'Filing status', value: 'Single, age 22' },
      { label: 'Wages', value: '$62,000, 2.5% real growth' },
      { label: 'Ongoing savings', value: '$8,000/yr 401(k) + 100%-to-4% employer match (identical to control)' },
      { label: 'Seeded IRA', value: '$115,800 traditional IRA, $45,000 nondeductible basis' },
      { label: 'Built-in scenario', value: 'Bracket-fill Roth conversions ages 22–26' },
    ],
    summary: 'Feature case: one seeded account, zero extra behavior — the delta against the control prices the 18-year head start.',
  },
  {
    blocks: [
      {
        type: 'callout',
        tone: 'note',
        md: 'This household is **illustrative by design**. The example library\'s clock is fixed at 2026, and a 22-year-old in 2026 (born 2004) could not actually have had a Trump account — contributions only began July 4, 2026. The plan shows what a child born under the program will experience at 22. The account itself needs no special modeling: after 18 it is an ordinary traditional IRA.',
      },
      { type: 'heading', text: 'Trump Account Rules (verified 2026-07-16)' },
      {
        type: 'list',
        items: [
          '**Eligibility:** a parent or guardian elects an account for a child who has not turned 18 before the end of the election year.',
          '**Federal seed:** a one-time $1,000 government pilot contribution for U.S.-citizen children born January 1, 2025 through December 31, 2028.',
          '**Contributions:** none before July 4, 2026; aggregate cap $5,000/yr (inflation-indexed after 2027). Employers may add up to $2,500/yr (counts against the cap, excluded from the employee\'s income).',
          '**Tax character:** family contributions are after-tax and nondeductible — they become Form 8606 basis. The seed, employer contributions, and all earnings are pre-tax; growth is tax-deferred.',
          '**Investments:** restricted to low-cost funds tracking the S&P 500 or another primarily-US-equity index, so an equity return assumption is faithful.',
          '**Lock-up:** no withdrawals before January 1 of the year the child turns 18.',
          '**At 18:** the account automatically becomes a traditional IRA — no rollover event. Normal IRA rules follow, including the 10% penalty before 59½ and the option of a taxable Roth conversion.',
        ],
      },
      {
        type: 'table',
        caption: 'Illustrative values at age 18 (7% nominal, contributions from birth, end-of-year)',
        columns: ['Funding pattern', 'Value at 18', 'Nondeductible basis'],
        rows: [
          ['Seed only ($1,000, no contributions)', '≈ $3,400', '$0'],
          ['Seed + $2,500/yr family (this example)', '≈ $88,400', '$45,000'],
          ['Seed + $5,000/yr (max)', '≈ $173,400', '$90,000'],
        ],
      },
      {
        type: 'prose',
        md: 'This example uses the moderate middle row. Not every child will get $115,000 — a seed-only account is worth about $3,400 at 18, still a real head start from a single $1,000 contribution.',
      },
      {
        type: 'callout',
        tone: 'warn',
        md: '**Kiddie-tax caveat:** Roth conversions in low-income years (roughly ages 18–24) can be nearly free, but a dependent full-time student under 24 may have unearned income — including the taxable part of a conversion — taxed at the parents\' rates under the kiddie tax. Check dependency status before converting.',
      },
    ],
    sourceUrls: [
      'https://www.irs.gov/newsroom/treasury-irs-issue-guidance-on-trump-accounts-established-under-the-working-families-tax-cuts-notice-announces-upcoming-regulations',
      'https://www.federalregister.gov/documents/2026/03/09/2026-04533/trump-accounts',
      'https://www.congress.gov/crs-product/R48910',
      'https://crr.bc.edu/trump-accounts-a-primer-for-parents/',
      'https://www.cnbc.com/2026/06/03/trump-accounts-roth-ira.html',
      'https://www.fidelity.com/learning-center/personal-finance/trump-accounts',
    ],
    lastReviewed: '2026-07-16',
    reviewCadence: 'rule-change',
    currentYearSensitive: true,
  }
)

export const EXAMPLE_PLAN_ARTICLES = [
  exampleCoupleArticle,
  exampleUnderSavedSingleArticle,
  exampleBracketFillRothArticle,
  exampleEarlyRetireeAcaArticle,
  exampleRmdIrmaaArticle,
  exampleSurvivorYearsArticle,
  exampleMovingStateTaxArticle,
  exampleLtcShockArticle,
  exampleEarlyCareerMatchArticle,
  exampleAggressiveSaverArticle,
  exampleCoastFireArticle,
  exampleBaristaFireArticle,
  exampleBridgeEarlyRetirementArticle,
  exampleLeanFatFireArticle,
  exampleHsaStealthRetirementArticle,
  exampleSalaryGrowthEscalationArticle,
  exampleGuardrailsFlexArticle,
  exampleAnnuityEstateArticle,
  exampleGlidepathAllocationArticle,
  exampleHsaPropertyDepthArticle,
  exampleFixedTargetSpendingArticle,
  exampleNoAnnuityBrokerageArticle,
  exampleStaticAllocationControlArticle,
  exampleBrokerageNoHsaArticle,
  exampleAll401kNoBridgeArticle,
  exampleBrokerageBridge401kArticle,
  exampleNoHeadStartGradArticle,
  exampleTrumpAccountHeadStartArticle,
]

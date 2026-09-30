/**
 * Bodies for the Example Plans articles.
 *
 * Every example teaches the same way — takeaways, the household, the idea,
 * why it matters in RetireGolden, what to look for, common mistakes — so the
 * shape is built once here and each example supplies only what differs. The
 * metadata for these articles lives in ../articleIndex like every other
 * article's; this module is loaded only when one of them is opened.
 */

import type { ArticleBlock, ScenarioAssumption } from '../learningRegistry'

function exampleBody(
  teaches: string,
  lookFor: string,
  scenario?: { name: string; assumptions: ScenarioAssumption[]; summary?: string },
  /** Extra blocks rendered after "The Basic Idea" (rules tables, callouts, …). */
  extraBlocks?: ArticleBlock[],
): ArticleBlock[] {
  const blocks: ArticleBlock[] = [
    { type: 'heading', text: 'Quick Takeaways' },
    {
      type: 'list',
      items: [
        'Open the linked example in the planner to explore with live numbers.',
        'Edit freely. The demo stays out of Your plans until you save it.',
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
    ...(extraBlocks ?? []),
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

  return blocks
}

const exampleCoupleBody = exampleBody(
  'This is RetireGolden\'s flagship teaching household: diversified accounts, pre-retirement wages, a fill-to-bracket Roth strategy, LTC policies, and side scenarios for a Social Security haircut and higher spending.',
  'Watch Roth conversions in Strategy, then trace RMDs, taxes, and ending balances in Results.',
)

const exampleUnderSavedSingleBody = exampleBody(
  'Jordan is a single retiree with consulting income, Social Security at 67, and spending that outpaces investable assets over time. The lesson is not pessimism. It is seeing *when* the plan runs out and what still funds cash flow.',
  'Find the depletion year on Results and compare withdrawals from cash, taxable, and traditional accounts.',
)

const exampleBracketFillRothBody = exampleBody(
  `Morgan and Riley are retired with large traditional IRAs, Social Security, and a strategy to fill the 22% bracket with Roth conversions. QCDs offset part of the RMD tax bite.

Each of them has a Roth IRA, because a conversion can land only in its owner's own Roth IRA: the year's conversion is sized for the household and split between them by their IRA balances. The conversion is sized before the year's spending is drawn, so once the cash reserve runs out in 2027 the spending comes out of the IRAs on top of the filled bracket: taxable income ends $72,410, $94,901 and $118,894 above the top of the 22% bracket in 2027, 2028 and 2029, taxed at 24%, and Results warns about it. Filling the bracket every year empties both IRAs by 2030, so the RMDs and the charitable gifts from the IRAs stop there, and the larger incomes of those years raise Medicare premiums two years later, from 2028 to 2031.`,
  'Compare lifetime tax vs ending Roth balance, and watch conversion amounts year by year.',
)

const exampleEarlyRetireeAcaBody = exampleBody(
  `Casey retired at 58 and buys marketplace coverage until Medicare. She has part-time consulting income, and her Roth conversions fill the 10% tax bracket each year. The conversions are sized to the bracket, not to the subsidy cliff: the top of the 10% bracket happens to keep her income below the cliff, and filling the 12% bracket would cross it. Both income sources count toward MAGI, so converting one bracket higher forfeits the entire credit.

The credit is priced for 2026 and 2027, the two coverage years whose figures are published so far. From 2028 the plan budgets the full premium until that year's figures are published. The example also assumes the benchmark silver plan costs the same $1,000 a month Casey pays, so the credit brings her premium down to exactly the share of income the law expects her to pay. Its coverage details follow that premium: change the premium and the benchmark moves with it, so the credit rises or falls by the same amount and what she pays stays her expected share.`,
  'Check the 2026 and 2027 premium credits in the printable report\'s ACA ledger, then raise the conversion bracket to 12% on Strategy and watch both go to zero.',
)

const exampleRmdIrmaaBody = exampleBody(
  'Dana has a very large IRA entering RMD years. Required withdrawals boost MAGI, which can interact with IRMAA tiers on Medicare premiums. QCDs provide partial relief.',
  'Trace RMD and QCD columns, then Medicare-related healthcare costs after 65.',
)

const exampleInheritedIraBeneficiaryBody = exampleBody(
  'Robin’s classified inherited IRA records a sole surviving spouse who elects to remain beneficiary, so the engine can show its sourced schedule. The second inherited IRA has only the older two fields, so it uses the simpler planning estimate. Compare the two evidence rows before relying on an inherited-account schedule; confirm beneficiary facts and the applicable rules with a tax professional.',
  'Open Accounts to compare the classified beneficiary details with the legacy account, then inspect their separate inherited schedule rows in Results.',
)

const exampleSurvivorYearsBody = exampleBody(
  'Lee and Chris have unequal Social Security and a pension that pays a survivor benefit. When Chris\'s planning age ends first, Lee steps into survivor benefits and single tax brackets. Taxes can rise even as total income falls.',
  'Compare tax and Social Security in the last joint year vs the first survivor year.',
)

const exampleMovingStateTaxBody = exampleBody(
  'Avery earns consulting income while living in Florida, then relocates to Kentucky. Federal tax is unchanged, but modeled state tax adds a new layer. Compare the base plan to the built-in scenarios.',
  'Open Scenarios and compare lifetime tax when the move happens sooner vs later.',
)

const exampleLtcShockBody = exampleBody(
  'Quinn faces a care episode in late life. Without insurance, the shock drains cash quickly; with an LTC policy, benefits and premiums change the ending estate picture.',
  'Inspect care-event years on Results and Insurance for premium vs benefit flow.',
)

const exampleEarlyCareerMatchBody = exampleBody(
  'Alex is starting their career with $65,000 in wages growing at 3% real annually. By contributing $6,000 to their employer 401(k) and capturing the 4% match, plus contributing $3,000 to a Roth IRA, they compound early momentum.',
  'Verify the employerMatch amount on the Results page and watch wages increase by the raise rate.',
)

const exampleAggressiveSaverBody = exampleBody(
  'Taylor saves 50% of their gross wages. By putting $23,000 a year into a pre-tax 401(k) and $7,000 into a Roth IRA, and scheduling aggressive taxable contributions, they build a portfolio to support their retirement expenses.',
  'Open Results to inspect the savings rate, FI Target, and the year they cross the FI threshold.',
)

const exampleCoastFireBody = exampleBody(
  'Morgan contributes heavily until age 40, then completely stops active savings. Compounding growth carries their portfolio the rest of the way to a full retirement at age 60.',
  'Open Accounts to check the contribution schedule, and Results to see when traditional IRA coasts to goal.',
)

const exampleBaristaFireBody = exampleBody(
  'Robin transitions from a high-paying job to a $35,000 part-time barista job at age 40 and trims baseline spending. The part-time work covers much of the gap so the portfolio can keep compounding instead of carrying the whole bridge alone.',
  'Open Income to see the barista stream, and Results to track the ACA premium tax credits.',
)

const exampleBridgeEarlyRetirementBody = exampleBody(
  'Jordan retires early and sets up a Substantially Equal Periodic Payment (SEPP) series from their traditional IRA. This unlocks early cash flow without the 10% penalty.',
  'Check the SEPP column in Results and traditional account balance drawdown starting at age 45, in 2026.',
)

const exampleLeanFatFireBody = exampleBody(
  'Jessie compares a baseline $45,000 early retirement budget against a $80,000 Fat FIRE lifestyle scenario, modeling the impact on assets and FI date.',
  'Open Scenarios to compare the base plan against the Fat FIRE scenario side-by-side.',
)

const exampleHsaStealthRetirementBody = exampleBody(
  'Chris uses a triple-tax-advantaged HSA to build health savings. By maxing out contributions and keeping the balance invested, the HSA serves as a key bridge asset.',
  'Check the HSA contributions and final balance on the Accounts page.',
)

const exampleSalaryGrowthEscalationBody = exampleBody(
  'Dana combines a 3% real wage raise rate with an annual 3% escalation on her 401(k) and brokerage contributions to reach FI much earlier.',
  'Trace wage raises in Income and watch the annual escalation of savings in Results.',
)

const exampleGuardrailsFlexBody = exampleBody(
  `Riley plans on $58,000 of annual spending in 2026 dollars.

She sets a required floor of $34,000 that must be protected no matter what the markets do. The remaining spending is discretionary and can be cut or increased.

When markets are poor, the guardrails automatically reduce flexible spending to protect the floor. In strong markets, spending can recover.

One-time goals can be marked required, target, ideal, or excess, and some are allowed to move or be skipped.`,
  'Watch guardrailAction and guardrailFactor columns in Results, the split between requiredShortfall and targetShortfall, and the layered success rates in Monte Carlo.',
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
  },
)

const exampleAnnuityEstateBody = exampleBody(
  `Jordan and Taylor have substantial traditional IRA balances and want more guaranteed lifetime income.

They use part of their savings to purchase a SPIA (non-qualified, cash-funded) that begins payments at 66 and a QLAC (qualified, traditional-funded) that starts at 80.

The QLAC premium is excluded from future RMD calculations up to the limit.

Each account has its own beneficiary designation: some go to the surviving spouse with no income tax deducted in this comparison, others to charity (untaxed), and some to non-spouse heirs (with tax).`,
  'Look at the annuity income streams and purchase cash flows in Results, the reduced RMDs from the QLAC, and how the after-tax estate changes based on the beneficiary choices.',
  {
    name: 'The Jordan & Taylor household',
    assumptions: [
      { label: 'Filing status', value: 'Married Filing Jointly' },
      { label: 'SPIA purchase', value: '$220,000 at age 66 (non-qualified)' },
      { label: 'QLAC purchase', value: '$135,000 at age 65 (qualified, deferred)' },
      { label: 'Beneficiary setup', value: 'Mixed: spouse destination, charity, non-spouse' },
      { label: 'Key goal', value: 'Secure lifetime income + compare after-tax inheritance' },
    ],
    summary: 'Illustrates trading liquidity for guaranteed income and using per-account beneficiaries to shape the after-tax estate.',
  },
)

const exampleGlidepathAllocationBody = exampleBody(
  `Morgan holds accounts in taxable, traditional, and Roth wrappers.

Instead of a single expected return on each account, he assigns target weights to four asset classes: US stocks, international stocks, bonds, and cash.

A linear glidepath gradually shifts the taxable account from aggressive (70% stocks) to conservative (30% stocks) over 12 years. Rebalancing happens annually.

In the taxable account, bonds generate more interest (taxed every year) while stocks generate qualified dividends and growth. Monte Carlo now applies correlated shocks to the classes rather than a single return.`,
  'Edit the allocation policy on each account and watch the target weights change over time. Run Monte Carlo on this plan and on the static-allocation version to compare downside percentiles and frontiers. Both start from the same market draw, but this plan also draws a shock for each asset class, so after the first year they see different markets and a small gap can be sampling noise.',
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
  },
)

const exampleHsaPropertyDepthBody = exampleBody(
  `Harper puts $4,150 a year into an HSA and invests it for growth.

She sets the HSA to cap qualified medical withdrawals by actual modeled healthcare costs plus any accumulated "reimburse later" balance.

A primary residence with a low cost basis is scheduled for sale in 7 years. The plan tracks the §121 exclusion, selling costs, and a small amount of depreciation recapture.

A traditional IRA holds nondeductible basis that will affect the taxable portion of any conversions or withdrawals.`,
  'Look at the HSA withdrawal treatment fields, the qualified vs taxable split on HSA distributions, the exact gain calculation on the home sale, and the pro-rata impact on IRA conversions.',
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
  },
)

const exampleFixedTargetSpendingBody = exampleBody(
  `This is the identical Riley household and spending target as the guardrails version, but with no required floor and no guardrail policy.

All spending is treated as a single target. In bad markets the full amount is at risk.

Compare this plan directly with the guardrails version using the Compare feature to isolate the effect of the spending policy.`,
  'Open both examples, then use Compare Plans to see when each version depletes, and the Monte Carlo page of each for its success rates (overall, and for the required floor). Every plan starts from the same market draw, so the two sets of rates come from the same simulated markets.',
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
  },
)

const exampleNoAnnuityBrokerageBody = exampleBody(
  `This is the identical Jordan & Taylor household, but the $355,000 that would have purchased the SPIA and QLAC remains invested in cash and traditional accounts.

They keep full liquidity and control over the capital, but have no guaranteed lifetime income streams from the annuities.

Compare this version side-by-side with the annuity-purchases example to see the trade-off between liquidity and income security plus estate effects.`,
  'Compare the two plans in Results (income streams and RMDs) and in the estate metric. Note the higher early balances but lack of annuity income.',
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
  },
)

const exampleStaticAllocationControlBody = exampleBody(
  `This is the identical Morgan household and account balances as the glidepath version.

Every account uses a single flat expected return instead of class weights, glidepaths, and rebalancing.

Monte Carlo applies a single-factor shock rather than correlated class shocks.

Load both this plan and the glidepath version, then use Compare or run Monte Carlo on each to see the impact of the allocation model on risk metrics.`,
  'Compare Monte Carlo outcomes (especially 10th-percentile estate, depletion probability, and frontiers) between this flat-return version and the allocated glidepath version. Both start from the same market draw, but the glidepath version also draws a shock for each asset class, so after the first year they see different markets and a small gap can be sampling noise.',
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
  },
)

const exampleBrokerageNoHsaBody = exampleBody(
  `This is the identical Harper household and other accounts (including the home sale and traditional IRA with basis).

The $48,000 initial balance plus the $4,150 annual contribution capacity that went into the HSA is instead held in a taxable brokerage account.

There is no medical-expense cap or triple-tax treatment. Withdrawals are subject to ordinary tax (and potential penalty before 65).

Compare this version directly with the HSA version to see the difference in tax drag and qualified medical access.`,
  'Compare the tax on account withdrawals and the final balances between this brokerage version and the HSA version. Note the lack of medical-qualified treatment.',
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
  },
)

const exampleAll401kNoBridgeBody = exampleBody(
  `Sam and Jordan earn $180,000 together and save $45,000 a year (all of it into traditional 401(k)s), planning to retire at 52.

The deduction feels great every year. The problem surfaces at 52: nearly everything they own is inaccessible before 59½ without a 10% penalty (or a rigid SEPP program).

Once their cash and small brokerage run dry, penalized 401(k) withdrawals carry the bridge years: $83,312 of early-withdrawal penalties from 2042 to 2045. Each withdrawal is ordinary income, so MAGI jumps. In a coverage year whose ACA figures are published and whose annual evidence is complete, that can reduce or eliminate the modeled credit. These bridge years come after the last published coverage year, so both plans budget the full marketplace premium.

The identical savings budget, placed differently, avoids the penalties and lasts one year longer: this plan runs out of money in 2068, the bridge version in 2069. That comparison is the point of the pair.`,
  'Watch Results ages 52–59: penalties once the taxable money is gone, then compare the depletion year, 2068, with the bridge version\'s 2069.',
  {
    name: 'The Sam & Jordan household (all-401(k) version)',
    assumptions: [
      { label: 'Filing status', value: 'Married Filing Jointly' },
      { label: 'Retirement age', value: '52 (both)' },
      { label: 'Wages', value: '$105,000 + $75,000, 1% real growth' },
      { label: 'Savings', value: '$45,000/yr, all traditional 401(k) + 50%-to-6% match' },
      { label: 'Starting balances', value: '$210k + $85k in 401(k)s, $40k brokerage, $30k cash' },
      { label: 'Healthcare', value: 'Marketplace pre-65; ACA modeling requested, with annual evidence required' },
    ],
    summary: 'Control case: identical budget and household to the bridge version. Only the destination of the savings differs.',
  },
)

const exampleBrokerageBridge401kBody = exampleBody(
  `Same couple, same wages, same $45,000/yr gross savings budget as the control, but only enough goes into the 401(k)s to capture the full employer match. The remaining ~$30,600/yr builds a joint taxable brokerage.

Because the gross budget is held constant, this plan pays more income tax during the accumulation years: the contributions above the match lose their deduction. That honesty is the tradeoff being taught.

At 52 the brokerage is large. Cash covers the first bridge years, and selling the brokerage covers the rest at low capital-gains rates, so no early-withdrawal penalties apply and MAGI stays far below the control's from 2042 to 2045. Lower MAGI could preserve premium tax credit in a coverage year whose ACA figures are published, but these bridge years come after the last published coverage year, so both plans budget the full marketplace premium. Over its lifetime this plan pays less in tax and penalties than the control ($865,395 against $934,907, of which $83,312 is the control's penalties) and lasts one year longer, to 2069 against 2068; neither reaches the end of the plan in 2078.

The built-in scenario tests the popular "convert to Roth during the bridge" advice: each bridge year, 2038 to 2045, it sizes a conversion to the top of the 12% bracket. Only Sam holds a Roth IRA, so only his share of each year's amount converts, and Results says Jordan's share was skipped. On this plan it pays: lifetime tax falls from $865,395 to $534,028 and the money lasts to 2071 instead of 2069. The conversion tax comes out of the same bridge money, and the brokerage still lasts into 2046.`,
  'Compare bridge-year MAGI, penalties and the depletion year against the all-401(k) control; then run the conversion scenario and compare its lifetime tax and depletion year with the base plan.',
  {
    name: 'The Sam & Jordan household (bridge version)',
    assumptions: [
      { label: 'Filing status', value: 'Married Filing Jointly' },
      { label: 'Retirement age', value: '52 (both)' },
      { label: 'Wages', value: '$105,000 + $75,000, 1% real growth' },
      { label: 'Savings', value: '$14,400/yr to 401(k)s (full match kept) + $30,600/yr brokerage' },
      { label: 'Key difference', value: 'Savings destination only; budget, balances, and household identical' },
      { label: 'Built-in scenario', value: 'Bracket-fill Roth conversions during the bridge (on this plan they lower lifetime tax and the money lasts longer)' },
    ],
    summary: 'Feature case: the taxable bridge keeps MAGI lower through 52–59½ and avoids penalties. No bridge year has published ACA figures, so both plans budget the full marketplace premium.',
  },
)

const exampleNoHeadStartGradBody = exampleBody(
  `Nova is 22, earns $62,000 with strong raises, spends $44,000, and does the right things: contributes $8,000 a year to the employer 401(k) and captures the full 100%-to-4% match.

Retirement wealth starts at $0 apart from a small emergency fund. Over a full career that steady saving still compounds into a comfortable retirement at 60.

The pair partner is identical in every respect except one: it begins with a traditional IRA seeded by a childhood Trump account. Load both and use Compare Plans to price the head start.`,
  'Note where the 401(k)-only trajectory lands by 60 and beyond, then Compare ending assets against the head-start version. The delta is the value of the first 18 years.',
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
  },
)

const exampleTrumpAccountHeadStartBody = exampleBody(
  `Same Nova, same wages, spending, and ongoing savings as the control, plus one account she never had to think about: a traditional IRA that began life as a Trump account.

Her parents elected the account at birth, the government added the one-time $1,000 pilot seed, and the family contributed $2,500 a year until 18. At 7% growth that is about $88,400 on her 18th birthday, when the account automatically became a traditional IRA by operation of law. Left invested, it reaches roughly $115,800 at 22.

Because family contributions are after-tax and nondeductible, the IRA carries $45,000 of Form 8606 basis (18 × $2,500). The seed and all earnings are the pre-tax portion. Any withdrawal or Roth conversion applies the pro-rata rule, exactly the machinery this planner models on traditional IRAs.

The built-in scenario, "Bracket-fill Roth conversions (Form 8606 basis)", fills the 12% bracket during ages 22–26, while Nova's wages already occupy most of it. The conversions are deliberately modest and shrink as raises consume the bracket headroom; the point is the mechanics, not the size: under the pro-rata rule the basis portion converts tax-free, so only part of each conversion is taxed. The often-cited near-free move (converting at 18 with little or no income, before a career starts) happens earlier than this plan's window and is not what this scenario runs; see the caveat below before attempting it.`,
  'Compare ending assets against the starting-from-zero control, then run the conversion scenario with and without the nondeductible basis in mind. The basis visibly lowers the conversion tax.',
  {
    name: 'The Nova household (head-start version)',
    assumptions: [
      { label: 'Filing status', value: 'Single, age 22' },
      { label: 'Wages', value: '$62,000, 2.5% real growth' },
      { label: 'Ongoing savings', value: '$8,000/yr 401(k) + 100%-to-4% employer match (identical to control)' },
      { label: 'Seeded IRA', value: '$115,800 traditional IRA, $45,000 nondeductible basis' },
      { label: 'Built-in scenario', value: 'Bracket-fill 12% conversions ages 22–26 (Form 8606 basis)' },
    ],
    summary: 'Feature case: one seeded account, zero extra behavior; the delta against the control prices the 18-year head start.',
  },
  [
    {
      type: 'callout',
      tone: 'note',
      md: 'This household is **illustrative by design**. Every library example is set in 2026, and a 22-year-old in 2026 (born 2004) could not actually have had a Trump account: contributions only began July 4, 2026. The plan shows what a child born under the program will experience at 22. The account itself needs no special modeling: after 18 it is an ordinary traditional IRA.',
    },
    { type: 'heading', text: 'Trump Account Rules (verified 2026-07-16)' },
    {
      type: 'list',
      items: [
        '**Eligibility:** a parent or guardian elects an account for a child who has not turned 18 before the end of the election year.',
        '**Federal seed:** a one-time $1,000 government pilot contribution for U.S.-citizen children born January 1, 2025 through December 31, 2028.',
        '**Contributions:** none before July 4, 2026; aggregate cap $5,000/yr (inflation-indexed after 2027). Employers may add up to $2,500/yr (counts against the cap, excluded from the employee\'s income).',
        '**Tax character:** family contributions are after-tax and nondeductible, so they become Form 8606 basis. The seed, employer contributions, and all earnings are pre-tax; growth is tax-deferred.',
        '**Investments:** restricted to low-cost funds tracking the S&P 500 or another primarily-US-equity index, so an equity return assumption is faithful.',
        '**Lock-up:** no withdrawals before January 1 of the year the child turns 18.',
        '**At 18:** the account automatically becomes a traditional IRA, with no rollover event. Normal IRA rules follow, including the 10% penalty before 59½ and the option of a taxable Roth conversion.',
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
      md: 'This example uses the moderate middle row. Not every child will get $115,000. At the same 7% assumption, a seed-only account is worth about $3,400 at 18 and about $4,500 at 22, versus this example\'s ≈ $88,400 at 18 and ≈ $115,800 at 22. Still a real head start from a single $1,000 contribution.',
    },
    {
      type: 'callout',
      tone: 'warn',
      md: '**Kiddie-tax caveat:** if you convert at 18 while still a dependent (the near-free no-income window commentators call a "legal backdoor"), the taxable part of the conversion is unearned income, and a dependent full-time student under 24 may have it taxed at the parents\' rates under the kiddie tax. Check dependency status before converting. (This example\'s built-in scenario converts later, at ages 22–26 against wage income, and does not model that window.)',
    },
  ],
)

/** Body blocks for every Example Plans article, keyed by slug. */
export const EXAMPLE_PLAN_BODIES: Record<string, ArticleBlock[]> = {
  'example-couple': exampleCoupleBody,
  'example-under-saved-single': exampleUnderSavedSingleBody,
  'example-bracket-fill-roth': exampleBracketFillRothBody,
  'example-early-retiree-aca': exampleEarlyRetireeAcaBody,
  'example-rmd-irmaa': exampleRmdIrmaaBody,
  'example-inherited-ira-beneficiary': exampleInheritedIraBeneficiaryBody,
  'example-survivor-years': exampleSurvivorYearsBody,
  'example-moving-state-tax': exampleMovingStateTaxBody,
  'example-ltc-shock': exampleLtcShockBody,
  'example-early-career-match': exampleEarlyCareerMatchBody,
  'example-aggressive-saver': exampleAggressiveSaverBody,
  'example-coast-fire': exampleCoastFireBody,
  'example-barista-fire': exampleBaristaFireBody,
  'example-bridge-early-retirement': exampleBridgeEarlyRetirementBody,
  'example-lean-fat-fire': exampleLeanFatFireBody,
  'example-hsa-stealth-retirement': exampleHsaStealthRetirementBody,
  'example-salary-growth-escalation': exampleSalaryGrowthEscalationBody,
  'example-guardrails-flex-goals': exampleGuardrailsFlexBody,
  'example-annuity-purchases-estate': exampleAnnuityEstateBody,
  'example-glidepath-allocation': exampleGlidepathAllocationBody,
  'example-hsa-property-depth': exampleHsaPropertyDepthBody,
  'example-fixed-target-spending': exampleFixedTargetSpendingBody,
  'example-no-annuity-brokerage': exampleNoAnnuityBrokerageBody,
  'example-static-allocation-control': exampleStaticAllocationControlBody,
  'example-brokerage-no-hsa': exampleBrokerageNoHsaBody,
  'example-all-401k-no-bridge': exampleAll401kNoBridgeBody,
  'example-brokerage-bridge-401k': exampleBrokerageBridge401kBody,
  'example-no-head-start-grad': exampleNoHeadStartGradBody,
  'example-trump-account-head-start': exampleTrumpAccountHeadStartBody,
}

/**
 * "Widow's penalty and survivor tax brackets" - a Withdrawals and Roth P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const widowsPenaltyAndSurvivorBracketsArticle: LearningArticle = {
  slug: 'widows-penalty-and-survivor-brackets',
  title: "Widow's penalty and survivor tax brackets",
  description: 'Why a surviving spouse can face higher tax on similar income.',
  category: 'withdrawals-roth',
  tags: ['widow penalty', 'survivor', 'filing status', 'tax brackets', 'social security survivor', 'roth conversion'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
    'https://www.irs.gov/forms-pubs/about-publication-501',
    'https://www.ssa.gov/benefits/survivors/',
  ],
  relatedArticles: [
    'planning-for-couples-and-survivor-years',
    'spousal-and-survivor-benefits',
    'appealing-irmaa-ssa-44',
    'roth-conversion-basics',
    'rmds-required-minimum-distributions',
    'marginal-vs-effective-tax-rate',
  ],
  relatedPlannerRoutes: ['/plan/:planId/household', '/plan/:planId/survivor', '/plan/:planId/results', '/plan/:planId/social-security-analysis'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'The widow\'s penalty is the planning problem that can appear after one spouse dies: the household may have less income, but the survivor often files under a smaller tax bracket structure. That can make similar income more expensive after the first death.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A surviving spouse may eventually move from married filing jointly to single filing status.',
        'Some income may fall, but RMDs, pensions, Social Security, and investment income can remain large.',
        'Roth conversions during joint years can sometimes reduce later survivor-year pressure.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Married filing jointly brackets and deductions are generally wider than single brackets. When the survivor later files as single, the same taxable income can land higher in the bracket stack. At the same time, the survivor may still have a large traditional IRA, taxable investments, part of a pension, and the larger Social Security benefit.\n\nThat combination is why a plan that looks tax-efficient for the couple can still have a survivor-year tax problem.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/widows-penalty-survivor-brackets.webp' },
      caption:
        'After the first death, a household can move from a wider joint filing lane into a narrower survivor filing lane.',
      alt: 'Two household income ribbons flow through a wider tax ladder, then later narrow into one survivor household and a smaller tax ladder with a pressure marker.',
    },
    { type: 'heading', text: 'What changes in survivor years' },
    {
      type: 'table',
      caption: 'The survivor year is not just the couple year divided by two.',
      columns: ['Plan item', 'What may happen', 'Why it matters'],
      rows: [
        ['Filing status', 'Often shifts from joint to single after transition rules', 'Brackets and deductions can shrink'],
        ['Social Security', 'Survivor may keep the larger benefit instead of both checks', 'Income falls, but not always by half'],
        ['Pension', 'May continue partly or fully, depending on survivor election', 'Taxable income can remain meaningful'],
        ['Traditional accounts', 'Survivor may inherit the whole balance', 'Future RMDs may hit a smaller bracket structure'],
        ['Medicare premiums', 'IRMAA uses single thresholds while the lookback still shows joint income', 'Form SSA-44 can re-price the two affected years on current income'],
        ['Spending', 'Often falls, but housing and healthcare may not fall proportionally', 'Cash need can stay high'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Evans household',
      assumptions: [
        { label: 'Joint years', value: '$120,000 taxable income using married filing jointly brackets' },
        { label: 'Survivor years', value: '$82,000 taxable income after one check stops but similar IRA RMDs continue' },
        { label: 'Planning lever', value: '$25,000 annual conversions before the first death may reduce later RMDs' },
      ],
      summary:
        'The survivor has less income, but also a narrower filing structure. Testing $25,000 conversions now can show whether reducing later RMDs softens that survivor-year tax squeeze.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden models survivor years by changing filing status after the first death and applying a simplified Social Security survivor step-up. This is enough to reveal survivor-year tax pressure, but it is not a full estate, probate, beneficiary, or tax-return filing model.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Looking only at the couple\'s lifetime average tax rate.',
        'Assuming expenses and income both fall neatly by half.',
        'Ignoring the survivor when sizing Roth conversions.',
        'Treating the phrase widow\'s penalty as only a tax issue; Social Security, pensions, healthcare, and housing all matter too.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: "Use **Household** to set planning ages, **Social Security analysis** to compare survivor-sensitive claiming choices, and **Results** to inspect taxes, RMDs, and balances after one spouse dies. For couples, the **Survivor transition** view sweeps earlier death timings on your own plan — filing shift, survivor Social Security, IRMAA with and without SSA-44 relief, and the convert-while-joint lever — and **Spending → Healthcare** has the opt-in SSA-44 toggles.",
    },
  ],
}

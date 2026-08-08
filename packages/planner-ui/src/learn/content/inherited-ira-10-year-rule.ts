/**
 * "Inherited IRA 10-year rule" - a Withdrawals and Roth P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const inheritedIraTenYearRuleArticle: LearningArticle = {
  slug: 'inherited-ira-10-year-rule',
  title: 'Inherited IRA 10-year rule',
  description: 'How most non-spouse heirs must empty an inherited IRA within ten years.',
  category: 'withdrawals-roth',
  tags: ['inherited ira', 'beneficiary ira', '10-year rule', 'rmd', 'secure act', 'ordinary income'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-08-08',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/required-minimum-distributions-for-ira-beneficiaries',
    'https://www.irs.gov/publications/p590b',
  ],
  relatedArticles: [
    'rmds-required-minimum-distributions',
    'beneficiaries-and-account-titling',
    'after-tax-estate',
    'rule-of-55-and-72t',
    'widows-penalty-and-survivor-brackets',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'An inherited IRA is a retirement account received as a beneficiary. For many non-spouse beneficiaries, the inherited account must be emptied by the end of the tenth year after the original owner died. That can concentrate taxable income into a short window.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The 10-year rule is about when the inherited account must be emptied.',
        'If the original owner had already started RMDs, annual beneficiary RMDs may also apply in years 1 through 9.',
        'Inherited traditional-account distributions are taxable income, but they are not subject to the 10% early-withdrawal penalty.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A normal IRA can often be planned around the owner\'s age and required minimum distribution rules. An inherited IRA is different. The beneficiary may have to move the money out much faster, and withdrawals from an inherited traditional IRA can stack on top of wages, Roth conversions, pensions, Social Security taxation, and Medicare-related income.\n\nThe hard part is not only "empty it by year ten." It is choosing when to take taxable income inside that window.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/inherited-ira-10-year-rule.webp' },
      caption:
        'The inherited IRA window can force taxable distributions into a shorter timeline than the beneficiary expected.',
      alt: 'An inherited traditional account bucket drains across a ten-year timeline, with small annual gates and a final empty-the-bucket gate at the end.',
    },
    {
      type: 'table',
      caption: 'Two inherited-IRA questions to separate.',
      columns: ['Question', 'If yes', 'Planning effect'],
      rows: [
        ['Did the decedent have to take RMDs already?', 'Annual beneficiary RMDs may apply in years 1 through 9', 'The beneficiary may not be able to wait until year 10'],
        ['Does the 10-year deadline apply?', 'The account must be empty by the end of the tenth year', 'Income may need to be spread across the window'],
        ['Is the beneficiary young?', 'The 10% early-withdrawal penalty does not apply to inherited IRA distributions', 'Tax still applies; penalty relief is not tax relief'],
      ],
    },
    { type: 'heading', text: 'Surviving spouse options' },
    {
      type: 'prose',
      md: 'A surviving spouse is not limited to the ordinary 10-year pattern. Common paths include remaining a beneficiary on a life-expectancy schedule, electing a 10-year payout when the law allows, or treating the account as the spouse\'s own IRA when eligibility rules are met. Each path changes when annual amounts are due and when the account leaves inherited status.\n\nRetireGolden models these choices only when beneficiary details name a surviving spouse and record the election. Unsettled regulatory readings, such as the proposed spouse-as-employee treatment, are disclosed rather than presented as filing-grade answers.',
    },
    { type: 'heading', text: 'Eligible designated beneficiaries' },
    {
      type: 'prose',
      md: 'Some beneficiaries qualify as an **eligible designated beneficiary** (EDB): a surviving spouse, a minor child of the owner, a disabled or chronically ill person, or someone not more than 10 years younger than the owner. An EDB may follow a life-expectancy schedule instead of the plain 10-year rule, with a 10-year tail after a minor child reaches majority.\n\nThe planner does not infer EDB status from age alone. When beneficiary details record an EDB category, the model can schedule life-expectancy amounts and name the final deadline. Confirm disability, chronic illness, and beneficiary standing with a tax professional; the app records what you enter, not what a custodian or the IRS has accepted.',
    },
    { type: 'heading', text: 'Inherited Roth' },
    {
      type: 'prose',
      md: 'Inherited Roth IRAs follow post-death distribution rules, but the tax picture differs. Distributions are not subject to the 10% early-withdrawal penalty. Qualified earnings can be tax-free when the owner\'s five-taxable-year period is satisfied; otherwise earnings may be includible in income.\n\nInherited Roth accounts require beneficiary details in RetireGolden. The model treats the original Roth owner as having died before the required beginning date and schedules the inherited distribution window accordingly. Taxability of non-qualified earnings is flagged for review when the five-year start year is unknown.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Kim household',
      assumptions: [
        { label: 'Inherited account', value: '$300,000 traditional IRA received after a parent dies' },
        { label: 'Spread approach', value: '$30,000 a year for 10 years before growth and required details' },
        { label: 'Delay approach', value: 'Waiting could force a much larger taxable distribution near year 10' },
      ],
      summary:
        'A rough $30,000 annual spread is easier to fit around other income than a large final-year lump. The right schedule still depends on brackets, Medicare exposure, and cash needs.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden lets a traditional or Roth account be marked as inherited. Every inherited account records the original owner\'s death year, whether the decedent had started RMDs, and the beneficiary owner in the plan. Optional **beneficiary details** upgrade an account from the simpler planning estimate to a sourced schedule when the facts support one, for example annual amounts under the 10-year rule with annual required amounts, a pre-RBD 10-year-only window, spouse life-expectancy or treat-as-own paths, EDB life-expectancy, or inherited-Roth schedules. The model forces taxable, penalty-free distributions when required, empties the account by the applicable deadline, and surfaces the schedule details on Results. Inherited accounts are not used as Roth conversion sources.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'Model note: accounts with beneficiary details follow sourced IRS tables and schedule rules when the facts support a schedule. Legacy two-field accounts, death year and whether RMDs had started, with no beneficiary details, keep the simpler planning estimate so older plans still run. Neither path is filing-grade; confirm unsettled readings, limitations, and items the model does not cover with a tax professional.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming the beneficiary can stretch inherited IRA withdrawals over their whole lifetime.',
        'Waiting until year ten without testing the tax spike.',
        'Trying to convert an inherited traditional IRA to Roth in the model.',
        'Confusing penalty-free inherited distributions with tax-free distributions.',
        'Leaving beneficiary details blank and treating the planning estimate as a compliance schedule.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to mark an account as inherited, enter the original owner death year, and open **Beneficiary details** when you know the beneficiary class, EDB category, spouse election, or inherited-Roth five-year start year. Use **Results** to inspect per-account inherited schedules, schedule type, facts relied on, final deadline, annual requirements, and any flags for anything the model does not cover. Use **Report** for the compact inherited-schedule appendix.',
    },
  ],
}

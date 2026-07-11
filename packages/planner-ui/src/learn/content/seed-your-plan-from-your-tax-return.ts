/**
 * "Seed your plan from your tax return" — Using RetireGolden article for the
 * 1040 guided seed flow (onboarding-import-and-migration step 6).
 */

import type { LearningArticle } from '../learningRegistry'

export const seedYourPlanFromYourTaxReturnArticle: LearningArticle = {
  slug: 'seed-your-plan-from-your-tax-return',
  title: 'Seed your plan from your tax return',
  description: 'A dozen lines off last year\'s Form 1040 give a new plan its income, filing, and bracket context in minutes.',
  category: 'using-retiregolden',
  tags: ['1040', 'tax return', 'import', 'onboarding', 'agi', 'magi'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-07-08',
  reviewCadence: 'annual',
  sourceUrls: ['https://www.irs.gov/forms-pubs/about-form-1040'],
  relatedArticles: [
    'moving-to-retiregolden',
    'agi-magi-and-taxable-income',
    'assumption-recent-magi',
    'irmaa-two-year-lookback',
    'how-social-security-is-taxed',
  ],
  relatedPlannerRoutes: ['/import', '/plan/:planId/income', '/plan/:planId/accounts'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'The single richest snapshot of your financial life is a document you already have: last year\'s Form 1040. The **start from your tax return** path in the Import & migrate wizard asks for about a dozen line values — typed by you, no PDF upload, nothing leaving your device — and turns them into a draft plan with the income picture and tax context already in place.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'You type the values yourself off the printed lines — guided entry, not document scanning.',
        'The flow prefills income streams, filing status, state, and the MAGI that Medicare\'s IRMAA surcharge looks back at.',
        'Everything prefigured is labeled "from your 1040" on the review checklist and stays editable.',
        'A tax return shows income, not spending or balances — the checklist tells you exactly what to add next.',
      ],
    },
    { type: 'heading', text: 'What each line becomes' },
    {
      type: 'table',
      caption: 'How the 1040 lines map into the draft plan.',
      columns: ['1040 line', 'What it becomes', 'Watch for'],
      rows: [
        ['Header — filing status, state', 'Household filing status and state of residence', 'Move planned? Set it on the Household screen'],
        ['1a — wages', 'A wages income stream until retirement', 'Joint filers: split wages between spouses afterward'],
        ['2b + 3a/3b — interest & dividends', 'An estimated taxable account sized so those yields make sense', 'An estimate — replace with your real balance and basis'],
        ['4b — IRA distributions', 'A pointer to add your IRA/401(k) balances', 'Withdrawals are modeled from balances, not history'],
        ['5b — pensions & annuities', 'A pension paying that amount monthly', 'Check the COLA and survivor percentage'],
        ['6a — Social Security benefits', 'A benefit basis, assuming a claim at 67', 'Claimed earlier or later? Fix the claim age'],
        ['7 — capital gain or loss', 'Guidance only (a loss points at the carryforward field)', 'Last year\'s gains are not projected forward'],
        ['11 + 2a — AGI + tax-exempt interest', 'The recent-MAGI assumption for IRMAA\'s two-year lookback', 'This is why early-year Medicare premiums look right'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Okafor household',
      assumptions: [
        { label: 'Return in hand', value: 'Joint return: $12,500 of interest + dividends, $40,000 of IRA distributions, $36,000 of Social Security, $110,000 AGI' },
        { label: 'Ten minutes of typing', value: 'Draft plan with pension-free income streams, an estimated ~$500,000 taxable account, and MAGI context set' },
        { label: 'Checklist follow-ups', value: 'Add the real IRA balances, correct the estimated taxable balance, set the real Social Security claim ages' },
      ],
      summary:
        'The 1040 seeds the shape of the plan in one sitting; the checklist turns "what do I enter next?" into three concrete follow-ups.',
    },
    { type: 'heading', text: 'Why the estimates are estimates' },
    {
      type: 'prose',
      md: 'A tax return reports income *from* assets, not the assets themselves. The wizard sizes the estimated taxable account by asking what balance would plausibly produce your interest and dividends at a typical yield — useful scaffolding, but the real number is on your statements. The same honesty applies to Social Security: line 6a shows what you received, so the wizard assumes a full-retirement-age claim and tells you to correct the claim age if that\'s wrong.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating the estimated taxable balance as real — replace it with the statement value.',
        'Leaving combined wages on one spouse in a joint plan (retirement dates then apply to the wrong person).',
        'Forgetting spending: nothing on a 1040 says what you spend — the Spending screen is the next stop.',
        'Using this flow to re-enter a plan you already have in RetireGolden — restore the backup instead.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'From the planner home, choose **Import from a file → Your tax return (Form 1040)**. After saving the draft, the review checklist\'s "Not imported" group is your to-do list, starting with the Accounts and Spending screens.',
    },
  ],
}

/**
 * "Where the money comes from and goes" - Using RetireGolden coverage for
 * the Results year cash-flow drill-down.
 */

import type { LearningArticle } from '../learningRegistry'

export const whereTheMoneyComesFromAndGoesArticle: LearningArticle = {
  slug: 'where-the-money-comes-from-and-goes',
  title: 'Where the money comes from and goes',
  description:
    "How to read a year's cash, taxes, and account-to-account moves in the Results flow view.",
  category: 'using-retiregolden',
  tags: ['cash flow', 'results', 'withdrawals', 'roth conversion', 'rmd', 'shortfall', 'transfers'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-08-21',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'how-to-read-a-retirement-projection',
    'reading-the-results-page',
    'todays-dollars-vs-future-dollars',
    'roth-conversion-basics',
    'rmds-required-minimum-distributions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/results'],
  currentYearSensitive: false,
  priority: 'P1',
  featured: false,
  blocks: [
    {
      type: 'prose',
      md: 'A year in Results can show a tax line, a Roth conversion, and a withdrawal in the same row. Those are not the same kind of money. This article shows how to read the year drill-down: cash the household could spend, tax that used some of that cash, and moves that never entered a pocket.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Cash you can spend and money you pay tax on are different pictures. A Roth conversion can raise tax without putting new cash in your pocket.',
        '**View flow** on a Results year opens two pictures: **Cash flow** (sources and funded uses) and **Transfers** (account-to-account moves kept separate so the same dollar is not counted twice).',
        'A shortfall branch is spending the plan did not fund. It is never drawn as if it was paid.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'On the Results year table, each row has a **View flow** button. It opens that year as a diagram plus a full table.\n\n**Cash flow** answers: what cash was available this year, and where did the funded part go? **Transfers** answers: what moved between accounts, to a charity, or stayed invested, without becoming household cash? The two views exist because one picture cannot show both without counting some dollars twice.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'The diagram is a picture of one modeled year under the assumptions you entered. It is not a bank statement and not a tax return. The table lists every line, including items the diagram leaves off.',
    },
    { type: 'heading', text: 'Cash you can spend vs money you pay tax on' },
    {
      type: 'prose',
      md: '**Taxable income** is money the tax rules count. **Cash available to spend** is money that actually arrived this year: a paycheck, Social Security, a pension, or a withdrawal from an account.\n\nA [Roth conversion](/learn/roth-conversion-basics) moves money from a traditional Individual Retirement Account (IRA) or similar pre-tax account into a Roth account. The dollars stay invested. They do not become cash you can spend that year. The converted amount is often taxable, so the **Settled tax** use on Cash flow can rise while the conversion itself sits on Transfers.\n\nA [required minimum distribution (RMD)](/learn/rmds-required-minimum-distributions) is a withdrawal the tax rules eventually require from most pre-tax accounts. That withdrawal is often taxable. The cash comes from savings you already owned, not from a new paycheck. If you already needed a withdrawal of that size for spending, the RMD is that withdrawal (or part of it), not extra cash on top. If the required amount is larger than spending, leftover cash can show as **Surplus** that later appears on Transfers as money going back into an account.',
    },
    {
      type: 'scenario',
      name: 'The Ortiz household',
      assumptions: [
        { label: 'Income', value: '$36,000 Social Security' },
        { label: 'Portfolio withdrawal', value: '$24,000 RMD from a traditional IRA' },
        { label: 'Transfer', value: '$40,000 Roth conversion, traditional IRA to Roth IRA' },
        { label: 'Spending', value: '$50,000' },
      ],
      summary:
        'Cash available in this simplified picture is **$36,000 + $24,000 = $60,000**. The **$40,000** conversion is not in that total. It can still raise the tax line. Spending and tax are uses of the $60,000. This is a reading aid, not a tax calculation.',
    },
    {
      type: 'formula',
      expression: 'cash available = income + withdrawals from accounts',
      where: [
        { symbol: 'income', meaning: 'Social Security, pension, wages, and similar cash from outside the accounts' },
        { symbol: 'withdrawals from accounts', meaning: 'money taken from savings, including an RMD taken in cash' },
        { symbol: 'cash available', meaning: 'the Cash flow sources; the Source total on the dialog' },
      ],
      basis: 'nominal',
      note: 'Roth conversions, IRA gifts to charity, and reinvested dividends are not in this total. They appear on Transfers. The dialog follows the Results today\'s-dollars / nominal-dollars toggle; this reading aid uses nominal dollars.',
    },
    { type: 'heading', text: 'Portfolio withdrawals vs income' },
    {
      type: 'prose',
      md: 'On Cash flow, income and withdrawals can both feed the same middle, labeled **Household cash**. They are not the same job.\n\nIncome is cash that arrived from outside the accounts: wages, Social Security, a pension. A withdrawal reduces an account balance. An RMD taken in cash is a withdrawal, labeled **Required minimum distribution**. A later withdrawal to cover remaining spending is often labeled **Need-based withdrawal**.',
    },
    {
      type: 'table',
      caption: 'What a common line means in the year drill-down.',
      columns: ['What moved', 'Cash you can spend this year?', 'Can raise the tax line?', 'Where you see it'],
      rows: [
        ['Social Security, pension, or wages', 'Yes', 'Sometimes', 'Cash flow, as income'],
        ['Withdrawal from an account, including an RMD taken in cash', 'Yes, from that account', 'Often, when the account is pre-tax', 'Cash flow, as a portfolio withdrawal'],
        ['Roth conversion', 'No. The dollars stay in a Roth account.', 'Often', 'Transfers. Any tax is a use on Cash flow.'],
        ['Gift from an IRA to charity', 'No. The dollars go to the charity.', 'The gift itself is not household spending', 'Transfers'],
        ['Reinvested dividend or interest', 'No. The dollars stayed in the account.', 'The dividend or interest can still be taxable', 'Transfers, as reinvested yield'],
        ['Contribution into an account', 'This uses cash you already had', 'Not a second source of cash', 'Cash flow as a funded use, and Transfers as the account credit. Do not add the two.'],
      ],
    },
    { type: 'heading', text: 'Why transfers have their own view' },
    {
      type: 'prose',
      md: 'Some moves never become household cash, or they become cash first and then get credited to an account. **Transfers** shows those from-and-to pairs so Cash flow can stay a spendable-money picture.\n\nA Roth conversion is the clearest case: traditional account to Roth account. A [qualified charitable distribution (QCD)](/learn/qcds-qualified-charitable-distributions) is a gift sent from an IRA straight to a charity. Those dollars never become household cash, even when they help satisfy an RMD. A contribution uses household cash and then credits the destination account. Surplus leftover cash can do the same.\n\nIf you add a Cash flow total to a Transfers total, you can count the same dollar twice. The dialog keeps the views separate for that reason.',
    },
    { type: 'heading', text: 'Reinvested dividends' },
    {
      type: 'prose',
      md: 'A dividend or interest payment that stayed in a taxable account is labeled **Reinvested yield** on Transfers. The money did not leave the account, so it is not a Cash flow source and not household spending.\n\nThe same payment can still be taxable. When that happens, the tax is a use on Cash flow. The reinvested dollars themselves stay on Transfers.',
    },
    { type: 'heading', text: 'What a shortfall branch means' },
    {
      type: 'prose',
      md: 'The summary strip shows **Source total**, **Funded uses**, **Surplus**, and **Shortfall**. Funded uses are the spending, tax, and other outflows the year actually covered.\n\nA shortfall branch is the part of requested spending the plan did not fund. On the diagram it starts from a separate **Unfunded** side, not through Household cash. It is never drawn as if it was paid. The table shows requested, funded, and unfunded amounts on the same use line so you can see the miss without treating it as cash that moved.',
    },
    {
      type: 'callout',
      tone: 'warn',
      md: 'If a year cannot be fully accounted for, the dialog shows an explanation instead of a chart. The app shows you the limitation rather than guessing. **Download detail CSV** is still available.',
    },
    { type: 'heading', text: "Today's dollars vs nominal dollars" },
    {
      type: 'prose',
      md: 'The drill-down follows the same **Today\'s $ / Nominal $** toggle as the rest of Results. The dialog states **Amounts in today\'s dollars** or **Amounts in nominal dollars** so the picture stays in parity with the year table you opened.\n\n**Download detail CSV** is different. It lists every line for that year in nominal dollars, not the on-screen toggle. Use it when you want the full line list in a spreadsheet. Do not compare those nominal cells to a today\'s-dollar diagram as if they were the same units.',
    },
    { type: 'heading', text: 'Small lines and the full table' },
    {
      type: 'prose',
      md: 'Small Cash flow lines of the same kind can group into **Other (n)**. **Show all** lists each of those lines on the diagram. Transfer endpoints stay separate. The table under the diagram is already complete: one row per line, whether or not the chart grouped anything.\n\nThe table also keeps lines the diagram omits: tax-only notes, and money that arrived after that year\'s spending was already decided. Those rows are not extra Cash flow sources.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating a Roth conversion as extra spending money. It is a transfer. The tax on it is the cash use.',
        'Adding Cash flow totals to Transfers totals and reading the sum as one pile of money.',
        'Reading a shortfall branch as a bill that was paid. It is the part that was not funded.',
        'Comparing the on-screen today\'s-dollar picture to the detail CSV. The CSV is nominal.',
        'Treating **Other (n)** as money the model invented. It is a grouping of small real lines. The table already lists each one.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Open **View flow** on a year row on **Results**. Switch **Cash flow** and **Transfers** for the same year. Use **Show all** when small lines are grouped. Use **Download detail CSV** when you want every line in nominal dollars.\n\nFor the rest of the Results page, see [Reading the Results page](/learn/reading-the-results-page). For today\'s dollars vs future dollars, see [Today\'s dollars vs future dollars](/learn/todays-dollars-vs-future-dollars).',
    },
  ],
}

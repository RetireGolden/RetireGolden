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
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/roth-iras',
    'https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs',
    'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-iras-distributions-withdrawals',
  ],
  relatedArticles: [
    'how-to-read-a-retirement-projection',
    'reading-the-results-page',
    'todays-dollars-vs-future-dollars',
    'roth-conversion-basics',
    'rmds-required-minimum-distributions',
    'qcds-qualified-charitable-distributions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/results'],
  currentYearSensitive: true,
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
        '**View flow** on a Results year opens two pictures: **Cash flow** (sources and funded uses) and **Transfers** (direct moves that never enter your pocket, kept separate so the same dollar is not counted twice). Transfers include gifts from an IRA to a charity, money set aside into accounts from your cash, and dividends that stayed invested, not only account-to-account moves.',
        'A shortfall branch is an unfunded use. It is usually spending. In a hard year it can be the tax bill or a planned contribution that cash could not cover. It is never drawn as if it was paid.',
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
      md: '**Taxable income** is money the tax rules count. **Cash available to spend** is money that actually arrived this year: money coming in from outside (paychecks, Social Security, pensions), money paid out by your accounts and holdings (dividends and interest you did not reinvest, TIPS ladder cash), money taken from accounts, and loan or sale proceeds.\n\nA [Roth conversion](/learn/roth-conversion-basics) moves money from a traditional Individual Retirement Account (IRA) or similar pre-tax account into a Roth account. The dollars stay invested. They do not become cash you can spend that year. The converted amount is often taxable, so the **Settled tax** use on Cash flow can rise while the conversion itself sits on Transfers.\n\nA [required minimum distribution (RMD)](/learn/rmds-required-minimum-distributions) is a withdrawal the tax rules eventually require from most pre-tax accounts. That withdrawal is often taxable. The cash comes from savings you already owned, not from a new paycheck. If you already needed a withdrawal of that size for spending, the RMD is that withdrawal (or part of it), not extra cash on top. If the required amount is larger than spending, leftover cash can show as **Surplus** that later appears on Transfers as money going back into an account.',
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
        'Cash available in this simplified picture is **$36,000 + $24,000 = $60,000**. The **$40,000** conversion is not in that total. It can still raise the tax line. This example has no loan or sale proceeds and no dividends, interest, or TIPS ladder cash paid out to the household. Spending and tax are uses of the $60,000. This is a reading aid, not a tax calculation.',
    },
    {
      type: 'formula',
      expression:
        'cash available = money coming in from outside + money paid out by your accounts and holdings + money taken from accounts + loan or sale proceeds',
      where: [
        { symbol: 'money coming in from outside', meaning: 'paychecks, Social Security, pensions, and similar cash that arrived from outside your accounts' },
        { symbol: 'money paid out by your accounts and holdings', meaning: 'dividends and interest you did not reinvest, including tax-exempt interest, and TIPS ladder cash' },
        { symbol: 'money taken from accounts', meaning: 'withdrawals from savings, including an RMD taken in cash' },
        { symbol: 'loan or sale proceeds', meaning: 'cash from a reverse-mortgage draw or a home sale' },
        { symbol: 'cash available', meaning: 'the Cash flow sources; the Source total on the dialog' },
      ],
      basis: 'nominal',
      note: 'Roth conversions, IRA gifts to charity, and reinvested dividends are not in this total. They appear on Transfers. When the plan includes a property\'s cost basis, a home sale\'s net cash counts among that year\'s sources; without a cost basis, proceeds are deposited after the year\'s spending is settled, so they appear in the detail table but not in the diagram\'s Source total. The dialog follows the Results today\'s-dollars / nominal-dollars toggle; this reading aid uses nominal dollars.',
    },
    { type: 'heading', text: 'Portfolio withdrawals vs income' },
    {
      type: 'prose',
      md: 'On Cash flow, money coming in from outside, money paid out by your accounts and holdings, money taken from accounts, and loan or sale proceeds can all feed the same middle, labeled **Household cash**. They are not the same job.\n\nMoney coming in from outside is a paycheck, Social Security, or a pension. Money paid out by your accounts and holdings is dividends and interest you did not reinvest, including tax-exempt interest, and TIPS ladder cash. Those dollars are spendable even though they are not a new paycheck and not a withdrawal. A withdrawal reduces an account balance. An RMD taken in cash is a withdrawal, labeled **Required minimum distribution**. A later withdrawal to cover remaining spending is often labeled **Need-based withdrawal**. Loan or sale proceeds are cash from a reverse-mortgage draw or a home sale. They are sources, not income from work or benefits.',
    },
    {
      type: 'table',
      caption: 'What a common line means in the year drill-down.',
      columns: ['What moved', 'Cash you can spend this year?', 'Can raise the tax line?', 'Where you see it'],
      rows: [
        ['Social Security, pension, or wages', 'Yes', 'Sometimes', 'Cash flow, as income'],
        ['Withdrawal from an account, including an RMD taken in cash', 'Yes, from that account', 'Often, when the account is pre-tax', 'Cash flow, as a portfolio withdrawal'],
        ['Roth conversion', 'No. The dollars stay in a Roth account.', 'Often', 'Transfers. Any tax is a use on Cash flow.'],
        ['Gift from an IRA to charity', 'No. The dollars go to the charity.', 'Only the portion that qualifies as a [qualified charitable distribution (QCD)](/learn/qcds-qualified-charitable-distributions) avoids ordinary income. An amount beyond the eligible limit can raise the tax line even though it never becomes spendable cash.', 'Transfers'],
        ['Reinvested dividend or interest', 'No. The dollars stayed in the account.', 'The dividend or interest can still be taxable', 'Transfers, as reinvested yield'],
        ['Contribution into an account', 'This uses cash you already had', 'Traditional and HSA: lower taxable income. Roth and taxable: no change that year.', 'Cash flow as a funded use, and Transfers as the account credit. Do not add the two.'],
      ],
    },
    {
      type: 'prose',
      md: 'Contributions into traditional or HSA accounts lower that year\'s taxable income in the projection. Contributions into Roth or taxable accounts do not change taxable income that year. The cash still leaves household cash on Cash flow and credits the account on Transfers.',
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
      md: 'The summary strip shows **Source total**, **Funded uses**, **Surplus**, and **Shortfall**. Funded uses are the spending, tax, and other outflows the year actually covered.\n\nA shortfall branch is an unfunded use. It is usually spending the plan did not fund. After those spending layers are covered, a hard year can leave the tax bill or a planned contribution as the thing cash could not cover. On the diagram it starts from a separate **Unfunded** side, not through Household cash. It is never drawn as if it was paid. The table shows requested, funded, and unfunded amounts on the same use line so you can see the miss without treating it as cash that moved.',
    },
    {
      type: 'callout',
      tone: 'warn',
      md: 'For a year the engine cannot fully account for, the whole drill-down is replaced by the explanation: the summary, the table, and the chart. The app shows you the limitation rather than guessing. **Download detail CSV** is still available. That download then contains only the summary row.',
    },
    { type: 'heading', text: "Today's dollars vs nominal dollars" },
    {
      type: 'prose',
      md: 'The drill-down follows the same **Today\'s $ / Nominal $** toggle as the rest of Results. The dialog states **Amounts in today\'s dollars** or **Amounts in nominal dollars** so the picture stays in parity with the year table you opened.\n\n**Download detail CSV** is different. For a year the engine fully accounts for, it lists every line in nominal dollars, not the on-screen toggle. For a year the engine cannot fully account for, the whole drill-down is replaced by the explanation, and the download then contains only the summary row. Use the full export when you want the complete line list in a spreadsheet. Do not compare those nominal cells to a today\'s-dollar diagram as if they were the same units.',
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
        'Reading a shortfall branch as a bill that was paid. It is an unfunded use, not cash that moved.',
        'Comparing the on-screen today\'s-dollar picture to the detail CSV. The CSV is nominal. A year the engine cannot fully account for downloads only the summary row.',
        'Treating **Other (n)** as money the model invented. It is a grouping of small real lines. The table already lists each one.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Open **View flow** on a year row on **Results**. Switch **Cash flow** and **Transfers** for the same year. Use **Show all** when small lines are grouped. Use **Download detail CSV** when you want the nominal-dollar line list for a year the engine fully accounts for.\n\nFor the rest of the Results page, see [Reading the Results page](/learn/reading-the-results-page). For today\'s dollars vs future dollars, see [Today\'s dollars vs future dollars](/learn/todays-dollars-vs-future-dollars).',
    },
  ],
}

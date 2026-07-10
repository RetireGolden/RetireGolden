/**
 * "Real estate, home equity, and debt in a plan" - an Accounts and Saving P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const realEstateHomeEquityDebtArticle: LearningArticle = {
  slug: 'real-estate-home-equity-and-debt',
  title: 'Real estate, home equity, and debt in a plan',
  description: 'How a home, rentals, and loans show up in net worth and cash flow.',
  category: 'accounts-saving',
  tags: ['real estate', 'home equity', 'debt', 'mortgage', 'property tax', 'net worth'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/forms-pubs/about-publication-523',
    'https://www.consumerfinance.gov/consumer-tools/reverse-mortgages/',
  ],
  relatedArticles: [
    'account-types-overview',
    'taxable-brokerage-basis-and-capital-gains',
    'after-tax-estate',
    'state-income-taxes-in-retirement',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/spending', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A home can be both a place to live and a large part of net worth. Debt can be both a balance-sheet liability and a cash-flow obligation. A useful retirement plan keeps those two views separate so the house does not accidentally look like spendable portfolio money.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Property value affects net worth, but it usually does not fund spending unless you sell, borrow, or downsize.',
        'Mortgage or loan payments are cash-flow expenses until the balance is gone.',
        'Property tax and insurance can continue after a mortgage is paid off, so they belong with the property, not only inside the loan payment.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A paid-off home can make retirement easier because the mortgage payment is gone. It can also make planning harder because home equity is not the same as a brokerage account. To spend it, you usually need a transaction: sale, refinance, reverse mortgage, home equity line, or another arrangement with costs and risks.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/real-estate-home-equity-debt.webp' },
      caption:
        'Real estate adds value to net worth, while debt service and property carrying costs still flow through annual spending.',
      alt: 'A home value block sits above a net-worth line while separate ribbons for debt payments, property tax, and insurance flow into yearly spending.',
    },
    {
      type: 'table',
      caption: 'Separate the balance sheet from the cash flow.',
      columns: ['Item', 'Balance-sheet role', 'Cash-flow role'],
      rows: [
        ['Home or property value', 'Adds to net worth while owned', 'Does not fund spending unless converted to cash'],
        ['Expected sale proceeds', 'Can become investable cash in the sale year', 'May help fund later spending after sale costs and taxes'],
        ['Mortgage or other debt', 'Reduces net worth through the remaining balance', 'Creates scheduled debt service until paid off'],
        ['Property tax and insurance', 'Not a loan balance', 'Recurring cost that can continue after debt payoff'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Nguyen household',
      assumptions: [
        { label: 'Home', value: '$420,000 home owned through the early retirement years' },
        { label: 'Debt', value: '$1,600 monthly mortgage payment ends before age 70' },
        { label: 'Carrying costs', value: '$7,200 a year of property tax and insurance continue afterward' },
      ],
      summary:
        'When the mortgage ends, spending falls by about **$19,200** a year, not by the full housing line. The $7,200 carrying cost still needs to stay in the plan.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden has separate account types for property and debt. A property account stores value, planned sale year, expected net proceeds, property tax, and insurance. A debt account stores balance, interest rate, monthly principal-and-interest payment, and optional payoff year. In the projection, debt service is funded by the withdrawal waterfall, while property carrying costs are tracked as spending while the property is owned.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Counting home equity as if it were already liquid portfolio money.',
        'Putting escrowed property tax and insurance inside the debt payment, which can make those costs disappear after payoff.',
        'Forgetting sale costs, taxes, moving costs, or a replacement housing need when estimating net proceeds.',
        'Modeling a reverse mortgage or home-equity loan as free liquidity instead of a debt or transaction with terms.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** for property and debt. Use **Spending** for lifestyle costs that are not tied to the property account. Then use **Results** to inspect net worth, debt service, property costs, and the effect of any planned sale.',
    },
  ],
}

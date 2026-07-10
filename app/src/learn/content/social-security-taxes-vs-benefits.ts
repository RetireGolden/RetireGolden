/**
 * "Social Security taxes vs. benefits" - a Social Security article.
 */

import type { LearningArticle } from '../learningRegistry'

export const socialSecurityTaxesVsBenefitsArticle: LearningArticle = {
  slug: 'social-security-taxes-vs-benefits',
  title: 'Social Security taxes vs. benefits',
  description: 'What you paid in (OASDI) versus what you get back — and why the comparison is imperfect.',
  category: 'social-security',
  tags: ['social security', 'fica', 'oasdi', 'payroll tax', 'self-employment', 'taxable wage base', 'return'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-29',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/news/en/cola/factsheets/2026.html',
    'https://www.ssa.gov/oact/ProgData/taxRates.html',
    'https://www.ssa.gov/benefits/retirement/planner/applying7.html',
  ],
  relatedArticles: [
    'pia-aime-and-bend-points',
    'social-security-claiming-age-basics',
    'mortality-weighted-social-security',
    'how-social-security-is-taxed',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security-analysis', '/plan/:planId/social-security'],
  currentYearSensitive: true,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'A natural question: "Did I get back what I put into Social Security?" The answer is more nuanced than dividing your benefits by your taxes, because Social Security is **insurance**, not an investment. A "what you paid in vs. what you get back" view is still a useful illustration, as long as you know what it does and does not capture.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'You paid the **OASDI** payroll tax (6.2% as an employee, 12.4% if self-employed) on covered earnings up to each year’s **taxable wage base**.',
        'The "get back" side is the **survival-weighted expected value** of your lifetime benefits — not a literal account balance.',
        'The ratio is an **individual-level illustration**, not the program’s actuarial return, and it excludes the value of disability and survivor insurance, spousal benefits, and Medicare.',
      ],
    },
    { type: 'heading', text: 'What you paid in' },
    {
      type: 'prose',
      md: 'Each paycheck, 6.2% of your covered wages (up to the annual taxable wage base — $184,500 in 2026) goes to the OASDI part of FICA. Your employer pays another 6.2%; the self-employed pay both halves (12.4%) as SECA. This view sums the OASDI tax over your earnings history and **intentionally excludes the 1.45% Medicare HI tax**, because the "get back" side is the retirement benefit, not Medicare. The employer share is shown as context, not added to what you paid.',
    },
    { type: 'heading', text: 'What you get back' },
    {
      type: 'prose',
      md: 'The "get back" figure is the **mortality-weighted expected present value** of your lifetime retirement benefits at your chosen claim age — the same method used by the actuarial "Benefits only" view. Each future year’s benefit is multiplied by the probability you survive to receive it and discounted to today’s dollars at a real rate. This is the *expected* value, not a guarantee; living longer raises it, dying sooner lowers it.',
    },
    { type: 'heading', text: 'What the ratio does not capture' },
    {
      type: 'list',
      items: [
        '**Insurance value:** the payroll tax also buys disability and survivor protection you may never draw but that has real expected value.',
        '**Spousal and family benefits:** a non-working or lower-earning spouse can receive benefits on your record, which the individual ratio ignores.',
        '**Employer share:** if you’re an employee, your employer paid half the OASDI tax — not "your" contribution, but part of the cost of your labor.',
        '**Medicare:** the HI tax funds Medicare, which is excluded from both sides here.',
      ],
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'This is why a low lifetime ratio doesn’t mean Social Security is a "bad deal" for you — the program transfers value toward lower earners, the disabled, survivors, and longer-lived spouses in ways a single ratio can’t show.',
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'On **Social Security analysis** (the Benefits-only tab), expand "What you paid in vs. what you get back." It uses the earnings history you entered on the Social Security step, so enter an earnings record (or import your mySSA statement) to see it. A self-employed toggle applies the 12.4% rate.',
    },
  ],
}

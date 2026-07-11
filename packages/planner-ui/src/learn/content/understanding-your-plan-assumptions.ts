import type { LearningArticle } from '../learningRegistry'

export const understandingYourPlanAssumptionsArticle: LearningArticle = {
  slug: 'understanding-your-plan-assumptions',
  title: "Understanding your plan's assumptions",
  description: 'How RetireGolden uses assumptions to project your retirement success, and where they come from.',
  category: 'using-retiregolden',
  tags: ['assumptions', 'inflation', 'returns', 'longevity', 'rules'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-30',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/oact/TR/2025/2025_Long-Range_Economic_Assumptions.pdf',
    'https://hvsfinancial.com/wp-content/uploads/2026/02/2026-Data-Report.pdf',
    'https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/2026-outlook-economic-upside-stock-market-downside.html',
    'https://www.longevityillustrator.org/',
  ],
  relatedArticles: [
    'using-assumptions-and-provenance',
    'assumption-general-inflation',
    'assumption-healthcare-inflation',
    'assumption-investment-returns',
    'assumption-social-security-cola',
    'assumption-social-security-trust-fund',
    'assumption-longevity-planning-age',
    'assumption-state-tax-override',
    'assumption-recent-magi',
    'assumption-heir-tax-rate',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions'],
  currentYearSensitive: true,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: "A retirement plan is a model of the future. While some numbers in your plan are **facts** (like your current age or account balances) and others are **rules** (like the 2026 tax brackets), the engine also needs **forward-looking assumptions** to project how your money will grow and what it will buy decades from now.",
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Assumptions are the levers that drive your projection: inflation, healthcare costs, returns, Social Security behavior, taxes, MAGI seeds, longevity, and estate-tax treatment.',
        'RetireGolden starts you with research-backed defaults, but every retirement plan is unique—you can override any default to fit your views.',
        "No single number is a guarantee. RetireGolden's Monte Carlo simulation varies returns and inflation around these assumptions to stress-test your plan.",
      ],
    },
    { type: 'heading', text: 'The assumption library' },
    {
      type: 'prose',
      md: 'Each planner-facing assumption has a focused deep dive. Use this table as the index:',
    },
    {
      type: 'table',
      caption: 'Assumption defaults in RetireGolden',
      columns: ['Assumption', 'Default Value', 'Sourced Basis', 'Deep Dive'],
      rows: [
        [
          '**General Inflation**',
          '2.5%',
          'SSA long-range estimate (2.4%), Philly Fed SPF (2.4%), Fed long-run goal (2.0%).',
          '[Read more](/learn/assumption-general-inflation)',
        ],
        [
          '**Healthcare Inflation**',
          '+3.0% over CPI',
          'HealthView Services 2026 projections of 5.8% total long-term retiree healthcare inflation.',
          '[Read more](/learn/assumption-healthcare-inflation)',
        ],
        [
          '**Investment Returns**',
          '5.5% blended',
          "Vanguard's 2026 outlook (4–5% equity) and J.P. Morgan's 2026 LTCMA (6.4% balanced 60/40).",
          '[Read more](/learn/assumption-investment-returns)',
        ],
        [
          '**Longevity (Planning Age)**',
          '95 (floor)',
          'Society of Actuaries guidance to plan for the 75th to 90th percentile of joint survival.',
          '[Read more](/learn/assumption-longevity-planning-age)',
        ],
        [
          '**Social Security COLA**',
          'Match inflation',
          'Social Security COLA is tied to CPI-W; matching general inflation keeps real benefits flat.',
          '[Read more](/learn/assumption-social-security-cola)',
        ],
        [
          '**Social Security Trust Fund**',
          'Off; 2034 / 17% when on',
          '2026 Trustees report: combined OASDI depletion in 2034 with 83% payable.',
          '[Read more](/learn/assumption-social-security-trust-fund)',
        ],
        [
          '**State Tax Override**',
          '0%',
          '0% means use modeled state tax rules; a positive value replaces them with a flat effective rate.',
          '[Read more](/learn/assumption-state-tax-override)',
        ],
        [
          '**Recent MAGI**',
          '$0',
          'Input seed for Medicare IRMAA two-year lookback; 0 means no initial surcharge from recent income.',
          '[Read more](/learn/assumption-recent-magi)',
        ],
        [
          '**Heir Tax Rate**',
          '25%',
          'A mid-bracket estimate for inherited pre-tax retirement balances under the 10-year rule.',
          '[Read more](/learn/assumption-heir-tax-rate)',
        ],
      ],
    },
    { type: 'heading', text: 'Why defaults matter' },
    {
      type: 'prose',
      md: "A minor change in an assumption can compound into a massive difference over 30 or 40 years. For example, assuming healthcare costs grow at CPI + 3% instead of CPI + 2% can add tens of thousands of dollars in projected lifetime expenses, potentially shifting your plan's success rate. RetireGolden defaults to slightly conservative, source-backed values so you don't build a plan on overly optimistic foundations.",
    },
    { type: 'heading', text: 'Watch-outs' },
    {
      type: 'list',
      items: [
        'Do not treat a default as personal advice; it is a starting point you can override.',
        'Change one major assumption at a time when testing sensitivity, or it becomes hard to know what moved the result.',
        'Dated rule packs, such as tax brackets and Medicare thresholds, are different from user-overridable assumptions.',
      ],
    },
    { type: 'heading', text: 'Where to manage these in the app' },
    {
      type: 'prose',
      md: 'You can view and override all forward-looking assumptions on the **Assumptions** screen. For planning ages, you can adjust these per household member under the **Household** step, which feeds into the longevity module. The dated rule packs (like tax brackets and Medicare thresholds) are non-overridable and can be reviewed via the **Disclaimer** page.',
    },
  ],
}

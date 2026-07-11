import type { LearningArticle } from '../learningRegistry'

export const tipsLaddersArticle: LearningArticle = {
  slug: 'tips-ladders',
  title: 'TIPS ladders: a guaranteed real income floor',
  description:
    'How a ladder of inflation-protected Treasuries turns a lump sum into guaranteed inflation-adjusted income — and how RetireGolden prices, taxes, and stress-tests one inside your plan.',
  category: 'risk-uncertainty',
  tags: ['tips', 'income floor', 'inflation', 'bonds', 'safety-first', 'ladder', 'real yield'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-07-08',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://home.treasury.gov/resource-center/data-chart-center/interest-rates',
    'https://www.treasurydirect.gov/marketable-securities/tips/',
    'https://www.irs.gov/publications/p550',
    'https://www.bogleheads.org/wiki/TIPS_ladder',
  ],
  relatedArticles: ['social-security-bridge', 'funded-ratio', 'inflation-risk', 'pensions-and-annuities', 'cola-and-inflation-protection'],
  relatedPlannerRoutes: ['/plan/:planId/income-floor', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  featured: false,
  blocks: [
    {
      type: 'prose',
      md: 'A **TIPS ladder** is a set of Treasury Inflation-Protected Securities chosen so that one bond matures each year, and each maturity (plus the interest the others pay that year) delivers the same amount of **real** — inflation-adjusted — income. Buy the ladder once, and the income arrives on schedule no matter what stocks, rates, or inflation do. It is the closest thing an individual can buy to a DIY inflation-indexed pension, with no insurance company involved.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        '**Guaranteed and inflation-proof**: both principal and coupons index to CPI, and the ladder is backed by the U.S. Treasury — the two risks a bond ladder usually leaves open (inflation and default) are both covered.',
        '**Priced by real yields**: at a ~2.7% long real yield, a 30-year ladder costs roughly 20½ times its annual payout — about a **4.8–4.9% real withdrawal rate**, comfortably above the ~4% rule of thumb for portfolios. When real yields fall, the same income costs more.',
        '**The trade**: the money is committed. A ladder rung spent this year cannot also compound in stocks; the ladder ends when its last rung matures (no longevity pooling like an annuity).',
        '**Tax texture matters**: TIPS interest and the annual inflation adjustment are **federally taxable but exempt from state income tax** — and the inflation adjustment is taxed before you see the cash ("phantom income"), which is why many holders keep TIPS in tax-advantaged accounts. RetireGolden models the taxable-brokerage version, where the state exemption and phantom income actually bite.',
      ],
    },
    { type: 'heading', text: 'How RetireGolden builds one' },
    {
      type: 'prose',
      md: 'On the **Income floor** page you give a target real income, a first payout year, and a last payout year. RetireGolden solves the rung sizes back-to-front — the final year is funded by its maturing bond alone; earlier years by their maturing bond plus the coupons of every rung still outstanding — and prices each rung on an embedded Treasury real-yield curve (the "curve as of" date is shown next to every quote).\n\nThe cost you see is a planning-grade quote, not a brokerage order: coupons pay annually, rungs are par bonds at the interpolated curve yield, and there is no CUSIP-level lot rounding. An optional live-price mode can fetch actual Treasury (FedInvest) closing prices for comparison — it never runs without your click, and the plan itself always works offline on the embedded curve.',
    },
    {
      type: 'formula',
      expression: 'ladder cost ≈ annual real income × Σ 1 ÷ (1 + r)ᵗ  for t = 1…years',
      where: [
        { symbol: 'r', meaning: 'the real (above-inflation) Treasury yield at each maturity' },
        { symbol: 't', meaning: 'years until each rung matures' },
      ],
      basis: 'today',
      note: 'With a flat curve this is exactly the level-annuity present-value factor; the app uses the full curve shape.',
    },
    { type: 'heading', text: 'What happens inside your plan' },
    {
      type: 'prose',
      md: 'The ladder is not a side calculation — its cash flows live inside the same yearly ledger as everything else. The purchase leaves your chosen cash or brokerage account in the purchase year (realizing capital gains pro-rata if it sells appreciated holdings). Each year after that, coupons and any maturing principal arrive as income; the taxable slice (coupons plus that year\'s inflation accretion) flows through federal tax, the Social Security taxability formula, IRMAA, and ACA credits like any other ordinary income — while the state return excludes it. The unmatured rungs ride in your net worth as a dedicated asset the withdrawal engine never raids.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'RetireGolden models ladders held in **taxable** accounts. TIPS inside an IRA are just part of that account\'s balance — model those with the account\'s own allocation instead. The phantom-income and state-exemption mechanics only exist on the taxable side.',
    },
    { type: 'heading', text: 'Ladder, annuity, or portfolio?' },
    {
      type: 'table',
      caption: 'Three ways to fund essential spending',
      columns: ['', 'TIPS ladder', 'Income annuity (SPIA)', 'Stock/bond portfolio'],
      rows: [
        ['Inflation protection', 'Exact (CPI-indexed)', 'Only if you buy a COLA rider', 'Expected, not guaranteed'],
        ['Longevity protection', 'Ends at the last rung', 'Pays for life', 'Depends on markets'],
        ['What heirs get', 'Unmatured rungs', 'Usually nothing (life-only)', 'Whatever remains'],
        ['Guarantee', 'U.S. Treasury', 'Insurer (state guaranty funds)', 'None'],
        ['Liquidity', 'Sellable, at market prices', 'Irreversible', 'Full'],
      ],
    },
    {
      type: 'prose',
      md: 'These are complements, not rivals: a common safety-first shape is a ladder covering the years to 85, a deferred annuity or delayed Social Security covering beyond, and the portfolio funding everything discretionary. The [funded ratio](/learn/funded-ratio) is the lens for deciding how much floor to lock in.',
    },
    { type: 'heading', text: 'Honest boundaries' },
    {
      type: 'list',
      items: [
        '**Planning-grade pricing**: annual coupons, par-bond rungs, no auction/secondary spread. Real quotes (tipsladder.com, your brokerage) will differ by small amounts.',
        '**Curve staleness**: the embedded curve refreshes with the annual parameter packs; the "curve as of" date is always shown. Real yields move — re-quote before you buy.',
        '**OID precision**: the phantom-income model (accretion taxed in the year it accrues) is the standard planning simplification of TIPS OID rules, not a Form 1099-OID reproduction.',
      ],
    },
  ],
}

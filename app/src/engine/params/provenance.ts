/**
 * Provenance for the parameter-pack defaults: the source and key figures behind
 * every tax/limit/benefit number the engine applies. Surfaced in the UI so a
 * user can see where the assumptions come from and verify any that matter.
 *
 * This is a human-maintained summary that travels with the data pack — refresh
 * it in the same annual data-only PR that bumps `data/year<YYYY>.ts`. The
 * concise `figures` strings should track the current pack's values.
 *
 * Full per-figure detail and additional citations: DOCS/domain/domain-rules-reference.md.
 */

export interface ParameterSource {
  /** Stable id (kebab-case), unique within the list. */
  id: string
  /** Short group name shown in the first column, sentence case. */
  label: string
  /** One-line summary of the key figures this group contributes. */
  figures: string
  /** Publisher / primary authority the figures are drawn from. */
  publisher: string
  /** Link to a citable source for the figures. */
  url: string
}

/**
 * One entry per logical assumption group. Order is roughly the order figures
 * appear in a projection (income tax → gains → SS → limits → RMDs → Medicare →
 * SS benefits → ACA → state).
 */
export const PARAMETER_PROVENANCE: ParameterSource[] = [
  {
    id: 'federal-brackets',
    label: 'Federal income tax brackets & standard deduction',
    figures:
      'Seven brackets, 10%–37%. Standard deduction $16,100 single / $32,200 joint; +$2,050 / $1,650 each at 65+.',
    publisher: 'IRS / Tax Foundation',
    url: 'https://taxfoundation.org/data/all/federal/2026-tax-brackets/',
  },
  {
    id: 'senior-deduction',
    label: 'Senior bonus deduction (OBBBA)',
    figures:
      '$6,000 per person 65+, phasing out above $75,000 / $150,000 MAGI; temporary, expires after 2028.',
    publisher: 'Bipartisan Policy Center / IRS',
    url: 'https://bipartisanpolicy.org/explainer/2026-federal-income-tax-brackets-and-interactive-calculator/',
  },
  {
    id: 'capital-gains-niit',
    label: 'Long-term capital gains & NIIT',
    figures:
      '0 / 15 / 20% gains (15% above $49,450 / $98,900; 20% above $545,500 / $613,700). 3.8% NIIT above $200,000 / $250,000 MAGI.',
    publisher: 'Kiplinger / IRS',
    url: 'https://www.kiplinger.com/taxes/irs-updates-capital-gains-tax-thresholds',
  },
  {
    id: 'section-121-exclusion',
    label: 'Home-sale gain exclusion (§121)',
    figures:
      '$250,000 single / $500,000 joint of primary-residence gain excluded on sale (statutory since 1997, never indexed); depreciation after May 6, 1997 is not excludable.',
    publisher: 'IRS Topic 701 / Publication 523',
    url: 'https://www.irs.gov/taxtopics/tc701',
  },
  {
    id: 'ss-benefit-taxation',
    label: 'Social Security benefit taxation',
    figures:
      'Provisional-income thresholds: up to 50% taxable above $25,000 / $32,000, up to 85% above $34,000 / $44,000 (fixed by statute, never indexed).',
    publisher: 'IRS Publication 915',
    url: 'https://www.irs.gov/forms-pubs/about-publication-915',
  },
  {
    id: 'contribution-limits',
    label: 'Contribution limits',
    figures:
      '401(k) $24,500 (+$8,000 at 50+, $11,250 ages 60–63); IRA $7,500 (+$1,100); HSA $4,400 self / $8,750 family (+$1,000 at 55+).',
    publisher: 'IRS',
    url: 'https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500',
  },
  {
    id: 'rmd-qcd',
    label: 'Required minimum distributions & QCD',
    figures:
      'IRS Uniform Lifetime Table (Pub 590-B, 2022+); RMDs begin at age 73–75 per SECURE 2.0; QCD exclusion limit $111,000.',
    publisher: 'IRS Publication 590-B',
    url: 'https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs',
  },
  {
    id: 'annuity-purchase',
    label: 'Annuity purchase (exclusion ratio & QLAC)',
    figures:
      'Non-qualified exclusion ratio from IRS Pub 939 Table V expected-return multiples (life expectancy by age); QLAC premium cap $210,000 excluded from RMD balances (SECURE 2.0).',
    publisher: 'IRS Publication 939 / SECURE 2.0 Act §202',
    url: 'https://www.irs.gov/forms-pubs/about-publication-939',
  },
  {
    id: 'hecm-plf',
    label: 'HECM reverse-mortgage principal limit',
    figures:
      'Principal-limit factors at a 5.875% expected rate: 35.1% of home value at 62 rising to 61.4% at 90 (planning default — a lender quote always wins); line/loan growth default 7.5%/yr (rate + 0.5% MIP).',
    publisher: 'HUD HECM PLF tables (as summarized for 2026)',
    url: 'https://reverse.mortgage/age-requirements',
  },
  {
    id: 'medicare-irmaa',
    label: 'Medicare Part B & IRMAA',
    figures:
      'Standard Part B $202.90/mo; five IRMAA tiers starting at $109,000 / $218,000 MAGI; Part D IRMAA surcharges $14.50-$91.00/mo.',
    publisher: 'CMS',
    url: 'https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles',
  },
  {
    id: 'social-security',
    label: 'Social Security COLA & wage base',
    figures:
      '2.8% COLA; taxable wage base $184,500; earnings-test exempt amounts $24,480 (pre-FRA) / $65,160 (FRA year); SSDI SGA $1,620/mo (non-blind); OASDI payroll tax 6.2% (employee).',
    publisher: 'SSA',
    url: 'https://www.ssa.gov/news/en/cola/factsheets/2026.html',
  },
  {
    id: 'federal-poverty-line',
    label: 'Federal poverty guideline (ACA)',
    figures:
      '2025 HHS guideline — $15,650 first person, +$5,500 each additional — applied to the 2026 ACA coverage year.',
    publisher: 'HHS',
    url: 'https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines',
  },
  {
    id: 'aca-ptc',
    label: 'ACA premium tax credit',
    figures:
      'Applicable-percentage schedule per Rev. Proc. 2025-25 (2.10% under 133% FPL up to 9.96% at 300–400%), with the 400% FPL subsidy cliff restored (enhanced credits expired 12/31/2025).',
    publisher: 'IRS',
    url: 'https://www.irs.gov/pub/irs-drop/rp-25-25.pdf',
  },
  {
    id: 'real-yield-curve',
    label: 'TIPS real-yield curve (income floor & bridge)',
    figures:
      'Par real yields as of 2026-06-30: 1.85% (5y), 2.05% (7y), 2.25% (10y), 2.55% (20y), 2.70% (30y). Prices TIPS-ladder quotes and the funded-ratio discounting; refreshed annually with the parameter packs.',
    publisher: 'U.S. Treasury',
    url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates',
  },
  {
    id: 'state-income-tax',
    label: 'State income tax',
    figures:
      'Brackets, standard deduction, Social Security treatment, and major retirement-income exclusions for all 50 states + DC, from each state revenue department.',
    publisher: 'Tax Foundation / state revenue departments',
    url: 'https://taxfoundation.org/data/all/state/state-income-tax-rates/',
  },
]

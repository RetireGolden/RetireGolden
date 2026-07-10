/**
 * Glossary seed terms for the Learning Center (V9 PR1, spec §9.10).
 *
 * Definitions are plain-language and evergreen — they explain concepts, not
 * current-year dollar figures. Each term has a stable `id` so planner tooltips
 * and articles can deep-link to /learn/glossary#<id> later.
 */

export type GlossaryTerm = {
  /** Stable anchor id (kebab-case). */
  id: string
  /** Display term, e.g. "MAGI". */
  term: string
  /** Full expansion of an acronym, when the term is one. */
  expansion?: string
  /** One- to two-sentence plain-language definition. */
  definition: string
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'aca',
    term: 'ACA',
    expansion: 'Affordable Care Act',
    definition:
      'The law behind the health-insurance marketplace many people use before Medicare. It offers income-based subsidies that lower monthly premiums.',
  },
  {
    id: 'agi',
    term: 'AGI',
    expansion: 'adjusted gross income',
    definition:
      'Your total income minus a set of specific adjustments. It is a building block for many other tax and benefit calculations.',
  },
  {
    id: 'aime',
    term: 'AIME',
    expansion: 'average indexed monthly earnings',
    definition:
      'A monthly average of your highest-earning working years, adjusted for wage growth. Social Security uses it to compute your base benefit.',
  },
  {
    id: 'annuity',
    term: 'Annuity',
    definition:
      'A contract, usually with an insurance company, that pays a stream of income — often for life — in exchange for money you put in.',
  },
  {
    id: 'basis',
    term: 'Basis',
    definition:
      'What you originally paid for an investment. When you sell, only the gain above your basis is taxed.',
  },
  {
    id: 'bend-point',
    term: 'Bend point',
    definition:
      'A dollar threshold in the Social Security formula where the benefit you earn on additional career earnings slows down.',
  },
  {
    id: 'cola',
    term: 'COLA',
    expansion: 'cost-of-living adjustment',
    definition:
      'An annual increase that raises Social Security benefits to help them keep pace with rising prices.',
  },
  {
    id: 'effective-tax-rate',
    term: 'Effective tax rate',
    definition:
      'The average share of your income that goes to tax — total tax divided by total income. It is usually lower than your top bracket.',
  },
  {
    id: 'fra',
    term: 'FRA',
    expansion: 'full retirement age',
    definition:
      'The age at which you can claim your full Social Security benefit with no early-claiming reduction. It depends on your birth year.',
  },
  {
    id: 'hsa',
    term: 'HSA',
    expansion: 'health savings account',
    definition:
      'A savings account paired with certain high-deductible health plans. Money goes in tax-free, grows tax-free, and comes out tax-free for medical costs.',
  },
  {
    id: 'irmaa',
    term: 'IRMAA',
    expansion: 'income-related monthly adjustment amount',
    definition:
      'A surcharge added to Medicare premiums for people with higher income. It is based on your income from two years earlier.',
  },
  {
    id: 'ltc',
    term: 'LTC',
    expansion: 'long-term care',
    definition:
      'Help with daily living — like a nursing home or in-home aide — that health insurance and Medicare generally do not cover.',
  },
  {
    id: 'magi',
    term: 'MAGI',
    expansion: 'modified adjusted gross income',
    definition:
      'Your AGI with certain items added back. Several programs, including ACA subsidies and IRMAA, use a version of MAGI to test income.',
  },
  {
    id: 'marginal-tax-rate',
    term: 'Marginal tax rate',
    definition:
      'The tax rate on your next dollar of income — the rate of your top bracket. It drives decisions like how much to convert to Roth.',
  },
  {
    id: 'medicare',
    term: 'Medicare',
    definition:
      'The federal health-insurance program for most people age 65 and older, with separate parts for hospital, medical, and drug coverage.',
  },
  {
    id: 'monte-carlo',
    term: 'Monte Carlo',
    definition:
      'A method that runs a plan through hundreds or thousands of randomized futures to estimate how often it succeeds.',
  },
  {
    id: 'niit',
    term: 'NIIT',
    expansion: 'net investment income tax',
    definition:
      'An extra tax on investment income for higher-income households, on top of regular income tax.',
  },
  {
    id: 'pia',
    term: 'PIA',
    expansion: 'primary insurance amount',
    definition:
      'The monthly Social Security benefit you would receive if you claim exactly at your full retirement age.',
  },
  {
    id: 'ptc',
    term: 'PTC',
    expansion: 'premium tax credit',
    definition:
      'The ACA subsidy that lowers the cost of marketplace health insurance, based on your household income.',
  },
  {
    id: 'qcd',
    term: 'QCD',
    expansion: 'qualified charitable distribution',
    definition:
      'A gift sent directly from an IRA to a charity. It can satisfy required withdrawals while keeping that money off your taxable income.',
  },
  {
    id: 'qualified-dividend',
    term: 'Qualified dividend',
    definition:
      'A dividend that meets IRS rules to be taxed at the lower long-term capital-gains rates instead of ordinary income rates.',
  },
  {
    id: 'rmd',
    term: 'RMD',
    expansion: 'required minimum distribution',
    definition:
      'The minimum amount the IRS requires you to withdraw each year from most pre-tax retirement accounts once you reach a certain age.',
  },
  {
    id: 'roth-conversion',
    term: 'Roth conversion',
    definition:
      'Moving money from a pre-tax account to a Roth account and paying the tax now, so future growth and withdrawals can be tax-free.',
  },
  {
    id: 'sequence-of-returns-risk',
    term: 'Sequence-of-returns risk',
    definition:
      'The danger that poor investment returns early in retirement, while you are withdrawing, do lasting damage even if average returns are fine.',
  },
  {
    id: 'standard-deduction',
    term: 'Standard deduction',
    definition:
      'A flat amount that reduces the income you pay tax on, taken instead of itemizing individual deductions.',
  },
  {
    id: 'taxable-income',
    term: 'Taxable income',
    definition:
      'The income left after deductions, which your tax brackets are actually applied to.',
  },
]

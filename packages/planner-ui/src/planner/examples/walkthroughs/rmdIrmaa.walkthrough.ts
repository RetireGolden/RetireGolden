import { EXAMPLE_FIXED_YEAR } from '../buildContext'
import { buildRmdIrmaa } from '../buildRmdIrmaa'
import { accountIdOfType, type Walkthrough } from './walkthrough'

/**
 * "High balances: RMDs & IRMAA", year 2026 by hand.
 *
 * Derived 2026-09-22 from the plan's inputs and the engine's documented
 * contracts without running the engine, and independently recomputed; the
 * full derivation with every citation is DOCS/walkthroughs/rmd-irmaa.md.
 * Dana, single, Florida, born 1953-01-01, is 73 for the whole of 2026.
 */

// Social Security: PIA 3,200 a month, claimed at 70y0m. FRA for a 1953 birth
// (effective 1952 under the January-1 rule) is 66y0m, so 48 months of delayed
// retirement credit at 2/3% each: factor 1.32. Twelve payable months in a year
// after the claim year; COLA factor 1 in the start year.
const SOCIAL_SECURITY = 3_200 * 1.32 * 12 // 50,688

// RMD: the entered 1,850,000 is the prior December 31 balance; the Uniform
// Lifetime Table divisor at 73 is 26.5; 2026 is the first RMD year (73 for a
// 1953 birth) and no first-year deferral is elected.
const RMD = 1_850_000 / 26.5 // 69,811.32

// QCD: 15,000 in today's dollars, routed from the RMD. It offsets income and
// reduces the year's cash inflow, but `rmd` and the traditional withdrawal stay gross.
const QCD = 15_000
const ORDINARY_INCOME = RMD - QCD // 54,811.32

// Taxable Social Security: provisional income 54,811.32 + 25,344 = 80,155.32,
// past the 34,000 tier; the 85% cap binds because 0.85 × 50,688 = 43,084.80 is
// below 0.85 × (80,155.32 − 34,000) + 4,500 = 43,732.02.
const TAXABLE_SOCIAL_SECURITY = 0.85 * SOCIAL_SECURITY // 43,084.80
const MAGI = ORDINARY_INCOME + TAXABLE_SOCIAL_SECURITY // 97,896.12

// Deductions: the 2026 single standard deduction 16,100 plus one age-65
// addition 2,050, and the 2026 senior deduction of 6,000 per person 65 or
// older, phased out at 6% of MAGI over 75,000.
const STANDARD_DEDUCTION = 16_100 + 2_050 // 18,150
const SENIOR_DEDUCTION = 6_000 - 0.06 * (MAGI - 75_000) // 4,626.23
const TAXABLE_INCOME = MAGI - STANDARD_DEDUCTION - SENIOR_DEDUCTION // 75,119.888

// Federal tax on the 2026 single brackets: 10% to 12,400, 12% to 50,400, 22%
// above; no preferential income, no AMT (tentative minimum 2,026.99 is below
// the regular tax), no NIIT. Florida has no income tax.
const FEDERAL_TAX = 12_400 * 0.1 + (50_400 - 12_400) * 0.12 + (TAXABLE_INCOME - 50_400) * 0.22 // 11,238.37536
const TAX = FEDERAL_TAX + 0

// Medicare: twelve months at 73; Part B 202.90 a month at tier 0, because the
// 2026 premium reads 2024's MAGI, which is before the ledger, so the plan's
// recentAnnualMagi seed of 0 stands in; no Part D surcharge; 350 a month of extras.
const PART_B = 202.9 * 12 // 2,434.80
const MEDICARE_EXTRAS = 350 * 12 // 4,200
const HEALTHCARE = PART_B + MEDICARE_EXTRAS // 6,634.80
const BASE_SPENDING = 110_000 // baseAnnual × inflation factor 1
const TOTAL_SPENDING = BASE_SPENDING + HEALTHCARE // 116,634.80

// Cash flow: the need after Social Security is spending plus tax less income.
// The RMD's net cash (gross less the QCD) is applied first; the remainder is
// drawn from cash, first in the sequential order, so nothing else is sold.
const NET_PORTFOLIO_NEED = TOTAL_SPENDING + TAX - SOCIAL_SECURITY // 77,185.17536
const CASH_DRAW = NET_PORTFOLIO_NEED - (RMD - QCD) // 22,373.85
const WITHDRAWALS_TOTAL = CASH_DRAW + RMD // 92,185.17536

// Growth: at year end, on the balance after the year's withdrawals; cash at
// its own 2%, the IRA and the brokerage at the plan default of 5%.
const CASH_END = (50_000 - CASH_DRAW) * 1.02 // 28,178.67
const IRA_END = (1_850_000 - RMD) * 1.05 // 1,869,198.11
const BROKERAGE_END = 400_000 * 1.05 // 420,000
const INVESTABLE = CASH_END + IRA_END + BROKERAGE_END // 2,317,376.78

export const RMD_IRMAA_WALKTHROUGH: Walkthrough = {
  id: 'rmd-irmaa',
  title: 'High balances: RMDs and IRMAA',
  exampleId: 'rmd-irmaa',
  review: 'DOCS/walkthroughs/REVIEW-2026-09-22.md',
  inputs:
    'Dana, single, Florida, born 1953-01-01, planning to 95. Cash 50,000 at 2%; traditional IRA 1,850,000 and a taxable brokerage of 400,000 (cost basis 280,000), both at the plan default return of 5%. Social Security PIA 3,200 a month, claimed at 70. A 15,000 qualified charitable distribution each year. Spending 110,000 a year plus 350 a month of Medicare extras. Inflation 2.5%, healthcare inflation 5.5%; no market series, so every year uses the plan assumptions.',
  contractNotes: [
    'The first projection year is a full calendar year and the entered balances are the prior December 31 balances: the projection takes a start year, never a date, and no year row has a proration term; the plan\'s June 2026 timestamp does not reach the ledger.',
    'The entered PIA is read in start-year dollars: the COLA factor compounds from the projection start and is 1 in 2026, so a benefit already being paid earns no cost-of-living adjustment for the years before the projection. Enter a PIA restated in current dollars.',
    'A cash account\'s growth is not taxable interest: taxable-yield rows exist only for taxable accounts, and the cash schema has no yield fields. The brokerage grows as pure price return because it declares no yield.',
    'Florida\'s zero appears nowhere as a separate field: the year row publishes one composed tax; the state amount is zero because the Florida pack has no income tax.',
    'The surplus rule\'s "cash inflows" are the year\'s income plus the net RMD cash; a need-based withdrawal is not an inflow, so the surplus here is zero by a 22,373.85 margin rather than by two sides cancelling.',
    'Two birth-year conventions coexist: the full retirement age uses the January-1 rule (a 1953-01-01 birth counts as 1952), while age attained, the RMD start and the Medicare months use the calendar birth year. No 2026 figure depends on the difference.',
  ],
  tables: [{
    year: EXAMPLE_FIXED_YEAR,
    why: 'The first projection year: the first required minimum distribution, the charitable distribution taken from it, Social Security at the full delayed-credit factor, the 2026 senior deduction, and a Medicare premium priced on a lookback year before the ledger.',
    rows: [
    {
      key: 'age',
      label: "Dana's age attained",
      hand: 73,
      unit: 'count',
      derivation: '2026 − 1953',
      contract: 'PersonYearState.ageAttained (year − birth year)',
      select: (year, plan) => year.people.find((p) => p.personId === plan.household.people[0]!.id)?.ageAttained,
    },
    {
      key: 'filing-status',
      label: 'Filing status',
      hand: 'single',
      derivation: 'household filing status, no death in the year',
      contract: 'YearResult.filingStatus',
      select: (year) => year.filingStatus,
    },
    {
      key: 'social-security',
      label: 'Social Security, gross for the year',
      hand: SOCIAL_SECURITY,
      derivation: '3,200 × 1.32 (48 months of delayed retirement credit past FRA 66) × 12 payable months × COLA factor 1',
      contract: 'worksheets social-security-benefit-annual, delayed-retirement-credit-factor, social-security-payable-months, social-security-cola-factor',
      select: (year) => year.incomes.socialSecurity,
    },
    {
      key: 'income-total',
      label: 'Total income',
      hand: SOCIAL_SECURITY,
      derivation: 'Social Security only: no wages, pension, annuity, recurring or yield income',
      contract: 'worksheet income-total-annual',
      select: (year) => year.incomes.total,
    },
    {
      key: 'rmd',
      label: 'Required minimum distribution',
      hand: RMD,
      derivation: '1,850,000 ÷ 26.5 (Uniform Lifetime Table at 73; first RMD year for a 1953 birth)',
      contract: 'worksheets rmd-applicable-age-attain-year, rmd-uniform-lifetime-divisor; params/data/year2026.ts rmd.uniformLifetimeTable',
      select: (year) => year.rmd,
    },
    {
      key: 'qcd',
      label: 'Qualified charitable distribution',
      hand: QCD,
      derivation: '15,000 requested × inflation factor 1, within the 111,000 cap and within the RMD',
      contract: 'worksheets qcd-limit-and-age-proxy, qcd-income-offset-qualified-slice',
      select: (year) => year.qcd,
    },
    {
      key: 'roth-conversion',
      label: 'Roth conversion',
      hand: 0,
      derivation: 'conversion mode none',
      contract: 'YearResult.rothConversion',
      select: (year) => year.rothConversion,
    },
    {
      key: 'magi',
      label: 'Modified adjusted gross income',
      hand: MAGI,
      derivation: '(69,811.32 − 15,000 QCD offset) + 0.85 × 50,688 (the 85% cap on taxable Social Security binds)',
      contract: 'worksheets federal-taxable-social-security-tiers, medicare-magi-composition; YearResult.magi',
      select: (year) => year.magi,
    },
    {
      key: 'tax',
      label: 'Income tax (federal plus Florida)',
      hand: TAX,
      derivation: 'taxable income 97,896.12 − 18,150 standard − 4,626.23 senior = 75,119.888; 10% of 12,400 + 12% of 38,000 + 22% of 24,719.888 = 11,238.38; Florida 0',
      contract: 'worksheets federal-standard-deduction-age-65, federal-ordinary-bracket-tax, tax-total-annual; tax/federalTax.ts#seniorDeductionAmount; params/state/data/year2026.ts FL',
      select: (year) => year.tax,
    },
    {
      key: 'amt',
      label: 'Alternative minimum tax',
      hand: 0,
      derivation: 'AMTI 97,896.12 − exemption 90,100 = 7,796.12 × 26% = 2,026.99, below the regular tax',
      contract: 'worksheet federal-amt-screen',
      select: (year) => year.amt,
    },
    {
      key: 'penalties',
      label: 'Penalties',
      hand: 0,
      derivation: 'RMD fully distributed; Dana is past 59½',
      contract: 'worksheet tax-penalties-annual',
      select: (year) => year.penalties,
    },
    {
      key: 'realized-gains',
      label: 'Realized capital gains',
      hand: 0,
      derivation: 'no taxable-account sale: cash covers the need',
      contract: 'worksheet tax-realized-gains-annual',
      select: (year) => year.realizedGains,
    },
    {
      key: 'irmaa-lookback-year',
      label: 'IRMAA lookback year',
      hand: 2024,
      unit: 'year',
      derivation: '2026 − 2, no SSA-44 election',
      contract: 'worksheets medicare-irmaa-two-year-lookback, irmaa-lookback-selection',
      select: (year) => year.irmaaLookbackMagiYear,
    },
    {
      key: 'irmaa-lookback-source',
      label: 'IRMAA lookback source',
      hand: 'planFallback',
      derivation: '2024 is before the ledger and no historical MAGI is entered, so the plan\'s recentAnnualMagi stands in',
      contract: 'YearResult.irmaaLookbackMagiSource; assumptionsSchema.recentAnnualMagi',
      select: (year) => year.irmaaLookbackMagiSource,
    },
    {
      key: 'irmaa-lookback-magi',
      label: 'IRMAA lookback MAGI',
      hand: 0,
      derivation: 'the example baseline seeds recentAnnualMagi at 0',
      contract: 'YearResult.irmaaLookbackMagi; buildContext.ts EXAMPLE_BASELINE_ASSUMPTIONS',
      select: (year) => year.irmaaLookbackMagi,
    },
    {
      key: 'irmaa-tier',
      label: 'IRMAA tier',
      hand: 0,
      unit: 'count',
      derivation: '0 is not above the 109,000 tier-1 floor for a single filer',
      contract: 'worksheet medicare-irmaa-first-tier-boundary; params/index.ts#irmaaTierForMagi',
      select: (year) => year.irmaaTier,
    },
    {
      key: 'irmaa-surcharge',
      label: 'IRMAA surcharge',
      hand: 0,
      derivation: 'tier 0',
      contract: 'YearResult.irmaaSurcharge',
      select: (year) => year.irmaaSurcharge,
    },
    {
      key: 'medicare-premiums',
      label: 'Medicare premiums',
      hand: PART_B,
      derivation: '202.90 × 12 months of Part B at tier 0; no Part D surcharge',
      contract: 'worksheet medicare-base-part-b-premium; params/data/year2026.ts medicare.partBStandardMonthly',
      select: (year) => year.medicarePremiums,
    },
    {
      key: 'base-spending',
      label: 'Base spending',
      hand: BASE_SPENDING,
      derivation: '110,000 × inflation factor 1',
      contract: 'worksheet spending-base-annual',
      select: (year) => year.expenses.baseSpending,
    },
    {
      key: 'healthcare',
      label: 'Healthcare',
      hand: HEALTHCARE,
      derivation: '2,434.80 Part B + 350 × 12 extras × health inflation factor 1',
      contract: 'worksheet spending-healthcare-annual',
      select: (year) => year.expenses.healthcare,
    },
    {
      key: 'spending-total',
      label: 'Total spending',
      hand: TOTAL_SPENDING,
      derivation: '110,000 + 6,634.80; no goals, debt, property, insurance or care',
      contract: 'worksheet spending-total-annual',
      select: (year) => year.expenses.total,
    },
    {
      key: 'portfolio-need',
      label: 'Portfolio need after income',
      hand: NET_PORTFOLIO_NEED,
      derivation: '116,634.80 + tax 11,238.38 − Social Security 50,688',
      contract: 'worksheet portfolio-need-annual',
      select: (year) => year.netPortfolioNeed,
    },
    {
      key: 'withdrawal-cash',
      label: 'Withdrawn from cash',
      hand: CASH_DRAW,
      derivation: '77,185.18 need − 54,811.32 net RMD cash; cash is first in the sequential order and covers it',
      contract: 'worksheet withdrawals-by-category-annual; withdrawalStrategySchema sequential order',
      select: (year) => year.withdrawals.cash,
    },
    {
      key: 'withdrawal-taxable',
      label: 'Withdrawn from the brokerage',
      hand: 0,
      derivation: 'cash covers the need',
      contract: 'worksheet withdrawals-by-category-annual',
      select: (year) => year.withdrawals.taxable,
    },
    {
      key: 'withdrawal-traditional',
      label: 'Withdrawn from the IRA',
      hand: RMD,
      derivation: 'the gross RMD, QCD included; no need-based IRA draw',
      contract: 'worksheet withdrawals-by-category-annual; YearResult.rmd',
      select: (year) => year.withdrawals.traditional,
    },
    {
      key: 'withdrawal-total',
      label: 'Total withdrawals',
      hand: WITHDRAWALS_TOTAL,
      derivation: '22,373.85 + 69,811.32 (= need 77,185.18 + QCD 15,000)',
      contract: 'worksheet withdrawals-total-annual',
      select: (year) => year.withdrawals.total,
    },
    {
      key: 'surplus',
      label: 'Surplus invested',
      hand: 0,
      derivation: 'max(0, inflows 105,499.32 (Social Security plus the net RMD cash) − spending 116,634.80 − tax 11,238.38) = 0; the cash draw is not an inflow',
      contract: 'worksheet surplus-invested-annual; YearResult.surplusInvested (accepted cash inflows)',
      select: (year) => year.surplusInvested,
    },
    {
      key: 'shortfall',
      label: 'Shortfall',
      hand: 0,
      derivation: 'fully funded',
      contract: 'worksheet spending-shortfall-annual',
      select: (year) => year.shortfall,
    },
    {
      key: 'balance-cash',
      label: 'Cash, year end',
      hand: CASH_END,
      derivation: '(50,000 − 22,373.85) × 1.02',
      contract: 'worksheet accounts-balance-per-account-annual; annualPostSolveAccountGrowth.ts (growth after flows)',
      select: (year, plan) => year.balances[accountIdOfType(plan, 'cash')],
    },
    {
      key: 'balance-ira',
      label: 'Traditional IRA, year end',
      hand: IRA_END,
      derivation: '(1,850,000 − 69,811.32) × 1.05',
      contract: 'worksheet accounts-balance-per-account-annual',
      select: (year, plan) => year.balances[accountIdOfType(plan, 'traditional')],
    },
    {
      key: 'balance-brokerage',
      label: 'Brokerage, year end',
      hand: BROKERAGE_END,
      derivation: '400,000 × 1.05; no sale, no yield',
      contract: 'worksheet accounts-balance-per-account-annual',
      select: (year, plan) => year.balances[accountIdOfType(plan, 'taxable')],
    },
    {
      key: 'investable',
      label: 'Investable total',
      hand: INVESTABLE,
      derivation: '28,178.67 + 1,869,198.11 + 420,000',
      contract: 'worksheet accounts-investable-total-annual',
      select: (year) => year.investableTotal,
    },
    {
      key: 'net-worth',
      label: 'Net worth',
      hand: INVESTABLE,
      derivation: 'investable only: no property, debt, insurance, ladder or reverse mortgage',
      contract: 'worksheet accounts-net-worth-annual',
      select: (year) => year.netWorth,
    },
    ],
  }],
  build: buildRmdIrmaa,
}

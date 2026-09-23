import { EXAMPLE_FIXED_YEAR } from '../buildContext'
import { buildEarlyRetireeAca } from '../buildEarlyRetireeAca'
import { accountIdOfType, type Walkthrough } from './walkthrough'

/**
 * "Early retiree and the ACA cliff", year 2026 by hand.
 *
 * Derived 2026-09-22 from the plan's inputs and the engine's documented
 * contracts without running the engine, and independently recomputed; the
 * full derivation with every citation is DOCS/walkthroughs/early-retiree-aca.md.
 * Casey, single, Florida, born 1964-01-01, is 62 for the whole of 2026: twelve
 * months on the Marketplace, no Medicare, no Social Security, no RMD.
 */

// Income: 18,000 of consulting, inflation factor 1 in the start year, taxed
// as ordinary income (the plan has no self-employment facts, so no payroll or
// self-employment tax is modeled).
const CONSULTING = 18_000

// Roth conversion, fill to the top of the 10% bracket: the metric is federal
// taxable income after the 16,100 standard deduction (nobody is 65), and only
// the income before the conversion counts, so the conversion is the bracket
// top less the taxable income already there. The contract sizes it by
// bisection to $0.01; here the bisection lands exactly.
const STANDARD_DEDUCTION = 16_100
const BRACKET_TOP_10 = 12_400
const ROTH_CONVERSION = BRACKET_TOP_10 - (CONSULTING - STANDARD_DEDUCTION) // 10,500

// Tax: ordinary income 28,500, taxable income exactly 12,400, all in the 10%
// band; no preferential income, no AMT, Florida 0.
const ORDINARY_INCOME = CONSULTING + ROTH_CONVERSION // 28,500
const TAXABLE_INCOME = ORDINARY_INCOME - STANDARD_DEDUCTION // 12,400
const FEDERAL_TAX = TAXABLE_INCOME * 0.1 // 1,240
const TAX = FEDERAL_TAX + 0

// The zero-rate capital-gain headroom: the 15% breakpoint 49,450 less taxable
// income; the contract sizes it by bisection to $0.01 and returns the lower bound.
const LTCG_ZERO_HEADROOM = 49_450 - TAXABLE_INCOME // 37,050

// ACA: the example's Marketplace contract sets the benchmark premium equal to
// the stated 1,000 a month, so both are 12,000 for the year. The household
// MAGI is the year's own AGI, 28,500, which is 182.11% of the one-person
// poverty line 15,650 (HHS 2025 guidelines for 2026 coverage). The applicable
// percentage runs linearly from 4.19% at 150% to 6.60% at 200%, so the expected
// contribution is that rate times MAGI, and the credit is the benchmark less
// the contribution, capped at the enrollment premium.
const POVERTY_LINE = 15_650
const MAGI = ORDINARY_INCOME // 28,500
const FPL_PCT = (MAGI / POVERTY_LINE) * 100 // 182.11
const APPLICABLE_PCT = 4.19 + ((FPL_PCT - 150) / 50) * 2.41 // 5.7376
const EXPECTED_CONTRIBUTION = (APPLICABLE_PCT / 100) * MAGI // 1,635.23
const GROSS_PREMIUM = 12 * 1_000 // 12,000
const CREDIT = GROSS_PREMIUM - EXPECTED_CONTRIBUTION // 10,364.77
const NET_PREMIUM = GROSS_PREMIUM - CREDIT // 1,635.23

// Spending: 40,000 base plus the net premium (no Medicare, no extras).
const BASE_SPENDING = 40_000
const HEALTHCARE = NET_PREMIUM
const TOTAL_SPENDING = BASE_SPENDING + HEALTHCARE // 41,635.23

// Cash flow: the conversion moves 10,500 from the IRA to the Roth and creates
// no spendable cash, so the whole need after consulting, tax included, is
// drawn from cash, first in the sequential order.
const NET_PORTFOLIO_NEED = TOTAL_SPENDING + TAX - CONSULTING // 24,875.23
const CASH_DRAW = NET_PORTFOLIO_NEED

// Growth: at year end, on the balance after the year's flows; cash at its own
// 2%, the IRA and the Roth at the plan default of 5%.
const CASH_END = (200_000 - CASH_DRAW) * 1.02 // 178,627.27
const IRA_END = (450_000 - ROTH_CONVERSION) * 1.05 // 461,475
const ROTH_END = (120_000 + ROTH_CONVERSION) * 1.05 // 137,025
const INVESTABLE = CASH_END + IRA_END + ROTH_END // 777,127.27

/** The contract promises these two figures only to $0.01 (bisection, lower bound). */
const BISECTION_TOLERANCE = 0.01

export const EARLY_RETIREE_ACA_WALKTHROUGH: Walkthrough = {
  id: 'early-retiree-aca',
  title: 'Early retiree and the ACA cliff',
  exampleId: 'early-retiree-aca',
  review: 'DOCS/walkthroughs/REVIEW-2026-09-22.md',
  inputs:
    'Casey, single, Florida, born 1964-01-01, retired at 58, planning to 92. Cash 200,000 at 2%; traditional IRA 450,000 and Roth IRA 120,000, both at the plan default return of 5%. Consulting income of 18,000 a year, inflation-adjusted, taxed as ordinary income. Spending 40,000 a year. A Marketplace premium of 1,000 a month with the premium tax credit applied, and the example sets the benchmark premium equal to the stated premium. Roth conversions filled to the top of the 10% bracket from 2026 to 2030. Inflation 2.5%, healthcare inflation 5.5%; no market series.',
  contractNotes: [
    'The first projection year is a full calendar year on the entered balances: the projection takes a start year, never a date, and no year row has a proration term.',
    'The premium tax credit is priced on the year\'s own household MAGI, solved together with tax and withdrawals; the plan\'s recentAnnualMagi of 50,000 is an IRMAA input for the first two years and plays no part in the credit.',
    'The benchmark (second-lowest-cost silver) premium is an example assumption set equal to the stated premium, not an engine estimate: the engine reads a benchmark only from a Marketplace contract and otherwise funds the gross premium. With benchmark equal to premium, the net premium equals the expected contribution for any premium at which the monthly share of the contribution does not exceed the premium, with twelve covered months.',
    'Only 2026 is a credit year for this example: 2027 and 2028 carry contracts but no published tax-year pack, so the engine funds the gross premium there and says so; the credit does not vanish at the cliff, it vanishes for want of parameters.',
    'The conversion is sized to the top of the 10% bracket on taxable income after the standard deduction; the credit\'s dependence on MAGI does not enter the sizing. The example chose the 10% target so the baseline stays under the 400% cliff (it lands 34,100 below it); filling the 12% bracket instead would cross the cliff.',
    'Consulting is ordinary income with no self-employment facts: no self-employment tax, no half-SE deduction, no self-employed health-insurance deduction.',
    'A cash account\'s growth is not taxable interest and does not enter MAGI; the conversion is not a withdrawal and is never penalized, at any age.',
    'The conversion and the zero-rate gain headroom are sized by bisection to $0.01 (the contract\'s promise), so those two rows carry a $0.01 tolerance; every other row is held to half a cent.',
    'Florida\'s zero appears nowhere as a separate field: the year row publishes one composed tax.',
  ],
  tables: [{
    year: EXAMPLE_FIXED_YEAR,
    why: 'The first projection year and the only year the example\'s premium credit is priced: a Roth conversion filled to the top of the 10% bracket raises MAGI, the credit is priced on that MAGI, and the conversion\'s tax and the net premium are both paid from cash.',
    rows: [
      { key: 'age', label: "Casey's age attained", hand: 62, unit: 'count', derivation: '2026 − 1964', contract: 'PersonYearState.ageAttained', select: (year, plan) => year.people.find((p) => p.personId === plan.household.people[0]!.id)?.ageAttained },
      { key: 'filing-status', label: 'Filing status', hand: 'single', derivation: 'household filing status', contract: 'YearResult.filingStatus', select: (year) => year.filingStatus },
      { key: 'consulting', label: 'Consulting income', hand: CONSULTING, derivation: '18,000 × inflation factor 1', contract: 'worksheet income-recurring-annual', select: (year) => year.incomes.recurring },
      { key: 'income-total', label: 'Total income', hand: CONSULTING, derivation: 'consulting only: no wages, Social Security, pension or yield', contract: 'worksheet income-total-annual', select: (year) => year.incomes.total },
      { key: 'rmd', label: 'Required minimum distribution', hand: 0, derivation: 'a 1964 birth starts RMDs at 75, in 2039', contract: 'params/index.ts#rmdStartAgeForBirthYear', select: (year) => year.rmd },
      { key: 'roth-conversion', label: 'Roth conversion', hand: ROTH_CONVERSION, tolerance: BISECTION_TOLERANCE, derivation: '12,400 (top of the 10% bracket) − (18,000 − 16,100 standard deduction) = 10,500; sized by bisection to $0.01, landing exactly', contract: 'worksheet roth-conversion-annual; YearResult.rothConversion; strategies/rothConversion.ts (topOfBracket holds federal taxable income at the bracket bound)', select: (year) => year.rothConversion },
      { key: 'magi', label: 'Modified adjusted gross income', hand: MAGI, derivation: '18,000 consulting + 10,500 conversion; no gains, dividends or Social Security', contract: 'worksheet medicare-magi-composition; YearResult.magi', select: (year) => year.magi },
      { key: 'tax', label: 'Income tax (federal plus Florida)', hand: TAX, derivation: 'taxable income 28,500 − 16,100 = 12,400, all at 10% = 1,240; Florida 0', contract: 'worksheets federal-ordinary-bracket-tax, tax-total-annual; params/state/data/year2026.ts FL', select: (year) => year.tax },
      { key: 'amt', label: 'Alternative minimum tax', hand: 0, derivation: 'AMTI 28,500 is under the 90,100 exemption', contract: 'worksheet federal-amt-screen', select: (year) => year.amt },
      { key: 'ltcg-zero-headroom', label: 'Room left in the 0% capital-gain band', hand: LTCG_ZERO_HEADROOM, tolerance: BISECTION_TOLERANCE, derivation: '49,450 (the 15% breakpoint, single) − 12,400 taxable income; sized by bisection to $0.01, lower bound', contract: 'worksheet year-result-ltcg-zero-headroom; YearResult.ltcgZeroHeadroom', select: (year) => year.ltcgZeroHeadroom },
      { key: 'penalties', label: 'Penalties', hand: 0, derivation: 'no need-based traditional withdrawal; a conversion is never penalized; Casey is 62 in any case', contract: 'worksheet tax-penalties-annual; simulate.ts header', select: (year) => year.penalties },
      { key: 'realized-gains', label: 'Realized capital gains', hand: 0, derivation: 'no taxable account', contract: 'worksheet tax-realized-gains-annual', select: (year) => year.realizedGains },
      { key: 'aca-readiness', label: 'Marketplace credit readiness', hand: 'actionable', derivation: 'one 2026 contract, a published 2026 pack, every gate supported', contract: 'YearAcaResult.readiness; domain rules §8', select: (year) => year.aca?.readiness },
      { key: 'aca-household-magi', label: 'ACA household MAGI', hand: MAGI, derivation: 'signed AGI 28,500 + untaxed Social Security 0 + tax-exempt interest 0 + foreign addback 0 + dependents 0', contract: 'worksheet aca-household-magi-composition; tax/aca.ts#buildAcaHouseholdMagi', select: (year) => year.aca?.householdMagi },
      { key: 'aca-poverty-line', label: 'Federal poverty line (one person)', hand: POVERTY_LINE, derivation: '15,650 for the first person, contiguous states; HHS 2025 guidelines for 2026 coverage', contract: 'params/data/year2026.ts federalPovertyLine.contiguous; tax/aca.ts#acaFederalPovertyLine', select: (year) => year.aca?.federalPovertyLine },
      { key: 'aca-fpl-pct', label: 'MAGI as a percentage of the poverty line', hand: FPL_PCT, unit: 'percent', derivation: '28,500 ÷ 15,650 × 100 = 182.11', contract: 'worksheet aca-expected-contribution; YearAcaResult.fplPct', select: (year) => year.aca?.fplPct },
      { key: 'aca-cliff-state', label: 'Position against the 400% cliff', hand: 'below-cliff', derivation: '182.11% is at or below 400% and at least 100%; the cliff MAGI is 62,600, 34,100 away', contract: 'worksheet aca-400-percent-cliff; YearAcaResult.cliffState', select: (year) => year.aca?.cliffState },
      { key: 'aca-gross-premium', label: 'Gross Marketplace premium', hand: GROSS_PREMIUM, derivation: '12 months × 1,000 × health inflation factor 1', contract: 'worksheet aca-enrollment-and-applicable-slcsp-premium-annual', select: (year) => year.aca?.grossEnrollmentPremium },
      { key: 'aca-benchmark-premium', label: 'Benchmark (SLCSP) premium', hand: GROSS_PREMIUM, derivation: '12 × 1,000: the example sets the benchmark equal to the stated premium', contract: 'worksheet aca-enrollment-and-applicable-slcsp-premium-annual; buildContext.ts parseExamplePlan', select: (year) => year.aca?.applicableSlcspPremium },
      { key: 'aca-credit', label: 'Premium tax credit', hand: CREDIT, derivation: '12,000 − 28,500 × 5.7376% (4.19% + (182.11 − 150)/50 × 2.41%) = 12,000 − 1,635.23 = 10,364.77; below the 12,000 enrollment cap', contract: 'worksheets aca-expected-contribution, aca-allowable-premium-tax-credit; tax/aca.ts#acaApplicablePct', select: (year) => year.aca?.modeledAllowablePtc },
      { key: 'aca-net-premium', label: 'Net premium after the credit', hand: NET_PREMIUM, derivation: '12,000 − 10,364.77 = 1,635.23, which equals the expected contribution because benchmark equals premium', contract: 'worksheet aca-economic-net-premium', select: (year) => year.aca?.economicNetPremium },
      { key: 'irmaa-lookback-magi', label: 'IRMAA lookback MAGI (unused: no Medicare)', hand: 50_000, derivation: '2024 is before the ledger, so the plan\'s recentAnnualMagi of 50,000 stands in; Casey has no Medicare months, so it prices nothing', contract: 'worksheet irmaa-lookback-selection; YearResult.irmaaLookbackMagi', select: (year) => year.irmaaLookbackMagi },
      { key: 'irmaa-lookback-source', label: 'IRMAA lookback source', hand: 'planFallback', derivation: 'no historical MAGI entered', contract: 'YearResult.irmaaLookbackMagiSource', select: (year) => year.irmaaLookbackMagiSource },
      { key: 'medicare-premiums', label: 'Medicare premiums', hand: 0, derivation: 'no Medicare months at 62', contract: 'YearResult.medicarePremiums', select: (year) => year.medicarePremiums },
      { key: 'base-spending', label: 'Base spending', hand: BASE_SPENDING, derivation: '40,000 × inflation factor 1', contract: 'worksheet spending-base-annual', select: (year) => year.expenses.baseSpending },
      { key: 'healthcare', label: 'Healthcare', hand: HEALTHCARE, derivation: 'the net premium 1,635.23; no Medicare, no extras', contract: 'worksheet spending-healthcare-annual; YearExpenses.healthcare', select: (year) => year.expenses.healthcare },
      { key: 'spending-total', label: 'Total spending', hand: TOTAL_SPENDING, derivation: '40,000 + 1,635.23', contract: 'worksheet spending-total-annual', select: (year) => year.expenses.total },
      { key: 'portfolio-need', label: 'Portfolio need after income', hand: NET_PORTFOLIO_NEED, derivation: '41,635.23 + tax 1,240 − consulting 18,000 = 24,875.23; the conversion brings in no cash', contract: 'worksheet portfolio-need-annual', select: (year) => year.netPortfolioNeed },
      { key: 'withdrawal-cash', label: 'Withdrawn from cash', hand: CASH_DRAW, derivation: 'the whole need, tax included; cash is first in the sequential order', contract: 'worksheet withdrawals-by-category-annual; withdrawalStrategySchema sequential order', select: (year) => year.withdrawals.cash },
      { key: 'withdrawal-traditional', label: 'Withdrawn from the IRA', hand: 0, derivation: 'the conversion is not a withdrawal', contract: 'YearWithdrawals.total composition', select: (year) => year.withdrawals.traditional },
      { key: 'withdrawal-roth', label: 'Withdrawn from the Roth', hand: 0, derivation: 'nothing drawn', contract: 'worksheet withdrawals-by-category-annual', select: (year) => year.withdrawals.roth },
      { key: 'withdrawal-total', label: 'Total withdrawals', hand: CASH_DRAW, derivation: 'cash only', contract: 'worksheet withdrawals-total-annual', select: (year) => year.withdrawals.total },
      { key: 'surplus', label: 'Surplus invested', hand: 0, derivation: 'inflows 18,000 − spending 41,635.23 − tax 1,240 < 0', contract: 'worksheet surplus-invested-annual', select: (year) => year.surplusInvested },
      { key: 'shortfall', label: 'Shortfall', hand: 0, derivation: 'fully funded', contract: 'worksheet spending-shortfall-annual', select: (year) => year.shortfall },
      { key: 'balance-cash', label: 'Cash, year end', hand: CASH_END, derivation: '(200,000 − 24,875.23) × 1.02', contract: 'worksheet accounts-balance-per-account-annual; annualPostSolveAccountGrowth.ts (growth after flows)', select: (year, plan) => year.balances[accountIdOfType(plan, 'cash')] },
      { key: 'balance-ira', label: 'Traditional IRA, year end', hand: IRA_END, derivation: '(450,000 − 10,500) × 1.05', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[accountIdOfType(plan, 'traditional')] },
      { key: 'balance-roth', label: 'Roth IRA, year end', hand: ROTH_END, derivation: '(120,000 + 10,500) × 1.05', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[accountIdOfType(plan, 'roth')] },
      { key: 'investable', label: 'Investable total', hand: INVESTABLE, derivation: '178,627.27 + 461,475 + 137,025', contract: 'worksheet accounts-investable-total-annual', select: (year) => year.investableTotal },
      { key: 'net-worth', label: 'Net worth', hand: INVESTABLE, derivation: 'investable only', contract: 'worksheet accounts-net-worth-annual', select: (year) => year.netWorth },
    ],
  }],
  build: buildEarlyRetireeAca,
}

import { EXAMPLE_FIXED_YEAR } from '../buildContext'
import { buildEarlyRetireeAca } from '../buildEarlyRetireeAca'
import { accountIdOfType, type Walkthrough, type WalkthroughTable } from './walkthrough'

/**
 * "Early retiree and the ACA cliff", years 2026 and 2027 by hand.
 *
 * Derived 2026-09-22 from the plan's inputs and the engine's documented
 * contracts without running the engine, and independently recomputed; the
 * full derivation with every citation is DOCS/walkthroughs/early-retiree-aca.md
 * (2026 in part I, 2027 in part II). Casey, single, Florida, born 1964-01-01,
 * is 62 for the whole of 2026: twelve months on the Marketplace, no Medicare,
 * no Social Security, no RMD.
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

/** The contract promises these two figures only to $0.01, as the bisection's lower bound: at or below the exact value. */
const BISECTION_TOLERANCE = 0.01

// ---- 2027 (DOCS/walkthroughs/early-retiree-aca.md, part II) ----
// The first stand-in year: no 2027 pack is published, so every indexed
// federal figure is the 2026 figure at the plan's 2.5% (the deduction, the
// bracket top, the 15% breakpoint, the AMT exemption); consulting and base
// spending index at the same rate from the start year; the premium at the
// additive health rate 2.5% + 3%. The Marketplace credit is not priced: the
// contract is complete and the income is as far below the cliff as in 2026,
// but the stand-in pack is an unsupported material fact, so the engine
// publishes no poverty line, percentage or credit and budgets the gross
// premium. The conversion's bisection lands 0.0051 below 10,762.50, because
// 12,400 × 1.025 evaluates a hair under 12,710 in binary floating point while
// taxable income at the exact answer rounds to 12,710 and so tests as over the
// top; the search converges from below onto a bound it never reaches.
const INFL_2027 = 1.025
const HEALTH_2027 = 1.055 // 1 + 0.025 + 0.03
const CONSULTING_2027 = CONSULTING * INFL_2027 // 18,450
const STANDARD_DEDUCTION_2027 = STANDARD_DEDUCTION * INFL_2027 // 16,502.50
const BRACKET_TOP_10_2027 = BRACKET_TOP_10 * INFL_2027 // 12,710
const ROTH_CONVERSION_2027 = BRACKET_TOP_10_2027 - (CONSULTING_2027 - STANDARD_DEDUCTION_2027) // 10,762.50
const TAXABLE_INCOME_2027 = BRACKET_TOP_10_2027 // 12,710: the bracket top the conversion fills to
const MAGI_2027 = CONSULTING_2027 + ROTH_CONVERSION_2027 // 29,212.50
const TAX_2027 = TAXABLE_INCOME_2027 * 0.1 + 0 // 1,271
const LTCG_ZERO_HEADROOM_2027 = 49_450 * INFL_2027 - TAXABLE_INCOME_2027 // 37,976.25
const GROSS_PREMIUM_2027 = 12 * 1_000 * HEALTH_2027 // 12,660, and the net premium, and healthcare
const BASE_SPENDING_2027 = BASE_SPENDING * INFL_2027 // 41,000
const TOTAL_SPENDING_2027 = BASE_SPENDING_2027 + GROSS_PREMIUM_2027 // 53,660
const NET_PORTFOLIO_NEED_2027 = TOTAL_SPENDING_2027 + TAX_2027 - CONSULTING_2027 // 36,481
const CASH_DRAW_2027 = NET_PORTFOLIO_NEED_2027
const CASH_END_2027 = (CASH_END - CASH_DRAW_2027) * 1.02 // 144,989.19
const IRA_END_2027 = (IRA_END - ROTH_CONVERSION_2027) * 1.05 // 473,248.125
const ROTH_END_2027 = (ROTH_END + ROTH_CONVERSION_2027) * 1.05 // 155,176.875
const INVESTABLE_2027 = CASH_END_2027 + IRA_END_2027 + ROTH_END_2027 // 773,414.19

/**
 * The conversion's $0.01 bar reaches every figure affine in it: MAGI, taxable
 * income and the ACA AGI component with slope 1 (one-sided below, 0.01); the
 * IRA and Roth year ends with slope 1.05 (0.0105: the IRA moves up, the Roth
 * down). Tax and the need move by a tenth of it and keep half a cent; the
 * investable total's IRA and Roth offsets cancel.
 */
const CONVERSION_CARRY_TOLERANCE = BISECTION_TOLERANCE * 1.05

const TABLE_2027: WalkthroughTable = {
  year: 2027,
  why: "The first stand-in year: every indexed federal figure is the 2026 figure at the plan's 2.5%, so the conversion grows with the bracket top; the Marketplace credit is not priced, not because of the cliff (the income is as far below it as in 2026 and the contract is complete) but because no 2027 tax-year parameters are published, so the engine budgets the gross premium and says so; and the conversion's search lands half a cent under the bracket top, which every figure downstream of it inherits.",
  rows: [
      { key: 'age', label: "Casey's age attained", hand: 63, unit: 'count', derivation: '2027 − 1964', contract: 'PersonYearState.ageAttained', select: (year, plan) => year.people.find((p) => p.personId === plan.household.people[0]!.id)?.ageAttained },
      { key: 'filing-status', label: 'Filing status', hand: 'single', derivation: 'household filing status', contract: 'YearResult.filingStatus', select: (year) => year.filingStatus },
      { key: 'consulting', label: 'Consulting income', hand: CONSULTING_2027, derivation: '18,000 × 1.025 (the general factor from the projection start)', contract: 'worksheet income-recurring-annual', select: (year) => year.incomes.recurring },
      { key: 'income-total', label: 'Total income', hand: CONSULTING_2027, derivation: 'consulting only', contract: 'worksheet income-total-annual', select: (year) => year.incomes.total },
      { key: 'rmd', label: 'Required minimum distribution', hand: 0, derivation: 'RMDs start at 75, in 2039', contract: 'params/index.ts#rmdStartAgeForBirthYear', select: (year) => year.rmd },
      { key: 'roth-conversion', label: 'Roth conversion', hand: ROTH_CONVERSION_2027, tolerance: BISECTION_TOLERANCE, bound: 'below', derivation: '12,710 (the 10% bracket top, 12,400 × 1.025) − (18,450 − 16,502.50) = 10,762.50; the bisection lands 0.0051 below it, because 12,400 × 1.025 evaluates a hair under 12,710 in binary floating point while taxable income at the exact answer rounds to 12,710 and so tests as over the top', contract: 'worksheet roth-conversion-annual (sized by bisection to $0.01, the lower bound); YearResult.rothConversion; aggregateRothConversionOwnerAllocation.ts#374 (one owner: the raw sized amount, not quantized to cents); params/index.ts#indexFederalTaxPack', select: (year) => year.rothConversion },
      { key: 'standard-deduction', label: 'Standard deduction (projected)', hand: STANDARD_DEDUCTION_2027, derivation: '16,100 × 1.025; nobody is 65', contract: 'FederalTaxDetail.deduction; params/index.ts#indexFederalTaxPack', select: (year) => year.advisoryFederalTax?.detail.deduction },
      { key: 'taxable-income', label: 'Federal taxable income', hand: TAXABLE_INCOME_2027, tolerance: BISECTION_TOLERANCE, bound: 'below', derivation: '29,212.50 − 16,502.50 = 12,710, the bracket top the conversion fills to; it carries the conversion’s bar', contract: 'FederalTaxDetail.taxableIncome; carries the conversion band (YearResult.rothConversion; single-owner clause at aggregateRothConversionOwnerAllocation.ts#374)', select: (year) => year.advisoryFederalTax?.detail.taxableIncome },
      { key: 'stand-in-pack', label: 'Tax-year pack', hand: '2026 pack standing in', derivation: 'no 2027 pack is published, so the 2026 figures are carried at the plan’s 2.5%: projections, not the IRS’s 2027 figures', contract: 'FederalTaxDetail.usesStandInPack; params/index.ts#packForYear', select: (year) => year.advisoryFederalTax?.detail.usesStandInPack === true ? '2026 pack standing in' : year.advisoryFederalTax === undefined ? undefined : 'published pack' },
      { key: 'magi', label: 'Modified adjusted gross income', hand: MAGI_2027, tolerance: BISECTION_TOLERANCE, bound: 'below', derivation: '18,450 consulting + 10,762.50 conversion; carries the conversion’s bar', contract: 'worksheet medicare-magi-composition; YearResult.magi; single-owner clause at aggregateRothConversionOwnerAllocation.ts#374', select: (year) => year.magi },
      { key: 'tax', label: 'Income tax (federal plus Florida)', hand: TAX_2027, derivation: 'taxable income 12,710, all at 10% = 1,271; Florida 0. The conversion costs exactly its 10% tax, 1,076.25: there is no credit to forfeit this year', contract: 'worksheets federal-ordinary-bracket-tax, tax-total-annual', select: (year) => year.tax },
      { key: 'amt', label: 'Alternative minimum tax', hand: 0, derivation: 'AMTI 29,212.50 is under the projected 92,352.50 exemption', contract: 'worksheet federal-amt-screen', select: (year) => year.amt },
      { key: 'ltcg-zero-headroom', label: 'Room left in the 0% capital-gain band', hand: LTCG_ZERO_HEADROOM_2027, tolerance: BISECTION_TOLERANCE, derivation: '50,686.25 (the 15% breakpoint, 49,450 × 1.025) − 12,710 = 37,976.25; two-sided here: the conversion’s shortfall raises the root by up to $0.01 and the headroom’s own bisection lands up to $0.01 below it', contract: 'worksheet year-result-ltcg-zero-headroom; params/index.ts#indexFederalTaxPack', select: (year) => year.ltcgZeroHeadroom },
      { key: 'penalties', label: 'Penalties', hand: 0, derivation: 'no need-based traditional withdrawal; a conversion is never penalized', contract: 'worksheet tax-penalties-annual', select: (year) => year.penalties },
      { key: 'realized-gains', label: 'Realized capital gains', hand: 0, derivation: 'no taxable account', contract: 'worksheet tax-realized-gains-annual', select: (year) => year.realizedGains },
      { key: 'aca-readiness', label: 'Marketplace credit readiness', hand: 'nonActionable', derivation: 'the 2027 contract is complete, but the year rides the 2026 pack, which is an unsupported material fact: no credit is priced', contract: 'YearAcaResult.readiness; annualHealthcareExpenses.ts (tax-year-parameters-unsupported); domain rules §8', select: (year) => year.aca?.readiness },
      { key: 'aca-support-codes', label: 'Support codes', hand: 'tax-year-parameters-unsupported', derivation: 'the one gate that fails; every other gate passes as in 2026', contract: 'YearAcaResult.supportCodes', select: (year) => year.aca?.supportCodes.join(',') },
      { key: 'aca-household-magi', label: 'ACA household MAGI', hand: null, derivation: 'published only in an actionable year', contract: 'YearAcaResult.householdMagi (null when material facts are unsupported)', select: (year) => year.aca?.householdMagi },
      { key: 'aca-magi-federal-agi', label: 'The AGI a 2027 credit would be priced on', hand: MAGI_2027, tolerance: BISECTION_TOLERANCE, bound: 'below', derivation: '29,212.50, the MAGI probe’s federal AGI: the input a credit would have been priced on, not a household MAGI the engine vouches for', contract: 'YearAcaResult.magiComponents.federalAgi; carries the conversion band (single-owner clause at aggregateRothConversionOwnerAllocation.ts#374)', select: (year) => year.aca?.magiComponents.federalAgi },
      { key: 'aca-poverty-line', label: 'Federal poverty line (one person)', hand: null, derivation: 'withheld in a stand-in year: no inflation-scaled poverty line is exposed as evidence', contract: 'YearAcaResult.federalPovertyLine; domain rules §8', select: (year) => year.aca?.federalPovertyLine },
      { key: 'aca-fpl-pct', label: 'MAGI as a percentage of the poverty line', hand: null, unit: 'percent', derivation: 'no priced quote, so no percentage (it would be about 182%, the same distance from the cliff as 2026)', contract: 'YearAcaResult.fplPct', select: (year) => year.aca?.fplPct },
      { key: 'aca-cliff-state', label: 'Position against the 400% cliff', hand: 'unsupported', derivation: 'no cliff test is run in a non-actionable year: not above the cliff, unpriced', contract: 'YearAcaResult.cliffState', select: (year) => year.aca?.cliffState },
      { key: 'aca-gross-premium', label: 'Gross Marketplace premium', hand: GROSS_PREMIUM_2027, derivation: '12 months × 1,000 × 1.055 (the health factor: general 2.5% plus 3%, additive)', contract: 'worksheet aca-enrollment-and-applicable-slcsp-premium-annual; assumptionsSchema.healthcareExtraInflationPct', select: (year) => year.aca?.grossEnrollmentPremium },
      { key: 'aca-benchmark-premium', label: 'Benchmark (SLCSP) premium', hand: GROSS_PREMIUM_2027, derivation: '12 × 1,055: the contract is present, so the field is published', contract: 'YearAcaResult.applicableSlcspPremium', select: (year) => year.aca?.applicableSlcspPremium },
      { key: 'aca-credit', label: 'Premium tax credit', hand: null, derivation: 'not priced: a 2027 credit needs the 2027 applicable-percentage table and poverty guidelines, and neither is published. Priced on the 2026 schedule carried forward it would be about 10,984 (illustration only)', contract: 'YearAcaResult.modeledAllowablePtc', select: (year) => year.aca?.modeledAllowablePtc },
      { key: 'aca-net-premium', label: 'Net premium after the credit', hand: GROSS_PREMIUM_2027, derivation: 'the gross premium, 12,660: nothing is credited', contract: 'YearAcaResult.economicNetPremium (the gross premium on a gross fallback)', select: (year) => year.aca?.economicNetPremium },
      { key: 'aca-gross-fallback', label: 'Gross-premium fallback', hand: 'gross premium budgeted', derivation: 'the year is not actionable, so the plan budgets the full premium and says so', contract: 'YearAcaResult.convergence.grossPremiumFallback', select: (year) => year.aca === undefined ? undefined : year.aca.convergence.grossPremiumFallback ? 'gross premium budgeted' : 'credit priced' },
      { key: 'irmaa-lookback-magi', label: 'IRMAA lookback MAGI (unused: no Medicare)', hand: 50000, derivation: '2025 is before the ledger, so the plan’s recentAnnualMagi of 50,000 stands in; Casey has no Medicare, so it prices nothing', contract: 'worksheet irmaa-lookback-selection', select: (year) => year.irmaaLookbackMagi },
      { key: 'irmaa-lookback-source', label: 'IRMAA lookback source', hand: 'planFallback', derivation: 'no historical MAGI entered', contract: 'YearResult.irmaaLookbackMagiSource', select: (year) => year.irmaaLookbackMagiSource },
      { key: 'irmaa-lookback-year', label: 'IRMAA lookback year', hand: 2025, unit: 'year', derivation: '2027 − 2', contract: 'worksheet medicare-irmaa-two-year-lookback', select: (year) => year.irmaaLookbackMagiYear },
      { key: 'medicare-premiums', label: 'Medicare premiums', hand: 0, derivation: 'no Medicare months at 63', contract: 'YearResult.medicarePremiums', select: (year) => year.medicarePremiums },
      { key: 'base-spending', label: 'Base spending', hand: BASE_SPENDING_2027, derivation: '40,000 × 1.025', contract: 'worksheet spending-base-annual', select: (year) => year.expenses.baseSpending },
      { key: 'healthcare', label: 'Healthcare', hand: GROSS_PREMIUM_2027, derivation: 'the gross premium 12,660; no Medicare, no extras', contract: 'worksheet spending-healthcare-annual; YearExpenses.healthcare', select: (year) => year.expenses.healthcare },
      { key: 'spending-total', label: 'Total spending', hand: TOTAL_SPENDING_2027, derivation: '41,000 + 12,660', contract: 'worksheet spending-total-annual', select: (year) => year.expenses.total },
      { key: 'portfolio-need', label: 'Portfolio need after income', hand: NET_PORTFOLIO_NEED_2027, derivation: '53,660 + tax 1,271 − consulting 18,450 = 36,481: 11,605.77 more than 2026, of which 10,364.77 is the 2026 credit not repeated', contract: 'worksheet portfolio-need-annual', select: (year) => year.netPortfolioNeed },
      { key: 'withdrawal-cash', label: 'Withdrawn from cash', hand: CASH_DRAW_2027, derivation: 'the whole need; cash is first in the sequential order and 178,627.27 covers it', contract: 'worksheet withdrawals-by-category-annual; withdrawalStrategySchema sequential order', select: (year) => year.withdrawals.cash },
      { key: 'withdrawal-traditional', label: 'Withdrawn from the IRA', hand: 0, derivation: 'the conversion is not a withdrawal', contract: 'YearWithdrawals.total composition', select: (year) => year.withdrawals.traditional },
      { key: 'withdrawal-roth', label: 'Withdrawn from the Roth', hand: 0, derivation: 'nothing drawn', contract: 'worksheet withdrawals-by-category-annual', select: (year) => year.withdrawals.roth },
      { key: 'withdrawal-total', label: 'Total withdrawals', hand: CASH_DRAW_2027, derivation: 'cash only', contract: 'worksheet withdrawals-total-annual', select: (year) => year.withdrawals.total },
      { key: 'surplus', label: 'Surplus invested', hand: 0, derivation: 'inflows 18,450 − spending 53,660 − tax 1,271 < 0', contract: 'worksheet surplus-invested-annual', select: (year) => year.surplusInvested },
      { key: 'shortfall', label: 'Shortfall', hand: 0, derivation: 'fully funded', contract: 'worksheet spending-shortfall-annual', select: (year) => year.shortfall },
      { key: 'balance-cash', label: 'Cash, year end', hand: CASH_END_2027, derivation: '(178,627.27 − 36,481) × 1.02', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[accountIdOfType(plan, 'cash')] },
      { key: 'balance-ira', label: 'Traditional IRA, year end', hand: IRA_END_2027, tolerance: CONVERSION_CARRY_TOLERANCE, derivation: '(461,475 − 10,762.50) × 1.05 = 473,248.125; the conversion’s $0.01 bar, grown at 5%, moves this up by at most 0.0105', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[accountIdOfType(plan, 'traditional')] },
      { key: 'balance-roth', label: 'Roth IRA, year end', hand: ROTH_END_2027, tolerance: CONVERSION_CARRY_TOLERANCE, bound: 'below', derivation: '(137,025 + 10,762.50) × 1.05 = 155,176.875; the conversion’s $0.01 bar, grown at 5%, moves this down by at most 0.0105', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[accountIdOfType(plan, 'roth')] },
      { key: 'investable', label: 'Investable total', hand: INVESTABLE_2027, derivation: '144,989.19 + 473,248.125 + 155,176.875; the IRA and Roth offsets cancel', contract: 'worksheet accounts-investable-total-annual', select: (year) => year.investableTotal },
      { key: 'net-worth', label: 'Net worth', hand: INVESTABLE_2027, derivation: 'investable only', contract: 'worksheet accounts-net-worth-annual', select: (year) => year.netWorth },
  ],
}

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
    'The conversion and the zero-rate gain headroom are sized by bisection to $0.01 (the contract\'s promise) and return the lower bound, so those two rows are held to at most $0.01 below the exact value and never above it; every other row is held to half a cent.',
    'Florida\'s zero appears nowhere as a separate field: the year row publishes one composed tax.',
    'In 2027 the conversion\'s $0.01 bar reaches every figure computed from it (MAGI, taxable income, the ACA AGI component, the IRA and Roth year ends), and no contract says so; those rows carry the propagated bar (0.01 one-sided, 0.0105 on the grown balances) and the zero-rate headroom becomes two-sided, since the conversion\'s shortfall raises its root while its own search lands below.',
    'A null row proves an absence: in 2027 the engine publishes the household MAGI, the poverty line, the percentage and the credit as null by contract, and the test holds each to null exactly. The MAGI probe\'s federal AGI is still published beside them as the input a credit would have been priced on, not as a household MAGI the engine vouches for.',
    'In a stand-in year the ACA convergence flag reads false although the funding solve converged: the flag certifies a priced credit, not the solve; the year carries no non-convergence code or warning.',
    'The projected 2027 figures (a 12,710 bracket top, a 16,502.50 deduction, a 50,686.25 breakpoint) are the 2026 figures at the plan\'s 2.5% with no statutory rounding; the IRS\'s 2027 figures will differ.',
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
      { key: 'roth-conversion', label: 'Roth conversion', hand: ROTH_CONVERSION, tolerance: BISECTION_TOLERANCE, bound: 'below', derivation: '12,400 (top of the 10% bracket) − (18,000 − 16,100 standard deduction) = 10,500; sized by bisection to $0.01, which returns the lower bound and here lands exactly', contract: 'worksheet roth-conversion-annual; YearResult.rothConversion; strategies/rothConversion.ts (topOfBracket holds federal taxable income at the bracket bound)', select: (year) => year.rothConversion },
      { key: 'magi', label: 'Modified adjusted gross income', hand: MAGI, derivation: '18,000 consulting + 10,500 conversion; no gains, dividends or Social Security', contract: 'worksheet medicare-magi-composition; YearResult.magi', select: (year) => year.magi },
      { key: 'tax', label: 'Income tax (federal plus Florida)', hand: TAX, derivation: 'taxable income 28,500 − 16,100 = 12,400, all at 10% = 1,240; Florida 0', contract: 'worksheets federal-ordinary-bracket-tax, tax-total-annual; params/state/data/year2026.ts FL', select: (year) => year.tax },
      { key: 'amt', label: 'Alternative minimum tax', hand: 0, derivation: 'AMTI 28,500 is under the 90,100 exemption', contract: 'worksheet federal-amt-screen', select: (year) => year.amt },
      { key: 'ltcg-zero-headroom', label: 'Room left in the 0% capital-gain band', hand: LTCG_ZERO_HEADROOM, tolerance: BISECTION_TOLERANCE, bound: 'below', derivation: '49,450 (the 15% breakpoint, single) − 12,400 taxable income; sized by bisection to $0.01, which returns the lower bound: at or below 37,050, never above', contract: 'worksheet year-result-ltcg-zero-headroom; YearResult.ltcgZeroHeadroom', select: (year) => year.ltcgZeroHeadroom },
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
  }, TABLE_2027],
  build: buildEarlyRetireeAca,
}

import { EXAMPLE_FIXED_YEAR } from '../buildContext'
import { buildBracketFillRoth } from '../buildBracketFillRoth'
import { accountIdOfType, type Walkthrough, type YearResult } from './walkthrough'

/**
 * "Bracket-fill Roth conversions", year 2026 by hand.
 *
 * Derived 2026-09-22 from the plan's inputs and the engine's documented
 * contracts without running the engine, and independently recomputed; the
 * full derivation with every citation is DOCS/walkthroughs/bracket-fill-roth.md.
 * Morgan (born 1953-01-01, 73 in 2026) and Riley (born 1955-01-01, 71),
 * married filing jointly, Florida; the year's headline is that the household
 * conversion is split between the two owners by their IRA balances, and
 * Riley holds no Roth IRA, so her share is dropped and the 22% bracket is
 * not filled.
 */

// Social Security: both claimed at 67y0m. Under the January-1 rule Morgan's
// effective birth year is 1952 and Riley's is 1954, both in the 1943 to 1954
// cohort with a full retirement age of 66y0m, so each has twelve months of
// delayed retirement credit at 2/3% a month: factor 1.08. Twelve payable
// months each (both claim years are before the projection); COLA factor 1.
// Riley's own 1,944 a month exceeds half of Morgan's PIA (1,250), so no
// spousal top-up applies.
const SS_MORGAN = 2_500 * 1.08 * 12 // 32,400
const SS_RILEY = 1_800 * 1.08 * 12 // 23,328
const SOCIAL_SECURITY = SS_MORGAN + SS_RILEY // 55,728

// RMD: Morgan's first RMD year (73 for a 1953 birth) on the entered 700,000 as
// the prior December 31 balance, Uniform Lifetime Table divisor 26.5; Riley,
// 71, has none until 2028.
const RMD = 700_000 / 26.5 // 26,415.09

// QCD: 10,000 for the household, routed from the RMD; only Morgan has an RMD,
// so the whole gift comes out of his RMD and offsets income in full.
const QCD = 10_000
const NET_RMD_CASH = RMD - QCD // 16,415.09

// The Roth conversion, fill to the top of the 22% bracket (joint). The sizing
// counts only the ordinary income before the conversion (the RMD net of the
// QCD) plus Social Security's taxable share recomputed at every candidate; it
// uses the joint standard deduction 32,200 with two age-65 additions of 1,650
// and the senior deduction of 6,000 per person phased out at 6% of MAGI over
// 150,000 (once per person, so the pair runs out at 250,000). At the root the
// 85% cap on taxable Social Security binds and MAGI sits inside the senior
// phase-out, so taxable income is 1.12 × AGI − 65,500; setting it to the 24%
// bracket's lower bound 211,400 gives the household root below. The bisection
// (the contract's "$0.01") lands 0.0038 below it.
const STANDARD_DEDUCTION = 32_200 + 2 * 1_650 // 35,500
const TAXABLE_SS_CAP = 0.85 * SOCIAL_SECURITY // 47,368.80
const BRACKET_TOP_22 = 211_400
const AGI_AT_ROOT = (BRACKET_TOP_22 + 65_500) / 1.12 // 247,232.14
const HOUSEHOLD_ROOT = AGI_AT_ROOT - TAXABLE_SS_CAP - NET_RMD_CASH // 183,448.25

// The split: the household amount, in cents, is shared between the owners in
// proportion to their post-RMD traditional balances in exact cents, largest
// remainder. Morgan's slice can convert into his Roth IRA; Riley has no Roth
// account, so her slice is dropped with a warning naming her. Any landing the
// bisection allows gives Morgan the same 11,509,846 cents.
const MORGAN_WEIGHT_CENTS = Math.round((700_000 - RMD) * 100) // 67,358,491
const RILEY_WEIGHT_CENTS = 400_000 * 100 // 40,000,000
const HOUSEHOLD_CENTS = Math.round(HOUSEHOLD_ROOT * 100) // 18,344,825
const ROTH_CONVERSION =
  Math.round((HOUSEHOLD_CENTS * MORGAN_WEIGHT_CENTS) / (MORGAN_WEIGHT_CENTS + RILEY_WEIGHT_CENTS)) / 100 // 115,098.46

// Tax: ordinary income is the net RMD plus the executed conversion; the 85%
// cap on taxable Social Security binds; the senior deduction is phased out per
// person against the joint MAGI; the joint 2026 brackets are 10% to 24,800,
// 12% to 100,800 and 22% above. Florida 0; no AMT.
const ORDINARY_INCOME = NET_RMD_CASH + ROTH_CONVERSION // 131,513.55
const MAGI = ORDINARY_INCOME + TAXABLE_SS_CAP // 178,882.35
const SENIOR_DEDUCTION = 2 * (6_000 - 0.06 * (MAGI - 150_000)) // 8,534.12
const TAXABLE_INCOME = MAGI - STANDARD_DEDUCTION - SENIOR_DEDUCTION // 134,848.24
const FEDERAL_TAX = 24_800 * 0.1 + (100_800 - 24_800) * 0.12 + (TAXABLE_INCOME - 100_800) * 0.22 // 19,090.61
const TAX = FEDERAL_TAX + 0

// Medicare for two: Part B 202.90 a month each at tier 0 (the 2024 lookback
// reads the plan's seed of 0), no Part D surcharge, 250 a month of extras each.
const PART_B = 2 * 202.9 * 12 // 4,869.60
const MEDICARE_EXTRAS = 2 * 250 * 12 // 6,000
const HEALTHCARE = PART_B + MEDICARE_EXTRAS // 10,869.60
const BASE_SPENDING = 90_000 // the age-80 phase keys on Morgan and starts in 2033
const TOTAL_SPENDING = BASE_SPENDING + HEALTHCARE // 100,869.60

// Cash flow: the need after Social Security is spending plus tax less income;
// the net RMD cash is applied first and the rest, the conversion's tax
// included, is drawn from cash under the sequential order.
const NET_PORTFOLIO_NEED = TOTAL_SPENDING + TAX - SOCIAL_SECURITY // 64,232.21
const CASH_DRAW = NET_PORTFOLIO_NEED - NET_RMD_CASH // 47,817.12
const WITHDRAWALS_TOTAL = CASH_DRAW + RMD // 74,232.21

// Growth: at year end on the post-flow balances; cash at 2%, the IRAs and the
// Roth at the plan default of 5%. The conversion leaves Morgan's IRA and
// enters Morgan's Roth; Riley's IRA is untouched.
const CASH_END = (80_000 - CASH_DRAW) * 1.02 // 32,826.54
const IRA_MORGAN_END = (700_000 - RMD - ROTH_CONVERSION) * 1.05 // 586,410.77
const IRA_RILEY_END = 400_000 * 1.05 // 420,000
const ROTH_END = (50_000 + ROTH_CONVERSION) * 1.05 // 173,353.38
const INVESTABLE = CASH_END + IRA_MORGAN_END + IRA_RILEY_END + ROTH_END // 1,212,590.69

/** The household amount is sized by bisection to $0.01, returning the lower bound: at or below the root, never above. */
const BISECTION_TOLERANCE = 0.01

type BuiltPlan = ReturnType<Walkthrough['build']>
const personId = (plan: BuiltPlan, index: 0 | 1) => plan.household.people[index]!.id
const streamOf = (year: YearResult, plan: BuiltPlan, index: 0 | 1) =>
  year.socialSecurityStreams?.find((stream) => stream.personId === personId(plan, index))?.annualAmount
const traditionalOf = (plan: BuiltPlan, index: 0 | 1) => {
  const account = plan.accounts.find((a) => a.type === 'traditional' && a.ownerPersonId === personId(plan, index))
  if (!account) throw new Error(`no traditional IRA for person ${index}`)
  return account.id
}

export const BRACKET_FILL_ROTH_WALKTHROUGH: Walkthrough = {
  id: 'bracket-fill-roth',
  title: 'Bracket-fill Roth conversions',
  exampleId: 'bracket-fill-roth',
  review: 'DOCS/walkthroughs/REVIEW-2026-09-22.md',
  inputs:
    'Morgan (born 1953-01-01, planning to 92) and Riley (born 1955-01-01, planning to 94), married filing jointly, Florida. Cash reserve 80,000 at 2%; Morgan\'s traditional IRA 700,000, Riley\'s traditional IRA 400,000 and Morgan\'s Roth IRA 50,000, all at the plan default return of 5%; Riley holds no Roth account. Social Security PIAs of 2,500 (Morgan) and 1,800 (Riley) a month, each claimed at 67. Roth conversions filled to the top of the 22% bracket from 2026 to 2034 and a 10,000 qualified charitable distribution each year. Spending 90,000 a year, cut to 85% from Morgan\'s age 80, plus 250 a month of Medicare extras each. Inflation 2.5%, healthcare inflation 5.5%; no market series.',
  contractNotes: [
    'The conversion is sized once for the household, then split between the owners in proportion to their traditional balances after the RMD, in exact cents; each share can convert only into that owner\'s own Roth IRA. Riley holds none, so her share (68,349.78 in 2026) is dropped with a warning naming her, and only Morgan\'s 115,098.46 converts. Taxable income ends 76,551.76 below the top of the 22% bracket the strategy targets. This is the engine\'s documented rule for a conversion\'s destination, not a defect; the example\'s description promises a filled bracket that its accounts cannot deliver.',
    'Riley\'s full retirement age is 66y0m because a January-1 birth counts as the prior calendar year (1954); read as 1955 it would be 66y2m and her benefit 23,040 instead of 23,328. Age attained, the RMD start and the Medicare months use the calendar year.',
    'The 2026 senior deduction of 6,000 is phased out per person at 6% of the joint MAGI over 150,000, so a couple loses both at 250,000 of MAGI, not 350,000.',
    'The household\'s 10,000 charitable distribution is routed from the RMD, and only Morgan has one in 2026, so the whole gift leaves his IRA and Riley gives nothing.',
    'The spending cut at 80 keys on the primary person, Morgan, and first applies in 2033.',
    'The first projection year is a full calendar year on the entered balances; both PIAs are read in start-year dollars (COLA factor 1); cash growth is untaxed; Florida\'s zero has no field; the funding fixed point is seeded with the pre-tax need and converges on its second evaluation.',
    'The household conversion amount is sized by bisection to $0.01 below the exact root, so that row carries a $0.01 tolerance; the executed conversion is quantized to cents by the owner split and is exact.',
  ],
  tables: [{
    year: EXAMPLE_FIXED_YEAR,
    why: 'The first projection year: Morgan\'s first required distribution with the charitable gift taken from it, a household conversion sized to the top of the 22% bracket but executed only for the spouse who holds a Roth IRA, two senior deductions phasing out against the joint MAGI, and Medicare for two at tier 0.',
    rows: [
      { key: 'age-morgan', label: "Morgan's age attained", hand: 73, unit: 'count', derivation: '2026 − 1953', contract: 'PersonYearState.ageAttained', select: (year, plan) => year.people.find((p) => p.personId === personId(plan, 0))?.ageAttained },
      { key: 'age-riley', label: "Riley's age attained", hand: 71, unit: 'count', derivation: '2026 − 1955', contract: 'PersonYearState.ageAttained', select: (year, plan) => year.people.find((p) => p.personId === personId(plan, 1))?.ageAttained },
      { key: 'filing-status', label: 'Filing status', hand: 'marriedFilingJointly', derivation: 'household status with both alive', contract: 'YearResult.filingStatus', select: (year) => year.filingStatus },
      { key: 'ss-morgan', label: "Morgan's Social Security", hand: SS_MORGAN, derivation: '2,500 × 1.08 (12 months of delayed credit past FRA 66y0m) × 12 × COLA factor 1', contract: 'worksheets social-security-benefit-annual, delayed-retirement-credit-factor; nra.ts (January-1 rule, 1943–1954 cohort)', select: (year, plan) => streamOf(year, plan, 0) },
      { key: 'ss-riley', label: "Riley's Social Security", hand: SS_RILEY, derivation: '1,800 × 1.08 (effective birth year 1954, FRA 66y0m, 12 months of delayed credit) × 12; own 1,944 a month exceeds half of Morgan\'s PIA, so no spousal top-up', contract: 'worksheets social-security-benefit-annual, current-spouse-excess-fallback; nra.ts#effectiveBirthYear', select: (year, plan) => streamOf(year, plan, 1) },
      { key: 'social-security', label: 'Social Security, household', hand: SOCIAL_SECURITY, derivation: '32,400 + 23,328', contract: 'YearIncomes.socialSecurity', select: (year) => year.incomes.socialSecurity },
      { key: 'income-total', label: 'Total income', hand: SOCIAL_SECURITY, derivation: 'Social Security only', contract: 'worksheet income-total-annual', select: (year) => year.incomes.total },
      { key: 'rmd', label: 'Required minimum distribution (Morgan)', hand: RMD, derivation: '700,000 ÷ 26.5; Riley, 71, has none until 2028', contract: 'worksheet rmd-uniform-lifetime-divisor; params/index.ts#rmdStartAgeForBirthYear (the owner path: 73 for births 1951 to 1959) and domain rules §6', select: (year) => year.rmd },
      { key: 'qcd', label: 'Qualified charitable distribution', hand: QCD, derivation: '10,000 × inflation factor 1, all from Morgan\'s RMD, offsetting income in full', contract: 'worksheets qcd-limit-and-age-proxy, qcd-income-offset-qualified-slice', select: (year) => year.qcd },
      { key: 'conversion-sized', label: 'Conversion sized for the household', hand: HOUSEHOLD_ROOT, tolerance: BISECTION_TOLERANCE, bound: 'below', derivation: '(211,400 + 65,500) ÷ 1.12 − 47,368.80 − 16,415.09 = 183,448.25: the amount that brings joint taxable income to the top of the 22% bracket with the 85% cap binding and both senior deductions in phase-out; sized by bisection to $0.01 below', contract: 'YearResult.aggregateRothConversionAllocationDesired; strategies/rothConversion.ts (topOfBracket by bisection)', select: (year) => year.aggregateRothConversionAllocationDesired },
      { key: 'roth-conversion', label: 'Roth conversion executed', hand: ROTH_CONVERSION, derivation: '18,344,825 cents × 67,358,491 ÷ 107,358,491 = 11,509,846 cents for Morgan (his post-RMD balance over the two IRAs\' total, largest remainder); Riley\'s 68,349.78 dropped, she holds no Roth', contract: 'worksheets exact-cent-pro-rata-half-up, roth-conversion-annual; registry irc-408-d-3-A-i-conversion-benefits-the-distributee; YearResult.rothConversion', select: (year) => year.rothConversion },
      { key: 'magi', label: 'Modified adjusted gross income', hand: MAGI, derivation: '16,415.09 net RMD + 115,098.46 conversion + 47,368.80 taxable Social Security (the 85% cap binds)', contract: 'worksheets federal-taxable-social-security-tiers, medicare-magi-composition; YearResult.magi', select: (year) => year.magi },
      { key: 'tax', label: 'Income tax (federal plus Florida)', hand: TAX, derivation: 'taxable income 178,882.35 − 35,500 − 8,534.12 (two senior deductions after phase-out) = 134,848.24; 10% of 24,800 + 12% of 76,000 + 22% of 34,048.24 = 19,090.61; Florida 0', contract: 'worksheets federal-standard-deduction-age-65, federal-ordinary-bracket-tax, tax-total-annual; tax/federalTax.ts#seniorDeductionAmount', select: (year) => year.tax },
      { key: 'amt', label: 'Alternative minimum tax', hand: 0, derivation: 'AMTI 178,882.35 − exemption 140,200 = 38,682.35 × 26% = 10,057.41, below the regular tax', contract: 'worksheet federal-amt-screen', select: (year) => year.amt },
      { key: 'penalties', label: 'Penalties', hand: 0, derivation: 'RMD fully taken; a conversion is never penalized', contract: 'worksheet tax-penalties-annual', select: (year) => year.penalties },
      { key: 'realized-gains', label: 'Realized capital gains', hand: 0, derivation: 'no taxable account', contract: 'worksheet tax-realized-gains-annual', select: (year) => year.realizedGains },
      { key: 'ltcg-zero-headroom', label: 'Room left in the 0% capital-gain band', hand: 0, derivation: 'taxable income 134,848.24 already exceeds the joint 15% breakpoint 98,900', contract: 'worksheet year-result-ltcg-zero-headroom', select: (year) => year.ltcgZeroHeadroom },
      { key: 'irmaa-lookback-year', label: 'IRMAA lookback year', hand: 2024, unit: 'year', derivation: '2026 − 2', contract: 'worksheets medicare-irmaa-two-year-lookback, irmaa-lookback-selection', select: (year) => year.irmaaLookbackMagiYear },
      { key: 'irmaa-lookback-source', label: 'IRMAA lookback source', hand: 'planFallback', derivation: '2024 is before the ledger and no historical MAGI is entered', contract: 'YearResult.irmaaLookbackMagiSource', select: (year) => year.irmaaLookbackMagiSource },
      { key: 'irmaa-lookback-magi', label: 'IRMAA lookback MAGI', hand: 0, derivation: 'the example baseline seeds recentAnnualMagi at 0', contract: 'YearResult.irmaaLookbackMagi', select: (year) => year.irmaaLookbackMagi },
      { key: 'irmaa-tier', label: 'IRMAA tier', hand: 0, unit: 'count', derivation: '0 is not above the joint tier-1 floor of 218,000', contract: 'worksheet medicare-irmaa-first-tier-boundary', select: (year) => year.irmaaTier },
      { key: 'irmaa-next-threshold', label: 'Next IRMAA threshold', hand: 218_000, derivation: 'the joint tier-1 floor × inflation factor 1', contract: 'YearResult.irmaaNextTierThreshold', select: (year) => year.irmaaNextTierThreshold ?? undefined },
      { key: 'medicare-premiums', label: 'Medicare premiums (both)', hand: PART_B, derivation: '2 × 202.90 × 12 at tier 0; no Part D surcharge', contract: 'worksheet medicare-base-part-b-premium; YearResult.medicarePremiums', select: (year) => year.medicarePremiums },
      { key: 'irmaa-surcharge', label: 'IRMAA surcharge', hand: 0, derivation: 'tier 0', contract: 'YearResult.irmaaSurcharge', select: (year) => year.irmaaSurcharge },
      { key: 'base-spending', label: 'Base spending', hand: BASE_SPENDING, derivation: '90,000 × inflation factor 1; the age-80 cut keys on Morgan (73) and starts in 2033', contract: 'worksheet spending-base-annual; expensePhaseSchema.fromAge', select: (year) => year.expenses.baseSpending },
      { key: 'healthcare', label: 'Healthcare', hand: HEALTHCARE, derivation: '4,869.60 Part B + 2 × 250 × 12 extras', contract: 'worksheet spending-healthcare-annual', select: (year) => year.expenses.healthcare },
      { key: 'spending-total', label: 'Total spending', hand: TOTAL_SPENDING, derivation: '90,000 + 10,869.60', contract: 'worksheet spending-total-annual', select: (year) => year.expenses.total },
      { key: 'portfolio-need', label: 'Portfolio need after income', hand: NET_PORTFOLIO_NEED, derivation: '100,869.60 + tax 19,090.61 − Social Security 55,728', contract: 'worksheet portfolio-need-annual', select: (year) => year.netPortfolioNeed },
      { key: 'withdrawal-cash', label: 'Withdrawn from cash', hand: CASH_DRAW, derivation: '64,232.21 − 16,415.09 net RMD cash; the conversion\'s tax rides this draw; cash covers it', contract: 'worksheet withdrawals-by-category-annual; withdrawalStrategySchema sequential order', select: (year) => year.withdrawals.cash },
      { key: 'withdrawal-traditional', label: 'Withdrawn from the IRAs', hand: RMD, derivation: 'the gross RMD, QCD included; the conversion is not a withdrawal', contract: 'YearWithdrawals.total composition; YearResult.rmd', select: (year) => year.withdrawals.traditional },
      { key: 'withdrawal-roth', label: 'Withdrawn from the Roth', hand: 0, derivation: 'nothing drawn', contract: 'worksheet withdrawals-by-category-annual', select: (year) => year.withdrawals.roth },
      { key: 'withdrawal-total', label: 'Total withdrawals', hand: WITHDRAWALS_TOTAL, derivation: '47,817.12 + 26,415.09 (= need 64,232.21 + QCD 10,000)', contract: 'worksheet withdrawals-total-annual', select: (year) => year.withdrawals.total },
      { key: 'surplus', label: 'Surplus invested', hand: 0, derivation: 'max(0, inflows 72,143.09 − spending 100,869.60 − tax 19,090.61) = 0', contract: 'worksheet surplus-invested-annual', select: (year) => year.surplusInvested },
      { key: 'shortfall', label: 'Shortfall', hand: 0, derivation: 'fully funded', contract: 'worksheet spending-shortfall-annual', select: (year) => year.shortfall },
      { key: 'balance-cash', label: 'Cash, year end', hand: CASH_END, derivation: '(80,000 − 47,817.12) × 1.02', contract: 'worksheet accounts-balance-per-account-annual; annualPostSolveAccountGrowth.ts (growth after flows)', select: (year, plan) => year.balances[accountIdOfType(plan, 'cash')] },
      { key: 'balance-ira-morgan', label: "Morgan's IRA, year end", hand: IRA_MORGAN_END, derivation: '(700,000 − 26,415.09 RMD − 115,098.46 conversion) × 1.05', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[traditionalOf(plan, 0)] },
      { key: 'balance-ira-riley', label: "Riley's IRA, year end", hand: IRA_RILEY_END, derivation: '400,000 × 1.05: no RMD, no gift, her conversion share dropped', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[traditionalOf(plan, 1)] },
      { key: 'balance-roth', label: "Morgan's Roth IRA, year end", hand: ROTH_END, derivation: '(50,000 + 115,098.46) × 1.05', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[accountIdOfType(plan, 'roth')] },
      { key: 'investable', label: 'Investable total', hand: INVESTABLE, derivation: '32,826.54 + 586,410.77 + 420,000 + 173,353.38', contract: 'worksheet accounts-investable-total-annual', select: (year) => year.investableTotal },
      { key: 'net-worth', label: 'Net worth', hand: INVESTABLE, derivation: 'investable only', contract: 'worksheet accounts-net-worth-annual', select: (year) => year.netWorth },
    ],
  }],
  build: buildBracketFillRoth,
}

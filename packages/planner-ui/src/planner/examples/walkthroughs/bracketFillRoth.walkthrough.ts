import { EXAMPLE_FIXED_YEAR } from '../buildContext'
import { buildBracketFillRoth } from '../buildBracketFillRoth'
import { accountIdOfType, type Walkthrough, type WalkthroughTable, type YearResult } from './walkthrough'

/**
 * "Bracket-fill Roth conversions", years 2026 and 2029 by hand.
 *
 * Re-derived 2026-09-27 for the household as decision
 * D-BRACKET-FILL-ROTH-EXAMPLE built it, with Riley holding a Roth IRA of her
 * own, from the plan's inputs and the engine's documented contracts without
 * running the engine, and independently recomputed; the full derivation with
 * every citation is DOCS/walkthroughs/bracket-fill-roth.md (parts III and IV;
 * parts I and II derive the household before the decision). Morgan (born
 * 1953-01-01, 73 in 2026) and Riley (born 1955-01-01, 71), married filing
 * jointly, Florida; the year's headline is that the household conversion is
 * split between the two owners by their IRA balances and both shares now
 * convert, so the 22% bracket fills.
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
// (the contract's "$0.01") lands 0.0038 below it. Nothing the sizing reads
// depends on a Roth account, so the root is the same as before the decision.
const STANDARD_DEDUCTION = 32_200 + 2 * 1_650 // 35,500
const TAXABLE_SS_CAP = 0.85 * SOCIAL_SECURITY // 47,368.80
const BRACKET_TOP_22 = 211_400
const AGI_AT_ROOT = (BRACKET_TOP_22 + 65_500) / 1.12 // 247,232.14
const HOUSEHOLD_ROOT = AGI_AT_ROOT - TAXABLE_SS_CAP - NET_RMD_CASH // 183,448.25

// The split: the household amount the bisection landed on (its lower bound,
// traced: 0.0038 below the root), rounded half-up to cents, is shared between
// the owners in proportion to their post-RMD traditional balances in exact
// cents, largest remainder. Each slice converts into its owner's own Roth IRA,
// and both owners now have one, so the executed total is the landing's cents.
// The contract leaves the landing open by a cent, so it allows two totals a
// cent apart (183,448.24 here, or 183,448.25 at a landing of 183,448.245 or
// more); the rows downstream take the ledger's cents.
const HOUSEHOLD_LANDING = 183_448.244678974151611328125 // the bisection's lower bound
const MORGAN_WEIGHT_CENTS = Math.round((700_000 - RMD) * 100) // 67,358,491
const RILEY_WEIGHT_CENTS = 400_000 * 100 // 40,000,000
const HOUSEHOLD_CENTS = Math.round(HOUSEHOLD_LANDING * 100) // 18,344,824
const MORGAN_CENTS = Math.round((HOUSEHOLD_CENTS * MORGAN_WEIGHT_CENTS) / (MORGAN_WEIGHT_CENTS + RILEY_WEIGHT_CENTS)) // 11,509,846
const RILEY_CENTS = HOUSEHOLD_CENTS - MORGAN_CENTS // 6,834,978: a two-part largest-remainder split sums to the whole
const CONVERSION_MORGAN = MORGAN_CENTS / 100 // 115,098.46
const CONVERSION_RILEY = RILEY_CENTS / 100 // 68,349.78
const ROTH_CONVERSION = HOUSEHOLD_CENTS / 100 // 183,448.24

// Tax: ordinary income is the net RMD plus the executed conversion; the 85%
// cap on taxable Social Security binds; the senior deduction is phased out per
// person against the joint MAGI, almost to nothing; the joint 2026 brackets
// are 10% to 24,800, 12% to 100,800 and 22% to 211,400. Florida 0; no AMT.
const ORDINARY_INCOME = NET_RMD_CASH + ROTH_CONVERSION // 199,863.33
const MAGI = ORDINARY_INCOME + TAXABLE_SS_CAP // 247,232.13
const SENIOR_DEDUCTION = 2 * (6_000 - 0.06 * (MAGI - 150_000)) // 332.14
const TAXABLE_INCOME = MAGI - STANDARD_DEDUCTION - SENIOR_DEDUCTION // 211,399.99, a cent under the top
const FEDERAL_TAX = 24_800 * 0.1 + (100_800 - 24_800) * 0.12 + (TAXABLE_INCOME - 100_800) * 0.22 // 35,932.00
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
// included, is drawn from cash under the sequential order. Cash covers it.
const NET_PORTFOLIO_NEED = TOTAL_SPENDING + TAX - SOCIAL_SECURITY // 81,073.60
const CASH_DRAW = NET_PORTFOLIO_NEED - NET_RMD_CASH // 64,658.50
const WITHDRAWALS_TOTAL = CASH_DRAW + RMD // 91,073.60

// Growth: at year end on the post-flow balances; cash at 2%, the IRAs and the
// Roth IRAs at the plan default of 5%. Each slice leaves its owner's IRA and
// enters its owner's Roth IRA.
const CASH_END = (80_000 - CASH_DRAW) * 1.02 // 15,648.33
const IRA_MORGAN_END = (700_000 - RMD - CONVERSION_MORGAN) * 1.05 // 586,410.77
const IRA_RILEY_END = (400_000 - CONVERSION_RILEY) * 1.05 // 348,232.73
const ROTH_END = (50_000 + CONVERSION_MORGAN) * 1.05 // 173,353.38
const ROTH_RILEY_END = (0 + CONVERSION_RILEY) * 1.05 // 71,767.27
const INVESTABLE = CASH_END + IRA_MORGAN_END + IRA_RILEY_END + ROTH_END + ROTH_RILEY_END // 1,195,412.48

/** The household amount is sized by bisection to $0.01, returning the lower bound: at or below the root, never above. */
const BISECTION_TOLERANCE = 0.01
/**
 * The executed total is the landing rounded half up to the cent, so it lies
 * in (root − 0.015, root + 0.005): written as root − 0.005 within $0.01, a
 * band both allowed cent values fall inside. (Held to $0.01 of a cent value
 * instead, binary64 would put the other allowed value a hair outside.)
 */
const CONVERSION_CENT_TOLERANCE = 0.01

// ---- 2029 (DOCS/walkthroughs/bracket-fill-roth.md, part IV; 2027 and 2028 bridged there) ----
// Every indexed federal figure is the 2026 figure at 1.025 a year (the
// brackets, the deduction and its age-65 additions, the AMT exemption, the
// capital-gain breakpoint); the senior deduction ends after 2028; the QCD,
// base spending, the COLA and the IRMAA floors index at general inflation,
// unrounded; Part B and the extras at the health rate 1.055 a year. The year
// opens on the ledger's 2028 closes: Morgan's IRA as the ledger holds it (the
// 2027 and 2028 need-based draws are fixed points accepted within half a cent
// of balancing), and the executed conversions of 2027 and 2028 at their
// cents (191,772.98 and 193,344.57); the other closes are expressions of the
// inputs and those cents.
const INFL_2029 = 1.025 * 1.025 * 1.025 // 1.076890625
const HEALTH_2029 = 1.055 * 1.055 * 1.055 // 1.174241375
const CONVERSION_2027_MORGAN = 118_519.16 // the 2027 landing's cents 19,177,298, split 11,851,916 : 7,325,382 (part IV §2)
const CONVERSION_2027_RILEY = 73_253.82
const CONVERSION_2028_MORGAN = 111_087.5 // the 2028 landing's cents 19,334,457, split 11,108,750 : 8,225,707 (part IV §3)
const CONVERSION_2028_RILEY = 82_257.07
const IRA_MORGAN_OPEN_2029 = 177_684.6033513623 // the 2028 close as the ledger holds it (part IV §3; chain closed form 177,684.6064)
const IRA_RILEY_CLOSE_2027 = (IRA_RILEY_END - CONVERSION_2027_RILEY) * 1.05 // no RMD at 72 and no draw: Morgan's IRA covered 2027's
const IRA_RILEY_OPEN_2029 = (IRA_RILEY_CLOSE_2027 - IRA_RILEY_CLOSE_2027 / 26.5 - CONVERSION_2028_RILEY) * 1.05 // 205,354.17: her first RMD (at 73) and 2028's slice
const ROTH_OPEN_2029 = ((ROTH_END + CONVERSION_2027_MORGAN) * 1.05 + CONVERSION_2028_MORGAN) * 1.05 // 438,431.35
const ROTH_RILEY_OPEN_2029 = ((ROTH_RILEY_END + CONVERSION_2027_RILEY) * 1.05 + CONVERSION_2028_RILEY) * 1.05 // 246,255.67
const SS_MORGAN_2029 = SS_MORGAN * INFL_2029 // 34,891.26
const SS_RILEY_2029 = SS_RILEY * INFL_2029 // 25,121.70
const SOCIAL_SECURITY_2029 = SOCIAL_SECURITY * INFL_2029 // 60,012.96
const RMD_MORGAN_2029 = IRA_MORGAN_OPEN_2029 / 23.7 // 7,497.24 at 76
const RMD_RILEY_2029 = IRA_RILEY_OPEN_2029 / 25.5 // 8,053.10 at 74
const RMD_2029 = RMD_MORGAN_2029 + RMD_RILEY_2029 // 15,550.35
const QCD_2029 = 10_000 * INFL_2029 // 10,768.91, from both RMDs by their size
const NET_RMD_CASH_2029 = RMD_2029 - QCD_2029 // 4,781.44
const TAXABLE_SS_CAP_2029 = 0.85 * SOCIAL_SECURITY_2029 // 51,011.02: the cap binds at the root and at the fixed point
const STANDARD_DEDUCTION_2029 = STANDARD_DEDUCTION * INFL_2029 // 38,229.62; no senior deduction
const BRACKET_10_TOP_2029 = 24_800 * INFL_2029 // 26,706.89
const BRACKET_12_TOP_2029 = 100_800 * INFL_2029 // 108,550.58
const BRACKET_TOP_22_2029 = BRACKET_TOP_22 * INFL_2029 // 227,654.68, the sizing ceiling
const HOUSEHOLD_ROOT_2029 = BRACKET_TOP_22_2029 + STANDARD_DEDUCTION_2029 - TAXABLE_SS_CAP_2029 - NET_RMD_CASH_2029 // 210,091.84
// The split in 2029: the landing (traced, 0.0047 below the root) in cents, by
// the owners' IRA balances after their RMDs (170,187.36 and 197,301.06).
const HOUSEHOLD_LANDING_2029 = 210_091.83500391064 // the bisection's lower bound
const HOUSEHOLD_CENTS_2029 = Math.round(HOUSEHOLD_LANDING_2029 * 100) // 21,009,184: clears the half cent by 0.0000039 of a dollar
const MORGAN_WEIGHT_CENTS_2029 = Math.round((IRA_MORGAN_OPEN_2029 - RMD_MORGAN_2029) * 100) // 17,018,736
const RILEY_WEIGHT_CENTS_2029 = Math.round((IRA_RILEY_OPEN_2029 - RMD_RILEY_2029) * 100) // 19,730,106
const MORGAN_CENTS_2029 = Math.round((HOUSEHOLD_CENTS_2029 * MORGAN_WEIGHT_CENTS_2029) / (MORGAN_WEIGHT_CENTS_2029 + RILEY_WEIGHT_CENTS_2029)) // 9,729,552
const RILEY_CENTS_2029 = HOUSEHOLD_CENTS_2029 - MORGAN_CENTS_2029 // 11,279,632
const CONVERSION_2029 = HOUSEHOLD_CENTS_2029 / 100 // 210,091.84
// The conversion fills the 22% band, so the tax at the ceiling is fixed and
// every further dollar is taxed at 24%.
const TAX_AT_CEILING_2029 = BRACKET_10_TOP_2029 * 0.1 + (BRACKET_12_TOP_2029 - BRACKET_10_TOP_2029) * 0.12 + (BRACKET_TOP_22_2029 - BRACKET_12_TOP_2029) * 0.22 // 38,694.83
// Medicare at tier 2 on 2027's MAGI: Part B at the tier's 50% applicable
// percentage (twice the 25% standard share) plus the tier's 37.50 Part D
// surcharge, for twelve months each, at the health rate.
const MEDICARE_PREMIUMS_2029 = 2 * (202.9 * (50 / 25) * 12 + 37.5 * 12) * HEALTH_2029 // 12,492.99
const IRMAA_SURCHARGE_2029 = 2 * ((405.8 - 202.9) * 12 + 37.5 * 12) * HEALTH_2029 // 6,774.90
const HEALTHCARE_2029 = MEDICARE_PREMIUMS_2029 + MEDICARE_EXTRAS * HEALTH_2029 // 19,538.44
const BASE_SPENDING_2029 = BASE_SPENDING * INFL_2029 // 96,920.16
const TOTAL_SPENDING_2029 = BASE_SPENDING_2029 + HEALTHCARE_2029 // 116,458.59
const IRMAA_TIER_3_FLOOR_2029 = 342_000 * INFL_2029 // 368,296.59, the next threshold

// The need-based draw is a fixed point: the cash has been empty since 2027,
// so the need after Social Security and the net RMD cash is drawn from the
// IRAs (Morgan's first, then Riley's), and each drawn dollar is taxed at 24%
// and drawn too. The RMD cancels (it is income and cash alike), so MAGI is
// (conversion + spending − Social Security + capped taxable Social Security
// + tax at the ceiling − 24% × (deduction + ceiling)) ÷ 0.76, whatever the
// openings.
const MAGI_2029 = (CONVERSION_2029 + TOTAL_SPENDING_2029 - SOCIAL_SECURITY_2029 + TAXABLE_SS_CAP_2029 + TAX_AT_CEILING_2029 - 0.24 * (STANDARD_DEDUCTION_2029 + BRACKET_TOP_22_2029)) / 0.76 // 384,777.75
const TAX_2029 = TAX_AT_CEILING_2029 + 0.24 * (MAGI_2029 - STANDARD_DEDUCTION_2029 - BRACKET_TOP_22_2029) + 0 // 67,229.26
const NET_PORTFOLIO_NEED_2029 = TOTAL_SPENDING_2029 + TAX_2029 - SOCIAL_SECURITY_2029 // 123,674.90
const WITHDRAWALS_TRADITIONAL_2029 = MAGI_2029 - CONVERSION_2029 - TAXABLE_SS_CAP_2029 + QCD_2029 // 134,443.80: both RMDs and the draw
// Morgan's IRA empties, so Riley's close is what both IRAs held less the
// conversion and every withdrawal, grown.
const IRA_RILEY_END_2029 = (IRA_MORGAN_OPEN_2029 + IRA_RILEY_OPEN_2029 - CONVERSION_2029 - WITHDRAWALS_TRADITIONAL_2029) * 1.05 // 40,428.28
const ROTH_END_2029 = (ROTH_OPEN_2029 + MORGAN_CENTS_2029 / 100) * 1.05 // 562,513.22
const ROTH_RILEY_END_2029 = (ROTH_RILEY_OPEN_2029 + RILEY_CENTS_2029 / 100) * 1.05 // 377,004.59
const INVESTABLE_2029 = 0 + 0 + IRA_RILEY_END_2029 + ROTH_END_2029 + ROTH_RILEY_END_2029 // 979,946.09
// 2027's MAGI at its exact fixed point (part IV §2, the same form with the
// 2026 cash close drawn first): the figure the 2029 premium reads.
const SOCIAL_SECURITY_2027 = SOCIAL_SECURITY * 1.025 // 57,121.20
const TOTAL_SPENDING_2027 = BASE_SPENDING * 1.025 + (PART_B + MEDICARE_EXTRAS) * 1.055 // 103,717.43
const TAX_AT_CEILING_2027 = 25_420 * 0.1 + (103_320 - 25_420) * 0.12 + (216_685 - 103_320) * 0.22 // 36,830.30
const MAGI_2027 = (191_772.98 + TOTAL_SPENDING_2027 - SOCIAL_SECURITY_2027 - CASH_END + 0.85 * SOCIAL_SECURITY_2027 + TAX_AT_CEILING_2027 - 0.24 * (STANDARD_DEDUCTION * 1.025 + 216_685)) / 0.76 // 325,482.63

/**
 * The bands the published contracts give. The funding fixed point is
 * accepted within 0.005 of its residual, and each drawn dollar costs 24%, so
 * the draw sits within 0.005 / 0.76 = 1/152 of the exact root, as do MAGI and
 * the withdrawals (2027's MAGI too); grown at 5% for the year-end balances,
 * 1.05/152. Tax and the need move by 24% of the draw's band and keep half a
 * cent.
 */
const DRAW_FIXED_POINT_TOLERANCE = 0.0066
/** Where the executed conversion's cents come from: the contract leaves them open by one cent, the traced landing picks one. */
const CENTS_SOURCE = "the executed conversion's cents from the traced sizeRothConversion lower bound (body)"
/** Where the fixed point's band comes from. */
const FIXED_POINT_SOURCE = 'annualFundingFixedPoint.ts; projection/moneyTolerance.ts (the half-cent residual)'
const DRAW_FIXED_POINT_GROWN_TOLERANCE = 0.007

const TABLE_2029: WalkthroughTable = {
  year: 2029,
  why: "Three years on (2027 and 2028 bridged in the derivation): both spouses take RMDs and the gift is shared between them by RMD size; the household conversion is split by IRA balance and both shares convert, so the bracket fills again; the senior deduction has ended; Medicare is priced on 2027's MAGI, which carries that year's filled bracket and its first large IRA draw, at the second income-surcharge tier; and, with the cash gone since 2027, the year's need is drawn from the IRAs above the filled bracket, taxed at 24%, emptying Morgan's IRA, as a fixed point the ledger accepts within half a cent of balancing.",
  rows: [
      { key: 'age-morgan', label: "Morgan's age attained", hand: 76, unit: 'count', derivation: '2029 − 1953', contract: 'PersonYearState.ageAttained', select: (year, plan) => year.people.find((p) => p.personId === personId(plan, 0))?.ageAttained },
      { key: 'age-riley', label: "Riley's age attained", hand: 74, unit: 'count', derivation: '2029 − 1955', contract: 'PersonYearState.ageAttained', select: (year, plan) => year.people.find((p) => p.personId === personId(plan, 1))?.ageAttained },
      { key: 'filing-status', label: 'Filing status', hand: 'marriedFilingJointly', derivation: 'both alive', contract: 'YearResult.filingStatus', select: (year) => year.filingStatus },
      { key: 'ss-morgan', label: "Morgan's Social Security", hand: SS_MORGAN_2029, derivation: '2,500 × 1.08 × 12 × 1.025³ (the COLA factor from the start year)', contract: 'worksheets social-security-benefit-annual, social-security-cola-factor', select: (year, plan) => streamOf(year, plan, 0) },
      { key: 'ss-riley', label: "Riley's Social Security", hand: SS_RILEY_2029, derivation: '1,800 × 1.08 × 12 × 1.025³; the spousal candidate is not larger than her own benefit', contract: 'worksheets social-security-benefit-annual, social-security-spousal-top-up', select: (year, plan) => streamOf(year, plan, 1) },
      { key: 'social-security', label: 'Social Security, gross for the year', hand: SOCIAL_SECURITY_2029, derivation: '55,728 × 1.025³', contract: 'YearIncomes.socialSecurity', select: (year) => year.incomes.socialSecurity },
      { key: 'income-total', label: 'Total income', hand: SOCIAL_SECURITY_2029, derivation: 'Social Security only', contract: 'worksheet income-total-annual', select: (year) => year.incomes.total },
      { key: 'rmd', label: 'Required minimum distributions, both IRAs', hand: RMD_2029, derivation: "Morgan 177,684.60 ÷ 23.7 (age 76) = 7,497.24 on the ledger's 2028 close; Riley 205,354.17 ÷ 25.5 (age 74) = 8,053.10, her second RMD year", contract: 'worksheet rmd-uniform-lifetime-divisor; simulate.ts (prior December 31 balances)', select: (year) => year.rmd },
      { key: 'qcd', label: 'Qualified charitable distribution', hand: QCD_2029, derivation: '10,000 × 1.025³ = 10,768.91, taken from both RMDs in proportion to their size (Morgan 5,191.98, Riley 5,576.93: the owner sorted first by person id gets his share, the last takes the remainder)', contract: 'strategiesSchema.qcdAnnual; annualLegacyQcdGiftPlan (attribution across owners); worksheet qcd-limit-and-age-proxy', select: (year) => year.qcd },
      { key: 'conversion-sized', label: 'Household conversion amount (sized)', hand: HOUSEHOLD_ROOT_2029, tolerance: BISECTION_TOLERANCE, bound: 'below', derivation: 'the amount that brings taxable income to the indexed 22% ceiling 227,654.68: AGI at the root = 227,654.68 + 38,229.62 (the indexed deduction with two age-65 additions; no senior deduction from 2029), less taxable Social Security at its 85% cap 51,011.02, less the 4,781.44 of net RMD cash = 210,091.84; the bisection returns the lower bound, 0.0047 below', contract: 'YearResult.aggregateRothConversionAllocationDesired; rothConversion.ts#sizeRothConversion (to $0.01, the lower bound); params/index.ts#indexFederalTaxPack', select: (year) => year.aggregateRothConversionAllocationDesired },
      { key: 'roth-conversion', label: 'Roth conversion executed (both spouses)', hand: HOUSEHOLD_ROOT_2029 - 0.005, tolerance: CONVERSION_CENT_TOLERANCE, derivation: "the landing's cents 21,009,184 split by the two IRAs' post-RMD balances (Morgan 170,187.36 against Riley 197,301.06): Morgan 97,295.52 into his Roth IRA and Riley 112,796.32 into hers, 210,091.84 in all; a landing below 210,091.835 would give 210,091.83, so the row holds the band from the root less 1.5 cents to the root plus half a cent, and its value is that band's centre, not a published figure: the engine executes 210,091.84", contract: 'YearResult.rothConversion (the per-owner split, in exact cents); rothConversion.ts#sizeRothConversion (the traced lower bound, body); worksheets exact-cent-pro-rata-half-up, exact-cent-largest-remainder-slices', select: (year) => year.rothConversion },
      { key: 'magi', label: 'Modified adjusted gross income', hand: MAGI_2029, tolerance: DRAW_FIXED_POINT_TOLERANCE, derivation: '(210,091.84 conversion + 116,458.59 spending − 60,012.96 Social Security + 51,011.02 capped taxable Social Security + 38,694.83 tax at the ceiling − 24% × (38,229.62 + 227,654.68)) ÷ 0.76: every drawn IRA dollar is taxed at 24% and drawn too, and the RMD cancels; the fixed point is accepted within 0.005 of its residual, so the row carries that band over 0.76', contract: 'worksheet medicare-magi-composition; YearResult.magi; annualFundingFixedPoint.ts (accepted within 0.005 of its residual); projection/moneyTolerance.ts', select: (year) => year.magi },
      { key: 'tax', label: 'Income tax (federal plus Florida)', hand: TAX_2029, derivation: 'taxable income 384,777.75 − 38,229.62 = 346,548.14 on the indexed joint brackets: 2,670.69 + 9,821.24 + 26,202.90 up to the 22% ceiling, plus 24% of the 118,893.46 above it = 67,229.26; no senior deduction (it ended after 2028); the fixed-point band scaled by 24% stays under half a cent; Florida 0', contract: 'worksheets federal-ordinary-bracket-tax, tax-total-annual; tax/federalTax.ts#seniorDeductionAmount (year > lastApplicableYear)', select: (year) => year.tax },
      { key: 'amt', label: 'Alternative minimum tax', hand: 0, derivation: 'AMTI 384,777.75 less the indexed 150,980.07 exemption; tentative 60,787.40 is below the regular tax', contract: 'worksheet federal-amt-screen', select: (year) => year.amt },
      { key: 'penalties', label: 'Penalties', hand: 0, derivation: 'both RMDs taken; both past 59½; a conversion is never penalized', contract: 'worksheet tax-penalties-annual', select: (year) => year.penalties },
      { key: 'realized-gains', label: 'Realized capital gains', hand: 0, derivation: 'no taxable account', contract: 'worksheet tax-realized-gains-annual', select: (year) => year.realizedGains },
      { key: 'ltcg-zero-headroom', label: 'Room left in the 0% capital-gain band', hand: 0, derivation: 'taxable income 346,548.14 is past the indexed 106,504.48 breakpoint', contract: 'worksheet year-result-ltcg-zero-headroom', select: (year) => year.ltcgZeroHeadroom },
      { key: 'irmaa-lookback-year', label: 'IRMAA lookback year', hand: 2027, unit: 'year', derivation: '2029 − 2', contract: 'worksheet medicare-irmaa-two-year-lookback', select: (year) => year.irmaaLookbackMagiYear },
      { key: 'irmaa-lookback-source', label: 'IRMAA lookback source', hand: 'projected', derivation: '2027 is in the ledger', contract: 'YearResult.irmaaLookbackMagiSource', select: (year) => year.irmaaLookbackMagiSource },
      { key: 'irmaa-lookback-magi', label: 'IRMAA lookback MAGI', hand: MAGI_2027, tolerance: DRAW_FIXED_POINT_TOLERANCE, derivation: "2027's MAGI at its exact fixed point, 325,482.63: net RMD cash 12,746.50 + the 191,772.98 conversion + the first need-based IRA draw 72,410.13 + capped taxable Social Security 48,553.02; 2027's draw dollar also cost 24%, so its band is 0.005 / 0.76", contract: 'YearResult.irmaaLookbackMagi; ' + FIXED_POINT_SOURCE, select: (year) => year.irmaaLookbackMagi },
      { key: 'irmaa-tier', label: 'IRMAA tier', hand: 2, unit: 'count', derivation: '325,482.63 is above the joint tier-2 floor 274,000 × 1.025³ = 295,068.03 and not above the tier-3 floor 342,000 × 1.025³ = 368,296.59', contract: 'params/index.ts#irmaaTierForMagi, #irmaaTierThreshold; worksheet medicare-irmaa-first-tier-boundary (the method)', select: (year) => year.irmaaTier },
      { key: 'irmaa-next-threshold', label: 'Next IRMAA threshold', hand: IRMAA_TIER_3_FLOOR_2029, derivation: '342,000 × 1.025³, unrounded (the tier-2 floor is 295,068.03)', contract: 'YearResult.irmaaNextTierThreshold; rule record usc-42-1395r-i-5-C-top-irmaa-threshold-frozen', select: (year) => year.irmaaNextTierThreshold ?? undefined },
      { key: 'medicare-premiums', label: 'Medicare premiums, both', hand: MEDICARE_PREMIUMS_2029, derivation: "2 × (202.90 × 50/25 × 12 + 37.50 × 12) × 1.055³: Part B at the second tier's 50% share and its Part D surcharge, for twelve months each", contract: 'tax/medicare.ts#medicareAnnualPremiumPerPerson; registry usc-42-1395r-i-irmaa-applicable-percentage; worksheet medicare-base-part-b-premium', select: (year) => year.medicarePremiums },
      { key: 'irmaa-surcharge', label: 'IRMAA surcharge', hand: IRMAA_SURCHARGE_2029, derivation: '2 × ((405.80 − 202.90) × 12 + 37.50 × 12) × 1.055³: the premiums above the standard Part B', contract: 'YearResult.irmaaSurcharge', select: (year) => year.irmaaSurcharge },
      { key: 'base-spending', label: 'Base spending', hand: BASE_SPENDING_2029, derivation: '90,000 × 1.025³; the age-80 phase keys on Morgan and starts in 2033', contract: 'worksheet spending-base-annual', select: (year) => year.expenses.baseSpending },
      { key: 'healthcare', label: 'Healthcare', hand: HEALTHCARE_2029, derivation: '12,492.99 of premiums + 6,000 × 1.055³ of extras for two', contract: 'worksheet spending-healthcare-annual', select: (year) => year.expenses.healthcare },
      { key: 'spending-total', label: 'Total spending', hand: TOTAL_SPENDING_2029, derivation: '96,920.16 + 19,538.44', contract: 'worksheet spending-total-annual', select: (year) => year.expenses.total },
      { key: 'portfolio-need', label: 'Portfolio need after income', hand: NET_PORTFOLIO_NEED_2029, derivation: '116,458.59 + tax 67,229.26 − Social Security 60,012.96', contract: 'worksheet portfolio-need-annual; ' + CENTS_SOURCE, select: (year) => year.netPortfolioNeed },
      { key: 'withdrawal-cash', label: 'Withdrawn from cash', hand: 0, derivation: 'the cash account has been empty since 2027', contract: 'worksheet withdrawals-by-category-annual', select: (year) => year.withdrawals.cash },
      { key: 'withdrawal-traditional', label: 'Withdrawn from the IRAs', hand: WITHDRAWALS_TRADITIONAL_2029, tolerance: DRAW_FIXED_POINT_TOLERANCE, derivation: "the RMDs 15,550.35 (QCD included) plus the need-based draw 118,893.46: all of Morgan's remaining 72,891.84 (his IRA is the first traditional account in the plan), then 46,001.61 of Riley's; in closed form MAGI − 210,091.84 − 51,011.02 + 10,768.91, whatever the openings; the ledger's bisection lands within 0.005 / 0.76 of it", contract: 'worksheets withdrawals-by-category-annual; withdrawalStrategySchema sequential order; ' + FIXED_POINT_SOURCE, select: (year) => year.withdrawals.traditional },
      { key: 'withdrawal-roth', label: 'Withdrawn from the Roth IRAs', hand: 0, derivation: 'the conversion is not a withdrawal', contract: 'YearWithdrawals.total composition', select: (year) => year.withdrawals.roth },
      { key: 'withdrawal-total', label: 'Total withdrawals', hand: WITHDRAWALS_TRADITIONAL_2029, tolerance: DRAW_FIXED_POINT_TOLERANCE, derivation: 'the IRAs only (= need 123,674.90 + QCD 10,768.91, less the residual the fixed point accepts)', contract: 'worksheet withdrawals-total-annual; ' + CENTS_SOURCE, select: (year) => year.withdrawals.total },
      { key: 'surplus', label: 'Surplus invested', hand: 0, derivation: 'inflows 64,794.40 − spending 116,458.59 − tax < 0', contract: 'worksheet surplus-invested-annual', select: (year) => year.surplusInvested },
      { key: 'shortfall', label: 'Shortfall', hand: 0, derivation: "fully funded; Riley's IRA still holds 38,503.13 after the draw", contract: 'worksheet spending-shortfall-annual', select: (year) => year.shortfall },
      { key: 'balance-cash', label: 'Cash, year end', hand: 0, derivation: 'empty since 2027', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[accountIdOfType(plan, 'cash')] },
      { key: 'balance-ira-morgan', label: "Morgan's traditional IRA, year end", hand: 0, derivation: '177,684.60 − 7,497.24 RMD − 97,295.52 conversion − 72,891.84 drawn = 0: the need exceeds what is left by 46,001.61 at every landing the contracts allow', contract: 'worksheet accounts-balance-per-account-annual; annualWithdrawalPlanning.ts (the order within a category)', select: (year, plan) => year.balances[traditionalOf(plan, 0)] },
      { key: 'balance-ira-riley', label: "Riley's traditional IRA, year end", hand: IRA_RILEY_END_2029, tolerance: DRAW_FIXED_POINT_GROWN_TOLERANCE, derivation: "(177,684.60 + 205,354.17, the two 2028 IRA closes, − 210,091.84 conversion − 134,443.80 withdrawn) × 1.05, because Morgan's IRA empties; carries the draw band grown at 5%", contract: 'worksheet accounts-balance-per-account-annual; ' + CENTS_SOURCE, select: (year, plan) => year.balances[traditionalOf(plan, 1)] },
      { key: 'balance-roth', label: "Morgan's Roth IRA, year end", hand: ROTH_END_2029, derivation: '(438,431.35 + 97,295.52) × 1.05, the 2028 close being ((173,353.38 + 118,519.16) × 1.05 + 111,087.50) × 1.05 on his executed slices', contract: 'worksheet accounts-balance-per-account-annual; ' + CENTS_SOURCE, select: (year, plan) => year.balances[accountIdOfType(plan, 'roth')] },
      { key: 'balance-roth-riley', label: "Riley's Roth IRA, year end", hand: ROTH_RILEY_END_2029, derivation: '(246,255.67 + 112,796.32) × 1.05, the 2028 close being ((71,767.27 + 73,253.82) × 1.05 + 82,257.07) × 1.05 on her executed slices', contract: 'worksheet accounts-balance-per-account-annual; ' + CENTS_SOURCE, select: (year, plan) => year.balances[rothOf(plan, 1)] },
      { key: 'investable', label: 'Investable total', hand: INVESTABLE_2029, tolerance: DRAW_FIXED_POINT_GROWN_TOLERANCE, derivation: '0 + 0 + 40,428.28 + 562,513.22 + 377,004.59', contract: 'worksheet accounts-investable-total-annual; ' + CENTS_SOURCE, select: (year) => year.investableTotal },
      { key: 'net-worth', label: 'Net worth', hand: INVESTABLE_2029, tolerance: DRAW_FIXED_POINT_GROWN_TOLERANCE, derivation: 'investable only', contract: 'worksheet accounts-net-worth-annual; ' + CENTS_SOURCE, select: (year) => year.netWorth },
  ],
}

type BuiltPlan = ReturnType<Walkthrough['build']>
const personId = (plan: BuiltPlan, index: 0 | 1) => plan.household.people[index]!.id
const streamOf = (year: YearResult, plan: BuiltPlan, index: 0 | 1) =>
  year.socialSecurityStreams?.find((stream) => stream.personId === personId(plan, index))?.annualAmount
const ownedAccountOf = (plan: BuiltPlan, type: 'traditional' | 'roth', index: 0 | 1) => {
  const account = plan.accounts.find((a) => a.type === type && a.ownerPersonId === personId(plan, index))
  if (!account) throw new Error(`no ${type} account for person ${index}`)
  return account.id
}
const traditionalOf = (plan: BuiltPlan, index: 0 | 1) => ownedAccountOf(plan, 'traditional', index)
const rothOf = (plan: BuiltPlan, index: 0 | 1) => ownedAccountOf(plan, 'roth', index)

export const BRACKET_FILL_ROTH_WALKTHROUGH: Walkthrough = {
  id: 'bracket-fill-roth',
  title: 'Bracket-fill Roth conversions',
  exampleId: 'bracket-fill-roth',
  review: 'DOCS/walkthroughs/REVIEW-2026-09-27.md',
  inputs:
    'Morgan (born 1953-01-01, planning to 92) and Riley (born 1955-01-01, planning to 94), married filing jointly, Florida. Cash reserve 80,000 at 2%; Morgan\'s traditional IRA 700,000, Riley\'s traditional IRA 400,000, Morgan\'s Roth IRA 50,000 and Riley\'s Roth IRA 0, all at the plan default return of 5%. Social Security PIAs of 2,500 (Morgan) and 1,800 (Riley) a month, each claimed at 67. Roth conversions filled to the top of the 22% bracket from 2026 to 2034 and a 10,000 qualified charitable distribution each year. Spending 90,000 a year, cut to 85% from Morgan\'s age 80, plus 250 a month of Medicare extras each. Inflation 2.5%, healthcare inflation 5.5%; no market series.',
  contractNotes: [
    'The conversion is sized once for the household, then split between the owners in proportion to their traditional balances after the RMD, in exact cents; each share can convert only into that owner\'s own Roth IRA. Both spouses hold one, so both shares convert (in 2026, Morgan 115,098.46 and Riley 68,349.78) and taxable income ends a cent under the top of the 22% bracket the strategy targets. Until decision D-BRACKET-FILL-ROTH-EXAMPLE Riley held no Roth IRA, her share was dropped, and the bracket was never filled.',
    'Riley\'s full retirement age is 66y0m because a January-1 birth counts as the prior calendar year (1954); read as 1955 it would be 66y2m and her benefit 23,040 instead of 23,328. Age attained, the RMD start and the Medicare months use the calendar year.',
    'The 2026 senior deduction of 6,000 is phased out per person at 6% of the joint MAGI over 150,000, so a couple loses both at 250,000 of MAGI, not 350,000; at 247,232.13 only 332.14 is left.',
    'The household\'s 10,000 charitable distribution is routed from the RMD, and only Morgan has one in 2026, so the whole gift leaves his IRA and Riley gives nothing.',
    'The spending cut at 80 keys on the primary person, Morgan, and first applies in 2033.',
    'The first projection year is a full calendar year on the entered balances; both PIAs are read in start-year dollars (COLA factor 1); cash growth is untaxed; Florida\'s zero has no field; the funding fixed point is seeded with the pre-tax need and converges on its second evaluation.',
    'The household conversion amount is sized by bisection to $0.01 below the exact root, so that row carries a one-sided $0.01 tolerance. With two owners converting, the executed total is that amount rounded half up to the cent, so it can sit half a cent above the root or a cent and a half below it: both years hold it in that band. The contract leaves the cents open by one, so the rows downstream take the ledger\'s cents, which the bisection\'s traced lower bound fixes (in 2026 by 0.00032 of a dollar); they name that source.',
    'The need-based draw that follows the conversion is sized after it, so in the years the cash no longer covers the need (from 2027) the draw lands above the filled bracket, taxed at 24%, and the projection warns that spending withdrawals pushed income above the conversion target, which is now true.',
  ],
  tables: [{
    year: EXAMPLE_FIXED_YEAR,
    why: 'The first projection year: Morgan\'s first required distribution with the charitable gift taken from it, a household conversion sized to the top of the 22% bracket and executed for both spouses into their own Roth IRAs, two senior deductions phased out almost to nothing against the joint MAGI, and Medicare for two at tier 0.',
    rows: [
      { key: 'age-morgan', label: "Morgan's age attained", hand: 73, unit: 'count', derivation: '2026 − 1953', contract: 'PersonYearState.ageAttained', select: (year, plan) => year.people.find((p) => p.personId === personId(plan, 0))?.ageAttained },
      { key: 'age-riley', label: "Riley's age attained", hand: 71, unit: 'count', derivation: '2026 − 1955', contract: 'PersonYearState.ageAttained', select: (year, plan) => year.people.find((p) => p.personId === personId(plan, 1))?.ageAttained },
      { key: 'filing-status', label: 'Filing status', hand: 'marriedFilingJointly', derivation: 'household status with both alive', contract: 'YearResult.filingStatus', select: (year) => year.filingStatus },
      { key: 'ss-morgan', label: "Morgan's Social Security", hand: SS_MORGAN, derivation: '2,500 × 1.08 (12 months of delayed credit past FRA 66y0m) × 12 × COLA factor 1', contract: 'worksheets social-security-benefit-annual, delayed-retirement-credit-factor; nra.ts (January-1 rule, 1943–1954 cohort)', select: (year, plan) => streamOf(year, plan, 0) },
      { key: 'ss-riley', label: "Riley's Social Security", hand: SS_RILEY, derivation: '1,800 × 1.08 (effective birth year 1954, FRA 66y0m, 12 months of delayed credit) × 12; own 1,944 a month exceeds half of Morgan\'s PIA, so no spousal top-up', contract: 'worksheets social-security-benefit-annual, dual-entitlement-composition; nra.ts#effectiveBirthYear', select: (year, plan) => streamOf(year, plan, 1) },
      { key: 'social-security', label: 'Social Security, household', hand: SOCIAL_SECURITY, derivation: '32,400 + 23,328', contract: 'YearIncomes.socialSecurity', select: (year) => year.incomes.socialSecurity },
      { key: 'income-total', label: 'Total income', hand: SOCIAL_SECURITY, derivation: 'Social Security only', contract: 'worksheet income-total-annual', select: (year) => year.incomes.total },
      { key: 'rmd', label: 'Required minimum distribution (Morgan)', hand: RMD, derivation: '700,000 ÷ 26.5; Riley, 71, has none until 2028', contract: 'worksheet rmd-uniform-lifetime-divisor; params/index.ts#rmdStartAgeForBirthYear (the owner path: 73 for births 1951 to 1959) and domain rules §6', select: (year) => year.rmd },
      { key: 'qcd', label: 'Qualified charitable distribution', hand: QCD, derivation: '10,000 × inflation factor 1, all from Morgan\'s RMD, offsetting income in full', contract: 'worksheets qcd-limit-and-age-proxy, qcd-income-offset-qualified-slice', select: (year) => year.qcd },
      { key: 'conversion-sized', label: 'Conversion sized for the household', hand: HOUSEHOLD_ROOT, tolerance: BISECTION_TOLERANCE, bound: 'below', derivation: '(211,400 + 65,500) ÷ 1.12 − 47,368.80 − 16,415.09 = 183,448.25: the amount that brings joint taxable income to the top of the 22% bracket with the 85% cap binding and both senior deductions in phase-out; sized by bisection to $0.01 below', contract: 'YearResult.aggregateRothConversionAllocationDesired; strategies/rothConversion.ts (topOfBracket by bisection)', select: (year) => year.aggregateRothConversionAllocationDesired },
      { key: 'roth-conversion', label: 'Roth conversion executed (both spouses)', hand: HOUSEHOLD_ROOT - 0.005, tolerance: CONVERSION_CENT_TOLERANCE, derivation: 'the bisection lands at 183,448.2447 (its lower bound), 18,344,824 cents, split by the two IRAs\' post-RMD balances (67,358,491 : 40,000,000 cents, largest remainder): Morgan 115,098.46 into his Roth IRA and Riley 68,349.78 into hers, 183,448.24 in all; a landing at or above 183,448.245 would give 183,448.25, so the row holds the band from the root less 1.5 cents to the root plus half a cent, and its value is that band\'s centre, not a published figure: the engine executes 183,448.24', contract: 'worksheets exact-cent-pro-rata-half-up, exact-cent-largest-remainder-slices, roth-conversion-annual; registry irc-408-d-3-A-i-conversion-benefits-the-distributee; YearResult.rothConversion', select: (year) => year.rothConversion },
      { key: 'magi', label: 'Modified adjusted gross income', hand: MAGI, derivation: '16,415.09 net RMD + 183,448.24 conversion + 47,368.80 taxable Social Security (the 85% cap binds)', contract: 'worksheets federal-taxable-social-security-tiers, medicare-magi-composition; YearResult.magi; ' + CENTS_SOURCE, select: (year) => year.magi },
      { key: 'tax', label: 'Income tax (federal plus Florida)', hand: TAX, derivation: 'taxable income 247,232.13 − 35,500 − 332.14 (two senior deductions, almost gone) = 211,399.99; 10% of 24,800 + 12% of 76,000 + 22% of 110,599.99 = 35,932.00; Florida 0', contract: 'worksheets federal-standard-deduction-age-65, federal-ordinary-bracket-tax, tax-total-annual; tax/federalTax.ts#seniorDeductionAmount; ' + CENTS_SOURCE, select: (year) => year.tax },
      { key: 'amt', label: 'Alternative minimum tax', hand: 0, derivation: 'AMTI 247,232.13 − exemption 140,200 = 107,032.13 × 26% = 27,828.35, below the regular tax', contract: 'worksheet federal-amt-screen', select: (year) => year.amt },
      { key: 'penalties', label: 'Penalties', hand: 0, derivation: 'RMD fully taken; a conversion is never penalized', contract: 'worksheet tax-penalties-annual', select: (year) => year.penalties },
      { key: 'realized-gains', label: 'Realized capital gains', hand: 0, derivation: 'no taxable account', contract: 'worksheet tax-realized-gains-annual', select: (year) => year.realizedGains },
      { key: 'ltcg-zero-headroom', label: 'Room left in the 0% capital-gain band', hand: 0, derivation: 'taxable income 211,399.99 already exceeds the joint 15% breakpoint 98,900', contract: 'worksheet year-result-ltcg-zero-headroom', select: (year) => year.ltcgZeroHeadroom },
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
      { key: 'portfolio-need', label: 'Portfolio need after income', hand: NET_PORTFOLIO_NEED, derivation: '100,869.60 + tax 35,932.00 − Social Security 55,728', contract: 'worksheet portfolio-need-annual; ' + CENTS_SOURCE, select: (year) => year.netPortfolioNeed },
      { key: 'withdrawal-cash', label: 'Withdrawn from cash', hand: CASH_DRAW, derivation: '81,073.60 − 16,415.09 net RMD cash; the conversion\'s tax rides this draw; cash covers it', contract: 'worksheet withdrawals-by-category-annual; withdrawalStrategySchema sequential order; ' + CENTS_SOURCE, select: (year) => year.withdrawals.cash },
      { key: 'withdrawal-traditional', label: 'Withdrawn from the IRAs', hand: RMD, derivation: 'the gross RMD, QCD included; the conversion is not a withdrawal', contract: 'YearWithdrawals.total composition; YearResult.rmd', select: (year) => year.withdrawals.traditional },
      { key: 'withdrawal-roth', label: 'Withdrawn from the Roth IRAs', hand: 0, derivation: 'nothing drawn', contract: 'worksheet withdrawals-by-category-annual', select: (year) => year.withdrawals.roth },
      { key: 'withdrawal-total', label: 'Total withdrawals', hand: WITHDRAWALS_TOTAL, derivation: '64,658.50 + 26,415.09 (= need 81,073.60 + QCD 10,000)', contract: 'worksheet withdrawals-total-annual; ' + CENTS_SOURCE, select: (year) => year.withdrawals.total },
      { key: 'surplus', label: 'Surplus invested', hand: 0, derivation: 'max(0, inflows 72,143.09 − spending 100,869.60 − tax 35,932.00) = 0', contract: 'worksheet surplus-invested-annual', select: (year) => year.surplusInvested },
      { key: 'shortfall', label: 'Shortfall', hand: 0, derivation: 'fully funded', contract: 'worksheet spending-shortfall-annual', select: (year) => year.shortfall },
      { key: 'balance-cash', label: 'Cash, year end', hand: CASH_END, derivation: '(80,000 − 64,658.50) × 1.02', contract: 'worksheet accounts-balance-per-account-annual; annualPostSolveAccountGrowth.ts (growth after flows); ' + CENTS_SOURCE, select: (year, plan) => year.balances[accountIdOfType(plan, 'cash')] },
      { key: 'balance-ira-morgan', label: "Morgan's IRA, year end", hand: IRA_MORGAN_END, derivation: '(700,000 − 26,415.09 RMD − 115,098.46 conversion) × 1.05', contract: 'worksheet accounts-balance-per-account-annual; ' + CENTS_SOURCE, select: (year, plan) => year.balances[traditionalOf(plan, 0)] },
      { key: 'balance-ira-riley', label: "Riley's IRA, year end", hand: IRA_RILEY_END, derivation: '(400,000 − 68,349.78 conversion) × 1.05: no RMD and no gift at 71', contract: 'worksheet accounts-balance-per-account-annual; ' + CENTS_SOURCE, select: (year, plan) => year.balances[traditionalOf(plan, 1)] },
      { key: 'balance-roth', label: "Morgan's Roth IRA, year end", hand: ROTH_END, derivation: '(50,000 + 115,098.46) × 1.05', contract: 'worksheet accounts-balance-per-account-annual; ' + CENTS_SOURCE, select: (year, plan) => year.balances[accountIdOfType(plan, 'roth')] },
      { key: 'balance-roth-riley', label: "Riley's Roth IRA, year end", hand: ROTH_RILEY_END, derivation: '(0 + 68,349.78) × 1.05', contract: 'worksheet accounts-balance-per-account-annual; ' + CENTS_SOURCE, select: (year, plan) => year.balances[rothOf(plan, 1)] },
      { key: 'investable', label: 'Investable total', hand: INVESTABLE, derivation: '15,648.33 + 586,410.77 + 348,232.73 + 173,353.38 + 71,767.27', contract: 'worksheet accounts-investable-total-annual; ' + CENTS_SOURCE, select: (year) => year.investableTotal },
      { key: 'net-worth', label: 'Net worth', hand: INVESTABLE, derivation: 'investable only', contract: 'worksheet accounts-net-worth-annual; ' + CENTS_SOURCE, select: (year) => year.netWorth },
    ],
  }, TABLE_2029],
  build: buildBracketFillRoth,
}

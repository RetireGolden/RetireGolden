import { EXAMPLE_FIXED_YEAR } from '../buildContext'
import { buildBracketFillRoth } from '../buildBracketFillRoth'
import { accountIdOfType, type Walkthrough, type WalkthroughTable, type YearResult } from './walkthrough'

/**
 * "Bracket-fill Roth conversions", years 2026 and 2029 by hand.
 *
 * Derived 2026-09-22 from the plan's inputs and the engine's documented
 * contracts without running the engine, and independently recomputed; the
 * full derivation with every citation is DOCS/walkthroughs/bracket-fill-roth.md
 * (2026 in part I; 2027 and 2028 as bridges, then 2029, in part II).
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

// The split: the household amount the bisection landed on (its lower bound,
// traced: 0.0038 below the root), rounded half-up to cents, is shared between
// the owners in proportion to their post-RMD traditional balances in exact
// cents, largest remainder. Morgan's slice can convert into his Roth IRA;
// Riley has no Roth account, so her slice is dropped with a warning naming
// her. The root itself would round to 18,344,825 cents; any landing the
// bisection's $0.01 allows gives Morgan the same 11,509,846 cents.
const HOUSEHOLD_LANDING = 183_448.244678974151611328125 // the bisection's lower bound
const MORGAN_WEIGHT_CENTS = Math.round((700_000 - RMD) * 100) // 67,358,491
const RILEY_WEIGHT_CENTS = 400_000 * 100 // 40,000,000
const HOUSEHOLD_CENTS = Math.round(HOUSEHOLD_LANDING * 100) // 18,344,824
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

// ---- 2029 (DOCS/walkthroughs/bracket-fill-roth.md, part II; 2027 and 2028 bridged there) ----
// Every indexed federal figure is the 2026 figure at 1.025 a year (the
// brackets, the deduction and its age-65 additions, the AMT exemption, the
// capital-gain breakpoint); the senior deduction ends after 2028; the QCD,
// base spending and the COLA index at general inflation; Part B and the
// extras at the health rate 1.055 a year; the IRMAA floors at general
// inflation, unrounded. The year starts from the ledger's 2028 closes: the
// 2027 and 2028 need-based draws are fixed points the ledger accepted within
// half a cent of balancing, and the executed conversions of those years are
// the cents of their bisection landings (109,869.91 and 93,519.25), so those
// figures are written as the ledger holds them, with the closed forms beside
// them in the derivation.
const INFL_2029 = 1.025 * 1.025 * 1.025 // 1.076890625
const HEALTH_2029 = 1.055 * 1.055 * 1.055 // 1.174241375
const CONVERSION_2027 = 109_869.91 // the cents of the 2027 landing split (part II §2 B10–B11)
const CONVERSION_2028 = 93_519.25 // the cents of the 2028 landing split (part II §3 C10–C11)
const IRA_MORGAN_OPEN_2029 = 302_199.0464705796 // the 2028 close as the ledger holds it (part II §3 C18; closed form 302,199.0497)
const IRA_RILEY_OPEN_2029 = (IRA_RILEY_END * 1.05 - (IRA_RILEY_END * 1.05) / 26.5) * 1.05 // 445,576.42: 441,000 at the end of 2027, then her first RMD (at 73) and growth in 2028
const ROTH_OPEN_2029 = ((ROTH_END + CONVERSION_2027) * 1.05 + CONVERSION_2028) * 1.05 // 410,448.89
const SS_MORGAN_2029 = SS_MORGAN * INFL_2029 // 34,891.26
const SS_RILEY_2029 = SS_RILEY * INFL_2029 // 25,121.70
const SOCIAL_SECURITY_2029 = SOCIAL_SECURITY * INFL_2029 // 60,012.96
const RMD_MORGAN_2029 = IRA_MORGAN_OPEN_2029 / 23.7 // 12,751.01 at 76
const RMD_RILEY_2029 = IRA_RILEY_OPEN_2029 / 25.5 // 17,473.58 at 74
const RMD_2029 = RMD_MORGAN_2029 + RMD_RILEY_2029 // 30,224.60
const QCD_2029 = 10_000 * INFL_2029 // 10,768.91, from both RMDs
const NET_RMD_CASH_2029 = RMD_2029 - QCD_2029 // 19,455.69
const TAXABLE_SS_CAP_2029 = 0.85 * SOCIAL_SECURITY_2029 // 51,011.02: the cap binds at every candidate
const STANDARD_DEDUCTION_2029 = STANDARD_DEDUCTION * INFL_2029 // 38,229.62; no senior deduction
const BRACKET_10_TOP_2029 = 24_800 * INFL_2029 // 26,706.89
const BRACKET_12_TOP_2029 = 100_800 * INFL_2029 // 108,550.58
const BRACKET_TOP_22_2029 = BRACKET_TOP_22 * INFL_2029 // 227,654.68, the sizing ceiling
const HOUSEHOLD_ROOT_2029 = BRACKET_TOP_22_2029 + STANDARD_DEDUCTION_2029 - TAXABLE_SS_CAP_2029 - NET_RMD_CASH_2029 // 195,417.59
const ROTH_CONVERSION_2029 = 78_828.19 // Morgan's cents of the landing 195,417.5787 split 28,944,803 : 42,810,283
const ordinaryTax2029 = (ordinaryTaxable: number) =>
  BRACKET_10_TOP_2029 * 0.1 + (BRACKET_12_TOP_2029 - BRACKET_10_TOP_2029) * 0.12 + (ordinaryTaxable - BRACKET_12_TOP_2029) * 0.22
const PART_B_2029 = 2 * 202.9 * 12 * HEALTH_2029 // 5,718.09
const HEALTHCARE_2029 = HEALTHCARE * HEALTH_2029 // 12,763.53
const BASE_SPENDING_2029 = BASE_SPENDING * INFL_2029 // 96,920.16
const TOTAL_SPENDING_2029 = BASE_SPENDING_2029 + HEALTHCARE_2029 // 109,683.69
const IRMAA_FLOOR_2029 = 218_000 * INFL_2029 // 234,762.16

// The need-based draw is a fixed point: need = pre-tax gap + tax(draw), where
// each drawn dollar is ordinary income at 22% (the 85% cap on taxable Social
// Security binds, the senior deduction has ended, and income stays inside the
// 22% band), so draw = (gap + tax with no draw) / 0.78.
const PRE_TAX_GAP_2029 = TOTAL_SPENDING_2029 - (SOCIAL_SECURITY_2029 + NET_RMD_CASH_2029) // 30,215.04
const ORDINARY_BEFORE_DRAW_2029 = NET_RMD_CASH_2029 + ROTH_CONVERSION_2029 // 98,283.88
const TAX_NO_DRAW_2029 = ordinaryTax2029(ORDINARY_BEFORE_DRAW_2029 + TAXABLE_SS_CAP_2029 - STANDARD_DEDUCTION_2029) // 12,491.93 + 22% of the excess
const DRAW_2029 = (PRE_TAX_GAP_2029 + TAX_NO_DRAW_2029) / (1 - 0.22) // 55,461.80
const MAGI_2029 = ORDINARY_BEFORE_DRAW_2029 + DRAW_2029 + TAXABLE_SS_CAP_2029 // 204,756.70
const TAX_2029 = ordinaryTax2029(MAGI_2029 - STANDARD_DEDUCTION_2029) + 0 // 25,246.76
const NET_PORTFOLIO_NEED_2029 = TOTAL_SPENDING_2029 + TAX_2029 - SOCIAL_SECURITY_2029 // 74,917.49
const WITHDRAWALS_TRADITIONAL_2029 = RMD_2029 + DRAW_2029 // 85,686.40
const IRA_MORGAN_END_2029 = (IRA_MORGAN_OPEN_2029 - RMD_MORGAN_2029 - ROTH_CONVERSION_2029 - DRAW_2029) * 1.05 // 162,915.94
const IRA_RILEY_END_2029 = (IRA_RILEY_OPEN_2029 - RMD_RILEY_2029) * 1.05 // 449,507.97
const ROTH_END_2029 = (ROTH_OPEN_2029 + ROTH_CONVERSION_2029) * 1.05 // 513,740.94
const INVESTABLE_2029 = 0 + IRA_MORGAN_END_2029 + IRA_RILEY_END_2029 + ROTH_END_2029 // 1,126,164.85
// 2027's MAGI at its exact fixed point (part II §2 B16, chain form): the
// figure the 2029 premium reads. Its draw dollar cost 24.64% (22% plus the
// senior phase-out's 12% of it), so the ledger's landing sits within
// 0.005 / 0.7536 of it.
const MAGI_2027 = 194_727.9301022473

/**
 * The bands the published contracts give. The funding fixed point is
 * accepted within 0.005 of its residual, and each drawn dollar costs 22% in
 * 2029, so the draw sits within 0.005 / 0.78 = 0.00641 of the exact root,
 * as do MAGI and the withdrawals; grown at 5% for the year-end balances,
 * 0.00673. In 2027 the marginal cost was 24.64%, so 0.005 / 0.7536 = 0.00664.
 * Tax and the need move by 22% of the draw's band and keep half a cent. The
 * executed conversion is held to $0.01: the earlier years' allowed draw
 * landings can move Morgan's cent slice down by one (with a low 2029
 * landing), and up by one once their conversion cents move too.
 */
const DRAW_FIXED_POINT_TOLERANCE = 0.0065
const DRAW_FIXED_POINT_GROWN_TOLERANCE = 0.007
const DRAW_FIXED_POINT_TOLERANCE_2027 = 0.007
const CONVERSION_CENT_TOLERANCE = 0.01

const TABLE_2029: WalkthroughTable = {
  year: 2029,
  why: "Three years on (2027 and 2028 bridged in the derivation): both spouses take RMDs and the gift is shared between them by RMD size; the household conversion is still split by IRA balance and Riley's share still dropped, so the bracket is still not filled; the senior deduction has ended; Medicare is priced on 2027's projected MAGI, which carries that year's conversion; and, with the cash gone since 2027, the year's need is drawn from Morgan's IRA as a taxed fixed point that the ledger accepts within half a cent of balancing, not within half a cent of the exact answer.",
  rows: [
      { key: 'age-morgan', label: "Morgan's age attained", hand: 76, unit: 'count', derivation: '2029 − 1953', contract: 'PersonYearState.ageAttained', select: (year, plan) => year.people.find((p) => p.personId === personId(plan, 0))?.ageAttained },
      { key: 'age-riley', label: "Riley's age attained", hand: 74, unit: 'count', derivation: '2029 − 1955', contract: 'PersonYearState.ageAttained', select: (year, plan) => year.people.find((p) => p.personId === personId(plan, 1))?.ageAttained },
      { key: 'filing-status', label: 'Filing status', hand: 'marriedFilingJointly', derivation: 'both alive', contract: 'YearResult.filingStatus', select: (year) => year.filingStatus },
      { key: 'ss-morgan', label: "Morgan's Social Security", hand: SS_MORGAN_2029, derivation: '2,500 × 1.08 × 12 × 1.025³ (the COLA factor from the start year)', contract: 'worksheets social-security-benefit-annual, social-security-cola-factor', select: (year, plan) => streamOf(year, plan, 0) },
      { key: 'ss-riley', label: "Riley's Social Security", hand: SS_RILEY_2029, derivation: '1,800 × 1.08 × 12 × 1.025³; the spousal candidate is still below her own benefit', contract: 'worksheets social-security-benefit-annual, social-security-spousal-top-up', select: (year, plan) => streamOf(year, plan, 1) },
      { key: 'social-security', label: 'Social Security, gross for the year', hand: SOCIAL_SECURITY_2029, derivation: '55,728 × 1.025³', contract: 'YearIncomes.socialSecurity', select: (year) => year.incomes.socialSecurity },
      { key: 'income-total', label: 'Total income', hand: SOCIAL_SECURITY_2029, derivation: 'Social Security only', contract: 'worksheet income-total-annual', select: (year) => year.incomes.total },
      { key: 'rmd', label: 'Required minimum distributions, both IRAs', hand: RMD_2029, derivation: "Morgan 302,199.05 ÷ 23.7 (age 76) = 12,751.01 on the ledger's 2028 close; Riley 445,576.42 ÷ 25.5 (age 74) = 17,473.58, her second RMD year", contract: 'worksheet rmd-uniform-lifetime-divisor; simulate.ts (prior December 31 balances)', select: (year) => year.rmd },
      { key: 'qcd', label: 'Qualified charitable distribution', hand: QCD_2029, derivation: '10,000 × 1.025³ = 10,768.91, taken from both RMDs in proportion to their size (Morgan 4,543.14, Riley 6,225.77: the owner sorted first by person id gets his share, the last takes the remainder)', contract: 'strategiesSchema.qcdAnnual; annualLegacyQcdGiftPlan (attribution across owners); worksheet qcd-limit-and-age-proxy', select: (year) => year.qcd },
      { key: 'conversion-sized', label: 'Household conversion amount (sized)', hand: HOUSEHOLD_ROOT_2029, tolerance: BISECTION_TOLERANCE, bound: 'below', derivation: 'the amount that brings taxable income to the indexed 22% ceiling 227,654.68: AGI at the root = 227,654.68 + 38,229.62 (the indexed deduction with two age-65 additions; no senior deduction from 2029), less taxable Social Security at its 85% cap 51,011.02, less the 19,455.69 of net RMD cash = 195,417.59; the bisection returns the lower bound', contract: 'YearResult.aggregateRothConversionAllocationDesired; rothConversion.ts#sizeRothConversion (to $0.01, the lower bound); params/index.ts#indexFederalTaxPack', select: (year) => year.aggregateRothConversionAllocationDesired },
      { key: 'roth-conversion', label: 'Roth conversion executed (Morgan)', hand: ROTH_CONVERSION_2029, tolerance: CONVERSION_CENT_TOLERANCE, derivation: "the household landing split in cents by the two IRAs' post-RMD balances (Morgan 289,448.03 against Riley 428,102.83): Morgan's 7,882,819 cents; Riley's 11,658,939 cents are dropped because she holds no Roth IRA. The cents are those of the ledger's landings; the earlier years' allowed draw landings can move Morgan's weight and the 2029 root together and lower the slice by a cent, and with their conversion cents free raise it by one, so the row is held to $0.01", contract: 'YearResult.rothConversion (the per-owner split and the dropped share); worksheets exact-cent-pro-rata-half-up, exact-cent-largest-remainder-slices', select: (year) => year.rothConversion },
      { key: 'magi', label: 'Modified adjusted gross income', hand: MAGI_2029, tolerance: DRAW_FIXED_POINT_TOLERANCE, derivation: '19,455.69 net RMD cash + 78,828.19 conversion + 55,461.80 need-based IRA draw + 51,011.02 taxable Social Security (the 85% cap binds); the draw is a fixed point (each drawn dollar is taxed at 22% and the tax is drawn too), so the row carries the fixed-point band', contract: 'worksheet medicare-magi-composition; YearResult.magi; annualFundingFixedPoint.ts (accepted within 0.005 of its residual)', select: (year) => year.magi },
      { key: 'tax', label: 'Income tax (federal plus Florida)', hand: TAX_2029, derivation: 'taxable income 204,756.70 − 38,229.62 = 166,527.08 on the indexed joint brackets 26,706.89 / 108,550.58: 2,670.69 + 9,821.24 + 12,754.83 = 25,246.76; no senior deduction (it ended after 2028); the fixed-point band scaled by 22% stays under half a cent; Florida 0', contract: 'worksheets federal-ordinary-bracket-tax, tax-total-annual; tax/federalTax.ts#seniorDeductionAmount (year > lastApplicableYear)', select: (year) => year.tax },
      { key: 'amt', label: 'Alternative minimum tax', hand: 0, derivation: 'AMTI 204,756.70 less the indexed 150,980.07 exemption; tentative 13,981.92 is below the regular tax', contract: 'worksheet federal-amt-screen', select: (year) => year.amt },
      { key: 'penalties', label: 'Penalties', hand: 0, derivation: 'both RMDs taken; both past 59½; a conversion is never penalized', contract: 'worksheet tax-penalties-annual', select: (year) => year.penalties },
      { key: 'realized-gains', label: 'Realized capital gains', hand: 0, derivation: 'no taxable account', contract: 'worksheet tax-realized-gains-annual', select: (year) => year.realizedGains },
      { key: 'ltcg-zero-headroom', label: 'Room left in the 0% capital-gain band', hand: 0, derivation: 'taxable income 166,527.08 is past the indexed 106,504.48 breakpoint', contract: 'worksheet year-result-ltcg-zero-headroom', select: (year) => year.ltcgZeroHeadroom },
      { key: 'irmaa-lookback-year', label: 'IRMAA lookback year', hand: 2027, unit: 'year', derivation: '2029 − 2', contract: 'worksheet medicare-irmaa-two-year-lookback', select: (year) => year.irmaaLookbackMagiYear },
      { key: 'irmaa-lookback-source', label: 'IRMAA lookback source', hand: 'projected', derivation: '2027 is in the ledger', contract: 'YearResult.irmaaLookbackMagiSource', select: (year) => year.irmaaLookbackMagiSource },
      { key: 'irmaa-lookback-magi', label: 'IRMAA lookback MAGI', hand: MAGI_2027, tolerance: DRAW_FIXED_POINT_TOLERANCE_2027, derivation: "2027's MAGI at its exact fixed point, 194,727.93: net RMD cash 12,746.50 + the 109,869.91 conversion + the first need-based draw 23,558.50 + capped taxable Social Security 48,553.02; 2027's draw dollar cost 24.64% (22% plus the senior phase-out), so its band is 0.005 / 0.7536", contract: 'YearResult.irmaaLookbackMagi; annualFundingFixedPoint.ts', select: (year) => year.irmaaLookbackMagi },
      { key: 'irmaa-tier', label: 'IRMAA tier', hand: 0, unit: 'count', derivation: '194,727.93 is not above the joint first-tier floor 218,000 × 1.025³ = 234,762.16', contract: 'worksheet medicare-irmaa-first-tier-boundary; params/index.ts#irmaaTierThreshold', select: (year) => year.irmaaTier },
      { key: 'irmaa-next-threshold', label: 'Next IRMAA threshold', hand: IRMAA_FLOOR_2029, derivation: '218,000 × 1.025³, unrounded', contract: 'YearResult.irmaaNextTierThreshold; rule record usc-42-1395r-i-5-C-top-irmaa-threshold-frozen', select: (year) => year.irmaaNextTierThreshold ?? undefined },
      { key: 'medicare-premiums', label: 'Medicare premiums, both', hand: PART_B_2029, derivation: '2 × 202.90 × 12 × 1.055³ (the health rate from the pack year); no surcharge', contract: 'worksheet medicare-base-part-b-premium', select: (year) => year.medicarePremiums },
      { key: 'irmaa-surcharge', label: 'IRMAA surcharge', hand: 0, derivation: 'tier 0', contract: 'YearResult.irmaaSurcharge', select: (year) => year.irmaaSurcharge },
      { key: 'base-spending', label: 'Base spending', hand: BASE_SPENDING_2029, derivation: '90,000 × 1.025³; the age-80 phase keys on Morgan and starts in 2033', contract: 'worksheet spending-base-annual', select: (year) => year.expenses.baseSpending },
      { key: 'healthcare', label: 'Healthcare', hand: HEALTHCARE_2029, derivation: '10,869.60 × 1.055³: Part B and the extras for two', contract: 'worksheet spending-healthcare-annual', select: (year) => year.expenses.healthcare },
      { key: 'spending-total', label: 'Total spending', hand: TOTAL_SPENDING_2029, derivation: '96,920.16 + 12,763.53', contract: 'worksheet spending-total-annual', select: (year) => year.expenses.total },
      { key: 'portfolio-need', label: 'Portfolio need after income', hand: NET_PORTFOLIO_NEED_2029, derivation: '109,683.69 + tax 25,246.76 − Social Security 60,012.96', contract: 'worksheet portfolio-need-annual', select: (year) => year.netPortfolioNeed },
      { key: 'withdrawal-cash', label: 'Withdrawn from cash', hand: 0, derivation: 'the cash account has been empty since 2027', contract: 'worksheet withdrawals-by-category-annual', select: (year) => year.withdrawals.cash },
      { key: 'withdrawal-traditional', label: 'Withdrawn from the IRAs', hand: WITHDRAWALS_TRADITIONAL_2029, tolerance: DRAW_FIXED_POINT_TOLERANCE, derivation: "the RMDs 30,224.60 (QCD included) plus the need-based draw 55,461.80 from Morgan's IRA, the first traditional account in the plan (Riley's is not reached): the draw solves need = pre-tax gap 30,215.04 + tax(draw), so draw = (30,215.04 + 12,491.93 + 0.22 × (98,283.88 + 51,011.02 − 38,229.62 − 108,550.58)) ÷ 0.78; the ledger's bisection lands within 0.005 / 0.78 of it", contract: 'worksheets withdrawals-by-category-annual; withdrawalStrategySchema sequential order; annualFundingFixedPoint.ts', select: (year) => year.withdrawals.traditional },
      { key: 'withdrawal-roth', label: 'Withdrawn from the Roth', hand: 0, derivation: 'the conversion is not a withdrawal', contract: 'YearWithdrawals.total composition', select: (year) => year.withdrawals.roth },
      { key: 'withdrawal-total', label: 'Total withdrawals', hand: WITHDRAWALS_TRADITIONAL_2029, tolerance: DRAW_FIXED_POINT_TOLERANCE, derivation: 'the IRAs only (= need 74,917.49 + QCD 10,768.91)', contract: 'worksheet withdrawals-total-annual', select: (year) => year.withdrawals.total },
      { key: 'surplus', label: 'Surplus invested', hand: 0, derivation: 'inflows 79,468.65 − spending 109,683.69 − tax < 0', contract: 'worksheet surplus-invested-annual', select: (year) => year.surplusInvested },
      { key: 'shortfall', label: 'Shortfall', hand: 0, derivation: 'fully funded', contract: 'worksheet spending-shortfall-annual', select: (year) => year.shortfall },
      { key: 'balance-cash', label: 'Cash, year end', hand: 0, derivation: 'empty since 2027', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[accountIdOfType(plan, 'cash')] },
      { key: 'balance-ira-morgan', label: "Morgan's traditional IRA, year end", hand: IRA_MORGAN_END_2029, tolerance: DRAW_FIXED_POINT_GROWN_TOLERANCE, derivation: '(302,199.05 − 12,751.01 − 78,828.19 − 55,461.80) × 1.05; carries the draw band grown at 5%', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[traditionalOf(plan, 0)] },
      { key: 'balance-ira-riley', label: "Riley's traditional IRA, year end", hand: IRA_RILEY_END_2029, derivation: '(445,576.42 − 17,473.58) × 1.05: no conversion, no draw, and her gift comes out of her RMD', contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[traditionalOf(plan, 1)] },
      { key: 'balance-roth', label: 'Roth IRA, year end', hand: ROTH_END_2029, derivation: "(410,448.89 + 78,828.19) × 1.05, the 2028 close being ((173,353.38 + 109,869.91) × 1.05 + 93,519.25) × 1.05 on the ledger's executed conversions", contract: 'worksheet accounts-balance-per-account-annual', select: (year, plan) => year.balances[accountIdOfType(plan, 'roth')] },
      { key: 'investable', label: 'Investable total', hand: INVESTABLE_2029, tolerance: DRAW_FIXED_POINT_GROWN_TOLERANCE, derivation: '0 + 162,915.95 + 449,507.97 + 513,740.94', contract: 'worksheet accounts-investable-total-annual', select: (year) => year.investableTotal },
      { key: 'net-worth', label: 'Net worth', hand: INVESTABLE_2029, tolerance: DRAW_FIXED_POINT_GROWN_TOLERANCE, derivation: 'investable only', contract: 'worksheet accounts-net-worth-annual', select: (year) => year.netWorth },
  ],
}

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
    'The household conversion amount is sized by bisection to $0.01 below the exact root, so that row carries a $0.01 tolerance; the executed conversion is quantized to cents by the owner split: exact in 2026, where every landing the contract allows gives the same cents, and held to $0.01 in 2029, where the earlier years\' allowed landings can move Morgan\'s slice by a cent.',
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
      { key: 'roth-conversion', label: 'Roth conversion executed', hand: ROTH_CONVERSION, derivation: 'the bisection lands at 183,448.2447 (its lower bound), 18,344,824 cents; × 67,358,491 ÷ 107,358,491 = 11,509,846 cents for Morgan (his post-RMD balance over the two IRAs\' total, largest remainder); the root would round to 18,344,825 cents and give the same slice; Riley\'s 68,349.78 dropped, she holds no Roth', contract: 'worksheets exact-cent-pro-rata-half-up, roth-conversion-annual; registry irc-408-d-3-A-i-conversion-benefits-the-distributee; YearResult.rothConversion', select: (year) => year.rothConversion },
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
  }, TABLE_2029],
  build: buildBracketFillRoth,
}

import { describe, expect, it } from 'vitest'
import { REAL_YIELD_CURVE_2026 } from './data/realYieldCurve2026.js'
import { packForYear, rmdStartAgeForBirthYear } from './index.js'
import { PARAMETER_PROVENANCE } from './provenance.js'
import { stateParamsFor } from './state/index.js'
import type { StateTaxParams } from './state/types.js'

const pack = packForYear(2026).pack
const START_YEAR = 2026

type SeniorDeductionParams = NonNullable<typeof pack.federalTax.seniorDeduction>

function requiredSeniorDeduction(): SeniorDeductionParams {
  const value = pack.federalTax.seniorDeduction
  if (value === null) {
    throw new Error(`${START_YEAR} parameter pack must include federal senior deduction figures`)
  }
  return value
}

function requiredIrmaaTier(position: 'first' | 'last') {
  const tier =
    position === 'first' ? pack.medicare.irmaaTiers[0] : pack.medicare.irmaaTiers.at(-1)
  if (!tier) {
    throw new Error(`${START_YEAR} parameter pack must include IRMAA tiers`)
  }
  return tier
}

function requiredPartDSurchargeMonthly(
  tier: { partDSurchargeMonthly: number | null },
  tierLabel: string,
): number {
  const value = tier.partDSurchargeMonthly
  if (value === null) {
    throw new Error(`${START_YEAR} parameter pack must verify ${tierLabel} IRMAA tier Part D surcharge`)
  }
  return value
}

const COUNT_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
] as const

/** HUD annual HECM mortgage-insurance premium increment cited in provenance prose. */
const HECM_ANNUAL_MIP_RATE_PCT = 0.5

type FigureClause = Readonly<{ label: string; clause: string }>

type NonPackNumericClaim = Readonly<{
  id: string
  claim: string
  ownership: string
}>

function usd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`
}

function usdK(amount: number): string {
  return `$${amount / 1_000}k`
}

function pctOneDecimal(ratePct: number): string {
  return `${ratePct.toFixed(1)}%`
}

function pctTwoDecimals(ratePct: number): string {
  return `${ratePct.toFixed(2)}%`
}

function pctThreeDecimals(ratePct: number): string {
  return `${ratePct.toFixed(3)}%`
}

function countWord(count: number): string {
  const word = COUNT_WORDS[count]
  if (word === undefined) {
    throw new Error(`unsupported provenance count ${count}`)
  }
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function countWordLower(count: number): string {
  const word = COUNT_WORDS[count]
  if (word === undefined) {
    throw new Error(`unsupported provenance count ${count}`)
  }
  return word
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const PROVENANCE_NUMERIC_TOKEN = /(?:\$\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?)/g

/** Literal clause matcher with numeric token boundaries to reject prefix/suffix digit mutations. */
function clauseLiteralPattern(clause: string): RegExp {
  const parts: string[] = []
  let lastIndex = 0
  for (const match of clause.matchAll(PROVENANCE_NUMERIC_TOKEN)) {
    if (match.index > lastIndex) {
      parts.push(escapeRegExp(clause.slice(lastIndex, match.index)))
    }
    parts.push(`(?<![\\d,.])${escapeRegExp(match[0])}(?![\\d]|[.,]\\d)`)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < clause.length) {
    parts.push(escapeRegExp(clause.slice(lastIndex)))
  }
  return new RegExp(parts.join(''))
}

function figuresContainsClause(figures: string, clause: string): boolean {
  return clauseLiteralPattern(clause).test(figures)
}

function byId(id: string) {
  const entry = PARAMETER_PROVENANCE.find((source) => source.id === id)
  expect(entry, `missing provenance id ${id}`).toBeTruthy()
  return entry!
}

function figuresMatchClauses(figures: string, clauses: readonly FigureClause[]): boolean {
  return clauses.every(({ clause }) => figuresContainsClause(figures, clause))
}

function assertFiguresClauses(
  figures: string,
  clauses: readonly FigureClause[],
  id: string,
): void {
  for (const { clause, label } of clauses) {
    expect(figures, `${id}: ${label}`).toMatch(clauseLiteralPattern(clause))
  }
}

function deSelectedBracketRangeClause(de: StateTaxParams): string {
  const bracketIndex = de.brackets.single.findIndex((bracket) => bracket.lowerBound === 25_000)
  if (bracketIndex < 0) {
    throw new Error('DE pack missing $25,000 bracket lower bound')
  }
  const selected = de.brackets.single[bracketIndex]!
  const nextUpper = de.brackets.single[bracketIndex + 1]?.lowerBound
  if (nextUpper === undefined) {
    throw new Error('DE pack missing bracket above $25,000')
  }
  return `§1102(a)(14) ${pctTwoDecimals(selected.ratePct)} on ${usd(selected.lowerBound)}–${usd(nextUpper)}`
}

function wvBreakpointLabel(amount: number): string {
  return amount === 0 ? '$0' : usdK(amount)
}

function wvRateBreakpointClause(wv: StateTaxParams): string {
  const breakpoints = wv.brackets.single.map((bracket) => wvBreakpointLabel(bracket.lowerBound)).join('/')
  const minRate = pctTwoDecimals(wv.brackets.single[0]!.ratePct)
  const maxRate = pctTwoDecimals(wv.brackets.single.at(-1)!.ratePct)
  return `§11-21-4j(a) ${minRate}–${maxRate} at ${breakpoints}`
}

function federalBracketClauses(): FigureClause[] {
  const brackets = pack.federalTax.brackets.single
  const firstRate = brackets[0]!.ratePct
  const lastRate = brackets.at(-1)!.ratePct
  return [
    {
      label: 'bracket count',
      clause: `${countWord(brackets.length)} brackets`,
    },
    {
      label: 'bracket rate range',
      clause: `${firstRate}%–${lastRate}%`,
    },
    {
      label: 'standard deduction single/joint',
      clause: `Standard deduction ${usd(pack.federalTax.standardDeduction.single)} single / ${usd(pack.federalTax.standardDeduction.marriedFilingJointly)} joint`,
    },
    {
      label: 'age-65 addition single/joint',
      clause: `+${usd(pack.federalTax.age65Addition.single)} / ${usd(pack.federalTax.age65Addition.marriedFilingJointly)} each at 65+`,
    },
  ]
}

function seniorDeductionClauses(): FigureClause[] {
  const seniorDeduction = requiredSeniorDeduction()
  return [
    {
      label: 'amount per person',
      clause: `${usd(seniorDeduction.amountPerPerson)} per person 65+`,
    },
    {
      label: 'MAGI phase-out single/joint',
      clause: `phasing out above ${usd(seniorDeduction.magiPhaseOutStart.single)} / ${usd(seniorDeduction.magiPhaseOutStart.marriedFilingJointly)} MAGI`,
    },
    {
      label: 'last applicable year',
      clause: `expires after ${seniorDeduction.lastApplicableYear}`,
    },
  ]
}

function capitalGainsNiitClauses(): FigureClause[] {
  return [
    {
      label: '15% LTCG threshold single/joint',
      clause: `15% above ${usd(pack.capitalGains.rate15StartsAbove.single)} / ${usd(pack.capitalGains.rate15StartsAbove.marriedFilingJointly)}`,
    },
    {
      label: '20% LTCG threshold single/joint',
      clause: `20% above ${usd(pack.capitalGains.rate20StartsAbove.single)} / ${usd(pack.capitalGains.rate20StartsAbove.marriedFilingJointly)}`,
    },
    {
      label: 'NIIT threshold single/joint',
      clause: `${pctOneDecimal(pack.niit.ratePct)} NIIT above ${usd(pack.niit.magiThreshold.single)} / ${usd(pack.niit.magiThreshold.marriedFilingJointly)} MAGI`,
    },
  ]
}

function section121ExclusionClauses(): FigureClause[] {
  return [
    {
      label: 'exclusion cap single/joint',
      clause: `${usd(pack.federalTax.section121Exclusion.single)} single / ${usd(pack.federalTax.section121Exclusion.marriedFilingJointly)} joint of primary-residence gain excluded`,
    },
  ]
}

function ssBenefitTaxationClauses(): FigureClause[] {
  return [
    {
      label: 'tier-50 provisional-income threshold single/joint',
      clause: `up to 50% taxable above ${usd(pack.ssBenefitTaxation.tier50Start.single)} / ${usd(pack.ssBenefitTaxation.tier50Start.marriedFilingJointly)}`,
    },
    {
      label: 'tier-85 provisional-income threshold single/joint',
      clause: `up to 85% above ${usd(pack.ssBenefitTaxation.tier85Start.single)} / ${usd(pack.ssBenefitTaxation.tier85Start.marriedFilingJointly)}`,
    },
  ]
}

function contributionLimitsClauses(): FigureClause[] {
  return [
    {
      label: '401(k) base and catch-up amounts',
      clause: `401(k) ${usd(pack.contributionLimits.employee401k)} (+${usd(pack.contributionLimits.catchUp50)} at 50+, ${usd(pack.contributionLimits.superCatchUp60to63)} ages 60–63)`,
    },
    {
      label: 'IRA base and catch-up amounts',
      clause: `IRA ${usd(pack.contributionLimits.ira)} (+${usd(pack.contributionLimits.iraCatchUp50)})`,
    },
    {
      label: 'HSA self/family and catch-up amounts',
      clause: `HSA ${usd(pack.contributionLimits.hsaSelfOnly)} self / ${usd(pack.contributionLimits.hsaFamily)} family (+${usd(pack.contributionLimits.hsaCatchUp55)} at 55+)`,
    },
  ]
}

function rmdQcdClauses(): FigureClause[] {
  const rmdStartMin = rmdStartAgeForBirthYear(1959)
  const rmdStartMax = rmdStartAgeForBirthYear(1960)
  return [
    {
      label: 'SECURE 2.0 RMD start-age span',
      clause: `RMDs begin at age ${rmdStartMin}–${rmdStartMax}`,
    },
    {
      label: 'QCD annual exclusion limit',
      clause: `QCD exclusion limit ${usd(pack.rmd.qcdAnnualLimit)}`,
    },
  ]
}

function annuityPurchaseClauses(): FigureClause[] {
  return [
    {
      label: 'QLAC premium cap',
      clause: `QLAC premium cap ${usd(pack.annuities.qlacPremiumCap)} excluded from RMD balances`,
    },
  ]
}

function hecmPlfClauses(): FigureClause[] {
  const plfAt62 = pack.hecm.principalLimitFactorPctByAge[62]
  const plfAt90 = pack.hecm.principalLimitFactorPctByAge[90]
  if (plfAt62 === undefined || plfAt90 === undefined) {
    throw new Error(`${START_YEAR} HECM pack must include PLF factors at ages 62 and 90`)
  }
  return [
    {
      label: 'expected-rate PLF endpoints at ages 62 and 90',
      clause: `Principal-limit factors at a ${pctThreeDecimals(pack.hecm.plfExpectedRatePct)} expected rate: ${pctOneDecimal(plfAt62)} of home value at 62 rising to ${pctOneDecimal(plfAt90)} at 90`,
    },
    {
      label: 'line/loan growth default',
      clause: `line/loan growth default ${pctOneDecimal(pack.hecm.defaultGrowthRatePct)}/yr`,
    },
    {
      label: 'annual MIP increment cited in growth prose',
      clause: `(rate + ${pctOneDecimal(HECM_ANNUAL_MIP_RATE_PCT)} MIP)`,
    },
  ]
}

function medicareIrmaaClauses(): FigureClause[] {
  const firstIrmaaTier = requiredIrmaaTier('first')
  const lastIrmaaTier = requiredIrmaaTier('last')
  const firstPartDSurchargeMonthly = requiredPartDSurchargeMonthly(firstIrmaaTier, 'first')
  const lastPartDSurchargeMonthly = requiredPartDSurchargeMonthly(lastIrmaaTier, 'last')
  return [
    {
      label: 'Part B standard premium',
      clause: `Standard Part B $${pack.medicare.partBStandardMonthly.toFixed(2)}/mo`,
    },
    {
      label: 'IRMAA tier count',
      clause: `${countWordLower(pack.medicare.irmaaTiers.length)} IRMAA tiers`,
    },
    {
      label: 'first IRMAA MAGI threshold single/joint',
      clause: `starting at ${usd(firstIrmaaTier.magiOver.single)} / ${usd(firstIrmaaTier.magiOver.marriedFilingJointly)} MAGI`,
    },
    {
      label: 'Part D surcharge range',
      clause: `Part D IRMAA surcharges $${firstPartDSurchargeMonthly.toFixed(2)}-$${lastPartDSurchargeMonthly.toFixed(2)}/mo`,
    },
  ]
}

function socialSecurityClauses(): FigureClause[] {
  return [
    {
      label: 'COLA percentage',
      clause: `${pack.socialSecurity.colaPct}% COLA`,
    },
    {
      label: 'taxable wage base',
      clause: `taxable wage base ${usd(pack.socialSecurity.taxableWageBase)}`,
    },
    {
      label: 'earnings-test exempt amounts',
      clause: `earnings-test exempt amounts ${usd(pack.socialSecurity.earningsTestBelowFraAnnual)} (pre-FRA) / ${usd(pack.socialSecurity.earningsTestFraYearAnnual)} (FRA year)`,
    },
    {
      label: 'SSDI SGA monthly amount',
      clause: `SSDI SGA ${usd(pack.socialSecurity.sgaMonthlyNonBlind)}/mo (non-blind)`,
    },
    {
      label: 'OASDI employee payroll rate',
      clause: `OASDI payroll tax ${pctOneDecimal(pack.socialSecurity.oasdiEmployeeRatePct)} (employee)`,
    },
  ]
}

function federalPovertyLineClauses(): FigureClause[] {
  return [
    {
      label: 'contiguous FPL first/additional person amounts',
      clause: `(${usd(pack.federalPovertyLine.contiguous.firstPerson)} first person, +${usd(pack.federalPovertyLine.contiguous.perAdditionalPerson)} each additional)`,
    },
  ]
}

function acaPtcClauses(): FigureClause[] {
  const firstBreakpoint = pack.aca.applicablePctBreakpoints[0]
  if (!firstBreakpoint) {
    throw new Error(`${START_YEAR} ACA pack must include applicable-percentage breakpoints`)
  }
  const breakpointAt300 = pack.aca.applicablePctBreakpoints.find((row) => row.fplPct === 300)
  if (!breakpointAt300) {
    throw new Error(`${START_YEAR} ACA pack must include the 300% FPL breakpoint`)
  }
  return [
    {
      label: 'applicable percentage below first breakpoint',
      clause: `${pack.aca.applicablePctBelowFirstBreakpoint.toFixed(2)}% under ${firstBreakpoint.fplPct}% FPL`,
    },
    {
      label: 'applicable percentage at 300–400% FPL band',
      clause: `${breakpointAt300.applicablePct}% at ${breakpointAt300.fplPct}–${pack.aca.maxFplPctForCredit}%`,
    },
    {
      label: '400% FPL subsidy cliff',
      clause: `${pack.aca.maxFplPctForCredit}% FPL subsidy cliff restored`,
    },
  ]
}

function realYieldCurveClauses(): FigureClause[] {
  return [
    {
      label: 'curve as-of date',
      clause: `Par real yields as of ${REAL_YIELD_CURVE_2026.asOfIso}:`,
    },
    ...REAL_YIELD_CURVE_2026.points.map((point) => ({
      label: `${point.maturityYears}y real yield`,
      clause: `${point.realYieldPct.toFixed(2)}% (${point.maturityYears}y)`,
    })),
  ]
}

function stateIncomeTaxClauses(): FigureClause[] {
  const ca = stateParamsFor('CA', START_YEAR)!
  const mn = stateParamsFor('MN', START_YEAR)!
  const de = stateParamsFor('DE', START_YEAR)!
  const hi = stateParamsFor('HI', START_YEAR)!
  const la = stateParamsFor('LA', START_YEAR)!
  const or = stateParamsFor('OR', START_YEAR)!
  const ri = stateParamsFor('RI', START_YEAR)!
  const ut = stateParamsFor('UT', START_YEAR)!
  const me = stateParamsFor('ME', START_YEAR)!
  const wv = stateParamsFor('WV', START_YEAR)!
  const mi = stateParamsFor('MI', START_YEAR)!

  const mnRates = mn.brackets.single.map((bracket) => pctTwoDecimals(bracket.ratePct)).join('/')
  const riRates = ri.brackets.single.map((bracket) => pctTwoDecimals(bracket.ratePct)).join('/')
  const miCap = mi.retirementPrivate.capPerPerson
  if (miCap === undefined) {
    throw new Error('MI pack must include retirement cap per person')
  }
  const meCap = me.retirementPrivate.capPerPerson
  if (meCap === undefined) {
    throw new Error('ME pack must include retirement cap per person')
  }
  const deAge65 = de.standardDeductionAge65Addition
  if (!deAge65) {
    throw new Error('DE pack must include age-65 standard deduction addition')
  }
  const mePhaseout = me.standardDeductionPhaseout
  if (!mePhaseout) {
    throw new Error('ME pack must include standard deduction phase-out')
  }

  return [
    {
      label: 'California standard deduction single/joint',
      clause: `California 2026: Form 540-ES estimated-tax worksheet ${usd(ca.standardDeduction.single)}/${usd(ca.standardDeduction.marriedFilingJointly)} standard deduction`,
    },
    {
      label: 'Minnesota standard deduction single/joint',
      clause: `Minnesota TY2026: ${usd(mn.standardDeduction.single)}/${usd(mn.standardDeduction.marriedFilingJointly)} standard deduction`,
    },
    {
      label: 'Minnesota marginal rates',
      clause: `DOR whole-dollar bands at ${mnRates} represented by continuous breakpoints`,
    },
    {
      label: 'Delaware basic standard deduction single/joint',
      clause: `Delaware 2026: ${usd(de.standardDeduction.single)}/${usd(de.standardDeduction.marriedFilingJointly)} basic standard deduction`,
    },
    {
      label: 'Delaware age-65 standard deduction addition',
      clause: `plus ${usd(deAge65.single)} per age-65 person`,
    },
    {
      label: 'Delaware selected bracket range',
      clause: deSelectedBracketRangeClause(de),
    },
    {
      label: 'Hawaii standard deduction single/joint',
      clause: `Hawaii 2026: ${usd(hi.standardDeduction.single)}/${usd(hi.standardDeduction.marriedFilingJointly)} standard deduction`,
    },
    {
      label: 'Louisiana standard deduction single/joint',
      clause: `Louisiana 2026: La. R.S. 47:294 CPI-indexed standard deduction ${usd(la.standardDeduction.single)}/${usd(la.standardDeduction.marriedFilingJointly)}`,
    },
    {
      label: 'Oregon standard deduction single/joint',
      clause: `Oregon 2026: LRO Report #1-26 ${usd(or.standardDeduction.single)}/${usd(or.standardDeduction.marriedFilingJointly)} standard deduction`,
    },
    {
      label: 'Oregon single breakpoints',
      clause: `indexed breakpoints single ${usd(or.brackets.single[1]!.lowerBound)}/${usd(or.brackets.single[2]!.lowerBound)}/${usd(or.brackets.single[3]!.lowerBound)}`,
    },
    {
      label: 'Oregon joint breakpoints',
      clause: `joint ${usd(or.brackets.marriedFilingJointly[1]!.lowerBound)}/${usd(or.brackets.marriedFilingJointly[2]!.lowerBound)}/${usd(or.brackets.marriedFilingJointly[3]!.lowerBound)}`,
    },
    {
      label: 'Rhode Island standard deduction single/joint',
      clause: `Rhode Island 2026: ADV 2025-22 ${usd(ri.standardDeduction.single)}/${usd(ri.standardDeduction.marriedFilingJointly)} standard deduction`,
    },
    {
      label: 'Rhode Island bracket thresholds and rates',
      clause: `uniform schedule at ${usd(ri.brackets.single[1]!.lowerBound)}/${usd(ri.brackets.single[2]!.lowerBound)} (${riRates})`,
    },
    {
      label: 'Utah flat rate',
      clause: `Utah 2026: ${pctTwoDecimals(ut.brackets.single[0]!.ratePct)} flat rate`,
    },
    {
      label: 'Maine basic standard deduction single/joint',
      clause: `Maine 2026: basic ${usd(me.standardDeduction.single)}/${usd(me.standardDeduction.marriedFilingJointly)}`,
    },
    {
      label: 'Maine standard deduction phase-out',
      clause: `phase-out starts ${usd(mePhaseout.startsAt.single)}/${usd(mePhaseout.startsAt.marriedFilingJointly)} over ${usd(mePhaseout.range.single)}/${usd(mePhaseout.range.marriedFilingJointly)} ranges`,
    },
    {
      label: 'Maine pension-income maximum per person',
      clause: `${usd(meCap)} pension-income maximum per person`,
    },
    {
      label: 'West Virginia rate breakpoints',
      clause: `West Virginia 2026: ${wvRateBreakpointClause(wv)}`,
    },
    {
      label: 'Michigan retirement ceiling single/MFS and MFJ',
      clause: `Michigan 2026: ordinary qualifying combined public/private retirement ceiling ${usd(miCap)} single/MFS / ${usd(miCap * 2)} MFJ`,
    },
  ]
}

/** Pack-backed labelled clauses each provenance id must display. */
const PACK_FIGURE_CLAUSES: Record<string, () => FigureClause[]> = {
  'federal-brackets': federalBracketClauses,
  'senior-deduction': seniorDeductionClauses,
  'capital-gains-niit': capitalGainsNiitClauses,
  'section-121-exclusion': section121ExclusionClauses,
  'ss-benefit-taxation': ssBenefitTaxationClauses,
  'contribution-limits': contributionLimitsClauses,
  'rmd-qcd': rmdQcdClauses,
  'annuity-purchase': annuityPurchaseClauses,
  'hecm-plf': hecmPlfClauses,
  'medicare-irmaa': medicareIrmaaClauses,
  'social-security': socialSecurityClauses,
  'federal-poverty-line': federalPovertyLineClauses,
  'aca-ptc': acaPtcClauses,
  'real-yield-curve': realYieldCurveClauses,
  'state-income-tax': stateIncomeTaxClauses,
}

/**
 * Numeric claims in provenance figures that are not single pack scalars but are
 * still inventoried with precise ownership (engineering consistency, not legal
 * oracle).
 */
const NON_PACK_NUMERIC_CLAIMS: NonPackNumericClaim[] = [
  {
    id: 'ss-benefit-taxation',
    claim: '50% and 85% benefit-tax inclusion rates',
    ownership:
      'IRC §86 fixed statutory inclusion tiers; thresholds are pack-backed in ssBenefitTaxationClauses.',
  },
  {
    id: 'contribution-limits',
    claim: 'catch-up eligibility ages 50+, 60–63, and 55+',
    ownership:
      'IRC §414(v), §408(d), and §223 catch-up age rules cited in IRS news-release prose; dollar amounts are pack-backed.',
  },
  {
    id: 'hecm-plf',
    claim: '0.5% annual MIP increment',
    ownership:
      'HUD HECM annual mortgage-insurance premium increment documented in year2026 hecm commentary; asserted via HECM_ANNUAL_MIP_RATE_PCT in hecmPlfClauses.',
  },
  {
    id: 'rmd-qcd',
    claim: 'IRS Uniform Lifetime Table (Pub 590-B, 2022+)',
    ownership:
      'pack.rmd.uniformLifetimeTable enforces divisors; start ages are bound via rmdStartAgeForBirthYear in rmdQcdClauses.',
  },
  {
    id: 'annuity-purchase',
    claim: 'IRS Pub 939 Table V expected-return multiples',
    ownership:
      'pack.annuities.expectedReturnMultiples; provenance cites the table qualitatively while QLAC cap is pack-backed.',
  },
]

/**
 * Provenance ids whose figures include prose, historic dates, or modeling notes
 * without a single pack scalar — not asserted here.
 */
const UNMAPPED_FIGURE_HOLDS: Array<{ id: string; rationale: string }> = [
  {
    id: 'section-121-exclusion',
    rationale: '"May 6, 1997" and "statutory since 1997, never indexed" are historic statutory prose without pack representation.',
  },
  {
    id: 'hecm-plf',
    rationale:
      'Intermediate ages between 62 and 90 and the "planning default; a lender quote always wins" disclaimer are prose without per-age pack pins in the figures string.',
  },
  {
    id: 'federal-poverty-line',
    rationale: '"2025 HHS guideline … applied to the 2026 ACA coverage year" is coverage-year prose; only the contiguous-dollar amounts are pack-backed.',
  },
  {
    id: 'aca-ptc',
    rationale:
      'Rev. Proc. citation, intermediate breakpoint ladder between 133% and 300%, and "enhanced credits expired 12/31/2025" are statutory/procedural prose without one-line pack scalars.',
  },
  {
    id: 'state-income-tax',
    rationale:
      'Modeling disclaimers, statute citations, FTB/LRO/DOR oracle notes, calendar-year expiry prose, and unmodeled-input lists have no pack scalar; only the cited TY2026 display numerics are pack-backed above.',
  },
]

const PACK_MAPPED_IDS = Object.keys(PACK_FIGURE_CLAUSES)

describe('parameter provenance', () => {
  it('has entries', () => {
    expect(PARAMETER_PROVENANCE.length).toBeGreaterThan(0)
  })

  it('every entry is complete with an https source', () => {
    for (const s of PARAMETER_PROVENANCE) {
      expect(s.id, 'id').toBeTruthy()
      expect(s.label, `${s.id} label`).toBeTruthy()
      expect(s.figures, `${s.id} figures`).toBeTruthy()
      expect(s.publisher, `${s.id} publisher`).toBeTruthy()
      expect(s.url, `${s.id} url`).toMatch(/^https:\/\//)
    }
  })

  it('has unique ids', () => {
    const ids = PARAMETER_PROVENANCE.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers the major assumption groups', () => {
    const ids = new Set(PARAMETER_PROVENANCE.map((s) => s.id))
    for (const expected of [
      'federal-brackets',
      'contribution-limits',
      'rmd-qcd',
      'medicare-irmaa',
      'social-security',
      'state-income-tax',
    ]) {
      expect(ids.has(expected), `missing ${expected}`).toBe(true)
    }
  })

  it('maps every provenance id to pack-backed figure clauses', () => {
    expect(PACK_MAPPED_IDS.sort()).toEqual(PARAMETER_PROVENANCE.map((source) => source.id).sort())
  })

  it('figures strings track the current 2026 parameter pack via labelled clauses', () => {
    for (const [id, clauseBuilder] of Object.entries(PACK_FIGURE_CLAUSES)) {
      const entry = byId(id)
      assertFiguresClauses(entry.figures, clauseBuilder(), id)
    }
  })

  it('figures clause matcher rejects stale amounts and mis-associated labels', () => {
    const federalClauses = federalBracketClauses()
    const federalFigures = byId('federal-brackets').figures
    assertFiguresClauses(federalFigures, federalClauses, 'federal-brackets')

    const staleFederal = federalFigures.replace(
      usd(pack.federalTax.standardDeduction.single),
      usd(pack.federalTax.standardDeduction.single + 1),
    )
    expect(figuresMatchClauses(staleFederal, federalClauses)).toBe(false)

    const swappedFederal = federalFigures.replace(
      `Standard deduction ${usd(pack.federalTax.standardDeduction.single)} single / ${usd(pack.federalTax.standardDeduction.marriedFilingJointly)} joint`,
      `Standard deduction ${usd(pack.federalTax.standardDeduction.marriedFilingJointly)} single / ${usd(pack.federalTax.standardDeduction.single)} joint`,
    )
    expect(figuresMatchClauses(swappedFederal, federalClauses)).toBe(false)

    const capitalClauses = capitalGainsNiitClauses()
    const capitalFigures = byId('capital-gains-niit').figures
    const swappedCapital = capitalFigures.replace(
      `15% above ${usd(pack.capitalGains.rate15StartsAbove.single)} / ${usd(pack.capitalGains.rate15StartsAbove.marriedFilingJointly)}`,
      `15% above ${usd(pack.capitalGains.rate15StartsAbove.marriedFilingJointly)} / ${usd(pack.capitalGains.rate15StartsAbove.single)}`,
    )
    expect(figuresMatchClauses(swappedCapital, capitalClauses)).toBe(false)

    const yieldClauses = realYieldCurveClauses()
    const yieldFigures = byId('real-yield-curve').figures
    const fiveYear = REAL_YIELD_CURVE_2026.points[0]!
    const sevenYear = REAL_YIELD_CURVE_2026.points[1]!
    const swappedYield = yieldFigures.replace(
      `${fiveYear.realYieldPct.toFixed(2)}% (${fiveYear.maturityYears}y)`,
      `${sevenYear.realYieldPct.toFixed(2)}% (${fiveYear.maturityYears}y)`,
    )
    expect(figuresMatchClauses(swappedYield, yieldClauses)).toBe(false)

    const prefixDigitYield = yieldFigures.replace(
      `${fiveYear.realYieldPct.toFixed(2)}% (${fiveYear.maturityYears}y)`,
      `1${fiveYear.realYieldPct.toFixed(2)}% (${fiveYear.maturityYears}y)`,
    )
    expect(figuresMatchClauses(prefixDigitYield, yieldClauses)).toBe(false)

    const firstRate = pack.federalTax.brackets.single[0]!.ratePct
    const lastRate = pack.federalTax.brackets.single.at(-1)!.ratePct
    const prefixDigitFederalRate = federalFigures.replace(
      `${firstRate}%–${lastRate}%`,
      `1${firstRate}%–${lastRate}%`,
    )
    expect(figuresMatchClauses(prefixDigitFederalRate, federalClauses)).toBe(false)

    const rmdClauses = rmdQcdClauses()
    const rmdFigures = byId('rmd-qcd').figures
    const suffixDigitQcd = rmdFigures.replace(
      usd(pack.rmd.qcdAnnualLimit),
      `${usd(pack.rmd.qcdAnnualLimit)}0`,
    )
    expect(figuresMatchClauses(suffixDigitQcd, rmdClauses)).toBe(false)

    const decimalExtensionQcd = rmdFigures.replace(
      usd(pack.rmd.qcdAnnualLimit),
      `${usd(pack.rmd.qcdAnnualLimit)}.5`,
    )
    expect(figuresMatchClauses(decimalExtensionQcd, rmdClauses)).toBe(false)

    const commaExtensionQcd = rmdFigures.replace(
      usd(pack.rmd.qcdAnnualLimit),
      `${usd(pack.rmd.qcdAnnualLimit)},000`,
    )
    expect(figuresMatchClauses(commaExtensionQcd, rmdClauses)).toBe(false)
  })

  it('documents prose-only figure clauses that have no single pack scalar', () => {
    for (const hold of UNMAPPED_FIGURE_HOLDS) {
      expect(PARAMETER_PROVENANCE.some((source) => source.id === hold.id), hold.id).toBe(true)
      expect(hold.rationale.length).toBeGreaterThan(0)
    }
  })

  it('inventories non-pack numeric claims with explicit ownership', () => {
    for (const claim of NON_PACK_NUMERIC_CLAIMS) {
      expect(PARAMETER_PROVENANCE.some((source) => source.id === claim.id), claim.id).toBe(true)
      expect(claim.ownership.length).toBeGreaterThan(0)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { REAL_YIELD_CURVE_2026 } from './data/realYieldCurve2026.js'
import { acaParametersForCoverageYear, hsaLimitsForYear, packForYear, rmdStartAgeForBirthYear } from './index.js'
import { PARAMETER_PROVENANCE } from './provenance.js'
import { CPI_U_ANNUAL_AVERAGE, CPI_U_LATEST_YEAR } from '../socialSecurity/cpiU.js'
import { KNOWN_LIFE_TABLE_EDITIONS, LAST_TABLE_AGE, LIFE_TABLE_EDITION_BEFORE_THE_FIELD, SSA_PERIOD_LIFE_TABLE } from '../longevity/ssaPeriodLifeTable.js'
import { OASDI_TAX_RATE_BY_YEAR } from '../socialSecurity/oasdiTaxRates.js'
import { FIRST_QUARTER_OF_COVERAGE_AMOUNT_YEAR, QUARTER_OF_COVERAGE_AMOUNT_BY_YEAR } from '../socialSecurity/ssaWageData.js'
import { stateEnactedYearFor, stateParamsFor } from './state/index.js'
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
  clauses: readonly FigureClause[]
}>

type NonPackDisplayContract = Readonly<{
  id: string
  clauses: readonly FigureClause[]
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
  if (!figures || clauses.length === 0) {
    return false
  }
  return clauses.every(
    ({ clause }) => clause.length > 0 && figuresContainsClause(figures, clause),
  )
}

function assertFiguresClauses(
  figures: string,
  clauses: readonly FigureClause[],
  id: string,
): void {
  expect(figures.length, `${id} figures`).toBeGreaterThan(0)
  expect(clauses.length, `${id} clauses`).toBeGreaterThan(0)
  for (const { clause, label } of clauses) {
    expect(clause.length, `${id}: ${label} clause text`).toBeGreaterThan(0)
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

function hsa2027Clauses(): FigureClause[] {
  const lookup = hsaLimitsForYear(2027)
  expect(lookup.isStandIn, 'the 2027 HSA limits are published').toBe(false)
  return [
    {
      label: '2027 self-only and family limits',
      clause: `${usd(lookup.params.selfOnly)} self-only / ${usd(lookup.params.family)} family for 2027 (${lookup.params.source}`,
    },
    {
      label: 'statutory catch-up',
      clause: `The ${usd(pack.contributionLimits.hsaCatchUp55)} catch-up at 55+ is set by statute`,
    },
  ]
}

/** The rate above the lowest band of a state's enacted schedule for a year, with the year it comes from asserted. */
function enactedTopRate(code: string, year: number, enactedYear: number): number {
  expect(stateEnactedYearFor(code, year), `${code} ${year} enacted year`).toBe(enactedYear)
  return stateParamsFor(code, year)!.brackets.single.at(-1)!.ratePct
}

function stateEnactedInClauses(): FigureClause[] {
  return [
    {
      label: 'Indiana 2027 through 2029 rate',
      clause: `${enactedTopRate('IN', 2027, 2027)}% flat for 2027 through 2029`,
    },
  ]
}

function stateEnactedMsClauses(): FigureClause[] {
  const band = stateParamsFor('MS', 2027)!.brackets.single[1]!.lowerBound
  return [
    { label: 'Mississippi zero band', clause: `No tax on the first ${usd(band)}` },
    {
      label: 'Mississippi 2027 to 2030 steps',
      clause: `above it ${enactedTopRate('MS', 2027, 2027)}% for 2027, ${enactedTopRate('MS', 2028, 2028)}% for 2028, ${enactedTopRate('MS', 2029, 2029)}% for 2029 and ${enactedTopRate('MS', 2030, 2030)}% from 2030`,
    },
  ]
}

function stateEnactedMtClauses(): FigureClause[] {
  const mt = stateParamsFor('MT', 2027)!
  expect(stateEnactedYearFor('MT', 2027)).toBe(2027)
  return [
    {
      label: 'Montana ordinary breaks',
      clause: `${mt.brackets.single[0]!.ratePct}% up to ${usd(mt.brackets.single[1]!.lowerBound)} single or married filing separately, ${usd(mt.bracketsHeadOfHousehold![1]!.lowerBound)} head of household and ${usd(mt.brackets.marriedFilingJointly[1]!.lowerBound)} joint, then ${mt.brackets.single[1]!.ratePct}%`,
    },
    {
      label: 'Montana long-term gain rates',
      clause: `long-term capital gains ${mt.montanaLtcg!.lowerRate * 100}% / ${Math.round(mt.montanaLtcg!.upperRate * 1000) / 10}% at the same breaks`,
    },
  ]
}

function stateEnactedNeClauses(): FigureClause[] {
  const rates = stateParamsFor('NE', 2027)!.brackets.single.map((band) => band.ratePct)
  expect(stateEnactedYearFor('NE', 2027)).toBe(2027)
  return [
    { label: 'Nebraska 2027 rates', clause: `${rates[0]}%, ${rates[1]}% and ${rates[2]}% (rates three and four) from 2027` },
  ]
}

function stateEnactedNcClauses(): FigureClause[] {
  return [
    {
      label: 'North Carolina steps',
      clause: `${enactedTopRate('NC', 2027, 2027)}% for 2027 through 2029, ${enactedTopRate('NC', 2030, 2030)}% for 2030 through 2032 and ${enactedTopRate('NC', 2033, 2033)}% after 2032`,
    },
  ]
}

/** A rate or amount a state's enacted figures carry for a year, with the enacted year it comes from asserted. */
function enactedParams(code: string, year: number, enactedYear: number) {
  expect(stateEnactedYearFor(code, year), `${code} ${year} enacted year`).toBe(enactedYear)
  return stateParamsFor(code, year)!
}

function stateEnactedHiClauses(): FigureClause[] {
  const hi2027 = enactedParams('HI', 2027, 2027)
  const deductions = [2028, 2030, 2031].map((year) => enactedParams('HI', year, year).standardDeduction)
  return [
    {
      label: 'Hawaii 2027 second and third rates',
      clause: `${hi2027.brackets.single[1]!.ratePct}% and ${hi2027.brackets.single[2]!.ratePct}% in the second and third bands`,
    },
    {
      label: 'Hawaii 13% band thresholds',
      clause: `${hi2027.brackets.single.at(-1)!.ratePct}% above ${usd(hi2027.brackets.single.at(-1)!.lowerBound)} single, ${usd(hi2027.brackets.marriedFilingJointly.at(-1)!.lowerBound)} joint and ${usd(hi2027.bracketsHeadOfHousehold!.at(-1)!.lowerBound)} head of household`,
    },
    {
      label: 'Hawaii standard deduction steps',
      clause: `Standard deduction ${usd(deductions[0]!.single)} / ${usd(deductions[0]!.marriedFilingJointly)} from 2028, ${usd(deductions[1]!.single)} / ${usd(deductions[1]!.marriedFilingJointly)} from 2030 and ${usd(deductions[2]!.single)} / ${usd(deductions[2]!.marriedFilingJointly)} from 2031`,
    },
  ]
}

function stateEnactedNyClauses(): FigureClause[] {
  const ny2027 = enactedParams('NY', 2027, 2027)
  const ny2033 = enactedParams('NY', 2033, 2033)
  const lowest = ny2027.brackets.single.slice(0, 5).map((band) => `${band.ratePct}%`)
  return [
    {
      label: 'New York five lowest rates 2027-2032',
      clause: `The five lowest rates ${lowest.slice(0, 4).join(', ')} and ${lowest[4]} for 2027 through 2032`,
    },
    {
      label: 'New York top rate from 2033',
      clause: `${ny2033.brackets.single.at(-1)!.ratePct}% above ${usd(ny2033.brackets.marriedFilingJointly.at(-1)!.lowerBound)} joint and ${usd(ny2033.brackets.single.at(-1)!.lowerBound)} single from 2033`,
    },
  ]
}

function stateEnactedRiClauses(): FigureClause[] {
  const surtax = (year: number) => {
    const bands = enactedParams('RI', year, year).brackets.single
    return Math.round((bands.at(-1)!.ratePct - bands.at(-2)!.ratePct) * 100) / 100
  }
  const threshold = enactedParams('RI', 2027, 2027).brackets.single.at(-1)!.lowerBound
  return [
    {
      label: 'Rhode Island surtax steps and threshold',
      clause: `A surtax of ${surtax(2027)}% for 2027, ${surtax(2028)}% for 2028 and ${surtax(2029)}% from 2029 on Rhode Island taxable income over ${usd(threshold)}`,
    },
  ]
}

function stateEnactedVaClauses(): FigureClause[] {
  const deductions = [2027, 2028, 2030].map((year) => enactedParams('VA', year, year).standardDeduction)
  const exemptions = stateParamsFor('VA', START_YEAR)!.virginiaPersonalExemptions!
  return [
    {
      label: 'Virginia standard deduction steps',
      clause: `Standard deduction ${usd(deductions[0]!.single)} / ${usd(deductions[0]!.marriedFilingJointly)} for 2027, ${usd(deductions[1]!.single)} / ${usd(deductions[1]!.marriedFilingJointly)} for 2028 and 2029, and ${usd(deductions[2]!.single)} / ${usd(deductions[2]!.marriedFilingJointly)} from 2030`,
    },
    {
      label: 'Virginia personal exemptions',
      clause: `personal exemptions of ${usd(exemptions.perExemption)}, plus ${usd(exemptions.perAgedTaxpayer)} at 65`,
    },
  ]
}

function stateEnactedGaClauses(): FigureClause[] {
  const ga = enactedParams('GA', 2027, 2027)
  return [
    {
      label: 'Georgia 2027 retirement exclusion',
      clause: `Retirement income exclusion ${usd(ga.retirementPrivate.capPerPerson!)} at ${ga.retirementPrivate.minAge} or older from 2027`,
    },
  ]
}

function stateEnactedDeClauses(): FigureClause[] {
  const caps = [2027, 2028, 2029].map((year) => enactedParams('DE', year, year).delawareMilitaryPension60Plus!.militaryCap)
  return [
    {
      label: 'Delaware military pension steps',
      clause: `Military pension subtraction ${usd(caps[0]!)} for 2027, ${usd(caps[1]!)} for 2028 and ${usd(caps[2]!)} from 2029`,
    },
  ]
}

function stateEnactedIlClauses(): FigureClause[] {
  const il = enactedParams('IL', 2029, 2029)
  return [
    { label: 'Illinois 2029 basic exemption', clause: `Basic exemption ${usd(il.illinoisPersonalExemption!.basicAllowance)} from 2029` },
  ]
}

function stateEnactedMeClauses(): FigureClause[] {
  const me = enactedParams('ME', 2027, 2027)
  expect(me.standardDeductionConformity).toBe('federal')
  return [
    { label: 'Maine federal standard deduction from 2027', clause: 'Standard deduction equal to the federal standard deduction from 2027' },
  ]
}

function stateEnactedMdClauses(): FigureClause[] {
  const amount = (year: number) => stateParamsFor('MD', year)!.marylandPublicSafetySubtraction!.amount
  return [
    {
      label: 'Maryland public-safety subtraction steps',
      clause: `${usd(amount(2026))} for 2026, ${usd(amount(2027))} for 2027, ${usd(amount(2028))} for 2028, ${usd(amount(2029))} for 2029 and ${usd(amount(2030))} from 2030`,
    },
  ]
}

function stateEnactedOrClauses(): FigureClause[] {
  expect(stateParamsFor('OR', 2031)!.oregonRetirementIncomeCredit).toBeDefined()
  expect(enactedParams('OR', 2032, 2032).oregonRetirementIncomeCredit).toBeUndefined()
  return [
    { label: 'Oregon credit end year', clause: 'cannot be claimed for tax years from 2032' },
  ]
}

function stateEnactedCaClauses(): FigureClause[] {
  const before = stateParamsFor('CA', 2030)!.brackets.single.slice(-3).map((band) => `${band.ratePct}%`)
  expect(enactedParams('CA', 2031, 2031).brackets.single.at(-1)!.ratePct).toBe(9.3)
  const military = stateParamsFor('CA', START_YEAR)!.californiaMilitaryExclusions!
  expect(stateParamsFor('CA', 2030)!.californiaMilitaryExclusions).toBeUndefined()
  return [
    { label: 'California bands that end from 2031', clause: `The ${before[0]}, ${before[1]} and ${before[2]} bands end from 2031` },
    { label: 'California military exclusions', clause: `exclusions of ${usd(military.retirementCap)} each end from 2030` },
  ]
}

function stateEnactedWaClauses(): FigureClause[] {
  const wa = enactedParams('WA', 2028, 2028)
  expect(wa.hasIncomeTax).toBe(true)
  return [
    {
      label: 'Washington rate and deduction',
      clause: `${wa.brackets.single[0]!.ratePct}% of federal AGI less long-term capital gains less a ${usd(wa.standardDeduction.single)} deduction per individual or couple, from 2028`,
    },
  ]
}

function stateEnactedDcClauses(): FigureClause[] {
  const dc = stateParamsFor('DC', START_YEAR)!
  expect(stateParamsFor('DC', 2030)!.standardDeductionConformity).toBe('federal')
  expect(dc.standardDeductionStatutoryIndexing).toMatchObject({ firstIndexedYear: 2027, roundToNearest: 50, rounding: 'down' })
  return [
    {
      label: 'District of Columbia basic standard deduction for 2026',
      clause: `Basic standard deduction ${usd(dc.standardDeduction.single)} single and ${usd(dc.standardDeduction.marriedFilingJointly)} joint for 2026`,
    },
    { label: 'District of Columbia indexing and 2030 return to the federal deduction', clause: 'indexed from 2027 and rounded down to $50, and the federal standard deduction from 2030' },
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
      label: 'Part B IRMAA total range',
      clause: `Part B IRMAA totals $${firstIrmaaTier.partBTotalMonthly.toFixed(2)}-$${lastIrmaaTier.partBTotalMonthly.toFixed(2)}/mo`,
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
  ]
}

// Not tax-year parameters: SSA's rate table, whose current-law row the
// paid-in figure reads, SSA's quarter-of-coverage table and BLS's CPI-U.
function socialSecurityTaxRateClauses(): FigureClause[] {
  return [
    {
      label: 'OASDI employee and self-employed rates',
      clause: `OASDI payroll tax ${pctOneDecimal(OASDI_TAX_RATE_BY_YEAR[2026]!.employee)} (employee) and ${pctOneDecimal(OASDI_TAX_RATE_BY_YEAR[2026]!.selfEmployed!)} (self-employed) in 2026`,
    },
  ]
}

function socialSecurityCreditClauses(): FigureClause[] {
  return [
    { label: 'quarter-of-coverage amount', clause: `One credit per ${usd(QUARTER_OF_COVERAGE_AMOUNT_BY_YEAR[2026]!)} of covered earnings in 2026` },
    { label: 'first year of the table', clause: `each year's amount from ${FIRST_QUARTER_OF_COVERAGE_AMOUNT_YEAR}` },
  ]
}

function cpiUClauses(): FigureClause[] {
  return [
    { label: 'CPI-U years', clause: `CPI-U annual averages 1937–${CPI_U_LATEST_YEAR}` },
    { label: 'latest CPI-U average', clause: `(${CPI_U_ANNUAL_AVERAGE[CPI_U_LATEST_YEAR]} in ${CPI_U_LATEST_YEAR})` },
  ]
}

// Not a tax-year parameter: SSA's period life table, whose edition and range
// the row names from the table's own source record.
function ssaLifeTableClauses(): FigureClause[] {
  const { periodYear, trusteesReportYear, rows } = SSA_PERIOD_LIFE_TABLE.source
  return [
    { label: 'table edition', clause: `the ${periodYear} period table (${trusteesReportYear} Trustees Report)` },
    { label: 'ages carried', clause: `at each age 0–${rows - 1}` },
    { label: 'closed last row', clause: `the last row is closed at ${LAST_TABLE_AGE}` },
  ]
}

// The edition before it, named from the engine's closed set of known editions.
function ssaLifeTable2022Clauses(): FigureClause[] {
  const { periodYear, trusteesReportYear } = LIFE_TABLE_EDITION_BEFORE_THE_FIELD
  return [{ label: 'table edition', clause: `the ${periodYear} period table (${trusteesReportYear} Trustees Report)` }]
}

function federalPovertyLineClauses(): FigureClause[] {
  const block2027 = acaParametersForCoverageYear(2027).params
  return [
    {
      label: 'contiguous FPL first/additional person amounts',
      clause: `(${usd(pack.federalPovertyLine.contiguous.firstPerson)} first person, +${usd(pack.federalPovertyLine.contiguous.perAdditionalPerson)} each additional)`,
    },
    {
      label: '2027 coverage-year contiguous FPL first/additional person amounts',
      clause: `(${usd(block2027.federalPovertyLine.contiguous.firstPerson)} first person, +${usd(block2027.federalPovertyLine.contiguous.perAdditionalPerson)} each additional)`,
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

/** The 2027 coverage year's schedule, read from its own block (Rev. Proc. 2026-26). */
function acaPtc2027Clauses(): FigureClause[] {
  const block2027 = acaParametersForCoverageYear(2027).params
  return [
    {
      label: '2027 applicable percentage below first breakpoint',
      clause: `${block2027.aca.applicablePctBelowFirstBreakpoint.toFixed(2)}% under ${block2027.aca.applicablePctBreakpoints[0]!.fplPct}% FPL`,
    },
    {
      label: '2027 applicable percentage at 300–400% FPL band',
      clause: `${block2027.aca.applicablePctBreakpoints.find((row) => row.fplPct === 300)!.applicablePct}% at 300–${block2027.aca.maxFplPctForCredit}%`,
    },
    {
      label: '2027 400% FPL cliff',
      clause: `same ${block2027.aca.maxFplPctForCredit}% FPL cliff`,
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
  'hsa-2027': hsa2027Clauses,
  'rmd-qcd': rmdQcdClauses,
  'annuity-purchase': annuityPurchaseClauses,
  'hecm-plf': hecmPlfClauses,
  'medicare-irmaa': medicareIrmaaClauses,
  'social-security': socialSecurityClauses,
  'social-security-tax-rates': socialSecurityTaxRateClauses,
  'social-security-credits': socialSecurityCreditClauses,
  'cpi-u': cpiUClauses,
  'ssa-life-table': ssaLifeTableClauses,
  'ssa-life-table-2022': ssaLifeTable2022Clauses,
  'federal-poverty-line': federalPovertyLineClauses,
  'aca-ptc': acaPtcClauses,
  'aca-ptc-2027': acaPtc2027Clauses,
  'real-yield-curve': realYieldCurveClauses,
  'state-income-tax': stateIncomeTaxClauses,
  'state-enacted-in': stateEnactedInClauses,
  'state-enacted-ms': stateEnactedMsClauses,
  'state-enacted-mt': stateEnactedMtClauses,
  'state-enacted-ne': stateEnactedNeClauses,
  'state-enacted-nc': stateEnactedNcClauses,
  'state-enacted-hi': stateEnactedHiClauses,
  'state-enacted-ny': stateEnactedNyClauses,
  'state-enacted-ri': stateEnactedRiClauses,
  'state-enacted-va': stateEnactedVaClauses,
  'state-enacted-ga': stateEnactedGaClauses,
  'state-enacted-de': stateEnactedDeClauses,
  'state-enacted-il': stateEnactedIlClauses,
  'state-enacted-me': stateEnactedMeClauses,
  'state-enacted-md': stateEnactedMdClauses,
  'state-enacted-or': stateEnactedOrClauses,
  'state-enacted-ca': stateEnactedCaClauses,
  'state-enacted-wa': stateEnactedWaClauses,
  'state-enacted-dc': stateEnactedDcClauses,
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
    clauses: [
      { label: '50% inclusion tier', clause: 'up to 50% taxable' },
      { label: '85% inclusion tier', clause: 'up to 85% above' },
    ],
  },
  {
    id: 'contribution-limits',
    claim: 'catch-up eligibility ages 50+, 60–63, and 55+',
    ownership:
      'IRC §414(v) employer-plan catch-up ages, §219(b)(5)(B) IRA catch-up age, and §223(b)(3) HSA catch-up age (contributionAndDeferralLimits and healthSavingsAccounts rule records); dollar amounts are pack-backed in contributionLimitsClauses.',
    clauses: [
      { label: '401(k) age-50 catch-up', clause: 'at 50+' },
      { label: '401(k) ages 60–63 super catch-up', clause: 'ages 60–63' },
      { label: 'HSA age-55 catch-up', clause: 'at 55+' },
    ],
  },
  {
    id: 'hecm-plf',
    claim: '0.5% annual MIP increment',
    ownership:
      'HUD annual MIP increment bound in hecmPlfClauses via HECM_ANNUAL_MIP_RATE_PCT and provenance "(rate + 0.5% MIP)" prose.',
    clauses: [{ label: 'annual MIP increment', clause: '(rate + 0.5% MIP)' }],
  },
  {
    id: 'rmd-qcd',
    claim: 'IRS Uniform Lifetime Table (Pub 590-B, 2022+)',
    ownership:
      'pack.rmd.uniformLifetimeTable enforces divisors; "IRS Uniform Lifetime Table (Pub 590-B, 2022+)" is bound in rmd-qcd figures; start ages via rmdStartAgeForBirthYear in rmdQcdClauses.',
    clauses: [
      {
        label: 'Pub 590-B uniform lifetime table citation',
        clause: 'IRS Uniform Lifetime Table (Pub 590-B, 2022+)',
      },
    ],
  },
  {
    id: 'annuity-purchase',
    claim: 'IRS Pub 939 Table V expected-return multiples',
    ownership:
      'pack.annuities.expectedReturnMultiples; "IRS Pub 939 Table V expected-return multiples" is bound in annuity-purchase figures; QLAC cap is pack-backed in annuityPurchaseClauses.',
    clauses: [
      {
        label: 'Pub 939 Table V citation',
        clause: 'IRS Pub 939 Table V expected-return multiples',
      },
    ],
  },
]

/** Non-pack prose the provenance panel must keep displaying alongside pack-backed numerics. */
const NON_PACK_DISPLAY_CONTRACTS: NonPackDisplayContract[] = [
  {
    id: 'section-121-exclusion',
    clauses: [
      { label: '1997 statutory indexing prose', clause: 'statutory since 1997, never indexed' },
      { label: 'May 6 1997 depreciation cutoff', clause: 'May 6, 1997' },
    ],
  },
  {
    id: 'hecm-plf',
    clauses: [
      {
        label: 'HECM planning-default disclaimer',
        clause: 'planning default; a lender quote always wins',
      },
    ],
  },
  {
    id: 'federal-poverty-line',
    clauses: [
      { label: '2025 HHS guideline coverage-year prose', clause: '2025 HHS guideline' },
      { label: '2026 ACA coverage year application', clause: 'applied to the 2026 ACA coverage year' },
      { label: '2026 HHS guideline coverage-year prose', clause: '2026 HHS guideline' },
      { label: '2027 ACA coverage year application', clause: 'applied to the 2027 ACA coverage year' },
    ],
  },
  {
    id: 'aca-ptc',
    clauses: [
      { label: 'Rev. Proc. citation', clause: 'Rev. Proc. 2025-25' },
      { label: 'enhanced-credit expiry', clause: 'enhanced credits expired 12/31/2025' },
    ],
  },
  {
    id: 'aca-ptc-2027',
    clauses: [
      { label: '2027 Rev. Proc. citation', clause: 'Rev. Proc. 2026-26' },
      { label: 'later coverage years unpriced', clause: 'Later coverage years are not priced until their figures are published' },
    ],
  },
  {
    id: 'state-income-tax',
    clauses: [
      { label: 'FTB table-oracle disclaimer', clause: 'not FTB table oracle' },
      { label: 'unmodeled Oregon inputs', clause: 'HOH/credits/unmodeled inputs unsupported' },
      {
        label: 'calendar-year record expiry stand-in',
        clause: 'calendar-year records expire after 2026',
      },
    ],
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

  it('links each ACA coverage year to the revenue procedure that publishes its schedule', () => {
    // One row per coverage year, so the report appendix never links a year's
    // figures to a document that does not hold them.
    expect(byId('aca-ptc').url).toBe('https://www.irs.gov/pub/irs-drop/rp-25-25.pdf')
    expect(byId('aca-ptc').figures).not.toContain('2026-26')
    expect(byId('aca-ptc-2027').url).toBe('https://www.irs.gov/pub/irs-drop/rp-26-26.pdf')
    expect(byId('aca-ptc-2027').figures).not.toContain('2025-25')
  })

  it('links the 2027 HSA limits and each state\'s enacted figures to the document that sets them', () => {
    expect(byId('hsa-2027').url).toBe('https://www.irs.gov/pub/irs-drop/rp-26-24.pdf')
    expect(byId('hsa-2027').figures).toContain('Rev. Proc. 2026-24')
    expect(byId('state-enacted-in').url).toBe('https://iga.in.gov/ic/2026/Title_6/Article_3/Chapter_2.pdf')
    expect(byId('state-enacted-ms').url).toBe('https://billstatus.ls.state.ms.us/documents/2025/html/HB/0001-0099/HB0001SG.htm')
    expect(byId('state-enacted-mt').url).toBe('https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0210/section_0030/0150-0300-0210-0030.html')
    expect(byId('state-enacted-ne').url).toBe('https://www.nebraskalegislature.gov/laws/statutes.php?statute=77-2715.03')
    expect(byId('state-enacted-nc').url).toBe('https://www.ncleg.gov/EnactedLegislation/SessionLaws/HTML/2025-2026/SL2026-41.html')
    expect(byId('state-enacted-hi').url).toBe('https://data.capitol.hawaii.gov/sessions/session2026/bills/SB3125_CD2_.HTM')
    expect(byId('state-enacted-ny').url).toBe('https://www.nysenate.gov/legislation/laws/TAX/601')
    expect(byId('state-enacted-ri').url).toBe('https://webserver.rilegislature.gov/BillText/BillText26/HouseText26/H7127Aaa.pdf')
    expect(byId('state-enacted-va').url).toBe('https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/')
    expect(byId('state-enacted-ga').url).toBe('https://gov.georgia.gov/document/2026-signed-legislation/hb-463/download')
    expect(byId('state-enacted-de').url).toBe('https://delcode.delaware.gov/title30/c011/sc02/index.html')
    expect(byId('state-enacted-il').url).toBe('https://www.ilga.gov/documents/legislation/ilcs/documents/003500050K204.htm')
    expect(byId('state-enacted-me').url).toBe('https://legislature.maine.gov/legis/bills/getPDF.asp?paper=HP1491&item=37&snum=132')
    expect(byId('state-enacted-md').url).toBe('https://mgaleg.maryland.gov/2026RS/Chapters_noln/CH_686_sb0607T.pdf')
    expect(byId('state-enacted-or').url).toBe('https://www.oregonlegislature.gov/bills_laws/ors/ors316.html')
    expect(byId('state-enacted-ca').url).toBe('https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CONS&sectionNum=SEC.%2036.&article=XIII')
    expect(byId('state-enacted-wa').url).toBe('https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/Session%20Laws/Senate/6346-S.SL.pdf')
    expect(byId('state-enacted-dc').url).toBe('https://lims.dccouncil.gov/downloads/LIMS/61627/Meeting3/Enrollment/B26-0661-Enrollment17.pdf?Id=243990')
    expect(byId('state-enacted-dc').figures).toContain('in force from October 2, 2026 after congressional review, and applying from 2025')
    expect(byId('state-enacted-dc').figures).not.toContain('November 20, 2026')
    // What is loaded is not claimed complete; the survey is named for the
    // rest, and the conditional and vote-pending changes are named with dates.
    const stateRow = byId('state-income-tax').figures
    expect(stateRow).toContain('the survey of all 51 jurisdictions')
    expect(stateRow).toContain('Georgia and South Carolina 2027 rates await determinations')
    expect(stateRow).toContain('Initiative 645, Proposition 3')
    expect(stateRow).not.toMatch(/Indiana, Mississippi, Montana, Nebraska and North Carolina are listed/)
    expect(byId('state-enacted-wa').figures).toContain('Initiative 645 on the November 3, 2026 ballot')
    expect(byId('state-enacted-ca').figures).toContain('Proposition 3 on the November 3, 2026 ballot')
  })

  it('links the life table to the page the engine read it from', () => {
    expect(byId('ssa-life-table').url).toBe(SSA_PERIOD_LIFE_TABLE.source.url)
    expect(byId('ssa-life-table').publisher).toBe('SSA Office of the Chief Actuary')
  })

  it('cites each known life table edition with one entry at SSA’s page for it (PR #759 review 1)', () => {
    for (const known of KNOWN_LIFE_TABLE_EDITIONS) {
      const entries = PARAMETER_PROVENANCE.filter((s) => s.url === known.url)
      expect(entries.map((s) => s.id), JSON.stringify(known.edition)).toHaveLength(1)
      expect(entries[0]!.figures).toContain(`the ${known.edition.periodYear} period table (${known.edition.trusteesReportYear} Trustees Report)`)
    }
    expect(byId('ssa-life-table-2022').url).toBe('https://www.ssa.gov/oact/STATS/table4c6_2022_TR2025.html')
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
    for (const [id, clauseBuilder] of Object.entries(PACK_FIGURE_CLAUSES)) {
      const clauses = clauseBuilder()
      expect(clauses.length, `${id} pack clause builder`).toBeGreaterThan(0)
      for (const { clause } of clauses) {
        expect(clause.length, `${id} pack clause text`).toBeGreaterThan(0)
      }
    }
  })

  it('figures strings track the current 2026 parameter pack via labelled clauses', () => {
    for (const [id, clauseBuilder] of Object.entries(PACK_FIGURE_CLAUSES)) {
      const entry = byId(id)
      const clauses = clauseBuilder()
      assertFiguresClauses(entry.figures, clauses, id)
      expect(figuresMatchClauses(entry.figures, []), `${id} empty clause list`).toBe(false)
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

  it('pins non-pack display-contract prose in provenance figures', () => {
    for (const contract of NON_PACK_DISPLAY_CONTRACTS) {
      const entry = byId(contract.id)
      assertFiguresClauses(entry.figures, contract.clauses, contract.id)
      expect(figuresMatchClauses(entry.figures, []), `${contract.id} empty clause list`).toBe(false)
      for (const { clause, label } of contract.clauses) {
        const withoutClause = entry.figures.replace(clause, '')
        expect(
          figuresMatchClauses(withoutClause, contract.clauses),
          `${contract.id}: ${label} omission`,
        ).toBe(false)
      }
    }
  })

  it('binds non-pack numeric claims to provenance figures with explicit ownership', () => {
    for (const claim of NON_PACK_NUMERIC_CLAIMS) {
      expect(PARAMETER_PROVENANCE.some((source) => source.id === claim.id), claim.id).toBe(true)
      expect(claim.ownership.length).toBeGreaterThan(0)
      expect(claim.clauses.length, `${claim.id} claim clauses`).toBeGreaterThan(0)
      const entry = byId(claim.id)
      assertFiguresClauses(entry.figures, claim.clauses, claim.id)
      expect(figuresMatchClauses(entry.figures, []), `${claim.id} empty clause list`).toBe(false)
      for (const { clause, label } of claim.clauses) {
        const withoutClause = entry.figures.replace(clause, '')
        expect(
          figuresMatchClauses(withoutClause, claim.clauses),
          `${claim.id}: ${label} omission`,
        ).toBe(false)
      }
    }
  })
})

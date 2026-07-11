import { combineTaxCalculators, createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { createStateTaxCalculator } from '@retiregolden/engine/tax/stateTax'
import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '@retiregolden/engine/model/plan'
import { optimizePlan, evaluateExactLedgerSchedule, withOptimizedConversions } from '@retiregolden/engine/projection/optimizePlan'
import { DEFAULT_OPTIMIZE_CONVERGENCE_ITERATIONS, DEFAULT_OPTIMIZE_SEARCH_BUDGET } from '@retiregolden/planner-ui/optimize/runOptimize'
import { summarizeProjection, type ProjectionSummary } from '@retiregolden/engine/projection/compare'
import { simulatePlan, type SimulateOptions } from '@retiregolden/engine/projection/simulate'
import type { ProjectionResult } from '@retiregolden/engine/projection/types'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from '@retiregolden/planner-ui/planner/examples/buildContext'
import { fmtMoney } from '@retiregolden/planner-ui/planner/format'
import { stableStringify } from './stableJson'

export const OWL_PARITY_MANIFEST_KIND = 'retiregolden.owl-parity.manifest'
export const OWL_PARITY_MANIFEST_VERSION = 1
export const OWL_PARITY_DEFAULT_TOLERANCE_DOLLARS = 1_000
export const OWL_PARITY_OWL_REPOSITORY = 'https://github.com/mdlacasse/Owl'
// Tag v2026.07.04 — re-pinned by the ground-truth 2026 law sync (2026-07-08).
export const OWL_PARITY_OWL_PINNED_COMMIT = 'f09b4022b05e033efc34a74c7c384d605239c9bf'

export interface OwlParityFixture {
  id: string
  name: string
  tags: string[]
  plan: Plan
  mappingNotes: string[]
}

export interface OwlCaseFile {
  fixtureId: string
  filename: string
  toml: string
  mappingNotes: string[]
}

export interface OwlCaseGenerationOptions {
  startYear?: number
}

export interface OwlScheduleConversion {
  year: number
  amount: number
}

export interface OwlRunnerArtifact {
  fixtureId: string
  status: 'solved' | 'failed' | 'skipped'
  rawJsonFile?: string
  normalizedJsonFile?: string
  conversions: OwlScheduleConversion[]
  withdrawals: Array<{ year: number; accountType: string; amount: number }>
  selfReportedEndingWealth: number | null
  selfReportedLifetimeTax: number | null
  warnings: string[]
  error?: string
}

export interface OwlRunnerSummary {
  status: 'completed' | 'failed' | 'skipped'
  reason: string | null
  owl: {
    repository: string
    pinnedCommit: string | null
    verifiedPinnedCommit: boolean
    invocation: string
    unverifiedReason?: string
  }
  artifacts: OwlRunnerArtifact[]
}

export interface PricedSchedule {
  conversions: OwlScheduleConversion[]
  result: ProjectionResult
  summary: ProjectionSummary
  validation: ReturnType<typeof evaluateExactLedgerSchedule> | null
}

export interface OwlParityCaseResult {
  id: string
  name: string
  tags: string[]
  mappingNotes: string[]
  owlCaseFile: string
  retireGolden: {
    endingAfterTaxEstate: number
    lifetimeTaxesAndPenalties: number
    conversions: OwlScheduleConversion[]
    recommendationState: string
    warnings: string[]
  }
  owl: {
    status: OwlRunnerArtifact['status'] | 'missing'
    selfReportedEndingWealth: number | null
    selfReportedLifetimeTax: number | null
    conversions: OwlScheduleConversion[]
    withdrawals: Array<{ year: number; accountType: string; amount: number }>
    warnings: string[]
    error: string | null
  }
  owlOnRetireGoldenLedger: {
    endingAfterTaxEstate: number | null
    lifetimeTaxesAndPenalties: number | null
    recommendationState: string | null
    warnings: string[]
  }
  comparison: {
    status: 'compared' | 'missing-owl' | 'owl-failed' | 'owl-skipped'
    estateDeltaDollars: number | null
    lifetimeTaxDeltaDollars: number | null
    toleranceDollars: number
    pass: boolean | null
  }
}

export interface OwlParityManifest {
  kind: typeof OWL_PARITY_MANIFEST_KIND
  version: typeof OWL_PARITY_MANIFEST_VERSION
  fixtureSet: string
  options: {
    startYear: number
    toleranceDollars: number
    owlRepository: string
    owlPinnedCommit: string
    gate: 'retiregolden-ending-after-tax-estate >= owl-schedule-on-retiregolden-ledger - tolerance'
    strictOwl: boolean
  }
  owlRunner: OwlRunnerSummary
  totals: {
    fixtureCount: number
    comparedCount: number
    passCount: number
    failCount: number
    skippedCount: number
    warningCount: number
  }
  gate: OwlParityGate
  cases: OwlParityCaseResult[]
}

export interface OwlParityGate {
  status: 'passed' | 'failed' | 'skipped' | 'partial'
  failingFixtureIds: string[]
  message: string
}

const CURRENT_YEAR = EXAMPLE_FIXED_YEAR
const PERSON_INDEX_BY_PLAN = new WeakMap<Plan, Map<string, number>>()

const GLOBAL_MAPPING_NOTES = [
  'Owl is invoked out-of-process via owlcli; no Owl code or formulas are vendored into RetireGolden.',
  'Owl account balances and cost basis are emitted in Owl-native $k fields; solver options use units = "1" so spending, MAGI, and conversion caps are full dollars.',
  'RetireGolden cash, taxable, and vested equity-comp balances are mapped into Owl taxable savings; cash contributes dollar-for-dollar cost basis.',
  'Owl CLI JSON exposes Roth conversion schedules but not account-level withdrawal schedules, so the comparator prices Owl conversions on RetireGolden ledger using each fixture plan withdrawal strategy.',
  'RetireGolden deterministic single-return assumptions are normalized to Owl user rates and a simple 60/40 allocation; the gate uses RetireGolden ledger pricing for the final apples-to-apples estate comparison.',
]

function roundDollars(value: number): number {
  return Math.round(value)
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100
}

function fixedPlan(id: string, name: string): Plan {
  return createEmptyPlan({ name, now: exampleFixedNow, newId: exampleIdFactory(`owl-parity-${id}`) })
}

function parsed(plan: Plan): Plan {
  const result = parsePlan(plan)
  if (!result.ok) throw new Error(`Invalid Owl parity fixture "${plan.name}": ${result.issues.join('; ')}`)
  return result.plan
}

function eid(fixtureId: string, suffix: string): string {
  return exampleEntityId(`owl-parity-${fixtureId}`, suffix)
}

function trad(
  fixtureId: string,
  suffix: string,
  ownerPersonId: string,
  balance: number,
): Extract<Account, { type: 'traditional' }> {
  return {
    type: 'traditional',
    id: eid(fixtureId, suffix),
    name: suffix,
    ownerPersonId,
    annualReturnPct: null,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function roth(
  fixtureId: string,
  suffix: string,
  ownerPersonId: string,
  balance: number,
): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    id: eid(fixtureId, suffix),
    name: suffix,
    ownerPersonId,
    annualReturnPct: null,
    kind: 'ira',
    balance,
    annualContribution: 0,
    contributionBasis: Math.min(balance, balance * 0.75),
  }
}

function taxable(
  fixtureId: string,
  suffix: string,
  ownerPersonId: string | null,
  balance: number,
  costBasis: number,
): Extract<Account, { type: 'taxable' }> {
  return {
    type: 'taxable',
    id: eid(fixtureId, suffix),
    name: suffix,
    ownerPersonId,
    annualReturnPct: null,
    balance,
    costBasis,
    annualContribution: 0,
    interestYieldPct: 1.2,
    dividendYieldPct: 1.6,
    qualifiedRatio: 0.8,
    reinvestDividends: false,
  }
}

function cash(fixtureId: string, suffix: string, balance: number): Extract<Account, { type: 'cash' }> {
  return {
    type: 'cash',
    id: eid(fixtureId, suffix),
    name: suffix,
    ownerPersonId: null,
    annualReturnPct: 2,
    balance,
    annualContribution: 0,
  }
}

function ss(
  fixtureId: string,
  suffix: string,
  personId: string,
  piaMonthly: number,
  claimAge: number,
): Extract<IncomeStream, { type: 'socialSecurity' }> {
  return {
    type: 'socialSecurity',
    id: eid(fixtureId, suffix),
    personId,
    piaMonthly,
    earnings: null,
    claimAge: { years: claimAge, months: 0 },
  }
}

function singleFixture(
  id: string,
  name: string,
  options: {
    dob: string
    sex: 'female' | 'male' | 'average'
    retirementAge: number
    planningAge: number
    state: string
    stateTaxPct: number
    baseAnnual: number
    recentAnnualMagi?: number
    accounts: (personId: string) => Account[]
    incomes: (personId: string) => IncomeStream[]
    tags: string[]
    notes?: string[]
  },
): OwlParityFixture {
  const p = fixedPlan(id, name)
  const personId = eid(id, 'person')
  const plan = parsed({
    ...p,
    id: eid(id, 'plan'),
    household: {
      filingStatus: 'single',
      hasQualifyingDependent: false,
      state: options.state,
      stateMoves: [],
      capitalLossCarryforward: 0,
      people: [
        {
          id: personId,
          name: 'Alex',
          dob: options.dob,
          sex: options.sex,
          retirementAge: options.retirementAge,
          longevity: { planningAge: options.planningAge, source: 'manual' },
        },
      ],
    },
    accounts: options.accounts(personId),
    incomes: options.incomes(personId),
    expenses: {
      baseAnnual: options.baseAnnual,
      phases: [],
      oneTimeGoals: [],
      healthcare: {
        pre65MonthlyPremiumPerPerson: 0,
        applyAcaCredit: false,
        medicareExtrasMonthlyPerPerson: 0,
      },
      survivorSpendingPct: 100,
      bequestTargetDollars: 0,
    },
    strategies: {
      withdrawalOrder: { mode: 'sequential' },
      rothConversion: { mode: 'none' },
      qcdAnnual: 0,
    },
    assumptions: {
      inflationPct: 2.6,
      healthcareExtraInflationPct: 3,
      defaultReturnPct: 5.2,
      ssCola: { mode: 'matchInflation' },
      ssHaircut: null,
      stateEffectiveTaxPct: options.stateTaxPct,
      localIncomeTaxPct: 0,
      recentAnnualMagi: options.recentAnnualMagi ?? 0,
      heirTaxRatePct: 25,
      safeWithdrawalRatePct: 4,
    },
    scenarios: [],
  })
  return { id, name, tags: options.tags, plan, mappingNotes: [...GLOBAL_MAPPING_NOTES, ...(options.notes ?? [])] }
}

function marriedFixture(
  id: string,
  name: string,
  options: {
    people: Array<{ name: string; dob: string; sex: 'female' | 'male' | 'average'; retirementAge: number; planningAge: number }>
    state: string
    stateTaxPct: number
    baseAnnual: number
    survivorSpendingPct: number
    recentAnnualMagi?: number
    accounts: (personIds: string[]) => Account[]
    incomes: (personIds: string[]) => IncomeStream[]
    tags: string[]
    notes?: string[]
  },
): OwlParityFixture {
  const p = fixedPlan(id, name)
  const personIds = [eid(id, 'person-1'), eid(id, 'person-2')]
  const plan = parsed({
    ...p,
    id: eid(id, 'plan'),
    household: {
      filingStatus: 'marriedFilingJointly',
      hasQualifyingDependent: false,
      state: options.state,
      stateMoves: [],
      capitalLossCarryforward: 0,
      people: options.people.map((person, index) => ({
        id: personIds[index]!,
        name: person.name,
        dob: person.dob,
        sex: person.sex,
        retirementAge: person.retirementAge,
        longevity: { planningAge: person.planningAge, source: 'manual' },
      })),
    },
    accounts: options.accounts(personIds),
    incomes: options.incomes(personIds),
    expenses: {
      baseAnnual: options.baseAnnual,
      phases: [],
      oneTimeGoals: [],
      healthcare: {
        pre65MonthlyPremiumPerPerson: 0,
        applyAcaCredit: false,
        medicareExtrasMonthlyPerPerson: 0,
      },
      survivorSpendingPct: options.survivorSpendingPct,
      bequestTargetDollars: 0,
    },
    strategies: {
      withdrawalOrder: { mode: 'sequential' },
      rothConversion: { mode: 'none' },
      qcdAnnual: 0,
    },
    assumptions: {
      inflationPct: 2.6,
      healthcareExtraInflationPct: 3,
      defaultReturnPct: 5.2,
      ssCola: { mode: 'matchInflation' },
      ssHaircut: null,
      stateEffectiveTaxPct: options.stateTaxPct,
      localIncomeTaxPct: 0,
      recentAnnualMagi: options.recentAnnualMagi ?? 0,
      heirTaxRatePct: 25,
      safeWithdrawalRatePct: 4,
    },
    scenarios: [],
  })
  return { id, name, tags: options.tags, plan, mappingNotes: [...GLOBAL_MAPPING_NOTES, ...(options.notes ?? [])] }
}

export const OWL_PARITY_FIXTURES: OwlParityFixture[] = [
  singleFixture('trad-heavy-bridge', 'Traditional-heavy low-income bridge', {
    dob: '1964-01-15',
    sex: 'female',
    retirementAge: 61,
    planningAge: 92,
    state: 'TX',
    stateTaxPct: 0,
    baseAnnual: 72_000,
    recentAnnualMagi: 24_000,
    tags: ['trad-heavy', 'bridge', 'low-income'],
    accounts: (p) => [
      cash('trad-heavy-bridge', 'Cash reserve', 140_000),
      trad('trad-heavy-bridge', 'Traditional IRA', p, 1_180_000),
      roth('trad-heavy-bridge', 'Roth IRA', p, 75_000),
    ],
    incomes: (p) => [ss('trad-heavy-bridge', 'Social Security', p, 2_850, 70)],
    notes: ['No ACA, wages, pension, property, or debt are included so the bridge-year Roth timing is the isolated signal.'],
  }),
  marriedFixture('balanced-low-basis', 'Balanced couple with low-basis taxable', {
    people: [
      { name: 'Morgan', dob: '1962-04-15', sex: 'male', retirementAge: 64, planningAge: 92 },
      { name: 'Riley', dob: '1964-09-02', sex: 'female', retirementAge: 64, planningAge: 95 },
    ],
    state: 'KY',
    stateTaxPct: 4,
    baseAnnual: 96_000,
    survivorSpendingPct: 65,
    recentAnnualMagi: 110_000,
    tags: ['balanced', 'taxable-low-basis', 'mfj'],
    accounts: ([a, b]) => [
      cash('balanced-low-basis', 'Cash reserve', 90_000),
      taxable('balanced-low-basis', 'Joint taxable brokerage', null, 520_000, 235_000),
      trad('balanced-low-basis', 'Morgan IRA', a!, 640_000),
      trad('balanced-low-basis', 'Riley IRA', b!, 260_000),
      roth('balanced-low-basis', 'Morgan Roth IRA', a!, 260_000),
      roth('balanced-low-basis', 'Riley Roth IRA', b!, 150_000),
    ],
    incomes: ([a, b]) => [
      ss('balanced-low-basis', 'Morgan Social Security', a!, 2_650, 70),
      ss('balanced-low-basis', 'Riley Social Security', b!, 1_750, 67),
    ],
    notes: ['Joint taxable brokerage is split evenly into Owl person-level taxable balances and basis.'],
  }),
  singleFixture('roth-heavy-control', 'Roth-heavy control household', {
    dob: '1966-06-01',
    sex: 'average',
    retirementAge: 60,
    planningAge: 94,
    state: 'TX',
    stateTaxPct: 0,
    baseAnnual: 78_000,
    recentAnnualMagi: 48_000,
    tags: ['roth-heavy', 'control'],
    accounts: (p) => [
      cash('roth-heavy-control', 'Cash reserve', 65_000),
      taxable('roth-heavy-control', 'High-basis brokerage', null, 210_000, 198_000),
      trad('roth-heavy-control', 'Modest traditional IRA', p, 235_000),
      roth('roth-heavy-control', 'Large Roth IRA', p, 1_150_000),
    ],
    incomes: (p) => [ss('roth-heavy-control', 'Social Security', p, 2_100, 67)],
    notes: ['Average sex is mapped to female in Owl because Owl requires M/F and deterministic mortality is not part of this gate.'],
  }),
  singleFixture('high-tax-state', 'High-tax-state traditional balance', {
    dob: '1963-03-01',
    sex: 'male',
    retirementAge: 63,
    planningAge: 91,
    state: 'CA',
    stateTaxPct: 8.5,
    baseAnnual: 88_000,
    recentAnnualMagi: 80_000,
    tags: ['high-tax-state', 'trad-heavy'],
    accounts: (p) => [
      cash('high-tax-state', 'Cash reserve', 90_000),
      taxable('high-tax-state', 'Taxable brokerage', null, 330_000, 240_000),
      trad('high-tax-state', 'Traditional IRA', p, 1_420_000),
      roth('high-tax-state', 'Roth IRA', p, 95_000),
    ],
    incomes: (p) => [ss('high-tax-state', 'Social Security', p, 2_600, 70)],
    notes: ['RetireGolden optimizer state tax uses the fixture flat effective rate; Owl receives the two-letter state and runs its own state model.'],
  }),
  marriedFixture('survivor-phase', 'Survivor phase and widow bracket pressure', {
    people: [
      { name: 'Lee', dob: '1962-06-15', sex: 'female', retirementAge: 65, planningAge: 95 },
      { name: 'Chris', dob: '1960-06-15', sex: 'male', retirementAge: 65, planningAge: 78 },
    ],
    state: 'KY',
    stateTaxPct: 4,
    baseAnnual: 92_000,
    survivorSpendingPct: 60,
    recentAnnualMagi: 105_000,
    tags: ['survivor-phase', 'mfj', 'pension'],
    accounts: ([a, b]) => [
      cash('survivor-phase', 'Cash reserve', 110_000),
      taxable('survivor-phase', 'Joint brokerage', null, 280_000, 225_000),
      trad('survivor-phase', 'Lee IRA', a!, 520_000),
      trad('survivor-phase', 'Chris IRA', b!, 850_000),
      roth('survivor-phase', 'Lee Roth IRA', a!, 105_000),
    ],
    incomes: ([a, b]) => [
      ss('survivor-phase', 'Lee Social Security', a!, 1_200, 67),
      ss('survivor-phase', 'Chris Social Security', b!, 3_050, 67),
    ],
    notes: ['Survivor spending is explicitly set to 60% in both engines.'],
  }),
  singleFixture('ss-torpedo', 'Social Security tax torpedo retiree', {
    dob: '1959-01-20',
    sex: 'female',
    retirementAge: 67,
    planningAge: 93,
    state: 'TX',
    stateTaxPct: 0,
    baseAnnual: 56_000,
    recentAnnualMagi: 42_000,
    tags: ['ss-torpedo', 'rmd-pressure'],
    accounts: (p) => [
      cash('ss-torpedo', 'Cash reserve', 55_000),
      taxable('ss-torpedo', 'High-basis brokerage', null, 265_000, 250_000),
      trad('ss-torpedo', 'Traditional IRA', p, 735_000),
      roth('ss-torpedo', 'Roth IRA', p, 60_000),
    ],
    incomes: (p) => [ss('ss-torpedo', 'Social Security', p, 2_450, 67)],
    notes: ['The fixture starts at Social Security claiming age so the conversion schedule is sensitive to taxable-SS feedback.'],
  }),
]

function taxCalculatorFor(plan: Plan): SimulateOptions['taxCalculator'] {
  return combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  )
}

function personIndexById(plan: Plan): Map<string, number> {
  const cached = PERSON_INDEX_BY_PLAN.get(plan)
  if (cached) return cached
  const index = new Map(plan.household.people.map((person, index) => [person.id, index]))
  PERSON_INDEX_BY_PLAN.set(plan, index)
  return index
}

function addOwnedAmount(amounts: number[], plan: Plan, ownerPersonId: string | null, amount: number): void {
  if (amount <= 0) return
  const index = ownerPersonId ? personIndexById(plan).get(ownerPersonId) : undefined
  if (index !== undefined) {
    amounts[index] += amount
    return
  }
  const split = amount / amounts.length
  for (let i = 0; i < amounts.length; i++) amounts[i] += split
}

function planToOwlBalances(plan: Plan): {
  taxable: number[]
  taxableCostBasis: number[]
  taxDeferred: number[]
  taxFree: number[]
  hsa: number[]
} {
  const count = plan.household.people.length
  const taxableBalances = Array(count).fill(0) as number[]
  const taxableCostBasis = Array(count).fill(0) as number[]
  const taxDeferred = Array(count).fill(0) as number[]
  const taxFree = Array(count).fill(0) as number[]
  const hsaBalances = Array(count).fill(0) as number[]

  for (const account of plan.accounts) {
    switch (account.type) {
      case 'cash':
        addOwnedAmount(taxableBalances, plan, account.ownerPersonId, account.balance)
        addOwnedAmount(taxableCostBasis, plan, account.ownerPersonId, account.balance)
        break
      case 'taxable':
      case 'equityComp':
        addOwnedAmount(taxableBalances, plan, account.ownerPersonId, account.balance)
        addOwnedAmount(taxableCostBasis, plan, account.ownerPersonId, account.costBasis)
        break
      case 'traditional':
        addOwnedAmount(taxDeferred, plan, account.ownerPersonId, account.balance)
        break
      case 'roth':
        addOwnedAmount(taxFree, plan, account.ownerPersonId, account.balance)
        break
      case 'hsa':
        addOwnedAmount(hsaBalances, plan, account.ownerPersonId, account.balance)
        break
    }
  }

  return {
    taxable: taxableBalances.map((amount) => roundCents(amount / 1_000)),
    taxableCostBasis: taxableCostBasis.map((amount) => roundCents(amount / 1_000)),
    taxDeferred: taxDeferred.map((amount) => roundCents(amount / 1_000)),
    taxFree: taxFree.map((amount) => roundCents(amount / 1_000)),
    hsa: hsaBalances.map((amount) => roundCents(amount / 1_000)),
  }
}

function ssByPerson(plan: Plan): { pias: number[]; ages: number[] } {
  const pias = plan.household.people.map(() => 0)
  const ages = plan.household.people.map(() => 67)
  const index = personIndexById(plan)
  for (const income of plan.incomes) {
    if (income.type !== 'socialSecurity') continue
    const personIndex = index.get(income.personId)
    if (personIndex === undefined) continue
    pias[personIndex] += income.piaMonthly ?? 0
    ages[personIndex] = income.claimAge.years + income.claimAge.months / 12
  }
  return { pias, ages }
}

function pensionsByPerson(plan: Plan): {
  amounts: number[]
  ages: number[]
  indexed: boolean[]
  survivorFractions: number[]
} {
  const amounts = plan.household.people.map(() => 0)
  const ages = plan.household.people.map(() => 65)
  const indexed = plan.household.people.map(() => false)
  const survivorFractions = plan.household.people.map(() => 0)
  const index = personIndexById(plan)
  for (const account of plan.accounts) {
    if (account.type !== 'pension') continue
    const personIndex = account.ownerPersonId ? index.get(account.ownerPersonId) : undefined
    if (personIndex === undefined) continue
    amounts[personIndex] += account.monthlyAmount
    ages[personIndex] = account.startAge
    indexed[personIndex] = account.colaPct > 0
    survivorFractions[personIndex] = account.survivorPct / 100
  }
  return { amounts, ages, indexed, survivorFractions }
}

function owlSex(sex: Plan['household']['people'][number]['sex']): 'M' | 'F' {
  if (sex === 'male') return 'M'
  return 'F'
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`
}

function tomlNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Cannot write non-finite TOML number: ${value}`)
  if (Number.isInteger(value)) return String(value)
  return Number(value.toPrecision(12)).toString()
}

function tomlValue(value: string | number | boolean | null | Array<string | number | boolean | null>): string {
  if (Array.isArray(value)) return `[${value.map(tomlValue).join(', ')}]`
  if (typeof value === 'string') return tomlString(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null) return '0'
  return tomlNumber(value)
}

function linesForSection(name: string, values: Record<string, string | number | boolean | null | Array<string | number | boolean | null>>): string[] {
  const lines = [`[${name}]`]
  for (const [key, value] of Object.entries(values)) lines.push(`${key} = ${tomlValue(value)}`)
  return lines
}

export function planToOwlCaseToml(fixture: OwlParityFixture, options: OwlCaseGenerationOptions = {}): OwlCaseFile {
  const plan = fixture.plan
  const startYear = options.startYear ?? CURRENT_YEAR
  const balances = planToOwlBalances(plan)
  const socialSecurity = ssByPerson(plan)
  const pensions = pensionsByPerson(plan)
  const people = plan.household.people
  const genericAllocation = people.map(() => '[[60, 40, 0, 0], [60, 40, 0, 0]]')
  const inflationPct = plan.assumptions.inflationPct
  const stockReturnPct = Math.max(inflationPct + 0.1, plan.assumptions.defaultReturnPct)
  const corpBondPct = Math.max(0, stockReturnPct - 1.8)
  const treasuryPct = Math.max(0, inflationPct + 0.7)

  const lines = [
    `case_name = ${tomlString(fixture.id)}`,
    `description = ${tomlString(`RetireGolden Owl parity fixture: ${fixture.name}`)}`,
    '',
    ...linesForSection('basic_info', {
      status: plan.household.filingStatus === 'marriedFilingJointly' ? 'married' : 'single',
      names: people.map((person) => person.name),
      sexes: people.map((person) => owlSex(person.sex)),
      date_of_birth: people.map((person) => person.dob),
      life_expectancy: people.map((person) => person.longevity.planningAge),
      start_date: `${startYear}-01-01`,
      state: plan.household.state,
    }),
    '',
    ...linesForSection('savings_assets', {
      taxable_savings_balances: balances.taxable,
      taxable_cost_basis: balances.taxableCostBasis,
      tax_deferred_savings_balances: balances.taxDeferred,
      tax_free_savings_balances: balances.taxFree,
      hsa_savings_balances: balances.hsa,
      ...(people.length === 2
        ? {
            beneficiary_fractions: [1, 1, 1, 1],
            spousal_surplus_deposit_fraction: 0.5,
          }
        : {}),
    }),
    '',
    ...linesForSection('household_financial_profile', { HFP_file_name: 'None' }),
    '',
    ...linesForSection('fixed_income', {
      pension_monthly_amounts: pensions.amounts,
      pension_ages: pensions.ages,
      pension_indexed: pensions.indexed,
      pension_survivor_fraction: pensions.survivorFractions,
      social_security_pia_amounts: socialSecurity.pias,
      social_security_ages: socialSecurity.ages,
      social_security_trim_pct: plan.assumptions.ssHaircut?.cutPct ?? 0,
      social_security_trim_year: plan.assumptions.ssHaircut?.fromYear ?? 0,
    }),
    '',
    ...linesForSection('rates_selection', {
      heirs_rate_on_tax_deferred_estate: plan.assumptions.heirTaxRatePct,
      liquidation_tax_rate: plan.assumptions.heirTaxRatePct,
      liquidation_capgains_rate: 15,
      dividend_rate: 1.6,
      obbba_expiration_year: 2032,
      method: 'user',
      values: [stockReturnPct, corpBondPct, treasuryPct, inflationPct],
      from: 1928,
      to: 2025,
    }),
    '',
    '[asset_allocation]',
    'interpolation_method = "linear"',
    'type = "individual"',
    `generic = [${genericAllocation.join(', ')}]`,
    '',
    ...linesForSection('optimization_parameters', {
      spending_profile: 'flat',
      surviving_spouse_spending_percent: plan.expenses.survivorSpendingPct ?? 100,
      objective: 'maxBequest',
    }),
    '',
    ...linesForSection('solver_options', {
      units: '1',
      solver: 'default',
      gap: 0.0001,
      maxTime: 120,
      netSpending: plan.expenses.baseAnnual,
      maxRothConversion: 1_000_000,
      noRothConversions: 'none',
      startRothConversions: startYear,
      spendingSlack: 0,
      withSCLoop: true,
      withMedicare: 'loop',
      withACA: 'loop',
      withSSTaxability: 'loop',
      withdrawalOrder: 'optimal',
      previousMAGIs: [plan.assumptions.recentAnnualMagi, plan.assumptions.recentAnnualMagi],
    }),
    '',
    ...linesForSection('aca_settings', { slcsp_annual: 0 }),
    '',
    ...linesForSection('results', { default_plots: 'today' }),
    '',
  ]

  return {
    fixtureId: fixture.id,
    filename: `${fixture.id}.toml`,
    toml: `${lines.join('\n')}`,
    mappingNotes: fixture.mappingNotes,
  }
}

export function owlCaseFiles(
  fixtures: OwlParityFixture[] = OWL_PARITY_FIXTURES,
  options: OwlCaseGenerationOptions = {},
): OwlCaseFile[] {
  return fixtures.map((fixture) => planToOwlCaseToml(fixture, options))
}

export function stableOwlParityManifestJson(manifest: OwlParityManifest): string {
  return stableStringify(manifest)
}

export function priceOwlScheduleOnRetireGoldenLedger(
  plan: Plan,
  conversions: OwlScheduleConversion[],
  startYear = CURRENT_YEAR,
): PricedSchedule {
  const simulateOptions = { startYear, taxCalculator: taxCalculatorFor(plan) }
  const baselineResult = simulatePlan(plan, simulateOptions)
  const candidatePlan = conversions.length > 0 ? withOptimizedConversions(plan, conversions) : plan
  const candidateResult = conversions.length > 0 ? simulatePlan(candidatePlan, simulateOptions) : baselineResult
  return {
    conversions,
    result: candidateResult,
    summary: summarizeProjection(plan, candidateResult),
    validation:
      conversions.length > 0
        ? evaluateExactLedgerSchedule(plan, conversions, baselineResult, candidateResult)
        : null,
  }
}

async function runRetireGoldenSchedule(fixture: OwlParityFixture, startYear: number): Promise<PricedSchedule & { recommendationState: string }> {
  const plan = fixture.plan
  const simulateOptions = { startYear, taxCalculator: taxCalculatorFor(plan) }
  const baselineResult = simulatePlan(plan, simulateOptions)
  // Prove ≥ Owl against the exact pipeline the production worker ships: the
  // shared defaults for the convergence loop (Step 1) and the bounded
  // deterministic local search. Claim co-optimization is left off so the claim
  // age stays matched to Owl's case (apples-to-apples on conversions).
  const optimized = await optimizePlan(plan, {
    ...simulateOptions,
    search: { maxSimulations: DEFAULT_OPTIMIZE_SEARCH_BUDGET },
    convergence: { maxIterations: DEFAULT_OPTIMIZE_CONVERGENCE_ITERATIONS },
  })
  const conversions = optimized.tournament.winnerConversions
  const candidatePlan = conversions.length > 0 ? withOptimizedConversions(plan, conversions) : plan
  const candidateResult = conversions.length > 0 ? simulatePlan(candidatePlan, simulateOptions) : baselineResult
  const validation =
    conversions.length > 0
      ? evaluateExactLedgerSchedule(plan, conversions, baselineResult, candidateResult)
      : null
  return {
    conversions,
    result: candidateResult,
    summary: summarizeProjection(plan, candidateResult),
    validation,
    recommendationState: validation?.recommendationState ?? optimized.tournament.winnerSource,
  }
}

function artifactByFixture(summary: OwlRunnerSummary): Map<string, OwlRunnerArtifact> {
  return new Map(summary.artifacts.map((artifact) => [artifact.fixtureId, artifact]))
}

export function evaluateOwlParityGate(cases: OwlParityCaseResult[], strictOwl: boolean): OwlParityGate {
  const compared = cases.filter((row) => row.comparison.status === 'compared')
  const failing = compared.filter((row) => row.comparison.pass === false)
  if (failing.length > 0) {
    return {
      status: 'failed',
      failingFixtureIds: failing.map((row) => row.id),
      message: `${failing.length} fixture(s) trail Owl beyond tolerance.`,
    }
  }
  if (compared.length === cases.length) {
    return {
      status: 'passed',
      failingFixtureIds: [],
      message: 'RetireGolden meets or beats Owl within tolerance on every fixture.',
    }
  }
  if (compared.length === 0) {
    return {
      status: strictOwl ? 'failed' : 'skipped',
      failingFixtureIds: strictOwl ? cases.map((row) => row.id) : [],
      message: strictOwl
        ? 'No Owl results were available and strict Owl mode is enabled.'
        : 'Owl results were not available; RetireGolden schedules were generated and the parity gate was skipped.',
    }
  }
  return {
    status: strictOwl ? 'failed' : 'partial',
    failingFixtureIds: strictOwl ? cases.filter((row) => row.comparison.status !== 'compared').map((row) => row.id) : [],
    message: strictOwl
      ? 'Some Owl results were missing or failed and strict Owl mode is enabled.'
      : 'Only a subset of fixtures had Owl results; completed comparisons passed.',
  }
}

export async function buildOwlParityManifest(options: {
  owlRunner: OwlRunnerSummary
  startYear?: number
  toleranceDollars?: number
  strictOwl?: boolean
  fixtures?: OwlParityFixture[]
  caseFiles?: OwlCaseFile[]
}): Promise<OwlParityManifest> {
  const startYear = options.startYear ?? CURRENT_YEAR
  const toleranceDollars = options.toleranceDollars ?? OWL_PARITY_DEFAULT_TOLERANCE_DOLLARS
  const strictOwl = options.strictOwl ?? false
  const fixtures = options.fixtures ?? OWL_PARITY_FIXTURES
  const caseFiles = new Map((options.caseFiles ?? owlCaseFiles(fixtures, { startYear })).map((file) => [file.fixtureId, file]))
  const artifacts = artifactByFixture(options.owlRunner)
  const cases: OwlParityCaseResult[] = []

  for (const fixture of fixtures) {
    const retireGolden = await runRetireGoldenSchedule(fixture, startYear)
    const owl = artifacts.get(fixture.id)
    const caseFile = caseFiles.get(fixture.id)
    let owlPriced: PricedSchedule | null = null
    if (owl?.status === 'solved') {
      owlPriced = priceOwlScheduleOnRetireGoldenLedger(fixture.plan, owl.conversions, startYear)
    }
    const estateDelta = owlPriced ? retireGolden.summary.endingAfterTaxEstate - owlPriced.summary.endingAfterTaxEstate : null
    const lifetimeTaxDelta = owlPriced
      ? retireGolden.summary.lifetimeTaxesAndPenalties - owlPriced.summary.lifetimeTaxesAndPenalties
      : null
    const comparisonStatus: OwlParityCaseResult['comparison']['status'] =
      owl === undefined ? 'missing-owl' : owl.status === 'solved' ? 'compared' : owl.status === 'failed' ? 'owl-failed' : 'owl-skipped'

    cases.push({
      id: fixture.id,
      name: fixture.name,
      tags: [...fixture.tags].sort(),
      mappingNotes: [...fixture.mappingNotes].sort(),
      owlCaseFile: caseFile?.filename ?? `${fixture.id}.toml`,
      retireGolden: {
        endingAfterTaxEstate: roundDollars(retireGolden.summary.endingAfterTaxEstate),
        lifetimeTaxesAndPenalties: roundDollars(retireGolden.summary.lifetimeTaxesAndPenalties),
        conversions: retireGolden.conversions.map((conversion) => ({ year: conversion.year, amount: roundDollars(conversion.amount) })),
        recommendationState: retireGolden.recommendationState,
        warnings: [...retireGolden.result.warnings].sort(),
      },
      owl: {
        status: owl?.status ?? 'missing',
        selfReportedEndingWealth: owl?.selfReportedEndingWealth ?? null,
        selfReportedLifetimeTax: owl?.selfReportedLifetimeTax ?? null,
        conversions: owl?.conversions.map((conversion) => ({ year: conversion.year, amount: roundDollars(conversion.amount) })) ?? [],
        withdrawals: owl?.withdrawals ?? [],
        warnings: [...(owl?.warnings ?? [])].sort(),
        error: owl?.error ?? null,
      },
      owlOnRetireGoldenLedger: {
        endingAfterTaxEstate: owlPriced ? roundDollars(owlPriced.summary.endingAfterTaxEstate) : null,
        lifetimeTaxesAndPenalties: owlPriced ? roundDollars(owlPriced.summary.lifetimeTaxesAndPenalties) : null,
        recommendationState: owlPriced?.validation?.recommendationState ?? (owlPriced ? 'neutral' : null),
        warnings: owlPriced ? [...owlPriced.result.warnings].sort() : [],
      },
      comparison: {
        status: comparisonStatus,
        estateDeltaDollars: estateDelta === null ? null : roundDollars(estateDelta),
        lifetimeTaxDeltaDollars: lifetimeTaxDelta === null ? null : roundDollars(lifetimeTaxDelta),
        toleranceDollars,
        pass: estateDelta === null ? null : estateDelta >= -toleranceDollars,
      },
    })
  }

  const gate = evaluateOwlParityGate(cases, strictOwl)
  return {
    kind: OWL_PARITY_MANIFEST_KIND,
    version: OWL_PARITY_MANIFEST_VERSION,
    fixtureSet: 'owl-parity-v1',
    options: {
      startYear,
      toleranceDollars,
      owlRepository: OWL_PARITY_OWL_REPOSITORY,
      owlPinnedCommit: OWL_PARITY_OWL_PINNED_COMMIT,
      gate: 'retiregolden-ending-after-tax-estate >= owl-schedule-on-retiregolden-ledger - tolerance',
      strictOwl,
    },
    owlRunner: options.owlRunner,
    totals: {
      fixtureCount: cases.length,
      comparedCount: cases.filter((row) => row.comparison.status === 'compared').length,
      passCount: cases.filter((row) => row.comparison.pass === true).length,
      failCount: cases.filter((row) => row.comparison.pass === false).length,
      skippedCount: cases.filter((row) => row.comparison.status !== 'compared').length,
      warningCount: cases.reduce(
        (sum, row) => sum + row.retireGolden.warnings.length + row.owl.warnings.length + row.owlOnRetireGoldenLedger.warnings.length,
        0,
      ),
    },
    gate,
    cases,
  }
}

function formatDollars(value: number | null): string {
  return value === null ? 'n/a' : fmtMoney(value)
}

export function buildOwlParityMarkdownReport(manifest: OwlParityManifest): string {
  const lines = [
    '# Owl parity report',
    '',
    `Gate: **${manifest.gate.status.toUpperCase()}** - ${manifest.gate.message}`,
    '',
    `Owl: ${manifest.options.owlRepository} @ \`${manifest.options.owlPinnedCommit.slice(0, 12)}\``,
    `Owl runner: ${manifest.owlRunner.owl.invocation} (${manifest.owlRunner.owl.verifiedPinnedCommit ? 'verified pinned' : 'unverified or skipped'})`,
    `Tolerance: ${formatDollars(manifest.options.toleranceDollars)} ending after-tax estate`,
    '',
    '| Fixture | RetireGolden estate | Owl schedule on RetireGolden ledger | Delta | Result |',
    '|---|---:|---:|---:|---|',
  ]

  for (const row of manifest.cases) {
    const result =
      row.comparison.status === 'compared'
        ? row.comparison.pass
          ? 'pass'
          : 'fail'
        : row.comparison.status
    lines.push(
      `| ${row.name} | ${formatDollars(row.retireGolden.endingAfterTaxEstate)} | ${formatDollars(row.owlOnRetireGoldenLedger.endingAfterTaxEstate)} | ${formatDollars(row.comparison.estateDeltaDollars)} | ${result} |`,
    )
  }

  lines.push(
    '',
    '## Normalization',
    '',
    ...GLOBAL_MAPPING_NOTES.map((note) => `- ${note}`),
    '',
    '## Artifacts',
    '',
    '- `manifest.json`: stable machine-readable comparison.',
    '- `report.md`: this human-readable summary.',
    '- `owl-cases/*.toml`: generated Owl case files.',
    '- `owl-results/*.json`: normalized Owl outputs when Owl is available.',
    '',
  )

  return `${lines.join('\n')}`
}

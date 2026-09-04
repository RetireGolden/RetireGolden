/**
 * Hostile delegation, materialization, and annual-pass rollback guards.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualLegacyQcdOwnerCharacterPlanInput,
  AnnualLegacyQcdOwnerCharacterPlanResult,
  AnnualLegacyQcdOwnerCharacterRow,
  LegacyQcdCashFlowWrite,
} from './internal/annualLegacyQcdOwnerCharacterPlan.js'
import type { IraProRataYear } from '../strategies/iraBasis.js'
import type { SeamCall } from './simulate.seamGuard.test-support.js'

type FailureMode =
  | 'rowGetter'
  | 'rowsIterator'
  | 'writesIterator'
  | 'proRataGetter'
  | 'unknownTarget'
type ShapeMode = 'empty' | 'truncated' | 'reordered' | 'duplicate' | 'extra'
type Mode = 'normal' | 'warning' | 'fp' | 'proRataSecondRead' | FailureMode | ShapeMode

/** Offset and balance state as it stood before the real planner ran. */
interface CharacterCapture {
  readonly year: number
  readonly offsetAtCall: readonly (readonly [string, number])[]
  readonly inputOwnerBalances: readonly (readonly [string, number])[]
}

/**
 * Per-pass sentinels the injected row keeps behind read-once getters. Reading
 * them back off the published row would trip the very single-read guard under
 * test, so the seam records them here instead, indexed by its own ordinal.
 */
interface CharacterSentinels {
  readonly injectedWrites: object
  readonly exactProRataWrite: IraProRataYear
  readonly readCounts: ReadonlyMap<string, number>
  readonly values: Readonly<{
    qualifiedFromRmd: number
    nonQualifiedBeyondRmd: number
    incomeOffsetDelta: number
    nonQualifiedOrdinaryIncomeDelta: number
    qcdOffsetConsumedWrite: number | null
    exclusionFromRmd: number
    ordinaryFromRmd: number
    exclusionBeyondRmd: number
    ordinaryBeyondRmd: number
  }>
}

type CharacterPhase = SeamCall<
  AnnualLegacyQcdOwnerCharacterPlanInput,
  AnnualLegacyQcdOwnerCharacterPlanResult,
  CharacterCapture
>

const hostile = vi.hoisted(() => ({
  mode: 'normal' as Mode,
  sentinels: [] as (CharacterSentinels | undefined)[],
  splitProRataInputs: [] as IraProRataYear[],
  partialStateObservations: [] as (readonly (readonly [string, number])[])[],
  secondReadProRataIdentity: null as IraProRataYear | null,
  secondReadProRataCounts: { basis: 0, nontaxableFraction: 0 },
  armPublicationObserver: null as (() => void) | null,
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualLegacyQcdOwnerCharacterPlanInput,
      AnnualLegacyQcdOwnerCharacterPlanResult,
      CharacterCapture
    >(),
)

vi.mock('../strategies/iraBasis.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../strategies/iraBasis.js')>()
  return {
    ...original,
    splitIraDistribution: (
      state: IraProRataYear,
      amount: number,
      readState?: IraProRataYear,
    ) => {
      hostile.splitProRataInputs.push(state)
      return original.splitIraDistribution(state, amount, readState)
    },
  }
})

vi.mock('./internal/annualLegacyQcdOwnerCharacterPlan.js', async (importOriginal) => {
  function observe(input: AnnualLegacyQcdOwnerCharacterPlanInput): void {
    hostile.partialStateObservations.push([...input.qcdOffsetConsumedByDonor])
  }

  function shapeRow(
    row: AnnualLegacyQcdOwnerCharacterRow,
    ownerId: string,
  ): AnnualLegacyQcdOwnerCharacterRow {
    return { ...row, ownerId, qcdOffsetConsumedWrite: 12_345 }
  }

  return seam.through(
    await importOriginal<
      typeof import('./internal/annualLegacyQcdOwnerCharacterPlan.js')
    >(),
    'annualLegacyQcdOwnerCharacterPlan',
    (
      natural,
      { input, ordinal: pass },
    ): AnnualLegacyQcdOwnerCharacterPlanResult => {
      const first = natural.rows[0]
      if (first === undefined && hostile.mode !== 'empty') {
        throw new Error('expected at least one QCD owner row')
      }

      if (hostile.mode === 'fp') {
        if (natural.rows.length !== 3) {
          throw new Error(`expected three FP owner rows, got ${natural.rows.length}`)
        }
        return {
          rows: natural.rows.map((row, index) => ({
            ...row,
            qualifiedFromRmd: 0,
            nonQualifiedBeyondRmd: 0,
            incomeOffsetDelta: 0,
            nonQualifiedOrdinaryIncomeDelta:
              index === 0 ? 10_000_000_000_000_000 : 1,
            qcdOffsetConsumedWrite: null,
            iraProRataWrite: null,
            cashFlowWrites: [],
          })),
        }
      }

      if (hostile.mode === 'empty') return { rows: [] }
      if (hostile.mode === 'truncated') return { rows: [natural.rows[0]!] }
      if (hostile.mode === 'reordered') {
        return { rows: [natural.rows[1]!, natural.rows[0]!] }
      }
      if (hostile.mode === 'duplicate') {
        return {
          rows: [natural.rows[0]!, shapeRow(natural.rows[1]!, natural.rows[0]!.ownerId)],
        }
      }
      if (hostile.mode === 'extra') {
        return {
          rows: [...natural.rows, shapeRow(natural.rows[0]!, 'extra-owner')],
        }
      }

      const ordinal = input.qcdOffsetConsumedByDonor.has('p1') ? 1 : 0
      const values = {
        qualifiedFromRmd: Math.max(0, first!.qualifiedFromRmd - 100 - ordinal),
        nonQualifiedBeyondRmd: 2_000 + ordinal,
        incomeOffsetDelta: 1_000 + ordinal * 100,
        nonQualifiedOrdinaryIncomeDelta: 100 + ordinal * 10,
        qcdOffsetConsumedWrite: ordinal === 0 ? 12_345 : 67_890,
        exclusionFromRmd: 1_111 + ordinal,
        ordinaryFromRmd: 222 + ordinal,
        exclusionBeyondRmd: 333 + ordinal,
        ordinaryBeyondRmd: 444 + ordinal,
      }
      const exactProRataWrite: IraProRataYear = {
        basis: 0,
        nontaxableFraction: 0,
      }

      if (hostile.mode === 'rowsIterator') {
        const row = { ...first!, qcdOffsetConsumedWrite: 12_345 }
        hostile.armPublicationObserver?.()
        return {
          rows: {
            *[Symbol.iterator]() {
              yield row
              observe(input)
              throw new Error('hostile rows iterator')
            },
          } as unknown as readonly AnnualLegacyQcdOwnerCharacterRow[],
        }
      }

      if (hostile.mode === 'writesIterator') {
        const row = {
          ...first!,
          qcdOffsetConsumedWrite: 12_345,
          cashFlowWrites: {
            *[Symbol.iterator]() {
              yield {
                ownerId: first!.ownerId,
                target: 'exclusionFromRmd' as const,
                value: 1,
              }
              observe(input)
              throw new Error('hostile writes iterator')
            },
          },
        } as unknown as AnnualLegacyQcdOwnerCharacterRow
        hostile.armPublicationObserver?.()
        return { rows: [row] }
      }

      if (hostile.mode === 'rowGetter') {
        const row = {
          ...first!,
          qcdOffsetConsumedWrite: 12_345,
          get nonQualifiedOrdinaryIncomeDelta(): number {
            observe(input)
            throw new Error('hostile row getter')
          },
        }
        hostile.armPublicationObserver?.()
        return { rows: [row] }
      }

      if (hostile.mode === 'proRataGetter') {
        const row = {
          ...first!,
          qcdOffsetConsumedWrite: 12_345,
          iraProRataWrite: {
            get basis(): number {
              observe(input)
              throw new Error('hostile pro-rata getter')
            },
            nontaxableFraction: 0,
          },
        }
        hostile.armPublicationObserver?.()
        return { rows: [row] }
      }

      if (hostile.mode === 'proRataSecondRead') {
        const hostileProRata: IraProRataYear = {
          get basis(): number {
            hostile.secondReadProRataCounts.basis += 1
            if (hostile.secondReadProRataCounts.basis > 1) {
              observe(input)
              throw new Error('hostile second pro-rata basis read')
            }
            return 0
          },
          get nontaxableFraction(): number {
            hostile.secondReadProRataCounts.nontaxableFraction += 1
            if (hostile.secondReadProRataCounts.nontaxableFraction > 1) {
              observe(input)
              throw new Error('hostile second pro-rata fraction read')
            }
            return 0
          },
        }
        hostile.secondReadProRataIdentity = hostileProRata
        return {
          rows: [{
            ...first!,
            qualifiedFromRmd: 0,
            qcdOffsetConsumedWrite: 12_345,
            iraProRataWrite: hostileProRata,
          }],
        }
      }

      if (hostile.mode === 'unknownTarget') {
        const row = {
          ...first!,
          qcdOffsetConsumedWrite: 12_345,
          cashFlowWrites: [{
            ownerId: first!.ownerId,
            get target() {
              observe(input)
              return 'future-target'
            },
            value: 1,
          }],
        } as unknown as AnnualLegacyQcdOwnerCharacterRow
        hostile.armPublicationObserver?.()
        return { rows: [row] }
      }

      const readCounts = new Map<string, number>()
      const once = <T>(name: string, value: T): T => {
        const count = (readCounts.get(name) ?? 0) + 1
        readCounts.set(name, count)
        if (count > 1) throw new Error(`helper row field reread: ${name}`)
        return value
      }
      const write = (
        name: string,
        target: LegacyQcdCashFlowWrite['target'],
        value: number,
      ): LegacyQcdCashFlowWrite => ({
        get ownerId() { return once(`${name}.ownerId`, 'p1') },
        get target() { return once(`${name}.target`, target) },
        get value() { return once(`${name}.value`, value) },
      })
      const injectedWrites = [
        write('exclusionFromRmd', 'exclusionFromRmd', values.exclusionFromRmd),
        write('ordinaryFromRmd', 'ordinaryFromRmd', values.ordinaryFromRmd),
        write('exclusionBeyondRmd', 'exclusionBeyondRmd', values.exclusionBeyondRmd),
        write('ordinaryBeyondRmd', 'ordinaryBeyondRmd', values.ordinaryBeyondRmd),
      ]
      const injectedRow = {
        get ownerId() { return once('row.ownerId', 'p1') },
        get contradictoryOffsetLedger() {
          return once('row.contradictoryOffsetLedger', hostile.mode === 'warning')
        },
        get qualifiedFromRmd() {
          return once('row.qualifiedFromRmd', values.qualifiedFromRmd)
        },
        get nonQualifiedBeyondRmd() {
          return once('row.nonQualifiedBeyondRmd', values.nonQualifiedBeyondRmd)
        },
        get incomeOffsetDelta() {
          return once('row.incomeOffsetDelta', values.incomeOffsetDelta)
        },
        get nonQualifiedOrdinaryIncomeDelta() {
          return once(
            'row.nonQualifiedOrdinaryIncomeDelta',
            values.nonQualifiedOrdinaryIncomeDelta,
          )
        },
        get qcdOffsetConsumedWrite() {
          return once('row.qcdOffsetConsumedWrite', values.qcdOffsetConsumedWrite)
        },
        get iraProRataWrite() {
          return once('row.iraProRataWrite', exactProRataWrite)
        },
        get cashFlowWrites() {
          return once('row.cashFlowWrites', injectedWrites)
        },
      } as AnnualLegacyQcdOwnerCharacterRow
      hostile.sentinels[pass] = {
        injectedWrites,
        exactProRataWrite,
        readCounts,
        values,
      }
      return { rows: [injectedRow] }
    },
    {
      capture: (input): CharacterCapture => ({
        year: input.qcdOffsetConsumedByDonor.has('p1') ? 2027 : 2026,
        offsetAtCall: [...input.qcdOffsetConsumedByDonor],
        inputOwnerBalances: [...input.preDistributionAggregateIraBalance],
      }),
    },
  )
})

import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import {
  simulatePlan,
  type SimulateAnnualCounterfactualRequest,
} from './simulate.js'

function duplicateIra(balance: number, owner = 'p1', basis = 0): Account {
  const account = traditionalAccount('shared-ira', balance, owner, 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return {
    ...account,
    annualReturnPct: 0,
    nondeductibleBasis: basis,
  }
}

function normalPlan() {
  const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 90 })
  plan.accounts = [
    duplicateIra(265_000),
    duplicateIra(53_000),
    cashAccount('cash', 100_000),
  ]
  plan.strategies.qcdAnnual = 20_000
  return validatePlan(plan)
}

function reset(mode: Mode): void {
  hostile.mode = mode
  seam.reset()
  hostile.sentinels.length = 0
  hostile.splitProRataInputs.length = 0
  hostile.partialStateObservations.length = 0
  hostile.secondReadProRataIdentity = null
  hostile.secondReadProRataCounts.basis = 0
  hostile.secondReadProRataCounts.nontaxableFraction = 0
  hostile.armPublicationObserver = null
}

/** The sentinels the seam stashed for one recorded pass. */
function sentinelsOf(phase: CharacterPhase): CharacterSentinels {
  const sentinels = hostile.sentinels[phase.ordinal]
  if (sentinels === undefined) {
    throw new Error(`no sentinels recorded for seam pass ${phase.ordinal}`)
  }
  return sentinels
}

function runNormal() {
  reset('normal')
  const counterfactualReads: unknown[] = []
  const annualCounterfactual: SimulateAnnualCounterfactualRequest = {
    omitActionIds: [],
    taxUnitId: 'legacy-qcd-character-delegation-tax-unit',
    nonGroupTaxInputs: [{
      inputId: 'federalFilingStatus',
      value: { representation: 'declaredTerm', term: 'single' },
    }],
    capture: (reading) => { counterfactualReads.push(reading) },
  }
  const result = simulatePlan(normalPlan(), {
    startYear: 2026,
    horizonEndYear: 2027,
    taxCalculator: createFlatTaxCalculator(10),
    captureAnnualCashFlow: true,
    annualCounterfactual,
  })
  return { result, phases: [...seam.calls], counterfactualReads }
}

function cashTransfer(
  year: ReturnType<typeof runNormal>['result']['years'][number],
  id: string,
) {
  const transfer = year.cashFlow?.transferLines.find((line) => line.id === id)
  if (transfer === undefined) throw new Error(`missing transfer ${id}`)
  return transfer
}

describe('simulatePlan delegates grouped legacy QCD owner character', () => {
  it('applies every hostile channel across retries and rolls offset state back on re-entry', () => {
    const { result, phases, counterfactualReads } = runNormal()
    const calls2026 = phases.filter((phase) => phase.captured.year === 2026)
    const calls2027 = phases.filter((phase) => phase.captured.year === 2027)

    expect(calls2026.length).toBeGreaterThan(1)
    expect(calls2027.length).toBeGreaterThan(1)
    expect(counterfactualReads).toHaveLength(2)
    for (const phase of calls2026) {
      expect(phase.captured.offsetAtCall).toEqual([])
      expect(phase.captured.inputOwnerBalances).toEqual([['p1', 318_000]])
    }
    for (const phase of calls2027) {
      expect(phase.captured.offsetAtCall).toEqual([['p1', 12_345]])
    }
    expect(new Set(phases.map((phase) => phase.injected.rows))).toHaveLength(
      phases.length,
    )
    expect(new Set(phases.map((phase) => phase.injected.rows[0]))).toHaveLength(
      phases.length,
    )
    expect(new Set(phases.map((phase) => sentinelsOf(phase).injectedWrites)))
      .toHaveLength(phases.length)
    for (const phase of phases) {
      expect([...sentinelsOf(phase).readCounts.values()]
        .every((count) => count === 1)).toBe(true)
    }

    for (const year of result.years) {
      const committed = phases.find((phase) =>
        phase.captured.year === year.year &&
        hostile.splitProRataInputs.includes(sentinelsOf(phase).exactProRataWrite),
      )
      if (committed === undefined) {
        throw new Error(`no committed helper identity observed for ${year.year}`)
      }
      const values = sentinelsOf(committed).values
      const fromRmd = cashTransfer(
        year,
        'transfer:qualifiedCharitableDistribution:rmd:p1',
      )
      const beyond = cashTransfer(
        year,
        'transfer:qualifiedCharitableDistribution:beyondRmd:p1:shared-ira',
      )
      const nonQualifiedFromRmd =
        Math.max(0, year.rmd - values.qualifiedFromRmd)

      expect(fromRmd.taxCharacter).toEqual([
        {
          kind: 'qcdIncomeExclusion',
          amountPlanDollars: values.exclusionFromRmd,
        },
        {
          kind: 'nonQualifiedQcdOrdinaryIncome',
          amountPlanDollars: values.ordinaryFromRmd + nonQualifiedFromRmd,
        },
      ])
      expect(beyond.taxCharacter).toEqual([
        {
          kind: 'qcdIncomeExclusion',
          amountPlanDollars: values.exclusionBeyondRmd,
        },
        {
          kind: 'nonQualifiedQcdOrdinaryIncome',
          amountPlanDollars:
            values.ordinaryBeyondRmd + values.nonQualifiedBeyondRmd,
        },
      ])
      expect(year.qcd).toBe(20_000)
      expect(year.tax).toBe(year.magi * 0.1)
    }
  })

  it('left-folds three caller-consumed row deltas without regrouping', () => {
    reset('fp')
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 90 })
    const primary = plan.household.people[0]!
    plan.household.people.push(
      { ...primary, id: 'p2', name: 'Basis owner 2' },
      { ...primary, id: 'p3', name: 'Basis owner 3' },
    )
    plan.accounts = [
      duplicateIra(265_000),
      { ...duplicateIra(1, 'p2', 1), id: 'p2-basis' },
      { ...duplicateIra(1, 'p3', 1), id: 'p3-basis' },
      cashAccount('cash', 100_000),
    ]
    plan.strategies.qcdAnnual = 5_000
    const year = simulatePlan(plan as unknown as Plan, {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
    }).years[0]!
    const leftAssociated = ((0 + 10_000_000_000_000_000) + 1) + 1
    const regrouped = 10_000_000_000_000_000 + (1 + 1)

    expect(leftAssociated).not.toBe(regrouped)
    expect(year.magi).toBe(year.rmd + leftAssociated)
    expect(year.magi).not.toBe(year.rmd + regrouped)
  })

  it('uses the pre-read pro-rata snapshot while forwarding exact helper identity', () => {
    reset('proRataSecondRead')
    const result = simulatePlan(normalPlan(), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    })

    expect(result.years).toHaveLength(1)
    expect(hostile.secondReadProRataCounts).toEqual({
      basis: 1,
      nontaxableFraction: 1,
    })
    expect(hostile.partialStateObservations).toEqual([])
    expect(hostile.splitProRataInputs.some(
      (state) => state === hostile.secondReadProRataIdentity,
    )).toBe(true)
  })

  it('warns when contradictory recurring-QCD offset evidence fails closed', () => {
    reset('warning')
    const result = simulatePlan(normalPlan(), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    })

    expect(result.warnings.some((warning) =>
      warning.includes('recorded post-70½ deductible-contribution offset exceeds'),
    )).toBe(true)
  })

  it.each<FailureMode>([
    'rowGetter',
    'rowsIterator',
    'writesIterator',
    'proRataGetter',
    'unknownTarget',
  ])('fully reads hostile %s results before any QCD character mutation', (mode) => {
    reset(mode)
    const mapSetSpy = vi.spyOn(Map.prototype, 'set')
    hostile.armPublicationObserver = () => mapSetSpy.mockClear()
    try {
      expect(() => simulatePlan(normalPlan(), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFlatTaxCalculator(0),
        captureAnnualCashFlow: true,
      })).toThrow(/hostile|Unknown legacy QCD/u)
      expect(hostile.partialStateObservations.length).toBeGreaterThan(0)
      expect(hostile.partialStateObservations).toEqual(
        hostile.partialStateObservations.map(() => []),
      )
      expect(mapSetSpy).not.toHaveBeenCalled()
    } finally {
      hostile.armPublicationObserver = null
      mapSetSpy.mockRestore()
    }
  })

  it.each<ShapeMode>([
    'empty',
    'truncated',
    'reordered',
    'duplicate',
    'extra',
  ])('rejects %s owner rows before applying annual character', (mode) => {
    reset(mode)
    const plan = couplePlan({
      p1Dob: '1953-01-01',
      p2Dob: '1953-02-01',
      p1PlanningAge: 90,
      p2PlanningAge: 90,
    })
    plan.accounts = [
      { ...duplicateIra(265_000, 'p1'), id: 'p1-ira' },
      { ...duplicateIra(265_000, 'p2'), id: 'p2-ira' },
      cashAccount('cash', 100_000),
    ]
    plan.strategies.qcdAnnual = 20_000

    expect(() => simulatePlan(validatePlan(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    })).toThrow(/Legacy QCD owner-character row|lost cardinality/u)
  })
})

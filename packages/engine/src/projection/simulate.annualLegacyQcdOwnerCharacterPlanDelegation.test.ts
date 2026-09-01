/** Hostile delegation, materialization, and annual-pass rollback guards. */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualLegacyQcdOwnerCharacterPlanInput,
  AnnualLegacyQcdOwnerCharacterPlanResult,
  AnnualLegacyQcdOwnerCharacterRow,
  LegacyQcdCashFlowWrite,
} from './internal/annualLegacyQcdOwnerCharacterPlan.js'
import type { IraProRataYear } from '../strategies/iraBasis.js'

type FailureMode =
  | 'rowGetter'
  | 'rowsIterator'
  | 'writesIterator'
  | 'proRataGetter'
  | 'unknownTarget'
type ShapeMode = 'empty' | 'truncated' | 'reordered' | 'duplicate' | 'extra'
type Mode = 'normal' | 'fp' | 'proRataSecondRead' | FailureMode | ShapeMode

interface Phase {
  readonly year: number
  readonly offsetAtCall: readonly (readonly [string, number])[]
  readonly inputOwnerBalances: readonly (readonly [string, number])[]
  readonly injectedRows: object
  readonly injectedRow: object
  readonly injectedWrites: object
  readonly exactProRataWrite: IraProRataYear | null
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

const seam = vi.hoisted(() => ({
  mode: 'normal' as Mode,
  phases: [] as Phase[],
  splitProRataInputs: [] as IraProRataYear[],
  partialStateObservations: [] as (readonly (readonly [string, number])[])[],
  secondReadProRataIdentity: null as IraProRataYear | null,
  secondReadProRataCounts: { basis: 0, nontaxableFraction: 0 },
}))

vi.mock('../strategies/iraBasis.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../strategies/iraBasis.js')>()
  return {
    ...original,
    splitIraDistribution: (
      state: IraProRataYear,
      amount: number,
      readState?: IraProRataYear,
    ) => {
      seam.splitProRataInputs.push(state)
      return original.splitIraDistribution(state, amount, readState)
    },
  }
})

vi.mock('./internal/annualLegacyQcdOwnerCharacterPlan.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualLegacyQcdOwnerCharacterPlan.js')
  >()

  function observe(input: AnnualLegacyQcdOwnerCharacterPlanInput): void {
    seam.partialStateObservations.push([...input.qcdOffsetConsumedByDonor])
  }

  function shapeRow(
    row: AnnualLegacyQcdOwnerCharacterRow,
    ownerId: string,
  ): AnnualLegacyQcdOwnerCharacterRow {
    return { ...row, ownerId, qcdOffsetConsumedWrite: 12_345 }
  }

  return {
    ...original,
    annualLegacyQcdOwnerCharacterPlan: (
      input: AnnualLegacyQcdOwnerCharacterPlanInput,
    ): AnnualLegacyQcdOwnerCharacterPlanResult => {
      const natural = original.annualLegacyQcdOwnerCharacterPlan(input)
      const first = natural.rows[0]
      if (first === undefined && seam.mode !== 'empty') {
        throw new Error('expected at least one QCD owner row')
      }

      if (seam.mode === 'fp') {
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

      if (seam.mode === 'empty') return { rows: [] }
      if (seam.mode === 'truncated') return { rows: [natural.rows[0]!] }
      if (seam.mode === 'reordered') {
        return { rows: [natural.rows[1]!, natural.rows[0]!] }
      }
      if (seam.mode === 'duplicate') {
        return {
          rows: [natural.rows[0]!, shapeRow(natural.rows[1]!, natural.rows[0]!.ownerId)],
        }
      }
      if (seam.mode === 'extra') {
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

      if (seam.mode === 'rowsIterator') {
        const row = { ...first!, qcdOffsetConsumedWrite: 12_345 }
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

      if (seam.mode === 'writesIterator') {
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
        return { rows: [row] }
      }

      if (seam.mode === 'rowGetter') {
        const row = {
          ...first!,
          qcdOffsetConsumedWrite: 12_345,
          get nonQualifiedOrdinaryIncomeDelta(): number {
            observe(input)
            throw new Error('hostile row getter')
          },
        }
        return { rows: [row] }
      }

      if (seam.mode === 'proRataGetter') {
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
        return { rows: [row] }
      }

      if (seam.mode === 'proRataSecondRead') {
        const hostileProRata: IraProRataYear = {
          get basis(): number {
            seam.secondReadProRataCounts.basis += 1
            if (seam.secondReadProRataCounts.basis > 1) {
              observe(input)
              throw new Error('hostile second pro-rata basis read')
            }
            return 0
          },
          get nontaxableFraction(): number {
            seam.secondReadProRataCounts.nontaxableFraction += 1
            if (seam.secondReadProRataCounts.nontaxableFraction > 1) {
              observe(input)
              throw new Error('hostile second pro-rata fraction read')
            }
            return 0
          },
        }
        seam.secondReadProRataIdentity = hostileProRata
        return {
          rows: [{
            ...first!,
            qualifiedFromRmd: 0,
            qcdOffsetConsumedWrite: 12_345,
            iraProRataWrite: hostileProRata,
          }],
        }
      }

      if (seam.mode === 'unknownTarget') {
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
      const injectedRows = [injectedRow]
      seam.phases.push({
        year: 2026 + ordinal,
        offsetAtCall: [...input.qcdOffsetConsumedByDonor],
        inputOwnerBalances: [...input.preDistributionAggregateIraBalance],
        injectedRows,
        injectedRow,
        injectedWrites,
        exactProRataWrite,
        readCounts,
        values,
      })
      return { rows: injectedRows }
    },
  }
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
  seam.mode = mode
  seam.phases.length = 0
  seam.splitProRataInputs.length = 0
  seam.partialStateObservations.length = 0
  seam.secondReadProRataIdentity = null
  seam.secondReadProRataCounts.basis = 0
  seam.secondReadProRataCounts.nontaxableFraction = 0
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
  return { result, phases: [...seam.phases], counterfactualReads }
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
    const calls2026 = phases.filter((phase) => phase.year === 2026)
    const calls2027 = phases.filter((phase) => phase.year === 2027)

    expect(calls2026.length).toBeGreaterThan(1)
    expect(calls2027.length).toBeGreaterThan(1)
    expect(counterfactualReads).toHaveLength(2)
    for (const phase of calls2026) {
      expect(phase.offsetAtCall).toEqual([])
      expect(phase.inputOwnerBalances).toEqual([['p1', 318_000]])
    }
    for (const phase of calls2027) {
      expect(phase.offsetAtCall).toEqual([['p1', 12_345]])
    }
    expect(new Set(phases.map((phase) => phase.injectedRows))).toHaveLength(
      phases.length,
    )
    expect(new Set(phases.map((phase) => phase.injectedRow))).toHaveLength(
      phases.length,
    )
    expect(new Set(phases.map((phase) => phase.injectedWrites))).toHaveLength(
      phases.length,
    )
    for (const phase of phases) {
      expect([...phase.readCounts.values()].every((count) => count === 1)).toBe(true)
    }

    for (const year of result.years) {
      const committed = phases.find((phase) =>
        phase.year === year.year &&
        seam.splitProRataInputs.includes(phase.exactProRataWrite!),
      )
      if (committed === undefined) {
        throw new Error(`no committed helper identity observed for ${year.year}`)
      }
      const values = committed.values
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
    expect(seam.secondReadProRataCounts).toEqual({
      basis: 1,
      nontaxableFraction: 1,
    })
    expect(seam.partialStateObservations).toEqual([])
    expect(seam.splitProRataInputs.some(
      (state) => state === seam.secondReadProRataIdentity,
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
    expect(() => simulatePlan(normalPlan(), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    })).toThrow(/hostile|Unknown legacy QCD/u)
    expect(seam.partialStateObservations.length).toBeGreaterThan(0)
    expect(seam.partialStateObservations).toEqual(
      seam.partialStateObservations.map(() => []),
    )
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

import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
} from './identity.js'
import {
  asUsdCents,
  positiveUsdCentsSchema,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import { deepFreeze } from './freeze.js'
import { compareUtf16CodeUnits } from './structuralId.js'

export type AnnualIraBasisAllocationScope =
  | 'form8606Line7Distributions'
  | 'form8606Line8NetConversions'

export interface ExactAnnualIraBasisRatio {
  representation: 'exactMinorUnitRational'
  numeratorMinorUnits: UsdCents
  denominatorMinorUnits: PositiveUsdCents
  intermediateArithmetic: 'bigintRational'
}

export interface NotApplicableAnnualIraBasisRatio {
  representation: 'notApplicableZeroDenominator'
  numeratorMinorUnits: 0
  denominatorMinorUnits: 0
  intermediateArithmetic: 'notApplicable'
}

export type AnnualIraBasisRatio =
  | ExactAnnualIraBasisRatio
  | NotApplicableAnnualIraBasisRatio

export interface AnnualIraBasisAllocationEntryInput {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  scheduledDate: string | null
  scheduledSequence: number
  grossAmount: UsdCents
}

export interface AllocateAnnualIraBasisInput {
  poolId: string
  taxYear: number
  calculationScope: AnnualIraBasisAllocationScope
  annualBasisRatio: Readonly<AnnualIraBasisRatio>
  annualGrossAmount: UsdCents
  entries: readonly Readonly<AnnualIraBasisAllocationEntryInput>[]
}

interface AnnualIraBasisAllocationEntryBase {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  scheduledDate: string | null
  scheduledSequence: number
  grossAmount: PositiveUsdCents
  baseFloorBasisMinorUnits: UsdCents
  allocatedBasisAmount: UsdCents
  taxableAmount: UsdCents
}

export type AnnualIraBasisAllocationEntry =
  AnnualIraBasisAllocationEntryBase &
    (
      | {
          fractionalBasisRemainderNumerator: 0
          residualCentEligible: false
          residualCentAwarded: 0
        }
      | {
          fractionalBasisRemainderNumerator: PositiveUsdCents
          residualCentEligible: true
          residualCentAwarded: 0 | 1
        }
    )

interface AnnualIraBasisAllocationEvidenceBase {
  poolId: string
  taxYear: number
  calculationScope: AnnualIraBasisAllocationScope
  annualBasisRatio: Readonly<AnnualIraBasisRatio>
  annualBasisQuantization: 'nearestCentHalfUp'
  residualAllocationOrder:
    'scheduledDateThenSequenceThenActionIdThenAllocationId'
  allocationEvidenceId: string
}

export type AnnualIraBasisAllocationEvidence =
  AnnualIraBasisAllocationEvidenceBase &
    (
      | {
          annualGrossAmount: 0
          annualNontaxableBasisAmount: 0
          annualTaxableAmount: 0
          allocations: readonly []
        }
      | {
          annualGrossAmount: PositiveUsdCents
          annualNontaxableBasisAmount: UsdCents
          annualTaxableAmount: UsdCents
          annualBasisRatio: Readonly<ExactAnnualIraBasisRatio>
          allocations: readonly [
            Readonly<AnnualIraBasisAllocationEntry>,
            ...Readonly<AnnualIraBasisAllocationEntry>[],
          ]
        }
    )

function nonblankId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a nonblank stable identifier`)
  }
  return value
}

function centsFromBigInt(value: bigint): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Annual IRA basis arithmetic exceeded the safe-integer range')
  }
  return asUsdCents(Number(value))
}

function exactHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  return quotient + (remainder * 2n >= denominator ? 1n : 0n)
}

function stableId(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}:${JSON.stringify(parts)}`
}

type ValidatedEntry = AnnualIraBasisAllocationEntryInput & {
  chronologyKey: string
}

function validateRatio(ratio: Readonly<AnnualIraBasisRatio>): AnnualIraBasisRatio {
  if (
    ratio.representation !== 'exactMinorUnitRational' &&
    ratio.representation !== 'notApplicableZeroDenominator'
  ) {
    throw new RangeError('Annual IRA basis ratio representation is unsupported')
  }
  const numeratorMinorUnits = usdCentsSchema.parse(ratio.numeratorMinorUnits)
  if (ratio.representation === 'notApplicableZeroDenominator') {
    if (
      numeratorMinorUnits !== 0 ||
      ratio.denominatorMinorUnits !== 0 ||
      ratio.intermediateArithmetic !== 'notApplicable'
    ) {
      throw new RangeError(
        'A not-applicable annual IRA ratio requires literal zero numerator and denominator',
      )
    }
    return {
      representation: ratio.representation,
      numeratorMinorUnits: 0,
      denominatorMinorUnits: 0,
      intermediateArithmetic: 'notApplicable',
    }
  }

  const denominatorMinorUnits = positiveUsdCentsSchema.parse(
    ratio.denominatorMinorUnits,
  )
  if (
    ratio.intermediateArithmetic !== 'bigintRational' ||
    numeratorMinorUnits > denominatorMinorUnits
  ) {
    throw new RangeError(
      'An exact annual IRA basis ratio requires 0 <= numerator <= denominator',
    )
  }
  return {
    representation: ratio.representation,
    numeratorMinorUnits,
    denominatorMinorUnits,
    intermediateArithmetic: 'bigintRational',
  }
}

function validateEntry(
  entry: Readonly<AnnualIraBasisAllocationEntryInput>,
  taxYear: number,
): ValidatedEntry {
  const actionId = actionIdSchema.parse(entry.actionId)
  const allocationId = allocationIdSchema.parse(entry.allocationId)
  const sourceAccountId = accountIdSchema.parse(entry.sourceAccountId)
  const grossAmount = usdCentsSchema.parse(entry.grossAmount)
  if (
    !Number.isSafeInteger(entry.scheduledSequence) ||
    entry.scheduledSequence <= 0
  ) {
    throw new RangeError('Annual IRA allocation sequence must be a positive safe integer')
  }

  let chronologyKey: string
  if (entry.scheduledDate === null) {
    chronologyKey = `${String(taxYear).padStart(4, '0')}-12-31|1`
  } else {
    const parsed = parseCivilIsoDate(entry.scheduledDate)
    if (
      parsed === null ||
      parsed.year !== taxYear ||
      formatCivilDate(parsed) !== entry.scheduledDate
    ) {
      throw new RangeError(
        'Annual IRA allocation date must be a canonical civil date in the tax year',
      )
    }
    chronologyKey = `${entry.scheduledDate}|0`
  }

  return {
    actionId,
    allocationId,
    sourceAccountId,
    scheduledDate: entry.scheduledDate,
    scheduledSequence: entry.scheduledSequence,
    grossAmount,
    chronologyKey,
  }
}

function compareEntries(left: ValidatedEntry, right: ValidatedEntry): number {
  return (
    compareUtf16CodeUnits(left.chronologyKey, right.chronologyKey) ||
    left.scheduledSequence - right.scheduledSequence ||
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId)
  )
}

/**
 * Allocates one already-established annual Form 8606 basis ratio across one
 * complete line total. It rounds the annual nontaxable amount exactly once,
 * then assigns residual cents canonically. It never moves money or mutates
 * basis.
 */
function allocateAnnualIraBasisInternal(
  input: Readonly<AllocateAnnualIraBasisInput>,
): Readonly<AnnualIraBasisAllocationEvidence> {
  const poolId = nonblankId(input.poolId, 'Annual IRA pool ID')
  if (
    !Number.isSafeInteger(input.taxYear) ||
    input.taxYear < 1 ||
    input.taxYear > 9999
  ) {
    throw new RangeError('Annual IRA allocation tax year must be a four-digit year')
  }
  if (
    input.calculationScope !== 'form8606Line7Distributions' &&
    input.calculationScope !== 'form8606Line8NetConversions'
  ) {
    throw new RangeError('Annual IRA allocation scope is unsupported')
  }
  const ratio = validateRatio(input.annualBasisRatio)
  const annualGrossAmount = usdCentsSchema.parse(input.annualGrossAmount)
  const entries = input.entries
    .map((entry) => validateEntry(entry, input.taxYear))
    .sort(compareEntries)

  const identities = new Set<string>()
  const scheduleBySlot = new Map<string, ActionId>()
  const scheduleByAction = new Map<ActionId, string>()
  for (const entry of entries) {
    const identity = JSON.stringify([entry.actionId, entry.allocationId])
    if (identities.has(identity)) {
      throw new RangeError('Annual IRA allocation identities must be unique')
    }
    identities.add(identity)

    const slot = JSON.stringify([
      entry.scheduledDate,
      entry.scheduledSequence,
    ])
    const existingActionSlot = scheduleByAction.get(entry.actionId)
    if (existingActionSlot !== undefined && existingActionSlot !== slot) {
      throw new RangeError(
        'Every allocation from one annual IRA action must share its schedule position',
      )
    }
    scheduleByAction.set(entry.actionId, slot)
    const scheduledAction = scheduleBySlot.get(slot)
    if (scheduledAction !== undefined && scheduledAction !== entry.actionId) {
      throw new RangeError(
        'Different annual IRA actions cannot occupy the same schedule position',
      )
    }
    scheduleBySlot.set(slot, entry.actionId)
  }

  const entryGrossTotal = entries.reduce(
    (total, entry) => total + BigInt(entry.grossAmount),
    0n,
  )
  if (entryGrossTotal !== BigInt(annualGrossAmount)) {
    throw new RangeError(
      'Annual IRA allocation entries must exactly equal the bound annual gross',
    )
  }

  if (annualGrossAmount === 0) {
    const evidence: AnnualIraBasisAllocationEvidence = {
      poolId,
      taxYear: input.taxYear,
      calculationScope: input.calculationScope,
      annualBasisRatio: ratio,
      annualGrossAmount: 0,
      annualNontaxableBasisAmount: 0,
      annualTaxableAmount: 0,
      annualBasisQuantization: 'nearestCentHalfUp',
      residualAllocationOrder:
        'scheduledDateThenSequenceThenActionIdThenAllocationId',
      allocations: [],
      allocationEvidenceId: stableId('annual-ira-basis-allocation', [
        input.calculationScope,
        poolId,
        input.taxYear,
        ratio,
        annualGrossAmount,
        [],
      ]),
    }
    return deepFreeze(evidence)
  }
  if (ratio.representation === 'notApplicableZeroDenominator') {
    throw new RangeError(
      'A zero-denominator annual IRA ratio cannot allocate positive gross',
    )
  }

  const numerator = BigInt(ratio.numeratorMinorUnits)
  const denominator = BigInt(ratio.denominatorMinorUnits)
  const annualNontaxable = exactHalfUp(
    BigInt(annualGrossAmount) * numerator,
    denominator,
  )

  const positive = entries.filter((entry) => entry.grossAmount > 0)
  const preliminary = positive.map((entry) => {
    const product = BigInt(entry.grossAmount) * numerator
    return {
      entry,
      floor: product / denominator,
      remainder: product % denominator,
    }
  })
  const floorTotal = preliminary.reduce((total, entry) => total + entry.floor, 0n)
  const residualCount = annualNontaxable - floorTotal
  const eligible = preliminary.filter((entry) => entry.remainder > 0n)
  if (
    residualCount < 0n ||
    residualCount > BigInt(eligible.length)
  ) {
    throw new Error('Annual IRA residual-cent allocation is mathematically inconsistent')
  }
  const awardedIdentities = new Set(
    eligible
      .slice(0, Number(residualCount))
      .map(({ entry }) => JSON.stringify([entry.actionId, entry.allocationId])),
  )

  const allocatedEntries: AnnualIraBasisAllocationEntry[] = preliminary.map(
    ({ entry, floor, remainder }) => {
      const identity = JSON.stringify([entry.actionId, entry.allocationId])
      const residualCentAwarded = awardedIdentities.has(identity) ? 1 : 0
      const allocatedBasisAmount = centsFromBigInt(
        floor + BigInt(residualCentAwarded),
      )
      const base = {
        actionId: entry.actionId,
        allocationId: entry.allocationId,
        sourceAccountId: entry.sourceAccountId,
        scheduledDate: entry.scheduledDate,
        scheduledSequence: entry.scheduledSequence,
        grossAmount: positiveUsdCentsSchema.parse(entry.grossAmount),
        baseFloorBasisMinorUnits: centsFromBigInt(floor),
        allocatedBasisAmount,
        taxableAmount: asUsdCents(entry.grossAmount - allocatedBasisAmount),
      }
      return remainder === 0n
        ? {
            ...base,
            fractionalBasisRemainderNumerator: 0,
            residualCentEligible: false,
            residualCentAwarded: 0,
          }
        : {
            ...base,
            fractionalBasisRemainderNumerator: positiveUsdCentsSchema.parse(
              centsFromBigInt(remainder),
            ),
            residualCentEligible: true,
            residualCentAwarded,
          }
    },
  )

  const allocatedTotal = allocatedEntries.reduce(
    (total, entry) => total + BigInt(entry.allocatedBasisAmount),
    0n,
  )
  if (allocatedTotal !== annualNontaxable) {
    throw new Error('Annual IRA allocated basis does not equal its once-rounded total')
  }

  const annualNontaxableBasisAmount = centsFromBigInt(annualNontaxable)
  const annualTaxableAmount = centsFromBigInt(
    BigInt(annualGrossAmount) - annualNontaxable,
  )
  const evidenceIdParts = [
    input.calculationScope,
    poolId,
    input.taxYear,
    ratio,
    annualGrossAmount,
    allocatedEntries,
  ] as const
  return deepFreeze({
    poolId,
    taxYear: input.taxYear,
    calculationScope: input.calculationScope,
    annualBasisRatio: ratio,
    annualGrossAmount: positiveUsdCentsSchema.parse(annualGrossAmount),
    annualNontaxableBasisAmount,
    annualTaxableAmount,
    annualBasisQuantization: 'nearestCentHalfUp',
    residualAllocationOrder:
      'scheduledDateThenSequenceThenActionIdThenAllocationId',
    allocations: allocatedEntries as [
      AnnualIraBasisAllocationEntry,
      ...AnnualIraBasisAllocationEntry[],
    ],
    allocationEvidenceId: stableId(
      'annual-ira-basis-allocation',
      evidenceIdParts,
    ),
  })
}

export function allocateAnnualIraBasis(
  input: Readonly<AllocateAnnualIraBasisInput>,
): Readonly<AnnualIraBasisAllocationEvidence> {
  return allocateAnnualIraBasisInternal(input)
}

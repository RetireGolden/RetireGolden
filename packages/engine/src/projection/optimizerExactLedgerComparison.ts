import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import type { Plan } from '../model/plan.js'
import type { ProjectionResult } from './types.js'

export type SafeMinorUnitInteger = number

export type OptimizerExactLedgerComparisonKey =
  | Readonly<{
      kind: 'annualTaxTotal'
      taxYear: number
      field: 'tax' | 'penalties'
    }>
  | Readonly<{
      kind: 'annualBalanceTotal'
      taxYear: number
      field: 'investableTotal' | 'netWorth'
    }>
  | Readonly<{
      kind: 'accountEndingBalance'
      taxYear: number
      accountId: string
    }>
  | Readonly<{
      kind: 'projectionEndingTotal'
      taxYear: number
      field:
        | 'endingInvestable'
        | 'endingNetWorth'
        | 'endingNondeductibleIraBasis'
    }>

export interface OptimizerExactLedgerComparisonEntry {
  readonly key: OptimizerExactLedgerComparisonKey
  readonly aggregateMinorUnits: SafeMinorUnitInteger
  readonly allocatedMinorUnits: SafeMinorUnitInteger
}

export interface OptimizerExactLedgerComparisonHorizon {
  readonly startYear: number
  readonly endYear: number
  readonly taxYears: readonly [number, ...number[]]
}

export interface OptimizerExactLedgerComparisonEvidence {
  readonly currencyMinorUnit: 0.01
  readonly quantization: 'nearestCentHalfUp'
  readonly equality: 'exactMinorUnitByRequiredKey'
  readonly aggregateHorizon: Readonly<OptimizerExactLedgerComparisonHorizon>
  readonly allocatedHorizon: Readonly<OptimizerExactLedgerComparisonHorizon>
  readonly evaluatedTaxYears: readonly number[]
  readonly evaluatedAccountIds: readonly string[]
  readonly entries: readonly Readonly<OptimizerExactLedgerComparisonEntry>[]
}

const annualTaxFields = ['tax', 'penalties'] as const
const annualBalanceFields = ['investableTotal', 'netWorth'] as const
const endingFields = [
  'endingInvestable',
  'endingNetWorth',
  'endingNondeductibleIraBasis',
] as const

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function safeTaxYear(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1
}

function quantize(value: unknown, signed: boolean): SafeMinorUnitInteger {
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      (!signed && value < 0)) {
    throw new TypeError('Exact-ledger comparison amount is outside its supported domain')
  }
  if (value === 0) return 0
  const magnitude = planDollarsToLedgerCents(Math.abs(value))
  if (magnitude === 0) return 0
  return value < 0 ? -magnitude : magnitude
}

interface DecimalTerm {
  readonly coefficient: bigint
  readonly scale: number
}

function decimalTerm(value: number): DecimalTerm {
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value))
  if (match === null) {
    throw new TypeError('Exact-ledger balance has no supported decimal spelling')
  }
  const fraction = match[2] ?? ''
  return {
    coefficient: BigInt(`${match[1]}${fraction}`),
    scale: fraction.length - Number(match[3] ?? 0),
  }
}

/**
 * Sum nonnegative published dollar values as exact decimal spellings, then
 * quantize the aggregate once. This avoids imposing JavaScript enumeration or
 * floating-addition order on a necessary aggregate bound.
 */
function quantizeDecimalSum(values: readonly number[]): SafeMinorUnitInteger {
  const terms = values.map(decimalTerm)
  let scale = 0
  for (const term of terms) scale = Math.max(scale, term.scale)
  const coefficient = terms.reduce(
    (sum, term) => sum + term.coefficient * 10n ** BigInt(scale - term.scale),
    0n,
  )
  const centScale = scale - 2
  let cents: bigint
  if (centScale <= 0) {
    cents = coefficient * 10n ** BigInt(-centScale)
  } else {
    const divisor = 10n ** BigInt(centScale)
    const quotient = coefficient / divisor
    const remainder = coefficient % divisor
    cents = quotient + (remainder * 2n >= divisor ? 1n : 0n)
  }
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    // This value is used only as an upper bound for a separately validated
    // safe-integer ending basis. Any larger exact sum proves that every
    // representable basis is within the bound; saturating avoids rejecting a
    // valid projection merely because several individually safe balances sum
    // beyond the serialized minor-unit domain.
    return Number.MAX_SAFE_INTEGER
  }
  return Number(cents)
}

/**
 * Bound the simulator's aggregate IRA basis without rejecting a valid result
 * solely because binary addition rounded an owner-grouped balance sum above
 * the exact-decimal sum. Within the supported safe-cent domain, each binary
 * addition can round upward by less than one cent, so n nonnegative balances
 * need at most n - 1 additional cents regardless of grouping or order. This is
 * only a conservative source-validity upper bound; ledger equality remains an
 * exact safe-integer-cent comparison below.
 */
function ownedIraBalanceUpperBound(values: readonly number[]): SafeMinorUnitInteger {
  const exact = quantizeDecimalSum(values)
  if (exact === Number.MAX_SAFE_INTEGER) return exact
  return Math.min(
    Number.MAX_SAFE_INTEGER,
    exact + Math.max(0, values.length - 1),
  )
}

function ownDataProperty(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') {
    throw new TypeError('Exact-ledger source must be a data object')
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (descriptor === undefined || !descriptor.enumerable ||
      !Object.hasOwn(descriptor, 'value')) {
    throw new TypeError(`Exact-ledger source property ${key} must be own enumerable data`)
  }
  return descriptor.value
}

function arrayDataValues(value: unknown): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new TypeError('Exact-ledger years must be a plain array')
  }
  const length = Object.getOwnPropertyDescriptor(value, 'length')?.value
  if (!Number.isSafeInteger(length) || length < 0 ||
      Reflect.ownKeys(value).length !== length + 1) {
    throw new TypeError('Exact-ledger years must be a dense plain array')
  }
  const values: unknown[] = []
  for (let index = 0; index < length; index += 1) {
    values.push(ownDataProperty(value, String(index)))
  }
  return values
}

interface BalanceSnapshot {
  readonly minorUnits: ReadonlyMap<string, SafeMinorUnitInteger>
  readonly rawDollars: ReadonlyMap<string, number>
}

function balanceSnapshot(value: unknown): BalanceSnapshot {
  const balances = value
  if (balances === null || typeof balances !== 'object' || Array.isArray(balances)) {
    throw new TypeError('Every exact-ledger year must publish a balance map')
  }
  const prototype = Object.getPrototypeOf(balances)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Exact-ledger balances must be a plain record')
  }
  const snapshot = new Map<string, SafeMinorUnitInteger>()
  const rawDollars = new Map<string, number>()
  for (const key of Reflect.ownKeys(balances)) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new TypeError('Exact-ledger balance keys must be nonempty Plan account IDs')
    }
    const descriptor = Object.getOwnPropertyDescriptor(balances, key)
    if (descriptor === undefined || !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value') ||
        typeof descriptor.value !== 'number' ||
        !Number.isFinite(descriptor.value) || descriptor.value < 0) {
      throw new TypeError('Exact-ledger balances must be enumerable data properties')
    }
    snapshot.set(key, quantize(descriptor.value, false))
    rawDollars.set(key, descriptor.value)
  }
  return { minorUnits: snapshot, rawDollars }
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

interface ExpectedPublishedBalanceIds {
  readonly all: readonly string[]
  readonly investable: readonly string[]
  readonly ownedNonRothIras: readonly string[]
}

function expectedPublishedBalanceIds(
  plan: Readonly<Pick<Plan, 'accounts' | 'insurance'>>,
): ExpectedPublishedBalanceIds {
  const ids: string[] = []
  const investableIds: string[] = []
  const ownedNonRothIraIds: string[] = []
  for (const account of plan.accounts) {
    if (account.type === 'pension' || account.type === 'annuity') continue
    ids.push(account.id)
    if (account.type !== 'property' && account.type !== 'debt') {
      investableIds.push(account.id)
    }
    if (account.type === 'traditional' && account.kind === 'ira' &&
        account.inherited === undefined) {
      ownedNonRothIraIds.push(account.id)
    }
  }
  for (const policy of plan.insurance) {
    if (policy.kind === 'permanentLife') ids.push(policy.id)
  }
  if (ids.some((id) => typeof id !== 'string' || id.length === 0) ||
      new Set(ids).size !== ids.length) {
    throw new TypeError('Plan balance identities must be nonempty and globally unique')
  }
  return {
    all: ids.sort(compareUtf16CodeUnits),
    investable: investableIds.sort(compareUtf16CodeUnits),
    ownedNonRothIras: ownedNonRothIraIds.sort(compareUtf16CodeUnits),
  }
}

interface YearSnapshot {
  readonly taxYear: number
  readonly tax: SafeMinorUnitInteger
  readonly penalties: SafeMinorUnitInteger
  readonly investableTotal: SafeMinorUnitInteger
  readonly netWorth: SafeMinorUnitInteger
  readonly balances: ReadonlyMap<string, SafeMinorUnitInteger>
  readonly rawBalances: ReadonlyMap<string, number>
}

interface ResultSnapshot {
  readonly horizon: OptimizerExactLedgerComparisonHorizon
  readonly years: ReadonlyMap<number, Readonly<YearSnapshot>>
  readonly accountIds: readonly string[]
  readonly endingInvestable: SafeMinorUnitInteger
  readonly endingNetWorth: SafeMinorUnitInteger
  readonly endingNondeductibleIraBasis: SafeMinorUnitInteger
}

function sourceSnapshot(result: Readonly<ProjectionResult>): ResultSnapshot {
  const startYear = ownDataProperty(result, 'startYear')
  const endYear = ownDataProperty(result, 'endYear')
  const rawYears = arrayDataValues(ownDataProperty(result, 'years'))
  if (!safeTaxYear(startYear) || !safeTaxYear(endYear) || startYear > endYear ||
      rawYears.length === 0) throw new TypeError('Invalid exact-ledger horizon')

  const taxYears: number[] = []
  const years = new Map<number, Readonly<YearSnapshot>>()
  const accountIds = new Set<string>()
  let prior = 0
  for (const rawYear of rawYears) {
    const taxYear = ownDataProperty(rawYear, 'year')
    if (!safeTaxYear(taxYear) ||
        (taxYears.length > 0 && taxYear !== prior + 1)) {
      throw new TypeError('Exact-ledger years must be unique, contiguous, and strictly increasing')
    }
    const balanceValues = balanceSnapshot(ownDataProperty(rawYear, 'balances'))
    for (const accountId of balanceValues.minorUnits.keys()) accountIds.add(accountId)
    years.set(taxYear, {
      taxYear,
      tax: quantize(ownDataProperty(rawYear, 'tax'), false),
      penalties: quantize(ownDataProperty(rawYear, 'penalties'), false),
      investableTotal: quantize(ownDataProperty(rawYear, 'investableTotal'), false),
      netWorth: quantize(ownDataProperty(rawYear, 'netWorth'), true),
      balances: balanceValues.minorUnits,
      rawBalances: balanceValues.rawDollars,
    })
    taxYears.push(taxYear)
    prior = taxYear
  }
  if (taxYears[0] !== startYear || taxYears.at(-1) !== endYear) {
    throw new TypeError('Exact-ledger years do not match the horizon boundaries')
  }
  const endingInvestable = quantize(
    ownDataProperty(result, 'endingInvestable'), false,
  )
  const endingNetWorth = quantize(
    ownDataProperty(result, 'endingNetWorth'), true,
  )
  const endingNondeductibleIraBasis = quantize(
    ownDataProperty(result, 'endingNondeductibleIraBasis'), false,
  )
  const finalYear = years.get(endYear)!
  if (endingInvestable !== finalYear.investableTotal ||
      endingNetWorth !== finalYear.netWorth) {
    throw new TypeError('Exact-ledger ending totals violate projection invariants')
  }
  return {
    horizon: { startYear, endYear, taxYears: taxYears as [number, ...number[]] },
    years,
    accountIds: [...accountIds],
    endingInvestable,
    endingNetWorth,
    endingNondeductibleIraBasis,
  }
}

function amountFor(
  result: Readonly<ResultSnapshot>,
  key: OptimizerExactLedgerComparisonKey,
): SafeMinorUnitInteger {
  if (key.kind === 'projectionEndingTotal') {
    return result[key.field]
  }
  const year = result.years.get(key.taxYear)
  if (year === undefined) throw new TypeError('Required exact-ledger year is absent')
  if (key.kind === 'accountEndingBalance') {
    const amount = year.balances.get(key.accountId)
    if (amount === undefined) {
      throw new TypeError('Required exact-ledger account is absent')
    }
    return amount
  }
  return year[key.field]
}

/**
 * Compare an aggregate optimizer projection with its identity-allocated exact
 * ledger result. Any malformed, incomplete, unsafe, or unequal input fails
 * closed with null; only complete invariant-7 evidence is returned.
 */
export function compareOptimizerExactLedgerResults(
  aggregateResult: Readonly<ProjectionResult>,
  allocatedResult: Readonly<ProjectionResult>,
  plan: Readonly<Pick<Plan, 'accounts' | 'insurance'>>,
): Readonly<OptimizerExactLedgerComparisonEvidence> | null {
  try {
    const aggregate = sourceSnapshot(aggregateResult)
    const allocated = sourceSnapshot(allocatedResult)
    if (aggregate.horizon.startYear !== allocated.horizon.startYear ||
        aggregate.horizon.endYear !== allocated.horizon.endYear ||
        !sameNumbers(aggregate.horizon.taxYears, allocated.horizon.taxYears)) return null

    const evaluatedAccountIds = [...new Set([
      ...aggregate.accountIds,
      ...allocated.accountIds,
    ])].sort(compareUtf16CodeUnits)
    const expectedAccountIds = expectedPublishedBalanceIds(plan)
    if (evaluatedAccountIds.length !== expectedAccountIds.all.length ||
        evaluatedAccountIds.some((accountId, index) =>
          accountId !== expectedAccountIds.all[index])) return null
    for (const taxYear of aggregate.horizon.taxYears) {
      const aggregateYear = aggregate.years.get(taxYear)!
      const allocatedYear = allocated.years.get(taxYear)!
      const aggregateBalances = aggregateYear.balances
      const allocatedBalances = allocatedYear.balances
      if (evaluatedAccountIds.some((accountId) =>
        !aggregateBalances.has(accountId) ||
        !allocatedBalances.has(accountId))) return null
      if (expectedAccountIds.investable.some((accountId) =>
        aggregateBalances.get(accountId)! > aggregateYear.investableTotal ||
        allocatedBalances.get(accountId)! > allocatedYear.investableTotal)) return null
    }
    const aggregateEndingYear = aggregate.years.get(aggregate.horizon.endYear)!
    const allocatedEndingYear = allocated.years.get(allocated.horizon.endYear)!
    const aggregateEndingIraBalance = ownedIraBalanceUpperBound(
      expectedAccountIds.ownedNonRothIras.map((accountId) =>
        aggregateEndingYear.rawBalances.get(accountId)!),
    )
    const allocatedEndingIraBalance = ownedIraBalanceUpperBound(
      expectedAccountIds.ownedNonRothIras.map((accountId) =>
        allocatedEndingYear.rawBalances.get(accountId)!),
    )
    if (aggregate.endingNondeductibleIraBasis > aggregateEndingIraBalance ||
        allocated.endingNondeductibleIraBasis > allocatedEndingIraBalance) return null

    const keys: OptimizerExactLedgerComparisonKey[] = []
    for (const taxYear of aggregate.horizon.taxYears) {
      for (const field of annualTaxFields) {
        keys.push({ kind: 'annualTaxTotal', taxYear, field })
      }
      for (const field of annualBalanceFields) {
        keys.push({ kind: 'annualBalanceTotal', taxYear, field })
      }
      for (const accountId of evaluatedAccountIds) {
        keys.push({ kind: 'accountEndingBalance', taxYear, accountId })
      }
    }
    for (const field of endingFields) {
      keys.push({
        kind: 'projectionEndingTotal',
        taxYear: aggregate.horizon.endYear,
        field,
      })
    }

    const entries = keys.map((key): OptimizerExactLedgerComparisonEntry => ({
      key: { ...key },
      aggregateMinorUnits: amountFor(aggregate, key),
      allocatedMinorUnits: amountFor(allocated, key),
    }))
    if (entries.some((entry) =>
      entry.aggregateMinorUnits !== entry.allocatedMinorUnits)) return null

    return deepFreeze({
      currencyMinorUnit: 0.01,
      quantization: 'nearestCentHalfUp',
      equality: 'exactMinorUnitByRequiredKey',
      aggregateHorizon: {
        ...aggregate.horizon,
        taxYears: [...aggregate.horizon.taxYears] as [number, ...number[]],
      },
      allocatedHorizon: {
        ...allocated.horizon,
        taxYears: [...allocated.horizon.taxYears] as [number, ...number[]],
      },
      evaluatedTaxYears: [...aggregate.horizon.taxYears],
      evaluatedAccountIds,
      entries,
    })
  } catch {
    return null
  }
}

/**
 * Every schema path a field is wired to, checked against what `parsePlan`
 * actually reports (#452, #489–#531, review r1-12).
 *
 * The other tests here feed hand-written issue strings, which cannot catch a
 * path the engine spells differently from the call site: a mismatch would
 * silently show no inline error at all. This one builds a plan that violates
 * each wired path, asks the real parser, and requires the reported path to be
 * exactly the string the field passes as `path` — and its label and advice to
 * be readable rather than raw Zod or a schema key.
 *
 * The wired paths are read from the source at test time, so a newly wired
 * field either gets a violation here or fails the suite.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { WILDCARD, wiredFieldPaths } from '../testSupport/wiredFieldPaths'
import { buildExampleCouple } from './examples/buildExampleCouple'
import { parseIssues } from './validationIssues'

/**
 * Write `value` at a dot path, creating nothing, and return the path it was
 * actually written at. A list index in a wired path is whichever item the
 * editor is rendering, so an index that does not carry the leaf (the debt
 * account's rate on a property, a wage field on a Social Security stream) is
 * resolved to the item in that same list that does — the field's spelling is
 * what is under test, not its position.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

/** An own property's value, read through its descriptor so the walk never touches the prototype chain (Semgrep code-scanning 57). */
const ownValue = (object: unknown, key: string): unknown =>
  object !== null && typeof object === 'object' ? Object.getOwnPropertyDescriptor(object, key)?.value : undefined

function setAt(plan: Plan, path: string, value: unknown): string | null {
  const segments = path.split('.')
  // A path comes from the source scan, not from input, but the walk below
  // writes by key: refuse the three that reach Object.prototype rather than
  // rely on that (Semgrep prototype-pollution-loop).
  if (segments.some((segment) => UNSAFE_KEYS.has(segment))) return null
  const resolved: string[] = []
  let node: Record<string, unknown> = plan as unknown as Record<string, unknown>
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    const rest = segments.slice(i + 1)
    let next = ownValue(node, seg)
    if (Array.isArray(node) && /^\d+$/.test(seg)) {
      const at = node as unknown as unknown[]
      const holds = (item: unknown) => {
        let cursor = item
        for (const key of rest.slice(0, -1)) {
          if (cursor === null || typeof cursor !== 'object') return false
          cursor = ownValue(cursor, key)
        }
        return cursor !== null && typeof cursor === 'object' && Object.prototype.hasOwnProperty.call(cursor, rest[rest.length - 1]!)
      }
      const index = holds(at[Number(seg)]) ? Number(seg) : at.findIndex(holds)
      if (index < 0) return null
      next = at[index]
      resolved.push(String(index))
    } else {
      resolved.push(seg)
    }
    if (next === undefined || next === null || typeof next !== 'object') return null
    node = next as Record<string, unknown>
  }
  const leaf = segments[segments.length - 1]!
  if (!Object.prototype.hasOwnProperty.call(node, leaf)) return null
  Object.defineProperty(node, leaf, { value, writable: true, enumerable: true, configurable: true })
  resolved.push(leaf)
  return resolved.join('.')
}

/**
 * A plan shaped so that every wired path exists and can be violated: the
 * example couple, plus the optional blocks the walk's fields edit.
 */
function fixture(): Plan {
  const plan = structuredClone(buildExampleCouple()) as Plan
  const year = new Date().getFullYear()
  plan.household.stateMoves = [{ fromYear: year + 5, fromMonth: 7, state: 'FL' }]
  plan.strategies.itemizedDeductions = { stateAndLocalTaxes: 10_000, mortgageInterest: 8_000, charitable: 2_000 }
  plan.strategies.taxableSafetyNetFloor = 25_000
  plan.strategies.survivorReserveTarget = 100_000
  plan.strategies.withdrawalOrder = { mode: 'bracketTargeted', bracketPct: 22 }
  plan.strategies.rothConversion = {
    mode: 'fillToTarget',
    target: 'fixedMagi',
    targetValue: 150_000,
    startYear: year + 1,
    endYear: year + 5,
  }
  plan.assumptions.ssHaircut = { fromYear: year + 10, cutPct: 20 }
  plan.assumptions.ssCola = { mode: 'fixed', annualPct: 2 }
  plan.assumptions.heirTaxByClass = { traditional: 24, hsa: 22 }
  plan.assumptions.safeWithdrawalRatePct = 4
  plan.assumptions.assetClassParams = { usStocks: { returnPct: 7, volatilityPct: 16, dividendYieldPct: 1.6, interestYieldPct: 0, qualifiedRatioPct: 90 } }
  plan.expenses.requiredAnnual = 60_000
  // The dynamic-spending card's five policy percents. They live under one
  // optional object, so every one of them is absent from a default plan.
  plan.expenses.spendingPolicy = {
    mode: 'riskBasedGuardrails',
    upperGuardrailPct: 120,
    lowerGuardrailPct: 80,
    adjustmentPct: 10,
    targetSuccessLowerPct: 70,
    targetSuccessUpperPct: 95,
  }
  plan.incomeFloor = {
    ladders: [
      {
        id: 'ladder-fixture',
        name: 'Bridge',
        purpose: 'bridge',
        startYear: year + 2,
        endYear: year + 8,
        annualRealAmount: 24_000,
        purchase: { year: year + 1, fundingAccountId: plan.accounts.find((a) => a.type === 'cash')!.id },
      },
    ],
  }
  const goalYear = year + 3
  plan.expenses.oneTimeGoals = [
    { id: 'goal-fixture', label: 'Kitchen', year: goalYear, amount: 45_000, flexibility: 'movable', earliestYear: goalYear, latestYear: goalYear + 1 },
  ]
  // Index 0 is the property and index 1 the debt for the accounts.0.* paths;
  // index 2 is the brokerage, whose yields the walk cited.
  const property = plan.accounts.find((a) => a.type === 'property')!
  const debt = plan.accounts.find((a) => a.type === 'debt') as Extract<Plan['accounts'][number], { type: 'debt' }>
  debt.payoffYear = year + 12
  const brokerage = plan.accounts.find((a) => a.type === 'taxable') as Extract<Plan['accounts'][number], { type: 'taxable' }>
  brokerage.interestYieldPct = 1
  brokerage.dividendYieldPct = 1.8
  brokerage.qualifiedRatio = 0.85
  // The estate destination the accounts editor offers, so its Charity share is a
  // field of this plan (#540).
  brokerage.estateBeneficiary = { destination: 'charity', charityPct: 50 }
  // A pension and the two annuity payout forms: the guaranteed-income editors
  // wire the same leaves from separate JSX, and a payout form is one branch of a
  // union, so each shape a wired path needs is present here (#516).
  const owner = plan.household.people[0]!.id
  const pension: Plan['accounts'][number] = {
    type: 'pension',
    id: 'pension-fixture',
    name: 'Pension',
    ownerPersonId: owner,
    annualReturnPct: null,
    startAge: 65,
    monthlyAmount: 2_000,
    colaPct: 2,
    survivorPct: 50,
  }
  const annuityBase = {
    type: 'annuity',
    ownerPersonId: owner,
    annualReturnPct: null,
    startAge: 70,
    monthlyAmount: 1_000,
    colaPct: 0,
    taxablePct: 80,
  } as const
  const periodCertain: Plan['accounts'][number] = {
    ...annuityBase,
    id: 'annuity-certain-fixture',
    name: 'Annuity (period certain)',
    payoutForm: { kind: 'periodCertain', certainYears: 10 },
  }
  const jointSurvivor: Plan['accounts'][number] = {
    ...annuityBase,
    id: 'annuity-joint-fixture',
    name: 'Annuity (joint & survivor)',
    payoutForm: { kind: 'jointSurvivor', survivorPct: 50 },
  }
  plan.accounts = [
    property,
    debt,
    brokerage,
    ...plan.accounts.filter((a) => a !== property && a !== debt && a !== brokerage),
    pension,
    periodCertain,
    jointSurvivor,
  ]
  // An inherited IRA carrying every beneficiary fact the editor wires, so the
  // `accounts.N.inherited.*` paths are fields of this plan. A surviving-spouse
  // treat-as-own election is the one shape that reaches all of them at once:
  // the election year exists only under that election, and the owner's
  // birth-date components only alongside a birth year (plan.ts superRefine).
  const inherited: Plan['accounts'][number] = {
    type: 'traditional',
    id: 'inherited-ira-fixture',
    name: 'Inherited IRA',
    ownerPersonId: owner,
    annualReturnPct: null,
    kind: 'ira',
    balance: 180_000,
    annualContribution: 0,
    inherited: {
      ownerDeathYear: 2024,
      decedentHadStartedRmds: true,
      beneficiary: {
        beneficiaryClass: 'designated-individual',
        edbCategory: 'surviving-spouse',
        beneficiaryBirthYear: 1958,
        soleBeneficiary: true,
        election: 'treat-as-own',
        treatAsOwnElectionYear: 2025,
        spouseUnlimitedWithdrawalRight: true,
        ownerBirthYear: 1950,
        ownerBirthMonth: 4,
        ownerBirthDay: 12,
        ownerYearOfDeathRmdSatisfied: true,
        roth5YearStartYear: 2010,
        provenance: { source: 'fixture', asOf: '2026-01-01' },
      },
    },
  }
  plan.accounts = [...plan.accounts, inherited]
  const life = plan.insurance.find((p) => p.kind === 'permanentLife') as Extract<Plan['insurance'][number], { kind: 'permanentLife' }>
  life.premiumMode = 'untilAge'
  life.premiumEndAge = 75
  life.cashValueMode = 'schedule'
  life.cashValueSchedule = [{ age: 65, value: 90_000 }]
  plan.insurance = [life, ...plan.insurance.filter((p) => p !== life)]
  // Wages first, then the recurring/one-time streams, then Social Security at
  // index 2 — the index SocialSecuritySection resolves for the first person.
  const wages = plan.incomes.find((s) => s.type === 'wages')!
  const ss = plan.incomes.find((s) => s.type === 'socialSecurity') as Extract<Plan['incomes'][number], { type: 'socialSecurity' }>
  // The SSDI block the Social Security card edits behind its own checkbox, so
  // `incomes.N.disability.onsetAge` is a field of this plan (#511). Onset at
  // 60 is inside the schema's 40–75 and before FRA, so the fixture stays valid.
  ss.disability = { onsetAge: 60 }
  plan.incomes = [
    wages,
    { type: 'recurring', id: 'rent-fixture', label: 'Rental', annualAmount: 12_000, startYear: year + 1, endYear: year + 10, inflationAdjusted: true, taxTreatment: 'ordinary' },
    ss,
    { type: 'oneTime', id: 'gift-fixture', label: 'Inheritance', year: year + 4, amount: 50_000, inflationAdjusted: true, taxTreatment: 'none' },
  ]
  return plan
}

/**
 * A value the engine must reject at that path. Chosen from the schema's own
 * bound (packages/engine/src/model/plan.ts) — never a bound invented here.
 */
function violationFor(path: string): unknown {
  const leaf = path.split('.').pop()!
  if (/Year$/.test(leaf) || leaf === 'year') return 1200 // calendarYear: 1900–2200
  if (/Age$/.test(leaf) || leaf === 'years' || leaf === 'months' || leaf === 'age') return -1
  if (leaf === 'name' || leaf === 'label') return ''
  if (leaf === 'dob') return 'not-a-date'
  if (leaf === 'cashValueSchedule') return []
  if (leaf === 'qualifiedRatio') return 5 // a 0–1 share
  if (/Pct$/.test(leaf) || leaf === 'multiplier' || leaf === 'qualifiedRatio') return -5_000
  return -1 // nonNegative money and counts
}

/** The paths whose editor lives behind a mode the base fixture does not use. */
function fixtureFor(path: string): Plan {
  const plan = fixture()
  if (path.startsWith('strategies.rothConversion.conversions')) {
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: new Date().getFullYear() + 1, amount: 50_000 }] }
  }
  return plan
}

describe('every wired schema path, against real engine output', () => {
  // A wildcard segment (the asset class) is one concrete class here: the
  // spelling of the leaf is what the round trip proves, and the bounds drift
  // test covers every class the schema allows.
  const paths = wiredFieldPaths().map((p) => p.split(WILDCARD).join('usStocks'))

  it('the fixture is a valid plan, so each failure below comes from the one field under test', () => {
    const r = parsePlan(fixture())
    expect(r.ok ? [] : r.issues).toEqual([])
    // A guard on the reader itself: the walk wired dozens of paths, so a
    // regex that stopped matching would otherwise make this suite vacuous.
    expect(paths.length).toBeGreaterThan(50)
  })

  it('sees the paths wired through a helper, not only the literal ones (r3-5, r3-6)', () => {
    // The income-floor rows address their ladder by id and pass leaves to a
    // `fieldPath` helper; those paths are exercised below like any other.
    expect(paths).toContain('incomeFloor.ladders.0.startYear')
    expect(paths).toContain('incomeFloor.ladders.0.endYear')
    expect(paths).toContain('incomeFloor.ladders.0.annualRealAmount')
    expect(paths).toContain('incomeFloor.ladders.0.name')
    expect(paths).toContain('incomeFloor.ladders.0.purchase.year')
  })

  it.each(paths)('%s is a path the engine reports, with a readable label and advice', (path) => {
    const plan = fixtureFor(path)
    let at = setAt(plan, path, violationFor(path))
    expect(at, `${path} is not a field of the fixture plan`).not.toBeNull()
    let r = parsePlan(plan)
    if (r.ok) {
      // The engine accepts every number here (an unbounded rate, a MAGI
      // target): what this test can still prove is the path's spelling, so
      // hand it a value of the wrong type and require the same path back.
      const retry = fixtureFor(path)
      at = setAt(retry, path, 'not-a-value')
      r = parsePlan(retry)
    }
    expect(r.ok, `${path} was accepted by the engine`).toBe(false)
    if (r.ok) return
    const issue = parseIssues(r.issues).find((i) => i.path === at)
    expect(issue, `engine reported ${r.issues.join('; ')} — no issue at ${at}`).toBeDefined()
    // What the person reads: never Zod's wording, never a bare schema key.
    expect(issue!.advice).not.toMatch(/^(Too small|Too big|Invalid input|Invalid option|Invalid date)/)
    expect(issue!.label).not.toMatch(/[a-z][A-Z]/)
    expect(issue!.section).not.toBe('unknown')
    // The brokerage qualified share is stored 0–1 and shown as a percent: the
    // engine's own bound, in the unit the person is typing in (r2-4).
    if (path.endsWith('.qualifiedRatio')) expect(issue!.advice).toBe('Must be at most 100')
  })
})

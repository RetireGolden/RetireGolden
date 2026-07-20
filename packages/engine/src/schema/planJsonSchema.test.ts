/**
 * Acceptance tests for the derived Plan JSON Schema (enhancement:
 * plan-ingestion-and-round-trip, step 2).
 *
 * These are the plan's acceptance criteria:
 *  - fixture parity: every plan `parsePlan` accepts also validates against the
 *    emitted JSON Schema (ajv, draft 2020-12);
 *  - a deliberately invalid plan fails schema validation with a pointed path;
 *  - the schema carries the version (schemaVersion const / PLAN_SCHEMA_VERSION);
 *  - a sync check: regenerating from `planSchema` equals the checked-in artifact
 *    (both the `.ts` constant and the shipped `.json`), so a plan-model change
 *    that isn't regenerated fails CI rather than letting the schema drift from
 *    what `parsePlan` accepts.
 *
 * The schema is DERIVED — never hand-maintained — so these tests, not a second
 * hand-written truth, are what keep it honest.
 */
import { Ajv2020 } from 'ajv/dist/2020.js'
import type { ValidateFunction } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { CURRENT_PLAN_SCHEMA_VERSION, createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import {
  accumulatorPlan,
  assetLocationPlan,
  inheritedOnlyPlan,
  mixedTraditionalPlan,
  noTraditionalPlan,
  oneTimeIncomePlan,
  ssTaxabilityPlan,
  survivorPlan,
  taxableBridgePlan,
  tradHeavyPlan,
} from '../decisions/decisionFixtures.js'
import { couplePlan, singlePersonPlan } from '../testing/planFixtures.js'
import { generatePlanJsonSchema } from './generate.js'
import {
  PLAN_SCHEMA_ID,
  PLAN_SCHEMA_VERSION,
  PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS,
  UNREPRESENTABLE_CONSTRAINTS_KEY,
} from './planSchemaMeta.js'
// Import the public data surface through the zod-free barrel, and the whole
// namespace so a test can assert the barrel does not re-expose the zod generator.
import * as schemaBarrel from './index.js'
import { planJsonSchema } from './index.js'
// The shipped offline artifact, imported through the bundler as a plain module so
// this parity check needs no node fs types (keeps the engine's pure typing).
import shippedPlanJsonSchema from '../../schema/plan.v1.json' with { type: 'json' }

function compileSchema(): ValidateFunction {
  // `strict: false` — the derived schema is plain draft-2020-12 with no custom
  // keywords; strict mode's ergonomic warnings (e.g. `default` alongside a
  // union) would only add noise. `allErrors` so a pointed-path assertion can
  // find its error even when several fire.
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  return ajv.compile(planJsonSchema)
}

const validate = compileSchema()

/** Run parsePlan and fail loudly (with the issue list) if it rejects. */
function accept(raw: unknown, label: string): Plan {
  const parsed = parsePlan(raw)
  if (!parsed.ok) throw new Error(`${label} was expected to parse but did not: ${parsed.issues.join('; ')}`)
  return parsed.plan
}

/**
 * A single plan exercising the exotic corners the small fixtures miss: every
 * account type, allocations, an annuity purchase + joint-survivor payout, a
 * pension lump-sum election, both insurance kinds, a care event, a TIPS ladder,
 * ABW spending, an optimized Roth schedule, itemized deductions, a state move,
 * former spouses, and a scenario patch. Built raw and gated through parsePlan so
 * a construction mistake fails here with a precise path.
 */
function kitchenSinkPlanRaw(): Record<string, unknown> {
  const staticAlloc = {
    mode: 'static',
    rebalancing: 'annual',
    weights: { usStocks: 60, intlStocks: 20, bonds: 15, cash: 5 },
  }
  return {
    schemaVersion: 1,
    id: 'plan-kitchen',
    name: 'Kitchen sink',
    origin: 'user',
    createdAtIso: '2026-01-01T00:00:00.000Z',
    updatedAtIso: '2026-01-01T00:00:00.000Z',
    household: {
      filingStatus: 'marriedFilingJointly',
      hasQualifyingDependent: false,
      state: 'KY',
      stateMoves: [{ fromYear: 2035, fromMonth: 6, state: 'FL' }],
      capitalLossCarryforward: 5000,
      people: [
        { id: 'p1', name: 'Pat', dob: '1962-03-01', sex: 'female', retirementAge: 65, longevity: { planningAge: 95, source: 'manual' } },
        {
          id: 'p2',
          name: 'Robin',
          dob: '1963-07-15',
          sex: 'male',
          retirementAge: 66,
          longevity: {
            planningAge: 92,
            source: 'percentile',
            percentile: { pct: 25, joint: true, healthMultiplier: 1.1, partnerHealthMultiplier: 0.9 },
          },
        },
      ],
    },
    accounts: [
      { type: 'cash', id: 'acct-cash', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 40000, annualContribution: 0 },
      {
        type: 'taxable',
        id: 'acct-tax',
        name: 'Brokerage',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 200000,
        costBasis: 120000,
        interestYieldPct: 1,
        dividendYieldPct: 2,
        qualifiedRatio: 0.85,
        reinvestDividends: true,
        allocation: staticAlloc,
        annualContribution: 0,
        estateBeneficiary: { destination: 'charity', charityPct: 25 },
      },
      {
        type: 'traditional',
        id: 'acct-trad-ira',
        name: 'IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 500000,
        annualContribution: 0,
        nondeductibleBasis: 10000,
        spouseSoleBeneficiary: true,
        sepp: { startAge: 58, method: 'amortization' },
        allocation: staticAlloc,
      },
      {
        type: 'traditional',
        id: 'acct-trad-emp',
        name: '401k',
        ownerPersonId: 'p2',
        annualReturnPct: null,
        kind: 'employer',
        balance: 300000,
        annualContribution: 20000,
        inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: true },
        employerMatch: { matchPct: 50, capPctOfPay: 6 },
        contributionSchedule: [{ annualAmount: 20000, fromAge: 60, toAge: 66, escalationPct: 2 }],
      },
      {
        type: 'roth',
        id: 'acct-roth',
        name: 'Roth IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 80000,
        annualContribution: 0,
        contributionBasis: 50000,
      },
      {
        type: 'hsa',
        id: 'acct-hsa',
        name: 'HSA',
        ownerPersonId: 'p2',
        annualReturnPct: null,
        balance: 30000,
        annualContribution: 3000,
        withdrawalTreatment: 'capByMedicalExpenses',
        reimburseLater: true,
        beneficiary: 'spouse',
        allocation: staticAlloc,
      },
      {
        type: 'equityComp',
        id: 'acct-eq',
        name: 'RSUs',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        balance: 90000,
        costBasis: 40000,
        annualContribution: 0,
        vestingMode: 'cliff',
        vestDate: '2030-01-01',
      },
      {
        type: 'pension',
        id: 'acct-pension',
        name: 'Pension',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        source: 'private',
        startAge: 65,
        monthlyAmount: 2000,
        colaPct: 0,
        survivorPct: 50,
        lumpSumOffer: { amount: 250000, electionYear: 2027 },
        lumpSumElection: { rolloverAccountId: 'acct-trad-ira' },
      },
      {
        type: 'annuity',
        id: 'acct-annuity',
        name: 'SPIA',
        ownerPersonId: 'p2',
        annualReturnPct: null,
        startAge: 70,
        monthlyAmount: 1500,
        colaPct: 0,
        taxablePct: 50,
        purchase: { year: 2030, premium: 100000, fundingAccountId: 'acct-cash', taxQualification: 'nonQualified' },
        payoutForm: { kind: 'jointSurvivor', survivorPct: 50 },
      },
      {
        type: 'property',
        id: 'acct-prop',
        name: 'Home',
        ownerPersonId: null,
        annualReturnPct: null,
        value: 600000,
        plannedSaleYear: null,
        expectedNetProceeds: null,
        costBasis: 300000,
        sellingCostPct: 6,
        primaryResidence: true,
        propertyTaxAnnual: 6000,
        insuranceAnnual: 1800,
        hecm: { openYear: 2032, principalLimitPct: 50, growthRatePct: 7.5, upfrontCostPct: 2, drawPolicy: 'coordinated' },
      },
      {
        type: 'debt',
        id: 'acct-debt',
        name: 'Mortgage',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 150000,
        interestPct: 4,
        monthlyPayment: 1200,
        payoffYear: null,
      },
    ],
    insurance: [
      {
        kind: 'ltc',
        id: 'ins-ltc',
        name: 'LTC policy',
        owner: 'p1',
        annualPremium: 3000,
        premiumMode: 'untilAge',
        premiumEndAge: 80,
        benefitMonthly: 6000,
        benefitPeriodYears: 3,
        eliminationPeriodDays: 90,
        inflationRiderPct: 3,
      },
      {
        kind: 'permanentLife',
        id: 'ins-life',
        name: 'Whole life',
        insured: 'p2',
        beneficiary: 'p1',
        annualPremium: 5000,
        premiumMode: 'lifetime',
        deathBenefit: 250000,
        cashValue: 40000,
        cashValueMode: 'schedule',
        cashValueSchedule: [
          { age: 64, value: 40000 },
          { age: 74, value: 70000 },
        ],
        dividendOption: 'paidUpAdditions',
      },
    ],
    careEvents: [{ id: 'care-1', personId: 'p1', startAge: 85, durationYears: 3, annualCost: 90000 }],
    incomes: [
      { type: 'wages', id: 'inc-wages', personId: 'p1', annualGross: 120000, endAge: 65, realGrowthPct: 1 },
      {
        type: 'socialSecurity',
        id: 'inc-ss',
        personId: 'p2',
        piaMonthly: 2400,
        earnings: null,
        coveredQuarters: 40,
        formerSpouses: [
          { id: 'ex-1', relationship: 'divorced', dob: '1960-01-01', piaMonthly: 1800, marriageYears: 12, remarriedAtAge: null },
        ],
        claimAge: { years: 67, months: 0 },
      },
      { type: 'recurring', id: 'inc-rec', label: 'Rental', annualAmount: 18000, startYear: null, endYear: null, inflationAdjusted: true, taxTreatment: 'ordinary' },
      { type: 'oneTime', id: 'inc-one', label: 'Inheritance', year: 2031, amount: 75000, taxTreatment: 'capitalGain' },
    ],
    incomeFloor: {
      ladders: [
        { id: 'lad-1', name: 'SS bridge', purpose: 'bridge', startYear: 2032, endYear: 2040, annualRealAmount: 30000, purchase: { year: 2030, fundingAccountId: 'acct-tax' } },
      ],
    },
    expenses: {
      baseAnnual: 60000,
      requiredAnnual: 40000,
      idealAnnual: 10000,
      excessAnnual: 5000,
      phases: [{ fromAge: 75, multiplier: 0.9 }],
      oneTimeGoals: [
        {
          id: 'goal-1',
          label: 'Car',
          year: 2035,
          amount: 30000,
          classification: 'target',
          flexibility: 'movable',
          earliestYear: 2033,
          latestYear: 2037,
          priority: 1,
          minFundingPct: 50,
          allowPartialFunding: true,
        },
      ],
      healthcare: {
        pre65MonthlyPremiumPerPerson: 800,
        applyAcaCredit: true,
        medicareExtrasMonthlyPerPerson: 300,
        ssa44: { survivorYears: true, retirementYears: true },
      },
      spendingPolicy: { mode: 'abw', abw: { returnSource: 'fixed', fixedRealReturnPct: 3.8, horizon: 'planningAge', tiltPct: 0 } },
      survivorSpendingPct: 80,
      bequestTargetDollars: 100000,
    },
    strategies: {
      withdrawalOrder: { mode: 'bracketTargeted', bracketPct: 24 },
      rothConversion: { mode: 'optimized', conversions: [{ year: 2027, amount: 20000 }], optimizedAtIso: '2026-01-01T00:00:00.000Z' },
      qcdAnnual: 0,
      itemizedDeductions: { stateAndLocalTaxes: 10000, mortgageInterest: 8000, charitable: 4000 },
      taxableSafetyNetFloor: 20000,
      survivorReserveTarget: 50000,
    },
    assumptions: {
      inflationPct: 2.5,
      healthcareExtraInflationPct: 1.5,
      defaultReturnPct: 5,
      ssCola: { mode: 'fixed', annualPct: 2 },
      ssHaircut: { fromYear: 2034, cutPct: 17 },
      stateEffectiveTaxPct: 0,
      localIncomeTaxPct: 1,
      recentAnnualMagi: 50000,
      heirTaxRatePct: 25,
      heirTaxByClass: { traditional: 30, hsa: 20 },
      safeWithdrawalRatePct: 4,
      assetClassParams: { usStocks: { returnPct: 7, volatilityPct: 15 }, bonds: { returnPct: 3 } },
    },
    scenarios: [{ id: 'scen-1', name: 'Higher inflation', patch: { 'assumptions.inflationPct': 3 } }],
  }
}

/**
 * The sparsest valid authoring input: it omits every field that carries a zod
 * default (origin, insurance, careEvents, stateMoves, capitalLossCarryforward,
 * the optional expense/strategy/assumption layers) and nested defaults inside a
 * contribution phase and a wages stream. This is the shape an MCP client emits
 * before normalization — exactly what `io: 'input'` is meant to describe.
 */
function sparseAuthoringPlanRaw(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'sparse',
    name: 'Sparse authoring plan',
    createdAtIso: '2026-01-01T00:00:00.000Z',
    updatedAtIso: '2026-01-01T00:00:00.000Z',
    household: {
      filingStatus: 'single',
      state: 'KY',
      people: [{ id: 'p1', name: 'Sam', dob: '1965-05-05', sex: 'average', retirementAge: 65, longevity: { planningAge: 90, source: 'manual' } }],
    },
    accounts: [
      // contributionSchedule phase omits the defaulted fromAge/toAge/escalationPct.
      { type: 'traditional', id: 'a1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 100000, annualContribution: 0, contributionSchedule: [{ annualAmount: 6000 }] },
    ],
    // wages omits the defaulted realGrowthPct.
    incomes: [{ type: 'wages', id: 'w1', personId: 'p1', annualGross: 50000, endAge: null }],
    expenses: {
      baseAnnual: 40000,
      phases: [],
      oneTimeGoals: [],
      healthcare: { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 },
    },
    strategies: { withdrawalOrder: { mode: 'sequential' }, rothConversion: { mode: 'none' }, qcdAnnual: 0 },
    assumptions: {
      inflationPct: 2.5,
      healthcareExtraInflationPct: 1.5,
      defaultReturnPct: 5,
      ssCola: { mode: 'matchInflation' },
      ssHaircut: null,
      stateEffectiveTaxPct: 0,
      recentAnnualMagi: 0,
    },
    scenarios: [],
  }
}

/** Every fixture the engine already trusts, each gated through parsePlan. */
function acceptedFixtures(): Array<[string, Plan]> {
  const raw: Array<[string, unknown]> = [
    ['createEmptyPlan', createEmptyPlan({ newId: () => 'x', now: () => new Date('2026-01-01T00:00:00.000Z') })],
    ['singlePersonPlan', singlePersonPlan()],
    ['couplePlan', couplePlan()],
    ['tradHeavyPlan', tradHeavyPlan()],
    ['noTraditionalPlan', noTraditionalPlan()],
    ['inheritedOnlyPlan', inheritedOnlyPlan()],
    ['mixedTraditionalPlan', mixedTraditionalPlan()],
    ['accumulatorPlan', accumulatorPlan()],
    ['taxableBridgePlan(high)', taxableBridgePlan('high')],
    ['taxableBridgePlan(low)', taxableBridgePlan('low')],
    ['ssTaxabilityPlan', ssTaxabilityPlan()],
    ['oneTimeIncomePlan', oneTimeIncomePlan()],
    ['assetLocationPlan', assetLocationPlan()],
    ['survivorPlan', survivorPlan()],
    ['kitchenSinkPlan', kitchenSinkPlanRaw()],
  ]
  return raw.map(([name, plan]) => [name, accept(plan, name)])
}

describe('planJsonSchema — version', () => {
  it('carries the plan schema version at the document root', () => {
    expect(PLAN_SCHEMA_VERSION).toBe(1)
    expect(planJsonSchema.properties.schemaVersion).toMatchObject({ const: PLAN_SCHEMA_VERSION })
    expect(planJsonSchema.$id).toBe(PLAN_SCHEMA_ID)
    expect(planJsonSchema.$id).toContain(`/v${PLAN_SCHEMA_VERSION}.json`)
  })

  it('keeps the zod-free PLAN_SCHEMA_VERSION in lockstep with the plan model', () => {
    expect(PLAN_SCHEMA_VERSION).toBe(CURRENT_PLAN_SCHEMA_VERSION)
  })
})

describe('schema barrel — zero-dependency data surface', () => {
  it('exposes the constant + version but NOT the zod-backed generator', () => {
    // The generator lives on ./generate (and @retiregolden/engine/schema/generate);
    // re-exporting it here would drag zod + the plan model into every importer of
    // the barrel, breaking the MCP's "data-only" story. Guard against a regression.
    expect(Object.keys(schemaBarrel).sort()).toEqual(
      ['PLAN_SCHEMA_ID', 'PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS', 'PLAN_SCHEMA_VERSION', 'planJsonSchema'].sort(),
    )
    expect('generatePlanJsonSchema' in schemaBarrel).toBe(false)
    expect(typeof planJsonSchema).toBe('object')
  })
})

describe('planJsonSchema — accepts authoring-shaped (pre-parse) inputs', () => {
  // io: 'input' means the schema describes what a client AUTHORS, not the
  // defaults-applied parsePlan output. Validate raw, sparse docs directly.
  it('validates a sparse plan that omits every defaulted field', () => {
    const raw = sparseAuthoringPlanRaw()
    expect(validate(raw)).toBe(true)
    expect(validate.errors ?? []).toEqual([])
    expect(parsePlan(raw).ok).toBe(true)
  })

  it('validates the kitchen-sink plan as authored, before parsePlan normalizes it', () => {
    expect(validate(kitchenSinkPlanRaw())).toBe(true)
    expect(validate.errors ?? []).toEqual([])
  })
})

describe('planJsonSchema — embeds the unrepresentable-constraints catalog', () => {
  it('carries the constraint list as a machine-readable annotation for offline readers', () => {
    expect(planJsonSchema[UNREPRESENTABLE_CONSTRAINTS_KEY]).toEqual([...PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS])
    // The shipped JSON artifact must carry it too (offline path has no TS import).
    expect(shippedPlanJsonSchema[UNREPRESENTABLE_CONSTRAINTS_KEY]).toEqual([...PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS])
  })

  it('treats the annotation as a non-validating keyword (a valid plan still passes)', () => {
    expect(validate(accept(tradHeavyPlan(), 'tradHeavyPlan'))).toBe(true)
  })
})

describe('planJsonSchema — fixture parity', () => {
  it.each(acceptedFixtures())('accepts fixture %s that parsePlan accepts', (_name, plan) => {
    const ok = validate(plan)
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })
})

describe('planJsonSchema — rejects invalid plans with a pointed path', () => {
  it('flags a wrong-typed scalar at its instance path', () => {
    const plan = accept(tradHeavyPlan(), 'tradHeavyPlan') as unknown as Record<string, Record<string, unknown>>
    const broken = { ...plan, assumptions: { ...plan.assumptions, inflationPct: 'lots' } }
    expect(validate(broken)).toBe(false)
    expect(validate.errors?.some((e) => e.instancePath === '/assumptions/inflationPct')).toBe(true)
  })

  it('flags a missing required field', () => {
    const plan = accept(tradHeavyPlan(), 'tradHeavyPlan') as unknown as Record<string, unknown>
    const withoutHousehold: Record<string, unknown> = { ...plan }
    delete withoutHousehold.household
    expect(validate(withoutHousehold)).toBe(false)
    expect(
      validate.errors?.some((e) => e.keyword === 'required' && e.params?.missingProperty === 'household'),
    ).toBe(true)
  })
})

describe('planJsonSchema — structural, not a full validator', () => {
  it('accepts a document that parsePlan rejects (a dropped refinement)', () => {
    // Allocation weights must sum to 100% — a refinement JSON Schema can't
    // express, so it is dropped from the emitted schema. A plan with weights
    // summing to 90 is therefore SCHEMA-valid but parsePlan-invalid, proving the
    // schema is necessary-but-not-sufficient (documented in its description).
    const plan = kitchenSinkPlanRaw()
    const accounts = plan.accounts as Array<Record<string, unknown>>
    const taxable = accounts.find((a) => a.id === 'acct-tax')!
    taxable.allocation = { mode: 'static', rebalancing: 'annual', weights: { usStocks: 50, intlStocks: 20, bonds: 15, cash: 5 } }

    expect(validate(plan)).toBe(true)
    expect(parsePlan(plan).ok).toBe(false)
  })
})

describe('planJsonSchema — sync with planSchema', () => {
  it('the checked-in constant equals a fresh generation from planSchema', () => {
    expect(planJsonSchema).toEqual(generatePlanJsonSchema())
  })

  it('the shipped schema/plan.v1.json equals the checked-in constant', () => {
    expect(shippedPlanJsonSchema).toEqual(planJsonSchema)
  })
})

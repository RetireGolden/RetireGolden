/**
 * Export-format contract tests (DOCS/features/plan-file-format.md).
 *
 * Three guarantees are enforced here rather than promised in prose:
 *  1. Round trip is exact — every example-library plan survives
 *     serialize → parse unchanged.
 *  2. Old exports import forward, forever — a pinned, full-featured v1 export
 *     (a frozen JSON string, not a builder) must keep importing. If a schema
 *     change or version bump strands it, this file fails before users' backups do.
 *  3. Unknown fields are dropped, not errors — hand-added keys never block import.
 */

import { describe, expect, it } from 'vitest'

import { CURRENT_PLAN_SCHEMA_VERSION, createEmptyPlan } from '../engine/model/plan'
import { migratePlanToCurrent } from '../engine/model/migrations'
import { EXAMPLE_PLANS } from '../planner/examples/registry'
import { parseV2Backup, serializeV2Backup } from './v2Backup'

const fixedNow = () => new Date('2026-07-08T00:00:00.000Z')

/**
 * A frozen v1 export exercising every account type and most optional fields.
 * Deliberately a raw JSON string: it represents a file on a user's disk, so it
 * must never be "refreshed" by builders when the schema evolves — migrations
 * have to carry it forward instead. Do not regenerate this fixture.
 */
const PINNED_V1_PLAN_JSON = `{
  "schemaVersion": 1,
  "id": "pinned-v1-export",
  "name": "Pinned v1 export",
  "origin": "user",
  "createdAtIso": "2026-07-01T00:00:00.000Z",
  "updatedAtIso": "2026-07-01T00:00:00.000Z",
  "household": {
    "filingStatus": "marriedFilingJointly",
    "hasQualifyingDependent": false,
    "state": "KY",
    "stateMoves": [{ "fromYear": 2030, "fromMonth": 7, "state": "TN" }],
    "capitalLossCarryforward": 1200,
    "people": [
      { "id": "p1", "name": "Avery", "dob": "1968-04-15", "sex": "female", "retirementAge": 65, "longevity": { "planningAge": 95, "source": "manual" } },
      { "id": "p2", "name": "Sam", "dob": "1966-09-02", "sex": "male", "retirementAge": 66, "longevity": { "planningAge": 92, "source": "model" } }
    ]
  },
  "accounts": [
    { "id": "a-cash", "type": "cash", "name": "Savings", "ownerPersonId": null, "annualReturnPct": 1.5, "balance": 40000, "annualContribution": 0 },
    { "id": "a-tax", "type": "taxable", "name": "Brokerage", "ownerPersonId": null, "annualReturnPct": null, "balance": 500000, "costBasis": 300000, "interestYieldPct": 0.5, "dividendYieldPct": 1.8, "qualifiedRatio": 0.9, "reinvestDividends": true, "annualContribution": 10000, "allocation": { "mode": "static", "rebalancing": "annual", "weights": { "usStocks": 60, "intlStocks": 20, "bonds": 15, "cash": 5 } } },
    { "id": "a-eq", "type": "equityComp", "name": "RSU", "ownerPersonId": null, "annualReturnPct": null, "balance": 60000, "costBasis": 40000, "annualContribution": 0, "vestingMode": "final", "vestDate": null },
    { "id": "a-trad", "type": "traditional", "name": "401(k)", "ownerPersonId": "p1", "annualReturnPct": null, "kind": "employer", "balance": 900000, "annualContribution": 23000, "employerMatch": { "matchPct": 50, "capPctOfPay": 6 }, "spouseSoleBeneficiary": false },
    { "id": "a-ira", "type": "traditional", "name": "Rollover IRA", "ownerPersonId": "p2", "annualReturnPct": null, "kind": "ira", "balance": 400000, "annualContribution": 0, "nondeductibleBasis": 12000 },
    { "id": "a-roth", "type": "roth", "name": "Roth IRA", "ownerPersonId": "p1", "annualReturnPct": null, "kind": "ira", "balance": 150000, "annualContribution": 7000, "contributionBasis": 60000 },
    { "id": "a-hsa", "type": "hsa", "name": "HSA", "ownerPersonId": "p2", "annualReturnPct": null, "balance": 45000, "annualContribution": 4300, "withdrawalTreatment": "capByMedicalExpenses", "reimburseLater": true, "beneficiary": "spouse" },
    { "id": "a-pen", "type": "pension", "name": "State pension", "ownerPersonId": "p2", "annualReturnPct": null, "source": "public", "startAge": 65, "monthlyAmount": 1500, "colaPct": 1, "survivorPct": 50 },
    { "id": "a-ann", "type": "annuity", "name": "SPIA", "ownerPersonId": "p1", "annualReturnPct": null, "startAge": 70, "monthlyAmount": 800, "colaPct": 0, "taxablePct": 100, "purchase": { "year": 2033, "premium": 150000, "fundingAccountId": "a-ira", "taxQualification": "qualified" } },
    { "id": "a-prop", "type": "property", "name": "Home", "ownerPersonId": null, "annualReturnPct": 2, "value": 450000, "plannedSaleYear": 2040, "expectedNetProceeds": null, "costBasis": 250000, "sellingCostPct": 6, "primaryResidence": true, "propertyTaxAnnual": 4200, "insuranceAnnual": 1800, "estateBeneficiary": { "destination": "charity", "charityPct": 25 } },
    { "id": "a-debt", "type": "debt", "name": "Mortgage", "ownerPersonId": null, "annualReturnPct": null, "balance": 180000, "interestPct": 3.25, "monthlyPayment": 1450, "payoffYear": null }
  ],
  "insurance": [
    { "kind": "ltc", "id": "i-ltc", "name": "LTC policy", "owner": "p1", "annualPremium": 3200, "premiumMode": "untilAge", "premiumEndAge": 85, "benefitMonthly": 6000, "benefitPeriodYears": 3, "eliminationPeriodDays": 90, "inflationRiderPct": 3 },
    { "kind": "permanentLife", "id": "i-wl", "name": "Whole life", "insured": "p2", "beneficiary": "p1", "annualPremium": 0, "premiumMode": "paidUp", "deathBenefit": 100000, "cashValue": 30000, "cashValueMode": "flatRate", "cashValueGrowthPct": 3 }
  ],
  "careEvents": [{ "id": "c1", "personId": "p1", "startAge": 88, "durationYears": 3, "annualCost": 90000 }],
  "incomes": [
    { "type": "wages", "id": "in-w1", "personId": "p1", "annualGross": 140000, "endAge": null, "realGrowthPct": 1 },
    { "type": "socialSecurity", "id": "in-ss1", "personId": "p1", "piaMonthly": 2800, "earnings": null, "claimAge": { "years": 70, "months": 0 } },
    { "type": "socialSecurity", "id": "in-ss2", "personId": "p2", "piaMonthly": 2100, "earnings": null, "claimAge": { "years": 67, "months": 0 } },
    { "type": "recurring", "id": "in-r1", "label": "Rental", "annualAmount": 12000, "startYear": 2027, "endYear": 2035, "inflationAdjusted": true, "taxTreatment": "ordinary" },
    { "type": "oneTime", "id": "in-o1", "label": "Inheritance", "year": 2031, "amount": 50000, "taxTreatment": "none" }
  ],
  "expenses": {
    "baseAnnual": 90000,
    "requiredAnnual": 60000,
    "idealAnnual": 8000,
    "phases": [{ "fromAge": 75, "multiplier": 0.9 }],
    "oneTimeGoals": [{ "id": "g1", "label": "Kitchen", "year": 2029, "amount": 40000, "classification": "target", "flexibility": "movable", "earliestYear": 2028, "latestYear": 2032, "priority": 1 }],
    "healthcare": { "pre65MonthlyPremiumPerPerson": 850, "applyAcaCredit": true, "medicareExtrasMonthlyPerPerson": 180 },
    "spendingPolicy": { "mode": "withdrawalRateGuardrails", "upperGuardrailPct": 120, "lowerGuardrailPct": 80, "adjustmentPct": 10 },
    "survivorSpendingPct": 80,
    "bequestTargetDollars": 250000
  },
  "strategies": {
    "withdrawalOrder": { "mode": "bracketTargeted", "bracketPct": 12 },
    "rothConversion": { "mode": "fillToTarget", "target": "topOfBracket", "targetValue": 24, "startYear": 2033, "endYear": 2040 },
    "qcdAnnual": 5000,
    "itemizedDeductions": { "stateAndLocalTaxes": 8000, "mortgageInterest": 6000, "charitable": 4000 },
    "taxableSafetyNetFloor": 30000,
    "survivorReserveTarget": 100000
  },
  "assumptions": {
    "inflationPct": 2.5,
    "healthcareExtraInflationPct": 3,
    "defaultReturnPct": 5.5,
    "ssCola": { "mode": "matchInflation" },
    "ssHaircut": { "fromYear": 2034, "cutPct": 17 },
    "stateEffectiveTaxPct": 4,
    "localIncomeTaxPct": 1,
    "recentAnnualMagi": 160000,
    "heirTaxRatePct": 25,
    "heirTaxByClass": { "traditional": 30 },
    "safeWithdrawalRatePct": 4,
    "assetClassParams": { "usStocks": { "returnPct": 6.5 } }
  },
  "scenarios": [{ "id": "s1", "name": "Retire at 62", "patch": { "expenses": { "baseAnnual": 80000 } } }]
}`

describe('plan file format contract', () => {
  it('round-trips every example-library plan exactly through serialize/parse', () => {
    const plans = EXAMPLE_PLANS.map((e) => e.build())
    expect(plans.length).toBeGreaterThan(0)

    const result = parseV2Backup(serializeV2Backup(plans, fixedNow))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.warnings).toHaveLength(0)
      expect(result.plans).toEqual(plans)
    }
  })

  it('keeps the pinned v1 export importable (forward-migration guarantee)', () => {
    // If CURRENT_PLAN_SCHEMA_VERSION was bumped without registering a step, this
    // fails with `missing_step`; if a schema change invalidated old files, it
    // fails with `invalid_after_migration` and lists the offending fields.
    const result = migratePlanToCurrent(JSON.parse(PINNED_V1_PLAN_JSON))
    expect(result.ok, JSON.stringify(!result.ok ? { reason: result.reason, issues: result.issues } : {})).toBe(true)
    if (result.ok) {
      expect(result.plan.schemaVersion).toBe(CURRENT_PLAN_SCHEMA_VERSION)
      expect(result.plan.accounts).toHaveLength(11)
      expect(result.plan.household.people).toHaveLength(2)
    }
  })

  it('imports the pinned v1 export through the backup envelope route', () => {
    const json = JSON.stringify({
      kind: 'retiregolden.v2.backup',
      backupVersion: 1,
      exportedAtIso: '2026-07-01T00:00:00.000Z',
      plans: [JSON.parse(PINNED_V1_PLAN_JSON)],
    })
    const result = parseV2Backup(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans).toHaveLength(1)
      expect(result.warnings).toHaveLength(0)
    }
  })

  it('drops unknown fields on import instead of rejecting the file', () => {
    const plan = createEmptyPlan({ newId: () => 'unknown-fields', now: fixedNow })
    const withExtras = {
      ...JSON.parse(JSON.stringify(plan)),
      futureUnknownField: { anything: true },
    }
    const result = migratePlanToCurrent(withExtras)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect('futureUnknownField' in result.plan).toBe(false)
      expect(result.plan).toEqual(plan)
    }
  })
})

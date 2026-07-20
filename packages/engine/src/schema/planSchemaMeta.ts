/**
 * Zod-free metadata for the Plan JSON Schema.
 *
 * This module deliberately imports NOTHING from `zod` or `../model/plan.js`, so
 * that the `@retiregolden/engine/schema` barrel — which re-exports these plus the
 * generated `planJsonSchema` constant — stays a pure data surface. A consumer
 * (the MCP) can import the schema and its version without dragging zod or the
 * plan model into its module graph. The zod-backed generator lives separately in
 * `./generate.ts` (reachable at `@retiregolden/engine/schema/generate`).
 *
 * `PLAN_SCHEMA_VERSION` is asserted to equal the plan model's
 * `CURRENT_PLAN_SCHEMA_VERSION` both at generation time (see `generatePlanJsonSchema`)
 * and by a unit test, so this zod-free copy can never silently drift.
 */

/** The Plan document's schema version. Kept in lockstep with `CURRENT_PLAN_SCHEMA_VERSION`. */
export const PLAN_SCHEMA_VERSION = 1

/** Stable, versioned identifier for the emitted schema (embeds the version). */
export const PLAN_SCHEMA_ID = `https://retiregolden.org/schemas/plan/v${PLAN_SCHEMA_VERSION}.json`

/**
 * Constraints `parsePlan` enforces that the JSON Schema cannot express, so a
 * consumer authoring against the structural schema alone still has to satisfy
 * them (and should validate through `parsePlan`, or the MCP's `validate_plan`,
 * before trusting a document). Grouped by where they live in planSchema; keep
 * this list current when adding a `.refine`/`.superRefine` to the plan model.
 *
 * These are also embedded in the generated schema under
 * `x-retiregolden-unrepresentableConstraints`, so offline JSON-only readers of
 * `schema/plan.v1.json` get the same machine-readable catalog without importing
 * this module.
 */
export const PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS: readonly string[] = [
  // Household ↔ people
  'household.filingStatus "marriedFilingJointly" requires exactly two people.',
  // Referential integrity (ids must resolve to a person/account in the plan)
  'account.ownerPersonId, income.personId, insurance owner/insured/beneficiary, and careEvent.personId must reference an existing person.',
  'traditional/roth/hsa accounts must have an individual owner (ownerPersonId not null).',
  'annuity.purchase.fundingAccountId, pension.lumpSumElection.rolloverAccountId, and incomeFloor ladder purchase fundingAccountId must reference another existing account.',
  // Account-level discriminated rules
  'employerMatch may be set only on employer-kind traditional/roth accounts.',
  'cliff-vesting equity compensation requires a vestDate.',
  'nondeductibleBasis (Form 8606) applies only to traditional IRAs and not to inherited accounts.',
  'hsa reimburse-later accumulation requires the capByMedicalExpenses withdrawal treatment.',
  'property depreciationRecapture requires a costBasis; a HECM line of credit requires a primary residence.',
  'an estateBeneficiary charity destination requires charityPct.',
  // Allocation
  'account allocation weights must sum to 100% (±0.5); a linear glidepath must end after it starts.',
  // Annuity funding / form
  'a qualified annuity purchase must be funded from a traditional account; a non-qualified purchase from cash/taxable/equity-comp; a QLAC must be a qualified purchase; a joint-and-survivor payout form requires a two-person household.',
  // Pension election
  'a pension lump-sum election requires a lump-sum offer and must roll over into an existing traditional account.',
  // Insurance
  "premiumEndAge is required when premiumMode is 'untilAge'; a permanent-life policy with cashValueMode 'schedule' requires a cashValueSchedule.",
  // TIPS ladder
  'a TIPS ladder must end in or after its first payout year, be purchased before that year, and be funded from cash/taxable/equity-comp savings.',
  // Expenses / goals
  'expenses.requiredAnnual cannot exceed baseAnnual; a one-time goal’s earliestYear/latestYear window must bracket its year; partial funding requires minFundingPct below 100.',
]

/** Non-validating JSON Schema annotation key carrying the constraint list above. */
export const UNREPRESENTABLE_CONSTRAINTS_KEY = 'x-retiregolden-unrepresentableConstraints'

/**
 * A generated JSON Schema document. Deliberately loose (the payload is derived,
 * not authored) but pins the fields a consumer relies on.
 */
export interface JsonSchemaDocument {
  $schema?: string
  $id: string
  title: string
  description: string
  type: string
  properties: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

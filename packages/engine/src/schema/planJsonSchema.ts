/**
 * JSON Schema export for the engine `Plan` document.
 *
 * `planSchema` (engine/model/plan.ts) is the single source of truth. This module
 * *derives* a versioned JSON Schema from it with zod 4's native `z.toJSONSchema`
 * so a downstream, non-TypeScript consumer (an AI client authoring a plan from a
 * user's account statements via the MCP `describe_plan_schema` tool) can learn
 * the plan format field-by-field. planSchema is never edited to serve the schema;
 * if the two ever disagree, planSchema wins and the artifact is regenerated.
 *
 * WHAT SURVIVES THE ROUND-TRIP, AND WHAT DOES NOT
 * -----------------------------------------------
 * JSON Schema (draft 2020-12) can express the plan's *structure*: object shapes,
 * required vs. optional fields, primitive types, numeric ranges (`gt`/`min`/…),
 * string patterns (the `YYYY-MM-DD` regex), enums, literals (`schemaVersion`),
 * discriminated unions (emitted as `oneOf`), and arrays. All of that is faithful.
 *
 * What it CANNOT express — and what `z.toJSONSchema` therefore silently drops —
 * are the cross-field and value refinements enforced by planSchema's `.refine`
 * and `.superRefine` blocks: referential integrity of ids, discriminated funding
 * rules, allocation weights summing to 100%, year-window ordering, and the rest
 * (see {@link PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS}). We DO NOT let these
 * vanish quietly: they are enumerated below and summarized in the schema's
 * top-level `description`, so a consumer knows the structural schema is
 * *necessary but not sufficient* — `parsePlan` remains the full validator, and a
 * schema-valid document can still be rejected by `parsePlan`.
 *
 * Note on `unrepresentable: 'throw'` (the zod default, kept here): refinements are
 * *dropped*, not *unrepresentable*. The `throw` mode fires only for constructs
 * with no JSON-Schema analogue at all (bigint, Date, symbol, custom transforms).
 * The plan model has none today, so generation succeeds. Keeping `throw` means a
 * future edit that introduces one FAILS generation loudly instead of emitting an
 * empty `{}` in its place — a deliberate guardrail.
 *
 * @see ./index.ts for the shipped static artifact (`planJsonSchema`).
 * @see scripts/generate-schema.mjs for the build-time writer.
 */

import { z } from 'zod'
import { CURRENT_PLAN_SCHEMA_VERSION, planSchema } from '../model/plan.js'

/**
 * The plan document's schema version, mirrored from planSchema's
 * `schemaVersion` literal. Additive schema changes keep this put (they ship as
 * optional fields with defaults); only a breaking restructure bumps it, in
 * lockstep with `CURRENT_PLAN_SCHEMA_VERSION` and a new `$id`.
 */
export const PLAN_SCHEMA_VERSION = CURRENT_PLAN_SCHEMA_VERSION

/** Stable, versioned identifier for the emitted schema (embeds the version). */
export const PLAN_SCHEMA_ID = `https://retiregolden.org/schemas/plan/v${PLAN_SCHEMA_VERSION}.json`

/**
 * Constraints `parsePlan` enforces that the JSON Schema cannot express, so a
 * consumer authoring against the structural schema alone still has to satisfy
 * them (and should validate through `parsePlan`, or the MCP's `validate_plan`,
 * before trusting a document). Grouped by where they live in planSchema; keep
 * this list current when adding a `.refine`/`.superRefine` to the plan model.
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

function buildDescription(): string {
  return [
    `The RetireGolden engine Plan document, schemaVersion ${PLAN_SCHEMA_VERSION}.`,
    'This schema is DERIVED from the engine’s zod `planSchema` and describes the document’s',
    'structure (shapes, required/optional fields, types, ranges, enums, and the account/income',
    'discriminated unions as `oneOf`). It is NECESSARY BUT NOT SUFFICIENT: `parsePlan` additionally',
    'enforces cross-field constraints that JSON Schema cannot express (referential integrity of ids,',
    'discriminated funding rules, allocation weights summing to 100%, year-window ordering, and more).',
    'A document valid against this schema may still be rejected by `parsePlan`; validate through',
    '`parsePlan` (or the MCP `validate_plan` tool) before trusting a plan.',
  ].join(' ')
}

/**
 * Generate the Plan JSON Schema from `planSchema`. Pure and deterministic — the
 * build script and the sync test both call this; the shipped `planJsonSchema`
 * constant is its checked-in output. `io: 'input'` makes the schema describe what
 * `parsePlan` ACCEPTS (fields with zod defaults are optional; a consumer need not
 * supply them), not the defaults-applied output type.
 */
export function generatePlanJsonSchema(): JsonSchemaDocument {
  // Cast to a precise shape so the derived structural fields (type, properties,
  // any $defs) keep their types when spread below. `io: 'input'` describes what
  // parsePlan accepts; keeping the default `unrepresentable: 'throw'` means a
  // future genuinely-unrepresentable construct fails here instead of vanishing.
  const derived = z.toJSONSchema(planSchema, {
    io: 'input',
    target: 'draft-2020-12',
  }) as unknown as {
    $schema?: string
    type: string
    properties: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
  }

  // Spread the derived schema first, then stamp identity/annotations on top so a
  // versioned `$id`, human title, and the "necessary but not sufficient" caveat
  // ride at the document root. Any extra top-level keys zod emits are preserved.
  return {
    ...derived,
    $schema: derived.$schema ?? 'https://json-schema.org/draft/2020-12/schema',
    $id: PLAN_SCHEMA_ID,
    title: `RetireGolden Plan (schemaVersion ${PLAN_SCHEMA_VERSION})`,
    description: buildDescription(),
  }
}

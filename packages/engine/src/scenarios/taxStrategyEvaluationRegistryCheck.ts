/**
 * Opt-in registry validation for TaxStrategyEvaluation limitation refs.
 *
 * This module is separate from `taxStrategyEvaluation.ts` on purpose: the
 * TaxStrategyEvaluation **contract** stays registry-free at runtime (bundle
 * boundary — string schema + type-only `TaxRuleId` claim). Consumers that can
 * afford the tax-rule-registry import call this checker to assert every
 * limitation ref (top-level and per-action) names a real shipped `TaxRuleId`
 * and matches that registry record's `classification` and `errorDirection`.
 *
 * Do not merge this into the contract module.
 */

import {
  TAX_RULE_REGISTRY,
  type TaxRuleId,
} from '../rules/taxRuleRegistry.js'
import type { TaxStrategyEvaluation } from './taxStrategyEvaluation.js'

export type TaxStrategyLimitationRegistryIssue = Readonly<{
  path: readonly (string | number)[]
  ruleId: string
  message: string
}>

function checkLimitation(
  limitation: TaxStrategyEvaluation['limitations'][number],
  path: readonly (string | number)[],
  issues: TaxStrategyLimitationRegistryIssue[],
): void {
  if (!Object.hasOwn(TAX_RULE_REGISTRY, limitation.ruleId)) {
    issues.push({
      path,
      ruleId: limitation.ruleId,
      message: `limitation ruleId "${limitation.ruleId}" is not a shipped TaxRuleId`,
    })
    return
  }

  const ruleId = limitation.ruleId as TaxRuleId
  const record = TAX_RULE_REGISTRY[ruleId]
  if (limitation.classification !== record.classification) {
    issues.push({
      path: [...path, 'classification'],
      ruleId,
      message:
        `limitation classification "${limitation.classification}" does not match registry ` +
        `"${record.classification}" for ruleId "${ruleId}"`,
    })
  }
  if (limitation.errorDirection !== record.errorDirection) {
    issues.push({
      path: [...path, 'errorDirection'],
      ruleId,
      message:
        `limitation errorDirection ${JSON.stringify(limitation.errorDirection)} does not match ` +
        `registry ${JSON.stringify(record.errorDirection)} for ruleId "${ruleId}"`,
    })
  }
}

/**
 * Validate every limitation ref on the evaluation against TAX_RULE_REGISTRY.
 * Returns a list of mismatch issues (empty = valid). Does not throw.
 */
export function validateTaxStrategyEvaluationLimitations(
  evaluation: TaxStrategyEvaluation,
): TaxStrategyLimitationRegistryIssue[] {
  const issues: TaxStrategyLimitationRegistryIssue[] = []

  evaluation.limitations.forEach((limitation, index) => {
    checkLimitation(limitation, ['limitations', index], issues)
  })

  evaluation.actions.forEach((action, actionIndex) => {
    action.limitations.forEach((limitation, limitationIndex) => {
      checkLimitation(
        limitation,
        ['actions', actionIndex, 'limitations', limitationIndex],
        issues,
      )
    })
  })

  return issues
}

/**
 * Assert every limitation ref matches the registry. Throws when any issue is found.
 */
export function assertTaxStrategyEvaluationLimitations(
  evaluation: TaxStrategyEvaluation,
): void {
  const issues = validateTaxStrategyEvaluationLimitations(evaluation)
  if (issues.length === 0) return
  const summary = issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ')
  throw new Error(`TaxStrategyEvaluation limitation registry check failed: ${summary}`)
}

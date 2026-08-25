/**
 * `@retiregolden/engine/rules` — the tax rule registry as data.
 *
 * Every statutory rule the engine implements, with the authority it rests on,
 * the reading taken, the contrary reading where one exists, and the date it was
 * last verified against primary sources. Consumers use it to answer "why is it
 * calculated this way" — a planner panel, a report appendix, or an advisor
 * defending a number to a CPA — from the same records the engine's tests assert
 * against, so an explanation cannot drift from the behaviour it explains.
 *
 * Kept on its own subpath rather than the minimal package root for the same
 * reason as the generated schema: the records carry quoted statutory text, and
 * importing `simulatePlan` should not pull that in.
 */
export {
  TAX_RULE_REGISTRY,
  taxRule,
  taxRuleIds,
  taxRulesDueForVerification,
  taxRuleDueOn,
  DEFAULT_REVERIFICATION_INTERVAL_DAYS,
  type TaxRuleAuthority,
  type TaxRuleAuthorityKind,
  type TaxRuleClassification,
  type TaxRuleId,
  type TaxRuleRecord,
  type TaxRuleVolatility,
} from './taxRuleRegistry.js'

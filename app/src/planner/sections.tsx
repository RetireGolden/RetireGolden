/**
 * Plan entry sections. Each card edits one slice of the Plan via
 * usePlan().update; validation issues from the Zod schema surface beneath
 * the active section. The section components live in ./sections/; this
 * barrel keeps existing import paths stable.
 */

export { HouseholdSection } from './sections/HouseholdSection'
export { AccountsSection } from './sections/AccountsSection'
export { IncomeSection } from './sections/IncomeSection'
export { IncomeFloorSection } from './sections/IncomeFloorSection'
export { SpendingSection } from './sections/SpendingSection'
export { StrategySection } from './sections/StrategySection'
export { AssumptionsSection } from './sections/AssumptionsSection'
export { InsuranceSection } from './sections/InsuranceSection'

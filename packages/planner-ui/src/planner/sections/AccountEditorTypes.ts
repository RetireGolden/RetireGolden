import type { updateAccountField } from '../eligibilityFactActions'

type UpdateAccountFieldArgs = Parameters<typeof updateAccountField>

/** The field/value portion of the shared account updater used by type-specific editors. */
export type CommitAccountField = (
  key: UpdateAccountFieldArgs[2],
  value: UpdateAccountFieldArgs[3],
) => void

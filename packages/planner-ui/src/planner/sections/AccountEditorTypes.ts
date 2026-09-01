import type { Account } from '@retiregolden/engine/model/plan'

import type { updateAccountField } from '../eligibilityFactActions'

type UpdateAccountFieldArgs = Parameters<typeof updateAccountField>

/** The field/value portion of the shared account updater used by type-specific editors. */
export type CommitAccountField = (
  key: UpdateAccountFieldArgs[2],
  value: UpdateAccountFieldArgs[3],
) => void

type AccountFieldKey<AccountType extends Account> = AccountType extends unknown
  ? keyof AccountType
  : never

/** A type-specific editor may only name fields carried by its discriminated account shape. */
export type CommitAccountFieldFor<AccountType extends Account> = (
  key: Extract<AccountFieldKey<AccountType>, string>,
  value: UpdateAccountFieldArgs[3],
) => void

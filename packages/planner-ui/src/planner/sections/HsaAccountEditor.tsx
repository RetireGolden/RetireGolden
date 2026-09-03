/** Account-type-specific fields for health savings accounts. */

import type { Account } from '@retiregolden/engine/model/plan'

import { CheckboxField, SelectField } from '../fields'
import type { CommitAccountFieldFor } from './AccountEditorTypes'

export function HsaAccountEditor({
  account,
  onCommit,
}: {
  account: Extract<Account, { type: 'hsa' }>
  onCommit: CommitAccountFieldFor<Extract<Account, { type: 'hsa' }>>
}) {
  return (
    <>
      <SelectField
        label="Withdrawal treatment"
        help="How HSA withdrawals are taxed. 'Assume all qualified' treats every withdrawal as a tax- and penalty-free medical reimbursement (simplest; use if you track receipts). 'Cap at modeled medical costs' only lets withdrawals up to your modeled healthcare premiums and care costs come out tax-free. The excess is taxed as ordinary income and, before 65, penalized 20%. Leave on the default to keep the conservative legacy behavior (tax-free but penalized before 65)."
        value={account.withdrawalTreatment ?? 'legacy'}
        options={[
          { value: 'legacy', label: 'Default (tax-free, penalized before 65)' },
          { value: 'assumeAllQualified', label: 'Assume all withdrawals qualified' },
          { value: 'capByMedicalExpenses', label: 'Cap at modeled medical costs' },
        ]}
        onCommit={(value) => {
          const next = value === 'legacy' ? undefined : (value)
          onCommit('withdrawalTreatment', next)
          if (next !== 'capByMedicalExpenses' && account.reimburseLater) onCommit('reimburseLater', undefined)
        }}
      />
      {account.withdrawalTreatment === 'capByMedicalExpenses' ? (
        <CheckboxField
          label="Accumulate unreimbursed expenses (reimburse later)"
          help="Model the 'pay medical costs out of pocket now, reimburse yourself from the HSA later' strategy. Modeled medical costs you don't withdraw for in a given year accumulate as a carryover that future withdrawals can draw against tax-free, letting the HSA keep growing while the reimbursable balance grows with it."
          value={account.reimburseLater === true}
          onCommit={(value) => onCommit('reimburseLater', value ? true : undefined)}
        />
      ) : null}
      <SelectField
        label="Beneficiary"
        help="Who inherits this HSA. A spouse inherits it as their own HSA and it passes untaxed. Any other beneficiary (child, estate, single-person plans) receives a fully taxable distribution of the balance in the year of death, so the after-tax estate metric taxes the remaining HSA at your assumed heir tax rate, like a traditional account."
        hint="Spouse / non-spouse shorthand. An Estate beneficiary set below overrides it."
        value={account.beneficiary ?? 'spouse'}
        options={[
          { value: 'spouse', label: 'Spouse (inherits as HSA, untaxed)' },
          { value: 'nonSpouse', label: 'Non-spouse (fully taxable to heir)' },
        ]}
        onCommit={(value) => onCommit('beneficiary', value === 'spouse' ? undefined : 'nonSpouse')}
      />
    </>
  )
}

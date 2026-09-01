/** Discriminated dispatcher for per-account editors. */

import type { ReactNode } from 'react'

import type { Account } from '@retiregolden/engine/model/plan'

import { AccountEditorShell } from './AccountEditorSharedFields'
import type { CommitAccountField } from './AccountEditorTypes'
import { HsaAccountEditor } from './HsaAccountEditor'
import { EquityCompAccountEditor, TaxableAccountEditor } from './LiquidAccountEditors'
import { AnnuityAccountEditor, PensionAccountEditor } from './PensionAnnuityAccountEditors'
import { DebtAccountEditor, PropertyAccountEditor } from './PropertyDebtAccountEditors'
import { RetirementAccountEditor } from './RetirementAccountEditors'

export function AccountFields({ account, index }: { account: Account; index: number }) {
  return (
    <AccountEditorShell account={account} index={index}>
      {(onCommit) => accountTypeFields(account, index, onCommit)}
    </AccountEditorShell>
  )
}

function accountTypeFields(
  account: Account,
  index: number,
  onCommit: CommitAccountField,
): ReactNode {
  switch (account.type) {
    case 'taxable':
      return <TaxableAccountEditor account={account} onCommit={onCommit} />
    case 'equityComp':
      return <EquityCompAccountEditor account={account} onCommit={onCommit} />
    case 'cash':
      return null
    case 'traditional':
    case 'roth':
      return <RetirementAccountEditor account={account} index={index} onCommit={onCommit} />
    case 'hsa':
      return <HsaAccountEditor account={account} onCommit={onCommit} />
    case 'pension':
      return <PensionAccountEditor account={account} index={index} onCommit={onCommit} />
    case 'annuity':
      return <AnnuityAccountEditor account={account} index={index} onCommit={onCommit} />
    case 'property':
      return <PropertyAccountEditor account={account} index={index} onCommit={onCommit} />
    case 'debt':
      return <DebtAccountEditor account={account} onCommit={onCommit} />
  }
}

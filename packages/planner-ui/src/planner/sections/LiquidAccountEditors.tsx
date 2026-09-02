/** Account-type-specific fields for taxable and equity-compensation accounts. */

import type { Account } from '@retiregolden/engine/model/plan'

import { CheckboxField, MoneyField, PercentField, SelectField, TextField } from '../fields'
import type { CommitAccountFieldFor } from './AccountEditorTypes'
import {
  showTaxExemptAllocationDoubleCountWarning,
  TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING,
} from './sectionHelpers'

const TAX_EXEMPT_INTEREST_HELP =
  "Annual tax-exempt interest from municipal bonds held in this account, as a percent of the account's whole start-of-year balance. Weight a municipal sleeve's yield by its share of the account, and enter that yield here or in Interest yield, not in both fields. This income never joins ordinary taxable income, but it counts toward the income that decides how much of your Social Security is taxable, toward ACA household MAGI, and toward the income Medicare reads for IRMAA two years later. Two limits to know: the model treats none of it as private-activity-bond interest for AMT, and it does not add any of it to state taxable income even though some states tax municipal bonds from other states."

function TaxExemptInterestYieldField({
  account,
  onCommit,
}: {
  account: Extract<Account, { type: 'taxable' }>
  onCommit: (value: number) => void
}) {
  return (
    <>
      <PercentField
        label="Tax-exempt interest yield"
        help={TAX_EXEMPT_INTEREST_HELP}
        value={account.taxExemptInterestYieldPct ?? 0}
        onCommit={(value) => onCommit(value ?? 0)}
      />
      {showTaxExemptAllocationDoubleCountWarning(account) ? (
        <p className="field-hint" style={{ color: 'var(--warn)' }} role="status">
          {TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING}
        </p>
      ) : null}
    </>
  )
}

export function TaxableAccountEditor({
  account,
  index,
  onCommit,
}: {
  account: Extract<Account, { type: 'taxable' }>
  index: number
  onCommit: CommitAccountFieldFor<Extract<Account, { type: 'taxable' }>>
}) {
  return (
    <>
      <MoneyField
        label="Cost basis"
        hint="Aggregate basis; gains realize pro-rata."
        path={`accounts.${index}.costBasis`}
        value={account.costBasis}
        onCommit={(value) => onCommit('costBasis', value ?? 0)}
      />
      {account.allocation === undefined ? (
        <>
          <PercentField
            label="Interest yield"
            help="Annual taxable interest yield generated from this brokerage account before market-price growth."
            path={`accounts.${index}.interestYieldPct`}
            value={account.interestYieldPct ?? 0}
            onCommit={(value) => onCommit('interestYieldPct', value ?? 0)}
          />
          <PercentField
            label="Dividend yield"
            help="Annual dividend yield generated from this brokerage account before market-price growth."
            path={`accounts.${index}.dividendYieldPct`}
            value={account.dividendYieldPct ?? 0}
            onCommit={(value) => onCommit('dividendYieldPct', value ?? 0)}
          />
          <PercentField
            label="Qualified dividends"
            help="Share of dividends taxed at long-term capital-gain rates federally. The rest is taxed as ordinary dividends."
            path={`accounts.${index}.qualifiedRatio`}
            value={(account.qualifiedRatio ?? 0.85) * 100}
            // The engine stores this share as a 0–1 ratio; 0–100 is that same
            // bound in the field's unit, flagged while typing (#496).
            min={0}
            max={100}
            onCommit={(value) => onCommit('qualifiedRatio', Math.min(1, Math.max(0, (value ?? 85) / 100)))}
          />
          <TaxExemptInterestYieldField
            account={account}
            onCommit={(value) => onCommit('taxExemptInterestYieldPct', value)}
          />
          <ReinvestYieldField account={account} onCommit={onCommit} />
        </>
      ) : (
        <>
          <PercentField
            label="Interest yield override"
            help="Optional. Leave blank to use the blended interest yield from the class mix (shown as 'This year's blend' in the asset-class panel below). Enter a value to override it for this account."
            hint="Blank = use blended yield."
            value={account.interestYieldPct ?? null}
            allowNull
            onCommit={(value) => onCommit('interestYieldPct', value ?? undefined)}
          />
          <PercentField
            label="Dividend yield override"
            help="Optional. Leave blank to use the blended dividend yield from the class mix. Enter a value to override it for this account."
            hint="Blank = use blended yield."
            value={account.dividendYieldPct ?? null}
            allowNull
            onCommit={(value) => onCommit('dividendYieldPct', value ?? undefined)}
          />
          <PercentField
            label="Qualified dividends override"
            help="Optional. Leave blank to use the blended qualified share from the class mix. Enter a value to override the share of dividends taxed at long-term capital-gain rates."
            hint="Blank = use blended share."
            path={`accounts.${index}.qualifiedRatio`}
            value={account.qualifiedRatio === undefined ? null : account.qualifiedRatio * 100}
            allowNull
            min={0}
            max={100}
            onCommit={(value) =>
              onCommit(
                'qualifiedRatio',
                value === null || value === undefined ? undefined : Math.min(1, Math.max(0, value / 100)),
              )
            }
          />
          <TaxExemptInterestYieldField
            account={account}
            onCommit={(value) => onCommit('taxExemptInterestYieldPct', value)}
          />
          <ReinvestYieldField account={account} onCommit={onCommit} />
        </>
      )}
    </>
  )
}

function ReinvestYieldField({
  account,
  onCommit,
}: {
  account: Extract<Account, { type: 'taxable' }>
  onCommit: CommitAccountFieldFor<Extract<Account, { type: 'taxable' }>>
}) {
  return (
    <CheckboxField
      label="Reinvest yield"
      help="When checked, interest and dividends stay in the brokerage account and add to basis. When unchecked, they flow into annual cash surplus."
      value={account.reinvestDividends ?? true}
      onCommit={(value) => onCommit('reinvestDividends', value)}
    />
  )
}

export function EquityCompAccountEditor({
  account,
  onCommit,
}: {
  account: Extract<Account, { type: 'equityComp' }>
  onCommit: CommitAccountFieldFor<Extract<Account, { type: 'equityComp' }>>
}) {
  return (
    <>
      <MoneyField
        label="Cost basis"
        hint="Aggregate basis; gains realize pro-rata."
        value={account.costBasis}
        onCommit={(value) => onCommit('costBasis', value ?? 0)}
      />
      <SelectField
        label="Availability"
        value={account.vestingMode}
        options={[
          { value: 'cliff', label: 'Locked until vest date' },
          { value: 'final', label: 'Available now' },
        ]}
        onCommit={(value) => onCommit('vestingMode', value)}
      />
      {account.vestingMode === 'cliff' ? (
        <TextField
          label="Vest date"
          hint="YYYY-MM-DD; balance counts in net worth but is unavailable for withdrawals before this year."
          value={account.vestDate ?? ''}
          onCommit={(value) => onCommit('vestDate', value || null)}
        />
      ) : null}
    </>
  )
}

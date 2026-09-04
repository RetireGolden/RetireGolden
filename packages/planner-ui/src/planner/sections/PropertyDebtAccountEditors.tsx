/** Account-type-specific fields for real property and debt. */

import type { Account } from '@retiregolden/engine/model/plan'
import { packForYear } from '@retiregolden/engine/params'

import { CheckboxField, MoneyField, NumberField, PercentField, SelectField } from '../fields'
import { usePlan } from '../planContextCore'
import type { CommitAccountFieldFor } from './AccountEditorTypes'

export function PropertyAccountEditor({
  account,
  index,
  onCommit,
}: {
  account: Extract<Account, { type: 'property' }>
  index: number
  onCommit: CommitAccountFieldFor<Extract<Account, { type: 'property' }>>
}) {
  const { update } = usePlan()

  return (
    <>
      <MoneyField label="Value" path={`accounts.${index}.value`} value={account.value} onCommit={(v) => onCommit('value', v ?? 0)} />
      <NumberField
        label="Planned sale year"
        path={`accounts.${index}.plannedSaleYear`}
        value={account.plannedSaleYear}
        allowNull
        onCommit={(v) => onCommit('plannedSaleYear', v === null ? null : Math.round(v))}
      />
      <MoneyField
        label="Cost basis"
        help="What you paid for the property plus improvements (not inflation-adjusted). Set this to have the sale taxed exactly: capital-gains tax on the gain above basis, net of selling costs, minus the primary-residence exclusion. Leave blank to fall back to the simple tax-free 'expected net proceeds' estimate below."
        hint="Blank = use expected net proceeds (tax-free)."
        path={`accounts.${index}.costBasis`}
        value={account.costBasis ?? null}
        allowNull
        onCommit={(v) => onCommit('costBasis', v ?? undefined)}
      />
      {account.costBasis !== undefined ? (
        <>
          <PercentField
            label="Selling costs"
            help="Commissions plus closing costs as a percent of the sale price, deducted from the amount realized before computing the gain. Typical all-in cost to sell a home is 6–8%."
            hint="% of sale price."
            value={account.sellingCostPct ?? null}
            allowNull
            onCommit={(v) => onCommit('sellingCostPct', v ?? undefined)}
          />
          <CheckboxField
            label="Primary residence (§121 exclusion)"
            help="If this is your main home and you meet the ownership/use tests (lived there 2 of the last 5 years), the IRS §121 exclusion shields $250,000 of gain ($500,000 if married filing jointly) from tax. Only the gain above the exclusion is taxed."
            value={account.primaryResidence === true}
            onCommit={(v) => onCommit('primaryResidence', v ? true : undefined)}
          />
          <MoneyField
            label="Depreciation to recapture"
            help="Depreciation you claimed (e.g. rental years or a home office). It is recaptured as ordinary income on sale and cannot be shielded by the §121 exclusion. Leave blank if none."
            hint="Blank = none."
            value={account.depreciationRecapture ?? null}
            allowNull
            onCommit={(v) => onCommit('depreciationRecapture', v ?? undefined)}
          />
        </>
      ) : (
        <MoneyField
          label="Expected net proceeds"
          hint="Blank = sell at projected value."
          value={account.expectedNetProceeds}
          allowNull
          onCommit={(v) => onCommit('expectedNetProceeds', v)}
        />
      )}
      <MoneyField
        label="Property tax / year"
        help="Annual property tax in today's dollars. Charged as a recurring expense while you own the home, and, unlike the mortgage, it keeps going after the loan is paid off."
        hint="Today's $; continues after payoff."
        value={account.propertyTaxAnnual ?? null}
        allowNull
        onCommit={(v) => onCommit('propertyTaxAnnual', v ?? undefined)}
      />
      <MoneyField
        label="Insurance / year"
        hint="Homeowner's/hazard insurance, today's $."
        value={account.insuranceAnnual ?? null}
        allowNull
        onCommit={(v) => onCommit('insuranceAnnual', v ?? undefined)}
      />
      <CheckboxField
        label="Model a HECM line of credit"
        help="An FHA reverse-mortgage line of credit on your primary residence (borrowers 62+). The unused line grows every year regardless of home value; draws are tax-free loan proceeds; the loan is repaid from the home at sale or the end of the plan, non-recourse (never more than the home is worth). Turning this on marks the home as your primary residence."
        value={account.hecm !== undefined}
        onCommit={(value) =>
          update((draft) => {
            const property = draft.accounts[index] as Extract<Account, { type: 'property' }>
            if (value) {
              property.primaryResidence = true
              property.hecm = {
                openYear: new Date().getFullYear(),
                growthRatePct: packForYear(new Date().getFullYear()).pack.hecm.defaultGrowthRatePct,
                drawPolicy: 'lastResort',
              }
            } else {
              property.hecm = undefined
            }
          })
        }
      />
      {account.hecm ? (
        <>
          <NumberField
            label="Line opens in"
            help="The year the line of credit is opened. Pfau's research favors opening early. The unused credit compounds from that point regardless of home value."
            value={account.hecm.openYear}
            min={1900}
            max={2200}
            onCommit={(v) => onCommit('hecm', { ...account.hecm!, openYear: Math.round(v ?? new Date().getFullYear()) })}
          />
          <PercentField
            label="Line size (% of value)"
            help="The initial principal limit as a percent of the home's value. Enter your lender-quoted figure. Blank uses the published HUD principal-limit-factor table by the youngest borrower's age (35–61% between 62 and 90 at a 5.875% expected rate)."
            hint="Blank = published factor table."
            value={account.hecm.principalLimitPct ?? null}
            allowNull
            onCommit={(v) => onCommit('hecm', { ...account.hecm!, principalLimitPct: v ?? undefined })}
          />
          <PercentField
            label="Line & loan growth / yr"
            help="Annual growth applied to both the credit line and the loan balance: the note rate plus the 0.5% annual mortgage-insurance premium (roughly 7–8% at 2026 rates)."
            value={account.hecm.growthRatePct}
            onCommit={(v) => onCommit('hecm', { ...account.hecm!, growthRatePct: v ?? 7.5 })}
          />
          <PercentField
            label="Upfront costs (% of value)"
            help="Origination, closing costs, and the initial 2% FHA mortgage-insurance premium, financed into the loan balance at open (typically 3–6% of home value)."
            hint="Blank = none."
            value={account.hecm.upfrontCostPct ?? null}
            allowNull
            onCommit={(v) => onCommit('hecm', { ...account.hecm!, upfrontCostPct: v ?? undefined })}
          />
          <SelectField
            label="Draw policy"
            help="Coordinated (buffer asset): draw for spending in years after a negative market return so depressed holdings can recover, visible in Monte Carlo, where down years exist. Last resort: draw only once the portfolio cannot cover spending. Either way an open line backstops a true shortfall."
            value={account.hecm.drawPolicy}
            options={[
              { value: 'lastResort', label: 'Last resort (when portfolio is exhausted)' },
              { value: 'coordinated', label: 'Coordinated (after down market years)' },
            ]}
            onCommit={(v) => onCommit('hecm', { ...account.hecm!, drawPolicy: v })}
          />
        </>
      ) : null}
    </>
  )
}

export function DebtAccountEditor({
  account,
  index,
  onCommit,
}: {
  account: Extract<Account, { type: 'debt' }>
  index: number
  onCommit: CommitAccountFieldFor<Extract<Account, { type: 'debt' }>>
}) {
  return (
    <>
      <PercentField label="Interest rate" path={`accounts.${index}.interestPct`} value={account.interestPct} onCommit={(v) => onCommit('interestPct', v ?? 0)} />
      <MoneyField
        label="Monthly payment"
        help="Principal & interest only. Don't include escrowed property tax or homeowner's insurance here. Put those on the home (property) account so they correctly continue after the loan is paid off."
        hint="P&I only, escrow goes on the home account."
        path={`accounts.${index}.monthlyPayment`}
        value={account.monthlyPayment}
        onCommit={(v) => onCommit('monthlyPayment', v ?? 0)}
      />
      <NumberField
        label="Lump-sum payoff year"
        help="Optional. In this year the entire remaining balance is paid off at once, funded from your withdrawal order (selling taxable holdings realizes gains/tax, just like any other withdrawal). Use it to compare keeping a low-rate loan vs. paying it off early or mid-retirement."
        hint="Blank = run to term."
        path={`accounts.${index}.payoffYear`}
        value={account.payoffYear ?? null}
        allowNull
        onCommit={(v) => onCommit('payoffYear', v === null ? undefined : Math.round(v))}
      />
    </>
  )
}

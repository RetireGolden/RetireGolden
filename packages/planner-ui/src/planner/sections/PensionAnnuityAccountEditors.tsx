/** Account-type-specific fields for pensions and annuities. */

import { useMemo } from 'react'

import { analyzePensionElections } from '@retiregolden/engine/decisions/pensionElection'
import {
  ANNUITY_MAX_START_AGE,
  type Account,
  type Plan,
} from '@retiregolden/engine/model/plan'

import {
  ANNUITY_MIN_START_AGE,
  PENSION_MAX_START_AGE,
  PENSION_MIN_START_AGE,
} from '../../accountStartAgeBounds'
import { CheckboxField, MoneyField, NumberField, PercentField, ReadonlyField, SelectField } from '../fields'
import { fmtMoney } from '../format'
import { updateAccountField } from '../eligibilityFactActions'
import { usePlan } from '../planContextCore'
import { currentStartYear } from '../useProjection'
import {
  annuityStartAgeBounds,
  annuityStartAgeHelp,
  clampedAnnuityStartAge,
} from './sectionHelpers'
import type { CommitAccountFieldFor } from './AccountEditorTypes'
import { ScrollRegion } from '../ScrollRegion'

/**
 * The lowest election year the engine's parse rule will accept for an elected
 * lump sum: the later of the current UTC year (what the save stamp will carry)
 * and the document's stored stamp year. A stored stamp can be ahead of the wall
 * clock, and the parse rule compares against that stamp, so the stamp must win.
 */
function electionFloorYear(plan: Plan): number {
  const stamped = /^(\d{4})-/.exec(plan.updatedAtIso)
  const stampYear = stamped === null ? 0 : Number(stamped[1])
  return Math.max(new Date().getUTCFullYear(), stampYear)
}

/**
 * Whether an account can fund an annuity purchase with the selected
 * qualification. An inherited IRA is still `type: 'traditional'`, but those
 * dollars cannot fund a household-owned contract and parse rejects the shape.
 * Keep this helper on the option list, still-eligible check, and re-default so
 * all three paths enforce the same ownership boundary.
 */
function canFundAnnuityPurchase(account: Account, taxQualification: 'qualified' | 'nonQualified'): boolean {
  return taxQualification === 'qualified'
    ? account.type === 'traditional' && !account.inherited
    : account.type === 'cash' || account.type === 'taxable' || account.type === 'equityComp'
}

export function PensionAccountEditor({
  account,
  index,
  onCommit,
}: {
  account: Extract<Account, { type: 'pension' }>
  index: number
  onCommit: CommitAccountFieldFor<Extract<Account, { type: 'pension' }>>
}) {
  const { plan, update } = usePlan()
  return (
    <>
      <SelectField
        label="Pension source"
        help="Used for state income tax when public civil-service or military pensions receive a different exclusion than private retirement income."
        value={account.source ?? 'private'}
        options={[
          { value: 'private', label: 'Private pension' },
          { value: 'public', label: 'Public / military pension' },
        ]}
        onCommit={(v) => onCommit('source', v)}
      />
      <NumberField
        label="Start age"
        value={account.startAge}
        min={PENSION_MIN_START_AGE}
        max={PENSION_MAX_START_AGE}
        onCommit={(v) =>
          onCommit(
            'startAge',
            Math.max(PENSION_MIN_START_AGE, Math.min(PENSION_MAX_START_AGE, Math.round(v ?? 65))),
          )
        }
      />
      <MoneyField label="Monthly amount" value={account.monthlyAmount} onCommit={(v) => onCommit('monthlyAmount', v ?? 0)} />
      <PercentField label="COLA" value={account.colaPct} onCommit={(v) => onCommit('colaPct', v ?? 0)} />
      <PercentField label="Survivor benefit" value={account.survivorPct} onCommit={(v) => onCommit('survivorPct', v ?? 0)} />
      <CheckboxField
        label="Lump-sum offer on record"
        help="Record a lump-sum buyout offer to unlock the decision view: the annuity's discounted present value against the offer, a discount-rate × longevity sensitivity table, and the survivor option's value. Recording the offer changes nothing in the projection until you elect it."
        value={account.lumpSumOffer !== undefined}
        onCommit={(value) =>
          update((draft) => {
            const pension = draft.accounts[index] as Extract<Account, { type: 'pension' }>
            if (value) {
              pension.lumpSumOffer = { amount: 0, electionYear: new Date().getFullYear() }
            } else {
              pension.lumpSumOffer = undefined
              pension.lumpSumElection = undefined
            }
          })
        }
      />
      {account.lumpSumOffer ? (
        <>
          <MoneyField
            label="Lump sum offered"
            help="The one-time payment offered instead of the lifetime annuity (from your plan administrator's election packet)."
            value={account.lumpSumOffer.amount}
            onCommit={(v) => onCommit('lumpSumOffer', { ...account.lumpSumOffer!, amount: v ?? 0 })}
          />
          <NumberField
            label="Election year"
            help="The year the election is due, and the year the lump sum would be paid if taken. Taking the lump sum needs a year that has not passed yet: if the rollover already happened, clear the election and add its dollars to the receiving account balance."
            value={account.lumpSumOffer.electionYear}
            // An offer kept for comparison may be historical, but an elected
            // rollover needs a projection year that has not passed. Bound the
            // field to the same floor the engine checks against the save stamp.
            min={account.lumpSumElection ? electionFloorYear(plan) : 1900}
            max={2200}
            onCommit={(v) =>
              onCommit('lumpSumOffer', {
                ...account.lumpSumOffer!,
                electionYear: Math.round(v ?? electionFloorYear(plan)),
              })
            }
          />
          <SelectField
            label="Election"
            help="Take the lump sum: in the election year the offer rolls over tax-free into the chosen traditional IRA/401(k) and the pension never pays its annuity. Keep the annuity: the offer stays on record for comparison only. Taking the lump sum requires a traditional account you own to receive the rollover. An inherited IRA cannot receive it."
            value={account.lumpSumElection ? 'lumpSum' : 'annuity'}
            options={[
              { value: 'annuity', label: 'Keep the annuity (undecided)' },
              ...(plan.accounts.some((candidate) => candidate.type === 'traditional' && !candidate.inherited)
                ? [{ value: 'lumpSum', label: 'Take the lump sum (rollover)' }]
                : []),
            ]}
            onCommit={(value) => {
              const target = plan.accounts.find((candidate) => candidate.type === 'traditional' && !candidate.inherited)
              // Electing can revive a historical offer. Bump its year and set
              // the election atomically so the intermediate plan never carries
              // the parse-invalid combination of an elected past-year rollover.
              const electionYear = account.lumpSumOffer!.electionYear
              const floorYear = electionFloorYear(plan)
              update((draft) => {
                if (value === 'lumpSum' && target && electionYear < floorYear) {
                  updateAccountField(draft, index, 'lumpSumOffer', { ...account.lumpSumOffer!, electionYear: floorYear })
                }
                updateAccountField(
                  draft,
                  index,
                  'lumpSumElection',
                  value === 'lumpSum' && target ? { rolloverAccountId: target.id } : undefined,
                )
              })
            }}
          />
          {account.lumpSumElection ? (
            <SelectField
              label="Rollover account"
              help="The traditional account receiving the tax-free direct rollover in the election year."
              value={account.lumpSumElection.rolloverAccountId}
              options={plan.accounts
                .filter((candidate) => candidate.type === 'traditional' && !candidate.inherited)
                .map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              onCommit={(v) => onCommit('lumpSumElection', { rolloverAccountId: v })}
            />
          ) : null}
          <PensionDecisionPanel plan={plan} pensionId={account.id} />
        </>
      ) : null}
    </>
  )
}

export function AnnuityAccountEditor({
  account,
  index,
  onCommit,
}: {
  account: Extract<Account, { type: 'annuity' }>
  index: number
  onCommit: CommitAccountFieldFor<Extract<Account, { type: 'annuity' }>>
}) {
  const { plan, update } = usePlan()
  const startAgeBounds = annuityStartAgeBounds(plan, account)
  /**
   * Purchase qualification, QLAC status, purchase year, and the typed start age
   * can all move the legal ceiling. The input's `max` only constrains its own
   * stepper, so each related edit must carry the clamp and land it in the same
   * update block; otherwise the household briefly authors a plan parse refuses.
   */
  const commitWithStartAgeClamp = (key: string, value: unknown, edited: Extract<Account, { type: 'annuity' }>) => {
    const clamped = clampedAnnuityStartAge(plan, edited)
    update((draft) => {
      updateAccountField(draft, index, key, value)
      if (clamped !== null) updateAccountField(draft, index, 'startAge', clamped)
    })
  }
  const setPurchase = (purchase: Extract<Account, { type: 'annuity' }>['purchase']) => {
    commitWithStartAgeClamp('purchase', purchase, { ...account, purchase })
  }

  return (
    <>
      <NumberField
        label="Start age"
        help={annuityStartAgeHelp(startAgeBounds)}
        value={account.startAge}
        min={ANNUITY_MIN_START_AGE}
        max={startAgeBounds?.binding ?? ANNUITY_MAX_START_AGE}
        onCommit={(v) => onCommit('startAge', clampedAnnuityStartAge(plan, { ...account, startAge: Math.round(v ?? 65) }) ?? Math.round(v ?? 65))}
      />
      <MoneyField label="Monthly amount" value={account.monthlyAmount} onCommit={(v) => onCommit('monthlyAmount', v ?? 0)} />
      <PercentField label="COLA" value={account.colaPct} onCommit={(v) => onCommit('colaPct', v ?? 0)} />
      {!account.purchase ? (
        <PercentField
          label="Taxable share"
          hint="Simplified exclusion ratio."
          value={account.taxablePct}
          onCommit={(v) => onCommit('taxablePct', v ?? 0)}
        />
      ) : (
        <ReadonlyField
          label="Taxable share"
          value="Determined by purchase (exclusion ratio for non-qualified; fully taxable for qualified)"
        />
      )}
      <SelectField
        label="Payout form"
        help="Life only: payments stop at the owner's death (the default). Life with period certain: payments are guaranteed for N years from the start age, if the owner dies inside the window, the household keeps receiving them. Joint & survivor: payments continue to the other household member at the chosen share for their lifetime. Non-qualified exclusion-ratio taxation adjusts to the form."
        value={account.payoutForm?.kind ?? 'lifeOnly'}
        options={[
          { value: 'lifeOnly', label: 'Life only' },
          { value: 'periodCertain', label: 'Life with period certain' },
          ...(plan.household.people.length >= 2 ? [{ value: 'jointSurvivor', label: 'Joint & survivor' }] : []),
        ]}
        onCommit={(value) =>
          onCommit(
            'payoutForm',
            value === 'periodCertain'
              ? { kind: 'periodCertain', certainYears: account.payoutForm?.kind === 'periodCertain' ? account.payoutForm.certainYears : 10 }
              : value === 'jointSurvivor'
                ? { kind: 'jointSurvivor', survivorPct: account.payoutForm?.kind === 'jointSurvivor' ? account.payoutForm.survivorPct : 50 }
                : undefined,
          )
        }
      />
      {account.payoutForm?.kind === 'periodCertain' ? (
        <NumberField
          label="Guaranteed years"
          help="Years of payments guaranteed from the start age, paid to the household even if the owner dies inside the window."
          value={account.payoutForm.certainYears}
          min={1}
          max={40}
          onCommit={(v) => onCommit('payoutForm', { kind: 'periodCertain', certainYears: Math.round(v ?? 10) })}
        />
      ) : null}
      {account.payoutForm?.kind === 'jointSurvivor' ? (
        <PercentField
          label="Survivor share"
          help="Percent of the payment continuing to the surviving joint annuitant for their lifetime (100% / 75% / 50% are the common contract options)."
          value={account.payoutForm.survivorPct}
          onCommit={(v) => onCommit('payoutForm', { kind: 'jointSurvivor', survivorPct: Math.min(100, Math.max(1, v ?? 50)) })}
        />
      ) : null}
      <CheckboxField
        label="Model a purchase event"
        help="Configure an annuity purchase: the engine withdraws the premium from a funding account in the purchase year, then applies IRS exclusion-ratio taxation for non-qualified purchases or fully ordinary taxation for qualified purchases. QLAC purchases are capped at the statutory limit."
        value={account.purchase !== undefined}
        onCommit={(value) => {
          const defaultFunding = plan.accounts.find(
            (candidate) =>
              candidate.id !== account.id &&
              (candidate.type === 'cash' || candidate.type === 'taxable' || candidate.type === 'equityComp'),
          )
          setPurchase(
            value
              ? {
                  year: new Date().getFullYear(),
                  premium: 100_000,
                  fundingAccountId: defaultFunding?.id ?? '',
                  taxQualification: 'nonQualified',
                }
              : undefined,
          )
        }}
      />
      {account.purchase ? (
        <>
          <NumberField
            label="Purchase year"
            value={account.purchase.year}
            min={1900}
            max={2200}
            onCommit={(v) => setPurchase({ ...account.purchase!, year: Math.round(v ?? new Date().getFullYear()) })}
          />
          <MoneyField
            label="Premium"
            help="The lump sum paid to purchase the annuity contract, withdrawn from the funding account in the purchase year."
            value={account.purchase.premium}
            onCommit={(v) => setPurchase({ ...account.purchase!, premium: v ?? 0 })}
          />
          <SelectField
            label="Funding account"
            help="Which account the premium is withdrawn from. Non-qualified purchases must come from cash, taxable, or equity comp; qualified purchases from a traditional IRA or 401(k) you own. An inherited IRA cannot fund one."
            value={account.purchase.fundingAccountId}
            options={plan.accounts
              .filter(
                (candidate) =>
                  candidate.id !== account.id && canFundAnnuityPurchase(candidate, account.purchase!.taxQualification),
              )
              .map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            onCommit={(v) => setPurchase({ ...account.purchase!, fundingAccountId: v })}
          />
          <SelectField
            label="Tax qualification"
            help="Non-qualified: purchased with after-tax money; payouts use the IRS Pub 939 exclusion ratio (part tax-free, part taxable) until the investment is recovered. Qualified: purchased with pre-tax IRA/401(k) money; every payout is fully ordinary income."
            value={account.purchase.taxQualification}
            options={[
              { value: 'nonQualified', label: 'Non-qualified (after-tax money)' },
              { value: 'qualified', label: 'Qualified (pre-tax IRA/401k)' },
            ]}
            onCommit={(value) => {
              const taxQualification = value as 'nonQualified' | 'qualified'
              const stillEligible = plan.accounts.some(
                (candidate) =>
                  candidate.id === account.purchase!.fundingAccountId && canFundAnnuityPurchase(candidate, taxQualification),
              )
              const fundingAccountId = stillEligible
                ? account.purchase!.fundingAccountId
                : plan.accounts.find(
                    (candidate) => candidate.id !== account.id && canFundAnnuityPurchase(candidate, taxQualification),
                  )?.id ?? ''
              setPurchase({
                ...account.purchase!,
                taxQualification,
                fundingAccountId,
                qlac: taxQualification === 'nonQualified' ? undefined : account.purchase!.qlac,
              })
            }}
          />
          {account.purchase.taxQualification === 'qualified' ? (
            <CheckboxField
              label="QLAC (qualified longevity annuity)"
              help="A deferred-start longevity annuity purchased inside a traditional account. The premium is capped at the SECURE 2.0 statutory limit ($210,000 for 2026) and excluded from the RMD base until payouts begin. Payments still have to begin by the first of the month after your 85th birthday — that is what makes it a QLAC."
              value={account.purchase.qlac === true}
              onCommit={(v) => setPurchase({ ...account.purchase!, qlac: v || undefined })}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}

/** Deterministic pension lump-sum decision view. */
function PensionDecisionPanel({ plan, pensionId }: { plan: Plan; pensionId: string }) {
  // Capture per render so a start-year rollover invalidates the memo even when
  // the plan itself has not been edited.
  const startYear = currentStartYear()
  const analysis = useMemo(
    () => analyzePensionElections(plan, startYear).find((candidate) => candidate.pensionId === pensionId),
    [plan, pensionId, startYear],
  )
  if (!analysis) return null
  if (analysis.lumpSum <= 0) {
    return (
      <p className="muted field-span-full" style={{ margin: 0 }}>
        Enter the offered amount to see the decision view: the annuity's discounted value against the lump sum across
        discount rates and longevity.
      </p>
    )
  }
  const ratio = analysis.presentValueAtCurveRate / analysis.lumpSum
  const survivorOptionValue = analysis.presentValueAtCurveRate - analysis.presentValueSingleLife
  return (
    <div className="field-span-full">
      <h4 style={{ marginBottom: '0.25rem' }}>Lump sum vs annuity</h4>
      <p className="card-hint" style={{ marginTop: 0 }}>
        At the {analysis.curveRatePct.toFixed(1)}% curve-anchored discount rate (TIPS real yield + your inflation
        assumption) to the owner's planning age, the annuity's payments are worth{' '}
        <strong>{fmtMoney(analysis.presentValueAtCurveRate)}</strong> against the{' '}
        <strong>{fmtMoney(analysis.lumpSum)}</strong> offer ({(ratio * 100).toFixed(0)}%).
        {survivorOptionValue > 1 ? (
          <> The survivor continuation accounts for {fmtMoney(survivorOptionValue)} of that value.</>
        ) : null}{' '}
        Living longer or discounting at lower rates favors the annuity; dying earlier, higher rates, bequest goals, and
        control over the money favor the lump sum. The table shows how the comparison moves, and the Insights page can
        preview the rollover against your full plan. A tradeoff, not advice.
      </p>
      <ScrollRegion label={`Lump sum vs annuity: ${analysis.pensionName}`} style={{ border: 'none' }}>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Annuity value ÷ offer</th>
              {analysis.sensitivity.discountRatesPct.map((rate) => (
                <th key={rate}>{rate.toFixed(1)}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.sensitivity.rows.map((row) => (
              <tr key={row.ownerDeathAge}>
                <td>To age {row.ownerDeathAge}</td>
                {row.cells.map((cell) => (
                  <td key={cell.discountRatePct} title={fmtMoney(cell.presentValue)}>
                    {(cell.ratioToLumpSum * 100).toFixed(0)}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </div>
  )
}

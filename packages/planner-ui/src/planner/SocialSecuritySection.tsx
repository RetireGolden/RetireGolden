/**
 * Social Security entry. Reuses the household profile (date of birth, planning
 * age) so the user only adds what's new per person: the benefit (a quick PIA
 * or an imported earnings record) and a claiming age. The claim-age trade-off
 * analysis lives on Explore → Social Security.
 */

import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'

import type { FormerSpouse, IncomeStream, Person } from '@retiregolden/engine/model/plan'
import {
  bendTierForAime,
  CREDITS_FOR_ELIGIBILITY,
  estimateCredits,
  replaceZeroYearGain,
  summarizeComputation,
} from '../socialSecurity/explain'
import { DIVORCED_MIN_MARRIAGE_YEARS, SURVIVOR_MIN_MARRIAGE_YEARS } from '@retiregolden/engine/socialSecurity/maritalBenefits'
import { effectiveBirthYear, fraForBirthYear } from '@retiregolden/engine/socialSecurity/nra'
import type { PiaFromEarningsResult } from '@retiregolden/engine/socialSecurity/piaFromEarnings'
import { parseSsaStatementXml } from '../socialSecurity/ssaStatementXml'
import {
  IMPORT_PENDING_MESSAGE,
  IMPORT_UNAVAILABLE_MESSAGE,
  useImportAvailability,
} from '../import/importAvailability'
import { usePlan } from './planContextCore'
import { CheckboxField, DateField, NumberField, MoneyField, SelectField } from './fields'
import { LearnAboutScreen } from '../learn/LearnAboutScreen'
import { fmtMoney } from './format'
import { dobParts, resolvePia } from './ssAnalysis'
import { ordinalSuffixes, PIA_MONTHLY_AT_FRA_LABEL } from './sections/sectionHelpers'
import { Issues } from './sections/shared'

/**
 * The survivor floor as people read it, in one unit: months when the engine's
 * value is a whole number of months (the statutory wording), else years
 * exactly as the engine states it, so the copy never rounds the floor to
 * something the engine does not apply.
 */
function survivorFloorLabel(): string {
  const months = SURVIVOR_MIN_MARRIAGE_YEARS * 12
  return Number.isInteger(months) ? `${months} months` : `${SURVIVOR_MIN_MARRIAGE_YEARS} years`
}

const newId = () => crypto.randomUUID()

type SsStream = Extract<IncomeStream, { type: 'socialSecurity' }>

/** Teaching panel: how the earnings history becomes a PIA (AIME, zero years, bend tier). */
function AimeExplainer({ detail, sampleEarnings }: { detail: PiaFromEarningsResult; sampleEarnings: number | null }) {
  const s = summarizeComputation(detail)
  const tier = bendTierForAime(detail.aime, detail.eligibilityYear)
  const gain = sampleEarnings && sampleEarnings > 0 ? replaceZeroYearGain(detail, sampleEarnings) : null
  const tierAside =
    tier.label === '90%' ? ', the most valuable tier' : tier.label === '15%' ? ', the least valuable tier, so extra earnings add little' : ''
  return (
    <details className="ss-explainer">
      <summary>How this benefit is built: AIME &amp; bend points</summary>
      <ul>
        <li>
          Averages your top <strong>{s.computationYearCount}</strong> earning years (wage-indexed) into an AIME of{' '}
          <strong>{fmtMoney(detail.aime)}/mo</strong>.
        </li>
        {s.zeroYearsInAime > 0 ? (
          <li>
            <strong>{s.zeroYearsInAime}</strong> of those {s.computationYearCount} years are $0. Each one pulls the
            average down.
          </li>
        ) : (
          <li>Every averaged year has earnings, no zero years dragging the average down.</li>
        )}
        <li>
          Your next dollar of AIME is credited at the <strong>{tier.label}</strong> bend-point rate{tierAside}.
        </li>
        {gain !== null && s.zeroYearsInAime > 0 ? (
          <li>
            Replacing one $0 year with about {fmtMoney(sampleEarnings!)} of earnings would add roughly{' '}
            <strong>{fmtMoney(gain)}/mo</strong>: a rough estimate at the current bend rate.
          </li>
        ) : null}
      </ul>
    </details>
  )
}

/** 40-credit (10-year) covered-work eligibility gate with an optional manual override. */
function EligibilityNote({ stream, onCommitCredits }: { stream: SsStream; onCommitCredits: (v: number | null) => void }) {
  const est = estimateCredits(stream.earnings ?? [], stream.coveredQuarters)
  return (
    <div style={{ marginTop: '0.6rem' }}>
      <div className="form-grid">
        <NumberField
          label="Covered-work credits"
          help="SSA 'credits' (formerly quarters of coverage). You generally need 40 (about 10 years of covered work) to qualify for your own retirement benefit. Leave blank to estimate from the earnings above; set it if you know the exact number."
          hint={est.estimated ? `Blank = estimated ${est.credits} from your earnings (40 needed).` : '40 needed to qualify.'}
          value={stream.coveredQuarters ?? null}
          allowNull
          min={0}
          max={40}
          onCommit={(v) => onCommitCredits(v === null ? null : Math.round(v))}
        />
      </div>
      {!est.eligible ? (
        <div className="callout callout--warn">
          {est.estimated ? 'Estimated' : 'Entered'} <strong>{est.credits}</strong> of the {CREDITS_FOR_ELIGIBILITY}{' '}
          credits needed, not yet eligible for a personal retirement benefit. Add covered-work years above or set the
          credit count if the estimate is off (it assumes 4 credits per substantial year).
        </div>
      ) : null}
    </div>
  )
}

/**
 * Editor for divorced-spousal / survivor benefit records on a former spouse's
 * PIA. Exported for its own rendering test (#535); the section renders it.
 */
export function FormerSpousesEditor({
  stream,
  setStream,
  householdIsSingle,
}: {
  stream: SsStream
  setStream: (mut: (s: SsStream) => void) => void
  householdIsSingle: boolean
}) {
  const records = stream.formerSpouses ?? []
  // Two records of the same kind carry only a chip for a title; the ordinal
  // keeps them and their Remove buttons apart (same family as #541, #549).
  const ordinals = ordinalSuffixes(records.map((r) => r.relationship))
  const add = (relationship: 'divorced' | 'deceased') =>
    setStream((s) => {
      const list = s.formerSpouses ?? (s.formerSpouses = [])
      list.push({
        id: newId(),
        relationship,
        dob: '1960-01-01',
        piaMonthly: 0,
        // A new divorced record opens at the engine's own floor (the statute
        // lives there, not here); a deceased record keeps its long-standing
        // one-year default, which is above the survivor floor. The fields
        // below say so while a value sits under either floor.
        marriageYears: relationship === 'divorced' ? DIVORCED_MIN_MARRIAGE_YEARS : 1,
        remarriedAtAge: null,
      })
    })
  const updateRecord = (id: string, mut: (r: FormerSpouse) => void) =>
    setStream((s) => {
      const r = s.formerSpouses?.find((x) => x.id === id)
      if (r) mut(r)
    })
  const remove = (id: string) =>
    setStream((s) => {
      if (s.formerSpouses) s.formerSpouses = s.formerSpouses.filter((x) => x.id !== id)
    })

  return (
    <div style={{ marginTop: '0.8rem' }}>
      <h4 style={{ margin: '0 0 0.3rem' }}>Former spouses</h4>
      <p className="card-hint">
        A {DIVORCED_MIN_MARRIAGE_YEARS}+ year marriage to a living ex (while you're currently unmarried) can pay a divorced-spousal benefit of up to
        half their benefit; a deceased former spouse can pay a survivor benefit. You receive whichever is largest of your
        own, spousal, and survivor benefits, so add any that might apply.
      </p>
      {records.map((r, i) => {
        // A divorced-spousal record cannot pay while a partner is on the plan
        // (the engine returns nothing for it), so the card says so in its
        // title and its amount fields are disabled rather than left looking
        // live; the type select stays live so the record can be changed or
        // the card removed, and every control is described by the note (#535).
        const inapplicable = r.relationship === 'divorced' && !householdIsSingle
        // Each kind has its own floor in the engine (maritalBenefitFor returns
        // nothing under it); the note names the one that applies.
        const minYears = r.relationship === 'divorced' ? DIVORCED_MIN_MARRIAGE_YEARS : SURVIVOR_MIN_MARRIAGE_YEARS
        const underMinYears = r.marriageYears < minYears
        // Both conditions can hold at once; each has its own note so the
        // ten-year floor is disclosed even while the partner rule applies.
        const partnerNoteId = `former-spouse-${r.id}-partner-note`
        const yearsNoteId = `former-spouse-${r.id}-years-note`
        const describedBy =
          [inapplicable ? partnerNoteId : '', underMinYears ? yearsNoteId : ''].filter(Boolean).join(' ') || undefined
        const kindLabel = r.relationship === 'divorced' ? 'Divorced ex' : 'Survivor'
        return (
          <div key={r.id} className="item-row">
            <div className="item-row-head">
              <span className="item-row-title">
                {/* Chip and ordinal share one box, so the flex gap falls only
                    before the "Not applied" chip; the box carries the
                    direct-child chip protection (item-row-kind). */}
                <span className="item-row-kind">
                  <span className="type-chip">{kindLabel}</span>
                  {ordinals[i]}
                </span>
                {inapplicable ? <span className="type-chip type-chip--muted">Not applied</span> : null}
              </span>
              <button
                type="button"
                className="btn-ghost btn-ghost-danger"
                aria-label={`Remove ${kindLabel.toLowerCase()} record${ordinals[i]}`}
                onClick={() => remove(r.id)}
              >
                Remove
              </button>
            </div>
            <div className="form-grid">
              <SelectField
                label="Type"
                value={r.relationship}
                options={[
                  { value: 'divorced', label: 'Living ex (divorced-spousal)' },
                  { value: 'deceased', label: 'Deceased (survivor)' },
                ]}
                describedBy={describedBy}
                onCommit={(v) => updateRecord(r.id, (x) => (x.relationship = v as FormerSpouse['relationship']))}
              />
              <DateField
                label="Their date of birth"
                value={r.dob}
                disabled={inapplicable}
                describedBy={describedBy}
                onCommit={(v) => updateRecord(r.id, (x) => (x.dob = v))}
              />
              <MoneyField
                label={`Their ${PIA_MONTHLY_AT_FRA_LABEL}`}
                help="Your estimate of the ex/deceased spouse's monthly benefit at their full retirement age, today's dollars."
                value={r.piaMonthly}
                disabled={inapplicable}
                describedBy={describedBy}
                onCommit={(v) => updateRecord(r.id, (x) => (x.piaMonthly = v ?? 0))}
              />
              <NumberField
                label="Years married"
                hint={
                  r.relationship === 'divorced'
                    ? `${DIVORCED_MIN_MARRIAGE_YEARS}+ for divorced-spousal.`
                    : `${survivorFloorLabel()} minimum.`
                }
                value={r.marriageYears}
                min={0}
                max={75}
                step={r.relationship === 'divorced' ? 1 : 0.25}
                disabled={inapplicable}
                describedBy={describedBy}
                onCommit={(v) => updateRecord(r.id, (x) => (x.marriageYears = v ?? 0))}
              />
              {r.relationship === 'deceased' ? (
                <NumberField
                  label="Age you remarried"
                  help="Remarrying before 60 forfeits this survivor benefit; at or after 60 preserves it. Leave blank if you didn't remarry after this spouse died."
                  value={r.remarriedAtAge}
                  allowNull
                  min={0}
                  max={120}
                  onCommit={(v) => updateRecord(r.id, (x) => (x.remarriedAtAge = v === null ? null : Math.round(v)))}
                />
              ) : null}
              {r.relationship === 'deceased' ? (
                <NumberField
                  label="When they claimed (age)"
                  hint="Leave blank if they claimed at/after FRA."
                  help="The age the deceased claimed their own benefit. If they claimed early (before FRA), the widow's-limit (RIB-LIM) caps your survivor benefit at the larger of their reduced benefit or 82.5% of their PIA, usually higher than their reduced amount. Leave blank if they claimed at or after FRA (the safe default)."
                  value={r.deceasedClaimAge?.years ?? null}
                  allowNull
                  min={62}
                  max={70}
                  onCommit={(v) =>
                    updateRecord(r.id, (x) => {
                      if (v === null) x.deceasedClaimAge = null
                      else x.deceasedClaimAge = { years: Math.round(v), months: x.deceasedClaimAge?.months ?? 0 }
                    })
                  }
                />
              ) : null}
              {r.relationship === 'deceased' && r.deceasedClaimAge ? (
                <NumberField
                  label="When they claimed (+ months)"
                  value={r.deceasedClaimAge.months}
                  min={0}
                  max={11}
                  onCommit={(v) =>
                    updateRecord(r.id, (x) => {
                      if (x.deceasedClaimAge) x.deceasedClaimAge = { ...x.deceasedClaimAge, months: Math.round(v ?? 0) }
                    })
                  }
                />
              ) : null}
            </div>
            {inapplicable ? (
              <p id={partnerNoteId} className="field-hint" style={{ color: 'var(--warn)' }}>
                Divorced-spousal needs you to be currently unmarried. With a partner on this plan it won't apply (you'd get
                the current-spouse top-up instead). The record is kept; its date, benefit, and years fields are off while a
                partner is on the plan. Change its type, or remove it.
              </p>
            ) : null}
            {underMinYears ? (
              <p id={yearsNoteId} className="field-hint" style={{ color: 'var(--warn)' }}>
                {r.relationship === 'divorced'
                  ? `A divorced-spousal benefit needs a marriage of ${DIVORCED_MIN_MARRIAGE_YEARS} or more years.`
                  : `A survivor benefit needs a marriage of at least ${survivorFloorLabel()}.`}{' '}
                Under that, this record pays nothing.
              </p>
            ) : null}
          </div>
        )
      })}
      <div className="add-row">
        <button type="button" className="btn btn-secondary btn-small" onClick={() => add('divorced')}>
          + Divorced ex-spouse
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => add('deceased')}>
          + Deceased former spouse
        </button>
      </div>
    </div>
  )
}

function PersonSsCard({ person, personIndex }: { person: Person; personIndex: number }) {
  const { plan, update } = usePlan()
  const { enabled: importEnabled, resolved: importResolved } = useImportAvailability()
  const stream = plan.incomes.find((s): s is SsStream => s.type === 'socialSecurity' && s.personId === person.id)
  const { y, m, d } = dobParts(person)
  const fra = fraForBirthYear(effectiveBirthYear(y, m, d))
  const [xmlNote, setXmlNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  if (!stream) {
    return (
      <div className="item-row">
        <div className="item-row-head">
          <span className="item-row-title">
            <span className="type-chip">{personIndex === 0 ? 'Primary' : 'Partner'}</span>
            {person.name}
          </span>
        </div>
        <p className="card-hint" style={{ marginBottom: '0.6rem' }}>
          No Social Security benefit is modeled for {person.name} yet.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() =>
            update((d2) => {
              d2.incomes.push({ type: 'socialSecurity', id: newId(), personId: person.id, piaMonthly: 0, earnings: null, claimAge: { years: 67, months: 0 } })
            })
          }
        >
          + Add Social Security
        </button>
      </div>
    )
  }

  const streamIndex = plan.incomes.findIndex((s) => s.id === stream.id)
  const mode: 'quick' | 'earnings' = stream.piaMonthly === null ? 'earnings' : 'quick'
  const resolved = resolvePia(person, stream)

  const earnings = stream.earnings ?? []
  const mostRecentEarnings =
    earnings.length > 0 ? earnings.reduce((a, b) => (b.year >= a.year ? b : a)).amount : null
  const projYears = (resolved.detail?.indexedYears ?? []).filter((y2) => y2.projected)
  const projectedYears = projYears.length
  const projectedRange = projectedYears > 0 ? `${projYears[0]!.year}–${projYears[projectedYears - 1]!.year}` : ''
  const projectedAmount = projectedYears > 0 ? projYears[0]!.rawEarnings : null

  const setStream = (mut: (s: SsStream) => void) =>
    update((d2) => {
      const s = d2.incomes[streamIndex]
      if (s?.type === 'socialSecurity') mut(s)
    })

  const handleXml = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void file.text().then((text) => {
      const result = parseSsaStatementXml(text)
      if (!result.ok) {
        setXmlNote({ kind: 'error', text: result.message })
        return
      }
      setStream((s) => {
        s.piaMonthly = null
        s.earnings = result.rows.map((r) => ({ year: r.year, amount: r.amount }))
      })
      setXmlNote({ kind: 'ok', text: `Imported ${result.rows.length} years of earnings from your statement.` })
    })
  }

  return (
    <div className="item-row">
      <div className="item-row-head">
        <span className="item-row-title">
          <span className="type-chip">{personIndex === 0 ? 'Primary' : 'Partner'}</span>
          {person.name}: full retirement age {fra.years}
          {fra.extraMonths > 0 ? `y ${fra.extraMonths}m` : ''}
        </span>
        <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d2) => void d2.incomes.splice(streamIndex, 1))}>
          Remove
        </button>
      </div>

      <div className="form-grid">
        <SelectField
          label="Benefit source"
          help="Quick: type the PIA from your SSA statement. Earnings record: paste or import your full earnings history and we compute the PIA (AIME → bend points), which is more accurate if you'll retire before the statement's assumed work-through age."
          value={mode}
          options={[
            { value: 'quick', label: 'Quick: enter PIA' },
            { value: 'earnings', label: 'Earnings record (advanced)' },
          ]}
          onCommit={(v) =>
            setStream((s) => {
              if (v === 'quick') {
                s.piaMonthly = s.piaMonthly ?? 0
              } else {
                s.piaMonthly = null
                s.earnings = s.earnings ?? []
              }
            })
          }
        />
        <NumberField
          label="Claim age (years)"
          help="The age this person starts benefits. Earlier than full retirement age permanently reduces it; waiting past it adds ~8%/year until 70. Compare the options on Explore → Social Security."
          path={`incomes.${streamIndex}.claimAge.years`}
          value={stream.claimAge.years}
          onCommit={(v) => setStream((s) => (s.claimAge = { years: Math.round(v ?? 67), months: s.claimAge.months }))}
        />
        <NumberField
          label="Claim age (+ months)"
          path={`incomes.${streamIndex}.claimAge.months`}
          value={stream.claimAge.months}
          onCommit={(v) => setStream((s) => (s.claimAge = { years: s.claimAge.years, months: Math.round(v ?? 0) }))}
        />
      </div>

      <details className="ss-explainer" style={{ marginTop: '0.6rem' }}>
        <summary>Disability (SSDI)</summary>
        <p className="card-hint">
          If you're receiving Social Security disability, your benefit is your <strong>full PIA</strong> (no
          early-retirement reduction) from the onset age, converting to the retirement benefit at FRA at the same
          dollar amount. Earnings above Substantial Gainful Activity (SGA) suspend it before FRA. Leave this off
          for a normal retirement claim.
        </p>
        <div className="form-grid">
          <CheckboxField
            label="Receiving Social Security disability (SSDI)"
            help="SSDI pays your full PIA (no early-retirement reduction) from the disability onset age, is gated by Substantial Gainful Activity, and converts to the retirement benefit at FRA at the same dollar amount (no delayed-retirement credits). It's taxed like retirement benefits."
            value={stream.disability != null}
            onCommit={(on) =>
              setStream((s) => {
                s.disability = on ? { onsetAge: 62 } : undefined
              })
            }
          />
          {stream.disability ? (
            <NumberField
              label="Disability onset age"
              help="The age your disability began. SSDI starts here (not at your retirement claim age) and pays the full PIA. Must be before your full retirement age. An onset at/after FRA is ignored (SSDI converts to retirement at FRA, so it can't start later)."
              value={stream.disability.onsetAge}
              min={40}
              max={75}
              onCommit={(v) =>
                setStream((s) => {
                  if (s.disability) s.disability.onsetAge = Math.round(v ?? 62)
                })
              }
            />
          ) : null}
        </div>
      </details>

      {mode === 'quick' ? (
        <div className="form-grid">
          <MoneyField
            // One shared constant with the Income summary card (and the stem of
            // the former-spouse record's "Their …"); the longer "PIA (monthly
            // benefit at FRA)" wrapped beside its ⓘ (#511).
            label={PIA_MONTHLY_AT_FRA_LABEL}
            help="Your Primary Insurance Amount, the monthly benefit at full retirement age in today's dollars, from ssa.gov/myaccount."
            path={`incomes.${streamIndex}.piaMonthly`}
            value={stream.piaMonthly}
            allowNull
            onCommit={(v) => setStream((s) => (s.piaMonthly = v ?? 0))}
          />
        </div>
      ) : (
        <div className="earnings-entry">
          <label className="field-label" htmlFor={`earn-${stream.id}`}>
            Annual covered earnings: one <code>year amount</code> per line
          </label>
          <textarea
            id={`earn-${stream.id}`}
            className="earnings-textarea"
            value={(stream.earnings ?? []).map((r) => `${r.year} ${r.amount}`).join('\n')}
            onChange={(e) =>
              setStream((s) => {
                s.piaMonthly = null
                s.earnings = e.target.value
                  .split('\n')
                  .map((line) => line.trim().split(/[\s,]+/))
                  .filter((parts) => parts.length >= 2)
                  .map((parts) => ({ year: Number(parts[0]), amount: Number(parts[1]) }))
                  .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.amount))
              })
            }
            placeholder={'1995 28500\n1996 31200\n…'}
          />
          {importEnabled ? (
            <div className="add-row">
              <label className="btn btn-secondary btn-small" style={{ cursor: 'pointer' }}>
                Import mySSA statement (XML)
                <input type="file" accept=".xml,application/xml,text/xml" className="sr-only" onChange={handleXml} />
              </label>
            </div>
          ) : importResolved ? (
            <p className="card-hint" role="status">
              {IMPORT_UNAVAILABLE_MESSAGE} You can still enter annual earnings above.
            </p>
          ) : (
            <p className="card-hint" role="status">
              {IMPORT_PENDING_MESSAGE}
            </p>
          )}
          {xmlNote ? (
            <p className={xmlNote.kind === 'error' ? 'error-text' : 'field-hint'} style={{ marginTop: '0.4rem' }}>
              {xmlNote.text}
            </p>
          ) : null}

          <div className="earnings-projection" style={{ marginTop: '0.6rem' }}>
            <CheckboxField
              label="Project future earnings until retirement"
              help="An SSA statement assumes you keep earning until full retirement age. If you'll stop sooner, that overstates your benefit; leaving the gap years at $0 understates it. This fills the years between your last reported year and your retirement age at an assumed wage."
              value={stream.earningsProjection != null}
              onCommit={(on) =>
                setStream((s) => {
                  s.earningsProjection = on ? { assumedAnnualEarnings: null, throughAge: null } : null
                })
              }
            />
            {stream.earningsProjection != null ? (
              <div className="form-grid">
                <MoneyField
                  label="Assumed annual earnings"
                  help="Covered wages to assume for each projected year, in today's dollars."
                  hint={
                    mostRecentEarnings !== null
                      ? `Blank = reuse your most recent year (${fmtMoney(mostRecentEarnings)}).`
                      : 'Blank = reuse your most recent year.'
                  }
                  value={stream.earningsProjection.assumedAnnualEarnings}
                  allowNull
                  onCommit={(v) =>
                    setStream((s) => {
                      if (s.earningsProjection) s.earningsProjection.assumedAnnualEarnings = v
                    })
                  }
                />
                <NumberField
                  label="Work through age"
                  help="Project earnings up to (but not including) this age. Your last full working year. Defaults to this person's retirement age."
                  hint={person.retirementAge !== null ? `Blank = retirement age (${person.retirementAge}).` : 'Blank = retirement age.'}
                  value={stream.earningsProjection.throughAge}
                  allowNull
                  min={50}
                  max={75}
                  onCommit={(v) =>
                    setStream((s) => {
                      if (s.earningsProjection) s.earningsProjection.throughAge = v === null ? null : Math.round(v)
                    })
                  }
                />
              </div>
            ) : null}
          </div>

          {resolved.piaMonthly !== null ? (
            <p className="field-hint" style={{ marginTop: '0.4rem' }}>
              Computed PIA: <strong>{fmtMoney(resolved.piaMonthly)}/mo</strong> at full retirement age.
              {projectedYears > 0 ? (
                <>
                  {' '}
                  Includes <strong>{projectedYears}</strong> projected {projectedYears === 1 ? 'year' : 'years'} (
                  {projectedRange}) at {fmtMoney(projectedAmount ?? 0)}/yr, fewer zero years than the SSA statement
                  would assume if you retire early.
                </>
              ) : null}
            </p>
          ) : null}
          {stream.earningsProjection != null && projectedYears === 0 && resolved.piaMonthly !== null ? (
            <p className="field-hint" style={{ marginTop: '0.4rem', color: 'var(--warn)' }}>
              No years were projected. Your reported earnings already reach your retirement age, or no retirement age is
              set on the Household step.
            </p>
          ) : null}

          {resolved.detail ? (
            <AimeExplainer detail={resolved.detail} sampleEarnings={projectedAmount ?? mostRecentEarnings} />
          ) : null}

          <EligibilityNote
            stream={stream}
            onCommitCredits={(v) => setStream((s) => (s.coveredQuarters = v))}
          />
        </div>
      )}

      <FormerSpousesEditor stream={stream} setStream={setStream} householdIsSingle={plan.household.people.length === 1} />

      {resolved.warning ? <p className="field-hint" style={{ color: 'var(--warn)' }}>{resolved.warning}</p> : null}
    </div>
  )
}

export function SocialSecuritySection() {
  // Claim ages, PIA, and earnings are edited here, so their engine issues are
  // listed here (#476, #511), not on the Income page.
  const { plan } = usePlan()
  const couple = plan.household.people.length === 2
  return (
    <section>
      <Issues section="social-security" />
      <div className="card">
        <h2>Social Security</h2>
        <p className="card-hint">
          Birth dates and planning ages come from the Household form. Here you add each person's benefit and a claiming
          age. Monthly precision, the earnings test, spousal and survivor benefits, and an optional trust-fund cut (see
          Assumptions) are all modeled.
        </p>
        {couple ? (
          <div className="callout callout--info">
            For couples, the survivor keeps the larger of the two benefits, so delaying the <em>higher</em> earner's
            claim protects both lifetimes. The analysis page ranks every claim-age combination on your whole plan
            using the objective you choose.
          </div>
        ) : null}
        {plan.household.people.map((p, i) => (
          <PersonSsCard key={p.id} person={p} personIndex={i} />
        ))}
        <div className="callout callout--info" style={{ marginTop: '1rem' }}>
          <strong>Claiming early while still working?</strong> The earnings test withholds part of the benefit above an
          annual wage limit before full retirement age. RetireGolden models that withholding, and credits the withheld
          months back at full retirement age (recomputing the benefit as if you'd claimed that many months later), as an
          annual approximation.
        </div>
        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          Not sure when to claim?{' '}
          <Link to="../social-security-analysis">Compare claiming ages on the Social Security analysis page →</Link>
        </p>
      </div>
      <LearnAboutScreen route="/plan/:planId/social-security" />
    </section>
  )
}

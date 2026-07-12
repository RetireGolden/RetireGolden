/**
 * Import & migration wizard at /import (onboarding-import-and-migration).
 *
 * Four guided paths — ProjectionLab JSON, broker positions CSV, generic
 * spreadsheet/RPM CSV with column mapping, and the 1040 guided seed — all
 * producing a draft plan through the same validated route as backup import,
 * with the shared review checklist before anything is saved. Everything is
 * parsed in the browser; no file leaves the device.
 */

import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { savePlanVia, usePlanStore } from '../data/planStoreContext'
import { useWorkspaceReadOnly } from '../data/workspaceReadOnly'
import type { Plan } from '@retiregolden/engine/model/plan'
import { DateField, MoneyField, SelectField } from '../planner/fields'
import { US_STATES } from '../planner/usStates'
import { parseBrokerPositionsCsv, draftPlanFromBrokerAccounts, BROKER_LABEL } from './brokerCsv'
import {
  analyzeGenericCsv,
  COLUMN_ROLE_LABEL,
  draftPlanFromGenericCsv,
  type ColumnRole,
  type GenericCsvAnalysis,
} from './genericCsv'
import { mapProjectionLabExport } from './projectionLab'
import type { ImportReviewItem } from './reviewChecklist'
import { ReviewChecklist } from './ReviewChecklistView'
import { seedPlanFromTenForty, type TenFortyInputs } from './tenForty'

type SourceId = 'projectionlab' | 'broker' | 'generic' | 'tenforty'

interface Draft {
  plan: Plan
  review: ImportReviewItem[]
}

const SOURCES: Array<{ id: SourceId; title: string; desc: string }> = [
  {
    id: 'broker',
    title: 'Broker CSV (Schwab, Fidelity, Vanguard)',
    desc: 'Download your positions/holdings CSV from your broker and turn account balances into a draft plan.',
  },
  {
    id: 'projectionlab',
    title: 'ProjectionLab export',
    desc: 'Bring accounts, income, and spending over from a ProjectionLab JSON data export.',
  },
  {
    id: 'generic',
    title: 'Spreadsheet / RPM CSV',
    desc: 'Any sheet with one row per account — including the Bogleheads Retiree Portfolio Model — via column mapping.',
  },
  {
    id: 'tenforty',
    title: 'Your tax return (Form 1040)',
    desc: 'Type about a dozen line values off last year’s return to seed income, filing, and bracket context.',
  },
]

const ROLE_OPTIONS = (Object.keys(COLUMN_ROLE_LABEL) as ColumnRole[]).map((value) => ({
  value,
  label: COLUMN_ROLE_LABEL[value],
}))

const EMPTY_1040: TenFortyInputs = {
  filingStatus: 'single',
  state: 'KY',
  primaryDob: '1970-01-01',
  spouseDob: undefined,
  wages: 0,
  taxExemptInterest: 0,
  taxableInterest: 0,
  qualifiedDividends: 0,
  ordinaryDividends: 0,
  iraDistributions: 0,
  pensionsAndAnnuities: 0,
  socialSecurityBenefits: 0,
  capitalGain: 0,
  agi: 0,
}

export function ImportPage() {
  const navigate = useNavigate()
  const store = usePlanStore()
  const readOnly = useWorkspaceReadOnly()
  const [source, setSource] = useState<SourceId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [analysis, setAnalysis] = useState<GenericCsvAnalysis | null>(null)
  const [roles, setRoles] = useState<ColumnRole[]>([])
  const [tenForty, setTenForty] = useState<TenFortyInputs>(EMPTY_1040)
  const fileInput = useRef<HTMLInputElement>(null)

  const reset = () => {
    setError(null)
    setDraft(null)
    setAnalysis(null)
    setRoles([])
  }

  const chooseSource = (id: SourceId) => {
    reset()
    setSource(id)
  }

  const handleFile = async (file: File) => {
    setError(null)
    const text = await file.text()
    if (source === 'projectionlab') {
      const r = mapProjectionLabExport(text)
      if (!r.ok) return setError(r.message)
      setDraft({ plan: r.plan, review: r.review })
    } else if (source === 'broker') {
      const parsed = parseBrokerPositionsCsv(text)
      if (!parsed.ok) return setError(parsed.message)
      const drafted = draftPlanFromBrokerAccounts(parsed.broker, parsed.accounts)
      if (!drafted.ok) return setError(drafted.message)
      setDraft({
        plan: drafted.plan,
        review: [
          {
            status: 'mapped',
            source: `${BROKER_LABEL[parsed.broker]} positions file`,
            detail: `Recognized ${parsed.accounts.length} account${parsed.accounts.length === 1 ? '' : 's'}.`,
          },
          ...parsed.review,
          ...drafted.review,
        ],
      })
    } else if (source === 'generic') {
      const r = analyzeGenericCsv(text)
      if (!r.ok) return setError(r.message)
      setAnalysis(r.analysis)
      setRoles(r.analysis.guessedRoles)
    }
  }

  const buildGenericDraft = () => {
    if (!analysis) return
    setError(null)
    const r = draftPlanFromGenericCsv(analysis, roles)
    if (!r.ok) return setError(r.message)
    setDraft({ plan: r.plan, review: r.review })
  }

  const buildTenFortyDraft = () => {
    setError(null)
    const r = seedPlanFromTenForty(tenForty)
    if (!r.ok) return setError(r.message)
    setDraft({ plan: r.plan, review: r.review })
  }

  const saveAndOpen = async () => {
    if (!draft) return
    const r = await savePlanVia(store, draft.plan)
    if (r.ok) navigate(`/plan/${r.plan.id}`)
    else setError(`Could not save the draft plan: ${r.issues.join('; ')}`)
  }

  const set1040 = (patch: Partial<TenFortyInputs>) => setTenForty((prev) => ({ ...prev, ...patch }))

  const fileAccept = source === 'projectionlab' ? 'application/json,.json' : '.csv,text/csv'

  // Importing creates a new plan through the seam, so the whole wizard is a
  // write path — surface a read-only notice instead when writes are disallowed.
  if (readOnly) {
    return (
      <div className="import-page">
        <h1>Import &amp; migrate</h1>
        <div className="callout callout--info" role="status">
          Importing creates a new plan, which isn&apos;t available while the workspace is read-only. You can still
          open and explore existing plans. Return to <Link to="/">your plans</Link>.
        </div>
      </div>
    )
  }

  return (
    <div className="import-page">
      <h1>Import &amp; migrate</h1>
      <p className="card-hint">
        Start a RetireGolden plan from files you already have. Every file is read entirely on this device —
        nothing is uploaded anywhere — and you review exactly what mapped before anything is saved. Restoring
        a RetireGolden backup lives on the <Link to="/">planner home</Link>.
      </p>

      {!source ? (
        <div className="plan-grid home-paths-grid">
          {SOURCES.map((s) => (
            <button key={s.id} type="button" className="home-path-card plan-card" onClick={() => chooseSource(s.id)}>
              <span className="home-path-card-title">{s.title}</span>
              <span className="home-path-card-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="item-row-head">
            <h2>{SOURCES.find((s) => s.id === source)!.title}</h2>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                reset()
                setSource(null)
              }}
            >
              Choose a different source
            </button>
          </div>

          {error ? (
            <div className="callout callout--warn" role="alert">
              {error}
            </div>
          ) : null}

          {draft ? (
            <>
              <p>
                Draft plan <strong>{draft.plan.name}</strong>: {draft.plan.accounts.length} account
                {draft.plan.accounts.length === 1 ? '' : 's'}, {draft.plan.incomes.length} income stream
                {draft.plan.incomes.length === 1 ? '' : 's'}.
              </p>
              <ReviewChecklist items={draft.review} />
              <div className="picker-actions">
                <button type="button" className="btn btn-primary" onClick={() => void saveAndOpen()}>
                  Save draft &amp; open in the planner
                </button>
                <button type="button" className="btn btn-secondary" onClick={reset}>
                  Start over
                </button>
              </div>
            </>
          ) : source === 'tenforty' ? (
            <>
              <p className="card-hint">
                Copy the values from last year&apos;s Form 1040. Zero is fine for any line that doesn&apos;t
                apply. No PDF upload — you stay in control of what is entered.
              </p>
              <div className="form-grid">
                <SelectField
                  label="Filing status (1040 header)"
                  value={tenForty.filingStatus}
                  options={[
                    { value: 'single', label: 'Single' },
                    { value: 'marriedFilingJointly', label: 'Married filing jointly' },
                  ]}
                  onCommit={(v) =>
                    set1040({ filingStatus: v, spouseDob: v === 'marriedFilingJointly' ? (tenForty.spouseDob ?? '1970-01-01') : undefined })
                  }
                />
                <SelectField label="State of residence" value={tenForty.state} options={US_STATES} onCommit={(v) => set1040({ state: v })} />
                <DateField label="Your date of birth" help="Not on the 1040, but every projection needs it to anchor ages." value={tenForty.primaryDob} onCommit={(v) => set1040({ primaryDob: v })} />
                {tenForty.filingStatus === 'marriedFilingJointly' ? (
                  <DateField label="Spouse's date of birth" value={tenForty.spouseDob ?? ''} onCommit={(v) => set1040({ spouseDob: v })} />
                ) : null}
                <MoneyField label="Line 1a — wages" value={tenForty.wages} onCommit={(v) => set1040({ wages: v ?? 0 })} />
                <MoneyField label="Line 2a — tax-exempt interest" value={tenForty.taxExemptInterest} onCommit={(v) => set1040({ taxExemptInterest: v ?? 0 })} />
                <MoneyField label="Line 2b — taxable interest" value={tenForty.taxableInterest} onCommit={(v) => set1040({ taxableInterest: v ?? 0 })} />
                <MoneyField label="Line 3a — qualified dividends" value={tenForty.qualifiedDividends} onCommit={(v) => set1040({ qualifiedDividends: v ?? 0 })} />
                <MoneyField label="Line 3b — ordinary dividends" value={tenForty.ordinaryDividends} onCommit={(v) => set1040({ ordinaryDividends: v ?? 0 })} />
                <MoneyField label="Line 4b — IRA distributions (taxable)" value={tenForty.iraDistributions} onCommit={(v) => set1040({ iraDistributions: v ?? 0 })} />
                <MoneyField label="Line 5b — pensions & annuities (taxable)" value={tenForty.pensionsAndAnnuities} onCommit={(v) => set1040({ pensionsAndAnnuities: v ?? 0 })} />
                <MoneyField label="Line 6a — Social Security benefits" value={tenForty.socialSecurityBenefits} onCommit={(v) => set1040({ socialSecurityBenefits: v ?? 0 })} />
                <MoneyField label="Line 7 — capital gain or loss" help="Enter a loss as a negative number." value={tenForty.capitalGain} onCommit={(v) => set1040({ capitalGain: v ?? 0 })} />
                <MoneyField label="Line 11 — adjusted gross income" value={tenForty.agi} onCommit={(v) => set1040({ agi: v ?? 0 })} />
              </div>
              <div className="picker-actions">
                <button type="button" className="btn btn-primary" onClick={buildTenFortyDraft}>
                  Build my draft plan
                </button>
              </div>
            </>
          ) : analysis ? (
            <>
              <p className="card-hint">
                Tell RetireGolden what each column means. The guesses below come from your header row; fix any
                that are wrong, then continue. {analysis.dataRows.length} data row
                {analysis.dataRows.length === 1 ? '' : 's'} found.
              </p>
              <div className="year-table-wrap">
                <table className="year-table">
                  <thead>
                    <tr>
                      {analysis.header.map((h, i) => (
                        <th key={i} scope="col">
                          {h || `Column ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {analysis.header.map((_, i) => (
                        <td key={i}>
                          <select
                            aria-label={`Role for column ${analysis.header[i] || i + 1}`}
                            value={roles[i] ?? 'ignore'}
                            onChange={(e) =>
                              setRoles((prev) => prev.map((r, j) => (j === i ? (e.target.value as ColumnRole) : r)))
                            }
                          >
                            {ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.dataRows.slice(0, 5).map((row, r) => (
                      <tr key={r}>
                        {analysis.header.map((_, c) => (
                          <td key={c}>{row[c] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="picker-actions">
                <button type="button" className="btn btn-primary" onClick={buildGenericDraft}>
                  Continue with these columns
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="card-hint">
                {source === 'projectionlab'
                  ? 'In ProjectionLab, export your data as JSON (Settings → Export Data), then choose the file here.'
                  : source === 'broker'
                    ? 'Log in to your broker and download the positions/holdings CSV, then choose the file here. To update balances in an existing plan instead, use "Update balances from a broker CSV" on that plan’s Accounts screen.'
                    : 'Save your spreadsheet as CSV with a header row and one row per account, then choose the file here.'}
              </p>
              <div className="picker-actions">
                <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>
                  Choose file
                </button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept={fileAccept}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                  e.target.value = ''
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

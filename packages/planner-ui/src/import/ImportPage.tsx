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
import { CURRENT_PLAN_SCHEMA_VERSION, type Plan } from '@retiregolden/engine/model/plan'
import { ENGINE_VERSION } from '@retiregolden/engine/version'
import { DateField, MoneyField, SelectField } from '../planner/fields'
import { US_STATES } from '../planner/usStates'
import { parseBrokerPositionsCsv, draftPlanFromBrokerAccounts, BROKER_LABEL } from './brokerCsv'
import { MAX_CSV_CHARS } from './csv'
import {
  analyzeGenericCsv,
  COLUMN_ROLE_LABEL,
  draftPlanFromGenericCsv,
  type ColumnRole,
  type GenericCsvAnalysis,
} from './genericCsv'
import { MAX_IMPORT_JSON_CHARS, mapProjectionLabExport } from './projectionLab'
import {
  serializeImportProvenance,
  type ImportProvenanceInput,
  type ImportSourceRef,
} from './provenance'
import { reviewToProvenance, type ImportReviewItem } from './reviewChecklist'
import { ReviewChecklist } from './ReviewChecklistView'
import { digestSource } from './sourceHash'
import { seedPlanFromTenForty, type TenFortyInputs } from './tenForty'

type SourceId = 'projectionlab' | 'broker' | 'generic' | 'tenforty'

interface Draft {
  plan: Plan
  review: ImportReviewItem[]
  /** The identified source that fed this draft, for the import-provenance report. */
  source: ImportSourceRef
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
  // The generic path reads the file in handleFile but builds the draft later in
  // buildGenericDraft, so the identified source is stashed here between the two.
  const [pendingSource, setPendingSource] = useState<ImportSourceRef | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const reset = () => {
    setError(null)
    setDraft(null)
    setAnalysis(null)
    setRoles([])
    setPendingSource(null)
  }

  const chooseSource = (id: SourceId) => {
    reset()
    setSource(id)
  }

  const handleFile = async (file: File) => {
    setError(null)
    // A file over the mapper's own character cap can never import (UTF-8 bytes
    // ≥ characters) — refuse before reading and hashing the whole payload.
    const charCap = source === 'projectionlab' ? MAX_IMPORT_JSON_CHARS : MAX_CSV_CHARS
    if (file.size > charCap) {
      return setError(
        source === 'projectionlab'
          ? 'File is too large to be a ProjectionLab export.'
          : 'File is too large to be a positions/plan export.',
      )
    }
    // Identify the source at the async edge: hash the raw bytes once, here, so
    // the pure mappers stay synchronous and the report can prove which file fed
    // the draft without ever embedding its contents. The digest reads the raw
    // buffer — decoding first would strip BOMs and mangle non-UTF-8 bytes, and
    // the hash must match the file on disk.
    const raw = await file.arrayBuffer()
    const { sha256, bytes } = await digestSource(raw)
    const text = new TextDecoder().decode(raw)
    if (source === 'projectionlab') {
      const r = mapProjectionLabExport(text)
      if (!r.ok) return setError(r.message)
      setDraft({
        plan: r.plan,
        review: r.review,
        source: { file: file.name, sha256, bytes, mapper: 'projectionLab' },
      })
    } else if (source === 'broker') {
      const parsed = parseBrokerPositionsCsv(text)
      if (!parsed.ok) return setError(parsed.message)
      const drafted = draftPlanFromBrokerAccounts(parsed.broker, parsed.accounts)
      if (!drafted.ok) return setError(drafted.message)
      // The parse phase has no plan, so its per-account items carry locators but
      // no targets; the draft phase creates plan.accounts[i] from accounts[i] in
      // order. Stamp the join here — the one place both phases meet — so the
      // report ties each sourced aggregate to the account it populated.
      const targetByLabel = new Map(parsed.accounts.map((a, i) => [a.accountLabel, `accounts[${i}]`]))
      const parsedReview = parsed.review.map((item) => {
        const target = targetByLabel.get(item.source)
        if (!target || item.status === 'skipped') return item
        if (item.status === 'mapped') return { ...item, target }
        if (item.status === 'defaulted') return { ...item, target: `${target}.costBasis` }
        return item
      })
      setDraft({
        plan: drafted.plan,
        review: [
          {
            status: 'mapped',
            source: `${BROKER_LABEL[parsed.broker]} positions file`,
            detail: `Recognized ${parsed.accounts.length} account${parsed.accounts.length === 1 ? '' : 's'}.`,
            // A file-level summary, not a single row — give it a locator so every
            // rendered (and exported) item carries one.
            locator: { kind: 'none', note: 'File-level summary of the whole positions file.' },
            confidence: 'exact',
          },
          ...parsedReview,
          ...drafted.review,
        ],
        source: { file: file.name, sha256, bytes, mapper: 'brokerCsv' },
      })
    } else if (source === 'generic') {
      const r = analyzeGenericCsv(text)
      if (!r.ok) return setError(r.message)
      setAnalysis(r.analysis)
      setRoles(r.analysis.guessedRoles)
      setPendingSource({ file: file.name, sha256, bytes, mapper: 'genericCsv' })
    }
  }

  const buildGenericDraft = () => {
    if (!analysis || !pendingSource) return
    setError(null)
    const r = draftPlanFromGenericCsv(analysis, roles)
    if (!r.ok) return setError(r.message)
    setDraft({ plan: r.plan, review: r.review, source: pendingSource })
  }

  const buildTenFortyDraft = async () => {
    setError(null)
    const r = seedPlanFromTenForty(tenForty)
    if (!r.ok) return setError(r.message)
    // No file on the guided path — identify the typed inputs themselves: the
    // canonical JSON of what the user entered, hashed the same way a file is.
    const { sha256, bytes } = await digestSource(JSON.stringify(tenForty))
    setDraft({
      plan: r.plan,
      review: r.review,
      source: { file: 'guided-1040-entry', sha256, bytes, mapper: 'tenForty' },
    })
  }

  const saveAndOpen = async () => {
    if (!draft) return
    const r = await savePlanVia(store, draft.plan)
    if (r.ok) navigate(`/plan/${r.plan.id}`)
    else setError(`Could not save the draft plan: ${r.issues.join('; ')}`)
  }

  const downloadReport = () => {
    if (!draft) return
    // Decisions stay absent (pending) — the Pro/Advisor workbench sets them.
    const input: ImportProvenanceInput = {
      planSchemaVersion: CURRENT_PLAN_SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      sources: [draft.source],
      ...reviewToProvenance(draft.review),
    }
    const blob = new Blob([serializeImportProvenance(input)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `retiregolden-import-provenance-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    // Revoking synchronously can race the download start in some browsers.
    const revoke = URL.revokeObjectURL.bind(URL)
    setTimeout(() => revoke(url), 5_000)
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
                <button type="button" className="btn btn-secondary" onClick={downloadReport}>
                  Download import report
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
                <button type="button" className="btn btn-primary" onClick={() => void buildTenFortyDraft()}>
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

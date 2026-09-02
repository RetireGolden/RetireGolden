/**
 * Import & migration wizard at /import (onboarding-import-and-migration).
 *
 * Four guided paths — ProjectionLab JSON, broker positions CSV, generic
 * spreadsheet/RPM CSV with column mapping, and the 1040 guided seed — all
 * producing a draft plan through the same validated route as backup import,
 * with the shared review checklist before anything is saved. Everything is
 * parsed in the browser; no file leaves the device.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

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
import {
  IMPORT_PENDING_MESSAGE,
  IMPORT_UNAVAILABLE_MESSAGE,
  useImportAvailability,
} from './importAvailability'
import { ScrollRegion } from '../planner/ScrollRegion'

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
    desc: 'Any sheet with one row per account, including the Bogleheads Retiree Portfolio Model, via column mapping.',
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
  // Deliberately unanswered: a prefilled state made a missed selection silent —
  // the draft built with the default and materially wrong state taxes. The
  // select starts on a placeholder and seedPlanFromTenForty rejects ''.
  state: '',
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
  const { enabled: importEnabled, resolved: importResolved } = useImportAvailability()
  if (!importEnabled) {
    return (
      <div className="import-page">
        <h1>Import &amp; migrate</h1>
        <div className="callout callout--info" role="status">
          {importResolved ? IMPORT_UNAVAILABLE_MESSAGE : IMPORT_PENDING_MESSAGE} Return to{' '}
          <Link to="/">your plans</Link>.
        </div>
      </div>
    )
  }
  return <EnabledImportPage />
}

function EnabledImportPage() {
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
  // Bumped on every reset/source switch so an async completion from a previous
  // selection (a file still being read/hashed) cannot install a stale draft.
  const importEpoch = useRef(0)
  // The card the user opened — restored to keyboard focus when they come back
  // via "Choose a different source". We restore explicitly because unmounting
  // the step control drops keyboard focus (Design QA reproduced last-card /
  // lost focus; do not rely on browser fallback).
  const lastOpenedSource = useRef<SourceId | null>(null)
  const sourceCardRefs = useRef<Partial<Record<SourceId, HTMLButtonElement | null>>>({})

  useLayoutEffect(() => {
    if (source !== null) return
    const id = lastOpenedSource.current
    if (!id) return
    sourceCardRefs.current[id]?.focus()
  }, [source])

  const reset = () => {
    importEpoch.current++
    setError(null)
    setDraft(null)
    setAnalysis(null)
    setRoles([])
    setPendingSource(null)
    // The guided 1040 lines are draft state too: "Choose a different source"
    // and "Start over" read as cancel, so they must not hand the typed values
    // back on the next visit (#507).
    setTenForty(EMPTY_1040)
  }

  const chooseSource = (id: SourceId) => {
    lastOpenedSource.current = id
    reset()
    setSource(id)
  }

  const chooseDifferentSource = () => {
    reset()
    setSource(null)
  }

  const handleFile = async (file: File) => {
    const epoch = importEpoch.current
    setError(null)
    // The mappers cap CHARACTERS; File.size is BYTES. UTF-8 decodes to at
    // least one UTF-16 unit per three bytes, so size > 3×cap can never fit —
    // refuse those without reading at all (bounds the read); anything smaller
    // is decoded and held to the exact character cap before any hashing work.
    const charCap = source === 'projectionlab' ? MAX_IMPORT_JSON_CHARS : MAX_CSV_CHARS
    const tooLarge =
      source === 'projectionlab'
        ? 'File is too large to be a ProjectionLab export.'
        : 'File is too large to be a positions/plan export.'
    if (file.size > charCap * 3) return setError(tooLarge)
    const raw = await file.arrayBuffer()
    const text = new TextDecoder().decode(raw)
    if (text.length > charCap) return setError(tooLarge)
    // Identify the source at the async edge: hash the raw bytes once, here, so
    // the pure mappers stay synchronous and the report can prove which file fed
    // the draft without ever embedding its contents. The digest reads the raw
    // buffer — decoding it first would strip BOMs and mangle non-UTF-8 bytes,
    // and the hash must match the file on disk.
    const { sha256, bytes } = await digestSource(raw)
    if (epoch !== importEpoch.current) return
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
      const accountByLabel = new Map(
        parsed.accounts.map((a, i) => [a.accountLabel, { path: `accounts[${i}]`, type: drafted.plan.accounts[i]?.type }]),
      )
      const parsedReview = parsed.review.map((item) => {
        const acc = accountByLabel.get(item.source)
        if (!acc || item.status === 'skipped') return item
        if (item.status === 'mapped') return { ...item, target: acc.path }
        // The partial-basis note only has an addressable target on account
        // types that track basis — an IRA/Roth plan account has no costBasis.
        if (item.status === 'defaulted' && acc.type === 'taxable') return { ...item, target: `${acc.path}.costBasis` }
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

  const buildTenFortyDraft = () => {
    setError(null)
    const r = seedPlanFromTenForty(tenForty)
    if (!r.ok) return setError(r.message)
    // No file on the guided path, and deliberately NO fingerprint either: the
    // typed inputs are low-entropy personal data, so a deterministic hash in a
    // report meant for handoff would be dictionary-attackable (a DOB has only
    // ~36,500 plausible values). An empty sha256 is the contract's honest
    // "nothing to verify against".
    setDraft({
      plan: r.plan,
      review: r.review,
      source: { file: 'guided-1040-entry', sha256: '', bytes: 0, mapper: 'tenForty' },
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
    let json: string
    try {
      json = serializeImportProvenance(input)
    } catch {
      // The serializer refuses to emit what its parser cannot read (e.g. a
      // report past the size cap for an enormous import).
      return setError('The import report for this file is too large to generate.')
    }
    const blob = new Blob([json], { type: 'application/json' })
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
        Start a RetireGolden plan from files you already have. Every file is read entirely on this device,
        nothing is uploaded anywhere, and you review exactly what mapped before anything is saved. Restoring
        a RetireGolden backup lives on the <Link to="/">planner home</Link>.
      </p>

      {!source ? (
        <div className="plan-grid home-paths-grid">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="home-path-card plan-card"
              data-source={s.id}
              ref={(el) => {
                sourceCardRefs.current[s.id] = el
              }}
              onClick={() => chooseSource(s.id)}
            >
              <span className="home-path-card-title">{s.title}</span>
              <span className="home-path-card-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="import-source-head">
            <h2>{SOURCES.find((s) => s.id === source)!.title}</h2>
            <button type="button" className="btn btn-secondary" onClick={chooseDifferentSource}>
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
                apply. No PDF upload. You stay in control of what is entered.
              </p>
              <form
                onSubmit={(e) => {
                  // Implicit submit (Enter, and in some hosts Backspace leaking
                  // as a submit) must not build the draft. The explicit button
                  // below is type="button" and is the only way to continue.
                  e.preventDefault()
                }}
              >
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
                  <SelectField
                    label="State of residence"
                    help="Not read off the return. A 1040 only carries a mailing address, and your state changes the state-tax estimate."
                    value={tenForty.state}
                    options={US_STATES}
                    placeholder="Select your state…"
                    onCommit={(v) => set1040({ state: v })}
                  />
                  <DateField label="Your date of birth" help="Not on the 1040, but every projection needs it to anchor ages." value={tenForty.primaryDob} onCommit={(v) => set1040({ primaryDob: v })} />
                  {tenForty.filingStatus === 'marriedFilingJointly' ? (
                    <DateField label="Spouse's date of birth" value={tenForty.spouseDob ?? ''} onCommit={(v) => set1040({ spouseDob: v })} />
                  ) : null}
                  <MoneyField label="Line 1a: wages" value={tenForty.wages} onCommit={(v) => set1040({ wages: v ?? 0 })} />
                  <MoneyField label="Line 2a: tax-exempt interest" value={tenForty.taxExemptInterest} onCommit={(v) => set1040({ taxExemptInterest: v ?? 0 })} />
                  <MoneyField label="Line 2b: taxable interest" value={tenForty.taxableInterest} onCommit={(v) => set1040({ taxableInterest: v ?? 0 })} />
                  <MoneyField label="Line 3a: qualified dividends" value={tenForty.qualifiedDividends} onCommit={(v) => set1040({ qualifiedDividends: v ?? 0 })} />
                  <MoneyField label="Line 3b: ordinary dividends" value={tenForty.ordinaryDividends} onCommit={(v) => set1040({ ordinaryDividends: v ?? 0 })} />
                  <MoneyField label="Line 4b: IRA distributions (taxable)" value={tenForty.iraDistributions} onCommit={(v) => set1040({ iraDistributions: v ?? 0 })} />
                  <MoneyField label="Line 5b: pensions & annuities (taxable)" value={tenForty.pensionsAndAnnuities} onCommit={(v) => set1040({ pensionsAndAnnuities: v ?? 0 })} />
                  <MoneyField label="Line 6a: Social Security benefits" value={tenForty.socialSecurityBenefits} onCommit={(v) => set1040({ socialSecurityBenefits: v ?? 0 })} />
                  <MoneyField label="Line 7: capital gain or loss" help="Enter a loss as a negative number." value={tenForty.capitalGain} onCommit={(v) => set1040({ capitalGain: v ?? 0 })} />
                  <MoneyField label="Line 11: adjusted gross income" value={tenForty.agi} onCommit={(v) => set1040({ agi: v ?? 0 })} />
                </div>
                <div className="picker-actions">
                  <button type="button" className="btn btn-primary" onClick={buildTenFortyDraft}>
                    Build my draft plan
                  </button>
                </div>
              </form>
            </>
          ) : analysis ? (
            <>
              <p className="card-hint">
                Tell RetireGolden what each column means. The guesses below come from your header row; fix any
                that are wrong, then continue. {analysis.dataRows.length} data row
                {analysis.dataRows.length === 1 ? '' : 's'} found.
              </p>
              <ScrollRegion label="Import preview">
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
              </ScrollRegion>
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

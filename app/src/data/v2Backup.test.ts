import { describe, expect, it } from 'vitest'

import { createEmptyPlan } from '../engine/model/plan'
import { MAX_BACKUP_JSON_CHARS, parseV2Backup, serializeV2Backup } from './v2Backup'

let counter = 0
const testIds = () => `bk-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

describe('v2 backup envelope', () => {
  it('round-trips plans through serialize/parse', () => {
    const a = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Plan A' })
    const b = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Plan B' })
    const json = serializeV2Backup([a, b], fixedNow)

    const result = parseV2Backup(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans).toEqual([a, b])
      expect(result.warnings).toHaveLength(0)
    }
  })

  it('accepts the legacy retirecalc.v2.backup kind from before the rebrand', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Legacy' })
    const json = JSON.stringify({
      kind: 'retirecalc.v2.backup',
      backupVersion: 1,
      exportedAtIso: 'x',
      plans: [plan],
    })
    const result = parseV2Backup(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plans).toHaveLength(1)
  })

  it('rejects oversized payloads', () => {
    const result = parseV2Backup('x'.repeat(MAX_BACKUP_JSON_CHARS + 1))
    expect(result).toEqual({ ok: false, reason: 'too_large' })
  })

  it('rejects non-JSON and foreign files', () => {
    expect(parseV2Backup('not json {')).toEqual({ ok: false, reason: 'not_json' })
    expect(parseV2Backup('{"some":"other file"}')).toEqual({ ok: false, reason: 'wrong_kind' })
    expect(parseV2Backup('"just a string"')).toEqual({ ok: false, reason: 'wrong_kind' })
  })

  it('rejects unsupported envelope versions', () => {
    const json = JSON.stringify({
      kind: 'retiregolden.v2.backup',
      backupVersion: 99,
      exportedAtIso: 'x',
      plans: [],
    })
    expect(parseV2Backup(json)).toEqual({ ok: false, reason: 'unsupported_version' })
  })

  it('skips corrupt plans with warnings but keeps valid ones', () => {
    const good = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Good' })
    const json = JSON.stringify({
      kind: 'retiregolden.v2.backup',
      backupVersion: 1,
      exportedAtIso: 'x',
      plans: [good, { schemaVersion: 1, corrupt: true }],
    })
    const result = parseV2Backup(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans).toHaveLength(1)
      expect(result.warnings).toHaveLength(1)
    }
  })

  it('skips plans from a newer app schema while keeping current valid plans', () => {
    const good = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Current' })
    const json = JSON.stringify({
      kind: 'retiregolden.v2.backup',
      backupVersion: 1,
      exportedAtIso: 'x',
      plans: [{ ...good, schemaVersion: 999 }, good],
    })

    const result = parseV2Backup(json)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans).toEqual([good])
      expect(result.warnings).toEqual(['plan 1: skipped (newer_than_app)'])
    }
  })

  it('preserves malicious-looking strings as inert data during import', () => {
    const plan = createEmptyPlan({
      newId: testIds,
      now: fixedNow,
      name: '<img src=x onerror=alert(1)> Retirement',
    })
    plan.scenarios = [
      {
        id: 'scenario-xss',
        name: '<script>alert("scenario")</script>',
        patch: { expenses: { baseAnnual: 42_000 }, note: '<svg onload=alert(1) />' },
      },
    ]

    const result = parseV2Backup(serializeV2Backup([plan], fixedNow))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans[0]!.name).toBe('<img src=x onerror=alert(1)> Retirement')
      expect(result.plans[0]!.scenarios[0]!.name).toBe('<script>alert("scenario")</script>')
      expect(result.plans[0]!.scenarios[0]!.patch).toEqual({
        expenses: { baseAnnual: 42_000 },
        note: '<svg onload=alert(1) />',
      })
    }
  })

  it('rejects plausible-looking envelopes with the wrong kind or non-array plans', () => {
    expect(
      parseV2Backup(
        JSON.stringify({
          kind: 'retiregolden.v2.backup.evil',
          backupVersion: 1,
          exportedAtIso: 'x',
          plans: [createEmptyPlan({ newId: testIds, now: fixedNow })],
        }),
      ),
    ).toEqual({ ok: false, reason: 'wrong_kind' })

    expect(
      parseV2Backup(
        JSON.stringify({
          kind: 'retiregolden.v2.backup',
          backupVersion: 1,
          exportedAtIso: 'x',
          plans: { 0: createEmptyPlan({ newId: testIds, now: fixedNow }) },
        }),
      ),
    ).toEqual({ ok: false, reason: 'wrong_kind' })
  })

  it('fails when no plan in the envelope is valid', () => {
    const json = JSON.stringify({
      kind: 'retiregolden.v2.backup',
      backupVersion: 1,
      exportedAtIso: 'x',
      plans: [{ schemaVersion: 1 }],
    })
    expect(parseV2Backup(json)).toEqual({ ok: false, reason: 'no_valid_plans' })
  })
})

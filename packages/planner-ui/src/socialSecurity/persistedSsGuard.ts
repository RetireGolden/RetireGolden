import type { HouseholdMode, PiaSourceMode, QuickPiaKind, SsFormSnapshot, SsPersisted } from './storage'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function num(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

function str(x: unknown): string | null {
  return typeof x === 'string' ? x : null
}

function oneOf<T extends string>(x: unknown, allowed: readonly T[]): T | undefined {
  if (x === undefined) return undefined
  return typeof x === 'string' && (allowed as readonly string[]).includes(x) ? (x as T) : undefined
}

function claimAgesList(x: unknown): number[] | null {
  if (!Array.isArray(x)) return null
  const out: number[] = []
  for (const a of x) {
    const n = num(a)
    if (n == null || n < 62 || n > 70) return null
    out.push(n)
  }
  return out.length >= 2 ? out : null
}

function partnerClaimAgesList(x: unknown): number[] | null {
  if (!Array.isArray(x)) return null
  const out: number[] = []
  for (const a of x) {
    const n = num(a)
    if (n == null || n < 62 || n > 70) return null
    out.push(n)
  }
  return out.length >= 1 ? out : null
}

/** Returns null if JSON shape does not match v1 SS persisted form (schema drift / corruption). */
export function parseSsPersistedLoose(raw: unknown): SsPersisted | null {
  if (!isRecord(raw)) return null
  if (raw.version !== 1) return null
  const formRaw = raw.form
  if (!isRecord(formRaw)) return null

  const dob = str(formRaw.dob)
  const piaMonthly = num(formRaw.piaMonthly)
  const claimAges = claimAgesList(formRaw.claimAges)
  const endAge = num(formRaw.endAge)
  const colaPercent = num(formRaw.colaPercent)
  const discountPercent = num(formRaw.discountPercent)
  if (!dob || piaMonthly == null || !claimAges || endAge == null || colaPercent == null || discountPercent == null) {
    return null
  }
  if (endAge < 63 || endAge > 110) return null

  let partnerClaimAges: number[] | undefined
  if (formRaw.partnerClaimAges !== undefined) {
    const pa = partnerClaimAgesList(formRaw.partnerClaimAges)
    if (pa == null) return null
    partnerClaimAges = pa
  }

  const householdMode = oneOf<HouseholdMode>(formRaw.householdMode, ['single', 'couple'])
  const piaSource = oneOf<PiaSourceMode>(formRaw.piaSource, ['quick', 'earnings'])
  const partnerPiaSource = oneOf<PiaSourceMode>(formRaw.partnerPiaSource, ['quick', 'earnings'])
  const quickPiaKind = oneOf<QuickPiaKind>(formRaw.quickPiaKind, ['authoritative', 'ssa_estimate'])
  const partnerQuickPiaKind = oneOf<QuickPiaKind>(formRaw.partnerQuickPiaKind, [
    'authoritative',
    'ssa_estimate',
  ])

  const form: SsFormSnapshot = {
    householdMode,
    dob,
    piaSource,
    piaMonthly,
    quickPiaKind,
    ssaEstimateWorkThroughAge:
      formRaw.ssaEstimateWorkThroughAge === undefined
        ? undefined
        : formRaw.ssaEstimateWorkThroughAge === null
          ? null
          : num(formRaw.ssaEstimateWorkThroughAge),
    earningsPaste: typeof formRaw.earningsPaste === 'string' ? formRaw.earningsPaste : undefined,
    lastEarningsYear:
      formRaw.lastEarningsYear === undefined
        ? undefined
        : formRaw.lastEarningsYear === null
          ? null
          : num(formRaw.lastEarningsYear),
    claimAges,
    partnerDob: typeof formRaw.partnerDob === 'string' ? formRaw.partnerDob : undefined,
    partnerPiaSource,
    partnerPiaMonthly:
      formRaw.partnerPiaMonthly === undefined ? undefined : num(formRaw.partnerPiaMonthly) ?? undefined,
    partnerQuickPiaKind,
    partnerSsaEstimateWorkThroughAge:
      formRaw.partnerSsaEstimateWorkThroughAge === undefined
        ? undefined
        : formRaw.partnerSsaEstimateWorkThroughAge === null
          ? null
          : num(formRaw.partnerSsaEstimateWorkThroughAge),
    partnerEarningsPaste:
      typeof formRaw.partnerEarningsPaste === 'string' ? formRaw.partnerEarningsPaste : undefined,
    partnerLastEarningsYear:
      formRaw.partnerLastEarningsYear === undefined
        ? undefined
        : formRaw.partnerLastEarningsYear === null
          ? null
          : num(formRaw.partnerLastEarningsYear),
    partnerClaimAges,
    survivorOverlayEnabled:
      typeof formRaw.survivorOverlayEnabled === 'boolean' ? formRaw.survivorOverlayEnabled : undefined,
    survivorPrimaryDeathAge:
      formRaw.survivorPrimaryDeathAge === undefined
        ? undefined
        : formRaw.survivorPrimaryDeathAge === null
          ? null
          : num(formRaw.survivorPrimaryDeathAge),
    survivorPartnerDeathAge:
      formRaw.survivorPartnerDeathAge === undefined
        ? undefined
        : formRaw.survivorPartnerDeathAge === null
          ? null
          : num(formRaw.survivorPartnerDeathAge),
    endAge,
    colaPercent,
    discountPercent,
  }

  const updatedAt = str(raw.updatedAt)
  if (!updatedAt) return null
  return { version: 1, form, updatedAt }
}

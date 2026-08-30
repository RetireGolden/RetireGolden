import { asUsdCents, type UsdCents } from '../actions/money.js'
import { deriveActionStructuralId } from '../actions/structuralId.js'

export type CharitableDeductionFilingStatus =
  | 'single'
  | 'headOfHousehold'
  | 'marriedFilingJointly'
  | 'marriedFilingSeparately'
  | 'qualifyingSurvivingSpouse'

export interface ExactBigIntRational {
  readonly numerator: bigint
  readonly denominator: bigint
}

export interface AnnualCharitableDeductionParametersProvenance {
  readonly statuteSourceId: '26-usc-68-and-170-2026'
  readonly section68Url: 'https://www.govinfo.gov/link/uscode/26/68'
  readonly section170Url: 'https://www.govinfo.gov/link/uscode/26/170'
  readonly amendingLawSourceId: 'pub-l-119-21'
  readonly amendingLawUrl: 'https://www.govinfo.gov/link/plaw/119/public/21'
  readonly section68ThresholdSourceId: 'irs-rev-proc-2025-32'
  readonly section68ThresholdUrl: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf'
}

export interface AnnualCharitableDeductionParameters2026 {
  readonly predicate: 'annualCharitableDeductionParameters'
  readonly taxYear: 2026
  readonly itemizerContributionFloorRate: Readonly<ExactBigIntRational>
  readonly itemizerContributionFloorQuantization: 'nearestCentHalfUp'
  readonly cashContributionPercentageLimitRate: Readonly<ExactBigIntRational>
  readonly nonitemizerDeductionCapByFilingStatusCents: Readonly<
    Record<CharitableDeductionFilingStatus, UsdCents>
  >
  readonly section68ThresholdByFilingStatusCents: Readonly<
    Record<CharitableDeductionFilingStatus, UsdCents>
  >
  readonly section68LimitationRate: Readonly<ExactBigIntRational>
  readonly section68IntermediateArithmetic: 'bigintRational'
  readonly section68Quantization: 'nearestCentHalfUp'
  readonly provenance: Readonly<AnnualCharitableDeductionParametersProvenance>
  readonly evidenceId: string
}

type ParametersWithoutEvidenceId = Omit<
  AnnualCharitableDeductionParameters2026,
  'evidenceId'
>

const EVIDENCE_DOMAIN = 'annual-charitable-deduction-parameters'

function rationalParts(value: Readonly<ExactBigIntRational>): readonly string[] {
  return [value.numerator.toString(), value.denominator.toString()]
}

export function deriveAnnualCharitableDeductionParametersEvidenceId(
  facts: Readonly<ParametersWithoutEvidenceId>,
): string {
  const caps = facts.nonitemizerDeductionCapByFilingStatusCents
  const thresholds = facts.section68ThresholdByFilingStatusCents
  const source = facts.provenance
  return deriveActionStructuralId(EVIDENCE_DOMAIN, [
    facts.predicate,
    facts.taxYear,
    rationalParts(facts.itemizerContributionFloorRate),
    facts.itemizerContributionFloorQuantization,
    rationalParts(facts.cashContributionPercentageLimitRate),
    [caps.single, caps.headOfHousehold, caps.marriedFilingJointly,
      caps.marriedFilingSeparately, caps.qualifyingSurvivingSpouse],
    [thresholds.single, thresholds.headOfHousehold,
      thresholds.marriedFilingJointly, thresholds.marriedFilingSeparately,
      thresholds.qualifyingSurvivingSpouse],
    rationalParts(facts.section68LimitationRate),
    facts.section68IntermediateArithmetic,
    facts.section68Quantization,
    [source.statuteSourceId, source.section68Url, source.section170Url,
      source.amendingLawSourceId, source.amendingLawUrl,
      source.section68ThresholdSourceId, source.section68ThresholdUrl],
  ])
}

const itemizerFloor = Object.freeze({ numerator: 1n, denominator: 200n })
const cashPercentageLimit = Object.freeze({ numerator: 3n, denominator: 5n })
const section68Rate = Object.freeze({ numerator: 2n, denominator: 37n })
const nonjointCap = asUsdCents(100_000)
const jointCap = asUsdCents(200_000)
const section68Single = asUsdCents(64_060_000)
const section68HeadOfHousehold = asUsdCents(64_060_000)
const section68Joint = asUsdCents(76_870_000)
const section68Separate = asUsdCents(38_435_000)

const facts = Object.freeze({
  predicate: 'annualCharitableDeductionParameters' as const,
  taxYear: 2026 as const,
  itemizerContributionFloorRate: itemizerFloor,
  itemizerContributionFloorQuantization: 'nearestCentHalfUp' as const,
  cashContributionPercentageLimitRate: cashPercentageLimit,
  nonitemizerDeductionCapByFilingStatusCents: Object.freeze({
    single: nonjointCap,
    headOfHousehold: nonjointCap,
    marriedFilingJointly: jointCap,
    marriedFilingSeparately: nonjointCap,
    qualifyingSurvivingSpouse: nonjointCap,
  }),
  section68ThresholdByFilingStatusCents: Object.freeze({
    single: section68Single,
    headOfHousehold: section68HeadOfHousehold,
    marriedFilingJointly: section68Joint,
    marriedFilingSeparately: section68Separate,
    qualifyingSurvivingSpouse: section68Joint,
  }),
  section68LimitationRate: section68Rate,
  section68IntermediateArithmetic: 'bigintRational' as const,
  section68Quantization: 'nearestCentHalfUp' as const,
  provenance: Object.freeze({
    statuteSourceId: '26-usc-68-and-170-2026' as const,
    section68Url: 'https://www.govinfo.gov/link/uscode/26/68' as const,
    section170Url: 'https://www.govinfo.gov/link/uscode/26/170' as const,
    amendingLawSourceId: 'pub-l-119-21' as const,
    amendingLawUrl: 'https://www.govinfo.gov/link/plaw/119/public/21' as const,
    section68ThresholdSourceId: 'irs-rev-proc-2025-32' as const,
    section68ThresholdUrl: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf' as const,
  }),
}) satisfies ParametersWithoutEvidenceId

const parameters = Object.freeze({
  ...facts,
  evidenceId: deriveAnnualCharitableDeductionParametersEvidenceId(facts),
})

/** Returns authoritative exact-law parameters; unsupported years never stand in. */
export function annualCharitableDeductionParameters(
  taxYear: number,
): Readonly<AnnualCharitableDeductionParameters2026> {
  if (taxYear !== 2026) {
    throw new RangeError(`Charitable deduction parameters unavailable for tax year ${taxYear}`)
  }
  return parameters
}

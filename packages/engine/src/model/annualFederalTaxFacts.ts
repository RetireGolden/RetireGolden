import { z } from 'zod'

const calendarYear = z.number().int().min(1900).max(2200)

const acquisitionSchema = z.enum(['manual', 'import'])

const sourceLabelSchema = z.string().min(1).optional()

export const broadKnownProvenanceSchema = z.discriminatedUnion('sourceKind', [
  z.object({
    sourceKind: z.literal('foreignExclusionAggregateWorkpaper'),
    acquisition: acquisitionSchema,
    sourceLabel: sourceLabelSchema,
  }).strict(),
  z.object({
    sourceKind: z.literal('taxProfessionalWorkpaper'),
    acquisition: acquisitionSchema,
    sourceLabel: sourceLabelSchema,
  }).strict(),
  z.object({
    sourceKind: z.literal('planningEstimate'),
    acquisition: acquisitionSchema,
    sourceLabel: sourceLabelSchema,
  }).strict(),
])

export const niitKnownProvenanceSchema = z.discriminatedUnion('sourceKind', [
  z.object({
    sourceKind: z.literal('form8960Line13AllocationWorksheet'),
    acquisition: acquisitionSchema,
    sourceLabel: sourceLabelSchema,
  }).strict(),
  z.object({
    sourceKind: z.literal('taxProfessionalWorkpaper'),
    acquisition: acquisitionSchema,
    sourceLabel: sourceLabelSchema,
  }).strict(),
  z.object({
    sourceKind: z.literal('planningEstimate'),
    acquisition: acquisitionSchema,
    sourceLabel: sourceLabelSchema,
  }).strict(),
])

export const notApplicableProvenanceSchema = z.discriminatedUnion('sourceKind', [
  z.object({
    sourceKind: z.literal('userAttestation'),
    acquisition: acquisitionSchema,
    sourceLabel: sourceLabelSchema,
  }).strict(),
  z.object({
    sourceKind: z.literal('taxProfessionalWorkpaper'),
    acquisition: acquisitionSchema,
    sourceLabel: sourceLabelSchema,
  }).strict(),
])

export const unknownProvenanceSchema = z.object({
  sourceKind: z.literal('unresolvedSource'),
  acquisition: acquisitionSchema,
  sourceLabel: sourceLabelSchema,
}).strict()

const nonnegativeFiniteAmountSchema = z.number().nonnegative().finite()

export const broadAnnualAmountSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('known'),
    amount: nonnegativeFiniteAmountSchema,
    provenance: broadKnownProvenanceSchema,
  }).strict(),
  z.object({
    state: z.literal('notApplicable'),
    amount: z.null(),
    provenance: notApplicableProvenanceSchema,
  }).strict(),
  z.object({
    state: z.literal('unknown'),
    amount: z.null(),
    provenance: unknownProvenanceSchema,
  }).strict(),
])

export const niitAnnualAmountSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('known'),
    amount: nonnegativeFiniteAmountSchema,
    provenance: niitKnownProvenanceSchema,
  }).strict(),
  z.object({
    state: z.literal('notApplicable'),
    amount: z.null(),
    provenance: notApplicableProvenanceSchema,
  }).strict(),
  z.object({
    state: z.literal('unknown'),
    amount: z.null(),
    provenance: unknownProvenanceSchema,
  }).strict(),
])

export const annualForeignIncomeAdjustmentSchema = z.object({
  year: calendarYear,
  foreignExclusionAddback: broadAnnualAmountSchema,
  niitSection911A1NetAddback: niitAnnualAmountSchema,
}).strict()

export const annualFederalTaxFactsSchema = z.object({
  foreignIncomeAdjustments: z.array(annualForeignIncomeAdjustmentSchema),
}).strict().superRefine((facts, ctx) => {
  const seenYears = new Set<number>()
  facts.foreignIncomeAdjustments.forEach((row, index) => {
    if (seenYears.has(row.year)) {
      ctx.addIssue({
        code: 'custom',
        path: ['foreignIncomeAdjustments', index, 'year'],
        message: `duplicate annual federal-tax fact year ${row.year}`,
      })
    }
    seenYears.add(row.year)
  })
})

export type AnnualFederalTaxFactAcquisition = z.infer<typeof acquisitionSchema>
export type BroadKnownProvenance = z.infer<typeof broadKnownProvenanceSchema>
export type NiitKnownProvenance = z.infer<typeof niitKnownProvenanceSchema>
export type NotApplicableProvenance = z.infer<typeof notApplicableProvenanceSchema>
export type UnknownProvenance = z.infer<typeof unknownProvenanceSchema>
export type BroadAnnualAmount = z.infer<typeof broadAnnualAmountSchema>
export type NiitAnnualAmount = z.infer<typeof niitAnnualAmountSchema>
export type AnnualForeignIncomeAdjustment = z.infer<
  typeof annualForeignIncomeAdjustmentSchema
>
export type AnnualFederalTaxFacts = z.infer<typeof annualFederalTaxFactsSchema>

export type FactSourceQuality =
  | 'documented'
  | 'estimated'
  | 'attested'
  | 'legacyContract'
  | 'unresolved'
  | 'missing'

const broadKnownQuality: Readonly<Record<BroadKnownProvenance['sourceKind'], FactSourceQuality>> =
  Object.freeze({
    foreignExclusionAggregateWorkpaper: 'documented',
    taxProfessionalWorkpaper: 'documented',
    planningEstimate: 'estimated',
  })

const niitKnownQuality: Readonly<Record<NiitKnownProvenance['sourceKind'], FactSourceQuality>> =
  Object.freeze({
    form8960Line13AllocationWorksheet: 'documented',
    taxProfessionalWorkpaper: 'documented',
    planningEstimate: 'estimated',
  })

const notApplicableQuality: Readonly<
  Record<NotApplicableProvenance['sourceKind'], FactSourceQuality>
> = Object.freeze({
  userAttestation: 'attested',
  taxProfessionalWorkpaper: 'documented',
})

export const acaLegacyForeignExclusionSourceKind =
  'acaYearContractForeignExclusionAddback'

export function broadSourceQuality(amount: BroadAnnualAmount): FactSourceQuality {
  switch (amount.state) {
    case 'known':
      return broadKnownQuality[amount.provenance.sourceKind]
    case 'notApplicable':
      return notApplicableQuality[amount.provenance.sourceKind]
    case 'unknown':
      return 'unresolved'
  }
}

export function niitSourceQuality(amount: NiitAnnualAmount): FactSourceQuality {
  switch (amount.state) {
    case 'known':
      return niitKnownQuality[amount.provenance.sourceKind]
    case 'notApplicable':
      return notApplicableQuality[amount.provenance.sourceKind]
    case 'unknown':
      return 'unresolved'
  }
}

export function acaCompatibilitySourceQuality(
  state: 'known' | 'notApplicable',
): FactSourceQuality {
  switch (state) {
    case 'known':
    case 'notApplicable':
      return 'legacyContract'
  }
}

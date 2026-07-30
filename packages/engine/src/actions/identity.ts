import { z } from 'zod'

const stableId = <Brand extends string>() =>
  z
    .string()
    .min(1)
    .refine((value) => value.trim().length > 0, { message: 'Identifier must not be blank' })
    .brand<Brand>()

export const actionIdSchema = stableId<'ActionId'>()
export type ActionId = z.infer<typeof actionIdSchema>
export const asActionId = (value: unknown): ActionId => actionIdSchema.parse(value)

export const personIdSchema = stableId<'PersonId'>()
export type PersonId = z.infer<typeof personIdSchema>
export const asPersonId = (value: unknown): PersonId => personIdSchema.parse(value)

export const accountIdSchema = stableId<'AccountId'>()
export type AccountId = z.infer<typeof accountIdSchema>
export const asAccountId = (value: unknown): AccountId => accountIdSchema.parse(value)

export const allocationIdSchema = stableId<'AllocationId'>()
export type AllocationId = z.infer<typeof allocationIdSchema>
export const asAllocationId = (value: unknown): AllocationId => allocationIdSchema.parse(value)

export const planIdSchema = stableId<'PlanId'>()
export type PlanId = z.infer<typeof planIdSchema>
export const asPlanId = (value: unknown): PlanId => planIdSchema.parse(value)

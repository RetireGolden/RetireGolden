import { z } from 'zod'

export const usdCentsSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .refine((value) => !Object.is(value, -0), { message: 'Amount must not be negative zero' })
  .brand<'UsdCents'>()
export type UsdCents = z.infer<typeof usdCentsSchema>
export const asUsdCents = (value: unknown): UsdCents => usdCentsSchema.parse(value)

export const positiveUsdCentsSchema = usdCentsSchema
  .refine((value) => value > 0, { message: 'Amount must be positive' })
  .brand<'PositiveUsdCents'>()
export type PositiveUsdCents = z.infer<typeof positiveUsdCentsSchema>
export const asPositiveUsdCents = (value: unknown): PositiveUsdCents =>
  positiveUsdCentsSchema.parse(value)

export function addUsdCents(left: UsdCents, right: UsdCents): UsdCents {
  return usdCentsSchema.parse(left + right)
}

export function subtractUsdCents(minuend: UsdCents, subtrahend: UsdCents): UsdCents {
  return usdCentsSchema.parse(minuend - subtrahend)
}

export function sumUsdCents(values: readonly UsdCents[]): UsdCents {
  return values.reduce(addUsdCents, usdCentsSchema.parse(0))
}

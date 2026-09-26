/**
 * Ids that two plan rows may not share, because the projection keeps a value
 * per id and one row's value would replace the other's.
 *
 * The year's published balances (`YearResult.balances`) are one record keyed
 * by id, written from four channels: the investable accounts, the property
 * values, the debt balances and the permanent-life cash values, and the
 * property, debt and cash-value channels are themselves maps keyed by id. The
 * insurance policies also keep per-policy state by id (a permanent-life cash
 * value, an LTC policy's benefit years used). So a property and a debt under
 * one id publish only the later value, two properties under one id leave one
 * of them out of net worth, and a policy under an account's id replaces that
 * account's published balance.
 *
 * Investable accounts sharing an id are the one deliberate exception: they are
 * one logical account held in several rows, and the plan checks require their
 * facts to agree (`checkAmbiguousAccountIds`). Pensions and annuities publish
 * no value under their id and take no part here.
 *
 * Decision D-CASH-PROPERTY-ALIAS (2026-09-25) and its extension the next day:
 * the plan checks refuse every collision found here, and a stored plan that
 * holds one is repaired on load (model/migrations.ts) by giving each colliding
 * row after the first its own id. This module is the single reading of which
 * rows collide and which row keeps the id, used by both.
 */

/** The value channel a row publishes under its id, or null for a row that publishes none. */
export type SharedIdChannel = 'balance' | 'property' | 'debt' | 'permanentLife' | 'ltc'

export interface SharedIdRow {
  readonly id: string
  readonly channel: SharedIdChannel | null
}

export interface SharedIdMember {
  readonly collection: 'accounts' | 'insurance'
  readonly index: number
  readonly channel: SharedIdChannel
}

export interface SharedIdGroup {
  readonly id: string
  /** 'balances' for the published balances record, 'insurance' for per-policy state. */
  readonly space: 'balances' | 'insurance'
  /** Every row carrying the id in this space, accounts in stored order and then policies. */
  readonly members: readonly SharedIdMember[]
  /** The row that keeps the id: the first investable account if any, else the first member. */
  readonly keeper: SharedIdMember
}

const BALANCE_ACCOUNT_TYPES = new Set(['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'])

/** The channel of a stored account row, read from its `type`. */
export function accountChannel(type: unknown): SharedIdChannel | null {
  if (typeof type !== 'string') return null
  if (BALANCE_ACCOUNT_TYPES.has(type)) return 'balance'
  if (type === 'property' || type === 'debt') return type
  return null
}

/** The channel of a stored insurance row, read from its `kind`. */
export function policyChannel(kind: unknown): SharedIdChannel | null {
  return kind === 'permanentLife' || kind === 'ltc' ? kind : null
}

function groupBy(members: readonly (SharedIdMember & { readonly id: string })[]): Map<string, SharedIdMember[]> {
  const groups = new Map<string, SharedIdMember[]>()
  for (const { id, ...member } of members) {
    const group = groups.get(id)
    if (group === undefined) groups.set(id, [member])
    else group.push(member)
  }
  return groups
}

/**
 * Every id two rows collide on. In the balances space a group collides when it
 * has two or more members and at least one is not an investable account; in
 * the insurance space any two policies under one id collide.
 */
export function sharedIdGroups(
  accounts: readonly SharedIdRow[],
  policies: readonly SharedIdRow[],
): SharedIdGroup[] {
  const accountMembers = accounts.flatMap((row, index) =>
    row.channel === null ? [] : [{ id: row.id, collection: 'accounts' as const, index, channel: row.channel }])
  const policyMembers = policies.flatMap((row, index) =>
    row.channel === null ? [] : [{ id: row.id, collection: 'insurance' as const, index, channel: row.channel }])
  const groups: SharedIdGroup[] = []
  const balances = groupBy([
    ...accountMembers,
    ...policyMembers.filter((member) => member.channel === 'permanentLife'),
  ])
  for (const [id, members] of balances) {
    if (members.length < 2 || members.every((member) => member.channel === 'balance')) continue
    const keeper = members.find((member) => member.channel === 'balance') ?? members[0]!
    groups.push({ id, space: 'balances', members, keeper })
  }
  for (const [id, members] of groupBy(policyMembers)) {
    if (members.length < 2) continue
    groups.push({ id, space: 'insurance', members, keeper: members[0]! })
  }
  return groups
}

/**
 * The rows that give up the id: every member of a colliding group other than
 * its keeper and other than an investable account (those stay one logical
 * account). A row can collide in both spaces; it is listed once. Accounts come
 * first in stored order, then policies.
 */
export function sharedIdRenames(groups: readonly SharedIdGroup[]): SharedIdMember[] {
  const seen = new Set<string>()
  const renamed: SharedIdMember[] = []
  for (const group of groups) {
    for (const member of group.members) {
      if (member === group.keeper || member.channel === 'balance') continue
      const key = `${member.collection}:${member.index}`
      if (seen.has(key)) continue
      seen.add(key)
      renamed.push(member)
    }
  }
  return renamed.sort((left, right) =>
    left.collection === right.collection
      ? left.index - right.index
      : left.collection === 'accounts' ? -1 : 1)
}

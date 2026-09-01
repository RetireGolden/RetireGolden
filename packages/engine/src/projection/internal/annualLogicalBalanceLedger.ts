import type { Account } from '../../model/plan.js'

export type PhysicalBalanceAccount = Extract<Account, {
  type: 'cash' | 'taxable' | 'equityComp' | 'traditional' | 'roth' | 'hsa'
}>

export interface PhysicalBalanceState {
  account: PhysicalBalanceAccount
  balance: number
  costBasis: number
}

export interface LogicalBalanceMember {
  readonly balanceIndex: number
  readonly state: PhysicalBalanceState
}

export interface LogicalBalanceSnapshot extends PhysicalBalanceState {}

function finiteNonnegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be finite and nonnegative`)
  }
}

function ownerPersonId(account: PhysicalBalanceAccount): string | null {
  return account.ownerPersonId ?? null
}

function retirementKind(account: PhysicalBalanceAccount): string | null {
  return account.type === 'traditional' || account.type === 'roth'
    ? account.kind
    : null
}

/**
 * One logical account ID backed by one or more live positional balance rows.
 *
 * Facts come from the last row; ID order comes from the first. Mutations are
 * prepared and validated in full before any physical row is written.
 */
export class AnnualLogicalBalanceGroup {
  readonly id: string
  readonly members: readonly LogicalBalanceMember[]
  readonly account: PhysicalBalanceAccount

  constructor(id: string, members: readonly LogicalBalanceMember[]) {
    if (members.length === 0) throw new Error('logical balance group requires a member')
    this.id = id
    this.members = members
    this.account = members[members.length - 1]!.state.account

    for (const { state } of members) {
      if (
        state.account.id !== id ||
        state.account.type !== this.account.type ||
        retirementKind(state.account) !== retirementKind(this.account) ||
        ownerPersonId(state.account) !== ownerPersonId(this.account)
      ) {
        throw new Error(`incompatible physical rows for account id "${id}"`)
      }
      finiteNonnegative(state.balance, `balance for account id "${id}"`)
      finiteNonnegative(state.costBasis, `cost basis for account id "${id}"`)
    }
  }

  get balance(): number {
    if (this.members.length === 1) return this.members[0]!.state.balance
    return this.members.reduce((sum, member) => sum + member.state.balance, 0)
  }

  get costBasis(): number {
    if (this.members.length === 1) return this.members[0]!.state.costBasis
    return this.members.reduce((sum, member) => sum + member.state.costBasis, 0)
  }

  liveState(): LogicalBalanceSnapshot {
    const group = this
    return {
      account: this.account,
      get balance() {
        return group.balance
      },
      set balance(value: number) {
        group.applyClosingSnapshot({ balance: value })
      },
      get costBasis() {
        return group.costBasis
      },
      set costBasis(value: number) {
        group.applyClosingSnapshot({ balance: group.balance, costBasis: value })
      },
    }
  }

  /** Apply an exact aggregate closing state, pro rata across physical rows. */
  applyClosingSnapshot(closing: { balance: number; costBasis?: number }): void {
    finiteNonnegative(closing.balance, `closing balance for account id "${this.id}"`)
    if (closing.costBasis !== undefined) {
      finiteNonnegative(closing.costBasis, `closing cost basis for account id "${this.id}"`)
    }
    for (const { state } of this.members) {
      finiteNonnegative(state.balance, `balance for account id "${this.id}"`)
      finiteNonnegative(state.costBasis, `cost basis for account id "${this.id}"`)
    }

    const openingBalance = this.balance
    const openingBasis = this.costBasis
    const selectedIndex = this.members.length - 1
    const nextBalances = this.allocateAggregate(
      closing.balance,
      openingBalance,
      (member) => member.state.balance,
      selectedIndex,
    )
    const nextBasis = closing.costBasis === undefined
      ? null
      : this.allocateAggregate(
        closing.costBasis,
        openingBasis,
        (member) => member.state.costBasis,
        selectedIndex,
      )

    for (let index = 0; index < this.members.length; index += 1) {
      const state = this.members[index]!.state
      state.balance = nextBalances[index]!
      if (nextBasis !== null) state.costBasis = nextBasis[index]!
    }
  }

  debit(amount: number, closingCostBasis?: number): void {
    finiteNonnegative(amount, `debit for account id "${this.id}"`)
    const opening = this.balance
    if (amount > opening) {
      throw new Error(`debit exceeds aggregate capacity for account id "${this.id}"`)
    }
    this.applyClosingSnapshot({
      balance: opening - amount,
      ...(closingCostBasis === undefined ? {} : { costBasis: closingCostBasis }),
    })
  }

  credit(amount: number, closingCostBasis?: number): void {
    finiteNonnegative(amount, `credit for account id "${this.id}"`)
    const opening = this.balance
    this.applyClosingSnapshot({
      balance: opening + amount,
      ...(closingCostBasis === undefined ? {} : { costBasis: closingCostBasis }),
    })
  }

  private allocateAggregate(
    target: number,
    opening: number,
    valueOf: (member: LogicalBalanceMember) => number,
    selectedIndex: number,
  ): number[] {
    if (this.members.length === 1) return [target]
    if (opening === 0) {
      return this.members.map((_, index) => index === selectedIndex ? target : 0)
    }

    const allocated = new Array<number>(this.members.length).fill(0)
    let assigned = 0
    let residualIndex = selectedIndex
    for (let index = this.members.length - 1; index >= 0; index -= 1) {
      if (valueOf(this.members[index]!) > 0) {
        residualIndex = index
        break
      }
    }
    for (let index = 0; index < this.members.length; index += 1) {
      if (index === residualIndex) continue
      const value = target * (valueOf(this.members[index]!) / opening)
      finiteNonnegative(value, `allocated closing value for account id "${this.id}"`)
      allocated[index] = value
      assigned += value
    }
    const residual = target - assigned
    finiteNonnegative(residual, `allocated closing residual for account id "${this.id}"`)
    allocated[residualIndex] = residual
    return allocated
  }
}

export class AnnualLogicalBalanceLedger {
  readonly groups: readonly AnnualLogicalBalanceGroup[]
  readonly byId: ReadonlyMap<string, AnnualLogicalBalanceGroup>

  constructor(states: readonly PhysicalBalanceState[]) {
    const membersById = new Map<string, LogicalBalanceMember[]>()
    states.forEach((state, balanceIndex) => {
      const members = membersById.get(state.account.id)
      const member = { balanceIndex, state }
      if (members === undefined) membersById.set(state.account.id, [member])
      else members.push(member)
    })
    const groups = [...membersById].map(([id, members]) =>
      new AnnualLogicalBalanceGroup(id, members))
    this.groups = groups
    this.byId = new Map(groups.map((group) => [group.id, group]))
  }

  liveStates(): LogicalBalanceSnapshot[] {
    return this.groups.map((group) => group.liveState())
  }
}

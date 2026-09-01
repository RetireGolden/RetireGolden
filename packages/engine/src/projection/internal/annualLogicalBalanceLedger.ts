import {
  duplicateAccountIdentityFacts,
  type Account,
} from '../../model/plan.js'

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

export type LogicalBalanceSnapshot = PhysicalBalanceState

function finiteNonnegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be finite and nonnegative`)
  }
}

/**
 * One logical account ID backed by one or more live positional balance rows.
 *
 * Facts come from the last row; ID order comes from the first. The constructor
 * independently verifies every identity-bearing fact (including normalized
 * estate disposition) before exposing the group. Mutations are prepared and
 * validated in full before any physical row is written.
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
    const selectedFacts = duplicateAccountIdentityFacts(this.account)

    for (const { state } of members) {
      const facts = duplicateAccountIdentityFacts(state.account)
      if (
        state.account.id !== id ||
        facts.length !== selectedFacts.length ||
        facts.some((fact, index) => fact !== selectedFacts[index])
      ) {
        throw new Error(`incompatible physical rows for account id "${id}"`)
      }
      finiteNonnegative(state.balance, `balance for account id "${id}"`)
      finiteNonnegative(state.costBasis, `cost basis for account id "${id}"`)
    }
    finiteNonnegative(this.balance, `aggregate balance for account id "${id}"`)
    finiteNonnegative(this.costBasis, `aggregate cost basis for account id "${id}"`)
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
    const readBalance = () => this.balance
    const readCostBasis = () => this.costBasis
    const applyClosingSnapshot = this.applyClosingSnapshot.bind(this)
    return {
      account: this.account,
      get balance() {
        return readBalance()
      },
      set balance(value: number) {
        applyClosingSnapshot({ balance: value })
      },
      get costBasis() {
        return readCostBasis()
      },
      set costBasis(value: number) {
        applyClosingSnapshot({ balance: readBalance(), costBasis: value })
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

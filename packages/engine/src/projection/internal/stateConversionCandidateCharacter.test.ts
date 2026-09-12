import { describe, expect, it } from 'vitest'
import { characterizeStateConversionCandidate } from './stateConversionCandidateCharacter.js'

describe('state conversion candidate character at a remaining basis boundary', () => {
  it('caps recovery once across owner sources and keeps employer distributions separate', () => {
    // IRC408(d)(2) / Form8606: an owner cannot recover more than remaining
    // nondeductible basis. At the boundary30 remaining, a50% annual ratio
    // on60 then40 recovers30 then0, leaving taxable30+40=70. An employer
    // plan is outside that IRA pool and contributes its full20 taxable.
    const opening = new Map([['owner',{basis:30,nontaxableFraction:.5}]])
    const draws = [
      {accountId:'first',ownerPersonId:'owner',amount:60,aggregatedIra:true},
      {accountId:'second',ownerPersonId:'owner',amount:40,aggregatedIra:true},
      {accountId:'employer',ownerPersonId:'owner',amount:20,aggregatedIra:false},
    ]
    const result = characterizeStateConversionCandidate(draws,opening,()=>.5)
    expect([...result.taxable]).toEqual([['first',30],['second',40],['employer',20]])
    expect(result.taxableTotal).toBe(90)
    expect([...result.grossAmounts]).toEqual([['first',60],['second',40],['employer',20]])
    expect(opening.get('owner')!.basis).toBe(30)
    expect(characterizeStateConversionCandidate(draws,opening,()=>.5)).toEqual(result)
  })
})

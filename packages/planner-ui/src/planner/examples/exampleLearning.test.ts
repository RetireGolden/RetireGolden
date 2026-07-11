import { describe, expect, it } from 'vitest'

import { getArticle } from '../../learn/learningRegistry'
import { LEARN } from '../learnLinks'
import { EXAMPLE_PLANS } from './registry'

describe('example library learning integration', () => {
  it('every example learnSlug resolves to a ready example-plans article', () => {
    for (const example of EXAMPLE_PLANS) {
      const article = getArticle(example.learnSlug)
      expect(article, example.id).toBeDefined()
      expect(['example-plans', 'early-investing-fire']).toContain(article?.category)
      expect(article?.status).toBe('ready')
      expect(article?.exampleId).toBe(example.id)
    }
  })

  it('LEARN hooks for examples resolve to articles', () => {
    const hooks = [
      LEARN.exampleCouple,
      LEARN.exampleUnderSavedSingle,
      LEARN.exampleBracketFillRoth,
      LEARN.exampleEarlyRetireeAca,
      LEARN.exampleRmdIrmaa,
      LEARN.exampleSurvivorYears,
      LEARN.exampleMovingStateTax,
      LEARN.exampleLtcShock,
      LEARN.exampleGuardrailsFlex,
      LEARN.exampleAnnuityEstate,
      LEARN.exampleGlidepathAllocation,
      LEARN.exampleHsaPropertyDepth,
      LEARN.exampleFixedTargetSpending,
      LEARN.exampleNoAnnuityBrokerage,
      LEARN.exampleStaticAllocationControl,
      LEARN.exampleBrokerageNoHsa,
    ]
    for (const hook of hooks) {
      expect(getArticle(hook.slug)?.status).toBe('ready')
    }
  })
})

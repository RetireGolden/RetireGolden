/**
 * Named corpora, composed of tiers.
 *
 * A corpus is DATA, and that is the point. `equivalence.mjs corpus` materializes
 * one to JSON; `equivalence.mjs capture` feeds those identical input bytes to
 * whichever engine tree it is pointed at. The only variable between a base and
 * a head capture is then the engine source — not a plan builder that happens to
 * live in one tree and not the other.
 *
 * Each member is `{ id, covers, plan, options, tax }`:
 *   plan     a PARSED plan (so the corpus is validated once, at build time),
 *            re-parsed by each tree at capture time so both run their own
 *            `parsePlan`
 *   options  the JSON-safe half of `SimulateOptions` (`taxCalculator` is a
 *            function and cannot be data; see `tax`)
 *   tax      a descriptor naming the tax stack, resolved per tree in modes.mjs
 *   covers   what branch or hazard this member exists to reach — prose, checked
 *            by `equivalence.mjs reach` rather than trusted
 */
import { blockMembers } from './blocks.mjs'
import { exampleMembers, examplesTierAvailable, examplesTierLocation } from './examples.mjs'

/** @type {Record<string, { why: string, tiers: readonly string[] }>} */
export const CORPORA = {
  full: {
    why: 'everything: the 29 curated examples plus all purpose-built extraction and blind-spot block members',
    tiers: ['examples', 'blocks'],
  },
  examples: {
    why: 'the 29 curated example plans only — realistic, but blind to HECM and pension lump sums',
    tiers: ['examples'],
  },
  blocks: {
    why: 'all purpose-built extraction and shared blind-spot members — needs no planner-ui checkout',
    tiers: ['blocks'],
  },
}

export const CORPUS_NAMES = Object.keys(CORPORA)

/** @param {string} name @returns {Promise<{ name: string, members: object[], tiers: string[] }>} */
export async function buildCorpus(name) {
  const spec = CORPORA[name]
  if (spec === undefined) throw new Error(`unknown corpus "${name}" (known: ${CORPUS_NAMES.join(', ')})`)
  const members = []
  for (const tier of spec.tiers) {
    if (tier === 'examples') members.push(...(await exampleMembers()))
    else if (tier === 'blocks') members.push(...(await blockMembers()))
    else throw new Error(`unknown tier "${tier}"`)
  }
  const ids = members.map((member) => member.id)
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index)
  if (duplicate !== undefined) throw new Error(`duplicate corpus member id "${duplicate}"`)
  return { name, members, tiers: [...spec.tiers] }
}

export { examplesTierAvailable, examplesTierLocation }

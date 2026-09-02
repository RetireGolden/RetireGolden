/**
 * Plan-name presentation limits (#533). The helpers live in data/planName.ts
 * so the store can apply the same fallback without depending on the planner
 * layer; this module keeps the planner-side import path.
 */
export * from '../data/planName'

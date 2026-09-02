/**
 * The Learning Center registry, loaded on demand. The registry indexes every
 * article and stays out of the plan workspace chunk (as it does for the tab
 * title in App.tsx); the workspace not-found page needs it only to name a
 * Learn article escape. A separate module so a test can hold the load open
 * and check what the page shows while it waits.
 */
export function loadLearningRegistry(): Promise<typeof import('../learn/learningRegistry')> {
  return import('../learn/learningRegistry')
}

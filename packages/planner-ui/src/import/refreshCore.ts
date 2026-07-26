/**
 * Browser-free path protection shared by the two refresh contracts.
 *
 * Private on purpose: callers supply protected paths through the public
 * classify/build/apply APIs; this helper only keeps their enforcement identical.
 */
export function isProtectedPath(path: string, protectedTargets: ReadonlySet<string>): boolean {
  if (protectedTargets.size === 0) return false
  for (const protectedPath of protectedTargets) {
    if (
      protectedPath === path ||
      protectedPath.startsWith(`${path}.`) ||
      protectedPath.startsWith(`${path}[`) ||
      path.startsWith(`${protectedPath}.`) ||
      path.startsWith(`${protectedPath}[`)
    ) {
      return true
    }
  }
  return false
}

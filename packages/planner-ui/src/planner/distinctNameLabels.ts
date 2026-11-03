/**
 * Display labels for a list of named things that may share a name (#777).
 *
 * A name that is unique in the list is shown as it is: "Sam IRA". Only names
 * that actually collide get a suffix, and the suffix is the item's place
 * among the items with that name, in list order: "Sam IRA (1 of 2)",
 * "Sam IRA (2 of 2)". The internal id never appears; it means nothing to the
 * reader and wraps badly at phone width. Names compare trimmed and without
 * case, since "Sam IRA" and "sam ira " read as the same account. A blank
 * name shows the caller's fallback, so it can still be told apart.
 */
export function distinctNameLabels(
  items: readonly { readonly id: string; readonly name: string }[],
  fallback: string,
): ReadonlyMap<string, string> {
  const shown = items.map((item) => {
    const name = item.name.trim()
    return { id: item.id, name: name === '' ? fallback : name }
  })
  const key = (name: string) => name.toLocaleLowerCase()
  const totals = new Map<string, number>()
  for (const item of shown) totals.set(key(item.name), (totals.get(key(item.name)) ?? 0) + 1)
  const seen = new Map<string, number>()
  const labels = new Map<string, string>()
  for (const item of shown) {
    const total = totals.get(key(item.name))!
    if (total === 1) {
      labels.set(item.id, item.name)
      continue
    }
    const place = (seen.get(key(item.name)) ?? 0) + 1
    seen.set(key(item.name), place)
    labels.set(item.id, `${item.name} (${place} of ${total})`)
  }
  return labels
}

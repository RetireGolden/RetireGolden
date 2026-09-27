/**
 * A detector's evaluate() found nothing to preview, and says why in words a
 * reader can act on ("No beneficial asset-location swap was found once taxes,
 * taxable drag, and rebalancing were priced in."). The planner shows the
 * message as it stands; any other error from a preview is stated in its own
 * plain words (PR #754). A leaf module with no imports.
 */
export class InsightPreviewUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsightPreviewUnavailable'
  }
}

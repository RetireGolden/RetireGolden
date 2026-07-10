import type { InsightCategory } from '../../engine/insights/types'

/** Human-readable names for insight categories, shared by the page grouping and card badges. */
export const CATEGORY_LABELS: Record<InsightCategory, string> = {
  'tax-brackets': 'Tax Brackets & Headroom',
  'accounts-contributions': 'Account Contributions',
  'withdrawals-charitable': 'Withdrawals & Charitable Giving',
  'sequence-risk': 'Sequence Risk & Spending',
  'social-security': 'Social Security & Spousal',
  'longevity-insurance-geography': 'Longevity & Geography',
}

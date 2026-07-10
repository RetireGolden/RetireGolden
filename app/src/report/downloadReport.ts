import type { Plan } from '../engine/model/plan'
import type { ProjectionSummary } from '../engine/projection/compare'
import type { ProjectionResult } from '../engine/projection/types'
import { buildStandaloneReportHtml, type ReportRecommendationEvidence } from './reportHtml'

function fileStem(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'retiregolden-plan'
}

export function downloadStandaloneReport(args: {
  plan: Plan
  result: ProjectionResult
  summary: ProjectionSummary
  startYear: number
  recommendationEvidence?: ReportRecommendationEvidence | null
}): void {
  const html = buildStandaloneReportHtml(args)
  const blob = new Blob([html], { type: 'text/html' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${fileStem(args.plan.name)}-retiregolden-report.html`
  a.click()
  URL.revokeObjectURL(a.href)
}

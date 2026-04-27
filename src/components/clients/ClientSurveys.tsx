import type { Survey } from '@/types/app'
import { formatDate } from '@/lib/formatters'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { AlertTriangle, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClientSurveysProps {
  clientId: string
  surveys: Survey[]
}

function scoreColor(score: number | null) {
  if (score == null) return 'text-gray-400'
  if (score >= 8) return 'text-green-600'
  if (score >= 7) return 'text-amber-500'
  return 'text-red-600'
}

function averageSurveyScore(s: Survey): number | null {
  const scores = [s.quality_score, s.reliability_score, s.communication_score, s.value_score]
    .filter((x): x is number => x != null)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function isAtRisk(s: Survey): boolean {
  const scores = [s.quality_score, s.reliability_score, s.communication_score, s.value_score]
  return scores.some((x) => x != null && x < 7)
}

export function ClientSurveys({ clientId, surveys }: ClientSurveysProps) {
  return (
    <Card padding={false}>
      <CardHeader className="px-6 pt-5 pb-4 border-b border-gray-100">
        <CardTitle>Survey History</CardTitle>
        {surveys.length > 0 && (
          <span className="text-xs text-gray-400">{surveys.length} response{surveys.length !== 1 ? 's' : ''}</span>
        )}
      </CardHeader>
      <div className="divide-y divide-gray-100">
        {surveys.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Star className="w-6 h-6 text-gray-200 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-400">No surveys yet</p>
            <p className="text-xs text-gray-400 mt-1">Send a survey from the top of this page to collect feedback</p>
          </div>
        ) : (
          surveys.map((s) => {
            const avg = averageSurveyScore(s)
            const atRisk = isAtRisk(s)
            return (
              <div key={s.id} className="px-6 py-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    {formatDate(s.submitted_at)}
                  </p>
                  <div className="flex items-center gap-2">
                    {atRisk && (
                      <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        At risk
                      </span>
                    )}
                    {avg != null && (
                      <span className={cn('text-sm font-bold', scoreColor(avg))}>
                        {avg.toFixed(1)}/10
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {(['quality_score', 'reliability_score', 'communication_score', 'value_score', 'nps_score'] as const).map((key) => {
                    const labels: Record<string, string> = { quality_score: 'Quality', reliability_score: 'Reliability', communication_score: 'Comms', value_score: 'Value', nps_score: 'NPS' }
                    return (
                      <div key={key} className="text-center bg-gray-50 rounded-lg py-2">
                        <p className="text-gray-400 mb-0.5">{labels[key]}</p>
                        <p className={cn('font-bold text-sm', scoreColor((s as any)[key]))}>{(s as any)[key] ?? '—'}</p>
                      </div>
                    )
                  })}
                </div>
                {s.comments && (
                  <p className="text-xs text-gray-500 mt-2 italic">&ldquo;{s.comments}&rdquo;</p>
                )}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

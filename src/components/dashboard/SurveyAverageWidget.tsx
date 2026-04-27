import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface SurveyAverages {
  quality: number
  reliability: number
  communication: number
  value: number
  totalResponses: number
}

interface SurveyAverageWidgetProps {
  averages: SurveyAverages
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = (score / 10) * 100
  const color =
    score >= 8 ? 'bg-green-500' : score >= 7 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span
          className={cn(
            'font-bold',
            score >= 8
              ? 'text-green-600'
              : score >= 7
              ? 'text-amber-600'
              : 'text-red-600'
          )}
        >
          {score.toFixed(1)}/10
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function SurveyAverageWidget({ averages }: SurveyAverageWidgetProps) {
  const overall =
    (averages.quality +
      averages.reliability +
      averages.communication +
      averages.value) /
    4

  return (
    <Card>
      <CardHeader>
        <CardTitle>Survey Averages</CardTitle>
        <span className="text-xs text-gray-400">
          {averages.totalResponses} response{averages.totalResponses !== 1 ? 's' : ''}
        </span>
      </CardHeader>

      {averages.totalResponses === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          No survey data yet
        </p>
      ) : (
        <div className="space-y-4">
          <div className="text-center pb-4 border-b border-gray-100">
            <p className="text-3xl font-bold text-gray-900">
              {overall.toFixed(1)}
            </p>
            <p className="text-xs text-gray-400">Overall average score</p>
          </div>
          <div className="space-y-3">
            <ScoreBar label="Quality" score={averages.quality} />
            <ScoreBar label="Reliability" score={averages.reliability} />
            <ScoreBar label="Communication" score={averages.communication} />
            <ScoreBar label="Value for Money" score={averages.value} />
          </div>
        </div>
      )}
    </Card>
  )
}

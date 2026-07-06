'use client'

import { useState } from 'react'
import { submitSurveyAction } from '@/actions/survey-email'

const QUESTIONS = [
  {
    key: 'qualityScore' as const,
    section: 'Quality',
    question: 'How satisfied are you with the standard of cleaning at your site?',
  },
  {
    key: 'reliabilityScore' as const,
    section: 'Reliability',
    question: 'How confident are you that we will complete every visit to a consistent standard?',
  },
  {
    key: 'communicationScore' as const,
    section: 'Communication',
    question: 'How easy is it to reach us when you have a question or request?',
  },
  {
    key: 'valueScore' as const,
    section: 'Value',
    question: 'How would you rate the value you get for what you pay?',
  },
  {
    key: 'loyaltyScore' as const,
    section: null,
    question: 'How likely are you to continue using Core Cleaning long term?',
  },
]

type ScoreKey = 'qualityScore' | 'reliabilityScore' | 'communicationScore' | 'valueScore' | 'loyaltyScore'

function ScoreSelector({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const selected = value === n
          const color = n <= 4 ? '#ef4444' : n <= 6 ? '#f59e0b' : '#22c55e'
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                width: 46,
                height: 46,
                borderRadius: 8,
                border: selected ? `2px solid ${color}` : '2px solid #e5e7eb',
                background: selected ? color : '#fff',
                color: selected ? '#fff' : '#374151',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'all 0.1s',
                flexShrink: 0,
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
        <span>0 — Not at all</span>
        <span>10 — Extremely</span>
      </div>
    </div>
  )
}

export function SurveyForm({ token }: { token: string }) {
  const [scores, setScores] = useState<Record<ScoreKey, number | null>>({
    qualityScore: null,
    reliabilityScore: null,
    communicationScore: null,
    valueScore: null,
    loyaltyScore: null,
  })
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const allAnswered = Object.values(scores).every((v) => v !== null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allAnswered) return setError('Please answer all questions before submitting.')
    setSubmitting(true)
    setError(null)
    const result = await submitSurveyAction({
      token,
      qualityScore: scores.qualityScore!,
      reliabilityScore: scores.reliabilityScore!,
      communicationScore: scores.communicationScore!,
      valueScore: scores.valueScore!,
      loyaltyScore: scores.loyaltyScore!,
      comments: comments.trim() || undefined,
    })
    setSubmitting(false)
    if (result.error) return setError(result.error)
    setDone(true)
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: 52, marginBottom: 16 }}>🙏</p>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111', marginBottom: 8 }}>Thank you!</h2>
        <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6 }}>
          Your feedback has been received. We really appreciate you taking the time — it helps us keep improving.
        </p>
        <p style={{ fontSize: 14, color: '#999', marginTop: 16 }}>— Laith &amp; the Core Cleaning team</p>
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e5e7eb',
    padding: '24px',
    marginBottom: 12,
  }

  return (
    <form onSubmit={handleSubmit}>
      {QUESTIONS.map((q, i) => (
        <div key={q.key} style={cardStyle}>
          {q.section && (
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>
              {q.section}
            </p>
          )}
          <p style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 20, lineHeight: 1.4 }}>
            {q.question}
          </p>
          <ScoreSelector
            value={scores[q.key]}
            onChange={(v) => setScores(prev => ({ ...prev, [q.key]: v }))}
          />
        </div>
      ))}

      {/* Comments */}
      <div style={cardStyle}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 6, lineHeight: 1.4 }}>
          Is there anything we could improve or anything you'd like to highlight about our service?
        </p>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Optional</p>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 14,
            color: '#111',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: 14 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !allAnswered}
        style={{
          width: '100%',
          padding: '16px',
          background: allAnswered ? '#111' : '#d1d5db',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 700,
          cursor: allAnswered ? 'pointer' : 'not-allowed',
          fontFamily: 'Arial, sans-serif',
          transition: 'background 0.2s',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit Feedback'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
        Your response is confidential and only shared with the Core Cleaning team.
      </p>
    </form>
  )
}

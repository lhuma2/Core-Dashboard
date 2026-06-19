'use client'

import { cn } from '@/lib/utils'
import { forwardRef, useEffect, useImperativeHandle, useRef, type TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  /** Grow the box to fit its content as you type. Defaults to true. */
  autoGrow?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, autoGrow = true, rows = 4, onInput, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const innerRef = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement)

    function resize() {
      const el = innerRef.current
      if (!el || !autoGrow) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }

    // Size to fit on mount (covers defaultValue / saved scopes) and when the value changes externally
    useEffect(() => { resize() }, [props.value, props.defaultValue]) // eslint-disable-line react-hooks/exhaustive-deps

    // rows acts as the minimum height; auto-grow only ever expands past it
    const minHeight = autoGrow ? (Number(rows) * 20 + 16) : undefined

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-gray-600">
            {label}
          </label>
        )}
        <textarea
          ref={innerRef}
          id={inputId}
          rows={rows}
          onInput={(e) => { resize(); onInput?.(e) }}
          style={minHeight ? { minHeight } : undefined}
          className={cn(
            'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2 text-sm',
            autoGrow ? 'resize-none overflow-hidden' : 'resize-y',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors',
            error && 'border-red-400',
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
export { Textarea }

import { useState } from 'react'
import VoiceInput from './VoiceInput'

function EvaluationField({ label, fieldId, value, comment, onValueChange, onCommentChange, disabled, highlighted }) {
  const currentValue = value || 'Pass'

  return (
    <div className={`py-3 border-b border-gray-100 last:border-b-0 ${highlighted ? 'bg-yellow-50 -mx-4 px-4 border-l-4 border-l-yellow-400 rounded-r-md' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-gray-800">{label}</p>
        <div className="flex gap-1">
          {['Pass', 'Fail', 'N/A'].map((opt) => (
            <button
              key={opt}
              onClick={() => !disabled && onValueChange(fieldId, opt)}
              disabled={disabled}
              className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                currentValue === opt
                  ? opt === 'Pass'
                    ? 'bg-green-100 text-green-700'
                    : opt === 'Fail'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              } ${disabled ? 'opacity-50' : ''}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {currentValue === 'Fail' && (
        <div className="mt-2">
          <div className="flex items-start gap-2">
            <textarea
              value={comment || ''}
              onChange={(e) => onCommentChange(fieldId + '_comment', e.target.value)}
              placeholder="Required — describe the issue"
              disabled={disabled}
              rows={2}
              className="flex-1 border border-red-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50"
            />
            <VoiceInput
              onTranscript={(text) => onCommentChange(fieldId + '_comment', (comment || '') + ' ' + text)}
              disabled={disabled}
            />
          </div>
          {!comment?.trim() && (
            <p className="text-red-400 text-xs mt-1">Comment required when Fail is selected</p>
          )}
        </div>
      )}
    </div>
  )
}

export default EvaluationField

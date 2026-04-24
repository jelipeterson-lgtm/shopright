import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import EvaluationField from '../components/EvaluationField'
import VoiceInput from '../components/VoiceInput'
import PageHeader from '../components/PageHeader'

// All 22 evaluation fields: [fieldId, label, commentFieldId]
const EVAL_FIELDS = [
  ['eval_engaging', 'Were reps engaging with members?'],
  ['eval_greeting', 'Following approved greeting script?'],
  ['eval_one_no', 'Accepting 1 no & go?'],
  ['eval_pushy', 'Pushy or unprofessional?'],
  ['eval_clogging', 'Clogging aisle/blocking carts?'],
  ['eval_leaning', 'Leaning/sitting at kiosk?'],
  ['eval_food_drink', 'Kiosk free of food/drink?'],
  ['eval_dress_code', 'Proper dress code?'],
  ['eval_name_badge', 'Wearing proper name badge?'],
  ['eval_badge_location_pass', 'Badge at shoulder height or lanyard?'],
  ['eval_other_area', 'Using area other than kiosk?'],
  ['eval_other_store_areas', 'In other areas of store?'],
]

function Visit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [visit, setVisit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [reviewState, setReviewState] = useState('idle') // idle, reviewing, flags, skipped
  const [flags, setFlags] = useState([])
  const [flaggedFields, setFlaggedFields] = useState(new Set())
  const [skipReason, setSkipReason] = useState(null)
  const saveTimerRef = useRef(null)

  // Map AI flag field names to form field IDs for highlighting
  const FLAG_FIELD_MAP = {
    'Visit Recap': 'visit_recap',
    'Rep Names': 'rep_names',
    'Rep Description': 'rep_description',
    'Rep Count Reason': 'rep_count_reason',
    'Engaging Comment': 'eval_engaging',
    'Greeting Comment': 'eval_greeting',
    'One No Comment': 'eval_one_no',
    'Pushy Comment': 'eval_pushy',
    'Clogging Comment': 'eval_clogging',
    'Leaning Comment': 'eval_leaning',
    'Food/Drink Comment': 'eval_food_drink',
    'Dress Code Comment': 'eval_dress_code',
    'Name Badge Comment': 'eval_name_badge',
    'Badge Location Comment': 'eval_badge_location_pass',
    'Badge Where': 'eval_badge_where',
    'Other Area Comment': 'eval_other_area',
    'Other Store Areas Comment': 'eval_other_store_areas',
    'Soft Selling Comment': 'eval_soft_selling',
  }

  useEffect(() => {
    loadVisit()
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [id])

  const loadVisit = async () => {
    try {
      const result = await api.getVisit(id)
      const visitData = result.data
      if (!visitData.visit_time && visitData.status !== 'Complete') {
        const localTime = new Date().toTimeString().slice(0, 5)
        visitData.visit_time = localTime
        api.updateVisit(id, { visit_time: localTime }).catch(() => {})
      }
      setVisit(visitData)
    } catch (err) {
      setError('Failed to load visit')
    } finally {
      setLoading(false)
    }
  }

  const autoSave = useCallback((updates) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.updateVisit(id, updates)
      } catch (err) {
        // Silent fail on auto-save — data is in local state
      }
    }, 500)
  }, [id])

  const updateField = (field, value) => {
    setVisit((prev) => {
      const updated = { ...prev, [field]: value }
      autoSave({ [field]: value })
      return updated
    })
  }

  const handleEvalChange = (fieldId, value) => {
    const updates = { [fieldId]: value }
    // Clear comment when switching away from Fail
    if (value !== 'Fail') {
      updates[fieldId + '_comment'] = ''
    }
    setVisit((prev) => {
      const updated = { ...prev, ...updates }
      autoSave(updates)
      return updated
    })
  }

  const handleCommentChange = (commentField, value) => {
    updateField(commentField, value)
  }

  const handleComplete = async () => {
    // Validate required fields
    if (!visit.reps_present) {
      setError('Reps Present is required')
      return
    }
    if (visit.reps_present === 'Pass') {
      if (!visit.rep_count && visit.rep_count !== 0) {
        setError('Rep count is required')
        return
      }
      if (visit.rep_count > 4 && !visit.rep_count_reason?.trim()) {
        setError('Reason for unusual rep count is required when count > 4')
        return
      }
      // Check for Fail fields without comments
      for (const [fieldId] of EVAL_FIELDS) {
        if (visit[fieldId] === 'Fail' && !visit[fieldId + '_comment']?.trim()) {
          setError(`Comment required for failed field: ${fieldId.replace('eval_', '').replace(/_/g, ' ')}`)
          return
        }
      }
      // "Where was badge located?" required if "Badge at shoulder height or lanyard?" = Fail
      if (visit.eval_badge_location_pass === 'Fail' && !visit.eval_badge_where?.trim()) {
        setError('Please describe where the badge was located')
        return
      }
      // Soft selling comment if Fail
      if (visit.eval_soft_selling === 'Fail' && !visit.eval_soft_selling_comment?.trim()) {
        setError('Soft selling comment required')
        return
      }
    }

    setSaving(true)
    setError(null)
    setReviewState('reviewing')
    try {
      // Save any pending changes first
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      await api.updateVisit(id, visit)

      // Run AI review
      const reviewResult = await api.reviewVisit(id)
      const data = reviewResult.data

      if (data.skipped) {
        // No key, invalid key, or API error — skip review, mark complete
        setSkipReason(data.reason)
        setReviewState('skipped')
        await api.completeVisit(id)
        navigate('/route')
        return
      }

      if (data.flags && data.flags.length > 0) {
        // Show flags and highlight flagged fields
        setFlags(data.flags)
        const highlighted = new Set()
        for (const flag of data.flags) {
          // Direct map lookup
          const mapped = FLAG_FIELD_MAP[flag.field]
          if (mapped) highlighted.add(mapped)
          // Lowercase key match
          const lowerKey = flag.field.toLowerCase().replace(/\s+/g, '_')
          highlighted.add(lowerKey)
          // Also check if field name contains known keywords
          const fieldLower = flag.field.toLowerCase()
          if (fieldLower.includes('recap')) highlighted.add('visit_recap')
          if (fieldLower.includes('rep name') || fieldLower.includes('first name')) highlighted.add('rep_names')
          if (fieldLower.includes('rep desc')) highlighted.add('rep_description')
          if (fieldLower.includes('rep count') || fieldLower.includes('how many') || fieldLower.includes('reps present')) { highlighted.add('rep_count'); highlighted.add('rep_names') }
          if (fieldLower.includes('engaging')) highlighted.add('eval_engaging')
          if (fieldLower.includes('greeting')) highlighted.add('eval_greeting')
          if (fieldLower.includes('badge')) highlighted.add('eval_badge_location_pass')
          if (fieldLower.includes('dress')) highlighted.add('eval_dress_code')
          if (fieldLower.includes('pushy')) highlighted.add('eval_pushy')
          if (fieldLower.includes('clog')) highlighted.add('eval_clogging')
          if (fieldLower.includes('lean')) highlighted.add('eval_leaning')
          if (fieldLower.includes('food') || fieldLower.includes('drink')) highlighted.add('eval_food_drink')
          if (fieldLower.includes('soft sell')) highlighted.add('eval_soft_selling')
        }
        setFlaggedFields(highlighted)
        setReviewState('flags')
      } else {
        // No flags — mark complete
        setReviewState('idle')
        await api.completeVisit(id)
        navigate('/route')
      }
    } catch (err) {
      // Network error — submit anyway with warning
      setReviewState('skipped')
      setSkipReason('api_error')
      try {
        await api.completeVisit(id)
        navigate('/route')
      } catch (e) {
        setError(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitAnyway = async () => {
    setSaving(true)
    try {
      await api.completeVisit(id)
      navigate('/route')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }


  const handleUnlock = async () => {
    setSaving(true)
    try {
      await api.unlockVisit(id)
      await loadVisit()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading visit...</p>
      </div>
    )
  }

  if (!visit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">Visit not found</p>
      </div>
    )
  }

  const isComplete = visit.status === 'Complete'
  const repsPresent = visit.reps_present
  const showFullForm = repsPresent === 'Pass'
  const isWaterProgram = visit.program?.includes('WATER') || visit.program?.includes('RSW')
  const isCostco = visit.retailer_name?.toLowerCase().includes('costco')

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Assessment" rightButton={<button onClick={() => navigate('/route')} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 active:bg-gray-200 shadow-sm">Back</button>} />
      <div className="max-w-lg mx-auto px-4 py-4 pb-64">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Store + Vendor header */}
        <div className="bg-gray-100 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-900">{visit.retailer_name} #{visit.store_number}</p>
              {visit.address && <p className="text-xs text-gray-500">{visit.address}</p>}
              <p className="text-xs text-gray-500">{visit.city}, {visit.state}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              isComplete ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
            }`}>
              {isComplete ? 'Completed' : 'Open'}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">Vendor Program</p>
            <p className="text-sm font-medium text-gray-900">{visit.program || '—'}</p>
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-0.5">Date</p>
              <input type="date" value={visit.visit_date || ''} disabled={isComplete}
                onChange={(e) => { updateField('visit_date', e.target.value); updateField('session_date', e.target.value) }}
                className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-0.5">Time</p>
              <input type="time" value={visit.visit_time ? visit.visit_time.slice(0, 5) : ''} disabled={isComplete}
                onChange={(e) => updateField('visit_time', e.target.value)}
                className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100" />
            </div>
          </div>
        </div>

        {/* Zone 1 — Reps Present Gate */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Reps Present?</h2>
          <div className="flex gap-2 mb-3">
            {['Pass', 'Fail', 'N/A'].map((opt) => (
              <button
                key={opt}
                onClick={() => !isComplete && updateField('reps_present', opt)}
                disabled={isComplete}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                  repsPresent === opt
                    ? opt === 'Pass'
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : opt === 'Fail'
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100'
                } ${isComplete ? 'opacity-50' : ''}`}
              >
                {opt}
              </button>
            ))}
          </div>

          {repsPresent === 'Fail' && (
            <p className="text-sm text-red-500 italic">Reps not present — skip to Visit Recap below.</p>
          )}

          {repsPresent === 'N/A' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
              <p className="text-sm text-blue-700 font-medium">Not Applicable</p>
              <p className="text-xs text-blue-600 mt-1">All evaluation fields have been set to N/A. Only the Visit Recap below needs to be completed.</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Rep Info: N/A</span>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded">All Evaluations: N/A</span>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Soft Selling: N/A</span>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Resource Guide: N/A</span>
              </div>
            </div>
          )}

          {showFullForm && (
            <div className="space-y-3 mt-3">
              <div className={flaggedFields.has('rep_names') ? 'bg-yellow-50 -mx-4 px-4 py-2 border-l-4 border-l-yellow-400 rounded-r-md' : ''}>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rep(s) First Names <span className="text-gray-400">(optional)</span> {flaggedFields.has('rep_names') && <span className="text-yellow-600">— flagged by AI</span>}</label>
                <input
                  type="text"
                  value={visit.rep_names || ''}
                  onChange={(e) => updateField('rep_names', e.target.value)}
                  disabled={isComplete}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description of Reps <span className="text-gray-400">(optional)</span></label>
                <div className="flex items-start gap-2">
                  <textarea
                    value={visit.rep_description || ''}
                    onChange={(e) => updateField('rep_description', e.target.value)}
                    disabled={isComplete}
                    rows={2}
                    className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
                  />
                  <VoiceInput
                    onTranscript={(text) => updateField('rep_description', (visit.rep_description || '') + ' ' + text)}
                    disabled={isComplete}
                  />
                </div>
              </div>
              <div className={flaggedFields.has('rep_count') ? 'bg-yellow-50 -mx-4 px-4 py-2 border-l-4 border-l-yellow-400 rounded-r-md' : ''}>
                <label className="block text-xs font-medium text-gray-600 mb-1">How many reps present? <span className="text-red-400">*</span> {flaggedFields.has('rep_count') && <span className="text-yellow-600">— flagged by AI</span>}</label>
                <input
                  type="number"
                  min="0"
                  value={visit.rep_count ?? ''}
                  onChange={(e) => updateField('rep_count', e.target.value ? parseInt(e.target.value) : null)}
                  disabled={isComplete}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
                />
              </div>
              {visit.rep_count > 4 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reason for unusual rep count <span className="text-red-400">*</span></label>
                  <div className="flex items-start gap-2">
                    <textarea
                      value={visit.rep_count_reason || ''}
                      onChange={(e) => updateField('rep_count_reason', e.target.value)}
                      disabled={isComplete}
                      rows={2}
                      className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
                    />
                    <VoiceInput
                      onTranscript={(text) => updateField('rep_count_reason', (visit.rep_count_reason || '') + ' ' + text)}
                      disabled={isComplete}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zone 2 — Evaluation Fields (only if Reps Present = Pass) */}
        {showFullForm && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Evaluation</h2>
            <p className="text-xs text-gray-400 mb-3">All fields default to Pass. Only tap Fail or N/A for exceptions.</p>

            {EVAL_FIELDS.map(([fieldId, label]) => (
              <div key={fieldId}>
                <EvaluationField
                  label={label}
                  fieldId={fieldId}
                  value={visit[fieldId]}
                  comment={visit[fieldId + '_comment']}
                  onValueChange={handleEvalChange}
                  onCommentChange={handleCommentChange}
                  highlighted={flaggedFields.has(fieldId)}
                  disabled={isComplete}
                />
                {/* Badge location — right after badge_location_pass */}
                {fieldId === 'eval_badge_location_pass' && (
                  <div className={`py-3 border-b border-gray-100 ${flaggedFields.has('eval_badge_where') ? 'bg-yellow-50 -mx-4 px-4 border-l-4 border-l-yellow-400 rounded-r-md' : ''}`}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Where was badge located? {visit.eval_badge_location_pass === 'Fail' && <span className="text-red-400">*</span>}
                    </label>
                    <div className="flex items-start gap-2">
                      <textarea
                        value={visit.eval_badge_where || ''}
                        onChange={(e) => updateField('eval_badge_where', e.target.value)}
                        disabled={isComplete}
                        rows={1}
                        placeholder={visit.eval_badge_location_pass === 'Fail' ? 'Required — where was it?' : 'Optional note'}
                        className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
                      />
                      <VoiceInput
                        onTranscript={(text) => updateField('eval_badge_where', (visit.eval_badge_where || '') + ' ' + text)}
                        disabled={isComplete}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Soft Selling — editable for Water, locked N/A for others */}
            <div className="py-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-gray-800">Soft Selling {!isWaterProgram && <span className="text-xs text-gray-400 ml-1">(Water only)</span>}</p>
                <div className="flex gap-1">
                  {['Pass', 'Fail', 'N/A'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => !isComplete && isWaterProgram && handleEvalChange('eval_soft_selling', opt)}
                      disabled={isComplete || !isWaterProgram}
                      className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                        (visit.eval_soft_selling || 'N/A') === opt
                          ? opt === 'Pass'
                            ? 'bg-green-100 text-green-700'
                            : opt === 'Fail'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resource Guide — editable for Costco, N/A default for others */}
            <div className="py-3">
              <div className="flex items-center justify-between mb-1">
                <p className={`text-sm ${isCostco ? 'text-gray-800' : 'text-gray-400'}`}>
                  {isCostco ? 'Costco Resource Guide Present' : 'Resource Guide (Costco only)'}
                </p>
                <div className="flex gap-1">
                  {['Yes', 'No', 'N/A'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => !isComplete && isCostco && updateField('eval_resource_guide', opt)}
                      disabled={isComplete || !isCostco}
                      className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                        (visit.eval_resource_guide || 'N/A') === opt
                          ? opt === 'Yes'
                            ? 'bg-green-100 text-green-700'
                            : opt === 'No'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      } ${isComplete || !isCostco ? 'opacity-50' : ''}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Zone 3 — Visit Recap (always shown) */}
        <div className={`bg-white rounded-lg shadow p-4 mb-4 ${flaggedFields.has('visit_recap') ? 'ring-2 ring-yellow-400' : ''}`}>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Visit Recap {flaggedFields.has('visit_recap') && <span className="text-yellow-600 text-xs font-normal ml-1">— flagged by AI</span>}</h2>
          <div className="flex items-start gap-2">
            <textarea
              value={visit.visit_recap || ''}
              onChange={(e) => updateField('visit_recap', e.target.value)}
              disabled={isComplete}
              rows={5}
              placeholder="Describe the overall visit..."
              className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
            />
            <VoiceInput
              onTranscript={(text) => updateField('visit_recap', (visit.visit_recap || '') + ' ' + text)}
              disabled={isComplete}
            />
          </div>
        </div>

        {/* AI Review Flags */}
        {reviewState === 'flags' && flags.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-semibold text-yellow-800 mb-2">AI Review — {flags.length} question{flags.length !== 1 ? 's' : ''}</h2>
            <p className="text-xs text-yellow-600 mb-3">
              Flagged fields are highlighted above. Scroll up to edit, then tap "Re-Review with AI" for a fresh review.
            </p>
            <div className="space-y-2">
              {flags.map((flag, i) => (
                <div key={i} className="bg-white rounded-md p-3 border border-yellow-200">
                  <p className="text-xs font-medium text-yellow-700">{flag.field}</p>
                  <p className="text-sm text-gray-700 mt-1">{flag.question}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skipped review banner */}
        {reviewState === 'skipped' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-yellow-700 text-sm">
              {skipReason === 'no_key' && 'AI review skipped — no API key configured.'}
              {skipReason === 'invalid_key' && 'AI review skipped — API key is invalid.'}
              {skipReason === 'api_error' && 'AI review was skipped — no connection. Review your notes before sending your weekly report.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-lg mx-auto">
            {reviewState === 'reviewing' ? (
              <div className="text-center py-2">
                <p className="text-gray-500 text-sm">AI is reviewing your notes...</p>
              </div>
            ) : reviewState === 'flags' ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setFlags([]); setFlaggedFields(new Set()); setReviewState('idle'); setTimeout(handleComplete, 100) }}
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Reviewing...' : 'Review with AI Again'}
                  </button>
                  <button
                    onClick={handleSubmitAnyway}
                    disabled={saving}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Submitting...' : 'Submit Anyway'}
                  </button>
                </div>
                <button
                  onClick={async () => {
                    if (confirm('This will discard this vendor visit. Are you sure?')) {
                      try { await api.discardVisit(id) } catch (e) {}
                      navigate('/route')
                    }
                  }}
                  disabled={saving}
                  className="w-full bg-red-50 text-red-600 py-2.5 rounded-lg text-sm font-medium border border-red-200 hover:bg-red-100 disabled:opacity-50"
                >
                  Cancel Vendor Review
                </button>
              </div>
            ) : !isComplete ? (
              <div className="space-y-2">
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="w-full bg-green-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Review & Submit'}
                </button>
                <button
                  onClick={() => navigate('/route')}
                  className="w-full bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-300"
                >
                  Save Draft & Go Back
                </button>
                <button
                  onClick={async () => {
                    if (confirm('Delete this vendor entry? This cannot be undone.')) {
                      try { await api.discardVisit(id) } catch (e) {}
                      navigate('/route')
                    }
                  }}
                  className="w-full text-red-500 py-2 text-sm font-medium hover:text-red-700"
                >
                  Delete Vendor Entry
                </button>
              </div>
            ) : (
              <button
                onClick={handleUnlock}
                disabled={saving}
                className="w-full bg-yellow-50 text-yellow-700 py-3 rounded-lg text-sm font-medium border border-yellow-200 hover:bg-yellow-100 disabled:opacity-50"
              >
                {saving ? 'Unlocking...' : 'Unlock for Editing'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Visit

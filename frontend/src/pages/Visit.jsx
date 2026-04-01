import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

function Visit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [visit, setVisit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadVisit()
  }, [id])

  const loadVisit = async () => {
    try {
      const result = await api.getVisit(id)
      setVisit(result.data)
    } catch (err) {
      setError('Failed to load visit')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.completeVisit(id)
      navigate('/session')
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Visit</h1>
          <button onClick={() => navigate('/session')} className="text-blue-600 text-sm hover:underline">Back</button>
        </div>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-md">{error}</p>}

        {/* Visit header */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-gray-900">{visit.retailer_name} #{visit.store_number}</p>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              isComplete ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {visit.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">{visit.program}</p>
          <p className="text-sm text-gray-500">{visit.city}, {visit.state}</p>
          <p className="text-xs text-gray-400 mt-1">{visit.visit_date} at {visit.visit_time}</p>
        </div>

        {/* Placeholder for assessment form (Phase 4) */}
        <div className="bg-white rounded-lg shadow p-6 mb-4 text-center">
          <p className="text-gray-400 text-sm">Assessment form coming in Phase 4</p>
          <p className="text-gray-300 text-xs mt-1">
            For now, you can mark this visit as Complete or go back to the session.
          </p>
        </div>

        {/* Actions */}
        {!isComplete ? (
          <button
            onClick={handleComplete}
            disabled={saving}
            className="w-full bg-green-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Mark Complete'}
          </button>
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
  )
}

export default Visit

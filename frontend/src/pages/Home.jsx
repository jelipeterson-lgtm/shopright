import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'
import api from '../services/api'

function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const [todayVisits, setTodayVisits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getVisits({ session_date: today })
      .then((result) => setTodayVisits(result.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [today])

  const hasDrafts = todayVisits.some((v) => v.status === 'Draft')
  const hasVisits = todayVisits.length > 0

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">ShopRight</h1>
          <button onClick={() => navigate('/settings')} className="text-blue-600 text-sm hover:underline">Settings</button>
        </div>

        {/* Active session card */}
        {hasVisits && (
          <button
            onClick={() => navigate('/session')}
            className="w-full bg-white rounded-lg shadow p-4 mb-4 text-left hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Today's Session</p>
                <p className="text-sm text-gray-500">
                  {todayVisits.length} visit{todayVisits.length !== 1 ? 's' : ''}
                  {hasDrafts && <span className="text-yellow-600"> — drafts in progress</span>}
                </p>
              </div>
              <span className="text-blue-600 text-sm font-medium">View</span>
            </div>
          </button>
        )}

        {/* Main actions */}
        <div className="space-y-2 mb-6">
          <button
            onClick={() => navigate('/session')}
            className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {hasVisits ? 'Continue Session' : 'Start Session'}
          </button>
          <button
            onClick={() => navigate('/manual-visit')}
            className="w-full bg-white text-gray-700 py-3 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
          >
            Add Visit Manually
          </button>
        </div>

        {/* Reports */}
        <div className="space-y-2 mb-6">
          <h2 className="text-sm font-semibold text-gray-700">Reports</h2>
          <button
            onClick={() => navigate('/weekly-report')}
            className="w-full bg-white text-gray-700 py-3 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
          >
            Weekly Shop File
          </button>
          <button
            onClick={() => navigate('/monthly-invoice')}
            className="w-full bg-white text-gray-700 py-3 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
          >
            Monthly Invoice
          </button>
        </div>

        {/* Empty state */}
        {!loading && !hasVisits && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-400 text-sm">No visits today</p>
            <p className="text-gray-300 text-xs mt-1">Start a session or add a visit manually</p>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-400 text-sm">Loading...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home

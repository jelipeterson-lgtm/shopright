import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function Session() {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadVisits = useCallback(async () => {
    try {
      const result = await api.getVisits({ session_date: today })
      setVisits(result.data)
    } catch (err) {
      setError('Failed to load visits')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { loadVisits() }, [loadVisits])

  // Group visits by store
  const stores = {}
  for (const visit of visits) {
    const key = `${visit.retailer_name}|${visit.store_number}`
    if (!stores[key]) {
      stores[key] = {
        retailer_name: visit.retailer_name,
        store_number: visit.store_number,
        address: visit.address,
        city: visit.city,
        state: visit.state,
        stop_open: visit.stop_open,
        visits: [],
      }
    }
    stores[key].visits.push(visit)
    if (visit.stop_open) stores[key].stop_open = true
  }
  const storeList = Object.values(stores)

  const handleNewStore = async () => {
    // Gate: check for open stops
    setError(null)
    setActionLoading(true)
    try {
      const result = await api.checkOpenStops(today)
      if (result.data.length > 0) {
        const stop = result.data[0]
        setError(`Close out ${stop.retailer_name} #${stop.store_number} before starting a new stop.`)
        return
      }
      navigate('/new-store', { state: { sessionDate: today } })
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCloseStop = async (store) => {
    setError(null)
    setActionLoading(true)
    try {
      const result = await api.closeStop(store.store_number, store.retailer_name, today)
      if (!result.success) {
        setError(result.error)
      } else {
        await loadVisits()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleEndSession = async () => {
    setError(null)
    setActionLoading(true)
    try {
      const result = await api.checkOpenStops(today)
      if (result.data.length > 0) {
        const stop = result.data[0]
        setError(`Close out ${stop.retailer_name} #${stop.store_number} before ending session.`)
        return
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddVendor = (store) => {
    // Get the store_id from the first visit at this store
    const storeId = store.visits[0]?.store_id
    navigate('/new-store', {
      state: {
        sessionDate: today,
        preselectedStore: {
          id: storeId,
          retailer_name: store.retailer_name,
          store_number: store.store_number,
          address: store.address,
          city: store.city,
          state: store.state,
        },
      },
    })
  }

  const handleDiscardVisit = async (visitId) => {
    if (!confirm('Delete this visit? This cannot be undone.')) return
    setActionLoading(true)
    try {
      await api.discardVisit(visitId)
      await loadVisits()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Today's Session</h1>
          <button onClick={() => navigate('/')} className="text-blue-600 text-sm hover:underline">Home</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {storeList.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center mb-4">
            <p className="text-gray-400 text-sm">No stores visited today</p>
            <p className="text-gray-300 text-xs mt-1">Tap "New Store" to start</p>
          </div>
        )}

        {/* Store groups */}
        {storeList.map((store) => (
          <div key={`${store.retailer_name}|${store.store_number}`} className="bg-white rounded-lg shadow mb-4 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{store.retailer_name} #{store.store_number}</p>
                  <p className="text-xs text-gray-500">{store.city}, {store.state}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  store.stop_open
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {store.stop_open ? 'Open' : 'Closed'}
                </span>
              </div>
            </div>

            {/* Visit list */}
            <div className="divide-y divide-gray-50">
              {store.visits.map((visit) => (
                <div key={visit.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-800">{visit.program}</p>
                    <p className="text-xs text-gray-400">{visit.visit_time}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      visit.status === 'Draft'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {visit.status}
                    </span>
                    {visit.status === 'Draft' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => navigate(`/visit/${visit.id}`)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDiscardVisit(visit.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Discard
                        </button>
                      </div>
                    )}
                    {visit.status === 'Complete' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => navigate(`/visit/${visit.id}`)}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDiscardVisit(visit.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Store actions */}
            {store.stop_open && (
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => handleAddVendor(store)}
                  className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-md text-xs font-medium hover:bg-blue-100"
                >
                  Add Another Vendor
                </button>
                <button
                  onClick={() => handleCloseStop(store)}
                  disabled={actionLoading}
                  className="flex-1 bg-gray-50 text-gray-700 py-2 rounded-md text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
                >
                  Close Store
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Session actions */}
        <div className="space-y-2 mt-4">
          <button
            onClick={handleNewStore}
            disabled={actionLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            New Store
          </button>
          <button
            onClick={() => navigate('/manual-visit')}
            className="w-full bg-white text-gray-700 py-3 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
          >
            Add Visit Manually
          </button>
          {visits.length > 0 && (
            <button
              onClick={handleEndSession}
              disabled={actionLoading}
              className="w-full bg-gray-800 text-white py-3 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
            >
              End Session
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Session

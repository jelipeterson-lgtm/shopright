import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import PageHeader from '../components/PageHeader'

function formatShortDate(d) {
  if (!d) return ''
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0].slice(2)}`
  return d
}

function formatTime(t) {
  if (!t) return ''
  const parts = t.replace(/:00$/, '').split(':')
  if (parts.length < 2) return t
  let hour = parseInt(parts[0])
  const min = parts[1]
  const period = hour < 12 ? 'AM' : 'PM'
  if (hour === 0) hour = 12
  else if (hour > 12) hour -= 12
  return `${hour}:${min} ${period}`
}

function formatLongDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function Session() {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const todayLong = formatLongDate(today)
  const [visits, setVisits] = useState([])
  const [emptyStores, setEmptyStores] = useState([])
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
  // Include empty stores (where all vendors were discarded)
  for (const es of emptyStores) {
    const key = `${es.retailer_name}|${es.store_number}`
    if (!stores[key]) {
      stores[key] = { ...es, visits: [] }
    }
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


  const handleAddVendor = (store) => {
    const storeId = store.visits?.[0]?.store_id || store.store_id
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
    if (!confirm('Delete this vendor entry? This cannot be undone.')) return
    // Find the visit to check if it's the last at this store
    const visit = visits.find((v) => v.id === visitId)
    const storeKey = visit ? `${visit.retailer_name}|${visit.store_number}` : null
    const siblingsAtStore = visit ? visits.filter(
      (v) => v.retailer_name === visit.retailer_name && v.store_number === visit.store_number && v.id !== visitId
    ) : []

    setActionLoading(true)
    try {
      await api.discardVisit(visitId)
      // If this was the last vendor at the store, keep the store visible
      if (visit && siblingsAtStore.length === 0) {
        setEmptyStores((prev) => {
          const exists = prev.some((s) => s.retailer_name === visit.retailer_name && s.store_number === visit.store_number)
          if (exists) return prev
          return [...prev, {
            retailer_name: visit.retailer_name,
            store_number: visit.store_number,
            address: visit.address,
            city: visit.city,
            state: visit.state,
            store_id: visit.store_id,
            stop_open: true,
          }]
        })
      }
      await loadVisits()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteStore = (store) => {
    if (!confirm(`Delete ${store.retailer_name} #${store.store_number} from today? This cannot be undone.`)) return
    setEmptyStores((prev) => prev.filter(
      (s) => !(s.retailer_name === store.retailer_name && s.store_number === store.store_number)
    ))
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
          <PageHeader title="Assessments" subtitle={todayLong} size="small" />
          <button onClick={() => navigate('/app')} className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 rounded-md border border-gray-200 hover:bg-gray-100 active:bg-gray-200">Home</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {storeList.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center mb-4">
            <p className="text-gray-400 text-sm">No stores added yet</p>
            <p className="text-gray-300 text-xs mt-1">Tap "Add Store" to begin</p>
          </div>
        )}

        {/* Store groups */}
        {storeList.map((store) => (
          <div key={`${store.retailer_name}|${store.store_number}`} className="bg-white rounded-lg shadow mb-4 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{store.retailer_name} #{store.store_number}</p>
                  {store.address && <p className="text-xs text-gray-400">{store.address}</p>}
                  <p className="text-xs text-gray-400">{store.city}, {store.state}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  store.stop_open
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {store.stop_open ? 'Open' : 'Completed'}
                </span>
              </div>
            </div>

            {/* Vendors at this store */}
            <div className="divide-y divide-gray-50">
              {store.visits.map((visit) => (
                <div key={visit.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{visit.program}</p>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        visit.status === 'Draft'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {visit.status === 'Draft' ? 'Open' : 'Completed'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Assessment Date: {formatShortDate(visit.visit_date)} — Start Time: {formatTime(visit.visit_time)}</p>
                  </div>
                  <div className="flex gap-1">
                    {visit.status === 'Draft' && (
                      <>
                        <button
                          onClick={() => navigate(`/visit/${visit.id}`)}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md border border-blue-200 hover:bg-blue-100 active:bg-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDiscardVisit(visit.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-md border border-red-200 hover:bg-red-100 active:bg-red-200"
                        >
                          Discard
                        </button>
                      </>
                    )}
                    {visit.status === 'Complete' && (
                      <>
                        <button
                          onClick={() => navigate(`/visit/${visit.id}`)}
                          className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 rounded-md border border-gray-200 hover:bg-gray-100 active:bg-gray-200"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDiscardVisit(visit.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-md border border-red-200 hover:bg-red-100 active:bg-red-200"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Empty store message */}
            {store.visits.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-400">No vendors at this store</p>
              </div>
            )}

            {/* Store actions */}
            {store.stop_open && (
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => handleAddVendor(store)}
                  className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-md text-xs font-medium hover:bg-blue-100"
                >
                  {store.visits.length === 0 ? 'Add Vendor' : 'Add Another Vendor'}
                </button>
                {store.visits.length === 0 ? (
                  <button
                    onClick={() => handleDeleteStore(store)}
                    className="flex-1 bg-red-50 text-red-600 py-2 rounded-md text-xs font-medium hover:bg-red-100"
                  >
                    Delete Store
                  </button>
                ) : (
                <button
                  onClick={() => handleCloseStop(store)}
                  disabled={actionLoading}
                  className="flex-1 bg-gray-50 text-gray-700 py-2 rounded-md text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
                >
                  Close Store
                </button>
                )}
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
            Add Store
          </button>
          <button
            onClick={() => navigate('/manual-visit')}
            className="w-full bg-white text-gray-700 py-3 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
          >
            Add Store & Vendor Manually
          </button>
        </div>
      </div>
    </div>
  )
}

export default Session

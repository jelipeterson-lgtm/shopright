import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import PageHeader from '../components/PageHeader'

function RoutePlanner() {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]

  const [startAddress, setStartAddress] = useState('')
  const [endAddress, setEndAddress] = useState('')
  const [emailText, setEmailText] = useState('')
  const [checkinText, setCheckinText] = useState('')
  const [parsedStores, setParsedStores] = useState([])
  const [route, setRoute] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState(null)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [showCheckinInput, setShowCheckinInput] = useState(false)
  const [hasGoogleKey, setHasGoogleKey] = useState(false)

  useEffect(() => {
    // Load profile defaults and existing plan
    Promise.all([
      api.getProfile(),
      api.getRoutePlan(today),
    ]).then(([profileResult, planResult]) => {
      const p = profileResult.data
      setStartAddress(p.default_start_address || p.home_address || '')
      setEndAddress(p.default_end_address || p.default_start_address || p.home_address || '')
      setHasGoogleKey(!!p.google_maps_api_key)

      if (planResult.data) {
        const plan = planResult.data
        if (plan.start_address) setStartAddress(plan.start_address)
        if (plan.end_address) setEndAddress(plan.end_address)
        if (plan.stores_data) {
          setRoute(plan.stores_data)
          // Recalculate summary from saved route
          const totalEarnings = plan.stores_data.reduce((sum, s) => sum + (s.earnings || 0), 0)
          const totalTime = plan.stores_data.reduce((sum, s) => sum + (s.drive_time_min || 0) + (s.est_minutes || 0), 0)
          setSummary({
            total_stops: plan.stores_data.length,
            total_earnings: totalEarnings,
            total_time_min: totalTime,
            projected_rate_per_hour: totalTime > 0 ? (totalEarnings / (totalTime / 60)) : 0,
          })
        }
      }
    }).catch(() => {})
  }, [today])

  const handleParseEmail = async () => {
    if (!emailText.trim()) return
    setParsing(true)
    setError(null)
    try {
      const result = await api.parseEmail(emailText)
      const newStores = result.data || []
      // Merge with existing parsed stores
      const merged = [...parsedStores]
      for (const store of newStores) {
        const exists = merged.some(s =>
          s.retailer_name === store.retailer_name &&
          s.store_number === store.store_number &&
          s.program === store.program
        )
        if (!exists) merged.push(store)
      }
      setParsedStores(merged)
      setShowEmailInput(false)
      setEmailText('')

      if (hasGoogleKey && startAddress) {
        await optimizeWithStores(merged)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }

  const handleParseCheckin = async () => {
    if (!checkinText.trim()) return
    setParsing(true)
    setError(null)
    try {
      const result = await api.parseCheckin(checkinText)
      const newStores = result.data || []
      const merged = [...parsedStores]
      for (const store of newStores) {
        const exists = merged.some(s =>
          s.retailer_name === store.retailer_name &&
          s.store_number === store.store_number &&
          s.program === store.program
        )
        if (!exists) {
          store.confirmed = true
          merged.push(store)
        } else {
          // Mark existing as confirmed
          const idx = merged.findIndex(s =>
            s.retailer_name === store.retailer_name &&
            s.store_number === store.store_number &&
            s.program === store.program
          )
          if (idx >= 0) merged[idx].confirmed = true
        }
      }
      setParsedStores(merged)
      setShowCheckinInput(false)
      setCheckinText('')

      if (hasGoogleKey && startAddress) {
        await optimizeWithStores(merged)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }

  const optimizeWithStores = async (stores) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.optimizeRoute(stores, startAddress, endAddress || startAddress)
      if (result.success) {
        setRoute(result.data.route)
        setSummary(result.data.summary)

        // Save plan
        await api.saveRoutePlan({
          plan_date: today,
          start_address: startAddress,
          end_address: endAddress || startAddress,
          stores_data: result.data.route,
        })
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteStop = async (store) => {
    try {
      await api.completeRouteStop(today, store.store_number, store.retailer_name)
      setRoute(prev => prev.map(s =>
        s.retailer_name === store.retailer_name && s.store_number === store.store_number
          ? { ...s, status: 'completed' }
          : s
      ))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRemoveStop = (store) => {
    setRoute(prev => prev.filter(s =>
      !(s.retailer_name === store.retailer_name && s.store_number === store.store_number)
    ))
    setParsedStores(prev => prev.filter(s =>
      !(s.retailer_name === store.retailer_name && s.store_number === store.store_number)
    ))
  }

  const moveStop = (index, direction) => {
    const newRoute = [...route]
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= newRoute.length) return
    const temp = newRoute[index]
    newRoute[index] = newRoute[newIndex]
    newRoute[newIndex] = temp
    setRoute(newRoute)
  }

  const completedStops = route.filter(s => s.status === 'completed')
  const upcomingStops = route.filter(s => s.status !== 'completed')

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Route Planner" subtitle={new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} />

      <div className="max-w-lg mx-auto px-4 py-4">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}

        {!hasGoogleKey && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm font-medium">Google Maps API key required</p>
            <p className="text-yellow-700 text-xs mt-1">Go to Settings to add your Google Maps API key for route optimization.</p>
            <button onClick={() => navigate('/settings')} className="mt-2 text-xs text-blue-600 font-medium hover:underline">Go to Settings</button>
          </div>
        )}

        {/* Start/End addresses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Location</label>
            <input type="text" value={startAddress} onChange={(e) => setStartAddress(e.target.value)}
              placeholder="Home address or starting point"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Location</label>
            <input type="text" value={endAddress} onChange={(e) => setEndAddress(e.target.value)}
              placeholder="Same as start (default)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        {/* Input buttons */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setShowEmailInput(!showEmailInput)}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-medium hover:bg-blue-700">
            {showEmailInput ? 'Cancel' : 'Paste Event Email'}
          </button>
          <button onClick={() => setShowCheckinInput(!showCheckinInput)}
            className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-xs font-medium hover:bg-green-700">
            {showCheckinInput ? 'Cancel' : 'Paste Check-in'}
          </button>
        </div>

        {/* Email paste */}
        {showEmailInput && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <p className="text-xs text-gray-500 mb-2">Paste the event email from Smart Circle:</p>
            <textarea value={emailText} onChange={(e) => setEmailText(e.target.value)}
              rows={6} placeholder="Paste email content here..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
            <button onClick={handleParseEmail} disabled={parsing || !emailText.trim()}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {parsing ? 'Parsing...' : 'Parse & Build Route'}
            </button>
          </div>
        )}

        {/* Check-in paste */}
        {showCheckinInput && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <p className="text-xs text-gray-500 mb-2">Paste the check-in text message:</p>
            <textarea value={checkinText} onChange={(e) => setCheckinText(e.target.value)}
              rows={6} placeholder="Paste check-in text here..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
            <button onClick={handleParseCheckin} disabled={parsing || !checkinText.trim()}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {parsing ? 'Parsing...' : 'Add Check-ins & Re-optimize'}
            </button>
          </div>
        )}

        {/* Summary bar */}
        {summary && (
          <div className="bg-blue-600 text-white rounded-xl p-4 mb-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xl font-bold">{summary.total_stops}</p>
                <p className="text-[10px] text-blue-200">Stops</p>
              </div>
              <div>
                <p className="text-xl font-bold">${summary.total_earnings}</p>
                <p className="text-[10px] text-blue-200">Earnings</p>
              </div>
              <div>
                <p className="text-xl font-bold">{Math.round(summary.total_time_min)}m</p>
                <p className="text-[10px] text-blue-200">Total Time</p>
              </div>
              <div>
                <p className="text-xl font-bold">${Math.round(summary.projected_rate_per_hour)}</p>
                <p className="text-[10px] text-blue-200">$/Hour</p>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">Optimizing route...</p>
          </div>
        )}

        {/* Completed stops */}
        {completedStops.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Completed</p>
            {completedStops.map((store, i) => (
              <div key={i} className="bg-gray-100 rounded-xl p-3 mb-2 opacity-60">
                <p className="text-sm font-medium text-gray-700">{store.retailer_name} #{store.store_number}</p>
                <p className="text-xs text-gray-400">{store.vendors?.join(', ')}</p>
                <p className="text-xs text-green-600 font-medium">${store.earnings} earned</p>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming stops */}
        {upcomingStops.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">
              {completedStops.length > 0 ? 'Upcoming' : 'Route'}
            </p>
            {upcomingStops.map((store, i) => {
              const globalIndex = route.indexOf(store)
              return (
                <div key={i} className={`bg-white rounded-xl shadow-sm border p-4 mb-2 ${i === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center">
                          {completedStops.length + i + 1}
                        </span>
                        <p className="text-sm font-semibold text-gray-900">{store.retailer_name} #{store.store_number}</p>
                      </div>
                      {store.address && <p className="text-xs text-gray-400 mt-1 ml-8">{store.address}, {store.city}</p>}
                      <p className="text-xs text-gray-500 mt-1 ml-8">{store.vendors?.join(', ')}</p>
                      <div className="flex gap-3 mt-2 ml-8">
                        {store.drive_time_min > 0 && (
                          <span className="text-xs text-gray-400">{Math.round(store.drive_time_min)} min drive</span>
                        )}
                        {store.drive_distance_mi > 0 && (
                          <span className="text-xs text-gray-400">{store.drive_distance_mi} mi</span>
                        )}
                        <span className="text-xs text-green-600 font-medium">${store.earnings}</span>
                        <span className="text-xs text-gray-400">~{Math.round(store.est_minutes)} min</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-1">
                        <button onClick={() => moveStop(globalIndex, -1)} disabled={globalIndex === 0}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded text-gray-500 text-xs disabled:opacity-30">↑</button>
                        <button onClick={() => moveStop(globalIndex, 1)} disabled={globalIndex === route.length - 1}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded text-gray-500 text-xs disabled:opacity-30">↓</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleCompleteStop(store)}
                      className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-green-700">
                      Complete
                    </button>
                    <button onClick={() => handleRemoveStop(store)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-200 hover:bg-red-100">
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {route.length === 0 && !loading && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <p className="text-gray-400 text-sm">No route planned yet</p>
            <p className="text-gray-300 text-xs mt-1">Paste an event email to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RoutePlanner

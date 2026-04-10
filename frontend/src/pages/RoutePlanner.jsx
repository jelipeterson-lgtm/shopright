import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getLocalDate } from '../services/api'
import PageHeader from '../components/PageHeader'
import RouteMap from '../components/RouteMap'

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function RoutePlanner() {
  const navigate = useNavigate()
  const today = getLocalDate()

  const [startAddress, setStartAddress] = useState('')
  const [endAddress, setEndAddress] = useState('')
  const [emailText, setEmailText] = useState('')
  const [checkinText, setCheckinText] = useState('')
  const [parsedStores, setParsedStores] = useState([])
  const [route, setRoute] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('18:00')
  const [parsing, setParsing] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [error, setError] = useState(null)
  const [parseSuccess, setParseSuccess] = useState(null)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [showCheckinInput, setShowCheckinInput] = useState(false)
  const [hasGoogleKey, setHasGoogleKey] = useState(false)
  const [profileCity, setProfileCity] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [maxDistance, setMaxDistance] = useState('')
  const [selectedCities, setSelectedCities] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [startCoords, setStartCoords] = useState(null)
  const [todayVisits, setTodayVisits] = useState([])
  const [showAddStore, setShowAddStore] = useState(false)
  const [storeSearchQuery, setStoreSearchQuery] = useState('')
  const [storeSearchResults, setStoreSearchResults] = useState([])
  const [addingVendorStore, setAddingVendorStore] = useState(null)
  const [programs, setPrograms] = useState([])
  const [selectedProgram, setSelectedProgram] = useState(null)

  // localStorage keys for persistence
  const LS_ROUTE = `shopright_route_${today}`
  const LS_SUMMARY = `shopright_summary_${today}`
  const LS_PARSED = `shopright_parsed_${today}`
  const LS_ACCEPTED = `shopright_accepted_${today}`

  // Save route to localStorage whenever it changes
  const saveToLocal = (routeData, summaryData, parsedData, acceptedState) => {
    try {
      localStorage.setItem(LS_ROUTE, JSON.stringify(routeData))
      if (summaryData) localStorage.setItem(LS_SUMMARY, JSON.stringify(summaryData))
      if (parsedData) localStorage.setItem(LS_PARSED, JSON.stringify(parsedData))
      localStorage.setItem(LS_ACCEPTED, JSON.stringify(acceptedState))
    } catch (e) {}
  }

  useEffect(() => {
    // Load from localStorage instantly (no loading state)
    try {
      const cachedRoute = JSON.parse(localStorage.getItem(LS_ROUTE) || '[]')
      const cachedSummary = JSON.parse(localStorage.getItem(LS_SUMMARY) || 'null')
      const cachedParsed = JSON.parse(localStorage.getItem(LS_PARSED) || '[]')
      const cachedAccepted = JSON.parse(localStorage.getItem(LS_ACCEPTED) || 'false')
      if (cachedRoute.length > 0) {
        setRoute(cachedRoute)
        if (cachedSummary) setSummary(cachedSummary)
        if (cachedParsed.length > 0) setParsedStores(cachedParsed)
        setAccepted(cachedAccepted)
        setLoading(false)
      }
    } catch (e) {}

    // Then sync with API in background
    setLoading(prev => prev)
    Promise.all([
      api.getProfile(),
      api.getRoutePlan(today),
      api.getVisits({ session_date: today }),
    ]).then(([profileResult, planResult, visitsResult]) => {
      const p = profileResult.data
      const homeAddr = p.home_address || ''
      setStartAddress(p.default_start_address || homeAddr)
      setEndAddress(p.default_end_address || p.default_start_address || homeAddr)
      setHasGoogleKey(!!p.google_maps_api_key)

      const visits = visitsResult.data || []
      setTodayVisits(visits)

      if (planResult.data) {
        const plan = planResult.data
        if (plan.start_address) setStartAddress(plan.start_address)
        if (plan.end_address) setEndAddress(plan.end_address)
        if (plan.stores_data && plan.stores_data.length > 0) {
          let routeData = plan.stores_data

          // Sync route status with actual visits
          if (visits.length > 0) {
            setAccepted(true)
            const completedKeys = new Set()
            for (const v of visits) {
              if (v.status === 'Complete') {
                completedKeys.add(`${v.retailer_name}-${v.store_number}`)
              }
            }
            routeData = routeData.map(s => {
              const key = `${s.retailer_name}-${s.store_number}`
              if (completedKeys.has(key) && s.status !== 'completed') {
                return { ...s, status: 'completed' }
              }
              return s
            })
          }

          setRoute(routeData)
          recalcSummary(routeData)
          saveToLocal(routeData, null, null, visits.length > 0)

          // Populate parsedStores from saved plan
          setParsedStores(prev => {
            if (prev.length > 0) return prev
            const entries = []
            for (const s of routeData) {
              for (const program of (s.vendors || [])) {
                entries.push({
                  retailer_name: s.retailer_name,
                  store_number: s.store_number,
                  address: s.address,
                  city: s.city,
                  state: s.state,
                  latitude: s.latitude,
                  longitude: s.longitude,
                  store_id: s.store_id,
                  program,
                })
              }
            }
            return entries
          })
        }
      } else if (visits.length > 0) {
        // No saved plan but visits exist — show visits
        setTodayVisits(visits)
        setAccepted(true)
      }
    }).catch((err) => {
      console.error('Failed to load route plan:', err)
      // Keep localStorage data — don't clear on API failure
    }).finally(() => setLoading(false))
  }, [today])

  // Persist to localStorage on every change
  useEffect(() => {
    if (route.length > 0 || parsedStores.length > 0) {
      saveToLocal(route, summary, parsedStores, accepted)
    }
  }, [route, summary, parsedStores, accepted])

  const recalcSummary = (routeData) => {
    const active = routeData.filter(s => s.status === 'upcoming' || s.status === 'completed')
    const totalEarnings = active.reduce((sum, s) => sum + (s.earnings || 0), 0)
    const totalDrive = active.reduce((sum, s) => sum + (s.drive_time_min || 0), 0)
    const totalAssess = active.reduce((sum, s) => sum + (s.est_minutes || 0), 0)
    const totalTime = totalDrive + totalAssess
    const totalMiles = active.reduce((sum, s) => sum + (s.drive_distance_mi || 0), 0)
    setSummary(prev => ({
      ...prev,
      total_stops: active.length,
      total_vendors: active.reduce((sum, s) => sum + (s.vendors?.length || 0), 0),
      total_earnings: Math.round(totalEarnings),
      total_time_min: Math.round(totalTime),
      total_miles: Math.round(totalMiles * 10) / 10,
      projected_rate_per_hour: totalTime > 0 ? Math.round(totalEarnings / (totalTime / 60)) : 0,
    }))
  }

  const handleParseEmail = async () => {
    if (!emailText.trim()) return
    setParsing(true)
    setError(null)
    setParseSuccess(null)
    try {
      const result = await api.parseEmail(emailText)
      const newStores = result.data || []

      if (newStores.length === 0) {
        setError('No stores found in the pasted email. Check the format and try again.')
        setParsing(false)
        return
      }

      const merged = [...parsedStores]
      let addedCount = 0
      for (const store of newStores) {
        const exists = merged.some(s =>
          s.retailer_name === store.retailer_name &&
          s.store_number === store.store_number &&
          s.program === store.program
        )
        if (!exists) { merged.push(store); addedCount++ }
      }
      setParsedStores(merged)
      setShowEmailInput(false)
      setEmailText('')
      setParseSuccess(`Found ${newStores.length} store/vendor entries (${addedCount} new). Use filters below to narrow down, then optimize.`)
      setShowFilters(true)
      setSelectedCities(null)
      setMaxDistance('')
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
    setParseSuccess(null)
    try {
      const result = await api.parseCheckin(checkinText)
      const newStores = result.data || []

      if (newStores.length === 0) {
        setError('No check-ins found in the pasted text. Check the format and try again.')
        setParsing(false)
        return
      }

      const merged = [...parsedStores]
      let addedCount = 0
      for (const store of newStores) {
        const exists = merged.some(s =>
          s.retailer_name === store.retailer_name &&
          s.store_number === store.store_number &&
          s.program === store.program
        )
        if (!exists) {
          store.confirmed = true
          merged.push(store)
          addedCount++
        } else {
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
      const hasExistingRoute = route.length > 0
      setParseSuccess(`Found ${newStores.length} check-ins (${addedCount} new, added to ${parsedStores.length} existing).${hasExistingRoute ? ' Re-optimize to include new check-ins.' : ' Use filters below to narrow down, then optimize.'}`)
      if (!hasExistingRoute) {
        setShowFilters(true)
        setSelectedCities(null)
        setMaxDistance('')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }

  const optimizeWithStores = async (stores) => {
    try {
      // Calculate time window in minutes from start/end times
      let timeWindowMinutes = null
      if (startTime && endTime) {
        const [sh, sm] = startTime.split(':').map(Number)
        const [eh, em] = endTime.split(':').map(Number)
        timeWindowMinutes = (eh * 60 + em) - (sh * 60 + sm)
        if (timeWindowMinutes <= 0) timeWindowMinutes = null
      }
      const result = await api.optimizeRoute(stores, startAddress, endAddress || startAddress, timeWindowMinutes, startTime)
      if (result.success) {
        setRoute(result.data.route)
        setSummary(result.data.summary)
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
    }
  }

  // Distance filter applies first to get reachable stores
  const distanceFilteredStores = (() => {
    if (!maxDistance || !startCoords) return parsedStores
    const miles = parseFloat(maxDistance)
    if (isNaN(miles)) return parsedStores
    return parsedStores.filter(s => {
      if (!s.latitude || !s.longitude) return true
      return haversineMiles(startCoords.lat, startCoords.lng, s.latitude, s.longitude) <= miles
    })
  })()

  // City buttons only show cities within distance range
  const availableCities = (() => {
    const cityMap = {}
    for (const s of distanceFilteredStores) {
      const raw = (s.city || '').trim()
      if (!raw) continue
      const key = raw.toLowerCase()
      if (!cityMap[key]) cityMap[key] = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    }
    return Object.values(cityMap).sort()
  })()

  const getFilteredStores = () => {
    let filtered = distanceFilteredStores
    if (selectedCities && selectedCities.length > 0) {
      filtered = filtered.filter(s => selectedCities.includes((s.city || '').toLowerCase()))
    }
    return filtered
  }

  const toggleCity = (city) => {
    const lc = city.toLowerCase()
    setSelectedCities(prev => {
      if (!prev) return [lc]
      if (prev.includes(lc)) {
        const next = prev.filter(c => c !== lc)
        return next.length === 0 ? null : next
      }
      return [...prev, lc]
    })
  }

  const handleOptimizeFiltered = async () => {
    const filtered = getFilteredStores()
    if (!filtered.length) {
      setError('No stores match your filters.')
      return
    }
    if (!hasGoogleKey) {
      setError('Google Maps API key needed to optimize route. Add it in Settings.')
      return
    }
    if (!startAddress) {
      setError('Enter a start location.')
      return
    }
    setOptimizing(true)
    setError(null)
    setShowFilters(false)
    try {
      // Exclude stores already visited
      const completedStoreKeys = new Set(
        route.filter(s => s.status === 'completed').map(s => `${s.retailer_name}-${s.store_number}`)
      )
      const unvisited = filtered.filter(s => !completedStoreKeys.has(`${s.retailer_name}-${s.store_number}`))

      setAccepted(false)

      // Use current time as start for re-optimization (real-time traffic)
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const effectiveStartTime = route.some(s => s.status === 'completed') ? currentTime : startTime

      // Calculate remaining time window
      let timeWindowMinutes = null
      if (effectiveStartTime && endTime) {
        const [sh, sm] = effectiveStartTime.split(':').map(Number)
        const [eh, em] = endTime.split(':').map(Number)
        timeWindowMinutes = (eh * 60 + em) - (sh * 60 + sm)
        if (timeWindowMinutes <= 0) timeWindowMinutes = null
      }

      const result = await api.optimizeRoute(unvisited, startAddress, endAddress || startAddress, timeWindowMinutes, effectiveStartTime)
      if (result.success) {
        // Preserve completed stops at the top, append new optimized route
        const kept = route.filter(s => s.status === 'completed')
        setRoute([...kept, ...result.data.route])
        setSummary(result.data.summary)
        await api.saveRoutePlan({
          plan_date: today,
          start_address: startAddress,
          end_address: endAddress || startAddress,
          stores_data: [...kept, ...result.data.route],
        })
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setOptimizing(false)
    }
  }

  const handleReoptimize = async () => {
    // Use parsedStores if available, otherwise rebuild from current route
    const storePool = parsedStores.length > 0 ? parsedStores : route
    if (!storePool.length) return

    setOptimizing(true)
    setError(null)
    setParseSuccess(null)
    try {
      const completedStoreKeys = new Set(
        route.filter(s => s.status === 'completed').map(s => `${s.retailer_name}-${s.store_number}`)
      )

      // Filter from pool, exclude completed
      let candidates = storePool.filter(s => !completedStoreKeys.has(`${s.retailer_name}-${s.store_number}`))

      // Apply distance/city filters if parsedStores available
      if (parsedStores.length > 0) {
        candidates = getFilteredStores().filter(s => !completedStoreKeys.has(`${s.retailer_name}-${s.store_number}`))
      }

      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const effectiveStartTime = route.some(s => s.status === 'completed') ? currentTime : startTime

      let timeWindowMinutes = null
      if (effectiveStartTime && endTime) {
        const [sh, sm] = effectiveStartTime.split(':').map(Number)
        const [eh, em] = endTime.split(':').map(Number)
        timeWindowMinutes = (eh * 60 + em) - (sh * 60 + sm)
        if (timeWindowMinutes <= 0) timeWindowMinutes = null
      }

      setAccepted(false)
      const result = await api.optimizeRoute(candidates, startAddress, endAddress || startAddress, timeWindowMinutes, effectiveStartTime)
      if (result.success) {
        const kept = route.filter(s => s.status === 'completed')
        const newRoute = [...kept, ...result.data.route]
        setRoute(newRoute)
        setSummary(result.data.summary)
        setParseSuccess(`Route re-optimized with ${result.data.route.length} stops using current traffic.`)
        await api.saveRoutePlan({
          plan_date: today,
          start_address: startAddress,
          end_address: endAddress || startAddress,
          stores_data: newRoute,
        })
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setOptimizing(false)
    }
  }

  const handleClearRoute = () => {
    setRoute([])
    setSummary(null)
    setParsedStores([])
    setParseSuccess(null)
    setError(null)
    setShowFilters(false)
    setAccepted(false)
    try {
      localStorage.removeItem(LS_ROUTE)
      localStorage.removeItem(LS_SUMMARY)
      localStorage.removeItem(LS_PARSED)
      localStorage.removeItem(LS_ACCEPTED)
    } catch (e) {}
  }

  const handleAcceptRoute = async () => {
    const upcoming = route.filter(s => s.status === 'upcoming')
    if (!upcoming.length) return
    setAccepting(true)
    setError(null)
    try {
      const result = await api.batchCreateVisits(upcoming, today)
      if (result.success) {
        setAccepted(true)
        setParseSuccess(`Route accepted! ${result.data.created} vendors added to Stores.${result.data.skipped ? ` ${result.data.skipped} already existed.` : ''}`)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setAccepting(false)
    }
  }

  const handleAssessVendors = (store) => {
    // Navigate to first unfinished vendor assessment at this store
    const unfinished = todayVisits.find(v =>
      v.retailer_name === store.retailer_name &&
      v.store_number === store.store_number &&
      v.status === 'Draft'
    )
    if (unfinished) {
      navigate(`/visit/${unfinished.id}`)
    } else {
      // All done or no visits — go to session page
      navigate('/session')
    }
  }

  const handleSkipOrRemove = async (store, status) => {
    try {
      // Delete Draft visits for this store from the Stores tab
      if (accepted) {
        await api.deleteVisitsByStore(store.store_number, store.retailer_name, today)
      }
      const updated = route.map(s =>
        s.retailer_name === store.retailer_name && s.store_number === store.store_number
          ? { ...s, status }
          : s
      )
      setRoute(updated)
      recalcSummary(updated)
      // Persist changes
      api.saveRoutePlan({ plan_date: today, start_address: startAddress, end_address: endAddress || startAddress, stores_data: updated }).catch(() => {})
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRestoreStop = async (store) => {
    try {
      // Re-create visits on Stores tab if route was accepted
      if (accepted) {
        await api.batchCreateVisits([store], today)
      }
      const updated = route.map(s =>
        s.retailer_name === store.retailer_name && s.store_number === store.store_number
          ? { ...s, status: 'upcoming' }
          : s
      )
      setRoute(updated)
      recalcSummary(updated)
      // Persist changes
      api.saveRoutePlan({ plan_date: today, start_address: startAddress, end_address: endAddress || startAddress, stores_data: updated }).catch(() => {})
    } catch (err) {
      setError(err.message)
    }
  }

  const refreshVisits = async () => {
    try {
      const result = await api.getVisits({ session_date: today })
      setTodayVisits(result.data || [])
    } catch (err) {}
  }

  const handleStoreSearch = async (q) => {
    setStoreSearchQuery(q)
    if (q.trim().length < 1) { setStoreSearchResults([]); return }
    try {
      const result = await api.searchStores(q)
      setStoreSearchResults(result.data || [])
    } catch (err) {}
  }

  const handleAddStoreToRoute = async (store) => {
    setShowAddStore(false)
    setStoreSearchQuery('')
    setStoreSearchResults([])
    // Load programs for vendor selection
    setAddingVendorStore(store)
    try {
      const result = await api.getPrograms()
      setPrograms(result.data || [])
    } catch (err) {}
  }

  const handleConfirmAddVendor = async () => {
    if (!addingVendorStore || !selectedProgram?.trim()) return
    try {
      const now = new Date()
      const visitData = {
        store_id: addingVendorStore.id,
        retailer_name: addingVendorStore.retailer_name,
        store_number: addingVendorStore.store_number,
        program: selectedProgram,
        address: addingVendorStore.address,
        city: addingVendorStore.city,
        state: addingVendorStore.state,
        visit_date: today,
        visit_time: now.toTimeString().slice(0, 5),
        session_date: today,
      }
      const result = await api.createVisit(visitData)
      setAddingVendorStore(null)
      setSelectedProgram(null)
      await refreshVisits()
      // Navigate to the assessment form
      if (result.data?.id) navigate(`/visit/${result.data.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddVendorToExisting = async (store) => {
    // Find the store in the database to get full details
    try {
      const result = await api.searchStores(`${store.retailer_name} ${store.store_number}`)
      const match = (result.data || []).find(s =>
        s.retailer_name === store.retailer_name && s.store_number === store.store_number
      )
      if (match) {
        setAddingVendorStore(match)
        const progResult = await api.getPrograms()
        setPrograms(progResult.data || [])
      } else {
        setAddingVendorStore({ ...store, id: store.store_id })
        const progResult = await api.getPrograms()
        setPrograms(progResult.data || [])
      }
    } catch (err) {
      setError(err.message)
    }
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

  const doneStatuses = ['completed', 'skipped', 'removed']
  const completedStops = route.filter(s => doneStatuses.includes(s.status))
  const upcomingStops = route.filter(s => !doneStatuses.includes(s.status))

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Route Planner" />
        <div className="text-center py-12"><p className="text-gray-400 text-sm">Loading...</p></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Route Planner" subtitle={new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} />

      <div className="max-w-lg mx-auto px-4 py-4">
        {error && <p className="text-red-500 text-sm mb-3 bg-red-50 p-3 rounded-lg">{error}</p>}
        {parseSuccess && <p className="text-green-600 text-sm mb-3 bg-green-50 p-3 rounded-lg">{parseSuccess}</p>}

        {!hasGoogleKey && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm font-medium">Google Maps API key required</p>
            <p className="text-yellow-700 text-xs mt-1">Add your Google Maps API key in Settings to enable route optimization.</p>
            <button onClick={() => navigate('/settings')} className="mt-2 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 shadow-sm">Go to Settings</button>
          </div>
        )}

        {/* Start/End addresses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Location (full address with city, state)</label>
            <input type="text" value={startAddress} onChange={(e) => { setStartAddress(e.target.value); setStartCoords(null) }}
              placeholder="123 Main St, Portland, OR 97201"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Location</label>
            <input type="text" value={endAddress} onChange={(e) => setEndAddress(e.target.value)}
              placeholder="Same as start (default)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Start Time</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">End Time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        {/* Input buttons */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => { setShowEmailInput(!showEmailInput); setShowCheckinInput(false) }}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-medium hover:bg-blue-700">
            {showEmailInput ? 'Cancel' : 'Paste Program Event Email'}
          </button>
          <button onClick={() => { setShowCheckinInput(!showCheckinInput); setShowEmailInput(false) }}
            className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-xs font-medium hover:bg-green-700">
            {showCheckinInput ? 'Cancel' : 'Paste SMS Check-in'}
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
              {parsing ? 'Parsing email...' : 'Parse & Build Route'}
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
              {parsing ? 'Parsing check-ins...' : 'Add Check-ins & Re-optimize'}
            </button>
          </div>
        )}

        {/* Filter stores before optimizing */}
        {showFilters && parsedStores.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">Filter Stores ({new Set(parsedStores.map(s => `${s.retailer_name}-${s.store_number}`)).size} stores, {parsedStores.length} vendors)</p>

            {/* Max distance filter — applies first, limits which cities appear */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Max Radius from Start (straight-line miles)</label>
              <input type="number" value={maxDistance} onChange={(e) => {
                setMaxDistance(e.target.value)
                setSelectedCities(null)
                if (e.target.value && !startCoords && startAddress) {
                  api.geocodeAddress(startAddress).then(r => {
                    if (r.success) setStartCoords({ lat: r.data.latitude, lng: r.data.longitude })
                  }).catch(() => {})
                }
              }}
                placeholder="No limit — show all stores"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              {maxDistance && !startCoords && startAddress && <p className="text-xs text-yellow-600 mt-1">Locating start address...</p>}
              {maxDistance && startCoords && (
                <p className="text-xs text-gray-400 mt-1">{distanceFilteredStores.length} of {parsedStores.length} vendors within {maxDistance} miles</p>
              )}
            </div>

            {/* City filter — only shows cities within distance range */}
            {availableCities.length > 1 && (
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1.5">Then Select Cities</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableCities.map(city => {
                    const isSelected = !selectedCities || selectedCities.includes(city.toLowerCase())
                    const count = distanceFilteredStores.filter(s => (s.city || '').toLowerCase() === city.toLowerCase()).length
                    return (
                      <button key={city} onClick={() => toggleCity(city)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-gray-50 text-gray-400 border-gray-200'
                        }`}>
                        {city} ({count})
                      </button>
                    )
                  })}
                </div>
                {selectedCities && (
                  <button onClick={() => setSelectedCities(null)} className="text-xs text-blue-600 mt-1.5 hover:underline">
                    Select all cities
                  </button>
                )}
              </div>
            )}

            {/* Count and optimize button */}
            <div className="text-xs text-gray-500 mb-2">
              {(() => {
                const filtered = getFilteredStores()
                const storeCount = new Set(filtered.map(s => `${s.retailer_name}-${s.store_number}`)).size
                return `${filtered.length} vendors at ${storeCount} stores selected`
              })()}
            </div>
            <button onClick={handleOptimizeFiltered} disabled={optimizing}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              Optimize Route
            </button>
          </div>
        )}

        {/* Optimizing indicator */}
        {optimizing && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-center">
            <p className="text-blue-700 text-sm font-medium">Optimizing your route...</p>
            <p className="text-blue-500 text-xs mt-1">Calculating drive times and best order</p>
          </div>
        )}

        {/* Summary bar */}
        {summary && route.length > 0 && (
          <div className="bg-blue-600 text-white rounded-xl p-4 mb-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xl font-bold">{summary.total_stops || 0}</p>
                <p className="text-[10px] text-blue-200">Stops</p>
              </div>
              <div>
                <p className="text-xl font-bold">${summary.total_earnings || 0}</p>
                <p className="text-[10px] text-blue-200">Earnings</p>
              </div>
              <div>
                <p className="text-xl font-bold">{Math.round(summary.total_time_min || 0)}m</p>
                <p className="text-[10px] text-blue-200">Total Time</p>
              </div>
              <div>
                <p className="text-xl font-bold">${Math.round(summary.projected_rate_per_hour || 0)}</p>
                <p className="text-[10px] text-blue-200">$/Hour</p>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-2 text-[10px] text-blue-200">
              {(summary.total_miles || 0) > 0 && <span>{summary.total_miles} miles</span>}
              {summary.total_vendors > 0 && <span>{summary.total_vendors} vendors</span>}
            </div>
            {(summary.depart_home || summary.arrive_home) && (
              <div className="flex justify-center gap-3 mt-1 text-[10px] text-blue-200">
                {summary.depart_home && <span>Leave {summary.depart_home}</span>}
                {summary.arrive_home && <span>Home by {summary.arrive_home}</span>}
              </div>
            )}
            {summary.skipped_vendors > 0 && (
              <p className="text-center text-[10px] text-blue-300 mt-1">
                {summary.skipped_vendors} vendors skipped (didn't fit in time window)
              </p>
            )}
          </div>
        )}

        {/* Route action buttons */}
        {route.length > 0 && !optimizing && !showFilters && (
          <div className="mb-4">
            <div className="flex gap-2">
              <button onClick={handleReoptimize}
                className="flex-1 bg-blue-100 text-blue-700 py-2 rounded-xl text-xs font-medium border border-blue-200 hover:bg-blue-200">
                Re-optimize Route
              </button>
              <button onClick={() => setShowFilters(true)}
                className="flex-1 bg-green-50 text-green-700 py-2 rounded-xl text-xs font-medium border border-green-200 hover:bg-green-100">
                Add Cities
              </button>
              <button onClick={handleClearRoute}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-200 hover:bg-red-100">
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Route map overview */}
        {route.length > 1 && !optimizing && !showFilters && (
          <div className="mb-4">
            <RouteMap route={route} startCoords={startCoords} endAddress={endAddress || startAddress} />
            <p className="text-[10px] text-gray-400 text-center mt-1">Tap a marker for details</p>
          </div>
        )}

        {/* Completed/Skipped/Removed stops */}
        {completedStops.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Done ({completedStops.length})</p>
            {completedStops.map((store, i) => (
              <div key={i} className="bg-gray-100 rounded-xl p-3 mb-2">
                <div className="flex items-center gap-2">
                  {store.status === 'completed' ? (
                    <span className="text-xs font-bold text-green-600 bg-green-100 w-6 h-6 rounded-full flex items-center justify-center">✓</span>
                  ) : (
                    <span className="text-xs font-bold text-gray-400 bg-gray-200 w-6 h-6 rounded-full flex items-center justify-center">—</span>
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${store.status === 'removed' ? 'text-gray-400 line-through' : 'text-gray-600'}`}>{store.retailer_name} #{store.store_number}</p>
                    <p className="text-xs text-gray-400">{store.vendors?.join(', ')} — ${store.earnings}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                      store.status === 'completed' ? 'bg-green-100 text-green-700'
                        : store.status === 'removed' ? 'bg-red-50 text-red-500'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {store.status === 'completed' ? 'Assessed' : store.status === 'removed' ? 'Removed' : 'Skipped'}
                    </span>
                    {store.status !== 'completed' && (
                      <button onClick={() => handleRestoreStop(store)}
                        className="text-[10px] font-medium text-blue-600 hover:underline">
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming stops */}
        {upcomingStops.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">
              {completedStops.length > 0 ? `Upcoming (${upcomingStops.length})` : `Route (${upcomingStops.length} stops)`}
            </p>
            {upcomingStops.map((store, i) => {
              const globalIndex = route.indexOf(store)
              return (
                <div key={i} className={`bg-white rounded-xl shadow-sm border p-4 mb-2 ${i === 0 ? 'border-blue-300' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${i === 0 ? 'text-white bg-blue-600' : 'text-blue-600 bg-blue-100'}`}>
                          {completedStops.length + i + 1}
                        </span>
                        <p className="text-sm font-semibold text-gray-900">{store.retailer_name} #{store.store_number}</p>
                      </div>
                      {store.address && <p className="text-xs text-gray-400 mt-1 ml-8">{store.address}, {store.city}</p>}
                      {/* Individual vendor assessment status */}
                      <div className="mt-1 ml-8 space-y-1">
                        {(store.vendors || []).map((vendor, vi) => {
                          const visit = todayVisits.find(v =>
                            v.retailer_name === store.retailer_name &&
                            v.store_number === store.store_number &&
                            v.program === vendor
                          )
                          const isDone = visit?.status === 'Complete'
                          return (
                            <div key={vi} className="flex items-center gap-1.5">
                              {visit ? (
                                <button onClick={() => navigate(`/visit/${visit.id}`)}
                                  className={`text-xs px-2 py-0.5 rounded ${isDone ? 'bg-green-100 text-green-700' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}>
                                  {isDone ? '✓ ' : ''}{vendor} {isDone ? '' : '— tap to assess'}
                                </button>
                              ) : (
                                <span className="text-xs text-gray-500">{vendor}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {/* Schedule */}
                      {store.est_arrival && (
                        <p className="text-xs font-medium text-blue-600 mt-1.5 ml-8">
                          Arrive {store.est_arrival} — Leave {store.est_depart}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-1.5 ml-8">
                        {store.drive_time_min > 0 && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{Math.round(store.drive_time_min)} min drive</span>
                        )}
                        {store.drive_distance_mi > 0 && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{store.drive_distance_mi} mi</span>
                        )}
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">${store.earnings}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">~{Math.round(store.est_minutes)} min assess</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      <button onClick={() => moveStop(globalIndex, -1)} disabled={globalIndex === 0}
                        className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded text-gray-500 text-xs disabled:opacity-30 hover:bg-gray-200">↑</button>
                      <button onClick={() => moveStop(globalIndex, 1)} disabled={globalIndex === route.length - 1}
                        className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded text-gray-500 text-xs disabled:opacity-30 hover:bg-gray-200">↓</button>
                    </div>
                  </div>
                  {/* Inline Add Vendor */}
                  {addingVendorStore && addingVendorStore.retailer_name === store.retailer_name && addingVendorStore.store_number === store.store_number && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Add Vendor</p>
                      <select value={selectedProgram || ''} onChange={(e) => setSelectedProgram(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2">
                        <option value="">Select a program...</option>
                        {programs.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input type="text" placeholder="Or type a custom program code"
                        value={selectedProgram && !programs.includes(selectedProgram) ? selectedProgram : ''}
                        onChange={(e) => setSelectedProgram(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
                      <div className="flex gap-2">
                        <button onClick={handleConfirmAddVendor} disabled={!selectedProgram?.trim()}
                          className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                          Add & Assess
                        </button>
                        <button onClick={() => { setAddingVendorStore(null); setSelectedProgram(null) }}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-200">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleAssessVendors(store)}
                      className="flex-1 bg-blue-50 text-blue-700 py-1.5 rounded-lg text-xs font-medium border border-blue-200 hover:bg-blue-100">
                      Assess Vendors
                    </button>
                    <button onClick={() => handleAddVendorToExisting(store)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium border border-blue-200 hover:bg-blue-100">
                      + Vendor
                    </button>
                    <button onClick={() => handleSkipOrRemove(store, 'skipped')}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-200">
                      Skip
                    </button>
                    <button onClick={() => handleSkipOrRemove(store, 'removed')}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-200 hover:bg-red-100">
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Accept Route button */}
        {upcomingStops.length > 0 && !optimizing && !accepted && (
          <div className="mb-4">
            <button onClick={handleAcceptRoute} disabled={accepting}
              className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {accepting ? 'Creating visits...' : `Accept Route — Create ${upcomingStops.reduce((sum, s) => sum + (s.vendors?.length || 0), 0)} Vendor Assessments`}
            </button>
          </div>
        )}

        {/* Add Vendor panel for manually added stores (not in route) */}
        {addingVendorStore && !route.some(s => s.retailer_name === addingVendorStore.retailer_name && s.store_number === addingVendorStore.store_number) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">
              Add Vendor — {addingVendorStore.retailer_name} #{addingVendorStore.store_number}
            </p>
            <select value={selectedProgram || ''} onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2">
              <option value="">Select a program...</option>
              {programs.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="text" placeholder="Or type a custom program code"
              value={selectedProgram && !programs.includes(selectedProgram) ? selectedProgram : ''}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
            <div className="flex gap-2">
              <button onClick={handleConfirmAddVendor} disabled={!selectedProgram?.trim()}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                Add & Assess
              </button>
              <button onClick={() => { setAddingVendorStore(null); setSelectedProgram(null) }}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Add Store search */}
        {showAddStore && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">Add a Store</p>
            <input type="text" value={storeSearchQuery} onChange={(e) => handleStoreSearch(e.target.value)}
              placeholder="Search by name, number, city, address..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" autoFocus />
            {storeSearchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {storeSearchResults.map(store => (
                  <button key={store.id} onClick={() => handleAddStoreToRoute(store)}
                    className="w-full text-left p-2 rounded-lg hover:bg-blue-50 border border-gray-100">
                    <p className="text-sm font-medium">{store.retailer_name} #{store.store_number}</p>
                    <p className="text-xs text-gray-400">{store.address}, {store.city}, {store.state}</p>
                  </button>
                ))}
              </div>
            )}
            {storeSearchQuery.length > 0 && storeSearchResults.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No stores found</p>
            )}
            <button onClick={() => { setShowAddStore(false); setStoreSearchQuery(''); setStoreSearchResults([]) }}
              className="w-full text-center text-xs text-gray-400 mt-2 hover:text-gray-600">Cancel</button>
          </div>
        )}

        {/* Add Store button */}
        {!showAddStore && !addingVendorStore && !optimizing && (
          <div className="mb-4">
            <button onClick={() => setShowAddStore(true)}
              className="w-full bg-white text-blue-600 py-2.5 rounded-xl text-xs font-medium border border-blue-200 hover:bg-blue-50">
              + Add Store Manually
            </button>
          </div>
        )}

        {/* Empty state */}
        {route.length === 0 && todayVisits.length === 0 && !loading && !optimizing && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <p className="text-gray-400 text-sm">No route planned yet</p>
            <p className="text-gray-300 text-xs mt-1">Paste an event email or add a store manually</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RoutePlanner

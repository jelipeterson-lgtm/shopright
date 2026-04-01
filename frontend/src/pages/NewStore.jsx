import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../services/api'

function NewStore() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionDate = location.state?.sessionDate || new Date().toISOString().split('T')[0]
  const preselectedStore = location.state?.preselectedStore
  const [gpsStatus, setGpsStatus] = useState(preselectedStore ? 'skipped' : 'requesting')
  const [nearbyStores, setNearbyStores] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Selected store + program
  const [selectedStore, setSelectedStore] = useState(null)
  const [programs, setPrograms] = useState([])
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [loadingPrograms, setLoadingPrograms] = useState(false)

  useEffect(() => {
    if (preselectedStore) {
      // Coming from "Add Another Vendor" — skip GPS, go straight to program selection
      handleSelectStore(preselectedStore)
    } else {
      requestGPS()
    }
  }, [])

  const requestGPS = () => {
    setGpsStatus('requesting')
    setError(null)

    if (!navigator.geolocation) {
      setGpsStatus('unavailable')
      setShowSearch(true)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        setGpsStatus('searching')
        try {
          const result = await api.getNearbyStores(latitude, longitude)
          if (result.data.length > 0) {
            setNearbyStores(result.data)
            setGpsStatus('found')
          } else {
            setGpsStatus('none_nearby')
            setShowSearch(true)
          }
        } catch (err) {
          setError('Failed to search nearby stores')
          setGpsStatus('error')
          setShowSearch(true)
        }
      },
      (err) => {
        setGpsStatus('denied')
        setShowSearch(true)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.searchStores(searchQuery)
      setSearchResults(result.data)
      if (result.data.length === 0) {
        setError('No stores found')
      }
    } catch (err) {
      setError('Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectStore = async (store) => {
    setSelectedStore(store)
    setLoadingPrograms(true)
    try {
      const result = await api.getStorePrograms(store.store_number, store.retailer_name)
      setPrograms(result.data)
      if (result.data.length === 1) {
        setSelectedProgram(result.data[0])
      }
    } catch (err) {
      setError('Failed to load programs')
    } finally {
      setLoadingPrograms(false)
    }
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const visitData = {
        store_id: selectedStore.id,
        retailer_name: selectedStore.retailer_name,
        store_number: selectedStore.store_number,
        program: selectedProgram,
        address: selectedStore.address,
        city: selectedStore.city,
        state: selectedStore.state,
        visit_date: sessionDate,
        visit_time: now.toTimeString().slice(0, 5),
        session_date: sessionDate,
      }
      const result = await api.createVisit(visitData)
      navigate(`/visit/${result.data.id}`, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Store card component
  const StoreCard = ({ store, showDistance }) => (
    <button
      onClick={() => handleSelectStore(store)}
      className={`w-full text-left p-4 rounded-lg border transition ${
        selectedStore?.id === store.id
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-gray-900">{store.retailer_name} #{store.store_number}</p>
          <p className="text-sm text-gray-500">{store.address}</p>
          <p className="text-sm text-gray-500">{store.city}, {store.state} {store.zip_code}</p>
        </div>
        {showDistance && store.distance_miles !== undefined && (
          <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full whitespace-nowrap ml-2">
            {store.distance_miles} mi
          </span>
        )}
      </div>
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">New Store</h1>
          <button onClick={() => navigate('/')} className="text-blue-600 text-sm hover:underline">Cancel</button>
        </div>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-md">{error}</p>}

        {/* GPS Status */}
        {!selectedStore && (
          <>
            {gpsStatus === 'requesting' && (
              <div className="bg-white rounded-lg shadow p-6 mb-4 text-center">
                <p className="text-gray-500">Requesting your location...</p>
                <p className="text-xs text-gray-400 mt-1">Allow location access to find nearby stores</p>
              </div>
            )}

            {gpsStatus === 'searching' && (
              <div className="bg-white rounded-lg shadow p-6 mb-4 text-center">
                <p className="text-gray-500">Searching for nearby stores...</p>
              </div>
            )}

            {gpsStatus === 'denied' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800 text-sm font-medium">Location access was denied</p>
                <p className="text-yellow-700 text-xs mt-1">
                  To enable nearby store suggestions, allow location access in your browser settings:
                </p>
                <ul className="text-yellow-700 text-xs mt-1 list-disc list-inside space-y-0.5">
                  <li><span className="font-medium">iPhone/iPad:</span> Settings &gt; Safari (or Chrome) &gt; Location &gt; Allow</li>
                  <li><span className="font-medium">Android:</span> Settings &gt; Apps &gt; Chrome &gt; Permissions &gt; Location</li>
                  <li><span className="font-medium">Desktop:</span> Click the lock icon in the address bar &gt; Location &gt; Allow</li>
                </ul>
                <p className="text-yellow-700 text-xs mt-2">Or use the search below to find your store manually.</p>
                <button
                  onClick={requestGPS}
                  className="mt-2 text-yellow-800 text-xs font-medium underline"
                >
                  Try again
                </button>
              </div>
            )}

            {gpsStatus === 'none_nearby' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800 text-sm">No stores found within 1 mile. Use search below.</p>
              </div>
            )}

            {/* Nearby Stores */}
            {nearbyStores.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-medium text-gray-700 mb-2">Nearby Stores</h2>
                <div className="space-y-2">
                  {nearbyStores.map((store) => (
                    <StoreCard key={store.id} store={store} showDistance={true} />
                  ))}
                </div>
              </div>
            )}

            {/* Search Toggle */}
            {!showSearch && gpsStatus === 'found' && (
              <button
                onClick={() => setShowSearch(true)}
                className="text-blue-600 text-sm hover:underline mb-4"
              >
                Search instead
              </button>
            )}

            {/* Search */}
            {showSearch && (
              <div className="mb-4">
                <h2 className="text-sm font-medium text-gray-700 mb-2">Search Stores</h2>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Store number or retailer name"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? '...' : 'Search'}
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {searchResults.map((store) => (
                      <StoreCard key={store.id} store={store} showDistance={false} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Program Selection */}
        {selectedStore && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <p className="font-medium text-gray-900">{selectedStore.retailer_name} #{selectedStore.store_number}</p>
              <p className="text-sm text-gray-500">{selectedStore.address}, {selectedStore.city}, {selectedStore.state}</p>
            </div>

            {loadingPrograms ? (
              <p className="text-gray-400 text-sm">Loading programs...</p>
            ) : programs.length === 0 ? (
              <p className="text-red-500 text-sm">No active programs found for this store.</p>
            ) : (
              <>
                <h2 className="text-sm font-medium text-gray-700 mb-2">Select Program</h2>
                <div className="space-y-2 mb-4">
                  {programs.map((prog) => (
                    <button
                      key={prog}
                      onClick={() => setSelectedProgram(prog)}
                      className={`w-full text-left p-3 rounded-lg border transition text-sm ${
                        selectedProgram === prog
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {prog}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={!selectedProgram}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Confirm Store
                </button>
              </>
            )}

            <button
              onClick={() => { setSelectedStore(null); setPrograms([]); setSelectedProgram(null) }}
              className="w-full mt-2 text-gray-500 text-sm hover:underline"
            >
              Choose a different store
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NewStore

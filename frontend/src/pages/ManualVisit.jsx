import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getLocalDate } from '../services/api'
import PageHeader from '../components/PageHeader'

function ManualVisit() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [programs, setPrograms] = useState([])
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [showCustomProgram, setShowCustomProgram] = useState(false)
  const [customProgram, setCustomProgram] = useState('')
  const [visitDate, setVisitDate] = useState(getLocalDate())
  const [visitTime, setVisitTime] = useState(new Date().toTimeString().slice(0, 5))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.searchStores(searchQuery)
      setSearchResults(result.data)
      if (result.data.length === 0) setError('No stores found')
    } catch (err) {
      setError('Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectStore = async (store) => {
    setSelectedStore(store)
    try {
      const result = await api.getPrograms()
      setPrograms(result.data)
    } catch (err) {
      setError('Failed to load programs')
    }
  }

  const handleCreate = async () => {
    if (!visitDate || !visitTime) {
      setError('Date and time are required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await api.createVisit({
        store_id: selectedStore.id,
        retailer_name: selectedStore.retailer_name,
        store_number: selectedStore.store_number,
        program: selectedProgram,
        address: selectedStore.address,
        city: selectedStore.city,
        state: selectedStore.state,
        visit_date: visitDate,
        visit_time: visitTime,
        session_date: visitDate,
        is_manual: true,
      })
      navigate(`/visit/${result.data.id}`, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Add Store & Vendor" rightButton={<button onClick={() => navigate('/session')} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 active:bg-gray-200 shadow-sm">Cancel</button>} />
      <div className="max-w-lg mx-auto px-4 py-4">

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-md">{error}</p>}

        {!selectedStore ? (
          <>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Store number or retailer name"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {loading ? '...' : 'Search'}
              </button>
            </form>

            <div className="space-y-2">
              {searchResults.map((store) => (
                <button
                  key={store.id}
                  onClick={() => handleSelectStore(store)}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 bg-white hover:border-gray-300"
                >
                  <p className="font-medium text-gray-900">{store.retailer_name} #{store.store_number}</p>
                  <p className="text-sm text-gray-500">{store.address}, {store.city}, {store.state}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <p className="font-medium text-gray-900">{selectedStore.retailer_name} #{selectedStore.store_number}</p>
              <p className="text-sm text-gray-500">{selectedStore.address}, {selectedStore.city}, {selectedStore.state}</p>
              <button onClick={() => { setSelectedStore(null); setPrograms([]); setSelectedProgram(null) }}
                className="text-xs text-blue-600 hover:underline mt-1">Change store</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Program</label>
              {!showCustomProgram ? (
                <select
                  value={selectedProgram || ''}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setShowCustomProgram(true)
                      setSelectedProgram('')
                    } else {
                      setSelectedProgram(e.target.value)
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select a program...</option>
                  {programs.map((prog) => (
                    <option key={prog} value={prog}>{prog}</option>
                  ))}
                  <option value="__custom__">Other (enter manually)</option>
                </select>
              ) : (
                <>
                  <input
                    type="text"
                    value={customProgram}
                    onChange={(e) => { setCustomProgram(e.target.value); setSelectedProgram(e.target.value) }}
                    placeholder="Enter vendor program code"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => { setShowCustomProgram(false); setCustomProgram(''); setSelectedProgram('') }}
                    className="text-xs text-blue-600 mt-1 hover:underline"
                  >
                    Back to program list
                  </button>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date</label>
              <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visit Time</label>
              <input type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <button onClick={handleCreate} disabled={loading || !selectedProgram || !visitDate || !visitTime}
              className="w-full bg-blue-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Visit'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ManualVisit

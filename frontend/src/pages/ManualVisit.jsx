import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import PageHeader from '../components/PageHeader'

function ManualVisit() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [programs, setPrograms] = useState([])
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [visitDate, setVisitDate] = useState('')
  const [visitTime, setVisitTime] = useState('')
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
      const result = await api.getStorePrograms(store.store_number, store.retailer_name)
      setPrograms(result.data)
      if (result.data.length === 1) setSelectedProgram(result.data[0])
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <PageHeader title="Add Visit Manually" size="small" />
          <button onClick={() => navigate('/session')} className="text-blue-600 text-sm hover:underline">Cancel</button>
        </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
              <input
                type="text"
                value={selectedProgram || ''}
                onChange={(e) => setSelectedProgram(e.target.value)}
                placeholder="Enter program code"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {programs.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {programs.map((prog) => (
                    <button key={prog} onClick={() => setSelectedProgram(prog)}
                      className={`px-3 py-1 text-xs rounded-full border transition ${
                        selectedProgram === prog
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {prog}
                    </button>
                  ))}
                </div>
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

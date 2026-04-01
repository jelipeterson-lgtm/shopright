import { useState, useEffect } from 'react'
import api from '../services/api'

function Home() {
  const [status, setStatus] = useState('Checking connection...')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.healthCheck()
      .then((data) => {
        setStatus(data.data)
        setLoading(false)
      })
      .catch((err) => {
        setError('Could not reach backend')
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">ShopRight</h1>
      <p className="text-gray-500 mb-8">Field assessment tool for mystery shoppers</p>

      <div className="bg-white rounded-lg shadow p-6 w-full max-w-sm text-center">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">System Status</h2>
        {loading && (
          <p className="text-gray-400">Connecting to server...</p>
        )}
        {error && (
          <p className="text-red-500">{error}</p>
        )}
        {!loading && !error && (
          <p className="text-green-600">{status}</p>
        )}
      </div>
    </div>
  )
}

export default Home

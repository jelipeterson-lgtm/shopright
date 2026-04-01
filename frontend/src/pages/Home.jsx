import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const confirmedStore = location.state?.confirmedStore

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">ShopRight</h1>
          <button onClick={() => navigate('/settings')} className="text-blue-600 text-sm hover:underline">Settings</button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <p className="text-sm text-gray-500">Signed in as</p>
          <p className="text-gray-800 font-medium">{user?.email}</p>
        </div>

        {confirmedStore && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-green-800 text-sm font-medium">Store confirmed</p>
            <p className="text-green-700 text-sm">{confirmedStore.retailer_name} #{confirmedStore.store_number}</p>
            <p className="text-green-600 text-xs">{confirmedStore.program}</p>
            <p className="text-green-600 text-xs mt-1">Session and visit features coming in Phase 3</p>
          </div>
        )}

        <button
          onClick={() => navigate('/new-store')}
          className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 mb-4"
        >
          New Store
        </button>

        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-400 text-sm">No active session</p>
          <p className="text-gray-300 text-xs mt-1">Session and visit features coming in Phase 3</p>
        </div>
      </div>
    </div>
  )
}

export default Home

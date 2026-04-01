import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'

function Home() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

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

        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-400 text-sm">No active session</p>
          <p className="text-gray-300 text-xs mt-1">Session and visit features coming in Phase 3</p>
        </div>
      </div>
    </div>
  )
}

export default Home

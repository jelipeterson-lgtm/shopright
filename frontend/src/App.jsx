import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './services/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Settings from './pages/Settings'
import NewStore from './pages/NewStore'
import Session from './pages/Session'
import Visit from './pages/Visit'
import ManualVisit from './pages/ManualVisit'
import WeeklyReport from './pages/WeeklyReport'
import MonthlyInvoice from './pages/MonthlyInvoice'
import Landing from './pages/Landing'
import Profile from './pages/Profile'
import HelpGuide from './pages/HelpGuide'
import HelpChat from './components/HelpChat'
import BottomNav from './components/BottomNav'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }
  return user ? <><div className="pb-16">{children}</div><BottomNav /></> : <Navigate to="/login" />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }
  return user ? <Navigate to="/app" /> : children
}

function AuthenticatedHelpChat() {
  const { user } = useAuth()
  if (!user) return null
  return <HelpChat />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/app" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/help" element={<ProtectedRoute><HelpGuide /></ProtectedRoute>} />
          <Route path="/new-store" element={<ProtectedRoute><NewStore /></ProtectedRoute>} />
          <Route path="/session" element={<ProtectedRoute><Session /></ProtectedRoute>} />
          <Route path="/visit/:id" element={<ProtectedRoute><Visit /></ProtectedRoute>} />
          <Route path="/manual-visit" element={<ProtectedRoute><ManualVisit /></ProtectedRoute>} />
          <Route path="/weekly-report" element={<ProtectedRoute><WeeklyReport /></ProtectedRoute>} />
          <Route path="/monthly-invoice" element={<ProtectedRoute><MonthlyInvoice /></ProtectedRoute>} />
        </Routes>
        <AuthenticatedHelpChat />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

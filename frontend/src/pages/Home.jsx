import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'
import api, { getLocalDate } from '../services/api'
import Paywall from './Paywall'
import PageHeader from '../components/PageHeader'

function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const today = getLocalDate()
  const [todayVisits, setTodayVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(true)
  const [trialInfo, setTrialInfo] = useState(null)
  const [priceIds, setPriceIds] = useState({})
  const [profile, setProfile] = useState(null)
  const [subReason, setSubReason] = useState(null)

  useEffect(() => {
    Promise.all([
      api.getVisits({ session_date: today }),
      api.getSubscriptionStatus(),
      api.getProfile(),
    ]).then(([visitsResult, subResult, profileResult]) => {
      setTodayVisits(visitsResult.data)
      const sub = subResult.data
      setHasAccess(sub.access)
      setSubReason(sub.reason)
      if (sub.reason === 'trial') setTrialInfo(sub.trial_ends_at)
      if (sub.reason === 'subscribed' && sub.renewal_date) setTrialInfo(sub.renewal_date)
      if (sub.monthly_price) setPriceIds({ monthly: sub.monthly_price, annual: sub.annual_price })
      setProfile(profileResult.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [today])

  const hasDrafts = todayVisits.some((v) => v.status === 'Draft')
  const hasVisits = todayVisits.length > 0
  const completeCount = todayVisits.filter((v) => v.status === 'Complete').length
  const firstName = profile?.full_name?.split(' ')[0] || 'Shopper'

  if (!loading && !hasAccess) {
    return <Paywall onAccessGranted={() => setHasAccess(true)} monthlyPriceId={priceIds.monthly} annualPriceId={priceIds.annual} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={`Welcome, ${firstName}`}
        subtitle={
          subReason === 'free_account' ? 'Free Account' :
          subReason === 'subscribed' && trialInfo ? `Next renewal: ${trialInfo}` :
          subReason === 'subscribed' ? 'Active Subscription' :
          subReason === 'trial' && trialInfo ? `Free trial ends in ${Math.max(0, Math.ceil((new Date(trialInfo) - new Date()) / 86400000))} days (${new Date(trialInfo).toLocaleDateString()})` :
          null
        }
      />

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Payment success banner */}
        {searchParams.get('payment') === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-green-700 text-sm">Subscription activated! Welcome to ShopRight.</p>
          </div>
        )}

        {/* Trial banner */}
        {subReason === 'trial' && trialInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-blue-700 text-sm">
              Free trial — {Math.max(0, Math.ceil((new Date(trialInfo) - new Date()) / 86400000))} days remaining
            </p>
          </div>
        )}

        {/* Today's stats */}
        {hasVisits && (
          <button
            onClick={() => navigate('/session')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 text-left hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Today's Stores</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {completeCount} vendor{completeCount !== 1 ? 's' : ''} complete, {todayVisits.length - completeCount} in progress
                </p>
              </div>
              <span className="text-blue-600 text-xs font-medium bg-blue-50 px-3 py-1 rounded-full">View</span>
            </div>
          </button>
        )}

        {/* Quick actions */}
        <div className="space-y-2 mb-6">
          <button
            onClick={() => navigate('/session')}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm"
          >
            {hasVisits ? 'View Today\'s Stores' : 'Start Shopping'}
          </button>
          <button
            onClick={() => navigate('/manual-visit')}
            className="w-full bg-white text-gray-700 py-3 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50"
          >
            Add Store & Vendor Manually
          </button>
        </div>

        {/* Reports */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Reports</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate('/weekly-report')}
              className="bg-white rounded-xl border border-gray-100 p-4 text-left hover:shadow-sm transition"
            >
              <p className="text-sm font-medium text-gray-800">Weekly</p>
              <p className="text-xs text-gray-400 mt-0.5">Shop File</p>
            </button>
            <button
              onClick={() => navigate('/monthly-invoice')}
              className="bg-white rounded-xl border border-gray-100 p-4 text-left hover:shadow-sm transition"
            >
              <p className="text-sm font-medium text-gray-800">Monthly</p>
              <p className="text-xs text-gray-400 mt-0.5">Invoice</p>
            </button>
          </div>
        </div>

        {/* Empty state */}
        {!loading && !hasVisits && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <p className="text-gray-400 text-sm">No stores visited today</p>
            <p className="text-gray-300 text-xs mt-1">Tap "Start Shopping" to add your first store</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">Loading...</p>
          </div>
        )}
      </div>

    </div>
  )
}

export default Home

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function Paywall({ onAccessGranted, monthlyPriceId, annualPriceId }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)

  const handleCheckout = async (priceId) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.createCheckout(priceId)
      if (result.success) {
        window.location.href = result.data.url
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePromo = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await api.redeemPromoCode(promoCode)
      if (result.success) {
        onAccessGranted()
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">ShopRight</h1>
      <p className="text-gray-500 mb-8">Your free trial has ended. Subscribe to continue.</p>

      {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-md max-w-sm w-full">{error}</p>}

      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => handleCheckout(monthlyPriceId)}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Subscribe Monthly — $10/mo
        </button>
        <button
          onClick={() => handleCheckout(annualPriceId)}
          disabled={loading}
          className="w-full bg-green-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          Subscribe Annually — $100/yr (save $20)
        </button>

        {!showPromo ? (
          <button
            onClick={() => setShowPromo(true)}
            className="w-full text-gray-500 text-sm py-2 hover:text-gray-700"
          >
            Have a promo code?
          </button>
        ) : (
          <form onSubmit={handlePromo} className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter code"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loading || !promoCode.trim()}
              className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 disabled:opacity-50"
            >
              Redeem
            </button>
          </form>
        )}

        <div className="text-center pt-4 space-y-2">
          <p className="text-xs text-gray-400">Your data is still here — subscribe to pick up where you left off.</p>
          <button
            onClick={() => navigate('/settings')}
            className="text-sm text-blue-600 hover:underline"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default Paywall

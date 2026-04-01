import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'
import api from '../services/api'

function Signup() {
  const [step, setStep] = useState(1)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  // Step 1 — credentials
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2 — profile
  const [fullName, setFullName] = useState('')
  const [reportEmail, setReportEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [mileageRate, setMileageRate] = useState('0.700')
  const [invoiceNumberStart, setInvoiceNumberStart] = useState('1')

  // Step 3 — API key
  const [wantsAi, setWantsAi] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [keyTested, setKeyTested] = useState(false)
  const [keyValid, setKeyValid] = useState(false)

  const { signUp } = useAuth()

  const handleStep1 = async (e) => {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const data = await signUp(email, password)
      // With email confirmation disabled, signUp auto-creates a session.
      // If it didn't (e.g. confirmation required), fall back to signIn.
      if (!data.session) {
        await signIn(email, password)
      }
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStep2 = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.updateProfile({
        full_name: fullName,
        report_email: reportEmail || email,
        phone,
        home_address: homeAddress,
        mileage_rate: parseFloat(mileageRate),
        invoice_number_start: parseInt(invoiceNumberStart),
        next_invoice_number: parseInt(invoiceNumberStart),
      })
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTestKey = async () => {
    setError(null)
    setLoading(true)
    try {
      const result = await api.testApiKey(apiKey)
      if (result.success) {
        setKeyTested(true)
        setKeyValid(true)
      } else {
        setError(result.error)
        setKeyTested(true)
        setKeyValid(false)
      }
    } catch (err) {
      setError(err.message)
      setKeyTested(true)
      setKeyValid(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveKey = async () => {
    setLoading(true)
    try {
      await api.updateProfile({
        anthropic_api_key: apiKey,
        ai_review_enabled: true,
      })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkipAi = async () => {
    setLoading(true)
    try {
      await api.updateProfile({ ai_review_enabled: false })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-1">ShopRight</h1>
      <p className="text-gray-500 mb-2">Create your account</p>
      <p className="text-sm text-gray-400 mb-6">Step {step} of 3</p>

      <div className="bg-white rounded-lg shadow p-6 w-full max-w-sm">
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Step 1 — Email + Password */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Next'}
            </button>
            <p className="text-sm text-center text-gray-500">
              Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
            </p>
          </form>
        )}

        {/* Step 2 — Profile */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email for Reports</label>
              <input
                type="email"
                value={reportEmail}
                onChange={(e) => setReportEmail(e.target.value)}
                placeholder={email}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Where Shop Files and Invoices are sent. Defaults to your login email.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Home Address</label>
              <input
                type="text"
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
                placeholder="Used for mileage calculations"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mileage Rate ($/mile)</label>
              <input
                type="number"
                step="0.001"
                value={mileageRate}
                onChange={(e) => setMileageRate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">2025 IRS rate: $0.70/mile</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Starting Invoice Number</label>
              <input
                type="number"
                min="1"
                value={invoiceNumberStart}
                onChange={(e) => setInvoiceNumberStart(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Next'}
            </button>
          </form>
        )}

        {/* Step 3 — AI Review Setup */}
        {step === 3 && wantsAi === null && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">AI Review Setup</h2>
            <p className="text-sm text-gray-600">
              ShopRight can review your visit notes before submission using AI, flagging anything
              unclear or contradictory. This uses your own Anthropic API key — typical cost is $1–3/month.
            </p>
            <button
              onClick={() => setWantsAi(true)}
              className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Yes, set up AI review
            </button>
            <button
              onClick={handleSkipAi}
              disabled={loading}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Skip for now'}
            </button>
            <p className="text-xs text-gray-400 text-center">You can enable this later in Settings.</p>
          </div>
        )}

        {step === 3 && wantsAi === true && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Connect Your Anthropic API Key</h2>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Go to <span className="font-medium">console.anthropic.com</span></li>
              <li>Create an account or sign in</li>
              <li>Go to <span className="font-medium">API Keys</span> in the left sidebar</li>
              <li>Click <span className="font-medium">Create Key</span>, name it "ShopRight"</li>
              <li>Copy the key and paste it below</li>
            </ol>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyTested(false) }}
                placeholder="sk-ant-..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {keyTested && keyValid && (
              <p className="text-green-600 text-sm font-medium">API key is valid!</p>
            )}

            {!keyTested || !keyValid ? (
              <button
                onClick={handleTestKey}
                disabled={loading || !apiKey}
                className="w-full bg-gray-100 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Test Connection'}
              </button>
            ) : (
              <button
                onClick={handleSaveKey}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            )}

            <button
              onClick={() => { setWantsAi(null); setApiKey(''); setKeyTested(false) }}
              className="w-full text-gray-500 text-sm hover:underline"
            >
              Go back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Signup

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'
import { supabase } from '../services/supabase'
import api from '../services/api'
import PageHeader from '../components/PageHeader'

function SubscriptionSection() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSubscriptionStatus()
      .then((r) => setStatus(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleManage = async () => {
    try {
      const result = await api.createPortalSession()
      if (result.success) window.location.href = result.data.url
    } catch (e) {}
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>
  if (!status) return null

  if (status.reason === 'free_account') {
    return <p className="text-sm text-green-600">Free account — no subscription required</p>
  }
  if (status.reason === 'subscribed') {
    return (
      <div>
        <p className="text-sm text-green-600 mb-2">Active subscription</p>
        <button onClick={handleManage}
          className="px-4 py-2 bg-gray-50 text-gray-700 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">
          Manage Subscription
        </button>
      </div>
    )
  }
  if (status.reason === 'trial') {
    const endDate = new Date(status.trial_ends_at).toLocaleDateString()
    return <p className="text-sm text-blue-600">Free trial — expires {endDate}</p>
  }
  return <p className="text-sm text-red-600">Subscription expired</p>
}

function Settings() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isFreeAccount, setIsFreeAccount] = useState(false)

  // Store Directory refresh
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState(null)
  const [refreshError, setRefreshError] = useState(null)

  // AI Review
  const [aiEnabled, setAiEnabled] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [keyTested, setKeyTested] = useState(false)
  const [keyValid, setKeyValid] = useState(false)
  const [testingKey, setTestingKey] = useState(false)

  // Invoice Period
  const [invoiceStartDay, setInvoiceStartDay] = useState(1)
  const [invoiceEndDay, setInvoiceEndDay] = useState(1)

  // Mileage and Invoice
  const [mileageRate, setMileageRate] = useState('0.725')
  const [invoiceNumberStart, setInvoiceNumberStart] = useState('1')

  useEffect(() => {
    api.getProfile().then((result) => {
      const p = result.data
      setAiEnabled(p.ai_review_enabled || false)
      setHasApiKey(!!p.anthropic_api_key)
      setInvoiceStartDay(p.invoice_start_day || 1)
      setInvoiceEndDay(p.invoice_end_day || 1)
      setMileageRate(p.mileage_rate?.toString() || '0.725')
      setInvoiceNumberStart(p.invoice_number_start?.toString() || '1')
      setIsFreeAccount(p.is_free_account || false)
    }).catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const handleTestKey = async () => {
    setError(null)
    setTestingKey(true)
    try {
      const result = await api.testApiKey(apiKey)
      setKeyTested(true)
      setKeyValid(result.success)
      if (!result.success) setError(result.error)
    } catch (err) {
      setError(err.message)
      setKeyTested(true)
      setKeyValid(false)
    } finally {
      setTestingKey(false)
    }
  }

  const handleSaveKey = async () => {
    setSaving(true)
    try {
      await api.updateProfile({ anthropic_api_key: apiKey, ai_review_enabled: true })
      setAiEnabled(true)
      setHasApiKey(true)
      setShowKeyInput(false)
      setApiKey('')
      setKeyTested(false)
      setSuccess('API key saved and AI review enabled')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleDisableAi = async () => {
    setSaving(true)
    try {
      await api.updateProfile({ ai_review_enabled: false })
      setAiEnabled(false)
      setSuccess('AI review disabled')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleEnableAi = async () => {
    if (!hasApiKey) { setShowKeyInput(true); return }
    setSaving(true)
    try {
      await api.updateProfile({ ai_review_enabled: true })
      setAiEnabled(true)
      setSuccess('AI review enabled')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setSuccess('Password updated')
      setShowPasswordChange(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) { setError(err.message) }
    finally { setPasswordSaving(false) }
  }

  const handleSaveInvoicePeriod = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await api.updateProfile({ invoice_start_day: invoiceStartDay, invoice_end_day: invoiceEndDay })
      setSuccess('Invoice period updated')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleSaveInvoiceSettings = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await api.updateProfile({ mileage_rate: parseFloat(mileageRate), invoice_number_start: parseInt(invoiceNumberStart) })
      setSuccess('Invoice settings updated')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Settings" />

      <div className="max-w-lg mx-auto px-4 py-4 pb-8 space-y-4">
        {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
        {success && <p className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</p>}

        {/* Subscription */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Subscription</h2>
          <SubscriptionSection />
        </div>

        {/* AI Review */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">AI Review</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">{aiEnabled ? 'Enabled' : 'Disabled'}</p>
              {hasApiKey && <p className="text-xs text-gray-400">API key configured</p>}
            </div>
            {aiEnabled ? (
              <button onClick={handleDisableAi} disabled={saving}
                className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-md border border-red-200 hover:bg-red-100">Disable</button>
            ) : (
              <button onClick={handleEnableAi} disabled={saving}
                className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-md border border-blue-200 hover:bg-blue-100">Enable</button>
            )}
          </div>

          {showKeyInput && (
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-700 mb-2">How to get your API key:</p>
                <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Go to <span className="font-medium">console.anthropic.com</span></li>
                  <li>Create an account or sign in</li>
                  <li>Click <span className="font-medium">API Keys</span> in the left sidebar</li>
                  <li>Click <span className="font-medium">Create Key</span>, name it "ShopRight"</li>
                  <li>Copy the key and paste it below</li>
                </ol>
                <p className="text-xs text-gray-400 mt-2">You'll need to add credits ($5 minimum). Typical cost: $1–3/month.</p>
              </div>
              <input type="password" value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyTested(false) }}
                placeholder="sk-ant-..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {keyTested && keyValid && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-700 text-sm font-medium">API key is valid!</p>
                  <p className="text-green-600 text-xs mt-1">Click "Save API Key" below to finish.</p>
                </div>
              )}
              {!keyTested || !keyValid ? (
                <button onClick={handleTestKey} disabled={testingKey || !apiKey}
                  className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                  {testingKey ? 'Testing...' : 'Step 1: Test Connection'}
                </button>
              ) : (
                <button onClick={handleSaveKey} disabled={saving}
                  className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Step 2: Save API Key'}
                </button>
              )}
            </div>
          )}
          {hasApiKey && !showKeyInput && (
            <button onClick={() => setShowKeyInput(true)}
              className="text-xs text-gray-500 hover:underline">Update API key</button>
          )}
        </div>

        {/* Invoice Period */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Invoice Period</h2>
          <p className="text-xs text-gray-500">Set your billing cycle (e.g., 10th to 10th). Default is calendar month (1st to 1st).</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Day</label>
              <input type="number" min="1" max="31" value={invoiceStartDay}
                onChange={(e) => setInvoiceStartDay(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Day</label>
              <input type="number" min="1" max="31" value={invoiceEndDay}
                onChange={(e) => setInvoiceEndDay(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <button onClick={handleSaveInvoicePeriod} disabled={saving}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Invoice Period'}
          </button>
        </div>

        {/* Invoice Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Invoice Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mileage Rate ($/mile)</label>
              <input type="number" step="0.001" value={mileageRate}
                onChange={(e) => setMileageRate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">2025 IRS rate: $0.725/mile</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Starting Invoice Number</label>
              <input type="number" min="1" value={invoiceNumberStart}
                onChange={(e) => setInvoiceNumberStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <button onClick={handleSaveInvoiceSettings} disabled={saving}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Invoice Settings'}
          </button>
        </div>

        {/* Password */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Password</h2>
          {!showPasswordChange ? (
            <button onClick={() => setShowPasswordChange(true)}
              className="px-4 py-2 bg-gray-50 text-gray-700 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">
              Change Password
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" disabled={passwordSaving}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {passwordSaving ? 'Updating...' : 'Update Password'}
              </button>
              <button type="button" onClick={() => { setShowPasswordChange(false); setNewPassword(''); setConfirmPassword('') }}
                className="w-full text-gray-500 text-sm hover:underline">Cancel</button>
            </form>
          )}
        </div>

        {/* Store Directory — admin only */}
        {isFreeAccount && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Store Directory</h2>
            <p className="text-xs text-gray-500">After updating Book1.xlsx on Dropbox, tap below to sync new stores — including addresses and coordinates — to the app.</p>
            {refreshResult !== null && (
              <p className="text-xs text-green-600 bg-green-50 rounded p-2">
                {refreshResult?.total != null
                  ? `Sync complete — ${refreshResult.total} stores loaded, ${refreshResult.geocoded} newly geocoded.${refreshResult.failed?.length > 0 ? ` Could not geocode: ${refreshResult.failed.join(', ')}.` : ''}`
                  : 'Sync complete — store directory updated.'}
              </p>
            )}
            {refreshError && <p className="text-xs text-red-600 bg-red-50 rounded p-2">{refreshError}</p>}
            <button
              onClick={async () => {
                setRefreshing(true)
                setRefreshResult(null)
                setRefreshError(null)
                try {
                  await api.refreshStoreDirectory()
                  // Poll for completion
                  const poll = setInterval(async () => {
                    try {
                      const s = await api.ingestStatus()
                      if (!s.data.running) {
                        clearInterval(poll)
                        setRefreshing(false)
                        if (s.data.error) setRefreshError(`Sync failed: ${s.data.error}`)
                        else setRefreshResult(s.data.result)
                      }
                    } catch (e) { clearInterval(poll); setRefreshing(false); setRefreshError(`Sync failed: ${e.message}`) }
                  }, 3000)
                } catch (e) {
                  setRefreshing(false)
                  setRefreshError(`Sync failed: ${e.message || 'Unknown error'}`)
                }
              }}
              disabled={refreshing}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {refreshing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Syncing… this may take a minute
                </span>
              ) : 'Sync Store Directory'}
            </button>
          </div>
        )}

        {/* Help Guide */}
        <button onClick={() => navigate('/help')}
          className="w-full bg-white text-gray-700 py-3 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 shadow-sm mb-4">
          Help Guide
        </button>

        <button onClick={() => navigate('/tutorial')}
          className="w-full bg-white text-gray-700 py-3 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 shadow-sm mb-4">
          Getting Started Tutorial
        </button>

        {/* Sign Out */}
        <button onClick={handleSignOut}
          className="w-full bg-red-50 text-red-600 py-3 rounded-xl text-sm font-medium border border-red-200 hover:bg-red-100">
          Sign Out
        </button>
      </div>

    </div>
  )
}

export default Settings

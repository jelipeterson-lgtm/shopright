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

function GoogleMapsKeySection() {
  const [hasKey, setHasKey] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [mapsKey, setMapsKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    api.getProfile().then((r) => {
      setHasKey(!!r.data?.google_maps_api_key)
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateProfile({ google_maps_api_key: mapsKey })
      setHasKey(true)
      setShowInput(false)
      setMapsKey('')
      setSuccess('Google Maps API key saved')
    } catch (e) {}
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">{hasKey ? 'API key configured' : 'Not configured'}</p>
      {!showInput ? (
        <button onClick={() => setShowInput(true)}
          className="px-4 py-2 bg-gray-50 text-gray-700 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">
          {hasKey ? 'Update API Key' : 'Add API Key'}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">How to get your Google Maps API key:</p>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>Go to <span className="font-medium">console.cloud.google.com</span></li>
              <li>Create a project (or select existing)</li>
              <li>Go to <span className="font-medium">APIs & Services {'>'} Library</span></li>
              <li>Search for and enable <span className="font-medium">"Distance Matrix API"</span></li>
              <li>Go to <span className="font-medium">APIs & Services {'>'} Credentials</span></li>
              <li>Create an API Key (or use existing)</li>
              <li>Click the key and under <span className="font-medium">API restrictions</span>, add <span className="font-medium">"Distance Matrix API"</span> to the allowed list (or select "Don't restrict key")</li>
              <li>Under <span className="font-medium">Application restrictions</span>, select <span className="font-medium">"None"</span> or <span className="font-medium">"IP addresses"</span></li>
              <li>Save and paste the key below (may take up to 5 minutes to activate)</li>
            </ol>
          </div>
          <input type="password" value={mapsKey} onChange={(e) => setMapsKey(e.target.value)}
            placeholder="AIza..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
          <button onClick={handleSave} disabled={saving || !mapsKey}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save API Key'}
          </button>
          <button onClick={() => { setShowInput(false); setMapsKey('') }}
            className="w-full text-gray-500 text-sm hover:underline">Cancel</button>
        </div>
      )}
      {success && <p className="text-green-600 text-sm">{success}</p>}
    </div>
  )
}

function Settings() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // AI Review
  const [aiEnabled, setAiEnabled] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [keyTested, setKeyTested] = useState(false)
  const [keyValid, setKeyValid] = useState(false)
  const [testingKey, setTestingKey] = useState(false)

  // Password
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    api.getProfile().then((result) => {
      const p = result.data
      setAiEnabled(p.ai_review_enabled || false)
      setHasApiKey(!!p.anthropic_api_key)
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

        {/* Google Maps API Key */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Route Planner (Google Maps)</h2>
          <GoogleMapsKeySection />
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

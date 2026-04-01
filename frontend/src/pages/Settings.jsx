import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/AuthContext'
import { supabase } from '../services/supabase'
import api from '../services/api'

function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [fullName, setFullName] = useState('')
  const [reportEmail, setReportEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [mileageRate, setMileageRate] = useState('')
  const [invoiceNumberStart, setInvoiceNumberStart] = useState('')
  const [aiEnabled, setAiEnabled] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)

  // API key section
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [keyTested, setKeyTested] = useState(false)
  const [keyValid, setKeyValid] = useState(false)
  const [testingKey, setTestingKey] = useState(false)

  // Password section
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const result = await api.getProfile()
      const p = result.data
      setFullName(p.full_name || '')
      setReportEmail(p.report_email || '')
      setPhone(p.phone || '')
      setHomeAddress(p.home_address || '')
      setMileageRate(p.mileage_rate?.toString() || '0.700')
      setInvoiceNumberStart(p.invoice_number_start?.toString() || '1')
      setAiEnabled(p.ai_review_enabled || false)
      setHasApiKey(!!p.anthropic_api_key)
    } catch (err) {
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
      await api.updateProfile({
        full_name: fullName,
        report_email: reportEmail,
        phone,
        home_address: homeAddress,
        mileage_rate: parseFloat(mileageRate),
        invoice_number_start: parseInt(invoiceNumberStart),
      })
      setSuccess('Profile saved')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

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
      await api.updateProfile({
        anthropic_api_key: apiKey,
        ai_review_enabled: true,
      })
      setAiEnabled(true)
      setHasApiKey(true)
      setShowKeyInput(false)
      setApiKey('')
      setKeyTested(false)
      setSuccess('API key saved and AI review enabled')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDisableAi = async () => {
    setSaving(true)
    try {
      await api.updateProfile({ ai_review_enabled: false })
      setAiEnabled(false)
      setSuccess('AI review disabled')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEnableAi = async () => {
    if (!hasApiKey) {
      setShowKeyInput(true)
      return
    }
    setSaving(true)
    try {
      await api.updateProfile({ ai_review_enabled: true })
      setAiEnabled(true)
      setSuccess('AI review enabled')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setSuccess('Password updated')
      setShowPasswordChange(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <button onClick={() => navigate('/')} className="text-blue-600 text-sm hover:underline">Back</button>
        </div>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-md">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 p-3 rounded-md">{success}</p>}

        {/* Profile Section */}
        <form onSubmit={handleSaveProfile} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Profile</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email for Reports</label>
            <input type="email" value={reportEmail} onChange={(e) => setReportEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Home Address</label>
            <input type="text" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mileage Rate ($/mile)</label>
            <input type="number" step="0.001" value={mileageRate} onChange={(e) => setMileageRate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Starting Invoice Number</label>
            <input type="number" min="1" value={invoiceNumberStart} onChange={(e) => setInvoiceNumberStart(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        {/* AI Review Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">AI Review</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Status: {aiEnabled ? 'Enabled' : 'Disabled'}</p>
              {hasApiKey && <p className="text-xs text-gray-400">API key configured</p>}
            </div>
            {aiEnabled ? (
              <button onClick={handleDisableAi} disabled={saving}
                className="text-sm text-red-600 hover:underline disabled:opacity-50">Disable</button>
            ) : (
              <button onClick={handleEnableAi} disabled={saving}
                className="text-sm text-blue-600 hover:underline disabled:opacity-50">Enable</button>
            )}
          </div>

          {showKeyInput && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs font-medium text-gray-700 mb-2">How to get your API key:</p>
                <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Go to <span className="font-medium">console.anthropic.com</span></li>
                  <li>Create an account or sign in</li>
                  <li>Click <span className="font-medium">API Keys</span> in the left sidebar</li>
                  <li>Click <span className="font-medium">Create Key</span>, name it "ShopRight"</li>
                  <li>Copy the key and paste it below</li>
                </ol>
                <p className="text-xs text-gray-400 mt-2">You'll need to add credits to your Anthropic account (minimum $5). Typical cost: $1–3/month.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input type="password" value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setKeyTested(false) }}
                  placeholder="sk-ant-..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {keyTested && keyValid && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-green-700 text-sm font-medium">API key is valid!</p>
                  <p className="text-green-600 text-xs mt-1">Click "Save API Key" below to finish setup.</p>
                </div>
              )}
              {!keyTested || !keyValid ? (
                <button onClick={handleTestKey} disabled={testingKey || !apiKey}
                  className="w-full bg-gray-100 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                  {testingKey ? 'Testing...' : 'Step 1: Test Connection'}
                </button>
              ) : (
                <button onClick={handleSaveKey} disabled={saving}
                  className="w-full bg-green-600 text-white py-2.5 rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Step 2: Save API Key'}
                </button>
              )}
            </div>
          )}

          {hasApiKey && !showKeyInput && (
            <button onClick={() => setShowKeyInput(true)}
              className="text-sm text-gray-500 hover:underline">Update API key</button>
          )}
        </div>

        {/* Password Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Password</h2>
          {!showPasswordChange ? (
            <button onClick={() => setShowPasswordChange(true)}
              className="text-sm text-blue-600 hover:underline">Change password</button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={passwordSaving}
                className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {passwordSaving ? 'Updating...' : 'Update Password'}
              </button>
              <button type="button" onClick={() => { setShowPasswordChange(false); setNewPassword(''); setConfirmPassword('') }}
                className="w-full text-gray-500 text-sm hover:underline">Cancel</button>
            </form>
          )}
        </div>

        {/* Sign Out */}
        <button onClick={handleSignOut}
          className="w-full bg-red-50 text-red-600 py-3 rounded-lg text-sm font-medium hover:bg-red-100">
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default Settings

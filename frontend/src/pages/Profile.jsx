import { useState, useEffect } from 'react'
import { useAuth } from '../services/AuthContext'
import api from '../services/api'
import PageHeader from '../components/PageHeader'

function Profile() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [fullName, setFullName] = useState('')
  const [reportEmail, setReportEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [billingAddressSameAsHome, setBillingAddressSameAsHome] = useState(true)
  const [billingAddress, setBillingAddress] = useState('')
  const [mileageRate, setMileageRate] = useState('')
  const [invoiceNumberStart, setInvoiceNumberStart] = useState('')

  useEffect(() => {
    api.getProfile().then((result) => {
      const p = result.data
      setFullName(p.full_name || '')
      setReportEmail(p.report_email || '')
      setPhone(p.phone || '')
      setHomeAddress(p.home_address || '')
      if (p.billing_address) {
        setBillingAddressSameAsHome(false)
        setBillingAddress(p.billing_address)
      }
      setMileageRate(p.mileage_rate?.toString() || '0.700')
      setInvoiceNumberStart(p.invoice_number_start?.toString() || '1')
    }).catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
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
        billing_address: billingAddressSameAsHome ? '' : billingAddress,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Profile" />

      <div className="max-w-lg mx-auto px-4 py-4">
        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-md">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 p-3 rounded-md">{success}</p>}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <p className="text-xs text-gray-400">Account email</p>
          <p className="text-sm text-gray-700">{user?.email}</p>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email for Reports</label>
            <input type="email" value={reportEmail} onChange={(e) => setReportEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Where Shop Files and Invoices are sent</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Home Address</label>
            <input type="text" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input type="checkbox" checked={billingAddressSameAsHome}
                onChange={(e) => setBillingAddressSameAsHome(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-600">Same as home address</span>
            </label>
            {!billingAddressSameAsHome && (
              <input type="text" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Billing address for monthly invoice"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            <p className="text-xs text-gray-400 mt-1">Used on Monthly Invoice reports</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mileage Rate ($/mile)</label>
            <input type="number" step="0.001" value={mileageRate} onChange={(e) => setMileageRate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">2025 IRS rate: $0.70/mile</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Starting Invoice Number</label>
            <input type="number" min="1" value={invoiceNumberStart} onChange={(e) => setInvoiceNumberStart(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

    </div>
  )
}

export default Profile

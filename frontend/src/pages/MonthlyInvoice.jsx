import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import PageHeader from '../components/PageHeader'

function MonthlyInvoice() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [visits, setVisits] = useState([])
  const [mileage, setMileage] = useState({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [recipientEmail, setRecipientEmail] = useState('')

  useEffect(() => {
    loadData()
  }, [year, month])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Get all complete visits for the month
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endMonth = month === 12 ? 1 : month + 1
      const endYear = month === 12 ? year + 1 : year
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

      const result = await api.getVisits({ status: 'Complete' })
      const monthVisits = result.data.filter(
        (v) => v.visit_date >= startDate && v.visit_date < endDate
      )
      setVisits(monthVisits)

      const profile = await api.getProfile()
      setRecipientEmail(profile.data.report_email || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMileageChange = (date, miles) => {
    setMileage((prev) => ({ ...prev, [date]: miles }))
  }

  const getMileageEntries = () => {
    return Object.entries(mileage)
      .filter(([_, miles]) => miles > 0)
      .map(([date, miles]) => ({ date, miles: parseFloat(miles) }))
  }

  const handleDownload = async () => {
    setGenerating(true)
    setError(null)
    try {
      const result = await api.generateInvoice({
        year, month,
        mileage_entries: getMileageEntries(),
      })
      // generateInvoice returns a StreamingResponse, handle as blob
      // Actually this goes through our request() which expects JSON...
      // Need to handle differently for file download
      setError('Use Send Invoice to email the file. Direct download coming soon.')
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!recipientEmail) {
      setError('Recipient email required')
      return
    }
    setSending(true)
    setError(null)
    try {
      const result = await api.sendInvoice({
        year, month,
        mileage_entries: getMileageEntries(),
        recipient_email: recipientEmail,
      })
      if (result.success) {
        setSuccess(`Invoice sent to ${recipientEmail}`)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  // Group visits by date
  const byDate = {}
  for (const v of visits) {
    if (!byDate[v.visit_date]) byDate[v.visit_date] = []
    byDate[v.visit_date].push(v)
  }
  const sortedDates = Object.keys(byDate).sort()

  // Calculate pricing
  const calculateTotal = () => {
    let vendorTotal = 0
    const stops = {}
    for (const v of visits) {
      const key = `${v.visit_date}|${v.store_number}|${v.retailer_name}`
      if (!stops[key]) stops[key] = 0
      stops[key]++
      vendorTotal += stops[key] === 1 ? 50 : 15
    }

    let mileageTotal = 0
    for (const [_, miles] of Object.entries(mileage)) {
      if (miles > 0) mileageTotal += parseFloat(miles) * 0.70
    }

    return { vendorTotal, mileageTotal, total: vendorTotal + mileageTotal }
  }

  const totals = calculateTotal()

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const formatDate = (d) => {
    if (!d) return ''
    const parts = d.split('-')
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`
    return d
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <PageHeader title="Monthly Invoice" size="small" />
          <button onClick={() => navigate('/app')} className="text-blue-600 text-sm hover:underline">Home</button>
        </div>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-md">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 p-3 rounded-md">{success}</p>}

        {/* Month selector */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Year</label>
            <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Month</label>
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {monthNames.slice(1).map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
        ) : visits.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-400 text-sm">No complete visits for {monthNames[month]} {year}</p>
          </div>
        ) : (
          <>
            {/* Mileage entries by shopping day */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Mileage by Shopping Day</h2>
              <div className="space-y-2">
                {sortedDates.map((date) => (
                  <div key={date} className="flex items-center gap-3">
                    <p className="text-sm text-gray-700 w-28">{formatDate(date)}</p>
                    <input
                      type="number"
                      min="0"
                      value={mileage[date] || ''}
                      onChange={(e) => handleMileageChange(date, e.target.value)}
                      placeholder="Miles"
                      className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                    />
                    <p className="text-xs text-gray-400 w-12">{byDate[date].length} visit{byDate[date].length !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Visit summary */}
            {sortedDates.map((date) => (
              <div key={date} className="bg-white rounded-lg shadow mb-3 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-700">{formatDate(date)}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {byDate[date].map((v) => (
                    <div key={v.id} className="px-4 py-2">
                      <p className="text-sm text-gray-800">{v.retailer_name} #{v.store_number}</p>
                      <p className="text-xs text-gray-400">{v.program}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Summary</h2>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Vendor visits ({visits.length})</span>
                  <span className="text-gray-800">${totals.vendorTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mileage</span>
                  <span className="text-gray-800">${totals.mileageTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t border-gray-100">
                  <span className="text-gray-700">Total</span>
                  <span className="text-gray-900">${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Send */}
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Send to</label>
                <input type="email" value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="recipient@email.com"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <button onClick={handleSend} disabled={sending}
                className="w-full bg-green-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {sending ? 'Sending...' : 'Generate & Send Invoice'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default MonthlyInvoice

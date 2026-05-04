import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { supabase } from '../services/supabase'
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
  const [error, setError] = useState(null)
  const [mileageRate, setMileageRate] = useState(0.725)
  const [invoiceStartDay, setInvoiceStartDay] = useState(1)
  const [invoiceEndDay, setInvoiceEndDay] = useState(1)

  useEffect(() => {
    loadData()
  }, [year, month])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const profile = await api.getProfile()
      if (profile.data.mileage_rate) setMileageRate(parseFloat(profile.data.mileage_rate))
      const startDay = profile.data.invoice_start_day || 1
      const endDay = profile.data.invoice_end_day || 1
      setInvoiceStartDay(startDay)
      setInvoiceEndDay(endDay)

      // Use local vars — state updates above are async and not yet reflected here
      // Use local date to avoid UTC shift flipping the date after 5 PM
      const toLocalStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const startStr = toLocalStr(new Date(year, month - 1, startDay))
      const endStr = toLocalStr(new Date(year, month, endDay))  // JS wraps month 12 → Jan next year

      const result = await api.getVisits({ status: 'Complete' })
      const periodVisits = result.data.filter(
        (v) => v.visit_date >= startStr && v.visit_date < endStr
      )
      setVisits(periodVisits)
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
      const { data: { session } } = await supabase.auth.getSession()
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiBase}/reports/generate/invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ year, month, mileage_entries: getMileageEntries() }),
      })
      if (!res.ok) throw new Error('Download failed')
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const json = await res.json()
        throw new Error(json.error || 'Invoice generation failed')
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="(.+)"/)
      a.download = match ? match[1] : `Invoice ${monthNames[month]} ${year}.xlsx`
      a.click()
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
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
      if (miles > 0) mileageTotal += parseFloat(miles) * mileageRate
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
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Monthly Invoice" rightButton={<button onClick={() => navigate('/app')} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 active:bg-gray-200 shadow-sm">Home</button>} />
      <div className="max-w-lg mx-auto px-4 py-4">

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-md">{error}</p>}

        {/* Period selector */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Year</label>
            <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Period</label>
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {monthNames.slice(1).map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Period dates */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-700">
            Invoice period: {new Date(year, month - 1, invoiceStartDay).toLocaleDateString()} to {new Date(month === 12 ? year + 1 : year, month === 12 ? 0 : month, invoiceEndDay).toLocaleDateString()}
          </p>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
        ) : visits.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-400 text-sm">No completed vendors for this period</p>
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
                  <span className="text-gray-500">Vendors ({visits.length})</span>
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

            <button onClick={handleDownload} disabled={generating}
              className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {generating ? 'Generating...' : 'Download Invoice'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default MonthlyInvoice

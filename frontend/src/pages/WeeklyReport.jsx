import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getLocalDate } from '../services/api'
import { supabase } from '../services/supabase'
import PageHeader from '../components/PageHeader'

function getISOWeekNumber(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return { year: d.getFullYear(), week: Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7) + 1 }
}

function WeeklyReport() {
  const navigate = useNavigate()
  const now = new Date()
  const { year: defaultYear, week: defaultWeek } = getISOWeekNumber(now)

  const [year, setYear] = useState(defaultYear)
  const [week, setWeek] = useState(defaultWeek)
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [signedOff, setSignedOff] = useState(false)

  useEffect(() => {
    loadVisits()
    loadProfile()
  }, [year, week])

  const loadProfile = async () => {
    try {
      const result = await api.getProfile()
      setRecipientEmail(result.data.report_email || '')
    } catch (e) {}
  }

  const loadVisits = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getWeeklyVisits(year, week)
      setVisits(result.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const url = api.generateShopFile(year, week)
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="(.+)"/)
      a.download = match ? match[1] : `Shop File ${year}-W${week}.xlsx`
      a.click()
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading(false)
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
      const result = await api.sendShopFile({ year, week, recipient_email: recipientEmail })
      if (result.success) {
        setSuccess(`Shop File sent to ${recipientEmail}`)
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

  const formatDate = (d) => {
    if (!d) return ''
    const parts = d.split('-')
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`
    return d
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Weekly Report" rightButton={<button onClick={() => navigate('/app')} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 active:bg-gray-200 shadow-sm">Home</button>} />
      <div className="max-w-lg mx-auto px-4 py-4">

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-md">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 p-3 rounded-md">{success}</p>}

        {/* Week selector */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Year</label>
            <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">ISO Week</label>
            <input type="number" min="1" max="53" value={week} onChange={(e) => setWeek(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm text-center py-8">Loading visits...</p>
        ) : visits.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-400 text-sm">No complete visits for this week</p>
          </div>
        ) : (
          <>
            {/* Review/Edit toggle */}
            <div className="flex gap-2 mb-3">
              <button onClick={() => setReviewMode(false)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium ${!reviewMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                Summary
              </button>
              <button onClick={() => setReviewMode(true)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium ${reviewMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                Review & Edit
              </button>
            </div>

            {!reviewMode ? (
              <>
                {/* Summary view */}
                {sortedDates.map((date) => (
                  <div key={date} className="bg-white rounded-lg shadow mb-3 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-700">{formatDate(date)}</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {byDate[date].map((v) => (
                        <div key={v.id} className="px-4 py-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-800">{v.retailer_name} #{v.store_number}</p>
                            <p className="text-xs text-gray-400">{v.program} — {v.visit_time}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => navigate(`/visit/${v.id}`)}
                              className="text-xs text-blue-600 hover:underline">Review</button>
                            <button onClick={async () => {
                              if (!confirm(`Delete ${v.retailer_name} #${v.store_number} — ${v.program}?`)) return
                              await api.discardVisit(v.id)
                              setVisits(prev => prev.filter(x => x.id !== v.id))
                            }} className="text-xs text-red-500 hover:underline">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {/* Review & Edit view — editable fields per visit */}
                {sortedDates.map((date) => (
                  <div key={date} className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">{formatDate(date)}</p>
                    {byDate[date].map((v) => (
                      <div key={v.id} className="bg-white rounded-lg shadow mb-2 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-900">{v.retailer_name} #{v.store_number}</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => navigate(`/visit/${v.id}`)}
                              className="text-[10px] text-blue-600 hover:underline">Full Edit</button>
                            <button onClick={async () => {
                              if (!confirm(`Delete ${v.retailer_name} #${v.store_number} — ${v.program}?`)) return
                              await api.discardVisit(v.id)
                              setVisits(prev => prev.filter(x => x.id !== v.id))
                            }} className="text-[10px] text-red-500 hover:underline">Delete</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-gray-400">Program</label>
                            <p className="text-gray-800 font-medium">{v.program}</p>
                          </div>
                          <div>
                            <label className="text-gray-400">Reps Present</label>
                            <p className={`font-medium ${v.reps_present === 'Fail' ? 'text-red-600' : 'text-gray-800'}`}>{v.reps_present || '—'}</p>
                          </div>
                          <div>
                            <label className="text-gray-400">Date</label>
                            <input type="date" value={v.visit_date || ''} onChange={async (e) => {
                              await api.updateVisit(v.id, { visit_date: e.target.value, session_date: e.target.value })
                              setVisits(prev => prev.map(x => x.id === v.id ? { ...x, visit_date: e.target.value, session_date: e.target.value } : x))
                            }} className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs" />
                          </div>
                          <div>
                            <label className="text-gray-400">Time</label>
                            <input type="time" value={v.visit_time?.slice(0, 5) || ''} onChange={async (e) => {
                              await api.updateVisit(v.id, { visit_time: e.target.value })
                              setVisits(prev => prev.map(x => x.id === v.id ? { ...x, visit_time: e.target.value } : x))
                            }} className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs" />
                          </div>
                        </div>
                        {v.visit_recap && (
                          <div className="mt-2">
                            <label className="text-xs text-gray-400">Visit Recap</label>
                            <textarea value={v.visit_recap} rows={2} onChange={async (e) => {
                              const newRecap = e.target.value
                              setVisits(prev => prev.map(x => x.id === v.id ? { ...x, visit_recap: newRecap } : x))
                            }} onBlur={async (e) => {
                              await api.updateVisit(v.id, { visit_recap: e.target.value })
                            }} className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-0.5" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}

            <p className="text-sm text-gray-500 text-center mb-4">{visits.length} visit{visits.length !== 1 ? 's' : ''} this week</p>

            {/* Sign Off */}
            {!signedOff ? (
              <button onClick={() => setSignedOff(true)}
                className="w-full bg-green-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-green-700 mb-3">
                Sign Off — Ready for Report
              </button>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-center">
                <p className="text-green-700 text-sm font-medium">Signed off — ready to download or send</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button onClick={handleDownload} disabled={downloading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {downloading ? 'Generating...' : 'Download Shop File'}
              </button>

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
                  {sending ? 'Sending...' : 'Send Shop File'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default WeeklyReport

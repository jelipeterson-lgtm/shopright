import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

function Reports() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Reports" rightButton={<button onClick={() => navigate('/app')} className="px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-md border border-gray-300 hover:bg-gray-100 active:bg-gray-200 shadow-sm">Home</button>} />

      <div className="max-w-lg mx-auto px-6 py-4 space-y-3">
        <button
          onClick={() => navigate('/weekly-report')}
          className="w-full bg-white rounded-xl border border-gray-100 p-5 text-left hover:shadow-sm transition"
        >
          <p className="text-sm font-semibold text-gray-900">Weekly Shop File</p>
          <p className="text-xs text-gray-400 mt-1">Generate and send your weekly assessment report to Smart Circle</p>
        </button>

        <button
          onClick={() => navigate('/monthly-invoice')}
          className="w-full bg-white rounded-xl border border-gray-100 p-5 text-left hover:shadow-sm transition"
        >
          <p className="text-sm font-semibold text-gray-900">Monthly Invoice</p>
          <p className="text-xs text-gray-400 mt-1">Generate and send your monthly invoice with mileage and vendor pricing</p>
        </button>
      </div>
    </div>
  )
}

export default Reports

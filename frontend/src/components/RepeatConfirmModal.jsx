import { formatRepeatDate } from '../utils/repeatRule'

function RepeatConfirmModal({ repeat, onConfirm, onCancel }) {
  if (!repeat) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      role="dialog" aria-modal="true" aria-labelledby="repeat-confirm-title">
      <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-5">
        <p id="repeat-confirm-title" className="text-sm font-semibold text-gray-900 mb-2">
          Same vendor two weeks in a row
        </p>
        <p className="text-sm text-gray-600 mb-4">
          You completed an assessment for <span className="font-medium">{repeat.program}</span> at{' '}
          <span className="font-medium">{repeat.retailer_name} #{repeat.store_number}</span> last week
          ({formatRepeatDate(repeat.visit_date)}). Smart Circle doesn't allow the same vendor at the
          same store two weeks in a row. Add it anyway?
        </p>
        <div className="flex gap-2">
          <button onClick={onConfirm}
            className="flex-1 bg-amber-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-amber-600">
            Add anyway
          </button>
          <button onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-200">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default RepeatConfirmModal

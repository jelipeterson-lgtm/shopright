import { useState } from 'react'
import { formatRepeatDate } from '../utils/repeatRule'

// Small amber marker for a vendor also shopped at this store last week. Tap to explain.
// Rendered as a span (not a button) because it often sits inside a tappable row.
function RepeatIcon({ date }) {
  const [open, setOpen] = useState(false)
  const toggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(o => !o)
  }
  return (
    <span className="relative inline-flex items-center shrink-0">
      <span
        role="button"
        tabIndex={0}
        aria-label={`Also shopped last week (${formatRepeatDate(date)})`}
        data-testid="repeat-icon"
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e) }}
        className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center text-[10px] font-bold leading-none cursor-pointer"
      >
        ↻
      </span>
      {open && (
        // Floats below the icon so opening it never squeezes the vendor name.
        <span className="absolute left-0 top-full mt-1 z-20 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 shadow-sm whitespace-nowrap">
          Also shopped last week ({formatRepeatDate(date)})
        </span>
      )}
    </span>
  )
}

export default RepeatIcon

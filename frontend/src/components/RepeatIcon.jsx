import { useRef, useState } from 'react'
import { formatRepeatDate } from '../utils/repeatRule'

const TIP_WIDTH = 200
const EDGE = 8

// Small amber marker for a vendor also shopped at this store last week. Tap to explain.
// Rendered as a span (not a button) because it often sits inside a tappable row.
function RepeatIcon({ date }) {
  const iconRef = useRef(null)
  const [offset, setOffset] = useState(null)
  const toggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (offset !== null) return setOffset(null)
    // Shift the bubble left as needed so it stays on narrow phone screens.
    const iconLeft = iconRef.current.getBoundingClientRect().left
    const overflowRight = iconLeft + TIP_WIDTH - (window.innerWidth - EDGE)
    setOffset(Math.max(EDGE - iconLeft, -Math.max(0, overflowRight)))
  }
  return (
    <span className="relative inline-flex items-center shrink-0">
      <span
        ref={iconRef}
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
      {offset !== null && (
        // Floats below the icon so opening it never squeezes the vendor name.
        <span
          style={{ left: offset, maxWidth: `min(${TIP_WIDTH}px, calc(100vw - ${EDGE * 2}px))` }}
          className="absolute top-full mt-1 z-20 w-max text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 shadow-sm"
        >
          Also shopped last week ({formatRepeatDate(date)})
        </span>
      )}
    </span>
  )
}

export default RepeatIcon

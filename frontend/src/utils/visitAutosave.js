// Wait until the shopper pauses, then save the merged edits once.
// A PUT per keystroke is what exhausted the API's memory on shopping days.
export const AUTOSAVE_IDLE_MS = 2500
// A failed save (server restart, dropped connection) is kept and retried.
export const AUTOSAVE_RETRY_MS = 5000

// onChange(unsaved, failed) reports every edit the server hasn't confirmed yet,
// including one in flight, so the page can keep a copy on the phone.
export function createVisitAutosave({
  save,
  delay = AUTOSAVE_IDLE_MS,
  retryDelay = AUTOSAVE_RETRY_MS,
  onChange = () => {},
}) {
  let timer = null
  let pending = null
  let unsaved = {}
  let failed = false
  let chain = Promise.resolve(true)

  const notify = () => onChange({ ...unsaved }, failed)

  function arm(ms) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      flush()
    }, ms)
  }

  // Resolves true once everything sent so far is confirmed, false if a save failed.
  function flush(opts = {}) {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!pending) return chain.then(() => pending === null)
    const updates = pending
    pending = null
    chain = chain
      .then(() => save(updates, opts))
      .then(
        () => {
          for (const [k, v] of Object.entries(updates)) {
            if (unsaved[k] === v) delete unsaved[k]
          }
          failed = false
          notify()
          return true
        },
        () => {
          // Newer edits made while this save was in flight win over the failed ones.
          pending = { ...updates, ...pending }
          failed = true
          notify()
          if (!timer) arm(retryDelay)
          return false
        },
      )
    return chain
  }

  function schedule(updates) {
    unsaved = { ...unsaved, ...updates }
    pending = pending ? { ...pending, ...updates } : { ...updates }
    notify()
    arm(delay)
  }

  return { schedule, flush }
}

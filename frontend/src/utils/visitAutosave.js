// Wait until the shopper pauses, then save the merged edits once.
// A PUT per keystroke is what exhausted the API's memory on shopping days.
export const AUTOSAVE_IDLE_MS = 2500

export function createVisitAutosave({ save, delay = AUTOSAVE_IDLE_MS }) {
  let timer = null
  let pending = null
  let chain = Promise.resolve()

  function flush(opts = {}) {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!pending) return chain
    const updates = pending
    pending = null
    chain = chain
      .then(() => save(updates, opts))
      .catch(() => {})
    return chain
  }

  function schedule(updates) {
    pending = pending ? { ...pending, ...updates } : { ...updates }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      flush()
    }, delay)
  }

  return { schedule, flush }
}

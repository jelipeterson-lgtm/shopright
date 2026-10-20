import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createVisitAutosave, AUTOSAVE_IDLE_MS } from './visitAutosave.js'

function harness(delay = AUTOSAVE_IDLE_MS) {
  const saved = []
  let release = null
  const saver = createVisitAutosave({
    delay,
    save: (updates) => {
      const gate = release
      release = null
      saved.push(updates)
      return gate ? gate : Promise.resolve()
    },
  })
  return {
    saver,
    saved,
    holdNext() {
      let resolve
      const gate = new Promise((r) => { resolve = r })
      release = gate
      return resolve
    },
  }
}

test('autosave waits for a pause and merges edits into one save', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { saver, saved } = harness()
    saver.schedule({ visit_recap: 'a' })
    saver.schedule({ visit_recap: 'ab', rep_names: 'Sam' })
    saver.schedule({ visit_recap: 'abc' })
    assert.equal(saved.length, 0)
    mock.timers.tick(AUTOSAVE_IDLE_MS - 1)
    assert.equal(saved.length, 0)
    mock.timers.tick(1)
    await saver.flush()
    assert.deepEqual(saved, [{ visit_recap: 'abc', rep_names: 'Sam' }])
  } finally {
    mock.timers.reset()
  }
})

test('flush sends immediately and does not save again when the timer fires', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { saver, saved } = harness()
    saver.schedule({ visit_recap: 'notes' })
    await saver.flush()
    assert.deepEqual(saved, [{ visit_recap: 'notes' }])
    mock.timers.tick(AUTOSAVE_IDLE_MS)
    await saver.flush()
    assert.equal(saved.length, 1)
  } finally {
    mock.timers.reset()
  }
})

test('flush with nothing pending does not call save', async () => {
  const { saver, saved } = harness()
  await saver.flush()
  await saver.flush({ keepalive: true })
  assert.equal(saved.length, 0)
})

test('a save still in flight does not drop edits that arrive after it', async () => {
  const { saver, saved, holdNext } = harness()
  const release = holdNext()
  saver.schedule({ visit_recap: 'first' })
  const first = saver.flush()
  await Promise.resolve()
  saver.schedule({ visit_recap: 'second', eval_greeting: 'Fail' })
  const second = saver.flush()
  await Promise.resolve()
  assert.deepEqual(saved, [{ visit_recap: 'first' }])
  release()
  await first
  await second
  assert.deepEqual(saved, [
    { visit_recap: 'first' },
    { visit_recap: 'second', eval_greeting: 'Fail' },
  ])
})

test('a failed save does not block the next flush', async () => {
  const saved = []
  let fail = true
  const saver = createVisitAutosave({
    save: async (updates) => {
      saved.push(updates)
      if (fail) throw new Error('offline')
    },
  })
  saver.schedule({ visit_recap: 'kept locally' })
  await saver.flush()
  fail = false
  saver.schedule({ visit_recap: 'retry' })
  await saver.flush()
  assert.deepEqual(saved, [
    { visit_recap: 'kept locally' },
    { visit_recap: 'retry' },
  ])
})

import { describe, expect, test } from 'vitest'
import { blobSource, drainSource } from '$lib/data/ingest/kernel/source'

describe('blobSource', () => {
  test('reads every byte, in order, across slice boundaries', async () => {
    const size = 8 * 1024 * 1024 * 2 + 12345 // three slices, the last partial
    const bytes = new Uint8Array(size)
    for (let i = 0; i < size; i++) bytes[i] = (i * 31) & 0xff
    const drained = await drainSource(blobSource('big.bin', new Blob([bytes])))
    expect(drained.length).toBe(size)
    // Plain loop: a deep toEqual over 16 MB exhausts the heap.
    let firstMismatch = -1
    for (let i = 0; i < size && firstMismatch === -1; i++) {
      if (drained[i] !== bytes[i]) firstMismatch = i
    }
    expect(firstMismatch).toBe(-1)
  })

  test('an empty blob is an empty stream', async () => {
    const drained = await drainSource(blobSource('empty.bin', new Blob([])))
    expect(drained.length).toBe(0)
  })
})

/**
 * Excluding a (stimulus, participant) group must not leave its AOIs behind.
 * A stimulus's AOI list is populated as segments hit AOIs, but `excludeGroup`
 * drops segments afterwards; any AOI referenced only by dropped segments has
 * to be pruned, and the surviving segments' AOI ids remapped, so the dataset
 * never advertises an AOI no remaining segment points at.
 */
import { describe, it, expect } from 'vitest'
import { SegmentWriter } from '$lib/data/ingest/kernel/segmentWriter'
import { BinaryBufferReader } from '$lib/data/binary'
import { encodeString } from '$lib/data/ingest/utils/byteUtils'

const b = (s: string): Uint8Array => encodeString(s, 'utf-8')

describe('SegmentWriter — excludeGroup prunes orphaned AOIs', () => {
  it('drops AOIs referenced only by an excluded group and remaps survivors', () => {
    const w = new SegmentWriter()
    w.setEncoding('utf-8')

    // Same stimulus "S", two participants. P1 (kept) hits "bar"; P2 (excluded)
    // hits "foo" — a name nothing else references.
    w.addSegmentBytes(0, 100, 0, b('S'), b('P1'), [b('bar')])
    w.addSegmentBytes(0, 100, 0, b('S'), b('P2'), [b('foo')])

    w.excludeGroup(b('S'), b('P2'))

    const data = w.buildFinalData()
    const sIdx = data.stimuli.data.findIndex(r => r[0] === 'S')
    const p1Idx = data.participants.data.findIndex(r => r[0] === 'P1')

    // "foo" is gone; only the surviving group's AOI remains.
    expect(data.aois.data[sIdx]).toEqual([['bar']])

    // The surviving segment still resolves to the correct (remapped) AOI.
    const reader = new BinaryBufferReader(data.segments)
    const resolved: string[] = []
    reader.forEachSegment(sIdx, p1Idx, i => {
      for (const aoiId of reader.getRawAois(i)) {
        resolved.push(data.aois.data[sIdx][aoiId][0])
      }
    })
    expect(resolved).toEqual(['bar'])
  })

  it('leaves AOIs untouched when nothing is excluded', () => {
    const w = new SegmentWriter()
    w.setEncoding('utf-8')
    w.addSegmentBytes(0, 100, 0, b('S'), b('P1'), [b('bar')])
    w.addSegmentBytes(0, 100, 0, b('S'), b('P2'), [b('foo')])

    const data = w.buildFinalData()
    const sIdx = data.stimuli.data.findIndex(r => r[0] === 'S')
    expect(new Set(data.aois.data[sIdx].map(a => a[0]))).toEqual(
      new Set(['bar', 'foo'])
    )
  })
})

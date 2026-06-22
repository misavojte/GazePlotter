/**
 * Dropping a provisional (stimulus, participant) group must not leave its AOIs
 * behind. A stimulus's AOI list is populated as segments hit AOIs (before the
 * group's validity is known); a group that is opened provisional and then
 * dropped — or never committed — contributes no segments, so any AOI referenced
 * only by it has to be pruned and the surviving segments' AOI ids remapped, so
 * the dataset never advertises an AOI no remaining segment points at.
 */
import { describe, it, expect } from 'vitest'
import { SegmentWriter } from '$lib/data/ingest/kernel/segmentWriter'
import { BinaryBufferReader } from '$lib/data/binary'
import { encodeString } from '$lib/data/ingest/utils/byteUtils'

const b = (s: string): Uint8Array => encodeString(s, 'utf-8')

describe('SegmentWriter — dropping a provisional group prunes orphaned AOIs', () => {
  it('drops AOIs referenced only by a dropped group and remaps survivors', () => {
    const w = new SegmentWriter()
    w.setEncoding('utf-8')

    // Same stimulus "S", two participants. P1 (kept) hits "bar"; P2 (dropped)
    // hits "foo" — a name nothing else references.
    w.addSegmentBytes(0, 100, 0, b('S'), b('P1'), [b('bar')])
    w.addSegmentBytes(0, 100, 0, b('S'), b('P2'), [b('foo')])

    // P2's group is opened provisional then rejected (the malformed-interval path).
    const handle = w.beginProvisionalGroup(b('S'), b('P2'))
    w.dropProvisionalGroup(handle)

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

  it('drops a provisional group that is never committed (safe-by-default)', () => {
    const w = new SegmentWriter()
    w.setEncoding('utf-8')

    // P2's group is opened provisional and simply never confirmed — it must not
    // reach the dataset, and its orphan AOI must be pruned.
    w.addSegmentBytes(0, 100, 0, b('S'), b('P1'), [b('bar')])
    w.beginProvisionalGroup(b('S'), b('P2'))
    w.addSegmentBytes(0, 100, 0, b('S'), b('P2'), [b('foo')])

    const data = w.buildFinalData()
    const sIdx = data.stimuli.data.findIndex(r => r[0] === 'S')
    const p2Idx = data.participants.data.findIndex(r => r[0] === 'P2')

    expect(data.aois.data[sIdx]).toEqual([['bar']])
    const reader = new BinaryBufferReader(data.segments)
    let p2Count = 0
    reader.forEachSegment(sIdx, p2Idx, () => {
      p2Count++
    })
    expect(p2Count).toBe(0)
  })

  it('keeps a committed provisional group', () => {
    const w = new SegmentWriter()
    w.setEncoding('utf-8')
    const handle = w.beginProvisionalGroup(b('S'), b('P1'))
    w.addSegmentBytes(0, 100, 0, b('S'), b('P1'), [b('bar')])
    w.commitProvisionalGroup(handle)

    const data = w.buildFinalData()
    const sIdx = data.stimuli.data.findIndex(r => r[0] === 'S')
    const p1Idx = data.participants.data.findIndex(r => r[0] === 'P1')
    let count = 0
    const reader = new BinaryBufferReader(data.segments)
    reader.forEachSegment(sIdx, p1Idx, () => {
      count++
    })
    expect(count).toBe(1)
    expect(data.aois.data[sIdx]).toEqual([['bar']])
  })

  it('leaves AOIs untouched when nothing is dropped', () => {
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

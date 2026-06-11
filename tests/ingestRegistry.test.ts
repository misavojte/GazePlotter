/**
 * REGISTRY INVARIANT TESTS — detection precedence.
 *
 * `STREAM_FORMATS` order IS the detection contract: the first `detect()`
 * that resolves wins. These tests pin the precedence relations the order
 * encodes, using probes that genuinely match MORE THAN ONE sniff — if a
 * registry reorder (or a sniff change) flips a winner, a pin fails here.
 *
 * See the ordering rules in `src/lib/data/ingest/formats/registry.ts` and
 * invariant 1 in `src/lib/data/ingest/README.md`.
 */

import { describe, expect, test } from 'vitest'
import { probeFromText } from '$lib/data/ingest/kernel/source'
import {
  ENRICHMENT_FORMATS,
  STREAM_FORMATS,
  detectEnrichmentFormat,
  detectTypeId,
} from '$lib/data/ingest/formats/registry'

const detect = (slice: string) => detectTypeId(probeFromText(slice))

/** Formats (by first id) that claim the probe, in registry order. */
const claimants = (slice: string) =>
  STREAM_FORMATS.filter(def => def.detect(probeFromText(slice)) !== null).map(
    def => def.ids[0]
  )

describe('registry shape', () => {
  test('every persisted type id is unique across the registry', () => {
    const ids = STREAM_FORMATS.flatMap(def => def.ids)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('csv family is ordered most-specific first', () => {
    const order = STREAM_FORMATS.map(def => def.ids[0])
    const duration = order.indexOf('csv-segmented-duration')
    const fromTo = order.indexOf('csv-segmented')
    const plain = order.indexOf('csv')
    expect(duration).toBeGreaterThanOrEqual(0)
    expect(duration).toBeLessThan(fromTo)
    expect(fromTo).toBeLessThan(plain)
  })

  test('varjo sits after every other vendor sniff', () => {
    const order = STREAM_FORMATS.map(def => def.ids[0])
    const varjo = order.indexOf('varjo')
    for (const vendor of ['tobii', 'gazepoint', 'begaze', 'ogama']) {
      expect(order.indexOf(vendor)).toBeLessThan(varjo)
    }
  })

  test('enrichment ids are unique and disjoint from stream type ids', () => {
    const enrichmentIds = ENRICHMENT_FORMATS.map(def => def.id)
    expect(new Set(enrichmentIds).size).toBe(enrichmentIds.length)
    const streamIds = new Set(STREAM_FORMATS.flatMap(def => def.ids))
    for (const id of enrichmentIds) {
      expect(streamIds.has(id)).toBe(false)
    }
  })
})

describe('enrichment detection (pre-stream partition)', () => {
  test('csv event header is claimed by csv-event, never by a gaze format', () => {
    const slice = `stimulus,participant,eventName,start,duration
Map_A,P1,Click,100,0`
    const probe = probeFromText(slice, { fileName: 'events.csv' })
    expect(detectEnrichmentFormat(probe)?.id).toBe('csv-event')
    // The stream sniffs must not claim it either (no Time/Participant set).
    expect(detectTypeId(probe)).toBe('unknown')
  })

  test('xml files are claimed by legacy-aoi-events by extension', () => {
    const probe = probeFromText('<AoiVisibility/>', { fileName: 'aois.xml' })
    expect(detectEnrichmentFormat(probe)?.id).toBe('legacy-aoi-events')
  })

  test('tobii AOI json is claimed; arbitrary json is not', () => {
    const tobii = probeFromText(
      JSON.stringify({ Aois: { A1: { KeyFrames: { 0: {} } } } }),
      { fileName: 'aois.json' }
    )
    expect(detectEnrichmentFormat(tobii)?.id).toBe('legacy-aoi-events')

    const other = probeFromText(JSON.stringify({ version: 4, data: {} }), {
      fileName: 'workspace.json',
    })
    expect(detectEnrichmentFormat(other)).toBeNull()
  })

  test('gaze csv files are not claimed by any enrichment format', () => {
    const probe = probeFromText(
      'Time,Participant,Stimulus,AOI\n0,P1,Map_A,Region_1',
      { fileName: 'gaze.csv' }
    )
    expect(detectEnrichmentFormat(probe)).toBeNull()
  })
})

describe('precedence under ambiguity (multi-claimant probes)', () => {
  test('duration-segmented header also matches the From/To sniff — duration wins', () => {
    // 'From'/'To' are substrings of a duration-style header via the column
    // names below; both segmented sniffs claim it.
    const slice = `stimulus,participant,timestamp,duration,eyemovementtype,AOI,From,To,Participant,Stimulus
Map_A,P1,0,100,0,Region_1,,,,`
    expect(claimants(slice)).toContain('csv-segmented')
    expect(detect(slice)).toBe('csv-segmented-duration')
  })

  test('From/To header that also satisfies the plain-csv sniff — segmented wins', () => {
    const slice = `From,To,Time,Participant,Stimulus,AOI
0,100,0,P1,Map_A,Region_1`
    expect(claimants(slice)).toEqual(
      expect.arrayContaining(['csv-segmented', 'csv'])
    )
    expect(detect(slice)).toBe('csv-segmented')
  })

  test("varjo's weak sniff also claims a plain csv header containing 'Actor Label' — varjo still wins over csv", () => {
    // The varjo sniff is two substrings ('Time' + 'Actor Label'); it sits
    // before the csv family, so it shadows them whenever both match.
    const slice = `Time,Participant,Stimulus,AOI,Actor Label
0,P1,Map_A,Region_1,Wall`
    expect(claimants(slice)).toEqual(expect.arrayContaining(['varjo', 'csv']))
    expect(detect(slice)).toBe('varjo')
  })

  test("tobii header containing 'Actor Label' resolves to tobii, not varjo", () => {
    const slice = `Recording timestamp\tSensor\tParticipant name\tRecording name\tEye movement type\tGaze event duration\tActor Label\tTime
123\tEye Tracker\tP1\tRec 1\tFixation\t100\tWall\t0`
    expect(claimants(slice)).toEqual(expect.arrayContaining(['tobii', 'varjo']))
    expect(detect(slice)).toBe('tobii')
  })

  test("gazepoint header containing 'Actor Label' resolves to gazepoint, not varjo", () => {
    const slice = `MEDIA_ID,MEDIA_NAME,TIME(2021/07/13 09:21:09.801),FPOGS,FPOGD,FPOGID,BKID,BKDUR,AOI,Time,Actor Label
0,Slide0,0.06689,0.00000,0.06689,1,0,0.00000,,,`
    expect(claimants(slice)).toEqual(
      expect.arrayContaining(['gazepoint', 'varjo'])
    )
    expect(detect(slice)).toBe('gazepoint')
  })
})

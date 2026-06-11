/**
 * The Tobii prompt config contract: keyed JSON, every key opt-in by
 * presence, '' = empty config (media-column parsing), no legacy fallback.
 */

import { describe, expect, test } from 'vitest'
import {
  hasEventDrivenStimuli,
  parseTobiiUserInput,
  serializeTobiiConfig,
} from '$lib/data/ingest/formats/lib/rows/tobiiParsingConfig'

describe('parseTobiiUserInput', () => {
  test("'' is the empty config", () => {
    expect(parseTobiiUserInput('')).toEqual({})
  })

  test('round-trips a full config', () => {
    const config = {
      stimulusStartSuffix: 'IntervalStart',
      stimulusEndSuffix: 'IntervalEnd',
      eventStartSuffix: ' start',
      eventEndSuffix: ' end',
    }
    expect(parseTobiiUserInput(serializeTobiiConfig(config))).toEqual(config)
  })

  test('throws on non-JSON input (no legacy fallback)', () => {
    expect(() => parseTobiiUserInput('IntervalStart;IntervalEnd')).toThrow(
      /Invalid Tobii parsing config/
    )
  })

  test('throws on JSON that is not an object', () => {
    expect(() => parseTobiiUserInput('"WebStimulus"')).toThrow()
    expect(() => parseTobiiUserInput('[1,2]')).toThrow()
    expect(() => parseTobiiUserInput('null')).toThrow()
  })
})

describe('serializeTobiiConfig', () => {
  test("empty config serializes to '' (one spelling of off)", () => {
    expect(serializeTobiiConfig({})).toBe('')
  })

  test('drops empty-string and undefined values', () => {
    expect(
      serializeTobiiConfig({ stimulusStartSuffix: '', eventEndSuffix: undefined })
    ).toBe('')
  })

  test('web mode is a presence flag', () => {
    const out = serializeTobiiConfig({ stimulusWeb: true })
    expect(parseTobiiUserInput(out)).toEqual({ stimulusWeb: true })
  })
})

describe('hasEventDrivenStimuli', () => {
  test('false for empty config, true for interval and web modes', () => {
    expect(hasEventDrivenStimuli({})).toBe(false)
    expect(hasEventDrivenStimuli({ eventEndSuffix: ' end' })).toBe(false)
    expect(hasEventDrivenStimuli({ stimulusWeb: true })).toBe(true)
    expect(
      hasEventDrivenStimuli({
        stimulusStartSuffix: 'A',
        stimulusEndSuffix: 'B',
      })
    ).toBe(true)
  })
})

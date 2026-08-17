/**
 * Regression: interval-marker parsing must not hang on files that open and
 * close many distinct intervals.
 *
 * `intervalStartTimes` (a bigint→number open-addressing map) is `set` on every
 * interval open and `delete`d once a gaze sample consumes the start time.
 * `delete` writes a tombstone; if rehashing is gated on live entries only, a
 * long run of open/close cycles fills every slot with tombstones while the live
 * count stays ~0. Linear probing then never finds an empty slot and
 * `while (states[idx] !== 0)` spins forever — the parser pins a core and the
 * upload progress bar freezes mid-file with no error (seen on a 1.37 GB Tobii
 * export with custom `-0`/`-1` markers, which open ~60 intervals thousands of
 * times). The map must rehash on OCCUPANCY and purge tombstones so every probe
 * terminates. This test would never return on the buggy parser.
 */
import { describe, it, expect } from 'vitest'
import { tobiiRow, runTobiiParser } from './helpers/ingestAdapterHarness'

const INTERVAL_CONFIG =
  '{"stimulusStartSuffix":"IntervalStart","stimulusEndSuffix":"IntervalEnd"}'

describe('TobiiRowParser — interval start-time map under churn', () => {
  it('parses thousands of open/close cycles without spinning (tombstone purge)', () => {
    // Far more distinct intervals than the map's initial 256-slot capacity, each
    // opened, consumed by a gaze sample (sets then deletes its start time), then
    // closed — the exact set/delete pattern that overflowed the table.
    const INTERVALS = 2000
    const rows: string[] = []
    for (let i = 0; i < INTERVALS; i++) {
      const base = i * 10_000
      rows.push(tobiiRow({ ts: base, event: `iv${i} IntervalStart` }))
      // within 50 ms, so the gaze sample deletes the start time
      rows.push(tobiiRow({ ts: base + 1_000, gaze: true, catIdx: i }))
      rows.push(tobiiRow({ ts: base + 2_000, event: `iv${i} IntervalEnd` }))
    }

    const { outputs: segments } = runTobiiParser(rows, INTERVAL_CONFIG)

    // One fixation segment per interval; reaching this line at all is the point.
    expect(segments.length).toBe(INTERVALS)
    expect(new Set(segments.map(s => s.stimulus)).size).toBe(INTERVALS)
  }, 20_000)
})

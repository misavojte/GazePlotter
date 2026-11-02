import { describe, expect, it } from 'vitest'
import {
  aoiIdsInEveryFixation,
  aoiInEveryFixationPlaceholder,
} from '$lib/plots/recurrence/core/collector'
import type { FixationRecord } from '$lib/plots/recurrence/types'

const fix = (...aoiIds: number[]): FixationRecord => ({ x: 0, y: 0, start: 0, duration: 100, aoiIds })

describe('aoiIdsInEveryFixation', () => {
  it('finds a whole-stimulus AOI that overlaps the others', () => {
    expect(aoiIdsInEveryFixation([fix(0), fix(0, 1), fix(2, 0)])).toEqual([0])
  })

  it('ignores a scanpath that stayed on one AOI', () => {
    expect(aoiIdsInEveryFixation([fix(1), fix(1), fix(1)])).toEqual([])
  })

  it('needs every fixation, so one miss or a No AOI fixation clears it', () => {
    expect(aoiIdsInEveryFixation([fix(0, 1), fix(1), fix(0)])).toEqual([])
    expect(aoiIdsInEveryFixation([fix(0, 1), fix(), fix(0)])).toEqual([])
  })
})

describe('aoiInEveryFixationPlaceholder', () => {
  it('names the AOI and offers only the AOI selection without spatial data', () => {
    expect(aoiInEveryFixationPlaceholder(['All'], false)).toEqual({
      message: 'AOI "All" contains every fixation, so every pair is recurrent.',
      steps: ['Choose an AOI selection without "All" in Plot Settings > Areas of Interest'],
    })
  })

  it('adds the spatial methods when they exist', () => {
    expect(aoiInEveryFixationPlaceholder(['All', 'Screen'], true)).toEqual({
      message: 'AOIs "All" and "Screen" contain every fixation, so every pair is recurrent. Either:',
      steps: [
        'Choose an AOI selection without "All" and "Screen" in Plot Settings > Areas of Interest',
        'Switch Method to Fixed distance or Fixed grid',
      ],
    })
  })

  it('stays out of the way when no AOI covers everything', () => {
    expect(aoiInEveryFixationPlaceholder([], true)).toBeNull()
  })
})

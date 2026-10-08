import { describe, expect, it } from 'vitest'
import { IngestService } from '$lib/data/ingest'
import { createIngestDeps } from './helpers/ingestServiceHarness'
import {
  DEFAULT_GRID_STATE_DATA,
  EVENT_ONLY_GRID_STATE_DATA,
  defaultLayoutFor,
  type GridItemSnapshot,
} from '$lib/workspace'
import type { DataCapabilities } from '$lib/data/types'

// Layout resolution in the ingest apply: data-carried gridItems beat the
// data-chosen default, which a host layout replaces for gaze data.

const LAYOUT: GridItemSnapshot[] = [{ type: 'scarf', x: 0, y: 0 }]

function makeService() {
  const { deps } = createIngestDeps()
  return {
    service: new IngestService({ ...deps, defaultLayout: LAYOUT } as any),
    deps,
  }
}

const GAZE: DataCapabilities = { segmented: true, spatial: false, event: false }

function parsedData(
  gridItems?: GridItemSnapshot[],
  capabilities: DataCapabilities = GAZE
) {
  return {
    version: 4,
    data: { capabilities },
    gridItems,
    fileMetadata: null,
    current: { fileNames: ['a.csv'], fileSizes: [1], parseDate: '' },
  } as any
}

describe('ingest layout resolution', () => {
  it('applyEmpty resets to the session default', () => {
    const { service, deps } = makeService()
    service.applyEmpty()
    expect(deps.grid.reset).toHaveBeenCalledWith(LAYOUT)
  })

  it('applyParsedData without gridItems falls back to the session default', () => {
    const { service, deps } = makeService()
    service.applyParsedData(parsedData())
    expect(deps.grid.reset).toHaveBeenCalledWith(LAYOUT)
  })

  it('gridItems carried by the data always win', () => {
    const carried: GridItemSnapshot[] = [{ type: 'aoiComparison', x: 0, y: 0 }]
    const { service, deps } = makeService()
    service.applyParsedData(parsedData(carried))
    expect(deps.grid.reset).toHaveBeenCalledWith(carried)
  })

  it('event-only data opens its own layout even under a host layout', () => {
    const { service, deps } = makeService()
    service.applyParsedData(
      parsedData(undefined, { segmented: false, spatial: false, event: true })
    )
    expect(deps.grid.reset).toHaveBeenCalledWith(EVENT_ONLY_GRID_STATE_DATA)
  })

  it('Reset Layout target is the layout the visible dataset opened with', () => {
    const carried: GridItemSnapshot[] = [{ type: 'aoiComparison', x: 0, y: 0 }]
    const { service } = makeService()
    service.applyParsedData(parsedData(carried))
    expect(service.loadedLayout).toEqual(carried)
    service.applyParsedData(parsedData())
    expect(service.loadedLayout).toEqual(LAYOUT)
  })
})

describe('defaultLayoutFor', () => {
  it('spatial gaze data gets the scanpath on top, plus every gaze plot', () => {
    const layout = defaultLayoutFor({ ...GAZE, spatial: true })
    expect(layout[0]).toMatchObject({ type: 'scanpath', x: 0, y: 0 })
    expect(layout.map(i => i.type).sort()).toEqual(
      ['scanpath', ...DEFAULT_GRID_STATE_DATA.map(i => i.type)].sort()
    )
  })

  it('non-spatial gaze data and empty data get the gaze layout', () => {
    expect(defaultLayoutFor(GAZE)).toBe(DEFAULT_GRID_STATE_DATA)
    expect(defaultLayoutFor({ segmented: false, spatial: false, event: false })).toBe(
      DEFAULT_GRID_STATE_DATA
    )
  })
})

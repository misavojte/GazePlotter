import { describe, expect, it } from 'vitest'
import { IngestService } from '$lib/data/ingest'
import { createIngestDeps } from './helpers/ingestServiceHarness'
import type { GridItemSnapshot } from '$lib/workspace'

// Layout resolution in the ingest apply: data-carried gridItems beat the
// session-resolved default (PLANDESKTOP.md embedding contract).

const LAYOUT: GridItemSnapshot[] = [{ type: 'scarf', x: 0, y: 0 }]

function makeService() {
  const { deps } = createIngestDeps()
  return {
    service: new IngestService({ ...deps, defaultLayout: LAYOUT } as any),
    deps,
  }
}

function parsedData(gridItems?: GridItemSnapshot[]) {
  return {
    version: 4,
    data: {},
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
})

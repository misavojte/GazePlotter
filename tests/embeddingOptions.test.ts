import { describe, expect, it, vi } from 'vitest'
import { createGazePlotterSession } from '$lib/session'
import { TOKEN_CSS, cssColorVar } from '$lib/designTokens'
import { ExportService } from '$lib/data/export'
import { DEFAULT_GRID_STATE_DATA } from '$lib/workspace'
import type { GridItemSnapshot } from '$lib/workspace'

// Embedding contract (PLANDESKTOP.md): options resolve once at session
// creation into the owning service; injected functions are used verbatim,
// absent ones fall back to the web default.

describe('session wiring of embedding options', () => {
  it('injected saveFile receives deliveries, extension applied', async () => {
    const saveFile = vi.fn()
    const session = createGazePlotterSession({ saveFile })
    const ok = await session.exportService.exportMetadataReport({
      fileName: 'Meta',
      buildContent: () => 'a,b',
    })
    expect(ok).toBe(true)
    expect(saveFile).toHaveBeenCalledWith('a,b', 'Meta.csv', '.csv')
  })

  it('injected openFiles drives uploads; [] means cancelled', async () => {
    const openFiles = vi.fn(async () => [] as File[])
    const session = createGazePlotterSession({ openFiles })
    await expect(session.ingest.openAndLoadFiles()).resolves.toBe(false)
    expect(openFiles).toHaveBeenCalledTimes(1)
  })

  it('host defaultLayout seeds the empty workspace', () => {
    const defaultLayout: GridItemSnapshot[] = [{ type: 'scarf', x: 0, y: 0 }]
    const session = createGazePlotterSession({ defaultLayout })
    session.ingest.applyEmpty()
    expect(session.grid.items.map(i => i.type)).toEqual(['scarf'])
  })

  it('without options the builtin layout applies', () => {
    const session = createGazePlotterSession()
    session.ingest.applyEmpty()
    expect(session.grid.items.map(i => i.type)).toEqual(
      DEFAULT_GRID_STATE_DATA.map(i => i.type)
    )
  })
})

describe('design tokens', () => {
  // Color overrides go through CSSOM (setProperty), never markup, so there
  // is no injection surface to pin; the token block is a constant.
  it('the token block carries the built-in palette', () => {
    expect(TOKEN_CSS).toContain('--c-brand: #cd1404;')
    expect(TOKEN_CSS).toContain('--c-brand-dark: #a20d03;')
    expect(TOKEN_CSS).toContain('--c-border: color-mix')
  })

  it('palette keys map to kebab-case custom properties', () => {
    expect(cssColorVar('brandDark')).toBe('--c-brand-dark')
  })
})

describe('export delivery goes through saveFile', () => {
  it('exportFigures delivers a single figure via the injected saveFile', async () => {
    const saveFile = vi.fn()
    const service = new ExportService({
      engine: {},
      errorService: { report: vi.fn() },
      grid: {},
      ingest: {},
      toastState: { addSuccess: vi.fn() },
      saveFile,
    } as any)

    const content = new Blob(['png-bytes'], { type: 'image/png' })
    const ok = await service.exportFigures({
      fileName: 'Report',
      files: [{ name: 'scarf.png', content }],
      requestedCount: 1,
    })

    expect(ok).toBe(true)
    expect(saveFile).toHaveBeenCalledWith(content, 'Report.png', '.png')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { drawCanvasPlaceholder } from '$lib/plots/shared/drawCanvasPlaceholder'

describe('drawCanvasPlaceholder', () => {
  it('draws a single line string warning using roundRect if available', () => {
    const mockCtx = {
      save: vi.fn(),
      clearRect: vi.fn(),
      roundRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
    } as any

    drawCanvasPlaceholder(mockCtx, 600, 400, 'Single line warning')

    expect(mockCtx.save).toHaveBeenCalled()
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 600, 400)
    expect(mockCtx.roundRect).toHaveBeenCalledWith(0, 0, 600, 400, 20)
    expect(mockCtx.fill).toHaveBeenCalledTimes(2) // 1 background, 1 icon
    expect(mockCtx.stroke).toHaveBeenCalledTimes(1) // 1 icon border
    // Exclamation mark (!) + the text line = 2 calls to fillText
    expect(mockCtx.fillText).toHaveBeenCalledTimes(2)
    expect(mockCtx.restore).toHaveBeenCalled()
  })

  it('draws a warning object with message and actionable steps using fallback arcs if roundRect is not available', () => {
    const mockCtx = {
      save: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
    } as any

    drawCanvasPlaceholder(mockCtx, 600, 400, {
      message: 'Warn Line 1',
      steps: ['Warn Line 2', 'Warn Line 3'],
    })

    expect(mockCtx.save).toHaveBeenCalled()
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 600, 400)
    expect(mockCtx.arcTo).toHaveBeenCalledTimes(4) // fallback rounded corners
    expect(mockCtx.fill).toHaveBeenCalledTimes(2) // 1 background, 1 icon
    expect(mockCtx.stroke).toHaveBeenCalledTimes(1) // 1 icon border
    // Exclamation mark (!) + 1 main message + 2 steps = 4 calls to fillText
    expect(mockCtx.fillText).toHaveBeenCalledTimes(4)
    expect(mockCtx.restore).toHaveBeenCalled()
  })
})

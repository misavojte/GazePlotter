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
    // The user-visible contract is WHAT text is drawn; draw-call counts are
    // implementation detail (batching or a different icon breaks them).
    const drawn = mockCtx.fillText.mock.calls.map((c: unknown[]) => c[0])
    expect(drawn).toContain('Single line warning')
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
    expect(mockCtx.arcTo).toHaveBeenCalled() // the roundRect fallback path ran
    // Message and every step must reach the canvas (steps are bulleted);
    // counts are detail.
    const drawn = mockCtx.fillText.mock.calls.map((c: unknown[]) => c[0])
    expect(drawn).toEqual(
      expect.arrayContaining(['Warn Line 1', '• Warn Line 2', '• Warn Line 3'])
    )
    expect(mockCtx.restore).toHaveBeenCalled()
  })
})

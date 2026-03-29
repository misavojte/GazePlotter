import { describe, expect, it, vi } from 'vitest'
import { updateMultipleAoiVisibility } from '$lib/data/engine/updaters/visibilityUpdaters'

describe('visibilityUpdaters', () => {
  it('matches AOIs by displayed name when applying visibility updates', () => {
    const engine = {
      metadata: {
        aois: {
          data: [
            [
              ['aoi_original', 'AOI Display', '#ff0000', '0,0,10,10'],
            ],
          ],
        },
      },
      updateDynamicVisibility: vi.fn(),
    } as any

    updateMultipleAoiVisibility(engine, 0, ['AOI Display'], [[100, 200]])

    expect(engine.updateDynamicVisibility).toHaveBeenCalledTimes(1)
    expect(engine.updateDynamicVisibility).toHaveBeenCalledWith(0, [
      {
        aoiId: 0,
        visibility: [100, 200],
        participantId: null,
      },
    ])
  })

  it('throws when any requested AOI does not exist', () => {
    const engine = {
      metadata: {
        aois: {
          data: [
            [
              ['aoi_original', 'AOI Display', '#ff0000', '0,0,10,10'],
            ],
          ],
        },
      },
      updateDynamicVisibility: vi.fn(),
    } as any

    expect(() =>
      updateMultipleAoiVisibility(engine, 0, ['Missing AOI'], [[100, 200]])
    ).toThrowError(
      'AOI visibility update references unknown AOIs for stimulusId 0: Missing AOI'
    )
    expect(engine.updateDynamicVisibility).not.toHaveBeenCalled()
  })
})

/**
 * The engine's stage contract (`plotStages.svelte.ts`): a kit's scene is built
 * once per input change and then cached, however often the render, hover and
 * overlay read it. The regression this pins is the 18 s matrix freeze (see the
 * `kit.ts` header).
 */
import { describe, expect, it } from 'vitest'
import { defineKit } from '$lib/plots/shared/kit'
import { plotStagesHarness } from './helpers/plotStagesHarness.svelte'

type Input = {
  values: Float64Array
  range: [number, number]
  empty?: boolean
}

function countingKit() {
  const calls = { chrome: 0, scene: 0 }
  const kit = defineKit<Input>()({
    label: 'test',
    chrome: input => {
      calls.chrome++
      return { placeholder: input.empty ? { message: 'Nothing to show' } : null }
    },
    scene: (input, { size }) => {
      calls.scene++
      let max = input.range[1]
      if (max === 0) for (const v of input.values) if (v > max) max = v
      return { max, width: size.width }
    },
    draw: () => {},
  })
  return { kit, calls }
}

const input = (): Input => ({ values: new Float64Array([1, 7, 3]), range: [0, 0] })

describe('plot stages', () => {
  for (const effect of [false, true]) {
    describe(effect ? 'with the repaint effect reading' : 'read untracked only', () => {
      it('builds the scene once, then serves every read from the cache', () => {
        const { kit, calls } = countingKit()
        const h = plotStagesHarness(kit, input(), { effect })
        for (let i = 0; i < 1000; i++) h.read(() => h.stages.build.scene)
        expect(h.read(() => h.stages.build.scene)?.max).toBe(7)
        expect(calls.scene).toBe(1)
        h.dispose()
      })

      it('rebuilds once after an equal-but-new input, not once per read', () => {
        const { kit, calls } = countingKit()
        const base = input()
        const h = plotStagesHarness(kit, base, { effect })
        h.read(() => h.stages.build.scene)
        const before = calls.scene
        // A screen recipe rebuilds `range` on every resize: equal, but a new array.
        h.setInput({ ...base, range: [0, 0] })
        for (let render = 0; render < 3; render++) {
          for (let cell = 0; cell < 1000; cell++) h.read(() => h.stages.build.scene?.max)
        }
        expect(calls.scene - before).toBe(1)
        h.dispose()
      })

      it('rebuilds the scene on a resize', () => {
        const { kit, calls } = countingKit()
        const h = plotStagesHarness(kit, input(), { effect })
        h.read(() => h.stages.build.scene)
        h.setSize({ width: 800, height: 300, margin: 0 })
        expect(h.read(() => h.stages.build.scene)?.width).toBe(800)
        expect(calls.scene).toBe(2)
        h.dispose()
      })
    })
  }

  it('builds no scene while the chrome carries a data placeholder', () => {
    const { kit, calls } = countingKit()
    const h = plotStagesHarness(kit, { ...input(), empty: true })
    expect(h.read(() => h.stages.build.scene)).toBeNull()
    expect(h.read(() => h.stages.build.placeholder)).toEqual({ message: 'Nothing to show' })
    expect(calls.scene).toBe(0)
    h.dispose()
  })

  it('freezes the scene so a draw cannot write into it', () => {
    const { kit } = countingKit()
    const h = plotStagesHarness(kit, input())
    const scene = h.read(() => h.stages.build.scene) as { max: number }
    expect(() => {
      scene.max = 1
    }).toThrow()
    h.dispose()
  })
})

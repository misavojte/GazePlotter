import { describe, expect, it } from 'vitest'
import { PreviewModel } from '$lib/plots/shared/previewSync.svelte'

describe('PreviewModel', () => {
  it('keeps previewed undefined distinct from no preview', () => {
    let committed = {
      timelineEnd: 10 as number | undefined,
    }

    const preview = new PreviewModel({
      getCommitted: () => committed,
      buildPatch: (draft, current) => {
        const updates: Partial<typeof committed> = {}

        if (draft.timelineEnd !== current.timelineEnd) {
          updates.timelineEnd = draft.timelineEnd
        }

        return updates
      },
    })

    expect(preview.fields.timelineEnd.value).toBe(10)

    preview.fields.timelineEnd.value = undefined

    expect(preview.isDirty).toBe(true)
    expect(preview.draft.timelineEnd).toBeUndefined()
    expect(preview.buildPatch()).toEqual({ timelineEnd: undefined })

    preview.resetAll()

    expect(preview.isDirty).toBe(false)
    expect(preview.fields.timelineEnd.value).toBe(10)
  })

  it('builds typed patches from dirty preview fields', () => {
    let committed = {
      start: 0,
      end: 10,
      mode: 'stream' as 'stream' | 'heatmap',
    }

    const preview = new PreviewModel({
      getCommitted: () => committed,
      buildPatch: (draft, current) => {
        const updates: Partial<typeof committed> = {}

        if (draft.start !== current.start) updates.start = draft.start
        if (draft.end !== current.end) updates.end = draft.end
        if (draft.mode !== current.mode) updates.mode = draft.mode

        return updates
      },
    })

    preview.fields.start.value = 25
    preview.fields.mode.value = 'heatmap'

    expect(preview.isDirty).toBe(true)
    expect(preview.draft).toEqual({
      start: 25,
      end: 10,
      mode: 'heatmap',
    })
    expect(preview.buildPatch()).toEqual({
      start: 25,
      mode: 'heatmap',
    })
  })

  it('buildSimplePatch diffs only the specified keys', () => {
    const draft = { a: 1, b: 'changed', c: true, d: 'same' }
    const committed = { a: 1, b: 'original', c: false, d: 'same' }

    const patch = PreviewModel.buildSimplePatch(draft, committed, ['a', 'b', 'c', 'd'])
    expect(patch).toEqual({ b: 'changed', c: true })
  })

  it('buildSimplePatch returns empty object when nothing changed', () => {
    const state = { x: 10, y: 20 }
    const patch = PreviewModel.buildSimplePatch(state, { ...state }, ['x', 'y'])
    expect(patch).toEqual({})
  })

  it('buildSimplePatch only checks requested keys', () => {
    const draft = { a: 1, b: 99 }
    const committed = { a: 1, b: 0 }

    const patch = PreviewModel.buildSimplePatch(draft, committed, ['a'])
    expect(patch).toEqual({})
  })

  it('resets every preview field together', () => {
    let committed = {
      start: 5,
      end: 15,
    }

    const preview = new PreviewModel({
      getCommitted: () => committed,
      buildPatch: (draft, current) => {
        const updates: Partial<typeof committed> = {}

        if (draft.start !== current.start) updates.start = draft.start
        if (draft.end !== current.end) updates.end = draft.end

        return updates
      },
    })

    preview.fields.start.value = 50
    preview.fields.end.value = 60

    preview.resetAll()

    expect(preview.isDirty).toBe(false)
    expect(preview.draft).toEqual(committed)
  })
})

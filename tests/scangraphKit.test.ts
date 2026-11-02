/**
 * The scangraph kit (`scanpath-similarity/core/kit.ts`): Scanpath Similarity's
 * graph view. Pure functions, so no canvas host: build a scene from an input,
 * then hit-test, publish and draw it into a recording context.
 */
import { describe, expect, it, vi } from 'vitest'
import { scangraphKit, type ScangraphHover } from '$lib/plots/scanpath-similarity/core/kit'
import type { ScangraphInput } from '$lib/plots/scanpath-similarity/core/view'
import type { ScangraphData, ScanpathSimilaritySettings } from '$lib/plots/scanpath-similarity/types'
import type { SceneContext } from '$lib/plots/shared/kit'
import type { PlotFrame } from '$lib/plots/shared/frame'
import { NO_CURSOR } from '$lib/plots/shared/cursorMarks'
import {
  METRIC_MISSING_MESSAGE,
  type PlotPlaceholderContent,
} from '$lib/plots/shared/drawCanvasPlaceholder'
import { recordingContext } from './helpers/canvasRecorder'

/** Four participants: a triangle 0-1-2 and an isolated 3. */
function graph(): ScangraphData {
  return {
    nodes: [
      { id: 0, label: 'P1', group: 0 },
      { id: 1, label: 'P2', group: 0 },
      { id: 2, label: 'P3', group: 0 },
      { id: 3, label: 'P4', group: 0 },
    ],
    links: [
      { source: 0, target: 1, value: 0.9 },
      { source: 1, target: 2, value: 0.6 },
      { source: 0, target: 2, value: 0.7 },
    ],
  }
}

function input(over: Partial<ScangraphInput> = {}): ScangraphInput {
  return {
    settings: { threshold: 0.5 } as ScanpathSimilaritySettings,
    threshold: 0.5,
    data: graph(),
    noMetric: false,
    cliqueMembers: [],
    participantIds: [10, 20, 30, 40],
    ...over,
  }
}

function frameOf(x: number, y: number, width: number, height: number): PlotFrame {
  return {
    x,
    y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    legendY: y + height,
    leftTitleOffset: 0,
    bottomTitleOffset: 0,
  }
}

function sceneOf(i: ScangraphInput, frame = frameOf(0, 0, 500, 500)) {
  const size = { width: frame.right + 1, height: frame.bottom + 1, margin: 0 }
  const chrome = scangraphKit.chrome!(i, size)
  const ctx: SceneContext<typeof chrome> = {
    frame,
    size,
    chrome,
    pixelRatio: 1,
    gradientLegend: null,
  }
  return { scene: scangraphKit.scene(i, ctx), ctx }
}

/** The card's message and steps, whichever form it takes. */
function card(p: PlotPlaceholderContent | null | undefined) {
  return typeof p === 'string' ? { message: p, steps: [] } : p
}

/** The platform's actions over one scene, with the writes spied. */
function actOf(i: ScangraphInput) {
  const { scene, ctx } = sceneOf(i)
  const publish = vi.fn()
  const toggle = vi.fn()
  const act = {
    scene: () => scene,
    input: () => i,
    frame: () => ctx.frame,
    publish,
    toggle,
  } as unknown as Parameters<NonNullable<typeof scangraphKit.hover>>[1]
  return { act, publish, toggle }
}

describe('scangraph kit', () => {
  it('frames the data with only an outline, and passes the data placeholders through the chrome', () => {
    const size = { width: 100, height: 100, margin: 0 }
    const chrome = scangraphKit.chrome!(input(), size)
    expect(chrome.axes).toEqual({})
    expect(chrome.gutters).toEqual({ pad: { right: 1, bottom: 1 } })
    expect(chrome.placeholder).toBeNull()
    expect(scangraphKit.chrome!(input({ noMetric: true }), size).placeholder).toBe(
      METRIC_MISSING_MESSAGE
    )
    expect(
      card(scangraphKit.chrome!(input({ data: { nodes: [], links: [] } }), size).placeholder)?.message
    ).toMatch(/No participants/)
  })

  it('simulates once per data object and only rescales into the frame', () => {
    const i = input()
    const small = sceneOf(i, frameOf(10, 20, 200, 100)).scene
    const large = sceneOf(i, frameOf(0, 0, 800, 600)).scene
    // The memoised layout: the same canonical result, mapped twice.
    expect(large.links).toBe(small.links)
    for (let n = 0; n < 4; n++) {
      expect((small.nodes[n].x - 10) / 200).toBeCloseTo(large.nodes[n].x / 800, 9)
      expect((small.nodes[n].y - 20) / 100).toBeCloseTo(large.nodes[n].y / 600, 9)
    }
    // Nodes lie inside the frame.
    for (const node of large.nodes) {
      expect(node.x).toBeGreaterThan(0)
      expect(node.x).toBeLessThan(800)
      expect(node.y).toBeGreaterThan(0)
      expect(node.y).toBeLessThan(600)
    }
  })

  it('sizes nodes from the frame, clamped to 3..8 px', () => {
    expect(sceneOf(input(), frameOf(0, 0, 1000, 1000)).scene.nodeRadius).toBe(8)
    // min(200, 100) / (4 * 1.2) = 20.83 → 8; 20 / 4.8 = 4.17 → 4.2
    expect(sceneOf(input(), frameOf(0, 0, 20, 400)).scene.nodeRadius).toBe(4.2)
    expect(sceneOf(input(), frameOf(0, 0, 10, 400)).scene.nodeRadius).toBe(3)
  })

  it('resolves the highlight neighbourhood and the clique as node sets', () => {
    // Highlights are participant ids; one outside the graph marks nothing.
    const { scene } = sceneOf(input({ highlightedParticipants: [10, 99], cliqueMembers: [1, 2] }))
    expect([...scene.highlightSet]).toEqual([0])
    expect([...scene.connectedToHighlight].sort()).toEqual([1, 2])
    expect([...scene.cliqueSet]).toEqual([1, 2])
    expect(scene.threshold).toBe(0.5)
  })

  it('guards nodes packed too tightly to read', () => {
    const big = sceneOf(input())
    expect(scangraphKit.fit!(big.scene, big.ctx)).toBeNull()
    // 50 / (4 * 1.2) = 10.4 ≥ 3; 12 / 4.8 = 2.5 < 3.
    const ok = sceneOf(input(), frameOf(0, 0, 50, 50))
    expect(scangraphKit.fit!(ok.scene, ok.ctx)).toBeNull()
    const tight = sceneOf(input(), frameOf(0, 0, 12, 400))
    expect(card(scangraphKit.fit!(tight.scene, tight.ctx))?.steps).toContain(
      'Reduce the number of participants in Plot Settings > Participants'
    )
  })

  it('hit-tests a node into its participant, connections and click hint', () => {
    const i = input()
    const { scene, ctx } = sceneOf(i)
    const node = scene.nodes[0]
    const hit = scangraphKit.hit!(scene, node.x + 1, node.y, ctx.frame, i)
    expect(hit?.data).toEqual({ kind: 'node', node })
    expect(hit?.cursor).toBe('pointer')
    expect(hit?.content).toEqual([
      { key: 'Participant', value: 'P1' },
      { key: 'Connections', value: '0.900 P2' },
      { key: '', value: '0.700 P3' },
      { key: '', value: 'Click to highlight' },
    ])
    // Highlighted: the hint flips.
    const highlighted = sceneOf(input({ highlightedParticipants: [10] })).scene
    expect(
      scangraphKit.hit!(highlighted, node.x, node.y, ctx.frame, i)?.content.at(-1)?.value
    ).toBe('Click to remove highlight')
  })

  it('hit-tests an edge into its pair and similarity, and empty space into a track-only hit', () => {
    const i = input()
    const { scene, ctx } = sceneOf(i)
    const s = scene.nodes[0]
    const t = scene.nodes[1]
    const hit = scangraphKit.hit!(scene, (s.x + t.x) / 2, (s.y + t.y) / 2, ctx.frame, i)
    expect(hit?.data).toEqual({ kind: 'edge', source: 0, target: 1, value: 0.9 })
    expect(hit?.content).toEqual([
      { key: 'Participants', value: 'P1 ↔ P2' },
      { key: 'Similarity', value: '0.900' },
    ])
    // A corner of the frame: away from every node and link.
    const corner = [
      [1, 1],
      [499, 1],
      [1, 499],
      [499, 499],
    ].map(([x, y]) => scangraphKit.hit!(scene, x, y, ctx.frame, i))
    const empty = corner.find(h => h?.content.length === 0)
    expect(empty).toBeDefined()
    expect(empty?.data).toBeUndefined()
  })

  it('keys the overlay on the cursor nodes, not on the cursor arrays', () => {
    const { scene } = sceneOf(input())
    const key = (participants: number[]) =>
      scangraphKit.overlay!.key!(scene, { times: [], participants }, input())
    expect(key([20])).toBe('1')
    expect(key([20, 99])).toBe(key([20]))
    expect(key([10])).not.toBe(key([20]))
    expect(scangraphKit.overlay!.key!(scene, NO_CURSOR, input())).toBe('')
  })

  it('publishes a node as one participant and an edge as a sorted pair, live', () => {
    const i = input({ participantIds: [30, 20, 10, 40] })
    const { act, publish } = actOf(i)
    const { scene } = sceneOf(i)
    scangraphKit.hover!({ kind: 'node', node: scene.nodes[1] }, act)
    expect(publish.mock.lastCall?.[0].participants()).toEqual([20])
    scangraphKit.hover!({ kind: 'edge', source: 0, target: 1, value: 0.9 }, act)
    expect(publish.mock.lastCall?.[0].participants()).toEqual([20, 30])
    scangraphKit.hover!(null, act)
    expect(publish).toHaveBeenLastCalledWith(null)
    // A node the ids no longer cover publishes nothing rather than an empty set.
    scangraphKit.hover!({ kind: 'node', node: { ...scene.nodes[3], id: 9 } }, act)
    expect(publish).toHaveBeenLastCalledWith(null)
  })

  it("toggles a node's participant in the persisted highlights on click, and ignores an edge", () => {
    const i = input({ participantIds: [30, 20, 10, 40] })
    const { act, toggle } = actOf(i)
    const { scene } = sceneOf(i)
    scangraphKit.click!({ kind: 'edge', source: 0, target: 1, value: 0.9 }, act)
    expect(toggle).not.toHaveBeenCalled()
    scangraphKit.click!({ kind: 'node', node: scene.nodes[2] }, act)
    expect(toggle).toHaveBeenCalledWith('highlightedParticipants', 10)
    // A node the ids no longer cover toggles nothing.
    scangraphKit.click!({ kind: 'node', node: { ...scene.nodes[3], id: 9 } }, act)
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('draws every link and node, the labels, and the marks', () => {
    const i = input({ highlightedParticipants: [40], cliqueMembers: [0, 1] })
    const { scene, ctx } = sceneOf(i)
    const rec = recordingContext()
    scangraphKit.draw(rec.ctx, scene, ctx.frame)
    expect(rec.count('arc')).toBe(4)
    expect(rec.count('stroke')).toBe(3 + 4)
    scangraphKit.drawAboveAxes!(rec.ctx, scene, ctx.frame)
    expect(rec.count('fillText')).toBeGreaterThan(0)

    // Nothing hovered, nothing under the cursor: no marks.
    const none = recordingContext()
    scangraphKit.overlay!.draw(none.ctx, scene, ctx.frame, { hover: null, cursor: NO_CURSOR, input: i })
    expect(none.calls).toHaveLength(0)

    // A node: its two edges, its neighbours' rings and its own halo + ring.
    const node = recordingContext()
    const hover: ScangraphHover = { kind: 'node', node: scene.nodes[0] }
    scangraphKit.overlay!.draw(node.ctx, scene, ctx.frame, { hover, cursor: NO_CURSOR, input: i })
    expect(node.count('arc')).toBe(3)
    expect(node.count('fill')).toBe(1)

    // The cursor reaches the same marks as a hover of that node.
    const cursor = recordingContext()
    scangraphKit.overlay!.draw(cursor.ctx, scene, ctx.frame, {
      hover: null,
      cursor: { times: [], participants: [10] },
      input: i,
    })
    expect(cursor.calls.map(c => c.method)).toEqual(node.calls.map(c => c.method))

    // An edge: that one edge and its two endpoints, no neighbour tier.
    const edge = recordingContext()
    scangraphKit.overlay!.draw(edge.ctx, scene, ctx.frame, {
      hover: { kind: 'edge', source: 0, target: 1, value: 0.9 },
      cursor: NO_CURSOR,
      input: i,
    })
    expect(edge.count('arc')).toBe(2)
    expect(edge.count('fill')).toBe(2)
  })
})

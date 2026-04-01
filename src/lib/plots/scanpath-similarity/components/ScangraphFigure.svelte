<script lang="ts">
  import { updateTooltip } from '$lib/tooltip'
  import { SYSTEM_SANS_SERIF_STACK } from '$lib/shared/utils/textUtils'
  import { getContext, untrack } from 'svelte'
  import {
    createCanvasState,
    getScaledMousePosition,
    getTooltipPosition,
    beginCanvasDrawing,
    finishCanvasDrawing,
    createRenderScheduler,
    canvasLifecycleAction,
    refreshCanvasLifecycle,
  } from '$lib/plots/shared/canvasUtils'
  import type { CanvasState } from '$lib/plots/shared/canvasUtils'
  import {
    EXPORT_SOURCE_CONTEXT,
    type ExportSourceRegistrar,
    registerCanvasExportSource,
  } from '$lib/data/export'
  import { UI_COLORS } from '$lib/color'
  import { drawPlotOutline } from '$lib/plots/shared'
  import { SCANGRAPH_LAYOUT } from '../const'
  import type { ScangraphData } from '../types'
  import { computeForceLayout, type LayoutResult, type NodePosition } from '../core/forceLayout'

  let {
    data,
    height = 500,
    width = 500,
    dpiOverride = null,
  } = $props<{
    data: ScangraphData
    height?: number
    width?: number
    dpiOverride?: number | null
  }>()

  let canvas = $state<HTMLCanvasElement | null>(null)
  let canvasState = $state<CanvasState>(createCanvasState())

  const exportRegistrar = getContext<ExportSourceRegistrar | undefined>(
    EXPORT_SOURCE_CONTEXT
  )

  $effect(() => {
    return registerCanvasExportSource(exportRegistrar, () => canvas)
  })

  const getCanvasDimensions = () => ({ width, height })
  const scheduleRender = createRenderScheduler(renderCanvas)

  const nodeRadius = $derived.by(() => {
    const n = data?.nodes.length ?? 0
    if (n === 0) return SCANGRAPH_LAYOUT.nodeRadius
    const minDim = Math.min(width, height)
    return Math.round(Math.max(3, Math.min(8, minDim / (n * 1.2))) * 10) / 10
  })

  const layoutResult = $derived.by((): LayoutResult => {
    if (!data || data.nodes.length === 0)
      return { nodes: [], links: [] }
    return computeForceLayout(data, width, height)
  })

  type Rect = { x: number; y: number; w: number; h: number }

  function rectsOverlap(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }

  function rectHitsCircle(rect: Rect, cx: number, cy: number, r: number): boolean {
    // Closest point on rect to circle center
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w))
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h))
    const dx = closestX - cx
    const dy = closestY - cy
    return dx * dx + dy * dy < r * r
  }

  /**
   * Label placement: above the node, sliding right then left if needed.
   *
   * For each node:
   * 1. Try centered above
   * 2. Slide right in steps until label left edge >= node center (label mostly right of node)
   * 3. Slide left in steps until label right edge <= node center (label mostly left of node)
   * 4. If all positions collide with a node circle or already-placed label, skip
   */
  function computeVisibleLabels(
    ctx: CanvasRenderingContext2D,
    nodes: NodePosition[],
    r: number,
    fontSize: number
  ): { nodeIndex: number; rect: Rect }[] {
    const gap = 3
    const labelH = fontSize + 2
    const step = 4 // px per slide step

    // Occupied: node circles + already placed labels
    const placedLabels: Rect[] = []
    const result: { nodeIndex: number; rect: Rect }[] = []

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const labelW = ctx.measureText(node.label).width
      const baseY = node.y - r - gap - labelH

      // Generate candidates: center, then slide right, then slide left
      let placed = false

      // Center position
      const centerX = node.x - labelW / 2

      // Try center first, then slide right, then slide left
      // Right: shift from center rightward until label left edge >= node.x
      // Left: shift from center leftward until label right edge <= node.x
      const maxRightShift = node.x - centerX // label.x goes up to node.x
      const maxLeftShift = (centerX + labelW) - node.x // label right edge down to node.x

      const candidates: number[] = [centerX] // start with centered

      // Slide right
      for (let s = step; s <= maxRightShift; s += step) {
        candidates.push(centerX + s)
      }
      // Snap to max right position
      if (maxRightShift > step) {
        candidates.push(centerX + maxRightShift)
      }

      // Slide left
      for (let s = step; s <= maxLeftShift; s += step) {
        candidates.push(centerX - s)
      }
      // Snap to max left position
      if (maxLeftShift > step) {
        candidates.push(centerX - maxLeftShift)
      }

      for (const rx of candidates) {
        const rect: Rect = { x: rx, y: baseY, w: labelW, h: labelH }

        // Out of canvas bounds?
        if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > width || rect.y + rect.h > height) {
          continue
        }

        // Overlaps any node circle?
        let blocked = false
        for (let j = 0; j < nodes.length; j++) {
          if (rectHitsCircle(rect, nodes[j].x, nodes[j].y, r + 1)) {
            blocked = true
            break
          }
        }
        if (blocked) continue

        // Overlaps any already-placed label?
        for (const pl of placedLabels) {
          if (rectsOverlap(rect, pl)) {
            blocked = true
            break
          }
        }
        if (blocked) continue

        // Place it
        placedLabels.push(rect)
        result.push({ nodeIndex: i, rect })
        placed = true
        break
      }
      // If !placed, label is simply not shown (tooltip still works)
    }

    return result
  }

  function renderCanvas() {
    beginCanvasDrawing(canvasState, true)
    const ctx = canvasState.context
    if (!ctx) return

    const { nodes, links } = layoutResult

    if (nodes.length === 0) {
      ctx.font = `12px ${SYSTEM_SANS_SERIF_STACK}`
      ctx.fillStyle = UI_COLORS.TEXT_SECONDARY
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No graph data available', width >> 1, height >> 1)
      finishCanvasDrawing(canvasState)
      return
    }

    const r = nodeRadius

    // Draw links
    ctx.strokeStyle = SCANGRAPH_LAYOUT.linkColor
    ctx.globalAlpha = SCANGRAPH_LAYOUT.linkOpacity
    ctx.lineWidth = 1
    for (const link of links) {
      const s = nodes[link.source]
      const t = nodes[link.target]
      if (!s || !t) continue
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Draw nodes
    for (const node of nodes) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = node.degree > 0 ? '#4a90d9' : UI_COLORS.TEXT_SECONDARY
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Draw outline (before labels so labels render on top of everything)
    drawPlotOutline(ctx, 0.5, 0.5, width - 1, height - 1)

    // Draw labels — last step in rendering
    const fontSize = Math.max(8, Math.min(11, Math.round(r * 1.6)))
    ctx.font = `${fontSize}px ${SYSTEM_SANS_SERIF_STACK}`
    ctx.fillStyle = UI_COLORS.TEXT_PRIMARY
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    const visibleLabels = computeVisibleLabels(ctx, nodes, r, fontSize)
    for (const lbl of visibleLabels) {
      const node = nodes[lbl.nodeIndex]
      ctx.fillText(node.label, lbl.rect.x, lbl.rect.y)
    }

    finishCanvasDrawing(canvasState)
  }

  function handleMouseMove(event: MouseEvent) {
    if (!canvas) return
    const { x: mx, y: my } = getScaledMousePosition(canvasState, event)
    const { nodes } = layoutResult
    const hitR = nodeRadius + 4

    let hoveredNode: (typeof nodes)[0] | null = null
    for (const node of nodes) {
      const dx = mx - node.x
      const dy = my - node.y
      if (dx * dx + dy * dy <= hitR * hitR) {
        hoveredNode = node
        break
      }
    }

    if (hoveredNode) {
      const tooltipPos = getTooltipPosition(
        canvasState,
        hoveredNode.x + 10,
        hoveredNode.y,
        { x: 10, y: 0 }
      )
      updateTooltip({
        id: 'scangraph-tooltip',
        x: tooltipPos.x,
        y: tooltipPos.y,
        content: [
          { key: 'Participant', value: hoveredNode.label },
          { key: 'Connections', value: hoveredNode.degree.toString() },
        ],
        visible: true,
        width: 150,
      })
    } else {
      updateTooltip(null)
    }

    if (canvas) {
      canvas.style.cursor = hoveredNode ? 'pointer' : 'default'
    }
  }

  function handleMouseLeave() {
    updateTooltip(null)
    if (canvas) canvas.style.cursor = 'default'
  }

  $effect(() => {
    const _ = [data, width, height, dpiOverride]

    untrack(() => {
      refreshCanvasLifecycle({
        getState: () => canvasState,
        setState: newState => {
          canvasState = newState
        },
        getDimensions: getCanvasDimensions,
        getDpiOverride: () => dpiOverride,
        scheduleRender,
      })
    })
  })
</script>

<canvas
  bind:this={canvas}
  use:canvasLifecycleAction={{
    getState: () => canvasState,
    setState: newState => {
      canvasState = newState
    },
    getDimensions: getCanvasDimensions,
    getDpiOverride: () => dpiOverride,
    render: renderCanvas,
    scheduleRender,
  }}
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
></canvas>

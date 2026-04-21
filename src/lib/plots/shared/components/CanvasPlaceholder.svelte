<script lang="ts">
  import { drawCanvasPlaceholder } from '../drawCanvasPlaceholder'

  interface Props {
    width: number
    height: number
    message: string
  }

  let { width, height, message }: Props = $props()
  let canvas = $state<HTMLCanvasElement | null>(null)

  $effect(() => {
    if (!canvas) return
    const dpr = window.devicePixelRatio ?? 1
    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawCanvasPlaceholder(ctx, width, height, message)
  })
</script>

<canvas bind:this={canvas} class="placeholder-canvas"></canvas>

<style>
  .placeholder-canvas {
    display: block;
  }
</style>

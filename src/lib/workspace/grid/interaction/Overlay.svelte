<script lang="ts">
  import { gridToPixelDimensions, gridToPixelPosition } from '../pixels'
  import type { GridConfig } from '../types'
  import type { GridInteractionRect } from './model'

  interface Props {
    previews: GridInteractionRect[]
    gridConfig: GridConfig
    mode: 'moving' | 'resizing' | 'idle' | 'panning'
  }

  const { previews, gridConfig, mode }: Props = $props()

  function rectStyle(rect: GridInteractionRect): string {
    const position = gridToPixelPosition(rect.x, rect.y, gridConfig)
    const size = gridToPixelDimensions(rect.w, rect.h, gridConfig)
    return `
      transform: translate(${position.left}px, ${position.top}px);
      width: ${size.width}px;
      height: ${size.height}px;
    `
  }
</script>

{#each previews as preview (preview.id)}
  <div
    class="grid-interaction-overlay"
    class:moving={mode === 'moving'}
    class:resizing={mode === 'resizing'}
    style={rectStyle(preview)}
    aria-hidden="true"
  ></div>
{/each}

<style>
  .grid-interaction-overlay {
    position: absolute;
    z-index: 50;
    pointer-events: none;
    opacity: 0.55;
    border: 2px dashed var(--c-text);
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0
      var(--rounded-lg, 8px);
    background: var(--c-lightgrey);
    box-sizing: border-box;
  }

  .grid-interaction-overlay.moving,
  .grid-interaction-overlay.resizing {
    background: rgba(var(--c-main-rgb, 0, 0, 0), 0.05);
    border-color: var(--c-main);
  }
</style>

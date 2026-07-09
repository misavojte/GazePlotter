<script lang="ts">
  import ColorScalePicker from '../ColorScalePicker.svelte'
  import type { BulkContext } from './common'

  interface Props {
    bulk: BulkContext<{ colorScale?: string[] }>
    colorScale: string[] | undefined
    defaultMin: string
    defaultMax: string
    /** Visibility gate for mode-dependent sections (see keep-mounted note). */
    show?: boolean
  }

  let { bulk, colorScale, defaultMin, defaultMax, show = true }: Props = $props()
</script>

<!-- The picker stays mounted regardless of the gating mode — toggling via an
     outer `{#if}` broke the bindable plumbing in practice (the picker
     remounted with stale bindings on re-entry and its writes never reached
     parent state, so the colorScale commit never fired). Hide visually via
     `display: none`, but keep the component instance alive so the `bind:`
     bindings never tear down mid-edit. -->
<div style:display={show ? 'contents' : 'none'}>
  <ColorScalePicker
    {colorScale}
    {defaultMin}
    {defaultMax}
    onCommit={patch => bulk.update({ colorScale: patch })}
  />
</div>

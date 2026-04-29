<script lang="ts">
  /**
   * Color-scale picker with the standard mirror + commit machinery.
   *
   * Wraps `<ColorGradientPicker>` plus the `getColorScaleCommitted` /
   * `buildColorScalePatch` dance that four PaneSettings (aoi-stream,
   * evolving-metrics, transition-matrix, scanpath-similarity) used to
   * reimplement individually. The fragile microtask-vs-effect-scheduler
   * reasoning lives in this one component — `buildColorScalePatch` already
   * returns `null` when the draft matches committed, so the sync → commit
   * → sync round-trip self-terminates without needing a `syncingFromProps`
   * flag (which previously raced with Svelte's effect scheduler).
   *
   * Plots pass the current `colorScale` (or undefined to use the defaults),
   * the palette's min/max, and a commit callback that applies the patch to
   * settings.
   */
  import { ColorGradientPicker } from '$lib/color'
  import {
    buildColorScalePatch,
    getColorScaleCommitted,
  } from '../index'

  interface Props {
    colorScale: string[] | undefined
    /** Default lower bound when settings.colorScale is unset. */
    defaultMin: string
    /** Default upper bound when settings.colorScale is unset. */
    defaultMax: string
    /** Called with the new committed color array whenever the user changes it. */
    onCommit: (patch: string[]) => void
  }

  let { colorScale, defaultMin, defaultMax, onCommit }: Props = $props()

  const colorFields = $derived(
    getColorScaleCommitted(colorScale, defaultMin, defaultMax)
  )

  let colorMin = $state(colorFields.colorMin)
  let colorMiddle = $state(colorFields.colorMiddle)
  let colorMax = $state(colorFields.colorMax)

  $effect(() => {
    colorMin = colorFields.colorMin
    colorMiddle = colorFields.colorMiddle
    colorMax = colorFields.colorMax
  })

  $effect(() => {
    const patch = buildColorScalePatch(
      { colorMin, colorMiddle, colorMax },
      colorFields,
    )
    if (patch) onCommit(patch)
  })
</script>

<ColorGradientPicker bind:colorMin bind:colorMiddle bind:colorMax />

<script lang="ts">
  import type { PlotExportProps } from '$lib/modals/export/download-plot/types'
  import type { RecurrencePlotItem } from '$lib/plots/recurrence/types'
  import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
  import RecurrencePlotFigure from './RecurrencePlotFigure.svelte'
  import { getRecurrenceData } from '$lib/plots/recurrence/core/transformer'
  import {
    buildDiagonalLineMask,
    buildHorizontalLineMask,
    buildVerticalLineMask,
  } from '$lib/plots/recurrence/core/rqa'

  interface Props {
    item: RecurrencePlotItem
    engine: DataEngine
    exportProps: PlotExportProps
  }

  let { item, engine, exportProps }: Props = $props()
  const settings = $derived(item.settings)

  const recurrenceData = $derived.by(() => {
    return getRecurrenceData(engine, settings)
  })

  const highlightMask = $derived.by((): Uint8Array | null => {
    if (!recurrenceData) return null
    const h = settings.highlight
    if (h === 'none') return null

    const { matrix, fixationCount: N } = recurrenceData
    const L = settings.minLineLength
    const showLower = settings.masking !== 'diagonalLower'

    const mask = new Uint8Array(N * N)

    let lowerSrc: Uint8Array
    let upperSrc: Uint8Array

    if (h === 'diagonal') {
      const dMask = buildDiagonalLineMask(matrix, N, L)
      lowerSrc = dMask
      upperSrc = dMask
    } else if (h === 'horizontal') {
      lowerSrc = buildHorizontalLineMask(matrix, N, L)
      upperSrc = buildVerticalLineMask(matrix, N, L)
    } else {
      lowerSrc = buildVerticalLineMask(matrix, N, L)
      upperSrc = buildHorizontalLineMask(matrix, N, L)
    }

    if (showLower) {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          if (lowerSrc[i * N + j]) mask[i * N + j] = 1
        }
      }
    }

    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (upperSrc[i * N + j]) mask[j * N + i] = 1
      }
    }

    return mask
  })
</script>

{#if recurrenceData}
  <RecurrencePlotFigure
    data={recurrenceData}
    highlight={settings.highlight}
    masking={settings.masking}
    {highlightMask}
    width={exportProps.width}
    height={exportProps.height}
    dpiOverride={exportProps.dpiOverride}
    marginTop={exportProps.marginTop}
    marginRight={exportProps.marginRight}
    marginBottom={exportProps.marginBottom}
    marginLeft={exportProps.marginLeft}
  />
{/if}

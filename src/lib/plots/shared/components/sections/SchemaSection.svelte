<script lang="ts">
  // Direct file import (not the pane barrel): PaneSectionList renders this
  // component, so going through the barrel would create a module cycle.
  import PaneSection from '$lib/workspace/pane/PaneSection.svelte'
  import {
    Select,
    Radio,
    InputCheck,
    InputNumber,
    InputColor,
  } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { createBulkContext } from './common'
  import ColorScalePickerControl from './ColorScalePickerControl.svelte'
  import ScaleRangePair from './ScaleRangePair.svelte'
  import StimulusColorRange from './StimulusColorRange.svelte'
  import HideNoAoiCheck from './HideNoAoiCheck.svelte'
  import type {
    PaneSectionItem,
    SchemaPaneSectionEntry,
    SectionField,
    SectionFieldCtx,
  } from '$lib/plots/definePlot'

  /**
   * The one renderer behind every schema pane section (`fields`-shaped
   * `PaneSectionEntry`). Owns what the hand-written sections used to repeat:
   * bulk context + command provenance, Mixed display, `?? default` fallbacks,
   * the collapsed-header summary, and visibility gating.
   */
  let { item, entry }: { item: PaneSectionItem; entry: SchemaPaneSectionEntry } =
    $props()

  const { engine } = getGazePlotterSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the renderer
  // is deliberately untyped over the concrete settings shape; schema fields are
  // validated against the plot's defaults at registration instead.
  const bulk = createBulkContext<any>(() => item)

  const ctx: SectionFieldCtx = {
    engine,
    get settings() {
      return item.settings as Record<string, unknown>
    },
    common: read => bulk.common(read),
  }

  function fieldState(f: SectionField): { value: unknown; mixed: boolean } {
    if (f.kind === 'enum' && f.read) {
      return bulk.common(s => f.read!(s as Record<string, unknown>, engine))
    }
    const fallback = 'default' in f ? f.default : undefined
    return bulk.common(s => (s as Record<string, unknown>)[f.key] ?? fallback)
  }

  function optionsOf(
    f: Extract<SectionField, { kind: 'enum' }>
  ): readonly { value: string; label: string }[] {
    return typeof f.options === 'function' ? f.options(ctx) : f.options
  }

  const summary = $derived.by(() => {
    if (entry.summary) return entry.summary(ctx)
    const enums = entry.fields.filter(f => f.kind === 'enum')
    const sf = enums.find(f => f.summary) ?? enums[0]
    if (!sf) return undefined
    const { value, mixed } = fieldState(sf)
    if (mixed) return 'Mixed'
    return optionsOf(sf).find(o => o.value === value)?.label ?? String(value ?? '')
  })

  function commitNumber(
    f: Extract<SectionField, { kind: 'number' }>,
    v: number | undefined
  ) {
    // An emptied input commits the field default, else recommits the current
    // value — the two fallback behaviors the hand-written sections used.
    bulk.update({ [f.key]: v ?? f.default ?? fieldState(f).value })
  }

  function commitScaleRange(
    f: Extract<SectionField, { kind: 'scaleRange' }>,
    next: { min?: number; max?: number }
  ) {
    // Merge the untouched bound from each item's OWN pair so a bulk edit of
    // one bound never clobbers peers' other bound.
    bulk.updateEach(s => {
      const r = ((s as Record<string, unknown>)[f.key] as [number, number]) ?? [0, 0]
      return { [f.key]: [next.min ?? r[0], next.max ?? r[1]] }
    })
  }
</script>

<PaneSection title={entry.title} {summary}>
  {#each entry.fields as f (f.kind + ':' + f.key)}
    {@const visible = f.showWhen?.(ctx) ?? true}
    {#if f.kind === 'colorScale'}
      <!-- The picker manages its own keep-mounted gating (see its note). -->
      <ColorScalePickerControl
        {bulk}
        show={visible}
        colorScale={item.settings.colorScale as string[] | undefined}
        defaultMin={f.defaultMin}
        defaultMax={f.defaultMax}
      />
    {:else}
      <!-- Keep-mounted visibility for every control: `display: none` instead
           of `{#if}` so bindable plumbing never tears down mid-edit. -->
      <div style:display={visible ? 'contents' : 'none'}>
        {#if f.kind === 'enum'}
          {@const state = fieldState(f)}
          {#if f.control === 'radio'}
            <Radio
              options={[...optionsOf(f)]}
              legend={f.label ?? ''}
              ariaLabel={f.ariaLabel ?? f.label ?? entry.title}
              direction={f.direction ?? 'column'}
              appearance="compact"
              value={state.value as string}
              mixed={state.mixed}
              onchange={e => bulk.update({ [f.key]: e.detail })}
            />
          {:else}
            <Select
              options={optionsOf(f)}
              label={f.label}
              value={state.value as string}
              mixed={state.mixed}
              onchange={e => bulk.update({ [f.key]: e.detail })}
            />
          {/if}
        {:else if f.kind === 'boolean'}
          {@const state = fieldState(f)}
          <InputCheck
            label={f.label}
            appearance="compact"
            size="xs"
            checked={!!state.value}
            mixed={state.mixed}
            onchange={e => bulk.update({ [f.key]: (e as CustomEvent<boolean>).detail })}
          />
        {:else if f.kind === 'number'}
          {@const state = fieldState(f)}
          <InputNumber
            id="{entry.key}-{f.key}"
            label={f.label}
            appearance="compact"
            value={state.value as number}
            mixed={state.mixed}
            min={f.min}
            max={f.max}
            step={f.step}
            onValueChange={v => commitNumber(f, v)}
          />
        {:else if f.kind === 'color'}
          {@const state = fieldState(f)}
          <InputColor
            label={f.label}
            value={state.value as string}
            mixed={state.mixed}
            oninput={e => bulk.update({ [f.key]: e.detail })}
          />
        {:else if f.kind === 'scaleRange'}
          <ScaleRangePair
            idPrefix="{entry.key}-{f.key}"
            legend={f.legend}
            min={bulk.common(s => ((s as Record<string, unknown>)[f.key] as [number, number])?.[0] ?? 0)}
            max={bulk.common(s => ((s as Record<string, unknown>)[f.key] as [number, number])?.[1] ?? 0)}
            inputMax={f.inputMax}
            step={f.step}
            onUpdate={next => commitScaleRange(f, next)}
          />
        {:else if f.kind === 'stimulusColorRange'}
          <StimulusColorRange
            {bulk}
            idPrefix="{entry.key}-{f.key}"
            legend={f.legend}
            inputMax={f.inputMax}
            step={f.step}
          />
        {:else if f.kind === 'hideNoAoi'}
          <HideNoAoiCheck {bulk} />
        {/if}
      </div>
    {/if}
  {/each}
</PaneSection>

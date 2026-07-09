<script lang="ts">
  // Direct file import (not the pane barrel): PaneSectionList renders this
  // component, so going through the barrel would create a module cycle.
  import PaneSection from '$lib/workspace/pane/PaneSection.svelte'
  import {
    Select,
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
   * the collapsed-header summary, visibility gating, and the capped layout —
   * a vertical stack, optionally captioned (`group`), optionally two fields
   * per 1fr/1fr row (`pair`). Nothing more by design.
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

  // ── Layout: blocks (by consecutive `group` caption) of rows (pairs chunk
  // two-per-row). Derived from the entry, though in practice entries are
  // module constants; only VISIBILITY is meaningfully reactive.
  type RenderBlock = {
    caption: string | null
    rows: SectionField[][]
    fields: SectionField[]
  }
  const blocks: RenderBlock[] = $derived.by(() => {
    const built: RenderBlock[] = []
    let block: RenderBlock | null = null
    const fields = entry.fields
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i]
      const caption = f.group ?? null
      if (!block || block.caption !== caption) {
        block = { caption, rows: [], fields: [] }
        built.push(block)
      }
      block.fields.push(f)
      if (f.pair && fields[i + 1]?.pair && (fields[i + 1].group ?? null) === caption) {
        block.fields.push(fields[i + 1])
        block.rows.push([f, fields[i + 1]])
        i++
      } else {
        block.rows.push([f])
      }
    }
    return built
  })

  function fieldVisible(f: SectionField): boolean {
    return f.showWhen?.(ctx) ?? true
  }

  function anyVisible(fields: SectionField[]): boolean {
    return fields.some(fieldVisible)
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

{#snippet fieldControl(f: SectionField)}
  {@const visible = fieldVisible(f)}
  {@const state = fieldState(f)}
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
        <Select
          options={optionsOf(f)}
          label={f.label}
          value={state.value as string}
          mixed={state.mixed}
          onchange={e => bulk.update({ [f.key]: e.detail })}
        />
      {:else if f.kind === 'boolean'}
        <InputCheck
          label={f.label}
          appearance="compact"
          size="xs"
          checked={!!state.value}
          mixed={state.mixed}
          onchange={e => bulk.update({ [f.key]: (e as CustomEvent<boolean>).detail })}
        />
      {:else if f.kind === 'number'}
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
        <InputColor
          label={f.label}
          size="xs"
          width={40}
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
{/snippet}

{#snippet rowOf(row: SectionField[])}
  {#if row.length === 2}
    <div
      class="pair"
      style:display={anyVisible(row) ? undefined : 'none'}
    >
      {@render fieldControl(row[0])}
      {@render fieldControl(row[1])}
    </div>
  {:else}
    {@render fieldControl(row[0])}
  {/if}
{/snippet}

<PaneSection title={entry.title} {summary}>
  {#each blocks as block, i (i)}
    {#if block.caption}
      <div
        class="sub-group"
        style:display={anyVisible(block.fields) ? undefined : 'none'}
      >
        <div class="legend">{block.caption}</div>
        {#each block.rows as row, r (r)}
          {@render rowOf(row)}
        {/each}
      </div>
    {:else}
      {#each block.rows as row, r (r)}
        {@render rowOf(row)}
      {/each}
    {/if}
  {/each}
</PaneSection>

<style>
  .sub-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    margin-top: 4px;
  }

  .sub-group:first-child {
    margin-top: 0;
  }

  .sub-group .legend {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    line-height: 1.2;
    letter-spacing: 0.01em;
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: end;
  }
</style>

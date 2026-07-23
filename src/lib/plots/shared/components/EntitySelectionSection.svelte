<script lang="ts" module>
  import type { Component } from 'svelte'
  import type { DataEngine } from '$lib/data/engine'
  import type { ModalDefinition } from '$lib/modals/defineModal'

  /**
   * Everything that distinguishes one entity axis's section from another's.
   * The four axes (AOIs, stimuli, events, eye-movement types) are this ONE
   * component with different configs bound in `SHARED_SECTIONS`.
   */
  export interface EntitySectionConfig {
    /** Section header, e.g. "Areas of Interest". */
    title: string
    /** Label on the selection `Select`. */
    selectLabel: string
    /** The plot-settings key holding the picked selection id. */
    settingsKey: string
    /** The engine's global (stimulus-independent) selection list. */
    getSelections: (
      engine: DataEngine
    ) => readonly { id: number; name: string }[]
    /** The entity modal the edit link opens. */
    modal: ModalDefinition<Component<any>, any>
    /** Edit-link label, e.g. "Edit AOIs & selections". */
    editLabel: string
    /** Open the modal on the representative's stimulus (stimulus-scoped
     *  modal surfaces: AOIs, events). */
    passSelectedStimulus?: boolean
    /** Offer the built-in "None" option (empty narrowing = layer off).
     *  Only for axes where an empty selection is meaningful — events and
     *  eye-movement types — never for partition axes, where it would just
     *  blank the plot. */
    noneOption?: boolean
    /** Surface the plot-specific "Hide No AOI data" toggle beneath the picker
     *  (only the AOI axis carries it). Declared here as data so the section
     *  stays generic — no per-axis special-casing in the component body. Shown
     *  only when an edit target actually has the `hideNoAoi` setting. */
    hideNoAoiToggle?: boolean
  }
</script>

<script lang="ts">
  /**
   * THE entity-axis pane section — one config per selection-bearing axis
   * (AOIs, stimuli, events, eye-movement types): picks which named SELECTION
   * the plot narrows that axis to, plus the single edit link into the axis's
   * modal (names, colors, merges, selections — one surface). Selections are
   * global, so the option list is stimulus-independent —
   * `config.getSelections(engine)` plus a leading "All" (unset / id 0 = no
   * narrowing; self-healing on unknown ids) and, on layer axes, the built-in
   * "None" (empty narrowing = layer off).
   *
   * A bespoke component (not a schema section) because the `Select` +
   * edit-link pair and the "0 = All" summary don't fit the schema field
   * layout; it mirrors `TimelineRangeSection`'s shape and reuses
   * `createBulkContext` for the same "Mixed"-aware single/bulk editing every
   * pane section gets.
   */
  import { Select, InputCheck } from '$lib/shared/components'
  import { PaneSection, PaneEditLink, PaneEditRow } from '$lib/workspace/pane'
  import { getGazePlotterSession } from '$lib/session'
  import {
    ALL_SELECTION_LABEL,
    NONE_SELECTION_ID,
    NONE_SELECTION_LABEL,
  } from '$lib/data/types'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { createBulkContext } from './sections/common'
  import type { PaneSectionItem } from '../../definePlot'

  interface Props {
    item: PaneSectionItem
    config: EntitySectionConfig
  }

  let { item, config }: Props = $props()

  const { engine, modalState } = getGazePlotterSession()
  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))
  const bulk = createBulkContext<Record<string, unknown>>(() => item)

  const selections = $derived(config.getSelections(engine))
  const options = $derived([
    { value: '0', label: ALL_SELECTION_LABEL },
    ...(config.noneOption
      ? [{ value: String(NONE_SELECTION_ID), label: NONE_SELECTION_LABEL }]
      : []),
    ...selections.map(s => ({ value: String(s.id), label: s.name })),
  ])

  // Bulk-aware: the id common to every edit target, or "Mixed" when they
  // differ. `?? 0` folds unset into the "All" option value.
  const state = $derived(
    bulk.common(s => (s[config.settingsKey] as number | undefined) ?? 0)
  )

  // Non-null when the toggle applies: the axis carries it (config) AND some
  // edit target has the `hideNoAoi` setting — presence is checked over the
  // SAME edit-target set `bulk` writes to (no parallel copy of
  // createBulkContext's target resolution).
  const hideNoAoi = $derived.by(() => {
    if (!config.hideNoAoiToggle) return null
    const present = bulk.common(s => 'hideNoAoi' in s)
    if (!present.value && !present.mixed) return null
    return bulk.common(s => (s.hideNoAoi as boolean | undefined) ?? false)
  })

  const summary = $derived.by(() => {
    if (state.mixed) return 'Mixed'
    const baseName =
      state.value === NONE_SELECTION_ID
        ? NONE_SELECTION_LABEL
        : !state.value
          ? ALL_SELECTION_LABEL
          : (selections.find(s => s.id === state.value)?.name ?? ALL_SELECTION_LABEL)
    // Only deviations from the default surface in the summary.
    if (hideNoAoi?.mixed) return `${baseName} (mixed No AOI)`
    if (hideNoAoi?.value) return `${baseName} - No AOI`
    return baseName
  })
</script>

<PaneSection title={config.title} {summary}>
  <Select
    {options}
    label={config.selectLabel}
    compact
    value={String(state.value ?? 0)}
    mixed={state.mixed}
    onchange={e => bulk.update({ [config.settingsKey]: Number(e.detail) })}
  />
  {#if hideNoAoi}
    <InputCheck
      label="Hide No AOI data"
      compact
      checked={!!hideNoAoi.value}
      mixed={hideNoAoi.mixed}
      onchange={e => bulk.updateEach(s => ('hideNoAoi' in s ? { hideNoAoi: (e as CustomEvent<boolean>).detail } : null))}
    />
  {/if}
  <PaneEditRow>
    <PaneEditLink
      onclick={() =>
        void modalState.open(config.modal, {
          source,
          ...(config.passSelectedStimulus
            ? { selectedStimulus: String(item.settings.stimulusId ?? 0) }
            : {}),
        })}
    >
      {config.editLabel}
    </PaneEditLink>
  </PaneEditRow>
</PaneSection>

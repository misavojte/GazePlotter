<script lang="ts">
  import { onMount } from 'svelte'
  import { InputNumber, InputText, Select } from '$lib/shared/components'
  import type { SelectOption } from '$lib/shared/components'
  import { ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getMetric, getRecipe } from '$lib/metrics/core/defineMetric'
  import {
    defaultInstanceLabel,
    resolveInstance,
    type MetricInstance,
  } from '$lib/metrics/instances'
  import Check from 'lucide-svelte/icons/check'
  import {
    PROJECTION_LEAVES,
    MATRIX_REDUCERS,
    identityFor,
    leafKindHint,
    leafKindLabel,
    type Projection,
    type LeafProjection,
    type LeafKind,
    type AoiReducer,
    type MatrixReducer,
    type WindowSpec,
  } from '$lib/metrics/core/projection'
  import { recipeSupports } from '$lib/metrics/core/validation'
  import { metricLeafKindsInContract, contractReductions, type PlotMetricContract } from '$lib/metrics/filters'
  import type { Metric } from '$lib/metrics/core/dsl'
  import type { GroupReduction } from '$lib/metrics/core/measurement'
  import type { ParamDef } from '$lib/metrics/core/params'
  import { resolveParams } from '$lib/metrics/core/params'
  import { getAois } from '$lib/data/engine'
  import type { CreateInstanceHandler } from '$lib/plots/shared/metricInstanceHandlers'

  interface Props {
    contract: PlotMetricContract
    selectedMetricId?: string // Present in Create Mode
    editMetricId?: string // Present in Edit Mode
    initialParams?: Record<string, unknown> // Used for duplication
    initialProjection?: Projection // Used for duplication
    initialLabel?: string // Used for duplication
    initialReduction?: GroupReduction // Used for duplication
    oncreateInstance?: CreateInstanceHandler
    onrenameInstance?: (id: string, label: string) => void
  }

  let {
    contract,
    selectedMetricId,
    editMetricId,
    initialParams,
    initialProjection,
    initialLabel,
    initialReduction,
    oncreateInstance,
    onrenameInstance,
  }: Props = $props()

  const { engine, modalState } = getGazePlotterSession()

  // Mode identification
  const mode = $derived(editMetricId ? 'edit' : 'create')

  // State
  let paramDraft = $state<Record<string, unknown>>({})
  let labelOverride = $state('')
  let leafDraft = $state<LeafProjection>({ kind: 'identity-scalar' })
  let windowDraft = $state<WindowSpec | null>(null)
  let currentBaseId = $state<string>('')
  let metric = $state<Metric | undefined>(undefined)
  // The cross-participant reduction for this instance. Initialised from the
  // instance override (edit) / duplication seed (create), else the metric's
  // default. Only persisted when it differs from the default. The OPTIONS are a
  // pure intersection of the plot contract and the metric class
  // (`contractReductions`) — a reduce-mode plot over an extensive metric shows
  // [mean, sum]; every other case shows ≤1 option and the control is hidden.
  let reductionDraft = $state<GroupReduction>('mean')
  const reductionOptions = $derived(
    metric ? contractReductions(contract, metric.meta) : []
  )

  const aoiNameUnion = $derived.by(() => {
    const set = new Set<string>()
    const stimuli = engine.metadata?.stimuli.data ?? []
    for (let sid = 0; sid < stimuli.length; sid++) {
      for (const a of getAois(engine, sid)) set.add(a.displayedName)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  })

  // Unpack a stored/seeded projection into the two drafts the form edits.
  function seedProjection(p: Projection) {
    if (p.kind === 'windowed') {
      leafDraft = { ...p.inner }
      windowDraft = { ...p.window }
    } else {
      leafDraft = { ...p }
      windowDraft = null
    }
  }

  onMount(() => {
    if (mode === 'edit' && editMetricId) {
      const inst = resolveInstance(engine.metadata?.metricInstances ?? [], editMetricId)
      if (inst) {
        currentBaseId = inst.baseId
        metric = getMetric(inst.baseId)
        paramDraft = { ...inst.params }
        seedProjection(inst.projection)
        reductionDraft = inst.reduction ?? metric?.meta.defaultReduction ?? 'mean'
        const autoLabel = defaultInstanceLabel(inst.baseId)
        labelOverride = inst.label !== autoLabel ? inst.label : ''
      }
    } else if (mode === 'create' && selectedMetricId) {
      currentBaseId = selectedMetricId
      metric = getMetric(selectedMetricId)
      if (metric) {
        reductionDraft = initialReduction ?? metric.meta.defaultReduction
        paramDraft =
          initialParams ??
          (resolveParams(metric.meta.params, undefined) as Record<string, unknown>)
        labelOverride = initialLabel ?? ''

        if (initialProjection) {
          seedProjection(initialProjection)
        } else {
          const firstLeaf = availableLeavesFor(metric)[0] ?? identityFor(metric.meta.rawShape).kind
          leafDraft = buildLeaf(firstLeaf)
          windowDraft = contract.windowing === 'required' && canBeWindowed(metric, leafDraft)
            ? defaultWindow(metric, leafDraft)
            : null
        }
      }
    }
  })

  function buildLeaf(kind: LeafKind, currentAoi: string | undefined = undefined): LeafProjection {
    const defaultAoi = currentAoi ?? aoiNameUnion[0] ?? ''
    switch (kind) {
      case 'identity-scalar':                    return { kind }
      case 'identity-aoi-vector':                return { kind }
      case 'identity-aoi-pair-matrix':           return { kind }
      case 'identity-participant-pair-matrix':   return { kind }
      case 'pick-aoi':         return { kind, aoiRef: { by: 'name', name: defaultAoi } }
      case 'pick-any-fixation': return { kind }
      case 'aggregate-aoi':    return { kind, reducer: aoiExtremeOptions()[0]?.value ?? 'max' }
      case 'matrix-diagonal':  return { kind }
      case 'matrix-row':       return { kind, aoiRef: { by: 'name', name: defaultAoi } }
      case 'matrix-col':       return { kind, aoiRef: { by: 'name', name: defaultAoi } }
      case 'matrix-cell':      return {
        kind,
        fromAoi: { by: 'name', name: defaultAoi },
        toAoi:   { by: 'name', name: aoiNameUnion[1] ?? defaultAoi },
      }
      case 'matrix-aggregate': return {
        kind,
        reducer: availableMatrixReducers()[0] ?? 'mean',
      }
    }
  }

  // The reachable projection leaves for this metric under the plot contract —
  // the single shared predicate (metrics layer), so the tabs here, the pickers,
  // and the library banner can never disagree on what a metric can become.
  function availableLeavesFor(m: Metric): LeafKind[] {
    return metricLeafKindsInContract(m, contract)
  }

  function canBeWindowed(m: Metric, leaf: LeafProjection): boolean {
    if (contract.windowing === 'forbidden') return false
    if (m.meta.supportsWindowing === false) return false
    const inner = PROJECTION_LEAVES[leaf.kind].outputShape
    return inner === 'scalar' || inner === 'aoi-vector'
  }

  function defaultWindow(m: Metric, leaf: LeafProjection): WindowSpec {
    if (m.meta.windowUnit === 'fixations') {
      return { windowSize: 20, stepSize: 20 }
    }
    const inner = PROJECTION_LEAVES[leaf.kind].outputShape
    if (inner === 'aoi-vector') return { windowSize: 500, stepSize: 500 }
    return { windowSize: 2000, stepSize: 2000 }
  }

  function buildProjection(leaf: LeafProjection, window: WindowSpec | null): Projection {
    return window ? { kind: 'windowed', window, inner: leaf } : leaf
  }

  function handleCancel() {
    modalState.close()
  }

  // The instance fields the form currently describes. The reduction override is
  // persisted only when it diverges from the metric default and is offered for
  // this plot+metric; otherwise the instance rides the default (no redundant key).
  function draftValues() {
    const metricDefault = metric!.meta.defaultReduction
    const chosenRed = reductionOptions.includes(reductionDraft) ? reductionDraft : metricDefault
    return {
      projection: buildProjection(leafDraft, windowDraft),
      params: { ...paramDraft },
      label: labelOverride.trim() || defaultInstanceLabel(currentBaseId),
      reduction: chosenRed !== metricDefault ? chosenRed : undefined,
      chosenRed,
      metricDefault,
    }
  }

  // Edit mode: apply the form to the existing instance in place (a pure rename
  // when nothing but the label changed, else replace).
  function changeMetric() {
    if (!metric || !editMetricId) return
    const { projection, params, label, reduction, chosenRed, metricDefault } = draftValues()
    const orig = resolveInstance(engine.metadata?.metricInstances ?? [], editMetricId)
    const unchanged =
      JSON.stringify(params) === JSON.stringify(orig?.params ?? {}) &&
      JSON.stringify(projection) === JSON.stringify(orig?.projection) &&
      (orig?.reduction ?? metricDefault) === chosenRed
    modalState.close()
    if (unchanged) {
      onrenameInstance?.(editMetricId, label)
    } else {
      oncreateInstance?.(currentBaseId, params, label, projection, editMetricId, reduction)
    }
  }

  // Create a brand-new instance from the form — used by create mode and by
  // "Create new" while editing (the original instance is left untouched).
  function createNew() {
    if (!metric) return
    const { projection, params, label, reduction } = draftValues()
    modalState.closeToRoot()
    oncreateInstance?.(currentBaseId, params, label, projection, undefined, reduction)
  }

  // The Enter-key / primary action for the current mode.
  function submitForm() {
    if (mode === 'edit') changeMetric()
    else createNew()
  }

  const buttons = $derived(
    mode === 'edit'
      ? [
          { label: 'Save changes', onclick: changeMetric, variant: 'primary' as const },
          { label: 'Save as new', onclick: createNew, variant: 'secondary' as const },
          { label: 'Cancel', onclick: handleCancel, variant: 'secondary' as const },
        ]
      : [
          { label: 'Add metric', onclick: createNew, variant: 'primary' as const },
          { label: 'Cancel', onclick: handleCancel, variant: 'secondary' as const },
        ],
  )

  function liveLabel(baseId: string): string {
    const override = labelOverride.trim()
    return override.length > 0 ? override : defaultInstanceLabel(baseId)
  }

  function paramSelectOptions(p: ParamDef<unknown>): SelectOption[] {
    return (p.options ?? []).map(o => ({ label: o.label, value: o.value as string }))
  }

  /**
   * The extremes this metric NAMES (its `aoiAggregate` declaration), as select
   * options wearing the metric's own phrase — "Most-dwelled AOI (max)" — so
   * the chooser teaches exactly what the figure will later disclose. Iterated
   * in DECLARATION order: the recipe names its canonical extreme first (TTFF
   * names min, 'first-reached AOI'), and that one becomes the default. Still
   * routed through `recipeSupports` so an author-level `rejects` hook holds.
   */
  function aoiExtremeOptions(): { value: 'max' | 'min'; label: string }[] {
    const recipe = getRecipe(currentBaseId); if (!recipe) return []
    const named = getMetric(currentBaseId)?.meta.aoiAggregate ?? {}
    return (Object.keys(named) as ('max' | 'min')[])
      .filter(r => (r === 'max' || r === 'min') && named[r] &&
        recipeSupports(recipe, { kind: 'aggregate-aoi', reducer: r }) === true)
      .map(r => {
        const phrase = named[r]!
        return { value: r, label: `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} (${r})` }
      })
  }

  function availableMatrixReducers(exclude?: 'diagonal'): MatrixReducer[] {
    const recipe = getRecipe(currentBaseId); if (!recipe) return []
    return MATRIX_REDUCERS.filter(r =>
      recipeSupports(recipe, { kind: 'matrix-aggregate', reducer: r, ...(exclude ? { exclude } : {}) }) === true,
    )
  }

  // Reduction choices come from the SAME `contractReductions` predicate the
  // readout derives from (metrics layer), so the control and the disclosed
  // reduction can never disagree.
  function reductionOptionLabel(method: GroupReduction): string {
    switch (method) {
      case 'sum':  return 'Sum (total)'
      case 'mean': return 'Mean (average)'
    }
  }

  // Every yes/no control is a Select, so the whole config reads as one kind of
  // input (no lone switches).
  const YES_NO: SelectOption[] = [
    { value: 'no', label: 'No' },
    { value: 'yes', label: 'Yes' },
  ]

  // The shared Select dispatches CustomEvent<string> — one cast, one place.
  const detail = (e: Event) => (e as CustomEvent<string>).detail

  // Which leaves need per-shape configuration (an AOI to pick, a reducer to
  // choose) — so a config panel only renders under the selected card when there's
  // actually something to set.
  function leafHasConfig(kind: LeafKind): boolean {
    return (
      kind === 'pick-aoi' ||
      kind === 'matrix-row' ||
      kind === 'matrix-col' ||
      kind === 'matrix-cell' ||
      kind === 'aggregate-aoi' ||
      kind === 'matrix-aggregate'
    )
  }

  function updateLeafAoiRef(name: string) {
    if (leafDraft.kind === 'pick-aoi' || leafDraft.kind === 'matrix-row' || leafDraft.kind === 'matrix-col') {
      leafDraft = { ...leafDraft, aoiRef: { by: 'name', name } } as LeafProjection
    }
  }

  // The two matrix-cell endpoints are one control rendered twice (see the
  // template's CELL_SIDES loop); this is its single write path.
  const CELL_SIDES = [
    { side: 'fromAoi', label: 'From AOI' },
    { side: 'toAoi', label: 'To AOI' },
  ] as const

  function updateCellAoi(side: 'fromAoi' | 'toAoi', name: string) {
    if (leafDraft.kind !== 'matrix-cell') return
    const ref = { by: 'name', name } as const
    leafDraft =
      side === 'fromAoi' ? { ...leafDraft, fromAoi: ref } : { ...leafDraft, toAoi: ref }
  }

  // AOI dropdown options — the known AOIs, plus the current value when it names an
  // AOI not in any loaded stimulus (so editing an instance never drops its AOI).
  function aoiOptions(current: string): SelectOption[] {
    const names =
      current && !aoiNameUnion.includes(current) ? [current, ...aoiNameUnion] : aoiNameUnion
    return names.map(n => ({ label: n, value: n }))
  }
</script>

<div class="configure-metric-container">
  {#if metric}
    {@const leaves = availableLeavesFor(metric)}
    {@const windowable = canBeWindowed(metric, leafDraft)}
    {@const windowingLocked = contract.windowing === 'required'}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      class="form-inner"
      onsubmit={e => { e.preventDefault(); submitForm() }}
      onkeydown={e => { if (e.key === 'Escape') { e.preventDefault(); handleCancel() } }}
    >
      <section class="cfg-section">
        <div class="cfg-title">Metric Information</div>
        <p class="metric-description">{metric.meta.description}</p>
        <div class="cfg-meta">Unit: <strong>{metric.meta.unit || 'none'}</strong></div>
      </section>

      <!-- The metric's own parameters (e.g. which statistic, a radius). Omitted
           when the metric has none, so simple metrics go straight to the label. -->
      {#if metric.meta.params.length > 0}
        <section class="cfg-section">
          <div class="cfg-title">Metric Parameters</div>
          {#each metric.meta.params as param (param.id)}
            {#if param.type === 'enum'}
              <Select
                compact
                label={param.label}
                options={paramSelectOptions(param)}
                value={String(paramDraft[param.id] ?? param.default)}
                onchange={e => {
                  paramDraft = { ...paramDraft, [param.id]: detail(e) }
                }}
              />
            {:else if param.type === 'integer' || param.type === 'number'}
              <InputNumber
                id={`modal-param-${metric.meta.id}-${param.id}`}
                label={param.label}
                value={Number(paramDraft[param.id] ?? param.default)}
                min={param.min}
                max={param.max}
                step={param.type === 'integer' ? 1 : (param.step ?? 0.01)}
                compact
                onValueChange={v => { if (v !== undefined) paramDraft = { ...paramDraft, [param.id]: v } }}
              />
            {:else if param.type === 'boolean'}
              <Select
                compact
                label={param.label}
                options={YES_NO}
                value={Boolean(paramDraft[param.id] ?? param.default) ? 'yes' : 'no'}
                onchange={e => {
                  paramDraft = { ...paramDraft, [param.id]: detail(e) === 'yes' }
                }}
              />
            {/if}
          {/each}
        </section>
      {/if}

      {#snippet shapeConfig()}
        {#if metric}
          {#if leafDraft.kind === 'pick-aoi' || leafDraft.kind === 'matrix-row' || leafDraft.kind === 'matrix-col'}
            {@const currentName = leafDraft.aoiRef.by === 'name' ? leafDraft.aoiRef.name : ''}
            <Select
              compact
              label="AOI"
              options={aoiOptions(currentName)}
              value={currentName}
              placeholder="Choose an AOI"
              emptyMessage="No AOIs in the loaded stimuli"
              onchange={(e) => updateLeafAoiRef(detail(e))}
            />
          {/if}

          {#if leafDraft.kind === 'matrix-cell'}
            {@const cell = leafDraft}
            <div class="two-col">
              {#each CELL_SIDES as { side, label } (side)}
                {@const ref = cell[side]}
                {@const currentName = ref.by === 'name' ? ref.name : ''}
                <Select
                  compact
                  {label}
                  options={aoiOptions(currentName)}
                  value={currentName}
                  placeholder="Choose an AOI"
                  emptyMessage="No AOIs in the loaded stimuli"
                  onchange={(e) => updateCellAoi(side, detail(e))}
                />
              {/each}
            </div>
          {/if}

          {#if leafDraft.kind === 'aggregate-aoi'}
            <Select
              compact
              label="Which AOI"
              options={aoiExtremeOptions()}
              value={leafDraft.reducer}
              onchange={(e) => {
                leafDraft = { kind: 'aggregate-aoi', reducer: detail(e) as AoiReducer }
              }}
            />
          {/if}

          {#if leafDraft.kind === 'matrix-aggregate'}
            <Select
              compact
              label="Summarize by"
              options={availableMatrixReducers(leafDraft.exclude).map(r => ({ label: r.charAt(0).toUpperCase() + r.slice(1), value: r }))}
              value={leafDraft.reducer}
              onchange={(e) => {
                const r = detail(e) as MatrixReducer
                const exclude = leafDraft.kind === 'matrix-aggregate' ? leafDraft.exclude : undefined
                leafDraft = { kind: 'matrix-aggregate', reducer: r, ...(exclude ? { exclude } : {}) }
              }}
            />
            <Select
              compact
              label="Exclude self-transitions"
              options={YES_NO}
              value={leafDraft.exclude === 'diagonal' ? 'yes' : 'no'}
              onchange={(e) => {
                if (leafDraft.kind !== 'matrix-aggregate') return
                const on = detail(e) === 'yes'
                leafDraft = { kind: 'matrix-aggregate', reducer: leafDraft.reducer, ...(on ? { exclude: 'diagonal' as const } : {}) }
              }}
            />
          {/if}
        {/if}
      {/snippet}

      <!-- Choosing what the metric produces is a real choice ONLY when the metric
           offers more than one projection here; a single-projection metric has
           nothing to pick, so the section is omitted rather than shown pre-decided. -->
      {#if leaves.length > 1}
        <section class="cfg-section">
          <div class="cfg-title">What this produces</div>
          <div class="shape-options">
            {#each leaves as kind (kind)}
              {@const selected = leafDraft.kind === kind}
              <button
                type="button"
                class="shape-option"
                class:selected
                aria-pressed={selected}
                onclick={() => {
                  if (leafDraft.kind === kind) return
                  leafDraft = buildLeaf(kind)
                  if (windowDraft && !canBeWindowed(metric!, leafDraft)) windowDraft = null
                }}
              >
                <span class="so-text">
                  <span class="so-name">{leafKindLabel(kind)}</span>
                  <span class="so-hint">{leafKindHint(kind)}</span>
                </span>
                {#if selected}<span class="so-check"><Check size={15} /></span>{/if}
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Configuration for the chosen projection: an AOI/reducer to pick, whether
           to evaluate over time, how to combine participants. Omitted entirely when
           the current projection has nothing to set. -->
      {#if leafHasConfig(leafDraft.kind) || windowable || reductionOptions.length > 1}
        <section class="cfg-section">
          <div class="cfg-title">Options</div>

          {@render shapeConfig()}

          {#if windowable}
            <!-- When windowing is required there's no choice, so the toggle is
                 omitted; the window/step controls below carry the configuration. -->
            {#if !windowingLocked}
              <Select
                compact
                label="Over time"
                options={YES_NO}
                value={windowDraft ? 'yes' : 'no'}
                onchange={(e) => {
                  const on = detail(e) === 'yes'
                  windowDraft = on ? (windowDraft ?? defaultWindow(metric!, leafDraft)) : null
                }}
              />
            {/if}

            {#if windowDraft}
              {@const unit = metric.meta.windowUnit === 'fixations' ? 'fix' : 'ms'}
              <div class="two-col">
                <InputNumber
                  id="modal-window-{metric.meta.id}"
                  label={`Window (${unit})`}
                  compact
                  value={windowDraft.windowSize}
                  min={metric.meta.windowUnit === 'fixations' ? 2 : 100}
                  step={metric.meta.windowUnit === 'fixations' ? 1 : 100}
                  onValueChange={(v) => { if (windowDraft && v !== undefined) windowDraft = { ...windowDraft, windowSize: v } }}
                />
                <InputNumber
                  id="modal-step-{metric.meta.id}"
                  label={`Step (${unit})`}
                  compact
                  value={windowDraft.stepSize}
                  min={metric.meta.windowUnit === 'fixations' ? 1 : 100}
                  step={metric.meta.windowUnit === 'fixations' ? 1 : 100}
                  onValueChange={(v) => { if (windowDraft && v !== undefined) windowDraft = { ...windowDraft, stepSize: v } }}
                />
              </div>
            {/if}
          {/if}

          {#if reductionOptions.length > 1}
            <Select
              compact
              label="Across participants"
              options={reductionOptions.map(m => ({ label: reductionOptionLabel(m), value: m }))}
              value={reductionOptions.includes(reductionDraft) ? reductionDraft : metric.meta.defaultReduction}
              onchange={(e) => { reductionDraft = detail(e) as GroupReduction }}
            />
          {/if}
        </section>
      {/if}

      <section class="cfg-section">
        <div class="cfg-title">Label</div>
        <InputText
          id="modal-label-{metric.meta.id}"
          label="Label"
          compact
          showLabel={false}
          ariaLabel="Metric label"
          bind:value={labelOverride}
          placeholder={liveLabel(currentBaseId)}
        />
      </section>

      <button type="submit" class="enter-submit" tabindex="-1" aria-hidden="true"></button>
      <ModalButtons {buttons} />
    </form>
  {/if}
</div>

<style>
  .configure-metric-container {
    display: flex;
    flex-direction: column;
    width: min(560px, calc(100vw - 4rem));
    gap: 12px;
  }

  .form-inner { display: flex; flex-direction: column; }

  /* Sections are separated by a divider and a generous gap so every config reads
     the same; sections with nothing to set are omitted (see the template). */
  .cfg-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cfg-section:not(:first-child) {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--c-grey);
  }
  .cfg-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-darkgrey);
  }
  .cfg-meta { font-size: 12px; color: var(--c-darkgrey); }

  .metric-description {
    font-size: 11px;
    color: var(--c-darkgrey);
    line-height: 1.5;
    margin: 0;
    padding-bottom: 2px;
  }


  /* ── Shape selector — one selectable card per shape ── */
  .shape-options { display: flex; flex-direction: column; gap: 6px; }

  .shape-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 11px;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    background: var(--c-white);
    cursor: pointer;
    text-align: left;
    outline: none;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }
  .shape-option:hover { border-color: var(--c-darkgrey); }
  .shape-option:focus-visible { border-color: var(--c-brand); }
  .shape-option.selected {
    border-color: var(--c-brand);
    background: color-mix(in srgb, var(--c-brand) 4%, var(--c-white));
    cursor: default;
  }

  .so-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
  .so-name { font-size: 12.5px; font-weight: 600; color: var(--c-text); }
  .so-hint { font-size: 11px; color: var(--c-darkgrey); line-height: 1.35; }
  .so-check { display: flex; flex-shrink: 0; color: var(--c-brand); }

  /* Window + Step sit side by side. */
  /* Mirrors the pane's paired-field grid (SchemaSection `.pair`): equal columns,
     bottom-aligned so controls line up even when one label wraps. */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end; }

  /* Off-screen submit target so Enter still commits the primary action; the
     visible buttons are the shared ModalButtons. */
  .enter-submit {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    border: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>

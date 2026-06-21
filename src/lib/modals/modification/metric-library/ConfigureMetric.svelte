<script lang="ts">
  import { onMount } from 'svelte'
  import { slide } from 'svelte/transition'
  import ArrowLeft from 'lucide-svelte/icons/arrow-left'
  import { InputNumber, Select } from '$lib/shared/components'
  import type { SelectOption } from '$lib/shared/components'
  import { getGazePlotterSession } from '$lib/session'
  import { getMetric, getRecipe } from '$lib/metrics/core/defineMetric'
  import {
    defaultInstanceLabel,
    resolveInstance,
    type MetricInstance,
  } from '$lib/metrics/instances'
  import {
    PROJECTION_LEAVES,
    AOI_REDUCERS,
    MATRIX_REDUCERS,
    identityFor,
    supportedLeaves,
    type Projection,
    type LeafProjection,
    type LeafKind,
    type AoiReducer,
    type MatrixReducer,
    type WindowSpec,
  } from '$lib/metrics/core/projection'
  import { recipeSupports } from '$lib/metrics/core/validation'
  import { contractLeafKinds, type PlotMetricContract } from '$lib/metrics/filters'
  import type { Metric, GroupAggregation } from '$lib/metrics/core/dsl'
  import type { ParamDef } from '$lib/metrics/core/params'
  import { resolveParams } from '$lib/metrics/core/params'
  import { getAois } from '$lib/data/engine'

  interface Props {
    contract: PlotMetricContract
    selectedMetricId?: string // Present in Create Mode
    editMetricId?: string // Present in Edit Mode
    initialParams?: Record<string, unknown> // Used for duplication
    initialProjection?: Projection // Used for duplication
    initialLabel?: string // Used for duplication
    initialAggregation?: GroupAggregation // Used for duplication
    oncreateInstance?: (
      baseId: string,
      params: Record<string, unknown>,
      label: string,
      projection: Projection,
      replacingId?: string,
      groupAggregation?: GroupAggregation,
    ) => void
    onrenameInstance?: (id: string, label: string) => void
  }

  let {
    contract,
    selectedMetricId,
    editMetricId,
    initialParams,
    initialProjection,
    initialLabel,
    initialAggregation,
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
  // The effective cross-participant statistic for this instance. Initialised
  // from the instance override (edit) / duplication seed (create), else the
  // recipe default. Only persisted when it differs from the recipe default.
  let aggregationDraft = $state<GroupAggregation>('mean')
  const aggregationOptions = $derived(
    availableAggregations(currentBaseId, buildProjection(leafDraft, windowDraft))
  )

  const aoiNameUnion = $derived.by(() => {
    const set = new Set<string>()
    const stimuli = engine.metadata?.stimuli.data ?? []
    for (let sid = 0; sid < stimuli.length; sid++) {
      for (const a of getAois(engine, sid)) set.add(a.displayedName)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  })

  onMount(() => {
    if (mode === 'edit' && editMetricId) {
      const inst = resolveInstance(engine.metadata?.metricInstances ?? [], editMetricId)
      if (inst) {
        currentBaseId = inst.baseId
        metric = getMetric(inst.baseId)
        paramDraft = { ...inst.params }
        if (inst.projection.kind === 'windowed') {
          leafDraft = { ...inst.projection.inner }
          windowDraft = { ...inst.projection.window }
        } else {
          leafDraft = { ...inst.projection }
          windowDraft = null
        }
        aggregationDraft = inst.groupAggregation ?? metric?.meta.groupAggregation ?? 'mean'
        const autoLabel = defaultInstanceLabel(inst.baseId)
        labelOverride = inst.label !== autoLabel ? inst.label : ''
      }
    } else if (mode === 'create' && selectedMetricId) {
      currentBaseId = selectedMetricId
      metric = getMetric(selectedMetricId)
      if (metric) {
        aggregationDraft = initialAggregation ?? metric.meta.groupAggregation
        if (initialParams) {
          paramDraft = { ...initialParams }
        } else {
          paramDraft = resolveParams(metric.meta.params, undefined) as Record<string, unknown>
        }

        if (initialLabel) {
          labelOverride = initialLabel
        } else {
          labelOverride = ''
        }

        if (initialProjection) {
          if (initialProjection.kind === 'windowed') {
            leafDraft = { ...initialProjection.inner }
            windowDraft = { ...initialProjection.window }
          } else {
            leafDraft = { ...initialProjection }
            windowDraft = null
          }
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

  function buildLeaf(kind: LeafKind, currentAoi?: string): LeafProjection {
    const defaultAoi = currentAoi ?? aoiNameUnion[0] ?? ''
    switch (kind) {
      case 'identity-scalar':                    return { kind }
      case 'identity-aoi-vector':                return { kind }
      case 'identity-aoi-pair-matrix':           return { kind }
      case 'identity-participant-pair-matrix':   return { kind }
      case 'pick-aoi':         return { kind, aoiRef: { by: 'name', name: defaultAoi } }
      case 'pick-any-fixation': return { kind }
      case 'aggregate-aoi':    return { kind, reducer: availableAoiReducers(currentBaseId)[0] ?? 'max' }
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
        reducer: availableMatrixReducers(currentBaseId)[0] ?? 'mean',
      }
    }
  }

  function availableLeavesFor(m: Metric): LeafKind[] {
    const allowedByContract = new Set(contractLeafKinds(contract))
    const recipe = getRecipe(m.meta.id)
    if (!recipe) return []
    return supportedLeaves(m).filter(kind =>
      allowedByContract.has(kind) &&
      recipeSupports(recipe, buildLeaf(kind, aoiNameUnion[0])) === true,
    )
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

  function commitForm() {
    if (!metric) return
    const projection = buildProjection(leafDraft, windowDraft)
    const params = { ...paramDraft }
    const label = labelOverride.trim() || defaultInstanceLabel(currentBaseId)

    // Persist the aggregation only when it diverges from the recipe default and
    // is valid for the current projection; otherwise leave the instance riding
    // the recipe default (no redundant override).
    const recipeDefaultAgg = metric.meta.groupAggregation
    const valid = availableAggregations(currentBaseId, projection)
    const chosenAgg = valid.includes(aggregationDraft) ? aggregationDraft : recipeDefaultAgg
    const aggregation = chosenAgg !== recipeDefaultAgg ? chosenAgg : undefined

    if (mode === 'edit' && editMetricId) {
      const instances = (engine.metadata?.metricInstances ?? [])
      const orig = resolveInstance(instances, editMetricId)
      const paramsUnchanged = JSON.stringify(params) === JSON.stringify(orig?.params ?? {})
      const projectionUnchanged = JSON.stringify(projection) === JSON.stringify(orig?.projection)
      const aggregationUnchanged = (orig?.groupAggregation ?? recipeDefaultAgg) === chosenAgg

      if (paramsUnchanged && projectionUnchanged && aggregationUnchanged) {
        if (onrenameInstance) {
          onrenameInstance(editMetricId, label)
        }
        modalState.close()
        return
      }

      if (oncreateInstance) {
        modalState.close()
        oncreateInstance(currentBaseId, params, label, projection, editMetricId, aggregation)
      }
    } else if (mode === 'create') {
      if (oncreateInstance) {
        modalState.closeToRoot()
        oncreateInstance(currentBaseId, params, label, projection, undefined, aggregation)
      }
    }
  }

  function liveLabel(baseId: string): string {
    const override = labelOverride.trim()
    return override.length > 0 ? override : defaultInstanceLabel(baseId)
  }

  function paramSelectOptions(p: ParamDef<unknown>): SelectOption[] {
    return (p.options ?? []).map(o => ({ label: o.label, value: o.value as string }))
  }

  function leafKindLabel(k: LeafKind): string {
    switch (k) {
      case 'identity-scalar':                    return 'Scalar'
      case 'identity-aoi-vector':                return 'Per-AOI'
      case 'identity-aoi-pair-matrix':           return 'Matrix'
      case 'identity-participant-pair-matrix':   return 'Participant matrix'
      case 'pick-aoi':         return 'Pick AOI'
      case 'pick-any-fixation': return 'Any fixation'
      case 'aggregate-aoi':    return 'Aggregate AOIs'
      case 'matrix-diagonal':  return 'Self-transitions'
      case 'matrix-row':       return 'From AOI'
      case 'matrix-col':       return 'To AOI'
      case 'matrix-cell':      return 'Pair'
      case 'matrix-aggregate': return 'All pairs'
    }
  }

  function availableAoiReducers(baseId: string): AoiReducer[] {
    const recipe = getRecipe(baseId); if (!recipe) return []
    return AOI_REDUCERS.filter(r =>
      recipeSupports(recipe, { kind: 'aggregate-aoi', reducer: r }) === true,
    )
  }

  function availableMatrixReducers(baseId: string, exclude?: 'diagonal'): MatrixReducer[] {
    const recipe = getRecipe(baseId); if (!recipe) return []
    return MATRIX_REDUCERS.filter(r =>
      recipeSupports(recipe, { kind: 'matrix-aggregate', reducer: r, ...(exclude ? { exclude } : {}) }) === true,
    )
  }

  // Group-aggregation choices valid for the current metric + projection. The
  // candidate set is gated by the recipe's `groupAggregationGuard` (e.g.
  // relativeTime rejects `sum`). Returns [] — hide the control — for metrics
  // whose statistic is intrinsic (`proportion` rates) or that own their own
  // group computation (participant-pair-matrix), where there's no sound choice.
  const AGGREGATION_CHOICES: GroupAggregation[] = ['mean', 'sum', 'median']
  function availableAggregations(baseId: string, projection: Projection): GroupAggregation[] {
    const m = getMetric(baseId)
    if (!m) return []
    if (m.meta.groupAggregation === 'proportion') return []
    if (!m.meta.supportsGroupAggregation) return []
    const recipe = getRecipe(baseId)
    if (!recipe) return []
    return AGGREGATION_CHOICES.filter(
      method => recipe.groupAggregationGuard?.(projection, method) == null
    )
  }

  function aggregationOptionLabel(method: GroupAggregation): string {
    switch (method) {
      case 'sum':    return 'Sum (cohort total)'
      case 'mean':   return 'Mean (per participant)'
      case 'median': return 'Median (per participant)'
      case 'proportion': return 'Proportion'
    }
  }

  function updateLeafAoiRef(name: string) {
    if (leafDraft.kind === 'pick-aoi' || leafDraft.kind === 'matrix-row' || leafDraft.kind === 'matrix-col') {
      leafDraft = { ...leafDraft, aoiRef: { by: 'name', name } } as LeafProjection
    }
  }
</script>

<div class="configure-metric-container">
  {#if metric}
    <!-- Render header only in Create mode -->
    {#if mode === 'create'}
      <div class="add-mode-header">
        <button type="button" class="back-btn" onclick={handleCancel}>
          <ArrowLeft size={14} />
          <span>{modalState.stack.length <= 2 ? 'Back to library' : 'Back to metrics'}</span>
        </button>
        <span class="add-mode-title">{metric.meta.label}</span>
      </div>
    {/if}

    {@const leaves = availableLeavesFor(metric)}
    {@const showLeafPicker = leaves.length > 1}
    {@const windowable = canBeWindowed(metric, leafDraft)}
    {@const windowingLocked = contract.windowing === 'required'}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      class="form-inner"
      onsubmit={e => { e.preventDefault(); commitForm() }}
      onkeydown={e => { if (e.key === 'Escape') { e.preventDefault(); handleCancel() } }}
    >
      <p class="metric-description">{metric.meta.description}</p>

      {#each metric.meta.params as param (param.id)}
        <div class="param-row">
          {#if param.type === 'enum'}
            <Select
              label={param.label}
              options={paramSelectOptions(param)}
              value={String(paramDraft[param.id] ?? param.default)}
              onchange={e => {
                paramDraft = { ...paramDraft, [param.id]: (e as CustomEvent<string>).detail }
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
              appearance="compact"
              onValueChange={v => { if (v !== undefined) paramDraft = { ...paramDraft, [param.id]: v } }}
            />
          {:else if param.type === 'boolean'}
            <label class="bool-label">
              <input
                type="checkbox"
                checked={Boolean(paramDraft[param.id] ?? param.default)}
                onchange={e => {
                  paramDraft = { ...paramDraft, [param.id]: (e.target as HTMLInputElement).checked }
                }}
              />
              {param.label}
            </label>
          {/if}
        </div>
      {/each}

      {#if showLeafPicker}
        <div class="projection-section">
          <div class="field-label">Projection</div>
          <div class="mode-tabs">
            {#each leaves as kind}
              <button
                type="button"
                class="mode-tab"
                class:active={leafDraft.kind === kind}
                onclick={() => {
                  leafDraft = buildLeaf(kind)
                  if (windowDraft && !canBeWindowed(metric!, leafDraft)) windowDraft = null
                }}
              >
                {leafKindLabel(kind)}
              </button>
            {/each}
          </div>

          {#if leafDraft.kind === 'pick-aoi' || leafDraft.kind === 'matrix-row' || leafDraft.kind === 'matrix-col'}
            {@const currentName = leafDraft.aoiRef.by === 'name' ? leafDraft.aoiRef.name : ''}
            {@const isUnknown = currentName.length > 0 && !aoiNameUnion.includes(currentName)}
            <div class="field-row">
              <label class="field-label" for="modal-proj-aoi-{metric.meta.id}">AOI name</label>
              <input
                id="modal-proj-aoi-{metric.meta.id}"
                class="text-input"
                type="text"
                list="modal-proj-aoi-list-{metric.meta.id}"
                value={currentName}
                placeholder={aoiNameUnion[0] ?? 'Displayed AOI name'}
                oninput={(e) => updateLeafAoiRef((e.target as HTMLInputElement).value)}
              />
              <datalist id="modal-proj-aoi-list-{metric.meta.id}">
                {#each aoiNameUnion as name}<option value={name}></option>{/each}
              </datalist>
            </div>
            {#if isUnknown}
              <div class="field-hint warn">
                "{currentName}" is not in any loaded stimulus. The metric will return NaN until an AOI with this displayed name appears.
              </div>
            {/if}
          {/if}

          {#if leafDraft.kind === 'matrix-cell'}
            {@const fromName = leafDraft.fromAoi.by === 'name' ? leafDraft.fromAoi.name : ''}
            {@const toName = leafDraft.toAoi.by === 'name' ? leafDraft.toAoi.name : ''}
            {@const fromUnknown = fromName.length > 0 && !aoiNameUnion.includes(fromName)}
            {@const toUnknown = toName.length > 0 && !aoiNameUnion.includes(toName)}
            <div class="field-row">
              <label class="field-label" for="modal-proj-from-{metric.meta.id}">From AOI</label>
              <input
                id="modal-proj-from-{metric.meta.id}"
                class="text-input"
                type="text"
                list="modal-proj-aoi-list-{metric.meta.id}"
                value={fromName}
                placeholder={aoiNameUnion[0] ?? 'Displayed AOI name'}
                oninput={(e) => {
                  const name = (e.target as HTMLInputElement).value
                  if (leafDraft.kind === 'matrix-cell') leafDraft = { ...leafDraft, fromAoi: { by: 'name', name } }
                }}
              />
            </div>
            <div class="field-row">
              <label class="field-label" for="modal-proj-to-{metric.meta.id}">To AOI</label>
              <input
                id="modal-proj-to-{metric.meta.id}"
                class="text-input"
                type="text"
                list="modal-proj-aoi-list-{metric.meta.id}"
                value={toName}
                placeholder={aoiNameUnion[1] ?? aoiNameUnion[0] ?? 'Displayed AOI name'}
                oninput={(e) => {
                  const name = (e.target as HTMLInputElement).value
                  if (leafDraft.kind === 'matrix-cell') leafDraft = { ...leafDraft, toAoi: { by: 'name', name } }
                }}
              />
            </div>
            <datalist id="modal-proj-aoi-list-{metric.meta.id}">
              {#each aoiNameUnion as name}<option value={name}></option>{/each}
            </datalist>
            {#if fromUnknown || toUnknown}
              <div class="field-hint warn">
                {fromUnknown && toUnknown
                  ? `"${fromName}" and "${toName}" are not in any loaded stimulus.`
                  : fromUnknown
                    ? `"${fromName}" is not in any loaded stimulus.`
                    : `"${toName}" is not in any loaded stimulus.`}
                Metric returns NaN until both AOIs appear.
              </div>
            {/if}
          {/if}

          {#if leafDraft.kind === 'aggregate-aoi'}
            <div class="field-row">
              <label class="field-label" for="modal-proj-red-{metric.meta.id}">Reducer</label>
              <select
                id="modal-proj-red-{metric.meta.id}"
                class="reduction-select"
                value={leafDraft.reducer}
                onchange={(e) => {
                  const r = (e.target as HTMLSelectElement).value as AoiReducer
                  leafDraft = { kind: 'aggregate-aoi', reducer: r }
                }}
              >
                {#each availableAoiReducers(metric.meta.id) as r}
                  <option value={r}>{r}</option>
                {/each}
              </select>
            </div>
          {/if}

          {#if leafDraft.kind === 'matrix-aggregate'}
            <div class="field-row">
              <label class="field-label" for="modal-proj-mred-{metric.meta.id}">Reducer</label>
              <select
                id="modal-proj-mred-{metric.meta.id}"
                class="reduction-select"
                value={leafDraft.reducer}
                onchange={(e) => {
                  const r = (e.target as HTMLSelectElement).value as MatrixReducer
                  const exclude = leafDraft.kind === 'matrix-aggregate' ? leafDraft.exclude : undefined
                  leafDraft = { kind: 'matrix-aggregate', reducer: r, ...(exclude ? { exclude } : {}) }
                }}
              >
                {#each availableMatrixReducers(metric.meta.id, leafDraft.kind === 'matrix-aggregate' ? leafDraft.exclude : undefined) as r}
                  <option value={r}>{r}</option>
                {/each}
              </select>
            </div>
            <label class="bool-label">
              <input
                type="checkbox"
                checked={leafDraft.exclude === 'diagonal'}
                onchange={(e) => {
                  const on = (e.target as HTMLInputElement).checked
                  const reducer = leafDraft.kind === 'matrix-aggregate' ? leafDraft.reducer : 'mean'
                  leafDraft = { kind: 'matrix-aggregate', reducer, ...(on ? { exclude: 'diagonal' as const } : {}) }
                }}
              />
              Exclude self-transitions
            </label>
          {/if}
        </div>
      {/if}

      {#if windowable}
        <div class="windowing-section">
          {#if !windowingLocked}
            <label class="bool-label">
              <input
                type="checkbox"
                checked={windowDraft !== null}
                onchange={(e) => {
                  windowDraft = (e.target as HTMLInputElement).checked ? defaultWindow(metric!, leafDraft) : null
                }}
              />
              Evaluate in sliding windows
            </label>
          {/if}

          {#if windowDraft}
            <div class="window-step-row">
              <div class="field-row">
                <label class="field-label" for="modal-window-{metric.meta.id}">Window</label>
                <div class="window-group">
                  <input
                    id="modal-window-{metric.meta.id}"
                    class="number-input"
                    type="number"
                    value={windowDraft.windowSize}
                    min={metric.meta.windowUnit === 'fixations' ? 2 : 100}
                    step={metric.meta.windowUnit === 'fixations' ? 1 : 100}
                    oninput={(e) => {
                      if (!windowDraft) return
                      const v = Number((e.target as HTMLInputElement).value)
                      windowDraft = { ...windowDraft, windowSize: v }
                    }}
                  />
                  <span class="field-unit">{metric.meta.windowUnit === 'fixations' ? 'fix' : 'ms'}</span>
                </div>
              </div>
              <div class="field-row">
                <label class="field-label" for="modal-step-{metric.meta.id}">Step</label>
                <div class="window-group">
                  <input
                    id="modal-step-{metric.meta.id}"
                    class="number-input"
                    type="number"
                    value={windowDraft.stepSize}
                    min={metric.meta.windowUnit === 'fixations' ? 1 : 100}
                    step={metric.meta.windowUnit === 'fixations' ? 1 : 100}
                    oninput={(e) => {
                      if (!windowDraft) return
                      const v = Number((e.target as HTMLInputElement).value)
                      windowDraft = { ...windowDraft, stepSize: v }
                    }}
                  />
                  <span class="field-unit">{metric.meta.windowUnit === 'fixations' ? 'fix' : 'ms'}</span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if aggregationOptions.length > 1}
        <div class="aggregation-section">
          <div class="field-row">
            <label class="field-label" for="modal-agg-{metric.meta.id}">Across participants</label>
            <select
              id="modal-agg-{metric.meta.id}"
              class="reduction-select"
              value={aggregationOptions.includes(aggregationDraft) ? aggregationDraft : metric.meta.groupAggregation}
              onchange={(e) => { aggregationDraft = (e.target as HTMLSelectElement).value as GroupAggregation }}
            >
              {#each aggregationOptions as method}
                <option value={method}>{aggregationOptionLabel(method)}</option>
              {/each}
            </select>
          </div>
          <span class="field-hint">
            How each window/cell combines the group. <strong>Sum</strong> is the cohort
            total and tapers as participants drop out of a window; <strong>mean</strong>
            averages only those present, so it does not.
          </span>
        </div>
      {/if}

      <div class="field-col">
        <label class="field-label" for="modal-label-{metric.meta.id}">Label</label>
        <input
          id="modal-label-{metric.meta.id}"
          class="text-input"
          type="text"
          bind:value={labelOverride}
          placeholder={liveLabel(currentBaseId)}
        />
        <span class="field-hint">
          Unit <strong>{metric.meta.unit || 'dimensionless'}</strong> and the parameters
          above are added to plots automatically; the label sets only the name.
        </span>
      </div>

      <div class="form-footer">
        <button type="submit" class="btn-primary">{mode === 'edit' ? 'Save' : 'Create'}</button>
        <button type="button" class="btn-ghost" onclick={handleCancel}>Cancel</button>
      </div>
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

  .add-mode-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--c-border);
    padding-bottom: 8px;
    margin-bottom: 4px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: var(--c-darkgrey);
    padding: 4px 8px;
    border-radius: var(--rounded-md);
    transition: background 0.1s, color 0.1s;
  }
  .back-btn:hover {
    background: var(--c-lightgrey);
    color: var(--c-text);
  }

  .add-mode-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--c-text);
  }

  .form-inner { display: flex; flex-direction: column; gap: 10px; }

  .metric-description {
    font-size: 11px;
    color: var(--c-darkgrey);
    line-height: 1.5;
    margin: 0;
    padding-bottom: 2px;
  }

  .param-row { display: flex; flex-direction: column; }

  .bool-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--c-darkgrey);
    cursor: pointer;
  }

  .windowing-section,
  .aggregation-section,
  .projection-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--c-grey);
  }

  .mode-tabs {
    display: flex;
    gap: 2px;
    background: var(--c-grey);
    border-radius: var(--rounded);
    padding: 2px;
  }
  .mode-tab {
    flex: 1;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 11px;
    color: var(--c-darkgrey);
    padding: 3px 6px;
    border-radius: calc(var(--rounded) - 1px);
    transition: background 0.1s, color 0.1s;
    text-align: center;
  }
  .mode-tab:hover { color: var(--c-text); }
  .mode-tab.active { background: var(--c-white); color: var(--c-text); font-weight: 500; }

  .window-step-row { display: flex; flex-direction: column; gap: 6px; }

  .field-row { display: flex; align-items: center; gap: 8px; }
  .field-col { display: flex; flex-direction: column; gap: 4px; }
  .field-label {
    font-size: 11px;
    color: var(--c-darkgrey);
    min-width: 60px;
    flex-shrink: 0;
  }
  .window-group { display: flex; align-items: center; gap: 6px; }

  .number-input {
    width: 72px;
    font-size: 12px;
    padding: 3px 6px;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    background: var(--c-white);
    color: var(--c-text);
    outline: none;
  }
  .number-input:focus { border-color: var(--c-brand); }

  .field-unit { font-size: 11px; color: var(--c-darkgrey); }

  .reduction-select {
    font-size: 12px;
    padding: 3px 8px;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    background: var(--c-white);
    color: var(--c-text);
    outline: none;
    cursor: pointer;
  }
  .reduction-select:focus { border-color: var(--c-brand); }

  .field-hint { font-size: 10px; color: var(--c-darkgrey); line-height: 1.4; }
  .field-hint.warn { color: #b45309; }

  .text-input {
    font-size: 12px;
    padding: 4px 8px;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    background: var(--c-white);
    color: var(--c-text);
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .text-input:focus { border-color: var(--c-brand); }

  .form-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 4px;
  }
  .btn-primary {
    background: var(--c-brand);
    color: var(--c-white);
    border: none;
    border-radius: var(--rounded-md);
    cursor: pointer;
    font-size: 12px;
    padding: 5px 14px;
    font-weight: 500;
  }
  .btn-primary:hover { opacity: 0.9; }
  .btn-ghost {
    background: none;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    cursor: pointer;
    font-size: 12px;
    color: var(--c-darkgrey);
    padding: 5px 14px;
  }
  .btn-ghost:hover { background: var(--c-lightgrey); color: var(--c-text); }
</style>

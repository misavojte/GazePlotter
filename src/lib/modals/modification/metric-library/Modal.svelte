<script lang="ts">
  import { flip } from 'svelte/animate'
  import { slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import GripVertical from 'lucide-svelte/icons/grip-vertical'
  import Pencil from 'lucide-svelte/icons/pencil'
  import X from 'lucide-svelte/icons/x'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import { InputNumber, Select } from '$lib/shared/components'
  import InputText from '$lib/shared/components/InputText.svelte'
  import type { SelectOption } from '$lib/shared/components'
  import { createDragReorder } from '$lib/shared/actions/dragReorder'
  import { getGazePlotterSession } from '$lib/session'
  import {
    listMetrics,
    getMetric,
    getCategoryLabels,
    formatParamReadout,
    formatProjectionReadout,
    defaultInstanceLabel,
    identityFor,
    recipeSupports,
    instanceMatchesContract,
    metricIsCreatableInContract,
    contractLeafKinds,
    PROJECTION_LEAVES,
    AOI_REDUCERS,
    MATRIX_REDUCERS,
    type Metric,
    type MetricInstance,
    type ParamDef,
    type PlotMetricContract,
    type Projection,
    type LeafProjection,
    type LeafKind,
    type AoiReducer,
    type MatrixReducer,
    type WindowSpec,
  } from '$lib/metrics'
  import { getRecipe } from '$lib/metrics/core/defineMetric'
  import { getAois } from '$lib/data/engine'

  const METRICS = listMetrics()
  const CATEGORY_LABELS = getCategoryLabels()

  interface Props {
    contract: PlotMetricContract
    oncreateInstance?: (
      baseId: string,
      params: Record<string, unknown>,
      label: string,
      projection: Projection,
      replacingId?: string,
    ) => void
    ondeleteInstance?: (id: string) => void
    onrenameInstance?: (id: string, label: string) => void
  }

  let { contract, oncreateInstance, ondeleteInstance, onrenameInstance }: Props = $props()

  const { engine } = getGazePlotterSession()

  const instances = $derived(
    (engine.metadata?.metricInstances ?? []).filter(i => instanceMatchesContract(i, contract)),
  )

  // ── Search ───────────────────────────────────────────────
  let searchQuery = $state('')
  const q = $derived(searchQuery.toLowerCase().trim())

  const filteredInstances = $derived(
    instances.filter(inst => {
      if (!q) return true
      const readout = formatParamReadout(inst).join(' ')
      return inst.label.toLowerCase().includes(q) || readout.toLowerCase().includes(q)
    }),
  )

  // ── Drag reorder ─────────────────────────────────────────
  let dragItemId = $state<string | null>(null)
  const dragHandle = createDragReorder<string>({
    itemSelector: '.metric-card',
    containerSelector: '.metric-grid',
    onDragStart: id => { dragItemId = id },
    onDragEnd: () => { dragItemId = null },
    onReorder: (from, to) => {
      const all = [...(engine.metadata?.metricInstances ?? [])]
      const indices = all.reduce<number[]>((acc, inst, i) => {
        if (instanceMatchesContract(inst, contract)) acc.push(i)
        return acc
      }, [])
      const fromGlobal = indices[from]
      const toGlobal = indices[to]
      const [item] = all.splice(fromGlobal, 1)
      all.splice(toGlobal, 0, item)
      engine.setMetricInstances(all)
    },
  })

  // ── Expand + form state ──────────────────────────────────
  let expandedCardId = $state<string | null>(null)
  let expandedAddId = $state<string | null>(null)

  let paramDraft = $state<Record<string, unknown>>({})
  let labelOverride = $state('')
  let isEditMode = $state(false)
  let leafDraft = $state<LeafProjection>({ kind: 'identity-scalar' })
  /** Null = unwindowed. Non-null = windowed. */
  let windowDraft = $state<WindowSpec | null>(null)

  const aoiNameUnion = $derived.by(() => {
    const set = new Set<string>()
    const stimuli = engine.metadata?.stimuli.data ?? []
    for (let sid = 0; sid < stimuli.length; sid++) {
      for (const a of getAois(engine, sid)) set.add(a.displayedName)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  })

  function collapseAll() {
    expandedCardId = null
    expandedAddId = null
    paramDraft = {}
    labelOverride = ''
    isEditMode = false
    leafDraft = { kind: 'identity-scalar' }
    windowDraft = null
  }

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

  /** baseId currently being edited — needed by buildLeaf for reducer validation. */
  let currentBaseId = $state<string>('')

  function availableLeavesFor(m: Metric): LeafKind[] {
    return contractLeafKinds(contract).filter(kind => {
      if (!PROJECTION_LEAVES[kind].rawShapes.includes(m.meta.rawShape)) return false
      const recipe = getRecipe(m.meta.id)
      if (!recipe) return false
      return recipeSupports(recipe, buildLeaf(kind, aoiNameUnion[0])) === true
    })
  }

  function canBeWindowed(m: Metric, leaf: LeafProjection): boolean {
    if (contract.windowing === 'forbidden') return false
    if (m.meta.supportsWindowing === false) return false
    return PROJECTION_LEAVES[leaf.kind].outputShape === 'scalar'
  }

  function defaultWindow(m: Metric): WindowSpec {
    if (m.meta.windowUnit === 'fixations') {
      return { windowSize: 20, stepSize: 20 }
    }
    return { windowSize: 2000, stepSize: 2000 }
  }

  function expandEdit(inst: MetricInstance) {
    expandedCardId = inst.id
    expandedAddId = null
    isEditMode = true
    currentBaseId = inst.baseId
    paramDraft = { ...inst.params }
    if (inst.projection.kind === 'windowed') {
      leafDraft = { ...inst.projection.inner }
      windowDraft = { ...inst.projection.window }
    } else {
      leafDraft = { ...inst.projection }
      windowDraft = null
    }
    const autoLabel = defaultInstanceLabel(inst.baseId, inst.params, inst.projection)
    labelOverride = inst.label !== autoLabel ? inst.label : ''
  }

  function toggleAdd(baseId: string) {
    if (expandedAddId === baseId) { collapseAll(); return }
    expandedCardId = null
    expandedAddId = baseId
    isEditMode = false
    currentBaseId = baseId
    const m = getMetric(baseId)
    if (!m) return
    paramDraft = Object.fromEntries((m.meta.params ?? []).map(p => [p.id, p.default]))
    labelOverride = ''
    const firstLeaf = availableLeavesFor(m)[0] ?? identityFor(m.meta.rawShape).kind
    leafDraft = buildLeaf(firstLeaf)
    windowDraft = contract.windowing === 'required' && canBeWindowed(m, leafDraft)
      ? defaultWindow(m)
      : null
  }

  function toggleEdit(inst: MetricInstance) {
    if (expandedCardId === inst.id) { collapseAll(); return }
    expandEdit(inst)
  }

  function buildProjection(leaf: LeafProjection, window: WindowSpec | null): Projection {
    return window ? { kind: 'windowed', window, inner: leaf } : leaf
  }

  function commitForm(baseId: string) {
    const projection = buildProjection(leafDraft, windowDraft)
    const params = { ...paramDraft }
    const label = labelOverride.trim() || defaultInstanceLabel(baseId, params, projection)

    if (isEditMode && expandedCardId !== null && onrenameInstance) {
      const orig = instances.find(i => i.id === expandedCardId)
      const paramsUnchanged = JSON.stringify(params) === JSON.stringify(orig?.params ?? {})
      const projectionUnchanged =
        JSON.stringify(projection) === JSON.stringify(orig?.projection)
      if (paramsUnchanged && projectionUnchanged) {
        onrenameInstance(expandedCardId, label)
        collapseAll()
        return
      }
    }

    if (!oncreateInstance) return
    const replacingId = isEditMode && expandedCardId !== null ? expandedCardId : undefined
    collapseAll()
    oncreateInstance(baseId, params, label, projection, replacingId)
  }

  const filteredAddDefs = $derived(
    METRICS.filter(m =>
      metricIsCreatableInContract(m, contract) &&
      (!q || m.meta.label.toLowerCase().includes(q) || m.meta.searchTags.some(t => t.includes(q))),
    ),
  )

  function liveLabel(baseId: string): string {
    const override = labelOverride.trim()
    return override.length > 0
      ? override
      : defaultInstanceLabel(baseId, paramDraft, buildProjection(leafDraft, windowDraft))
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
      case 'matrix-diagonal':  return 'Diagonal'
      case 'matrix-row':       return 'Row'
      case 'matrix-col':       return 'Column'
      case 'matrix-cell':      return 'Cell'
      case 'matrix-aggregate': return 'Matrix aggregate'
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

  function updateLeafAoiRef(name: string) {
    if (leafDraft.kind === 'pick-aoi' || leafDraft.kind === 'matrix-row' || leafDraft.kind === 'matrix-col') {
      leafDraft = { ...leafDraft, aoiRef: { by: 'name', name } } as LeafProjection
    }
  }
</script>

<div class="library-modal">
  <div class="search-row">
    <InputText
      label="Search"
      value={searchQuery}
      oninput={e => {
        searchQuery = (e as CustomEvent<string>).detail
        collapseAll()
      }}
      placeholder="Search metrics…"
      fill={true}
      showLabel={false}
    />
  </div>

  <div class="section-label">Library</div>

  {#if filteredInstances.length > 0}
    <div class="metric-grid">
      {#each filteredInstances as inst (inst.id)}
        {@const readout = formatParamReadout(inst)}
        {@const projLine = formatProjectionReadout(inst)}
        {@const detail = [...readout, ...(projLine ? [projLine] : [])].join(' · ')}
        {@const metric = getMetric(inst.baseId)}
        <div
          class="metric-card"
          class:dragging={dragItemId === inst.id}
          animate:flip={{ duration: dragItemId === inst.id ? 0 : 150, easing: cubicOut }}
        >
          <div class="card-row">
            <div class="drag-handle" use:dragHandle={inst.id}>
              <GripVertical size={14} />
            </div>
            <div class="card-body">
              <span class="card-name">{inst.label}</span>
              {#if detail}<span class="card-detail">{detail}</span>{/if}
            </div>
            <button
              class="icon-btn"
              class:active={expandedCardId === inst.id}
              onclick={() => toggleEdit(inst)}
              title="Edit"
              aria-label="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              class="icon-btn danger"
              onclick={() => ondeleteInstance?.(inst.id)}
              title="Delete"
              aria-label="Delete"
            >
              <X size={13} />
            </button>
          </div>

          {#if expandedCardId === inst.id}
            <div class="inline-form" in:slide|local={{ duration: 150 }} out:slide|local={{ duration: 120 }}>
              {@render formBody(inst.baseId, metric)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else if !q}
    <p class="empty">No metrics in library yet.</p>
  {:else}
    <p class="empty">No library metrics match "{searchQuery}".</p>
  {/if}

  {#if filteredAddDefs.length > 0}
    <div class="section-label" style:margin-top="16px">Add metric</div>
    <div class="add-list">
      {#each filteredAddDefs as m (m.meta.id)}
        <div class="add-row">
          <button
            class="add-row-header"
            class:active={expandedAddId === m.meta.id}
            onclick={() => toggleAdd(m.meta.id)}
            type="button"
          >
            <span class="add-badge">{CATEGORY_LABELS[m.meta.category] ?? m.meta.category}</span>
            <span class="add-label">{m.meta.label}</span>
            <span class="add-chevron" class:rotated={expandedAddId === m.meta.id}>
              <ChevronDown size={13} strokeWidth={1.5} />
            </span>
          </button>

          {#if expandedAddId === m.meta.id}
            <div class="inline-form" in:slide|local={{ duration: 150 }} out:slide|local={{ duration: 120 }}>
              {@render formBody(m.meta.id, m)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else if q}
    <p class="empty" style:margin-top="8px">No metrics match "{searchQuery}".</p>
  {/if}
</div>

{#snippet formBody(baseId: string, m: Metric | undefined)}
  {#if m}
    {@const leaves = availableLeavesFor(m)}
    {@const showLeafPicker = leaves.length > 1}
    {@const windowable = canBeWindowed(m, leafDraft)}
    {@const windowingLocked = contract.windowing === 'required'}
    <form
      class="form-inner"
      onsubmit={e => { e.preventDefault(); commitForm(baseId) }}
      onkeydown={e => { if (e.key === 'Escape') { e.preventDefault(); collapseAll() } }}
    >
      <p class="metric-description">{m.meta.description}</p>

      {#each m.meta.params as param (param.id)}
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
              id={`modal-param-${m.meta.id}-${param.id}`}
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
                  if (windowDraft && !canBeWindowed(m, leafDraft)) windowDraft = null
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
              <label class="field-label" for="modal-proj-aoi-{m.meta.id}">AOI name</label>
              <input
                id="modal-proj-aoi-{m.meta.id}"
                class="text-input"
                type="text"
                list="modal-proj-aoi-list-{m.meta.id}"
                value={currentName}
                placeholder={aoiNameUnion[0] ?? 'Displayed AOI name'}
                oninput={(e) => updateLeafAoiRef((e.target as HTMLInputElement).value)}
              />
              <datalist id="modal-proj-aoi-list-{m.meta.id}">
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
              <label class="field-label" for="modal-proj-from-{m.meta.id}">From AOI</label>
              <input
                id="modal-proj-from-{m.meta.id}"
                class="text-input"
                type="text"
                list="modal-proj-aoi-list-{m.meta.id}"
                value={fromName}
                placeholder={aoiNameUnion[0] ?? 'Displayed AOI name'}
                oninput={(e) => {
                  const name = (e.target as HTMLInputElement).value
                  if (leafDraft.kind === 'matrix-cell') leafDraft = { ...leafDraft, fromAoi: { by: 'name', name } }
                }}
              />
            </div>
            <div class="field-row">
              <label class="field-label" for="modal-proj-to-{m.meta.id}">To AOI</label>
              <input
                id="modal-proj-to-{m.meta.id}"
                class="text-input"
                type="text"
                list="modal-proj-aoi-list-{m.meta.id}"
                value={toName}
                placeholder={aoiNameUnion[1] ?? aoiNameUnion[0] ?? 'Displayed AOI name'}
                oninput={(e) => {
                  const name = (e.target as HTMLInputElement).value
                  if (leafDraft.kind === 'matrix-cell') leafDraft = { ...leafDraft, toAoi: { by: 'name', name } }
                }}
              />
            </div>
            <datalist id="modal-proj-aoi-list-{m.meta.id}">
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
              <label class="field-label" for="modal-proj-red-{m.meta.id}">Reducer</label>
              <select
                id="modal-proj-red-{m.meta.id}"
                class="reduction-select"
                value={leafDraft.reducer}
                onchange={(e) => {
                  const r = (e.target as HTMLSelectElement).value as AoiReducer
                  leafDraft = { kind: 'aggregate-aoi', reducer: r }
                }}
              >
                {#each availableAoiReducers(m.meta.id) as r}
                  <option value={r}>{r}</option>
                {/each}
              </select>
            </div>
          {/if}

          {#if leafDraft.kind === 'matrix-aggregate'}
            <div class="field-row">
              <label class="field-label" for="modal-proj-mred-{m.meta.id}">Reducer</label>
              <select
                id="modal-proj-mred-{m.meta.id}"
                class="reduction-select"
                value={leafDraft.reducer}
                onchange={(e) => {
                  const r = (e.target as HTMLSelectElement).value as MatrixReducer
                  const exclude = leafDraft.kind === 'matrix-aggregate' ? leafDraft.exclude : undefined
                  leafDraft = { kind: 'matrix-aggregate', reducer: r, ...(exclude ? { exclude } : {}) }
                }}
              >
                {#each availableMatrixReducers(m.meta.id, leafDraft.kind === 'matrix-aggregate' ? leafDraft.exclude : undefined) as r}
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
              Exclude diagonal (self-transitions)
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
                  windowDraft = (e.target as HTMLInputElement).checked ? defaultWindow(m) : null
                }}
              />
              Evaluate in sliding windows
            </label>
          {/if}

          {#if windowDraft}
            <div class="window-step-row">
              <div class="field-row">
                <label class="field-label" for="modal-window-{m.meta.id}">Window</label>
                <div class="window-group">
                  <input
                    id="modal-window-{m.meta.id}"
                    class="number-input"
                    type="number"
                    value={windowDraft.windowSize}
                    min={m.meta.windowUnit === 'fixations' ? 2 : 100}
                    step={m.meta.windowUnit === 'fixations' ? 1 : 100}
                    oninput={(e) => {
                      if (!windowDraft) return
                      const v = Number((e.target as HTMLInputElement).value)
                      windowDraft = { ...windowDraft, windowSize: v }
                    }}
                  />
                  <span class="field-unit">{m.meta.windowUnit === 'fixations' ? 'fix' : 'ms'}</span>
                </div>
              </div>
              <div class="field-row">
                <label class="field-label" for="modal-step-{m.meta.id}">Step</label>
                <div class="window-group">
                  <input
                    id="modal-step-{m.meta.id}"
                    class="number-input"
                    type="number"
                    value={windowDraft.stepSize}
                    min={m.meta.windowUnit === 'fixations' ? 1 : 100}
                    step={m.meta.windowUnit === 'fixations' ? 1 : 100}
                    oninput={(e) => {
                      if (!windowDraft) return
                      const v = Number((e.target as HTMLInputElement).value)
                      windowDraft = { ...windowDraft, stepSize: v }
                    }}
                  />
                  <span class="field-unit">{m.meta.windowUnit === 'fixations' ? 'fix' : 'ms'}</span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <div class="field-col">
        <label class="field-label" for="modal-label-{m.meta.id}">Label</label>
        <input
          id="modal-label-{m.meta.id}"
          class="text-input"
          type="text"
          bind:value={labelOverride}
          placeholder={liveLabel(baseId)}
        />
      </div>

      <div class="form-footer">
        <button type="submit" class="btn-primary">{isEditMode ? 'Save' : 'Create'}</button>
        <button type="button" class="btn-ghost" onclick={collapseAll}>Cancel</button>
      </div>
    </form>
  {/if}
{/snippet}

<style>
  .library-modal {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 360px;
    max-width: 480px;
  }

  .search-row { margin-bottom: 14px; }

  .section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-darkgrey);
    margin-bottom: 8px;
  }

  .empty {
    font-size: 12px;
    color: var(--c-darkgrey);
    padding: 10px 0;
    margin: 0;
    text-align: center;
  }

  .metric-grid { display: flex; flex-direction: column; gap: 6px; }

  .metric-card {
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    background: var(--c-darkwhite);
    overflow: hidden;
  }
  .metric-card.dragging {
    opacity: 0.3;
    border-style: dashed;
    border-color: var(--c-midgrey);
    box-shadow: none;
  }

  .card-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px 8px 6px;
  }
  .drag-handle {
    cursor: grab;
    color: var(--c-midgrey);
    display: flex;
    align-items: center;
    padding: 2px;
    flex-shrink: 0;
    transition: color 0.1s;
  }
  .drag-handle:hover { color: var(--c-darkgrey); }
  .drag-handle:active { cursor: grabbing; }

  .card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .card-name {
    font-size: 13px;
    color: var(--c-text);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card-detail {
    font-size: 11px;
    color: var(--c-darkgrey);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--c-darkgrey);
    padding: 4px;
    line-height: 0;
    border-radius: var(--rounded);
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: color 0.1s, background 0.1s;
  }
  .icon-btn:hover { background: var(--c-lightgrey); color: var(--c-text); }
  .icon-btn.active { color: var(--c-brand); }
  .icon-btn.danger:hover { background: #fee2e2; color: #dc2626; }

  .add-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    overflow: hidden;
  }
  .add-row { border-bottom: 1px solid var(--c-border); }
  .add-row:last-child { border-bottom: none; }

  .add-row-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }
  .add-row-header:hover { background: var(--c-lightgrey); }
  .add-row-header.active { background: color-mix(in srgb, var(--c-brand) 5%, var(--c-white)); }

  .add-badge {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--c-darkgrey);
    background: var(--c-grey);
    border-radius: 3px;
    padding: 1px 5px;
    flex-shrink: 0;
    min-width: 52px;
    text-align: center;
  }
  .add-label { font-size: 13px; color: var(--c-text); flex: 1; }
  .add-chevron {
    color: var(--c-midgrey);
    line-height: 0;
    flex-shrink: 0;
    transition: transform 0.15s;
  }
  .add-chevron.rotated { transform: rotate(180deg); }

  .inline-form {
    border-top: 1px solid var(--c-border);
    padding: 12px;
    background: var(--c-white);
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

<script lang="ts">
  import { flip } from 'svelte/animate'
  import { slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import GripVertical from 'lucide-svelte/icons/grip-vertical'
  import Pencil from 'lucide-svelte/icons/pencil'
  import X from 'lucide-svelte/icons/x'
  import Plus from 'lucide-svelte/icons/plus'
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
    formatWindowingReadout,
    formatProjectionReadout,
    defaultInstanceLabel,
    instanceMatchesContext,
    metricIsCreatableInContext,
    targetsFor,
    fromMethodsFor,
    identityFor,
    validateCombination,
    type Metric,
    type MetricContext,
    type MetricInstance,
    type ParamDef,
    type ComputationMode,
    type Projection,
    type ProjectionShape,
    type AoiReducer,
    type MatrixReducer,
  } from '$lib/metrics'
  import { getRecipe } from '$lib/metrics/core/defineMetric'
  import { getAois } from '$lib/data/engine'
  import type { WindowingConfig } from '$lib/data/types'

  const METRICS = listMetrics()
  const CATEGORY_LABELS = getCategoryLabels()

  interface Props {
    context: MetricContext
    oncreateInstance?: (
      baseId: string,
      params: Record<string, unknown>,
      label: string,
      windowing?: WindowingConfig,
      replacingId?: number,
      projection?: Projection
    ) => void
    ondeleteInstance?: (id: number) => void
    onrenameInstance?: (id: number, label: string) => void
  }

  let { context, oncreateInstance, ondeleteInstance, onrenameInstance }: Props =
    $props()

  const { engine } = getGazePlotterSession()

  /** Shared predicate — same one MetricSelect uses — so the modal and the
   *  opener dropdown always agree on what's in scope. */
  function belongsInContext(i: MetricInstance): boolean {
    return instanceMatchesContext(i, context)
  }

  const instances = $derived(
    (engine.metadata?.metricInstances ?? []).filter(belongsInContext)
  )

  // ── Search ───────────────────────────────────────────────
  let searchQuery = $state('')
  const q = $derived(searchQuery.toLowerCase().trim())

  const filteredInstances = $derived(
    instances.filter(inst => {
      if (!q) return true
      const readout = formatParamReadout(inst).join(' ')
      return (
        inst.label.toLowerCase().includes(q) ||
        readout.toLowerCase().includes(q)
      )
    })
  )

  // ── Drag reorder ─────────────────────────────────────────
  let dragItemId = $state<number | null>(null)

  const dragHandle = createDragReorder({
    itemSelector: '.metric-card',
    containerSelector: '.metric-grid',
    onDragStart: id => {
      dragItemId = id
    },
    onDragEnd: () => {
      dragItemId = null
    },
    onReorder: (from, to) => {
      const all = [...(engine.metadata?.metricInstances ?? [])]
      const indices = all.reduce<number[]>((acc, inst, i) => {
        if (belongsInContext(inst)) acc.push(i)
        return acc
      }, [])
      const fromGlobal = indices[from]
      const toGlobal = indices[to]
      const [item] = all.splice(fromGlobal, 1)
      all.splice(toGlobal, 0, item)
      engine.setMetricInstances(all)
    },
  })

  // ── Expand state ─────────────────────────────────────────
  let expandedCardId = $state<number | null>(null)
  let expandedAddId = $state<string | null>(null)

  // ── Form state (shared between create and edit) ───────────
  let paramDraft = $state<Record<string, unknown>>({})
  let labelOverride = $state('')
  let createMode = $state<ComputationMode>('global')
  let windowSize = $state(2000)
  let stepSize = $state(2000)
  let windowReduction = $state<WindowingConfig['reduction']>('mean')
  let isEditMode = $state(false)
  let projectionDraft = $state<Projection>({ target: 'scalar', from: 'identity' })

  /** Union of displayed AOI names across all stimuli — stable reference for
   *  `by: name` projections, survives stimulus re-ingest. */
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
    projectionDraft = { target: 'scalar', from: 'identity' }
  }

  function expandEdit(inst: MetricInstance) {
    expandedCardId = inst.id
    expandedAddId = null
    isEditMode = true
    const m = getMetric(inst.baseId)
    paramDraft = { ...inst.params }
    projectionDraft = inst.projection ?? identityFor(m?.meta.outputShape ?? 'scalar')
    const autoLabel = defaultInstanceLabel(inst.baseId, inst.params, projectionDraft)
    labelOverride = inst.label !== autoLabel ? inst.label : ''
    const w = inst.windowing
    createMode = w?.mode ?? (context.windowing === 'only' ? 'epoch' : 'global')
    windowSize = w?.windowSize ?? (m?.meta.category === 'rqa-aoi' ? 20 : 2000)
    stepSize =
      w?.stepSize ??
      (m?.meta.category === 'rqa-aoi'
        ? 100
        : w?.mode === 'epoch'
          ? windowSize
          : 100)
    windowReduction = w?.reduction ?? 'mean'
  }

  function toggleAdd(baseId: string) {
    if (expandedAddId === baseId) {
      collapseAll()
      return
    }
    expandedCardId = null
    expandedAddId = baseId
    isEditMode = false
    const m = getMetric(baseId)
    paramDraft = Object.fromEntries(
      (m?.meta.params ?? []).map(p => [p.id, p.default])
    )
    labelOverride = ''
    createMode = context.windowing === 'only' ? 'epoch' : 'global'
    windowSize = m?.meta.category === 'rqa-aoi' ? 20 : 2000
    stepSize = m?.meta.category === 'rqa-aoi' ? 100 : windowSize
    windowReduction = 'mean'
    projectionDraft = defaultProjectionFor(m, context)
  }

  /** Pick the first target shape accepted by the context, then the first
   *  legal `from` method. Ensures the projection is always valid on open. */
  function defaultProjectionFor(m: Metric | undefined, ctx: MetricContext): Projection {
    if (!m) return { target: 'scalar', from: 'identity' }
    const raw = m.meta.outputShape
    const target: ProjectionShape =
      (ctx.shapes.find(s => targetsFor(raw).includes(s)) as ProjectionShape | undefined) ?? raw
    const firstValid = validFromMethods(raw, target, m.meta.id)[0] ?? fromMethodsFor(raw, target)[0]
    return buildProjection(raw, target, firstValid)
  }

  /** Assemble a well-formed projection from (raw, target, from), seeding any
   *  method-specific params with sensible defaults. */
  function buildProjection(
    raw: ProjectionShape,
    target: ProjectionShape,
    from: Projection['from']
  ): Projection {
    const defaultAoi = aoiNameUnion[0] ?? ''
    if (target === 'scalar') {
      if (from === 'identity')         return { target: 'scalar', from: 'identity' }
      if (from === 'pick-aoi')         return { target: 'scalar', from: 'pick-aoi', aoiRef: { by: 'name', name: defaultAoi } }
      if (from === 'aggregate-aoi')    return { target: 'scalar', from: 'aggregate-aoi', reducer: 'mean' }
      if (from === 'matrix-aggregate') return { target: 'scalar', from: 'matrix-aggregate', reducer: 'mean', exclude: 'diagonal' }
      if (from === 'matrix-cell')      return {
        target: 'scalar', from: 'matrix-cell',
        fromAoi: { by: 'name', name: defaultAoi },
        toAoi:   { by: 'name', name: aoiNameUnion[1] ?? defaultAoi },
      }
    }
    if (target === 'aoi-vector') {
      if (from === 'identity')        return { target: 'aoi-vector', from: 'identity' }
      if (from === 'matrix-diagonal') return { target: 'aoi-vector', from: 'matrix-diagonal' }
      if (from === 'matrix-row')      return { target: 'aoi-vector', from: 'matrix-row', aoiRef: { by: 'name', name: defaultAoi } }
      if (from === 'matrix-col')      return { target: 'aoi-vector', from: 'matrix-col', aoiRef: { by: 'name', name: defaultAoi } }
    }
    return { target: 'aoi-pair-matrix', from: 'identity' }
  }

  function toggleEdit(inst: MetricInstance) {
    if (expandedCardId === inst.id) {
      collapseAll()
      return
    }
    expandEdit(inst)
  }

  // ── Form submission ───────────────────────────────────────
  function commitForm(baseId: string) {
    const m = getMetric(baseId)
    const isRqa = m?.meta.category === 'rqa-aoi'
    const params = { ...paramDraft }
    const projection = projectionDraft.from === 'identity' ? undefined : projectionDraft
    const label = labelOverride.trim() || defaultInstanceLabel(baseId, params, projection)
    const windowing: WindowingConfig | undefined =
      createMode === 'global'
        ? undefined
        : {
            mode: createMode as 'epoch' | 'sliding',
            windowSize,
            ...(!isRqa && createMode === 'sliding' ? { stepSize } : {}),
            reduction: windowReduction,
          }

    if (isEditMode && expandedCardId !== null && onrenameInstance) {
      const orig = instances.find(i => i.id === expandedCardId)
      const paramsUnchanged =
        JSON.stringify(params) === JSON.stringify(orig?.params ?? {})
      const wo = orig?.windowing
      const windowingUnchanged =
        (windowing === undefined && wo === undefined) ||
        (windowing !== undefined &&
          wo !== undefined &&
          windowing.mode === wo.mode &&
          windowing.windowSize === wo.windowSize &&
          (windowing.stepSize ?? null) === (wo.stepSize ?? null) &&
          windowing.reduction === wo.reduction)
      const projectionUnchanged =
        JSON.stringify(projection ?? null) === JSON.stringify(orig?.projection ?? null)
      if (paramsUnchanged && windowingUnchanged && projectionUnchanged) {
        onrenameInstance(expandedCardId, label)
        collapseAll()
        return
      }
    }

    if (!oncreateInstance) return
    const replacingId =
      isEditMode && expandedCardId !== null ? expandedCardId : undefined
    collapseAll()
    oncreateInstance(baseId, params, label, windowing, replacingId, projection)
  }

  const filteredAddDefs = $derived(
    METRICS.filter(
      m =>
        metricIsCreatableInContext(m, context) &&
        (!q ||
          m.meta.label.toLowerCase().includes(q) ||
          m.meta.searchTags.some(t => t.includes(q)))
    )
  )

  // ── Live label preview ────────────────────────────────────
  function liveLabel(baseId: string): string {
    const override = labelOverride.trim()
    return override.length > 0
      ? override
      : defaultInstanceLabel(baseId, paramDraft, projectionDraft)
  }

  function paramSelectOptions(p: ParamDef<unknown>): SelectOption[] {
    return (p.options ?? []).map(o => ({
      label: o.label,
      value: o.value as string,
    }))
  }

  // ── Projection helpers ───────────────────────────────────
  /** Validator call — recipe is looked up lazily so the helper stays pure. */
  function isValid(baseId: string, projection: Projection): boolean {
    const recipe = getRecipe(baseId)
    if (!recipe) return false
    return validateCombination({ recipe, projection }).ok
  }

  /** Shape axis: target shapes accepted by the context AND with at least one
   *  validator-passing `from` method. Purely projection-target-based, so
   *  recipes whose raw shape doesn't natively fit still surface if some
   *  projection does. */
  function targetShapesFor(raw: ProjectionShape, baseId: string): ProjectionShape[] {
    return targetsFor(raw)
      .filter(t => context.shapes.includes(t))
      .filter(t => validFromMethods(raw, t, baseId).length > 0)
  }

  /** Method axis: filter `fromMethodsFor` through the validator using a probe
   *  projection (method-specific params don't affect the rules this modal
   *  enforces; user-specified params are validated again at commit). */
  function validFromMethods(
    raw: ProjectionShape,
    target: ProjectionShape,
    baseId: string
  ): Projection['from'][] {
    return fromMethodsFor(raw, target).filter(from =>
      isValid(baseId, buildProjection(raw, target, from))
    )
  }

  function targetShapeLabel(shape: ProjectionShape): string {
    return shape === 'scalar' ? 'Scalar'
      : shape === 'aoi-vector' ? 'AOI vector'
      : 'Matrix'
  }

  function fromMethodLabel(from: Projection['from']): string {
    switch (from) {
      case 'identity':         return 'Raw'
      case 'pick-aoi':         return 'Pick AOI'
      case 'aggregate-aoi':    return 'Aggregate'
      case 'matrix-diagonal':  return 'Diagonal'
      case 'matrix-row':       return 'Row'
      case 'matrix-col':       return 'Column'
      case 'matrix-aggregate': return 'Aggregate'
      case 'matrix-cell':      return 'Cell (from → to)'
    }
  }

  /** Reducer options are filtered through the central validator so recipe
   *  units, domain-level rejections, etc. all participate in one place. */
  function availableAoiReducers(baseId: string): AoiReducer[] {
    const all: AoiReducer[] = ['mean', 'sum', 'max', 'min', 'median']
    return all.filter(r => isValid(baseId, { target: 'scalar', from: 'aggregate-aoi', reducer: r }))
  }
  function availableMatrixReducers(baseId: string, exclude: 'diagonal' | undefined): MatrixReducer[] {
    const all: MatrixReducer[] = ['mean', 'sum']
    return all.filter(r => isValid(baseId, {
      target: 'scalar', from: 'matrix-aggregate', reducer: r, ...(exclude ? { exclude } : {}),
    }))
  }

  function getAvailableModes(baseId: string): ComputationMode[] {
    const m = getMetric(baseId)
    return context.windowing === 'only'
      ? ((m?.meta.computationModes ?? []).filter(
          mode => mode !== 'global'
        ) as ComputationMode[])
      : []
  }
</script>

<div class="library-modal">
  <!-- Search -->
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

  <!-- Library section -->
  <div class="section-label">Library</div>

  {#if filteredInstances.length > 0}
    <div class="metric-grid">
      {#each filteredInstances as inst (inst.id)}
        {@const readout = formatParamReadout(inst)}
        {@const winLine = formatWindowingReadout(inst)}
        {@const projLine = formatProjectionReadout(inst)}
        {@const detail = [
          ...readout,
          ...(projLine ? [projLine] : []),
          ...(winLine ? [winLine] : []),
        ].join(' · ')}
        {@const metric = getMetric(inst.baseId)}
        {@const availableModes = getAvailableModes(inst.baseId)}
        <div
          class="metric-card"
          class:dragging={dragItemId === inst.id}
          animate:flip={{
            duration: dragItemId === inst.id ? 0 : 150,
            easing: cubicOut,
          }}
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
            {#if !inst.system}
              <button
                class="icon-btn danger"
                onclick={() => ondeleteInstance?.(inst.id)}
                title="Delete"
                aria-label="Delete"
              >
                <X size={13} />
              </button>
            {/if}
          </div>

          {#if expandedCardId === inst.id}
            <div
              class="inline-form"
              in:slide|local={{ duration: 150 }}
              out:slide|local={{ duration: 120 }}
            >
              {@render formBody(inst.baseId, availableModes, metric)}
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

  <!-- Add section -->
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
            <span class="add-badge"
              >{CATEGORY_LABELS[m.meta.category] ?? m.meta.category}</span
            >
            <span class="add-label">{m.meta.label}</span>
            <span
              class="add-chevron"
              class:rotated={expandedAddId === m.meta.id}
            >
              <ChevronDown size={13} strokeWidth={1.5} />
            </span>
          </button>

          {#if expandedAddId === m.meta.id}
            {@const availableModes = getAvailableModes(m.meta.id)}
            <div
              class="inline-form"
              in:slide|local={{ duration: 150 }}
              out:slide|local={{ duration: 120 }}
            >
              {@render formBody(m.meta.id, availableModes, m)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else if q}
    <p class="empty" style:margin-top="8px">
      No metrics match "{searchQuery}".
    </p>
  {/if}
</div>

{#snippet formBody(
  baseId: string,
  availableModes: ComputationMode[],
  m: Metric | undefined
)}
  {#if m}
    {@const raw = m.meta.outputShape}
    {@const targetShapes = targetShapesFor(raw, m.meta.id)}
    {@const fromMethods = validFromMethods(raw, projectionDraft.target, m.meta.id)}
    {@const showTargetPicker = targetShapes.length > 1}
    {@const showFromPicker = fromMethods.length > 1}
    <form
      class="form-inner"
      onsubmit={e => {
        e.preventDefault()
        commitForm(baseId)
      }}
      onkeydown={e => {
        if (e.key === 'Escape') {
          e.preventDefault()
          collapseAll()
        }
      }}
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
                paramDraft = {
                  ...paramDraft,
                  [param.id]: (e as CustomEvent<string>).detail,
                }
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
              onValueChange={v => {
                if (v !== undefined)
                  paramDraft = { ...paramDraft, [param.id]: v }
              }}
            />
          {:else if param.type === 'boolean'}
            <label class="bool-label">
              <input
                type="checkbox"
                checked={Boolean(paramDraft[param.id] ?? param.default)}
                onchange={e => {
                  paramDraft = {
                    ...paramDraft,
                    [param.id]: (e.target as HTMLInputElement).checked,
                  }
                }}
              />
              {param.label}
            </label>
          {/if}
        </div>
      {/each}

      {#if showTargetPicker || showFromPicker}
        <div class="projection-section">
          {#if showTargetPicker}
            <div class="field-label">Output shape</div>
            <div class="mode-tabs">
              {#each targetShapes as tgt}
                <button
                  type="button"
                  class="mode-tab"
                  class:active={projectionDraft.target === tgt}
                  onclick={() => {
                    const firstValid = validFromMethods(raw, tgt, m.meta.id)[0] ?? fromMethodsFor(raw, tgt)[0]
                    projectionDraft = buildProjection(raw, tgt, firstValid)
                  }}
                >
                  {targetShapeLabel(tgt)}
                </button>
              {/each}
            </div>
          {/if}

          {#if showFromPicker}
            <div class="field-label">Method</div>
            <div class="mode-tabs">
              {#each fromMethods as fm}
                <button
                  type="button"
                  class="mode-tab"
                  class:active={projectionDraft.from === fm}
                  onclick={() => {
                    projectionDraft = buildProjection(raw, projectionDraft.target, fm)
                  }}
                >
                  {fromMethodLabel(fm)}
                </button>
              {/each}
            </div>
          {/if}

          {#if projectionDraft.from === 'pick-aoi' || projectionDraft.from === 'matrix-row' || projectionDraft.from === 'matrix-col'}
            {@const currentName = projectionDraft.aoiRef.by === 'name' ? projectionDraft.aoiRef.name : ''}
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
                oninput={(e) => {
                  const name = (e.target as HTMLInputElement).value
                  projectionDraft = { ...projectionDraft, aoiRef: { by: 'name', name } } as Projection
                }}
              />
              <datalist id="modal-proj-aoi-list-{m.meta.id}">
                {#each aoiNameUnion as name}
                  <option value={name}></option>
                {/each}
              </datalist>
            </div>
            <div class="field-hint">
              Matched by <em>displayed</em> AOI name — survives stimulus re-ingest,
              AOI reorder, and regrouping. Type any string; current stimuli
              offer: {aoiNameUnion.length > 0 ? aoiNameUnion.join(', ') : '(none yet)'}.
            </div>
            {#if isUnknown}
              <div class="field-hint warn">
                "{currentName}" is not in any loaded stimulus. The metric will
                return NaN until an AOI with this displayed name appears.
              </div>
            {/if}
          {/if}

          {#if projectionDraft.from === 'matrix-cell'}
            {@const fromName = projectionDraft.fromAoi.by === 'name' ? projectionDraft.fromAoi.name : ''}
            {@const toName = projectionDraft.toAoi.by === 'name' ? projectionDraft.toAoi.name : ''}
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
                  projectionDraft = { ...projectionDraft, fromAoi: { by: 'name', name } } as Projection
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
                  projectionDraft = { ...projectionDraft, toAoi: { by: 'name', name } } as Projection
                }}
              />
            </div>
            <datalist id="modal-proj-aoi-list-{m.meta.id}">
              {#each aoiNameUnion as name}
                <option value={name}></option>
              {/each}
            </datalist>
            <div class="field-hint">
              Matched by <em>displayed</em> AOI name — survives stimulus re-ingest,
              AOI reorder, and regrouping. Current stimuli
              offer: {aoiNameUnion.length > 0 ? aoiNameUnion.join(', ') : '(none yet)'}.
            </div>
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

          {#if projectionDraft.from === 'aggregate-aoi'}
            <div class="field-row">
              <label class="field-label" for="modal-proj-red-{m.meta.id}">Reducer</label>
              <select
                id="modal-proj-red-{m.meta.id}"
                class="reduction-select"
                value={projectionDraft.reducer}
                onchange={(e) => {
                  const r = (e.target as HTMLSelectElement).value as AoiReducer
                  projectionDraft = { target: 'scalar', from: 'aggregate-aoi', reducer: r }
                }}
              >
                {#each availableAoiReducers(m.meta.id) as r}
                  <option value={r}>{r}</option>
                {/each}
              </select>
            </div>
          {/if}

          {#if projectionDraft.from === 'matrix-aggregate'}
            <div class="field-row">
              <label class="field-label" for="modal-proj-mred-{m.meta.id}">Reducer</label>
              <select
                id="modal-proj-mred-{m.meta.id}"
                class="reduction-select"
                value={projectionDraft.reducer}
                onchange={(e) => {
                  const r = (e.target as HTMLSelectElement).value as MatrixReducer
                  const wasExcluded = projectionDraft.from === 'matrix-aggregate' && projectionDraft.exclude === 'diagonal'
                  projectionDraft = {
                    target: 'scalar',
                    from: 'matrix-aggregate',
                    reducer: r,
                    ...(wasExcluded ? { exclude: 'diagonal' as const } : {}),
                  }
                }}
              >
                {#each availableMatrixReducers(m.meta.id, projectionDraft.from === 'matrix-aggregate' ? projectionDraft.exclude : undefined) as r}
                  <option value={r}>{r}</option>
                {/each}
              </select>
            </div>
            <label class="bool-label">
              <input
                type="checkbox"
                checked={projectionDraft.exclude === 'diagonal'}
                onchange={(e) => {
                  const on = (e.target as HTMLInputElement).checked
                  projectionDraft = {
                    target: 'scalar',
                    from: 'matrix-aggregate',
                    reducer: projectionDraft.from === 'matrix-aggregate' ? projectionDraft.reducer : 'mean',
                    ...(on ? { exclude: 'diagonal' as const } : {}),
                  }
                }}
              />
              Exclude diagonal (self-transitions)
            </label>
          {/if}
        </div>
      {/if}

      {#if availableModes.length > 0}
        <div class="windowing-section">
          {#if availableModes.length > 1}
            <div class="field-label">Computation</div>
            <div class="mode-tabs">
              {#each availableModes as mode}
                <button
                  type="button"
                  class="mode-tab"
                  class:active={createMode === mode}
                  onclick={() => {
                    createMode = mode
                    if (m.meta.category !== 'rqa-aoi') {
                      stepSize = mode === 'epoch' ? windowSize : 100
                    }
                  }}
                >
                  {mode === 'epoch' ? 'Epoch' : 'Sliding'}
                </button>
              {/each}
            </div>
          {/if}
          <div class="window-step-row">
            <div class="field-row">
              <label class="field-label" for="modal-window-{m.meta.id}">
                {m.meta.category === 'rqa-aoi' || createMode === 'epoch'
                  ? 'Epoch'
                  : 'Window'}
              </label>
              <div class="window-group">
                <input
                  id="modal-window-{m.meta.id}"
                  class="number-input"
                  type="number"
                  bind:value={windowSize}
                  min={m.meta.category === 'rqa-aoi' ? 15 : 100}
                  step={m.meta.category === 'rqa-aoi' ? 1 : 100}
                />
                <span class="field-unit"
                  >{m.meta.category === 'rqa-aoi' ? 'fix' : 'ms'}</span
                >
              </div>
            </div>
            {#if m.meta.category !== 'rqa-aoi' && createMode === 'sliding'}
              <div class="field-row">
                <label class="field-label" for="modal-step-{m.meta.id}"
                  >Step</label
                >
                <div class="window-group">
                  <input
                    id="modal-step-{m.meta.id}"
                    class="number-input"
                    type="number"
                    bind:value={stepSize}
                    min={100}
                    step={100}
                  />
                  <span class="field-unit">ms</span>
                </div>
              </div>
            {/if}
          </div>
          {#if m.meta.category === 'rqa-aoi' && windowSize < 20}
            <div class="field-hint">
              Recommended ≥ 20 fixations for stable DET / LAM estimates
            </div>
          {:else if m.meta.category !== 'rqa-aoi' && createMode === 'sliding' && stepSize > windowSize}
            <div class="field-hint">
              Step &gt; window — gaps between bins (some data unanalyzed)
            </div>
          {/if}
          {#if m.meta.category === 'rqa-aoi'}
            <div class="field-row">
              <label class="field-label" for="modal-reduction-{m.meta.id}"
                >Reduce by</label
              >
              <select
                id="modal-reduction-{m.meta.id}"
                class="reduction-select"
                bind:value={windowReduction}
              >
                <option value="mean">Mean</option>
                <option value="max">Max</option>
                <option value="min">Min</option>
                <option value="final">Final</option>
              </select>
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
        <button type="submit" class="btn-primary"
          >{isEditMode ? 'Save' : 'Create'}</button
        >
        <button type="button" class="btn-ghost" onclick={collapseAll}
          >Cancel</button
        >
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

  /* Search */
  .search-row {
    margin-bottom: 14px;
  }

  /* Section labels */
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

  /* Library cards */
  .metric-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

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
  .drag-handle:hover {
    color: var(--c-darkgrey);
  }
  .drag-handle:active {
    cursor: grabbing;
  }

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
    transition:
      color 0.1s,
      background 0.1s;
  }
  .icon-btn:hover {
    background: var(--c-lightgrey);
    color: var(--c-text);
  }
  .icon-btn.active {
    color: var(--c-brand);
  }
  .icon-btn.danger:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  /* Add section */
  .add-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    overflow: hidden;
  }

  .add-row {
    border-bottom: 1px solid var(--c-border);
  }
  .add-row:last-child {
    border-bottom: none;
  }

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
  .add-row-header:hover {
    background: var(--c-lightgrey);
  }
  .add-row-header.active {
    background: color-mix(in srgb, var(--c-brand) 5%, var(--c-white));
  }

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

  .add-label {
    font-size: 13px;
    color: var(--c-text);
    flex: 1;
  }

  .add-chevron {
    color: var(--c-midgrey);
    line-height: 0;
    flex-shrink: 0;
    transition: transform 0.15s;
  }
  .add-chevron.rotated {
    transform: rotate(180deg);
  }

  /* Inline form (shared for both card-edit and add-row) */
  .inline-form {
    border-top: 1px solid var(--c-border);
    padding: 12px;
    background: var(--c-white);
  }

  .form-inner {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .metric-description {
    font-size: 11px;
    color: var(--c-darkgrey);
    line-height: 1.5;
    margin: 0;
    padding-bottom: 2px;
  }

  .param-row {
    display: flex;
    flex-direction: column;
  }

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
    transition:
      background 0.1s,
      color 0.1s;
    text-align: center;
  }
  .mode-tab:hover {
    color: var(--c-text);
  }
  .mode-tab.active {
    background: var(--c-white);
    color: var(--c-text);
    font-weight: 500;
  }

  .window-step-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: 11px;
    color: var(--c-darkgrey);
    min-width: 60px;
    flex-shrink: 0;
  }

  .window-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

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
  .number-input:focus {
    border-color: var(--c-brand);
  }

  .field-unit {
    font-size: 11px;
    color: var(--c-darkgrey);
  }

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
  .reduction-select:focus {
    border-color: var(--c-brand);
  }

  .field-hint {
    font-size: 10px;
    color: var(--c-darkgrey);
    line-height: 1.4;
  }
  .field-hint.warn {
    color: #b45309;
  }
  .field-hint em {
    font-style: italic;
  }

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
  .text-input:focus {
    border-color: var(--c-brand);
  }

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
  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-ghost {
    background: none;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    cursor: pointer;
    font-size: 12px;
    color: var(--c-darkgrey);
    padding: 5px 14px;
  }
  .btn-ghost:hover {
    background: var(--c-lightgrey);
    color: var(--c-text);
  }
</style>

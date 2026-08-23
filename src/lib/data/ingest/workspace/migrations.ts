import { LEGACY_VISUALIZATION_TYPES } from '$lib/plots/legacyTypes'
import {
  carrySummaryStatistic,
  createDefaultMetricInstances,
  createMetricInstance,
  isStrandedAoiAggregate,
  type MetricInstance,
} from '$lib/metrics/instances'
import {
  type MigratedJsonFormat,
  CURRENT_SCHEMA_VERSION,
  seededCategoriesSelection,
  seededEventsSelection,
} from '$lib/data/types'

const CORE_LAYOUT_KEYS = new Set([
  'id',
  'type',
  'x',
  'y',
  'w',
  'h',
  'min',
  'redrawTimestamp',
])

/**
 * Plot types carrying the `hideNoAoi` setting (backfilled to `false` below).
 *
 * CURRENT registry keys, not on-disk ones: every set here is consulted AFTER
 * the version-independent `LEGACY_VISUALIZATION_TYPES` rewrite below, so a
 * file saying 'barPlot' already reads as 'aoiComparison' by then.
 */
const HIDE_NO_AOI_PLOT_TYPES = new Set([
  'aoiComparison',
  'aoiStreamPlot',
  'transitionMatrix',
  'scarf',
])

/** Plot types whose settings carry a per-plot `aoiSelectionId`. */
const AOI_SELECTION_PLOT_TYPES = new Set([
  'scarf',
  'aoiComparison',
  'aoiStreamPlot',
  'transitionMatrix',
  'recurrencePlot',
  'scanpathSimilarity',
  'metricCorrelation',
  'evolvingMetrics',
])
/** Plot types whose settings carry `eventSelectionId` / `categorySelectionId`. */
const EVENT_SELECTION_PLOT_TYPES = new Set(['scarf'])
const CATEGORY_SELECTION_PLOT_TYPES = new Set(['scarf'])

const MIGRATED_SELECTION_NAME = 'Migrated visibility'

/** 1.9.2's built-in "None" picker option, retired in favour of seeded rows. */
const RETIRED_NONE_SELECTION_ID = -1

/** Next free selection id: 1 + the highest id already present (0 when empty). */
function nextSelectionId(selections: { id: number }[]): number {
  return selections.reduce((m, sel) => Math.max(m, Number(sel?.id) || 0), 0) + 1
}

/** The axis's stored rows, healing a missing or corrupt field to `[]`. */
function selectionRows(payload: any, key: string): { id: number; name?: string }[] {
  if (!Array.isArray(payload[key])) payload[key] = []
  return payload[key]
}

/** The id of the row named `name`, or a fresh one seeded through `seed`. */
function findOrSeed<T extends { id: number; name: string }>(
  rows: { id: number; name?: string }[],
  name: string,
  seed: (id: number) => T
): number {
  const existing = rows.find(r => r?.name === name)
  if (existing) return existing.id
  const id = nextSelectionId(rows)
  rows.push(seed(id))
  return id
}

/**
 * V5 → V6, the layer-off half: give every migrated workspace the two rows that
 * replace the retired `-1` picker option, so the narrowing 1.9.2 offered stays
 * reachable. Adopts a same-named row rather than duplicating it: 1.9.2 users
 * were told to hand-build exactly these.
 */
function seedLayerOffSelections(payload: any): void {
  findOrSeed(
    selectionRows(payload, 'categoriesSelections'),
    seededCategoriesSelection(0).name,
    seededCategoriesSelection
  )
  findOrSeed(
    selectionRows(payload, 'eventsSelections'),
    seededEventsSelection(0).name,
    seededEventsSelection
  )
}

/**
 * Version-independent: point the older spellings of "layer off" at a seeded row
 * (a stored `-1`, the scarf's retired `hideEvents`). Left alone both fall
 * through `<= 0 → All`, switching a hidden layer back on. NOT version-gated
 * because in-branch builds stamped v6 while the sentinel was still live, so the
 * value outlived the format step. Self-limiting: it seeds only when a straggler
 * needs a target, so a deleted row never comes back on a later load.
 * `hideEvents` beats the later hidden-channels pass because the id it stamps is
 * non-zero, which `stampSelectionOnPlots` skips.
 */
function sweepRetiredSentinel(payload: any, gridItems: any[]): void {
  const holds = (key: string): boolean =>
    gridItems.some(i => i?.settings?.[key] === RETIRED_NONE_SELECTION_ID)
  const needsEvents =
    holds('eventSelectionId') ||
    gridItems.some(i => i?.settings?.hideEvents === true)
  if (!holds('categorySelectionId') && !needsEvents) return

  const categoryId = findOrSeed(
    selectionRows(payload, 'categoriesSelections'),
    seededCategoriesSelection(0).name,
    seededCategoriesSelection
  )
  const eventId = findOrSeed(
    selectionRows(payload, 'eventsSelections'),
    seededEventsSelection(0).name,
    seededEventsSelection
  )
  for (const item of gridItems) {
    const s = item?.settings
    if (!s || typeof s !== 'object') continue
    if (s.hideEvents === true) s.eventSelectionId = eventId
    delete s.hideEvents
    if (s.categorySelectionId === RETIRED_NONE_SELECTION_ID)
      s.categorySelectionId = categoryId
    if (s.eventSelectionId === RETIRED_NONE_SELECTION_ID)
      s.eventSelectionId = eventId
  }
}

/**
 * Convert one axis's legacy per-stimulus hidden sets into name-keyed
 * SELECTIONS: per affected stimulus, the keep-list is the displayed names the
 * hidden set left visible; stimuli whose keep-lists match share ONE selection.
 * Pushes the new selections into `selections` (mutated) and returns
 * stimulusIndex → selection id for the plot-stamping pass. Stale hidden ids
 * (no matching entity row) count as nothing hidden.
 */
function hiddenSetsToNameSelections(
  defs: unknown,
  orderVectors: unknown,
  hidden: unknown,
  selections: { id: number; name: string; names: string[] }[],
  stimulusName: (s: number) => string
): Map<number, number> {
  const byStimulus = new Map<number, number>()
  if (!Array.isArray(hidden) || !Array.isArray(defs)) return byStimulus

  // key = order-independent identity of the keep-list → selection index
  const byKeepSet = new Map<string, { names: string[]; stimuli: number[] }>()
  for (let s = 0; s < hidden.length; s++) {
    const rows = defs[s]
    if (!Array.isArray(rows) || rows.length === 0) continue
    const hiddenIds = new Set(
      (Array.isArray(hidden[s]) ? hidden[s] : []).filter(
        (id: unknown): id is number =>
          Number.isInteger(id) && (id as number) >= 0 && (id as number) < rows.length
      )
    )
    if (hiddenIds.size === 0) continue

    const rawOrder = Array.isArray(orderVectors) ? orderVectors[s] : undefined
    const order =
      Array.isArray(rawOrder) && rawOrder.length > 0
        ? rawOrder
        : rows.map((_: unknown, i: number) => i)
    const names: string[] = []
    for (const id of order) {
      const row = rows[id]
      if (!row || hiddenIds.has(id)) continue
      const name = String(row[1] ?? row[0] ?? '')
      if (!names.includes(name)) names.push(name)
    }

    const key = JSON.stringify([...names].sort())
    const entry = byKeepSet.get(key)
    if (entry) entry.stimuli.push(s)
    else byKeepSet.set(key, { names, stimuli: [s] })
  }
  if (byKeepSet.size === 0) return byStimulus

  let nextId = nextSelectionId(selections)
  for (const { names, stimuli } of byKeepSet.values()) {
    const name =
      byKeepSet.size === 1
        ? MIGRATED_SELECTION_NAME
        : `${MIGRATED_SELECTION_NAME} (${stimulusName(stimuli[0])})`
    const id = nextId++
    selections.push({ id, name, names })
    for (const s of stimuli) byStimulus.set(s, id)
  }
  return byStimulus
}

/** Stamp `key` on every plot of a supported type whose stimulus is affected,
 *  unless the plot already carries an explicit selection (newer user intent). */
function stampSelectionOnPlots(
  gridItems: unknown[],
  types: Set<string>,
  key: string,
  selectionIdFor: (stimulusId: number) => number | undefined
): void {
  for (const item of gridItems as any[]) {
    if (!item || !types.has(item.type)) continue
    const settings = item.settings
    if (!settings || typeof settings !== 'object') continue
    if ((settings[key] ?? 0) !== 0) continue
    const id = selectionIdFor(Number(settings.stimulusId))
    if (id !== undefined) settings[key] = id
  }
}

/**
 * Version-independent: convert the retired hidden-visibility sets of old
 * workspace files into named SELECTIONS applied per plot, so an already
 * created workspace keeps rendering exactly what it rendered before the
 * mechanism was removed. Consumes (deletes) the legacy fields, making the
 * pass idempotent; plots added later default to "All" like any new plot.
 */
function migrateLegacyVisibility(payload: any, gridItems: unknown[]): void {
  const stimulusName = (s: number): string => {
    const row = payload?.stimuli?.data?.[s]
    return String(row?.[1] ?? row?.[0] ?? `Stimulus ${s}`)
  }

  // --- AOIs (per-stimulus hidden ids → name-keyed aois.selections) ---
  const aois = payload?.aois
  if (aois?.hiddenAois) {
    const selections: { id: number; name: string; names: string[] }[] =
      (aois.selections ??= [])
    const byStimulus = hiddenSetsToNameSelections(
      aois.data,
      aois.orderVector,
      aois.hiddenAois,
      selections,
      stimulusName
    )
    if (selections.length === 0) delete aois.selections
    stampSelectionOnPlots(gridItems, AOI_SELECTION_PLOT_TYPES, 'aoiSelectionId', s =>
      byStimulus.get(s)
    )
    delete aois.hiddenAois
  }

  // --- Event channels (per-stimulus hidden ids → name-keyed eventsSelections) ---
  const ed = payload?.eventData
  if (ed?.hiddenChannels) {
    const selections: { id: number; name: string; names: string[] }[] =
      (payload.eventsSelections ??= [])
    const byStimulus = hiddenSetsToNameSelections(
      ed.data,
      ed.orderVector,
      ed.hiddenChannels,
      selections,
      stimulusName
    )
    // No empty-array cleanup here, unlike the AOI axis above: the v6 → v7 seed
    // already put a row in this list, so it is never empty by now.
    stampSelectionOnPlots(gridItems, EVENT_SELECTION_PLOT_TYPES, 'eventSelectionId', s =>
      byStimulus.get(s)
    )
    delete ed.hiddenChannels
  }

  // --- Eye-movement categories (GLOBAL hidden ids → id-keyed categoriesSelections) ---
  const categories = payload?.categories
  if (categories?.hiddenCategories) {
    const rows: unknown[] = Array.isArray(categories.data) ? categories.data : []
    // Fixation (id 0) could never be hidden in the legacy model.
    const hiddenIds = new Set(
      (Array.isArray(categories.hiddenCategories)
        ? categories.hiddenCategories
        : []
      ).filter(
        (id: unknown): id is number =>
          Number.isInteger(id) && (id as number) > 0 && (id as number) < rows.length
      )
    )
    if (hiddenIds.size > 0) {
      const selections: { id: number; name: string; memberIds: number[] }[] =
        (payload.categoriesSelections ??= [])
      // Id 0 is INCLUDED: the fixation baseline joined the SELECTION domain,
      // and the legacy model always drew fixations — a migrated selection
      // without 0 would silently blank every fixation layer on load.
      const memberIds = rows
        .map((_, id) => id)
        .filter(id => !hiddenIds.has(id))
      const id = nextSelectionId(selections)
      selections.push({ id, name: MIGRATED_SELECTION_NAME, memberIds })
      // Hidden categories were global, so every plot gets the selection.
      stampSelectionOnPlots(
        gridItems,
        CATEGORY_SELECTION_PLOT_TYPES,
        'categorySelectionId',
        () => id
      )
    }
    delete categories.hiddenCategories
  }
}

/**
 * Collapse the legacy WindowSpec `mode` field into an explicit `stepSize`.
 * Epoch was always `stepSize === windowSize`; sliding without a stepSize
 * defaulted to windowSize too. After this, projections only carry
 * `{ windowSize, stepSize }`.
 */
function collapseWindowMode(inst: any): any {
  const proj = inst?.projection
  if (!proj || proj.kind !== 'windowed' || !proj.window) return inst
  const w = proj.window
  if (!('mode' in w) && typeof w.stepSize === 'number') return inst
  const windowSize = typeof w.windowSize === 'number' ? w.windowSize : 0
  const stepSize =
    typeof w.stepSize === 'number'
      ? w.stepSize
      : windowSize
  const { mode: _mode, ...restWindow } = w
  return {
    ...inst,
    projection: {
      ...proj,
      window: { ...restWindow, windowSize, stepSize },
    },
  }
}

/**
 * The cross-participant statistic field was renamed `groupAggregation` →
 * `reduction` and narrowed to {mean, sum} (median moved to the bar's
 * distribution overlay; proportion became a metric class). Carry a serialized
 * value across, keeping only the two sound reductions; an unsound legacy value
 * (median / proportion) is dropped so the instance rides its metric's default
 * reduction.
 */
function carryReduction(inst: any): any {
  if (!inst || typeof inst !== 'object' || !('groupAggregation' in inst)) return inst
  const { groupAggregation, ...rest } = inst
  return groupAggregation === 'sum' || groupAggregation === 'mean'
    ? { ...rest, reduction: groupAggregation }
    : rest
}

/**
 * Sequentially upgrades raw JSON data to the current schema.
 * Operates entirely on raw data objects to ensure Web Worker safety.
 */
// The single method-parameterized `participantPairSimilarity` recipe split into
// one baseId per method; carry the old instance onto the matching new recipe.
function migrateLegacyParticipantPairSimilarity(inst: any): any {
  if (!inst || typeof inst !== 'object') return inst
  if (inst.baseId === 'participantPairSimilarity') {
    const method = inst.params?.method
    const { method: _, ...restParams } = inst.params || {}
    const newBaseId =
      method === 'needlemanWunsch'
        ? 'scanpathNeedlemanWunschSimilarity'
        : 'scanpathLevenshteinSimilarity'
    return {
      ...inst,
      baseId: newBaseId,
      params: restParams,
    }
  }
  return inst
}

export function runMigrations(parsedJson: unknown): MigratedJsonFormat {
  let data = parsedJson as any
  let version = data.version || 1 // Fallback for unversioned legacy files

  // V1/V2 to V3: Standardize the version marker
  if (version <= 2) {
    data = { ...data, version: 3 }
    version = 3
  }

  // V3 to V4: Flat to Nested Translation
  if (version === 3) {
    const sourceItems: any[] | undefined = data.gridItems
    // If no gridItems existed in the source, keep undefined so the ingest
    // apply resolves the session's default layout.
    let migratedItems: any[] | undefined
    if (sourceItems && sourceItems.length > 0) {
      migratedItems = sourceItems.map((item: any) => {
        // If it already has a settings object, leave it alone (duck-typing safety net)
        if (item.settings && typeof item.settings === 'object') {
          return item
        }

        const core: Record<string, any> = {}
        const settings: Record<string, any> = {}

        for (const [key, value] of Object.entries(item)) {
          if (CORE_LAYOUT_KEYS.has(key)) {
            core[key] = value
          } else {
            settings[key] = value
          }
        }

        return { ...core, settings }
      })
    }

    // Duck-type check: if `data.data` is already an object with stimuli, this
    // V3 file is already in the nested { version, data: DataType } format —
    // just migrate the gridItems. Otherwise wrap the flat root fields.
    let payload: Record<string, any>
    if (data.data && typeof data.data === 'object' && data.data.stimuli) {
      payload = data.data
    } else {
      // Legacy flat format: extract payload fields from the root.
      const {
        version: _v,
        gridItems: _g,
        fileMetadata: _fm,
        ...payloadFields
      } = data
      payload = payloadFields
    }

    // Normalize missing/null orderVectors to [] so the empty-array fallback
    // logic in selectors (empty → sequential 0,1,2,…) works correctly.
    for (const key of ['stimuli', 'participants', 'categories']) {
      if (payload[key]) {
        payload[key].orderVector = payload[key].orderVector ?? []
      }
    }
    if (payload.aois) {
      const rawAoiOv = payload.aois.orderVector

      if (rawAoiOv === null || rawAoiOv === undefined) {
        // Missing: leave empty (empty order vector = identity order)
        payload.aois.orderVector = []
      } else if (Array.isArray(rawAoiOv)) {
        // Already an array — keep as-is
        payload.aois.orderVector = rawAoiOv
      } else if (typeof rawAoiOv === 'object') {
        // Legacy format: { "0": [...], "3": [...], ... } — convert to sparse array
        const stimuliCount: number = payload.stimuli?.data?.length ?? 0
        const converted: number[][] = Array.from({ length: stimuliCount }, () => [])
        for (const [key, val] of Object.entries(rawAoiOv)) {
          const idx = parseInt(key, 10)
          if (!isNaN(idx) && idx >= 0 && idx < stimuliCount && Array.isArray(val)) {
            converted[idx] = val as number[]
          }
        }
        payload.aois.orderVector = converted
      } else {
        payload.aois.orderVector = []
      }

      payload.aois.dynamicVisibility = payload.aois.dynamicVisibility ?? {}
    }

    data = {
      version: 4,
      data: payload,
      gridItems: migratedItems,
      fileMetadata: data.fileMetadata ?? null,
    }
    version = 4
  }

  // V4 → V5: the 1.9.0 metrics-system migration. (An earlier in-branch split
  // into a separate v5 → v6 step was collapsed here; both halves now run as one
  // bump, so the export's stamped version always matches the data it writes.
  // The former baseId-rename / label-upgrade passes, which only ever fired on
  // hand-authored intermediate v5 files, were dropped as unreachable.)
  //
  // v5 has since SHIPPED on `main` (1.9.2), so real v5 files exist and this
  // step no longer terminates the chain — it hands off to the v5 → v6 step
  // below rather than stamping CURRENT_SCHEMA_VERSION.
  //   1. Materialize `eventData` from legacy `aois.dynamicVisibility`.
  //   2. Seed `payload.metricInstances` with the slug-keyed starter library.
  //   3. Translate legacy bar / transition-matrix settings to reference that
  //      library:
  //      - barPlot:          aggregationMethod (string) → metricInstanceId (slug)
  //      - transitionMatrix: aggregationMethod (string) → metricInstanceId
  //        (slug for the 5 starter-backed methods; new UUID-keyed custom
  //        instance for probability2 / probability3, which have no starter).
  //   4. Migrate `aoiStreamPlot` off its bespoke `binSize` onto a windowed ×
  //      identity-aoi-vector metric instance.
  //   5. Normalize every metric-reference settings field to the canonical
  //      `metricInstanceIds: string[]` shape.
  if (version === 4) {
    const payload = data.data
    const stimuliCount: number = payload.stimuli?.data?.length ?? 0
    const participantCount: number = payload.participants?.data?.length ?? 0

    // 1. dynamicVisibility → eventData
    const eventDataData: string[][][] = Array.from(
      { length: stimuliCount },
      () => [] as string[][]
    )
    // events: [stimulusId][channelId][participantId] → stride-2 number[]
    const eventDataEvents: number[][][][] = Array.from(
      { length: stimuliCount },
      () => [] as number[][][]
    )

    const dv = payload.aois?.dynamicVisibility
    if (dv && typeof dv === 'object') {
      // Group keys by stimulus+AOI, collecting per-participant intervals
      const grouped: Record<string, Record<number, number[]>> = {}
      for (const oldKey in dv) {
        const parts = oldKey.split('_')
        const stimulusId = parseInt(parts[0], 10)
        const aoiId = parseInt(parts[1], 10)
        if (isNaN(stimulusId) || stimulusId < 0 || stimulusId >= stimuliCount)
          continue
        if (isNaN(aoiId)) continue

        const groupKey = `${stimulusId}_${aoiId}`
        if (!grouped[groupKey]) grouped[groupKey] = {}

        // Convert alternating [start, end, ...] → stride-2 [start, duration, ...]
        const intervals: number[] = dv[oldKey]
        const events: number[] = []
        for (let i = 0; i < intervals.length; i += 2) {
          const start = intervals[i]
          const end = intervals[i + 1]
          if (end === undefined || end === null) {
            events.push(start, 0)
          } else {
            events.push(start, end - start)
          }
        }

        if (parts.length > 2) {
          // Per-participant key: stimulusId_aoiId_participantId
          const participantId = parseInt(parts[2], 10)
          if (!isNaN(participantId) && participantId >= 0 && participantId < participantCount) {
            grouped[groupKey][participantId] = events
          }
        } else {
          // Global key: apply same events to all participants
          for (let p = 0; p < participantCount; p++) {
            grouped[groupKey][p] = events
          }
        }
      }

      for (const groupKey in grouped) {
        const [stimStr, aoiStr] = groupKey.split('_')
        const stimulusId = parseInt(stimStr, 10)
        const aoiId = parseInt(aoiStr, 10)

        const aoiRow = payload.aois?.data?.[stimulusId]?.[aoiId]
        const originalName = aoiRow?.[0] ?? `AOI ${aoiId}`
        const displayedName = aoiRow?.[1] ?? originalName
        const color = aoiRow?.[2] ?? '#888888'

        // Build per-participant buffer array
        const perParticipant: number[][] = Array.from({ length: participantCount }, () => [])
        const participantEvents = grouped[groupKey]
        for (const pStr in participantEvents) {
          perParticipant[parseInt(pStr, 10)] = participantEvents[parseInt(pStr, 10)]
        }

        eventDataData[stimulusId].push([originalName, displayedName, color])
        eventDataEvents[stimulusId].push(perParticipant)
      }
    }

    payload.eventData = {
      data: eventDataData,
      orderVector: eventDataData.map(channels =>
        channels.map((_, i) => i)
      ),
      events: eventDataEvents,
    }

    // 2. Seed metric-instance library with the slug-keyed starter set.
    const metricInstances: MetricInstance[] = createDefaultMetricInstances()
    payload.metricInstances = metricInstances

    // 3. Translate legacy plot settings.
    // Slugs below match STARTING_METRICS in src/lib/metrics/startingMetrics.ts.
    const BAR_BASEID_TO_SLUG: Record<string, string> = {
      absoluteTime:             'absoluteTime',
      relativeTime:             'relativeTime',
      averageEntries:           'visitCount',
      avgDwellDuration:         'visitDuration',
      averageFixationCount:     'fixationCount',
      avgFixationDuration:      'fixationDuration',
      timeToFirstFixation:      'timeToFirstFixation',
      avgFirstFixationDuration: 'firstFixationDuration',
    }

    // Cache of on-demand custom instances so repeated grid items sharing
    // the same legacy aggregationMethod share a single MetricInstance.
    const customCache = new Map<string, string>()
    function ensureCustomMatrix(
      baseId: string,
      params: Record<string, unknown>,
    ): string {
      const key = `${baseId}|${JSON.stringify(params)}`
      const cached = customCache.get(key)
      if (cached !== undefined) return cached
      const inst = createMetricInstance({
        baseId,
        params,
        projection: { kind: 'identity-aoi-pair-matrix' },
      })
      if (!inst) throw new Error(`Migration: unknown recipe "${baseId}"`)
      metricInstances.push(inst)
      customCache.set(key, inst.id)
      return inst.id
    }

    function mapTransitionAggregation(method: unknown): string {
      switch (method) {
        case 'sum':              return 'transitionCount-fix'
        case 'probability':      return 'transitionProbability-fix'
        case 'dwellTime':        return 'transitionDwellMean-fix'
        case 'segmentDwellTime': return 'transitionDwellMean-visit'
        // Starter-backed since transitionRelativeFrequency was seeded; minting
        // a custom instance here would duplicate that starter in the library.
        case 'frequencyRelative': return 'transitionRelativeFrequency-fix'
        case 'probability2':
          return ensureCustomMatrix('transitionProbability', { mode: 'fixation', step: 2 })
        case 'probability3':
          return ensureCustomMatrix('transitionProbability', { mode: 'fixation', step: 3 })
        default: return 'transitionCount-fix'
      }
    }

    if (Array.isArray(data.gridItems)) {
      data.gridItems = data.gridItems.map((item: any) => {
        if (!item || typeof item.type !== 'string') return item
        const s = item.settings
        if (!s || typeof s !== 'object') return item

        // Raw ON-DISK type, deliberately not the current 'aoiComparison' key:
        // this versioned step runs BEFORE the legacy-type rewrite below, so the
        // only value it can ever see for this plot is the old 'barPlot'.
        if (item.type === 'barPlot') {
          const baseId =
            typeof s.aggregationMethod === 'string' ? s.aggregationMethod : 'absoluteTime'
          const metricInstanceId = BAR_BASEID_TO_SLUG[baseId] ?? 'absoluteTime'
          const { aggregationMethod: _drop, ...rest } = s
          return { ...item, settings: { ...rest, metricInstanceId } }
        }

        if (item.type === 'transitionMatrix') {
          const metricInstanceId = mapTransitionAggregation(s.aggregationMethod)
          const { aggregationMethod: _drop, ...rest } = s
          return { ...item, settings: { ...rest, metricInstanceId } }
        }

        return item
      })
    }

    // 4. Migrate aoi-stream gridItems' `binSize → metricInstanceId`. Each
    //    distinct `binSize` maps to a deterministic slug. Slug collision is
    //    resolved by validating the existing instance's shape against the one
    //    we'd create; on mismatch we generate a UUID-suffixed slug rather than
    //    hijacking a starter or user-authored instance.
    const slugByBinSize = new Map<number, string>()
    const matchesExpectedShape = (inst: any, binSize: number): boolean => {
      if (!inst || inst.baseId !== 'absoluteTime') return false
      const proj = inst.projection
      if (!proj || proj.kind !== 'windowed') return false
      const w = proj.window
      if (!w || w.windowSize !== binSize || w.stepSize !== binSize) return false
      const inner = proj.inner
      return !!inner && inner.kind === 'identity-aoi-vector'
    }
    function ensureWindowedAoiInstance(binSize: number): string {
      const cached = slugByBinSize.get(binSize)
      if (cached !== undefined) return cached
      const baseSlug = `absoluteTime-aoi-windowed-${binSize}`
      const existing = metricInstances.find((i: any) => i && i.id === baseSlug)
      if (existing && matchesExpectedShape(existing, binSize)) {
        slugByBinSize.set(binSize, baseSlug)
        return baseSlug
      }
      // No collision → claim the deterministic slug.
      // Collision with a differently-shaped instance → mint a UUID-suffixed
      // slug so we never silently hijack a user-authored entry.
      const slug = existing ? `${baseSlug}-${crypto.randomUUID().slice(0, 8)}` : baseSlug
      const inst = createMetricInstance({
        id: slug,
        baseId: 'absoluteTime',
        label: `Time on AOI (per ${binSize} ms bin)`,
        // Match the fresh `absoluteTime-aoi-windowed-500` starter: a cohort
        // total per window so the timeline tapers as participants drop out.
        reduction: 'sum',
        projection: {
          kind: 'windowed',
          window: { windowSize: binSize, stepSize: binSize },
          inner: { kind: 'identity-aoi-vector' },
        },
      })
      if (!inst) throw new Error('Migration: recipe "absoluteTime" missing')
      metricInstances.push(inst)
      slugByBinSize.set(binSize, slug)
      return slug
    }

    if (Array.isArray(data.gridItems)) {
      data.gridItems = data.gridItems.map((item: any) => {
        if (!item || item.type !== 'aoiStreamPlot') return item
        const s = item.settings
        if (!s || typeof s !== 'object') return item
        if (Array.isArray(s.metricInstanceIds)) return item // already migrated
        if (typeof s.metricInstanceId === 'string') return item // first-pass binSize migration done; field-name pass below picks it up
        const binSize =
          typeof s.binSize === 'number' && s.binSize > 0 ? s.binSize : 500
        const metricInstanceId = ensureWindowedAoiInstance(binSize)
        const { binSize: _drop, ...rest } = s
        return { ...item, settings: { ...rest, metricInstanceId } }
      })
    }

    // 5. Normalize all metric-reference settings fields to `metricInstanceIds: string[]`.
    // Per the 1.9.0 plan ("collapse equivalent variants"): three legacy field names
    // (`metricInstanceId`, `selectedMetricId`, `enabledMetricIds`) collapse into one
    // canonical array shape. Singleton plots store length-0 (none) or length-1
    // arrays; multi-select plots (metric-correlation) store N. Idempotent — if
    // `metricInstanceIds` already exists, the pass is a no-op.
    if (Array.isArray(data.gridItems)) {
      data.gridItems = data.gridItems.map((item: any) => {
        if (!item || typeof item !== 'object') return item
        const s = item.settings
        if (!s || typeof s !== 'object') return item
        if (Array.isArray(s.metricInstanceIds)) return item // already on the new shape

        let nextIds: string[] | null = null
        let dropKey: 'metricInstanceId' | 'selectedMetricId' | 'enabledMetricIds' | null = null
        if (typeof s.metricInstanceId === 'string') {
          nextIds = [s.metricInstanceId]
          dropKey = 'metricInstanceId'
        } else if (s.metricInstanceId === null) {
          nextIds = []
          dropKey = 'metricInstanceId'
        } else if (typeof s.selectedMetricId === 'string') {
          nextIds = [s.selectedMetricId]
          dropKey = 'selectedMetricId'
        } else if (s.selectedMetricId === null) {
          nextIds = []
          dropKey = 'selectedMetricId'
        } else if (Array.isArray(s.enabledMetricIds)) {
          nextIds = s.enabledMetricIds.filter((id: unknown): id is string => typeof id === 'string')
          dropKey = 'enabledMetricIds'
        }
        if (nextIds === null || dropKey === null) return item
        const { [dropKey]: _drop, ...rest } = s
        return { ...item, settings: { ...rest, metricInstanceIds: nextIds } }
      })
    }

    // `payload.metricInstances` already references the seeded `metricInstances`
    // array (mutated in place by the aoi-stream pass above), so no reassignment
    // is needed here.
    //
    // Stamps a LITERAL 5, not CURRENT_SCHEMA_VERSION: a v4 file carries
    // `barPlottingType` just like a v5 one, so it has to fall through the
    // v5 → v6 step below instead of jumping the chain to the ceiling.
    data = { ...data, version: 5, data: payload }
    version = 5
  }

  // V5 → V6: `barPlottingType` → `orientation` on plot settings. The key was
  // named after the AOI Comparison's old mark ('barPlot') while it only ever
  // meant the category axis direction — and the figure it configures draws a
  // beeswarm, not bars, for every non-proportion metric. Renamed with the plot
  // itself (barPlot → aoiComparison).
  //
  // Keyed on the FIELD, not on a plot-type list: the only two plots that carry
  // it both take the same values, and a settings key rename has no reason to
  // care which plot holds it. Idempotent — an already-renamed file has no
  // `barPlottingType` left to move, and an explicit `orientation` always wins.
  if (version === 5) {
    if (Array.isArray(data.gridItems)) {
      data.gridItems = data.gridItems.map((item: any) => {
        if (!item || typeof item !== 'object') return item
        const s = item.settings
        if (!s || typeof s !== 'object' || !('barPlottingType' in s)) return item
        const { barPlottingType, ...rest } = s
        return {
          ...item,
          settings: { ...rest, orientation: rest.orientation ?? barPlottingType },
        }
      })
    }
    // The bump's other half: every migrated workspace gains the layer-off rows.
    if (data?.data) seedLayerOffSelections(data.data)
    data = { ...data, version: CURRENT_SCHEMA_VERSION }
    version = CURRENT_SCHEMA_VERSION
  }

  // Version-independent: the retired `-1` sentinel and `hideEvents` are legacy
  // VALUES, not a format step — in-branch builds stamped v6 while both were
  // still live. Runs after the passes above so a seeded row is already in place.
  if (data?.data) {
    sweepRetiredSentinel(
      data.data,
      Array.isArray(data.gridItems) ? data.gridItems : []
    )
  }

  // Version-independent normalization: rewrite any legacy gridItem `type`
  // keys (e.g. capital-T 'TransitionMatrix' → 'transitionMatrix') to the
  // current registry key. Runs on every load — including already-current
  // files and URL-loaded layouts — so downstream lookups like
  // `plotRegistry[item.type]` always hit.
  if (Array.isArray(data.gridItems)) {
    data.gridItems = data.gridItems.map((item: any) => {
      if (!item || typeof item.type !== 'string') return item
      const normalized =
        LEGACY_VISUALIZATION_TYPES[
          item.type as keyof typeof LEGACY_VISUALIZATION_TYPES
        ]
      const nextItem = normalized ? { ...item, type: normalized } : item
      if (
        HIDE_NO_AOI_PLOT_TYPES.has(nextItem.type) &&
        nextItem.settings &&
        typeof nextItem.settings === 'object'
      ) {
        if (nextItem.settings.hideNoAoi === undefined) {
          nextItem.settings = { ...nextItem.settings, hideNoAoi: false }
        }
      }
      return nextItem
    })
  }

  // Version-independent: legacy hidden-visibility sets → named SELECTIONS
  // (runs after the type rewrite above so plot-type gating sees current keys).
  if (data?.data) {
    migrateLegacyVisibility(
      data.data,
      Array.isArray(data.gridItems) ? data.gridItems : []
    )
  }

  // Version-independent normalization of the metric-instance library, in pass
  // order: collapse the legacy WindowSpec `mode` into an explicit `stepSize`
  // (`collapseWindowMode`), carry the renamed `groupAggregation` field across
  // as `reduction` (`carryReduction`), move a `statistic` param onto the
  // summary leaf that now owns it (`carrySummaryStatistic`), then prune
  // `aggregate-aoi` extremes the
  // metric no longer NAMES (`meta.aoiAggregate`) — 1.9.x offered max/min on
  // every aoi-vector metric, and such an instance would strand invisibly:
  // rejected by every plot contract, so no library card, no delete button, yet
  // re-serialized into every export. There is no sound remap (the projection
  // has no defined reading); a plot that referenced a pruned instance falls
  // back to its metric placeholder, same as any missing instance.
  const instances = data?.data?.metricInstances
  if (Array.isArray(instances)) {
    data.data.metricInstances = instances
      .map(collapseWindowMode)
      .map(carryReduction)
      .map(carrySummaryStatistic)
      .map(migrateLegacyParticipantPairSimilarity)
      .filter((inst: any) => !isStrandedAoiAggregate(inst))
  }

  // Version-independent normalization: the participant selection field was
  // renamed `participantsGroups` → `participantsSelections` (the SELECTION
  // vocabulary unification). This is the one selection field that shipped in
  // `main`, so workspaces on disk carry the legacy key — map it across and drop
  // the old one so the engine only ever sees the new field. (Stimulus / category
  // / event selections never shipped under a `*Groups` key, so they need no heal.)
  const selectionPayload = data?.data
  if (selectionPayload && typeof selectionPayload === 'object') {
    if (
      Array.isArray(selectionPayload.participantsGroups) &&
      !Array.isArray(selectionPayload.participantsSelections)
    ) {
      selectionPayload.participantsSelections = selectionPayload.participantsGroups
    }
    delete selectionPayload.participantsGroups
  }

  return data as MigratedJsonFormat
}

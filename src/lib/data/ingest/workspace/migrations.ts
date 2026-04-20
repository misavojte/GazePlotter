import {
  createSystemMetricInstances,
  createDefaultWindowedInstances,
  createDefaultAoiPairInstances,
  findSystemInstanceIdByBaseId,
} from '$lib/metrics/instances'
import { LEGACY_VISUALIZATION_TYPES } from '$lib/plots/registry'

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
 * Sequentially upgrades raw JSON data to the current Version 4 schema.
 * Operates entirely on raw data objects to ensure Web Worker safety.
 */
export function runMigrations(parsedJson: any): any {
  let data = parsedJson
  let version = data.version || 1 // Fallback for unversioned legacy files

  // V1/V2 to V3: Standardize the version marker
  if (version <= 2) {
    data = { ...data, version: 3 }
    version = 3
  }

  // V3 to V4: Flat to Nested Translation
  if (version === 3) {
    const sourceItems: any[] | undefined = data.gridItems
    // If no gridItems existed in the source, keep undefined so the parser's
    // `?? DEFAULT_GRID_STATE_DATA` fallback applies the default layout.
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
    if (payload.stimuli) {
      payload.stimuli.orderVector = payload.stimuli.orderVector ?? []
    }
    if (payload.participants) {
      payload.participants.orderVector = payload.participants.orderVector ?? []
    }
    if (payload.categories) {
      payload.categories.orderVector = payload.categories.orderVector ?? []
    }
    if (payload.aois) {
      const rawAoiOv = payload.aois.orderVector

      if (rawAoiOv === null || rawAoiOv === undefined) {
        // Missing: leave empty, hiddenAois fill-in handles the rest
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
      payload.aois.hiddenAois = payload.aois.hiddenAois ?? []
    }

    data = {
      version: 4,
      data: payload,
      gridItems: migratedItems,
      fileMetadata: data.fileMetadata ?? null,
    }
    version = 4
  }

  // V4 to V5: Migrate dynamicVisibility → eventData
  if (version === 4) {
    const payload = data.data
    const stimuliCount: number = payload.stimuli?.data?.length ?? 0

    const participantCount: number = payload.participants?.data?.length ?? 0

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
      hiddenChannels: Array.from({ length: stimuliCount }, () => []),
      events: eventDataEvents,
    }

    data = { ...data, version: 5, data: payload }
    version = 5
  }

  // V5 to V6: Seed metric instances on metadata and translate
  // metric-correlation plots' `enabledMetrics: string[]` → `enabledMetricIds: number[]`
  if (version === 5) {
    const payload = data.data
    if (!Array.isArray(payload.metricInstances)) {
      payload.metricInstances = createSystemMetricInstances()
    }

    if (Array.isArray(data.gridItems)) {
      data.gridItems = data.gridItems.map((item: any) => {
        if (item?.type !== 'metricCorrelation') return item
        const settings = item.settings ?? {}
        if (Array.isArray(settings.enabledMetricIds)) return item

        const rawLegacy: unknown = settings.enabledMetrics
        const legacy: string[] =
          Array.isArray(rawLegacy) && rawLegacy.length > 0
            ? rawLegacy.filter((s): s is string => typeof s === 'string')
            : // Empty legacy array meant "all" — keep that semantics by
              // selecting every system id.
              (payload.metricInstances ?? createSystemMetricInstances())
                .filter((i: any) => i?.system)
                .map((i: any) => i.baseId as string)

        const enabledMetricIds = legacy
          .map(baseId => findSystemInstanceIdByBaseId(baseId))
          .filter((id): id is number => id !== null)

        const { enabledMetrics: _drop, ...rest } = settings
        return {
          ...item,
          settings: { ...rest, enabledMetricIds },
        }
      })
    }

    data = { ...data, version: 6, data: payload }
    version = 6
  }

  // V6 to V7: Seed default windowed metric instances
  if (version === 6) {
    const payload = data.data
    const windowed = createDefaultWindowedInstances()
    const existing: any[] = Array.isArray(payload.metricInstances)
      ? payload.metricInstances
      : []
    const existingIds = new Set(existing.map((i: any) => i.id))
    for (const w of windowed) {
      if (!existingIds.has(w.id)) existing.push(w)
    }
    payload.metricInstances = existing
    data = { ...data, version: 7, data: payload }
    version = 7
  }

  // V7 to V8: Seed aoi-pair-matrix defaults + migrate transition-matrix settings.
  // Transforms moved from the plot (display + probabilityStep) onto the metrics
  // themselves. The plot now stores only `metricInstanceId`. Old aggregation
  // methods without a matching pre-curated default (e.g. 'frequencyRelative',
  // 'probability2') trigger on-demand creation of custom instances.
  if (version === 7) {
    const payload = data.data
    const pairs = createDefaultAoiPairInstances()
    const existing: any[] = Array.isArray(payload.metricInstances)
      ? payload.metricInstances
      : []
    const existingIds = new Set(existing.map((i: any) => i.id))
    for (const p of pairs) if (!existingIds.has(p.id)) existing.push(p)

    // Deterministic ID layout from createDefaultAoiPairInstances given current
    // registration order (transitionCount → Probability → DwellMean):
    //   50 = transitionCount         {mode: fixation}
    //   51 = transitionCount         {mode: visit}
    //   52 = transitionProbability   {mode: fixation, step: 1}
    //   53 = transitionDwellMean     {mode: fixation}
    //   54 = transitionDwellMean     {mode: visit}
    const SEEDED_COUNT_FIX = 50
    const SEEDED_PROB_FIX = 52
    const SEEDED_DWELL_FIX = 53
    const SEEDED_DWELL_VISIT = 54

    // Cache of on-demand custom instances so repeated grid items reusing the
    // same aggregationMethod share a single instance id.
    const customCache = new Map<string, number>()
    const nextId = () => {
      let max = 1000 - 1
      for (const i of existing) if (typeof i.id === 'number' && i.id > max) max = i.id
      return max + 1
    }
    function ensureCustom(baseId: string, params: Record<string, unknown>, label: string): number {
      const key = `${baseId}|${JSON.stringify(params)}`
      const cached = customCache.get(key)
      if (cached !== undefined) return cached
      const id = nextId()
      existing.push({ id, baseId, params, label })
      customCache.set(key, id)
      return id
    }

    function mapAggregationMethod(method: string): number {
      switch (method) {
        case 'sum':              return SEEDED_COUNT_FIX
        case 'probability':      return SEEDED_PROB_FIX
        case 'dwellTime':        return SEEDED_DWELL_FIX
        case 'segmentDwellTime': return SEEDED_DWELL_VISIT
        case 'frequencyRelative':
          return ensureCustom(
            'transitionRelativeFrequency',
            { mode: 'fixation' },
            'Transition relative frequency (fixation)',
          )
        case 'probability2':
          return ensureCustom(
            'transitionProbability',
            { mode: 'fixation', step: 2 },
            'Transition probability (fixation, 2-step)',
          )
        case 'probability3':
          return ensureCustom(
            'transitionProbability',
            { mode: 'fixation', step: 3 },
            'Transition probability (fixation, 3-step)',
          )
        default: return SEEDED_COUNT_FIX
      }
    }

    if (Array.isArray(data.gridItems)) {
      data.gridItems = data.gridItems.map((item: any) => {
        if (item?.type !== 'transitionMatrix') return item
        const s = item.settings ?? {}
        const metricInstanceId = mapAggregationMethod(s.aggregationMethod as string)
        const { aggregationMethod: _drop, display: _drop2, probabilityStep: _drop3, ...rest } = s
        return { ...item, settings: { ...rest, metricInstanceId } }
      })
    }

    payload.metricInstances = existing
    data = { ...data, version: 8, data: payload }
    version = 8
  }

  // V8 to V9: Migrate bar-plot settings from string `aggregationMethod` to
  // `metricInstanceId` referencing the shared metric library. The 8 historical
  // methods all map 1:1 to pre-curated system instances (ids 1–11).
  if (version === 8) {
    if (Array.isArray(data.gridItems)) {
      data.gridItems = data.gridItems.map((item: any) => {
        if (item?.type !== 'barPlot') return item
        const s = item.settings ?? {}
        const baseId =
          typeof s.aggregationMethod === 'string' ? s.aggregationMethod : 'absoluteTime'
        const metricInstanceId =
          findSystemInstanceIdByBaseId(baseId) ??
          findSystemInstanceIdByBaseId('absoluteTime')
        const { aggregationMethod: _drop, ...rest } = s
        return { ...item, settings: { ...rest, metricInstanceId } }
      })
    }
    data = { ...data, version: 9 }
    version = 9
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
      return normalized ? { ...item, type: normalized } : item
    })
  }

  return data
}

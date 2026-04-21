import { LEGACY_VISUALIZATION_TYPES } from '$lib/plots/registry'
import {
  createDefaultMetricInstances,
  defaultInstanceLabel,
  type MetricInstance,
} from '$lib/metrics/instances'

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
 * Sequentially upgrades raw JSON data to the current schema.
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

  // V4 to V5: consolidated migration for the 1.9.0 metrics refactor.
  //   1. Materialize `eventData` from legacy `aois.dynamicVisibility`.
  //   2. Seed `payload.metricInstances` with the slug-keyed starter library.
  //   3. Translate legacy plot settings to reference that library:
  //      - barPlot:          aggregationMethod (string) → metricInstanceId (slug)
  //      - transitionMatrix: aggregationMethod (string) → metricInstanceId
  //        (slug for the 4 starter-backed methods; new UUID-keyed custom
  //        instance for frequencyRelative / probability2 / probability3).
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
      hiddenChannels: Array.from({ length: stimuliCount }, () => []),
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
      const id = crypto.randomUUID()
      const projection = { kind: 'identity-aoi-pair-matrix' as const }
      metricInstances.push({
        id,
        baseId,
        params,
        projection,
        label: defaultInstanceLabel(baseId, params, projection),
      })
      customCache.set(key, id)
      return id
    }

    function mapTransitionAggregation(method: unknown): string {
      switch (method) {
        case 'sum':              return 'transitionCount-fix'
        case 'probability':      return 'transitionProbability-fix'
        case 'dwellTime':        return 'transitionDwellMean-fix'
        case 'segmentDwellTime': return 'transitionDwellMean-visit'
        case 'frequencyRelative':
          return ensureCustomMatrix('transitionRelativeFrequency', { mode: 'fixation' })
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

    data = { ...data, version: 5, data: payload }
    version = 5
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

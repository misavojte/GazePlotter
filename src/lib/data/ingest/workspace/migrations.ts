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
 * Sequentially upgrades raw JSON data to the modern Version 4 schema.
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
  }

  return data
}

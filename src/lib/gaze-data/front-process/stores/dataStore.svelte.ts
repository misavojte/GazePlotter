import {
  BinaryBufferReader,
  type DataType,
  type ExtendedInterpretedDataType,
} from '$lib/gaze-data/shared/types'

const MAX_AOI = 256

export class DataEngine {
  // --- Private Memory (Non-Reactive) ---
  // We keep binary data outside runes to prevent proxy overhead on 8GB buffers.
  private _binary: DataType['segments'] | null = null
  private _reader: BinaryBufferReader | null = null

  // --- Interpretation Cache (High Speed) ---
  // The only place where AOI grouping truth lives.
  private _aoiGroupMap = new Uint16Array(0)

  // --- Public Reactive State ---
  metadata = $state<Omit<DataType, 'segments'> | null>(null)

  hasValidData = $derived(
    !!this.metadata && this.metadata.stimuli.data.length > 0
  )

  // ==========================================
  // Core Engine Logic
  // ==========================================

  private refreshInterpretationMap() {
    if (!this.metadata) return
    const sCount = this.metadata.stimuli.data.length

    if (this._aoiGroupMap.length !== sCount * MAX_AOI) {
      this._aoiGroupMap = new Uint16Array(sCount * MAX_AOI)
    }
    this._aoiGroupMap.fill(0xffff)

    for (let sId = 0; sId < sCount; sId++) {
      const aois = this.metadata.aois.data[sId] || []
      const hidden = new Set(this.metadata.aois.hiddenAois?.[sId] ?? [])
      const nameToId = new Map<string, number>()
      const offset = sId * MAX_AOI

      // Rule: First visible AOI with a specific name becomes the Group Representative
      aois.forEach((row: string[], id: number) => {
        if (hidden.has(id)) return
        const name = (row[1] ?? row[0]).trim()
        if (name !== '' && !nameToId.has(name)) nameToId.set(name, id)
      })

      for (let id = 0; id < aois.length; id++) {
        const name = (
          this.metadata.aois.data[sId][id][1] ??
          this.metadata.aois.data[sId][id][0]
        ).trim()
        const mapped = nameToId.get(name)
        this._aoiGroupMap[offset + id] = mapped !== undefined ? mapped : id
      }
    }
  }

  // ==========================================
  // Atomic Mutators (Anti-Spike)
  // ==========================================

  loadDataset(fullData: DataType) {
    const { segments, ...meta } = fullData
    this._binary = segments
    this._reader = new BinaryBufferReader(segments)
    this.metadata = meta
    this.refreshInterpretationMap()
  }

  /**
   * Perfect Update: Shallow copies the metadata shell, deep copies ONLY
   * the branch being edited. Never touches or clones the binary buffers.
   */
  updateAois(stimulusId: number, updatedAois: ExtendedInterpretedDataType[]) {
    if (!this.metadata) return

    const nextAoiBranch = { ...this.metadata.aois }
    const nextData = [...nextAoiBranch.data]
    nextData[stimulusId] = updatedAois.map(a => [
      a.originalName,
      a.displayedName,
      a.color,
    ])

    const nextOrder = [...(nextAoiBranch.orderVector as number[][])]
    nextOrder[stimulusId] = updatedAois.map(a => a.id)

    // Atomic update triggers Svelte 5 reactivity
    this.metadata = {
      ...this.metadata,
      aois: { ...nextAoiBranch, data: nextData, orderVector: nextOrder },
    }

    this.refreshInterpretationMap() // Sync interpretation cache
  }

  // ==========================================
  // Hot-Path Accessors
  // ==========================================

  getAoiMapping(sId: number, rawId: number): number {
    const mapped = this._aoiGroupMap[sId * MAX_AOI + rawId]
    return mapped === 0xffff ? rawId : mapped
  }

  getReader() {
    return this._reader
  }
}

export const engine = new DataEngine()

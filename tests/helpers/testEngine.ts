/**
 * Shared engine-stub fixture for tests that drive metrics/plots/selectors
 * against a synthetic binary reader. ONE place owns the metadata SHAPE, so a
 * metadata-schema change (e.g. a segment-stride or field change) is an edit
 * here instead of in ~26 hand-rolled per-file stubs.
 *
 * Every option defaults to the most common fixture value; a test overrides
 * only what its pin is about. `aoiMapping: 'group'` wires a REAL
 * AoiGroupReader (displayed-name merge, structural/appearance versions) — the
 * default is the identity mapping most metric tests used.
 */
import { createReaderFromJson } from '../../src/lib/data/binary/converters'
import { AoiGroupReader } from '../../src/lib/data/binary/reader.aoiGroup'

export type TestEngineOptions = {
  /** aois.data rows per stimulus: [originalName, displayedName, color]; null = id gap. */
  aoiData?: (string[] | null)[][]
  aoiOrderVector?: number[][]
  /** Named AOI SELECTIONS (name-keyed, per-plot narrowing via aoiSelectionId). */
  aoiSelections?: { id: number; name: string; names: string[] }[]
  /** [originalName, displayedName] rows. Default: P0..Pn−1 derived from `segments`. */
  participants?: string[][]
  participantsOrderVector?: number[]
  /** [originalName, displayedName] rows. Default: S0..Sn−1, one per segments stimulus. */
  stimuli?: string[][]
  stimuliOrderVector?: number[]
  categories?: string[][]
  /** Named eye-movement-type SELECTIONS (id-keyed, per-plot narrowing via categorySelectionId). */
  categoriesSelections?: { id: number; name: string; memberIds: number[] }[]
  participantsSelections?: unknown[]
  metricInstances?: unknown[]
  isOrdinalOnly?: boolean
  capabilities?: { segmented: boolean; spatial: boolean; event: boolean }
  noAoiTreatment?: { displayedName: string; color: string }
  /** 'identity' (default): raw AOI id → itself; getAoiGroupReader() returns
   *  undefined — note consumers that REQUIRE a group reader then take their
   *  guarded path (e.g. scanpathEncoding returns '' instead of throwing).
   *  'group': real AoiGroupReader-backed mapping + getAoiGroupReader(). */
  aoiMapping?: 'identity' | 'group'
}

export type TestEngine = {
  metadata: {
    isOrdinalOnly: boolean
    capabilities: { segmented: boolean; spatial: boolean; event: boolean }
    aois: {
      data: (string[] | null)[][]
      orderVector: number[][]
      selections?: { id: number; name: string; names: string[] }[]
    }
    categories: { data: string[][]; orderVector: number[] }
    categoriesSelections: { id: number; name: string; memberIds: number[] }[]
    participants: { data: string[][]; orderVector: number[] }
    participantsSelections: unknown[]
    stimuli: { data: string[][]; orderVector: number[] }
    noAoiTreatment: { displayedName: string; color: string }
    metricInstances: unknown[]
  }
  getReader: () => ReturnType<typeof createReaderFromJson>
  getAoiMapping: (stimulusId: number, rawId: number) => number
  getAoiGroupReader: () => AoiGroupReader | undefined
}

/**
 * Build an engine stub over `segments[stimulusId][participantId][segIdx]`
 * rows of `[start, end, categoryId, ...rawAoiIds]` (category 0 = fixation).
 */
/**
 * Production-realistic single-stimulus engine (STIM = 1): builds the
 * `[null, ...rows]` convention (raw id i == data[1][i]) from `aoiNames` and
 * wires the REAL AoiGroupReader (full updateMap: sharedMap + groupPool
 * population — no identity short-circuit). Use for tests that suspect a bug
 * in the grouping or in the interaction with the real reader.
 *
 * `aoiNames` controls both AOI count and grouping: repeated names → followers
 * collapse to the first occurrence's rep id.
 */
export function makeGroupedAoiEngine(
  aoiNames: string[],
  segmentsForPid: number[][]
): TestEngine {
  const aoiData: (string[] | null)[] = [null]
  const order: number[] = []
  for (let i = 0; i < aoiNames.length; i++) {
    aoiData.push([aoiNames[i], aoiNames[i], '#000000'])
    order.push(i + 1)
  }
  return makeTestEngine([[], [segmentsForPid]], {
    aoiData: [[], aoiData],
    aoiOrderVector: [[], order],
    aoiMapping: 'group',
  })
}

export function makeTestEngine(
  segments: number[][][][],
  options: TestEngineOptions = {}
): TestEngine {
  const reader = createReaderFromJson(segments)

  const participantCount = Math.max(
    1,
    ...segments.map(stimulus => stimulus?.length ?? 0)
  )
  const stimulusCount = Math.max(2, segments.length)

  const metadata = {
    isOrdinalOnly: options.isOrdinalOnly ?? false,
    capabilities:
      options.capabilities ?? { segmented: true, spatial: false, event: false },
    aois: {
      data:
        options.aoiData ??
        ([[], [null, ['AOI 1', 'AOI 1', 'red'], ['AOI 2', 'AOI 2', 'blue']]] as (
          | string[]
          | null
        )[][]),
      orderVector: options.aoiOrderVector ?? [[], [1, 2]],
      ...(options.aoiSelections ? { selections: options.aoiSelections } : {}),
    },
    categories: {
      data: options.categories ?? [['Fixation', 'Fixation', '#000000']],
      orderVector: [] as number[],
    },
    categoriesSelections: options.categoriesSelections ?? [],
    participants: {
      data:
        options.participants ??
        Array.from({ length: participantCount }, (_, i) => [`P${i}`, `P${i}`]),
      orderVector: options.participantsOrderVector ?? [],
    },
    participantsSelections: options.participantsSelections ?? [],
    stimuli: {
      data:
        options.stimuli ??
        Array.from({ length: stimulusCount }, (_, i) => [`S${i}`, `S${i}`]),
      orderVector: options.stimuliOrderVector ?? [],
    },
    noAoiTreatment:
      options.noAoiTreatment ?? { displayedName: 'Outside', color: 'gray' },
    metricInstances: options.metricInstances ?? [],
  }

  if (options.aoiMapping === 'group') {
    const aoiGroupReader = new AoiGroupReader(reader)
    aoiGroupReader.updateMap(metadata as never)
    return {
      metadata,
      getReader: () => reader,
      getAoiGroupReader: () => aoiGroupReader,
      getAoiMapping: (stimulusId: number, rawId: number) =>
        aoiGroupReader.getAoiMapping(stimulusId, rawId),
    }
  }

  return {
    metadata,
    getReader: () => reader,
    getAoiGroupReader: () => undefined,
    getAoiMapping: (_stimulusId: number, rawId: number) => rawId,
  }
}

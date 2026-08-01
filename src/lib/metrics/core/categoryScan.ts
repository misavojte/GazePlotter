import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  SEGMENT_STRIDE,
  SegmentField,
  type BinaryBufferReader,
} from '$lib/data/binary'
import { getAllCategories } from '$lib/data/engine'
import { getRecipe } from './defineMetric'
import type { MetricRecipe } from './dsl'

/**
 * The iteration source a scan loop walks: `idx[k]` for `k ∈ [start, end)`
 * yields segment indices. Always a `Uint32Array` so the hot loops stay
 * monomorphic regardless of source.
 */
export interface ScanIndexRange {
  idx: Uint32Array
  start: number
  end: number
}

/**
 * Resolve a recipe's iteration source for one (stimulus, participant) scan.
 *
 * Default (`scanSource` unset): the reader's prebuilt fixation index — the
 * exact range/index pair the loops always used; zero extra work.
 *
 * `'categoryParam'`: walk the participant's full segment range once and keep
 * segments whose category's displayed name matches `params.eyeMovementType`.
 * Matching is by TRIMMED displayed name — the canonical grouping rule
 * (`groupByDisplayedName`), so the scanned set always equals the displayed
 * entity. Segment order — and therefore time order — is preserved, so
 * downstream early-break and window sweeps hold unchanged. Cold-ish path
 * (misses only; results land in the raw cache), so the upper-bound buffer's
 * scan-lifetime slack is fine.
 */
export function resolveScanIndex(
  recipe: MetricRecipe<any, any>,
  params: Record<string, unknown>,
  engine: DataEngine,
  reader: BinaryBufferReader,
  stimulusId: number,
  participantId: number,
): ScanIndexRange {
  if (recipe.scanSource !== 'categoryParam') {
    const { startIndex, endIndex } = reader.getFixationRange(stimulusId, participantId)
    return { idx: reader.fixationIndexRaw, start: startIndex, end: endIndex }
  }

  const name = String(params.eyeMovementType ?? '').trim()
  const ids = new Set<number>()
  for (const c of getAllCategories(engine)) {
    if (c.displayedName.trim() === name) ids.add(c.id)
  }

  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
  const segBuf = reader.segmentBufferRaw
  const idx = new Uint32Array(endIndex - startIndex)
  let n = 0
  for (let i = startIndex; i < endIndex; i++) {
    const cat = segBuf[i * SEGMENT_STRIDE + SegmentField.CATEGORY_ID] | 0
    if (ids.has(cat)) idx[n++] = i
  }
  return { idx, start: 0, end: n }
}

/**
 * Cache-key token for category-scanning recipes. Their results depend on the
 * category table (a MERGE fold or rename changes which raw ids a displayed
 * name resolves to) — state the reader-keyed cache bucket cannot see, unlike
 * AOI edits which ride the slot signatures. Empty for every other recipe, so
 * fixation-metric keys are byte-identical to before and category edits never
 * evict them.
 */
export function categoryCacheToken(engine: DataEngine, baseId: string): string {
  if (getRecipe(baseId)?.scanSource !== 'categoryParam') return ''
  // '\x1f' separators — displayed names are free text, so typable delimiters
  // could make two different tables collide (the slotSignatures convention).
  return `c${getAllCategories(engine)
    .map(c => `${c.id}\x1f${c.displayedName}`)
    .join('\x1f')}|`
}

import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { BinaryBufferReader } from '$lib/data/binary'
import { getAllCategories } from '$lib/data/engine'
import { getRecipe } from './defineMetric'
import type { MetricRecipe } from './dsl'
import type { ParamDef } from './params'

/**
 * The shared eye-movement-type param for `scanSource: 'categoryParam'` recipes.
 * The value is a category DISPLAYED name (same displayed name = same logical
 * entity), so a MERGE fold — two raw categories renamed to one displayed name —
 * widens the scanned set without touching stored instances. A name absent from
 * the dataset resolves to no segments (fixation-only sources cannot record
 * saccades or blinks); the metric then reports its natural empty value.
 */
export const eyeMovementTypeParam: ParamDef<string> & {
  id: 'eyeMovementType'
} = {
  id: 'eyeMovementType',
  label: 'Eye-movement type',
  type: 'enum',
  default: 'Saccade',
  description:
    'Which eye-movement type (segment category, by displayed name) the metric measures.',
  optionsFrom: engine => {
    const seen = new Set<string>()
    const out: { value: string; label: string }[] = []
    for (const c of getAllCategories(engine)) {
      if (seen.has(c.displayedName)) continue
      seen.add(c.displayedName)
      out.push({ value: c.displayedName, label: c.displayedName })
    }
    return out
  },
  // String(v): the stored value renders verbatim as the chip. Not `v => v` —
  // a crafted workspace can carry a non-string here, and paramToLabel calls
  // .trim() on the return; String keeps labels crash-proof and aligned with
  // compute (resolveParams String()-coerces the same value).
  toLabel: v => String(v),
}

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
 * segments whose category's displayed name matches `params.eyeMovementType`
 * (the manual-filter pattern proven in `fixations.ts`). Segment order — and
 * therefore time order — is preserved, so downstream early-break and window
 * sweeps hold unchanged.
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

  const name = String(params.eyeMovementType ?? '')
  const ids = new Set<number>()
  for (const c of getAllCategories(engine)) {
    if (c.displayedName === name) ids.add(c.id)
  }

  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
  // Count-then-fill, mirroring buildFixationIndex — exact-size, no growth churn.
  let n = 0
  for (let i = startIndex; i < endIndex; i++) {
    if (ids.has(reader.getSegmentCategory(i))) n++
  }
  const idx = new Uint32Array(n)
  let cursor = 0
  for (let i = startIndex; i < endIndex; i++) {
    if (ids.has(reader.getSegmentCategory(i))) idx[cursor++] = i
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

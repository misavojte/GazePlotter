import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import {
  SEGMENT_STRIDE,
  SegmentField,
  type BinaryBufferReader,
} from '$lib/data/binary'
import { getAllCategories } from '$lib/data/engine'
import {
  groupByDisplayedName,
  type GroupedByDisplayedName,
} from '$lib/data/engine/utils/grouping'
import type { ExtendedInterpretedDataType } from '$lib/data/types'
import { getRecipe } from './defineMetric'
import type { MetricRecipe } from './dsl'

/**
 * THE canonical eye-movement-type axis: one entry per displayed-name group of
 * the category table, in first-occurrence order (Fixation first — id 0's
 * reserved name keeps it a singleton leader). This single derivation is the
 * ORDER CONTRACT between category-vector recipes (their finalize vector is
 * indexed by it), the `pick-category` projection (resolves names against it),
 * and every consumer labeling per-type values (the comparison plot's bars).
 */
export function categoryGroups(
  engine: DataEngine
): GroupedByDisplayedName<ExtendedInterpretedDataType>[] {
  return groupByDisplayedName(getAllCategories(engine))
}

/** The axis's display names, in `categoryGroups` order. */
export function categoryGroupNames(engine: DataEngine): string[] {
  return categoryGroups(engine).map(g => g.displayedName)
}

/**
 * The iteration source a scan loop walks: `idx[k]` for `k ∈ [start, end)`
 * yields segment indices; when `catSlots` is non-null, `catSlots[k]` is that
 * segment's eye-movement-type slot on the canonical axis. Always typed arrays
 * so the hot loops stay monomorphic regardless of source.
 */
export interface ScanIndexRange {
  idx: Uint32Array
  start: number
  end: number
  /** Per-`k` type slots — non-null exactly for `scanSource: 'categories'`. */
  catSlots: Int16Array | null
  /** `categoryGroups(engine).length` for category scans, else 0. */
  categorySlotCount: number
}

/**
 * Resolve a recipe's iteration source for one (stimulus, participant) scan.
 *
 * Default (`scanSource` unset): the reader's prebuilt fixation index — the
 * exact range/index pair the loops always used; zero extra work, no type axis.
 *
 * `'categories'`: EVERY segment in the participant's range, each carrying its
 * type slot (raw category id → displayed-name group, the canonical axis).
 * Segment order — and therefore time order — is preserved, so downstream
 * early-break and window sweeps hold unchanged. Cold-ish path (misses only;
 * results land in the raw cache).
 */
export function resolveScanIndex(
  recipe: MetricRecipe<any, any>,
  engine: DataEngine,
  reader: BinaryBufferReader,
  stimulusId: number,
  participantId: number,
): ScanIndexRange {
  if (recipe.scanSource !== 'categories') {
    const { startIndex, endIndex } = reader.getFixationRange(stimulusId, participantId)
    return {
      idx: reader.fixationIndexRaw,
      start: startIndex,
      end: endIndex,
      catSlots: null,
      categorySlotCount: 0,
    }
  }

  const groups = categoryGroups(engine)
  // Raw category id → slot on the canonical axis.
  let maxId = 0
  for (const g of groups) for (const id of g.memberIds) if (id > maxId) maxId = id
  const slotOfId = new Int16Array(maxId + 1).fill(-1)
  for (let s = 0; s < groups.length; s++) {
    for (const id of groups[s].memberIds) slotOfId[id] = s
  }

  const { startIndex, endIndex } = reader.getSegmentRange(stimulusId, participantId)
  const segBuf = reader.segmentBufferRaw
  const count = endIndex - startIndex
  const idx = new Uint32Array(count)
  const catSlots = new Int16Array(count)
  for (let k = 0; k < count; k++) {
    const i = startIndex + k
    idx[k] = i
    const cat = segBuf[i * SEGMENT_STRIDE + SegmentField.CATEGORY_ID] | 0
    catSlots[k] = cat >= 0 && cat < slotOfId.length ? slotOfId[cat] : -1
  }
  return { idx, start: 0, end: count, catSlots, categorySlotCount: groups.length }
}

/**
 * Cache-key token for category-scanning recipes. Their results depend on the
 * category table (a MERGE fold or rename changes the type axis) — state the
 * reader-keyed cache bucket cannot see, unlike AOI edits which ride the slot
 * signatures. Empty for every other recipe, so fixation-metric keys are
 * byte-identical to before and category edits never evict them.
 */
export function categoryCacheToken(engine: DataEngine, baseId: string): string {
  if (getRecipe(baseId)?.scanSource !== 'categories') return ''
  // '\x1f' separators — displayed names are free text, so typable delimiters
  // could make two different tables collide (the slotSignatures convention).
  return `c${getAllCategories(engine)
    .map(c => `${c.id}\x1f${c.displayedName}`)
    .join('\x1f')}|`
}

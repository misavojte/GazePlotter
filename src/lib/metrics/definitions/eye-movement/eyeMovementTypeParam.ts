import { getAllCategories } from '$lib/data/engine'
import { groupByDisplayedName } from '$lib/data/engine/utils/grouping'
import { enumParam } from '../../core/params'

/**
 * The shared eye-movement-type param for `scanSource: 'categoryParam'`
 * recipes. The value is a category DISPLAYED name (same displayed name =
 * same logical entity), so a MERGE fold — two raw categories renamed to one
 * displayed name — widens the scanned set without touching stored instances.
 * A name absent from the dataset resolves to no segments (fixation-only
 * sources cannot record saccades or blinks); the metric then reports its
 * natural empty value. Options come from the canonical displayed-name
 * grouping, so the picker lists each logical entity once.
 */
export const eyeMovementTypeParam = enumParam<'eyeMovementType', string>(
  'eyeMovementType',
  'Eye-movement type',
  'Saccade',
  [],
  {
    description:
      'Which eye-movement type (segment category, by displayed name) the metric measures.',
    optionsFrom: engine =>
      groupByDisplayedName(getAllCategories(engine)).map(g => ({
        value: g.displayedName,
        label: g.displayedName,
      })),
    // String(v): the stored value renders verbatim as the chip. Not `v => v` —
    // a crafted workspace can carry a non-string here, and paramToLabel calls
    // .trim() on the return; String keeps labels crash-proof and aligned with
    // compute (resolveParams String()-coerces the same value).
    toLabel: v => String(v),
  }
)

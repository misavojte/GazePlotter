import { expect, test } from 'vitest'
import { getScarfParticipantBarHeight } from '$lib/plots/scarf/utils/transformations'
import { SCARF_LAYOUT } from '$lib/plots/scarf/utils/scarfServices'

test('participant bar height is independent of visibility rows', () => {
  const aoiCount = 5
  const without = getScarfParticipantBarHeight(aoiCount, false)
  const withVis = getScarfParticipantBarHeight(aoiCount, true)

  expect(without).toBe(withVis)
  expect(without).toBe(SCARF_LAYOUT.HEIGHT_OF_BAR + SCARF_LAYOUT.SPACE_ABOVE_RECT * 2)
})

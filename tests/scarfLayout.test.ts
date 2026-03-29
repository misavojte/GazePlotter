import { expect, test } from 'vitest'
import { getScarfParticipantBarHeight, SCARF_LAYOUT } from '$lib/plots/scarf'

test('participant bar height is independent of visibility rows', () => {
  const aoiCount = 5
  const without = getScarfParticipantBarHeight(aoiCount, false)
  const withVis = getScarfParticipantBarHeight(aoiCount, true)

  expect(without).toBe(withVis)
  expect(without).toBe(
    SCARF_LAYOUT.HEIGHT_BAR_DEFAULT + SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT * 2
  )
})

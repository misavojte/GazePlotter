import { expect, test } from 'vitest'
import { getScarfParticipantBarHeight, SCARF_LAYOUT } from '$lib/plots/scarf'

test('participant bar height equals bar + spacing', () => {
  const height = getScarfParticipantBarHeight()

  expect(height).toBe(
    SCARF_LAYOUT.HEIGHT_BAR_DEFAULT + SCARF_LAYOUT.SPACE_ABOVE_RECT_DEFAULT * 2
  )
})

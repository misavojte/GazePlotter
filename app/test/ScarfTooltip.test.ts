import { test, expect, describe } from 'vitest'
import { ScarfTooltipModel } from '../src/ts/Front/ScarfTooltip/ScarfTooltipModel'
import { ScarfTooltipController } from '../src/ts/Front/ScarfTooltip/ScarfTooltipController'
import { ScarfTooltipView } from '../src/ts/Front/ScarfTooltip/ScarfTooltipView'
import { demoData } from '../src/ts/Data/DemoData'

/**
 * @vitest-environment jsdom
 */

const model = new ScarfTooltipModel(demoData)
const controller = new ScarfTooltipController(model)
const view = new ScarfTooltipView(controller)

describe('ScarfTooltipView should update properly based on its model', () => {
  test('should update visibility', () => {
    model.show()
    expect(view.el.style.display).toBe('')
    model.hide()
    expect(view.el.style.display).toBe('none')
  })

  test('should update position', () => {
    model.move(10, 20)
    expect(view.el.style.left).toBe('10px')
    expect(view.el.style.top).toBe('20px')
  })
})

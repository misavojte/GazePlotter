export interface ScarfSettingsType {
  aoiVisibility: boolean
  ordinalTimeline: boolean
  /**
   * The width of the scarf chart axis in set units.
   * 0 = width is automatically calculated.
   */
  generalWidth: number
  /**
   * The width of the scarf chart axis in set units for each stimulus.
   * 0 = width is automatically calculated.
   * The index of the array corresponds to the stimulus id.
   * If the stimulus id is not in the array, the general width is used.
   */
  stimuliWidth: number[]
}

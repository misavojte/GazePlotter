/**
 * Object that is used for styling of each scarf plot segment type.
 * @property {string} name - Name of the segment type shown in the legend.
 * @property {string} identifier - Identifier of the segment type (used for connecting with the data).
 * @property {string} color - Color of the segment type.
 * @property {number} height - Height of the segment type.
 * @property {number} heighOfLegendItem - Height of the legend item.
 */

export interface SingleStylingScarfFillingType {
  name: string
  identifier: string
  color: string
  height: number
  heighOfLegendItem: number
}

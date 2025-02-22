/**
 * The object returned by the `deserialize` function and send to the EyeWriter
 * to save to the internal data structure.
 *
 * @property {string} start
 * @property {string} end
 * @property {string} stimulus
 * @property {string} participant
 * @property {string} category
 * @property {string[] | null} aoi
 * @property {[number, number] | undefined} coordinates
 */
export interface SingleDeserializerOutput {
  start: string
  end: string
  stimulus: string
  participant: string
  category: string
  aoi: string[] | null
  coordinates?: [number, number]
}

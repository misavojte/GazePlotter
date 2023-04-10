export type ReducerOutputType = ReducerSingleOutputType | null | ReducerSingleOutputType[]
export interface ReducerSingleOutputType {
  start: string
  end: string
  stimulus: string
  participant: string
  category: string
  aoi: string[] | null
}

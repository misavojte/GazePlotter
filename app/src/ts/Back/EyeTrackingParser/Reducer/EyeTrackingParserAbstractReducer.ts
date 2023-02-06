export abstract class EyeTrackingParserAbstractReducer {
  abstract reduce (row: string[]): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null } | null
  abstract finalize (): { start: string, end: string, stimulus: string, participant: string, category: string, aoi: string[] | null } | null
  getIndex (header: string[], name: string): number {
    const index = header.indexOf(name)
    if (index === -1) throw new Error(`Column ${name} not found in header`)
    return index
  }
}

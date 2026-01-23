export interface ParticipantBarMetrics {
  dwellTime: number[] // [aoi0, aoi1, ..., noAoi, anyFixation]
  ttff: number[] // [aoi0, aoi1, ..., noAoi, anyFixation] (-1 if not seen)
  fixationCount: number[] // [aoi0, aoi1, ..., noAoi, anyFixation]
  hitRatio: number[] // [aoi0, aoi1, ..., noAoi, anyFixation] (binary 0/1)
  entryCount: number[] // [aoi0, aoi1, ..., noAoi, anyFixation]
  dwellDurations: number[][] // [aoi0[], aoi1[], ..., noAoi[], anyFixation[]]
  firstFixationDuration: number[] // [aoi0, aoi1, ..., noAoi, anyFixation] (-1 if not seen)
  avgFixationDuration: number[][] // [aoi0[], aoi1[], ..., noAoi[], anyFixation[]]
}

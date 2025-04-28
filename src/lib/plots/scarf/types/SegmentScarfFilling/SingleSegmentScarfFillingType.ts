export interface SingleSegmentScarfFillingType {
  x: number // decimal 0-1 (instead of percentage string)
  width: number // decimal 0-1 (instead of percentage string)
  y: number
  height: number
  identifier: string
  orderId: number // Original segment order ID
}

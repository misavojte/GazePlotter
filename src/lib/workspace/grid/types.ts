export type GridConfig = {
  cellSize: { width: number; height: number }
  gap: number
  minWidth: number
  minHeight: number
}

export type GridItemPosition = {
  id: number
  x: number
  y: number
  w: number
  h: number
}

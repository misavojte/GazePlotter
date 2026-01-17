export type ExportFileType = '.png' | '.jpg'

export type CanvasExportSource = {
  kind: 'canvas'
  getCanvas: () => HTMLCanvasElement | null
}

export type ExportSource = CanvasExportSource

export type ExportSourceRegistrar = {
  register: (source: ExportSource | null) => void
}

export const EXPORT_SOURCE_CONTEXT = Symbol('gazeplotter.exportSource')

export function getMimeType(fileType: ExportFileType): string {
  return fileType === '.png' ? 'image/png' : 'image/jpeg'
}

export function getQuality(fileType: ExportFileType): number | undefined {
  return fileType === '.jpg' ? 0.95 : undefined
}

export async function canvasToBlobWithWhiteBackground(
  sourceCanvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  const tempCanvas = document.createElement('canvas')
  const ctx = tempCanvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  tempCanvas.width = sourceCanvas.width
  tempCanvas.height = sourceCanvas.height

  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
  ctx.drawImage(sourceCanvas, 0, 0)

  const blob = await new Promise<Blob | null>(resolve => {
    tempCanvas.toBlob(resolve, mimeType, quality)
  })

  if (!blob) throw new Error('Failed to create image blob')
  return blob
}

export function downloadBlob(blob: Blob, fileNameWithExtension: string) {
  const url = URL.createObjectURL(blob)

  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileNameWithExtension
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    URL.revokeObjectURL(url)
  }
}

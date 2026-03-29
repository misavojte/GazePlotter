import { triggerDownload } from '../download'

export type ExportFileType = '.png' | '.jpg'

export type CanvasExportSource = {
  kind: 'canvas'
  getCanvas: () => HTMLCanvasElement | null
}

export type ExportSource = CanvasExportSource

export type ExportSourceRegistrar = {
  register: (source: ExportSource | null) => void
}

/**
 * Registers a canvas export source when available and returns cleanup
 * that clears the registration.
 */
export function registerCanvasExportSource(
  registrar: ExportSourceRegistrar | undefined,
  getCanvas: () => HTMLCanvasElement | null
): (() => void) | void {
  if (!registrar) return
  if (!getCanvas()) return

  registrar.register({ kind: 'canvas', getCanvas })
  return () => {
    registrar.register(null)
  }
}

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

/**
 * Downloads a canvas as an image.
 */
export async function downloadCanvasAsImage(
  canvas: HTMLCanvasElement,
  fileName: string,
  fileType: ExportFileType
) {
  const mimeType = getMimeType(fileType)
  const quality = getQuality(fileType)
  const blob = await canvasToBlobWithWhiteBackground(canvas, mimeType, quality)
  triggerDownload(blob, fileName, fileType)
}

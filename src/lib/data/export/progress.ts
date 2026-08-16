/**
 * Export progress reporting. Exports run on the main thread, so emitting an
 * update is only half the job: without yielding to the event loop afterwards
 * the browser never paints it and the bar sits frozen until the whole export
 * finishes. The two belong together, so they are one call.
 */

/** Reports `position` of `total`, with the name of the work in flight. */
export type ExportProgress = (
  position: number,
  total: number,
  name: string
) => void | Promise<void>

/**
 * Yield one macrotask so pending UI state (busy flag, progress bar) paints.
 * A macrotask, not a microtask: `await` alone stays inside the same task and
 * paints nothing.
 */
export function yieldToPaint(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/** Report progress and let it paint. A no-op when the caller wants no reports. */
export async function reportProgress(
  onProgress: ExportProgress | undefined,
  position: number,
  total: number,
  name: string
): Promise<void> {
  if (!onProgress) return
  await onProgress(position, total, name)
  await yieldToPaint()
}

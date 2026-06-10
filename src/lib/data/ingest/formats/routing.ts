/**
 * Main-thread-safe routing helpers. The client needs ONE decision before
 * dispatching files to the worker: archive formats need fully-materialized
 * buffers (JSZip can't stream), everything else streams.
 *
 * Deliberately free of format/parser imports so the main bundle never
 * pulls in worker-side parsing code.
 */
export function isArchiveFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.zip')
}

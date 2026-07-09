import type JSZip from 'jszip'

/**
 * Orchestrates JSZip to create a downloadable ZIP blob from multiple internal files.
 */
export class Archiver {
  private files: Array<{ name: string; content: string | Blob }> = []

  addFile(fileName: string, content: string | Blob): void {
    this.files.push({ name: fileName, content })
  }

  async generateBlob(): Promise<Blob> {
    const JSZipLib = (await import('jszip')).default
    const zip = new JSZipLib()
    for (const file of this.files) {
      zip.file(file.name, file.content)
    }
    return await zip.generateAsync({ type: 'blob' })
  }
}

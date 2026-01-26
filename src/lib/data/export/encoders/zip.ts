import JSZip from 'jszip'

/**
 * Orchestrates JSZip to create a downloadable ZIP blob from multiple internal files.
 */
export class Archiver {
  private zip: JSZip

  constructor() {
    this.zip = new JSZip()
  }

  addFile(fileName: string, content: string | Blob): void {
    this.zip.file(fileName, content)
  }

  async generateBlob(): Promise<Blob> {
    return await this.zip.generateAsync({ type: 'blob' })
  }
}

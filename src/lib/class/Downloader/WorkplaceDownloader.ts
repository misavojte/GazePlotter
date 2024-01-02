import { AbstractDownloader } from './AbstractDownloader.ts'
import type { DataType } from '$lib/type/Data/DataType.ts'

export class WorkplaceDownloader extends AbstractDownloader {
  download (data: DataType, fileName: string): void {
    const json = JSON.stringify(data)
    const content = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    super.triggerDownload(content, fileName, '.json')
  }
}

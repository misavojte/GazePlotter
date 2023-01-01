import { AbstractDownloader } from './AbstractDownloader'

export class ScarfDownloader extends AbstractDownloader {
  download (fileName: string, fileType: string, width: string, el: HTMLElement): void {
    console.log('downloadScarf', fileName, fileType, width, el)
  }
}

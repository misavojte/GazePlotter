export abstract class AbstractDownloader {
  protected triggerDownload (content: string, fileName: string, fileType: '.jpg' | '.png' | '.svg' | '.webp' | '.json' | '.txt'): void {
    const link = document.createElement('a')
    link.download = fileName + fileType
    link.style.opacity = '0'
    document.body.append(link)
    link.href = content
    link.click()
    link.remove()
  }
}

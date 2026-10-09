import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { readBlobZip, readZipEntry, writeBlobZip } from '../src/lib/data/zip/blobZip'

const text = async (blob: Blob) => await blob.text()

describe('blobZip', () => {
  it('round-trips stored and deflated entries', async () => {
    const media = new Blob([new Uint8Array([0, 1, 2, 255])], { type: 'video/mp4' })
    const { blob, skipped } = await writeBlobZip([
      { name: 'workspace.json', content: '{"a":"čř"}'.repeat(50), compress: true },
      { name: 'media/0.mp4', content: media },
    ])
    expect(skipped).toEqual([])

    const entries = await readBlobZip(blob)
    expect([...entries.keys()]).toEqual(['workspace.json', 'media/0.mp4'])
    expect(await text(await readZipEntry(blob, entries.get('workspace.json')!))).toBe(
      '{"a":"čř"}'.repeat(50)
    )
    const back = await readZipEntry(blob, entries.get('media/0.mp4')!, 'video/mp4')
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(new Uint8Array([0, 1, 2, 255]))
    expect(back.type).toBe('video/mp4')
  })

  it('writes archives other ZIP readers open, with valid CRCs', async () => {
    const { blob } = await writeBlobZip([
      { name: 'workspace.json', content: '{"x":1}', compress: true },
      { name: 'media/3.png', content: new Blob([new Uint8Array([9, 8, 7])]) },
    ])
    const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true })
    expect(await zip.file('workspace.json')!.async('string')).toBe('{"x":1}')
    expect(await zip.file('media/3.png')!.async('uint8array')).toEqual(new Uint8Array([9, 8, 7]))
  })

  it('reads archives written by other ZIP writers, deflated or stored', async () => {
    const zip = new JSZip()
    zip.file('workspace.json', '{"y":2}', { compression: 'DEFLATE' })
    zip.file('media/1.jpg', new Uint8Array([4, 5, 6]))
    const blob = new Blob([await zip.generateAsync({ type: 'arraybuffer' })])

    const entries = await readBlobZip(blob)
    expect(await text(await readZipEntry(blob, entries.get('workspace.json')!))).toBe('{"y":2}')
    const media = await readZipEntry(blob, entries.get('media/1.jpg')!)
    expect(new Uint8Array(await media.arrayBuffer())).toEqual(new Uint8Array([4, 5, 6]))
  })

  it('rejects a file that is not a ZIP archive', async () => {
    await expect(readBlobZip(new Blob(['not a zip']))).rejects.toThrow('Not a ZIP archive')
  })
})

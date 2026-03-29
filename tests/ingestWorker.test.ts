import { afterEach, describe, expect, it, vi } from 'vitest'

describe('ingest worker ZIP handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.doUnmock('$lib/data/ingest/batch/PupilPipeline')
    vi.doUnmock('$lib/data/ingest/stream/Pipeline')
  })

  it('posts a fail message when ZIP processing finishes without final data', async () => {
    const addNewZip = vi.fn().mockResolvedValue(null)

    vi.doMock('$lib/data/ingest/batch/PupilPipeline', () => ({
      PupilCloudPipeline: class {
        constructor(_zipNames: string[]) {}

        addNewZip = addNewZip
      },
    }))

    vi.doMock('$lib/data/ingest/stream/Pipeline', () => ({
      EyePipeline: class {},
    }))

    const consoleLogSpy = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined)

    const selfMock = {
      postMessage: vi.fn(),
      onmessage: null as ((event: MessageEvent) => Promise<void>) | null,
    }
    vi.stubGlobal('self', selfMock)

    await import('$lib/data/ingest/worker')

    await selfMock.onmessage?.({
      data: {
        type: 'file-names',
        data: ['broken.zip'],
      },
    } as MessageEvent)

    await selfMock.onmessage?.({
      data: {
        type: 'zip-buffer',
        data: {
          buffer: new ArrayBuffer(8),
          zipName: 'broken.zip',
        },
      },
    } as MessageEvent)

    expect(addNewZip).toHaveBeenCalledTimes(1)
    expect(consoleLogSpy).not.toHaveBeenCalled()

    const failCall = selfMock.postMessage.mock.calls.find(
      ([message]) => message?.type === 'fail'
    )

    expect(failCall?.[0]).toEqual(
      expect.objectContaining({
        type: 'fail',
        data: expect.objectContaining({
          message:
            'Pupil Cloud ZIP processing completed without producing final data for: broken.zip',
        }),
      })
    )
  })
})

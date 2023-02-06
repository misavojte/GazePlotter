import { test, expect, describe } from 'vitest'
import { StartButtonsService } from '../src/ts/Front/StartButtons/StartButtonsService'

/**
 * @vitest-environment jsdom
 */

describe('StartButtonsService - preprocess EyeTrackingFile and determine its type', () => {
  const service = new StartButtonsService()
  const tobiiFile = new File(['Recording timestamp\n...'], 'tobii.csv')
  const begazeFile = new File(['Event Start Trial Time [ms]\tEvent End Trial Time [ms]\n...'], 'smi.csv')
  const randomFile = new File(['...'], 'random.txt')
  test('Type determination from file slice', async () => {
    expect(service.getTypeFromSlice(await service.getSlice(tobiiFile))).toBe('tobii')
    expect(service.getTypeFromSlice(await service.getSlice(begazeFile))).toBe('begaze')
  })
  test('Mixed type error from file array', async () => {
    expect(() => service.getTypeFromArray(['tobii', 'begaze'])).toThrowError('Mixed file types')
  })
  test('Type determination from file array', () => {
    expect(service.getTypeFromArray(['tobii', 'tobii'])).toBe('tobii')
  })
  test('Settings determination from file list', async () => {
    const fileListMock = [tobiiFile, tobiiFile, randomFile] as unknown as FileList
    const { workerSettings, files } = await service.preprocessEyeTrackingFiles(fileListMock)
    expect(workerSettings.type).toBe('tobii')
    expect(workerSettings.rowDelimiter).toBe('\r\n')
    expect(workerSettings.columnDelimiter).toBe('\t')
    expect(files.length).toBe(2) // randomFile is filtered out
  })
  test('Mixed type error from file list', async () => {
    const fileListError = [tobiiFile, begazeFile] as unknown as FileList
    await expect(async () => await service.preprocessEyeTrackingFiles(fileListError)).rejects.toThrowError('Mixed file types')
  })
  test('Unknown type from file list', async () => {
    const fileList = [randomFile, randomFile] as unknown as FileList
    const { workerSettings, files } = await service.preprocessEyeTrackingFiles(fileList)
    expect(workerSettings.type).toBe('unknown')
    expect(files.length).toBe(0)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorService } from '$lib/errors'

describe('ErrorService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stores recent errors as a bounded buffer', () => {
    const toastState = {
      addError: vi.fn(),
    }
    const service = new ErrorService(toastState)

    for (let index = 0; index < 25; index++) {
      service.report({
        origin: 'workspace',
        severity: 'recoverable',
        userMessage: `Recoverable error ${index}`,
        cause: new Error(`Debug ${index}`),
        context: { index },
      })
    }

    expect(service.recent).toHaveLength(20)
    expect(service.recent[0]?.userMessage).toBe('Recoverable error 5')
    expect(service.recent.at(-1)?.userMessage).toBe('Recoverable error 24')
    expect(toastState.addError).toHaveBeenCalledTimes(25)
  })

  it('persists only fatal load errors as fatal session state', () => {
    const toastState = {
      addError: vi.fn(),
    }
    const service = new ErrorService(toastState)

    service.report({
      origin: 'workspace',
      severity: 'recoverable',
      userMessage: 'Workspace failed',
      cause: new Error('recoverable'),
    })

    expect(service.fatalLoad).toBeNull()

    const fatal = service.report({
      origin: 'ingest',
      severity: 'fatal-load',
      userMessage: 'Could not load dataset',
      cause: new Error('broken file'),
      context: { fileName: 'broken.csv' },
    })

    expect(service.fatalLoad).toEqual(fatal)
    expect(service.recent.at(-1)).toEqual(fatal)

    service.clearFatalLoad()

    expect(service.fatalLoad).toBeNull()
  })
})

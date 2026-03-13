import { generateUniqueId } from '$lib/shared/utils/idUtils'
import type { ToastState } from '$lib/toaster/toastState.svelte'

const MAX_RECENT_ERRORS = 20

export type ErrorOrigin =
  | 'workspace'
  | 'ingest'
  | 'export'
  | 'bootstrap'
  | 'modal'
  | 'plot'
export type ErrorSeverity = 'recoverable' | 'fatal-load'

export type ErrorInput = {
  origin: ErrorOrigin
  severity: ErrorSeverity
  userMessage: string
  cause: unknown
  context?: Record<string, unknown>
}

export type ErrorRecord = {
  id: number
  createdAt: string
  origin: ErrorOrigin
  severity: ErrorSeverity
  userMessage: string
  debugMessage: string
  stack?: string
  context?: Record<string, unknown>
}

function getDebugMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message
  }

  if (typeof cause === 'string' && cause.trim().length > 0) {
    return cause
  }

  if (
    typeof cause === 'object' &&
    cause !== null &&
    'message' in cause &&
    typeof cause.message === 'string' &&
    cause.message.trim().length > 0
  ) {
    return cause.message
  }

  try {
    const serialized = JSON.stringify(cause)
    if (serialized && serialized !== '{}') return serialized
  } catch {
    // Fall back to the supplied message when the value is not serializable.
  }

  return fallback
}

function getStack(cause: unknown): string | undefined {
  if (cause instanceof Error && typeof cause.stack === 'string') {
    return cause.stack
  }

  if (
    typeof cause === 'object' &&
    cause !== null &&
    'stack' in cause &&
    typeof cause.stack === 'string'
  ) {
    return cause.stack
  }

  return undefined
}

export class ErrorService {
  fatalLoad = $state<ErrorRecord | null>(null)
  recent = $state<ErrorRecord[]>([])

  constructor(
    private readonly toastState: Pick<ToastState, 'addError'>
  ) {}

  report(input: ErrorInput): ErrorRecord {
    const fallback = 'Unexpected error'
    const record: ErrorRecord = {
      id: generateUniqueId(),
      createdAt: new Date().toISOString(),
      origin: input.origin,
      severity: input.severity,
      userMessage: input.userMessage,
      debugMessage: getDebugMessage(input.cause, fallback),
      stack: getStack(input.cause),
      context: input.context,
    }

    this.recent = [...this.recent.slice(-(MAX_RECENT_ERRORS - 1)), record]

    console.groupCollapsed(
      `[${record.origin}] ${record.severity}: ${record.userMessage}`
    )
    console.error('Debug message:', record.debugMessage)
    if (record.context) {
      console.error('Context:', record.context)
    }
    console.error('Cause:', input.cause)
    if (record.stack) {
      console.error('Stack:', record.stack)
    }
    console.groupEnd()

    this.toastState.addError(record.userMessage)

    if (record.severity === 'fatal-load') {
      this.fatalLoad = record
    }

    return record
  }

  clearFatalLoad(): void {
    this.fatalLoad = null
  }
}

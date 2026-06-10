import { tobiiParsingInputModal } from '$lib/modals/definitions'

/**
 * Main-thread registry of ingest prompts. When a format calls
 * `IngestContext.prompt(promptId)` in the worker, the client looks the id
 * up here, opens the modal, and replies with the user's value — or with
 * `cancelValue` (plus an info toast) when the user dismisses the modal.
 *
 * Adding a prompt for a new format: register the modal here under the
 * `promptId` the format declares. The worker protocol never changes.
 */
export interface IngestPromptSpec {
  /** Modal definition opened via `ModalState.open(modal, {})`. */
  modal: typeof tobiiParsingInputModal
  /** Value sent to the worker when the user cancels the modal. */
  cancelValue: string
  /** Info toast shown on cancel (omit for silent fallback). */
  cancelToast?: string
}

export const INGEST_PROMPTS: Record<string, IngestPromptSpec> = {
  'tobii-parsing-input': {
    modal: tobiiParsingInputModal,
    cancelValue: '',
    cancelToast:
      'User input was not provided. The file will be processed as Tobii without events',
  },
}

import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'
import type { StimulusMediaUpdate } from '$lib/workspace/commands'

/** Per-stimulus reference media detail: preview, remove, and the gaze-space
 *  coordinate mapping. Pushed ON TOP of the Stimuli modal (stacked), which
 *  holds the returned update until its own Apply. */
export const stimulusMediaModal = defineModal<typeof Modal, StimulusMediaUpdate>({
  component: Modal,
  title: 'Reference Media',
})

import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

/** Per-stimulus reference media detail: preview, remove, and the gaze-space
 *  coordinate mapping. Pushed ON TOP of the Stimuli modal (stacked). */
export const stimulusMediaModal = defineModal<typeof Modal>({
  component: Modal,
  title: 'Reference Media',
})

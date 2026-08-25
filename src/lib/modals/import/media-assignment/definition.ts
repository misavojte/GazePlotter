import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

/** One decision per uploaded media file that no stimulus name matched. */
export type MediaAssignment = {
  stimulusId: number
  skip: boolean // true = don't attach this file
}

export const mediaAssignmentModal = defineModal<
  typeof Modal,
  MediaAssignment[]
>({
  component: Modal,
  title: 'Assign Reference Media',
})

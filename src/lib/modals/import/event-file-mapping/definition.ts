import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export type EventFileMapping = {
  stimulusId: number
  participantId: number | null
}

export const eventFileMappingModal = defineModal<
  typeof Modal,
  EventFileMapping[]
>({
  component: Modal,
  title: 'Map Event Files',
})

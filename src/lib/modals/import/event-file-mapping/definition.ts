import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export type EventFileMapping = {
  stimulusId: number
  participantId: number | null // null = apply to all
  skip: boolean // true = ignore this file
}

export const eventFileMappingModal = defineModal<
  typeof Modal,
  EventFileMapping[]
>({
  component: Modal,
  title: 'Map Event Files',
})

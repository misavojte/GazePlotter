import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const downloadBarPlotModal = defineModal({
  component: Modal,
  title: 'Download Bar Plot',
})

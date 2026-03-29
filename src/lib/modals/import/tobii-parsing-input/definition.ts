import Modal from './Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const tobiiParsingInputModal =
  defineModal<typeof Modal, string>({
    component: Modal,
    title: 'Tobii Parsing Input',
  })

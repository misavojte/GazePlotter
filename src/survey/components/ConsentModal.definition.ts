import ConsentModal from './ConsentModal.svelte'
import { defineModal } from '$lib/modals/defineModal'

export const consentModal = defineModal<typeof ConsentModal, true>({
  component: ConsentModal,
  title: 'UX Evaluation Instructions & Consent',
})

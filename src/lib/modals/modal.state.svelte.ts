import type { ComponentType } from 'svelte'

type Modal = {
  component: ComponentType
  title: string
  props?: Record<string, any>
}

class ModalState {
  activeModal = $state<Modal | null>(null)

  open(component: ComponentType, title: string, props?: Record<string, any>) {
    this.activeModal = { component, title, props }
  }

  close() {
    this.activeModal = null
  }
}

export const modalState = new ModalState()

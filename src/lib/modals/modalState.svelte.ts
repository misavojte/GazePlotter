import type { Component } from 'svelte'
import type { ModalDefinition, ModalProps, ModalResult } from './defineModal'

type AnyModalDefinition = ModalDefinition<Component<any>, unknown>

export type ModalStackEntry = {
  id: number
  definition: AnyModalDefinition
  props: Record<string, unknown>
  resolve: (value: unknown | null) => void
}

export class ModalState {
  stack = $state<ModalStackEntry[]>([])
  activeModal = $derived(this.stack.at(-1) ?? null)
  private nextEntryId = 0

  open<TDefinition extends ModalDefinition<Component<any>, any>>(
    definition: TDefinition,
    props: ModalProps<TDefinition>
  ): Promise<ModalResult<TDefinition> | null> {
    return new Promise<ModalResult<TDefinition> | null>(resolve => {
      const previousStack = [...this.stack]
      const nextEntry = this.createEntry(definition, props, value =>
        resolve(value as ModalResult<TDefinition> | null)
      )

      this.stack = [nextEntry]

      for (const entry of previousStack) {
        entry.resolve(null)
      }
    })
  }

  push<TDefinition extends ModalDefinition<Component<any>, any>>(
    definition: TDefinition,
    props: ModalProps<TDefinition>
  ): Promise<ModalResult<TDefinition> | null> {
    return new Promise<ModalResult<TDefinition> | null>(resolve => {
      const nextEntry = this.createEntry(definition, props, value =>
        resolve(value as ModalResult<TDefinition> | null)
      )

      this.stack = [...this.stack, nextEntry]
    })
  }

  finish<TResult>(value: TResult): void {
    const activeModal = this.activeModal
    if (!activeModal) return

    this.stack = this.stack.slice(0, -1)
    activeModal.resolve(value)
  }

  close(): void {
    const activeModal = this.activeModal
    if (!activeModal) return

    this.stack = this.stack.slice(0, -1)
    activeModal.resolve(null)
  }

  closeToRoot(): void {
    if (this.stack.length <= 1) return
    const popped = this.stack.slice(1)
    this.stack = [this.stack[0]]
    for (const entry of popped) {
      entry.resolve(null)
    }
  }

  private createEntry<TDefinition extends ModalDefinition<Component<any>, any>>(
    definition: TDefinition,
    props: ModalProps<TDefinition>,
    resolve: (value: unknown | null) => void
  ): ModalStackEntry {
    return {
      id: ++this.nextEntryId,
      definition: definition as AnyModalDefinition,
      props: props as Record<string, unknown>,
      resolve,
    }
  }
}

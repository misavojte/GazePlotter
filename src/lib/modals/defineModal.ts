import type { Component, ComponentProps } from 'svelte'

export type ModalDefinition<TComponent extends Component<any>, TResult = void> = {
  component: TComponent
  title: string
}

type ModalComponentFromDefinition<
  TDefinition extends ModalDefinition<Component<any>, any>,
> = TDefinition extends ModalDefinition<infer TComponent, any>
  ? TComponent
  : never

export type ModalProps<TDefinition extends ModalDefinition<Component<any>, any>> =
  ComponentProps<ModalComponentFromDefinition<TDefinition>>

export type ModalResult<
  TDefinition extends ModalDefinition<Component<any>, any>,
> = TDefinition extends ModalDefinition<Component<any>, infer TResult>
  ? TResult
  : never

export function defineModal<
  TComponent extends Component<any>,
  TResult = void,
>(definition: ModalDefinition<TComponent, TResult>) {
  return definition
}

<script lang="ts">
  import Button from '$lib/shared/components/Button.svelte'
  import { getGazePlotterSession } from '$lib/session'

  interface ModalButton {
    label: string
    onclick: () => void
    isDisabled?: boolean
    variant?: 'primary' | 'secondary'
  }

  interface Props {
    /** Omitted: the standard Apply + Cancel pair. */
    buttons?: ModalButton[]
    onApply?: () => void
    applyLabel?: string
    applyDisabled?: boolean
  }

  let { buttons, onApply = () => {}, applyLabel = 'Apply', applyDisabled = false }: Props = $props()
  const { modalState } = getGazePlotterSession()
  const shown = $derived<ModalButton[]>(
    buttons ?? [
      { label: applyLabel, onclick: onApply, variant: 'primary', isDisabled: applyDisabled },
      { label: 'Cancel', onclick: () => modalState.close() },
    ]
  )
</script>

<div class="modal-buttons">
  {#each shown as button}
    <Button
      onclick={button.onclick}
      isDisabled={button.isDisabled ?? false}
      variant={button.variant ?? 'secondary'}
    >
      {button.label}
    </Button>
  {/each}
</div>

<style>
  .modal-buttons {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-top: 32px;
  }
</style>

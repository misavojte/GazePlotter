<script lang="ts">
  import Button from '$lib/shared/components/Button.svelte'

  interface ModalButton {
    label: string
    onclick: () => void
    isDisabled?: boolean
    variant?: 'primary' | 'secondary'
  }

  interface Props {
    buttons: ModalButton[]
  }

  let { buttons }: Props = $props()
</script>

<div class="modal-buttons">
  {#each buttons as button}
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
    gap: 0.25rem;
    align-items: center;
    margin-top: 2rem;
  }
</style>

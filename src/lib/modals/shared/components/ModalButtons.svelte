<script lang="ts">
  import GeneralButtonMajor from '$lib/shared/components/GeneralButtonMajor.svelte'

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
    <GeneralButtonMajor
      onclick={button.onclick}
      isDisabled={button.isDisabled ?? false}
      variant={button.variant ?? 'secondary'}
    >
      {button.label}
    </GeneralButtonMajor>
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

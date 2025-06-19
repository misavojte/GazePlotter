<script lang="ts">
  import GeneralRadio from '$lib/shared/components/GeneralRadio.svelte'
  import { ModalButtons } from '$lib/modals'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import { onDestroy } from 'svelte'
  interface Props {
    valuePromiseResolve: (value: string) => void
    valuePromiseReject: (reason?: any) => void
  }

  let { valuePromiseResolve, valuePromiseReject }: Props = $props()
  let value: string = $state('')

  onDestroy(() => {
    valuePromiseReject(new Error('Modal closed without value'))
  })

  const handleSubmit = () => {
    console.log('value', value)
    valuePromiseResolve(value)
  }

  const handleCancel = () => {
    valuePromiseReject(new Error('User cancelled'))
    modalStore.close()
  }
</script>

<div class="content">
  <p>
    GazePlotter detected Tobii Pro Lab data with the Event column. How should
    the stimulus be determined?
  </p>
  <GeneralRadio
    options={[
      { value: '', label: 'Media record column' },
      {
        value: 'IntervalStart;IntervalEnd',
        label: `Event's '%NAME% IntervalStart' and '%NAME% IntervalEnd'`,
      },
      {
        value: '_start;_end',
        label: `Event's '%NAME%_start' and '%NAME%_end'`,
      },
    ]}
    legend="Stimulus will be determined by"
    bind:userSelected={value}
  />
</div>
<ModalButtons
  buttons={[
    {
      label: 'Apply',
      onclick: handleSubmit,
      variant: 'primary',
    },
    {
      label: 'Cancel',
      onclick: handleCancel,
    },
  ]}
/>

<style>
  .content {
    margin-bottom: 2rem;
  }
</style>

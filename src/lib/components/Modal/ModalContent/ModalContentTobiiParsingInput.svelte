<script lang="ts">
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { onDestroy } from 'svelte'
  export let valuePromiseResolve: (value: string) => void
  export let valuePromiseReject: (reason?: any) => void
  let value: string

  onDestroy(() => {
    valuePromiseReject(new Error('Modal closed without value'))
  })
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
<GeneralButtonMajor on:click={() => valuePromiseResolve(value)}>
  Apply
</GeneralButtonMajor>

<style>
  .content {
    margin-bottom: 2rem;
  }
</style>

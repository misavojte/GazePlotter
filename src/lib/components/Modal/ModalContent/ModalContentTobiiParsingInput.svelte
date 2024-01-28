<script lang="ts">
  import GeneralRadio from '$lib/components/General/GeneralRadio/GeneralRadio.svelte'
  import GeneralButtonMajor from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  export let valuePromiseResolve: (value: string) => void
  export let valuePromiseReject: (reason?: any) => void
  let value: string

  onDestroy(() => {
    valuePromiseReject(new Error('Modal closed without value'))
  })
</script>

<p>Tobii Pro Lab data with Event column detected. How to parse stimuli?</p>
<GeneralRadio
  options={[
    { value: '', label: 'Default by stimulus name' },
    {
      value: 'IntervalStart;IntervalEnd',
      label: `By event's '%NAME% IntervalStart' and '%NAME% IntervalEnd'`,
    },
    {
      value: '_start;_end',
      label: `By event's '%NAME%_start' and '%NAME%_end'`,
    },
  ]}
  legend="Stimuli parsing"
  bind:userSelected={value}
/>
<GeneralButtonMajor on:click={() => valuePromiseResolve(value)}>
  Apply
</GeneralButtonMajor>

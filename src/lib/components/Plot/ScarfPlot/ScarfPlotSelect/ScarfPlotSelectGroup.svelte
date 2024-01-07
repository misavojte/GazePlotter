<script lang="ts">
  import Select from '$lib/components/General/GeneralSelect/GeneralSelect.svelte'

  export let scarfId: number

  let value = 'all'

  const groupOptions = [{ value: 'all', label: 'All participants' }]

  $: console.log(value, scarfId)
</script>

<Select label="Group" options={groupOptions} bind:value compact={true}></Select>

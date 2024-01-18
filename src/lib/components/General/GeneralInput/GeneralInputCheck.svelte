<script lang="ts">
  export let label: string
  export let checked: boolean = false
</script>

<label>
  <input type="checkbox" bind:checked on:change />
  {label}
</label>

<style>
  label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  input[type='checkbox'] {
    margin-right: 0.5em;
    accent-color: var(--c-brand);
    cursor: pointer;
  }
</style>

<script lang="ts">
  interface Props {
    label: string
    checked?: boolean
    onchange?: (event: CustomEvent) => void
  }

  let { label, checked = false, onchange = () => {} }: Props = $props()

  // Use state instead of bindable
  let isChecked = $state(checked)

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement
    isChecked = target.checked
    onchange(new CustomEvent('change', { detail: isChecked }))
  }
</script>

<label>
  <input type="checkbox" checked={isChecked} onchange={handleChange} />
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

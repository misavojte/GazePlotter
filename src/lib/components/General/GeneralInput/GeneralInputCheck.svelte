<script lang="ts">
  interface Props {
    label: string
    checked?: boolean
    onchange?: (event: CustomEvent) => void
  }

  let {
    label,
    checked = $bindable(false),
    onchange = () => {},
  }: Props = $props()

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement
    onchange(new CustomEvent('change', { detail: target.checked }))
  }
</script>

<label>
  <input type="checkbox" {checked} onchange={handleChange} />
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

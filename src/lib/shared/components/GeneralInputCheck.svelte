<script lang="ts">
  interface Props {
    label: string
    sublabel?: string
    checked?: boolean
    onchange?: (event: CustomEvent) => void
  }

  let {
    label,
    sublabel,
    checked = $bindable(false),
    onchange = () => {},
  }: Props = $props()

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement
    checked = target.checked // Update the bound value
    onchange(new CustomEvent('change', { detail: target.checked }))
  }
</script>

<label>
  <input type="checkbox" {checked} onchange={handleChange} />
  <div class="label-content">
    <span class="main-label">{label}</span>
    {#if sublabel}
      <span class="sub-label">{sublabel}</span>
    {/if}
  </div>
</label>

<style>
  label {
    display: flex;
    align-items: flex-start;
    cursor: pointer;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  input[type='checkbox'] {
    margin-top: 0.05rem;
    accent-color: var(--c-brand);
    cursor: pointer;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  }

  .label-content {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
  }

  .main-label {
    font-weight: 500;
    color: var(--c-black);
    line-height: 1.4;
  }

  .sub-label {
    font-size: 0.8rem;
    color: var(--c-darkgrey);
    line-height: 1.3;
    margin-top: 0.1rem;
  }
</style>

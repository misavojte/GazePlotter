<script lang="ts">
  import ChevronDown from 'lucide-svelte/icons/chevron-down'

  export let options: Array<{ value: string; label: string }>
  export let label: string
  export let value: string = options[0].value
  export let compact: boolean = false
  const name = label.toLowerCase().replace(/ /g, '-')
  const handleChange = (e: Event) => {
    const target = e.target as HTMLSelectElement
    value = target.value
  }
</script>

<div class="select-wrapper" class:compact>
  <label for={name}>{label}</label>
  <div class="option-wrapper">
    <select {name} id="GP-{name}" on:change={handleChange}>
      {#each options as option}
        <option value={option.value} selected={option.value === value}
          >{option.label}</option
        >
      {/each}
    </select>
    <div class="svg-wrap">
      <ChevronDown strokeWidth={1} />
    </div>
  </div>
</div>

<style>
  .select-wrapper {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 170px;
    margin-bottom: 15px;
  }
  .select-wrapper.compact {
    width: 140px;
    margin-bottom: 0;
  }
  .compact label {
    font-size: 8px;
    position: absolute;
    font-weight: 500;
    line-height: 1rem;
    letter-spacing: 0.0333333333em;
    text-transform: uppercase;
    color: rgba(0, 0, 0, 0.6);
    background: var(--c-darkgrey);
    padding-inline: 4px;
    left: 10px;
    top: -0.9em;
    z-index: 2;
  }
  .option-wrapper {
    display: flex;
    align-items: center;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.23);
    position: relative;
    height: 34px;
    overflow: hidden;
    box-sizing: border-box;
  }
  select {
    font-weight: 400;
    line-height: 1.5rem;
    letter-spacing: 0.00938em;
    color: rgba(0, 0, 0, 0.87);
    border: none;
    transition: border-color 0.2s ease-in-out;
    font-size: 14px;
    width: 100%;
    height: 100%;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    cursor: pointer;
    padding: 0.25em;
    padding-inline: 0.5em 22px;
  }
  .compact select {
    background-color: var(--c-darkgrey);
    padding-inline: 14px 22px;
  }
  .svg-wrap {
    position: absolute;
    right: 3px;
    top: 0;
    height: 100%;
    width: 15px;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(0, 0, 0, 0.54);
  }

  select:focus {
    outline: none;
    border-color: #1976d2;
  }
  select:disabled {
    background-color: rgba(0, 0, 0, 0.12);
    color: rgba(0, 0, 0, 0.38);
    cursor: not-allowed;
  }
</style>

<script lang="ts">
  import ChevronDown from "lucide-svelte/icons/chevron-down";

  export let options: Array<{ value: string; label: string }>;
  export let label: string;
  export let value: string = "";
  const name = label.toLowerCase().replace(/ /g, "-");
  const handleChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    value = target.value;
  };
</script>

<div class="wrap">
  <label for={name}>{label}</label>
  <div class="select-wrap">
    <select {name} id={name} on:change={handleChange}>
      {#each options as option}
        <option value={option.value} selected={option.value === value}
          >{option.label}</option
        >
      {/each}
    </select>
    <ChevronDown />
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    margin-bottom: 10px;
    gap: 5px;
  }
  select {
    font-weight: 400;
    color: rgba(0, 0, 0, 0.87);
    border: none;
    background: none;
    transition: border-color 0.2s ease-in-out;
    font-size: 14px;
    width: 170px;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    cursor: pointer;
    padding: 0.5rem 1.5rem 0.5rem 0.5rem;
    margin: 0;
  }

  .select-wrap {
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.23);
    position: relative;
    width: 170px;
    display: flex;
    align-items: center;
  }
  select:focus {
    outline: none;
    border-color: var(--c-brand);
  }
  select:disabled {
    background-color: rgba(0, 0, 0, 0.12);
    color: rgba(0, 0, 0, 0.38);
    cursor: not-allowed;
  }
</style>

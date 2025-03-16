<script lang="ts">
  interface Props {
    options: { value: string; label: string }[];
    legend: string;
    userSelected?: string;
  }

  let { options, legend, userSelected = $bindable(options[0].value) }: Props = $props();

  const uniqueID: number = Math.floor(Math.random() * 100)

  const slugify = (str = ''): string =>
    str.toLowerCase().replace(/ /g, '-').replace(/\./g, '')
</script>

<div
  role="radiogroup"
  class="group-container"
  aria-labelledby={`label-${uniqueID}`}
  id={`group-${uniqueID}`}
>
  <div class="legend" id={`label-${uniqueID}`}>{legend}</div>
  {#each options as { value, label }}
    <input
      class="sr-only"
      type="radio"
      id="{slugify(label)}-{uniqueID}"
      bind:group={userSelected}
      {value}
    />
    <label for="{slugify(label)}-{uniqueID}"> {label} </label>
  {/each}
</div>

<style>
  .group-container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }

  label {
    user-select: none;
  }

  .sr-only {
    position: absolute;
    clip: rect(1px, 1px, 1px, 1px);
    padding: 0;
    border: 0;
    height: 1px;
    width: 1px;
    overflow: hidden;
  }

  input[type='radio'] {
    position: absolute;
  }

  input[type='radio'] + label {
    display: block;
    position: relative;
    text-align: left;
  }

  input[type='radio'] + label::before {
    content: '';
    position: relative;
    display: inline-block;
    margin-right: 0.5em;
    width: 1em;
    height: 1em;
    background: transparent;
    border: 1px solid var(--c-darkgrey, #ccc);
    border-radius: 50%;
    top: 0.2em;
  }

  input[type='radio']:checked + label::before {
    border: 1px solid var(--c-darkgrey, #ccc);
    border-radius: 50%;
  }

  input[type='radio'] + label::after {
    content: '';
    position: absolute;
    display: inline-block;
    width: 0.5em;
    height: 0.5em;
    top: 0.45em;
    left: 0.25em;
    background: var(--c-brand, #282828);
    border: 1px solid var(--c-brand, #282828);
    border-radius: 50%;
    transform: scale(0);
  }

  input[type='radio']:checked + label::after {
    opacity: 1;
    transform: scale(1);
  }

  input[type='radio']:disabled + label {
    color: var(--c-grey, #ccc);
  }

  input[type='radio']:disabled + label::before {
    background: var(--c-grey, #ccc);
  }

  input[type='radio'] + label::after {
    transition: transform 0.1s ease-out;
  }

  input[type='radio']:checked + label::after {
    transition: transform 0.1s ease-in;
  }

  label {
    cursor: pointer;
  }
</style>

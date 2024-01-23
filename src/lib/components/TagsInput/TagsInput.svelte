<svelte:options accessors={true} />

<script lang="ts">
  import X from 'lucide-svelte/icons/x'
  import { writable } from 'svelte/store'

  export let value: string[] = [] // tag list
  export let suggestions: string[] = [] // a list of tag suggestion
  let input = '' // input value

  const selectedTag = writable<number | undefined>(undefined)
  const validSuggestions = writable<string[]>(suggestions)

  let inputNode: HTMLInputElement

  const isValidInput = (input: string) => {
    if (
      // only valid if input is unique (not already in value)
      !value.includes(input) &&
      // and if it is one of the suggested values
      $validSuggestions.includes(input)
    )
      return true
  }

  const arrowRightHandler = () => {
    if ($selectedTag === undefined) return
    if ($selectedTag + 1 === value.length) {
      inputNode.focus()
      selectedTag.set(undefined)
    }
    selectedTag.set($selectedTag + 1)
  }
  const arrowLeftHandler = () => {
    if ($selectedTag === 0) return
    if (!$selectedTag) {
      selectedTag.set(value.length - 1)
      return
    }
    selectedTag.set($selectedTag - 1)
  }

  // pressed checks keyboard event for comma or Enter key.
  // If found, adds 'value' in the tag list.
  const pressed = (ev: KeyboardEvent) => {
    // Check if conditions are met to do something.
    // If not, exit as early as possible.
    console.log('pressed', ev.key)
    if (
      ev.key !== ',' &&
      ev.key !== 'Enter' &&
      ev.key !== 'Backspace' &&
      !ev.key.match(/Arrow(Left|Right)/)
    )
      return

    if (ev.key === 'ArrowLeft') {
      arrowLeftHandler()
    }
    if (ev.key === 'ArrowRight') {
      arrowRightHandler()
    }

    if (ev.key == 'Backspace') {
      ev.preventDefault()
      handleBackspace()
      return
    }

    // Clean the remaining comma in input.
    input = input.replace(',', '')

    // If nothing left, we do nothing and exit.
    if (input === '') return

    // If we are here, we can add the tag to our list...
    // ... and clean the input for the next one.
    if (!isValidInput(input)) {
      console.log('invalid!')
      return
    }
    value = [...value, input]
    $validSuggestions = $validSuggestions.filter(d => d !== input)
    input = ''
  }

  const handleBackspace = () => {
    //TODO: Do not delete text if there's still text in the input
    console.log(input.length)
    if (input.length > 0) {
      return
    }
    const idx = Number.isInteger($selectedTag) ? $selectedTag : value.length - 1
    console.log({ value, idx, length: value.length })
    if (idx !== undefined) deleteTag(idx)
  }

  const handleClick = (tagIdx: number) => {
    deleteTag(tagIdx)
  }

  const deleteTag = (tagIdx: number) => {
    const new_suggestion = value[tagIdx]
    if (new_suggestion)
      $validSuggestions = [...$validSuggestions, new_suggestion]
    value = [...value.filter((_, idx) => tagIdx !== idx)]
  }
</script>

<div>
  <div class="wrapper">
    {#if value.length > 0}
      <div class="tag-list">
        {#each value as t, i}
          <div class="tag">
            <span>{t}</span>
            <button
              class:selected={i === $selectedTag}
              on:click={() => handleClick(i)}><X size="1em" /></button
            >
          </div>
        {/each}
      </div>
    {/if}
    <input
      list="tag_suggestion"
      placeholder="Enter tag…"
      type="text"
      pattern={$validSuggestions.filter(d => !value.includes(d)).join('|')}
      bind:this={inputNode}
      on:keyup={pressed}
      bind:value={input}
    />
  </div>
  <datalist id="tag_suggestion">
    {#each $validSuggestions as s}
      <option>{s}</option>
    {/each}
  </datalist>
</div>

<style>
  .wrapper {
    display: flex;
    gap: 0.5em;
    border: 1px solid;
    border-radius: var(--rounded);
    padding: 0.25em;
    &:has(input:focus, button:focus) {
      outline: auto;
      outline-width: thin;
    }
    &:has(input:invalid) {
      box-shadow: 0 0 5px var(--c-error);
      outline: solid medium var(--c-error);
    }
  }
  input {
    width: 100%;
    border: none;
    &:focus {
      outline: none;
    }
  }
  .tag-list {
    display: flex;
    gap: 0.5em;
  }
  .tag {
    display: flex;
    align-items: stretch;
    background-color: var(--c-lightgrey);
    border-radius: var(--rounded);
    & span {
      padding: 0.15rem 0.25rem;
    }
    & button {
      cursor: pointer;
      display: flex;
      align-items: center;
      border: none;
      border-radius: 0 3px 3px 0;
      padding: 0 0.25em;
      &:hover,
      &.selected {
        background-color: lightgrey;
      }
    }
  }
</style>

<script lang="ts">
  import MinorButton from './GeneralButtonMinor.svelte'
  import { onMount, onDestroy, type ComponentType } from 'svelte'
  import MoreVertical from 'lucide-svelte/icons/more-vertical'

  interface ActionItem {
    icon: ComponentType
    label: string
    action: () => void
  }

  export let isOpen = false
  export let items: ActionItem[]
  const handleClick = () => {
    isOpen = !isOpen
  }

  let window: Window | null

  let menuElement: HTMLDivElement

  const handleOutsideClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (!menuElement.contains(target)) {
      isOpen = false
    }
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      isOpen = false
    }
  }

  onMount(() => {
    window = document.defaultView
    window?.addEventListener('click', handleOutsideClick)
    window?.addEventListener('keydown', handleKeydown)
  })

  onDestroy(() => {
    if (!window) return
    window.removeEventListener('click', handleOutsideClick)
    window.removeEventListener('keydown', handleKeydown)
  })
</script>

<div class="wrap" bind:this={menuElement}>
  <MinorButton on:click={handleClick}>
    <MoreVertical size={'1em'} />
  </MinorButton>
  {#if isOpen}
    <ul class="menu">
      {#each items as item}
        <li>
          <button on:pointerdown|stopPropagation on:click={item.action}>
            <svelte:component this={item.icon} size={'1em'} />
            {item.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    display: flex;
  }
  .menu {
    position: absolute;
    right: 0;
    background: var(--c-white);
    border: 1px solid #ccc;
    border-radius: var(--rounded);
    box-shadow: 0 0 10px var(--c-grey);
    overflow: hidden;
    z-index: 1000;
  }
  .menu,
  li {
    list-style: none;
    min-width: 220px;
    margin: 0;
    padding: 0;
  }
  .menu button {
    background: none;
    border: none;
    padding: 7px 14px;
    font-size: 14px;
    color: #333;
    cursor: pointer;
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.5em;
  }
  .menu button:hover {
    background: #f5f5f5;
  }
</style>

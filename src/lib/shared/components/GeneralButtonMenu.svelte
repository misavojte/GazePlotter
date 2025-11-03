<script lang="ts">
  import MinorButton from './GeneralButtonMinor.svelte'
  import { type ComponentType } from 'svelte'
  import { tooltipAction } from '$lib/tooltip/components/Tooltip.svelte'
  import { fade, fly } from 'svelte/transition'

  interface ActionItem {
    icon: ComponentType
    label: string
    action: () => void
  }

  interface Props {
    items: ActionItem[]
  }

  let { items }: Props = $props()

  // Use state instead of bindable
  let isOpen = $state(false)

  const handleClick = () => {
    isOpen = !isOpen
  }

  let menuElement: HTMLDivElement | null = $state(null)

  const handleOutsideClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (menuElement && !menuElement.contains(target)) {
      isOpen = false
    }
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      isOpen = false
    }
  }
</script>

<svelte:window onclick={handleOutsideClick} onkeydown={handleKeydown} />

<div class="wrap" bind:this={menuElement} use:tooltipAction={{ content: "Plot & data options", position: "top", offset: 35, verticalAlign: "end", disabled: isOpen}}>
  <MinorButton isIcon={false} onclick={handleClick}>
    <span class="triggerContent">
      <svg class="dots" width="8" height="14" viewBox="0 0 4 12" fill="currentColor" aria-hidden="true">
        <circle cx="2" cy="2" r="0.8" />
        <circle cx="2" cy="6" r="0.8" />
        <circle cx="2" cy="10" r="0.8" />
      </svg>
      <span class="triggerLabel">More</span>
    </span>
  </MinorButton>
  {#if isOpen}
    <ul class="menu" transition:fly={{ y: -20, duration: 300 }}>
      {#each items as item}
        <li>
          <button onclick={() => { item.action(); isOpen = false; }}>
            <item.icon size={'1em'} />
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
  
  .triggerContent {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  
  .triggerLabel {
    color: currentColor;
    font-size: 13px;
    line-height: 1;
    margin-top: 1px;
  }
  
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    background: var(--c-white);
    border: 1px solid var(--c-grey);
    border-radius: var(--rounded);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    z-index: 1000;
    min-width: 220px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  
  .menu li {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  
  .menu button {
    background: none;
    border: none;
    padding: 10px 14px;
    font-size: 14px;
    color: var(--c-black);
    cursor: pointer;
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.5em;
    transition: all 0.2s ease;
    position: relative;
  }
  
  .menu button:hover {
    background: var(--c-lightgrey);
    color: var(--c-brand);
    padding-left: 16px;
  }
  
  .menu button :global(svg) {
    transition: transform 0.2s ease;
  }
</style>

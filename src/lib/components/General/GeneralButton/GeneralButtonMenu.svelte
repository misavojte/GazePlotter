<script lang="ts">
  import MinorButton from './GeneralButtonMinor.svelte'
  import { type ComponentType } from 'svelte'
  import MoreVertical from 'lucide-svelte/icons/more-vertical'

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

<div class="wrap" bind:this={menuElement}>
  <MinorButton onclick={handleClick}>
    <MoreVertical size={'1em'} />
  </MinorButton>
  {#if isOpen}
    <ul class="menu">
      {#each items as item}
        <li>
          <button onclick={item.action}>
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

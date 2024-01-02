<script lang="ts">
  import MinorButton from './GeneralButtonMinor.svelte'
  import { onMount, onDestroy } from 'svelte'

  interface ActionItem {
    label: string;
    action: () => void;
  }

  export let isOpen = false
  export let items: ActionItem[]
  const handleClick = () => {
    isOpen = !isOpen
  }

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
    window.addEventListener('click', handleOutsideClick)
    window.addEventListener('keydown', handleKeydown)
  })

  onDestroy(() => {
    window.removeEventListener('click', handleOutsideClick)
    window.removeEventListener('keydown', handleKeydown)
  })
</script>

<div class="wrap" bind:this={menuElement}>
    <MinorButton on:click={handleClick}>
        <span class:isOpen={isOpen}>
            <span></span>
            <span></span>
            <span></span>
        </span>
    </MinorButton>
    {#if isOpen}
        <ul class="menu">
            {#each items as item}
                <li>
                    <button on:click={item.action}>{item.label}</button>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .wrap {
        position: relative;
    }
    .menu {
        position: absolute;
        top: calc(100% + 5px);
        right: 0;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 0 10px rgba(0,0,0,.2);
        overflow: hidden;
    }
    .menu, li {
        list-style: none;
        width: 150px;
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
    }
    .menu button:hover {
        background: #f5f5f5;
    }
    span {
        display: inline-block;
        justify-content: center;
        align-items: center;
    }
    span > span {
        display: block;
        width: 3px;
        height: 3px;
        background-color: currentColor;
        border-radius: 50%;
        margin: 2px;
    }
</style>

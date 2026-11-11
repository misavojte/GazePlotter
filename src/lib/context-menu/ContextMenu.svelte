<script lang="ts">
  import { useContextMenu } from './contextMenuState.svelte'
  import { MENU_MAX_HEIGHT, MENU_WIDTH, SEARCH_HEIGHT } from './const'
  import { portal } from '$lib/shared/placement'
  import { scale } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import MenuList from './MenuList.svelte'
  import { filterMenuItems } from './search'
  import Search from 'lucide-svelte/icons/search'

  const contextMenuState = useContextMenu()

  const onClose = () => contextMenuState.reset()

  let container: HTMLUListElement | null = $state(null)
  let menuElement: HTMLDivElement | null = $state(null)
  let searchInput: HTMLInputElement | null = $state(null)

  // The search box's text, cleared whenever a different menu opens.
  let query = $state('')
  let queryOwner: symbol | null = null
  $effect(() => {
    const owner = contextMenuState.current?.ownerId ?? null
    if (owner !== queryOwner) query = ''
    queryOwner = owner
  })
  const shownItems = $derived.by(() => {
    const menu = contextMenuState.current
    if (!menu?.items) return []
    return menu.search ? filterMenuItems(menu.items, query) : menu.items
  })

  // Focus the search box once the menu is up, except on touch screens,
  // where focus would raise the keyboard over the list.
  const focusSearch = (node: HTMLInputElement) => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    requestAnimationFrame(() => node.focus({ preventScroll: true }))
  }

  // Enter in the search box adds the first match.
  const onSearchKeydown = (ev: KeyboardEvent) => {
    if (ev.key !== 'Enter') return
    ev.preventDefault()
    menuButtons()[0]?.click()
  }

  // What had focus when the menu opened: Escape from inside hands focus back.
  let opener: HTMLElement | null = null
  $effect(() => {
    if (!contextMenuState.current) opener = null
    else opener ??= document.activeElement as HTMLElement | null
  })

  // Escape, arrows and type-ahead. Enter/Space need no handling: menu
  // items are native buttons, which activate on those keys by themselves.
  const onKeydown = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      const back = menuElement?.contains(document.activeElement) ? opener : null
      onClose()
      if (back?.isConnected) back.focus({ preventScroll: true })
    }
    if (ev.key === 'ArrowDown' && container) {
      ev.preventDefault()
      focusNext(1)
    }
    if (ev.key === 'ArrowUp' && container) {
      ev.preventDefault()
      focusNext(-1)
    }
    const target = ev.target as HTMLElement | null
    const inField = !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable === true)
    const printable = ev.key.length === 1 && ev.key !== ' ' && !inField
    if (printable && container && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      // With a search box, typing goes there (the key lands in the box).
      if (searchInput) searchInput.focus()
      else focusTyped(ev.key)
    }
  }

  // Type-ahead: keys typed within TYPE_AHEAD_MS of each other spell one
  // prefix ("P4"), and the first item it starts goes into focus.
  const TYPE_AHEAD_MS = 600
  let typed = ''
  let typedAt = 0

  const focusTyped = (key: string) => {
    const now = Date.now()
    typed = (now - typedAt < TYPE_AHEAD_MS ? typed : '') + key.toLowerCase()
    typedAt = now
    const buttons = menuButtons()
    const idx = buttons.findIndex(b => b === document.activeElement)
    // A fresh letter moves past the current item; a longer prefix may stay.
    const from = typed.length === 1 ? idx + 1 : Math.max(idx, 0)
    const ordered = [...buttons.slice(from), ...buttons.slice(0, from)]
    ordered
      .find(b => b.textContent?.trim().toLowerCase().startsWith(typed))
      ?.focus()
  }

  const menuButtons = (): HTMLButtonElement[] =>
    container
      ? (Array.from(
          container.querySelectorAll('button[role="menuitem"]:not(:disabled)')
        ) as HTMLButtonElement[])
      : []

  const focusNext = (delta: number) => {
    if (!container) return
    const buttons = menuButtons()
    if (buttons.length === 0) return
    const idx = buttons.findIndex(
      b => b === (document.activeElement as HTMLButtonElement)
    )
    const next =
      ((idx >= 0 ? idx : -1) + delta + buttons.length) % buttons.length
    buttons[next].focus()
  }

  $effect(() => {
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })
</script>

<!-- Stable Portal Host: Never unmounts, stays as a child of document.body -->
<div class="gp-context-menu-portal-root" use:portal>
  {#if contextMenuState.current}
    {@const menu = contextMenuState.current}
    <!-- Transition Unit: Contains main menu AND submenus, fades as one unit -->
    <div class="context-menu-transition-unit">
      <div
        class="menu"
        role="menu"
        bind:this={menuElement}
        style={`left:${menu.x}px; top:${menu.y}px; z-index:${menu.zIndex}; --menu-width: ${menu.width ?? MENU_WIDTH}px;`}
        in:scale={{ duration: 150, start: 0.96, easing: cubicOut }}
      >
        {#if menu.search}
          <div class="search">
            <Search size={14} strokeWidth={1.75} aria-hidden="true" />
            <input
              type="text"
              bind:value={query}
              bind:this={searchInput}
              placeholder={menu.search}
              aria-label={menu.search}
              autocomplete="off"
              spellcheck="false"
              use:focusSearch
              onkeydown={onSearchKeydown}
            />
          </div>
        {/if}
        <div
          class="menu-content scroll-slim"
          onscroll={e => e.stopPropagation()}
          style={`max-height:min(${menu.maxHeight ?? MENU_MAX_HEIGHT}px, calc(100dvh - ${menu.y + (menu.search ? SEARCH_HEIGHT : 0) + 16}px));`}
        >
          {#if shownItems.length}
            <MenuList
              items={shownItems}
              parentZIndex={menu.zIndex}
              selectionMode={menu.selectionMode}
              bind:list={container}
            />
          {:else if menu.search && query}
            <p class="no-match">Nothing matches "{query}"</p>
          {:else if menu.content}
            <div class="custom">{menu.content}</div>
          {/if}
        </div>
      </div>

      <!-- Submenus portal into this container, sharing the parent's fade -->
      <div id="gp-context-menu-portal-host"></div>
    </div>
  {/if}
</div>

<style>
  .gp-context-menu-portal-root {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 9999;
    pointer-events: none;
  }

  .context-menu-transition-unit {
    pointer-events: none;
  }

  .menu {
    position: fixed;
    pointer-events: auto;
    background: var(--c-white);
    border: 1px solid color-mix(in srgb, var(--c-black) 8%, transparent);
    border-radius: 12px;
    --menu-width: 220px;
    width: var(--menu-width);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
  }

  .menu-content {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
  }

  .custom {
    padding: 8px 12px;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 40px;
    border-bottom: 1px solid var(--c-border);
    color: var(--c-darkgrey);
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font: inherit;
    font-size: var(--text-md);
    color: var(--c-black);
  }

  .search input::placeholder {
    color: var(--c-darkgrey);
  }

  .no-match {
    margin: 0;
    padding: 12px 16px;
    font-size: var(--text-md);
    color: var(--c-darkgrey);
  }
</style>

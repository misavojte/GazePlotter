<script lang="ts">
  import { page } from '$app/state'
  import { onMount } from 'svelte'
  import { buildDocBreadcrumbs, isMatchingDocPath } from './navigation'
  import { slide } from 'svelte/transition'
  let { data, children } = $props()
  let sidebarOpen = $state(false)

  let manualToggles = $state<Record<string, boolean>>({})

  // Find the active section title based on the current pathname
  let activeSectionTitle = $derived.by(() => {
    for (const item of data.sections) {
      if ('links' in item) {
        if (item.links.some(link => isMatchingDocPath(link.href, page.url.pathname))) {
          return item.title
        }
      }
    }
    return null
  })

  // Expand the active section automatically, collapse others when activeSectionTitle changes
  $effect(() => {
    if (activeSectionTitle) {
      manualToggles[activeSectionTitle] = true
      for (const item of data.sections) {
        if ('title' in item && item.title !== activeSectionTitle) {
          manualToggles[item.title] = false
        }
      }
    }
  })

  function isSectionExpanded(title: string) {
    if (manualToggles[title] !== undefined) {
      return manualToggles[title]
    }
    return title === activeSectionTitle
  }

  function toggleSection(title: string) {
    manualToggles[title] = !isSectionExpanded(title)
  }

  onMount(() => {
    if (window.innerWidth <= 1024) return
    const container = document.querySelector('.sidebar-main')
    const active = document.querySelector(
      '.nav-link.active'
    ) as HTMLElement | null
    if (container && active) {
      const top = active.offsetTop - container.clientHeight / 2
      container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
  })

  let breadcrumbs = $derived.by(() => {
    return buildDocBreadcrumbs(page.url.pathname, data.sections)
  })

  let jsonLd = $derived(
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.name,
        item: `https://gazeplotter.com${crumb.href}`,
      })),
    })
  )
</script>

<svelte:head>
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<!-- Mobile docs bar -->
<div class="mobile-docs-bar">
  <button
    class="mobile-menu-btn"
    onclick={() => (sidebarOpen = !sidebarOpen)}
    aria-label="Toggle navigation"
  >
    {#if sidebarOpen}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><line x1="18" y1="6" x2="6" y2="18" /><line
          x1="6"
          y1="6"
          x2="18"
          y2="18"
        /></svg
      >
    {:else}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><line x1="3" y1="12" x2="21" y2="12" /><line
          x1="3"
          y1="6"
          x2="21"
          y2="6"
        /><line x1="3" y1="18" x2="21" y2="18" /></svg
      >
    {/if}
  </button>
  <span class="mobile-docs-label">Documentation Chapters</span>
</div>

<div class="docs-container">
  <!-- Backdrop lives inside .docs-container so it shares the sidebar's
       stacking context. Placed as a sibling of .docs-sidebar (z-index 100)
       below it (z-index 200), so taps on the menu reach the menu and only
       taps on the dimmed area close it. -->
  {#if sidebarOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="sidebar-backdrop"
      onclick={() => (sidebarOpen = false)}
      onkeydown={() => {}}
    ></div>
  {/if}

  <!-- Sidebar -->
  <aside class="docs-sidebar" class:open={sidebarOpen}>
    <!-- Layer 1: Persistent Background & Border -->
    <div class="sidebar-bg"></div>

    <!-- Content Layer with Offset -->
    <!-- This sticks at top: -64px. It has a 64px spacer. 
         As the page scrolls 64px, this layer moves up 64px and then sticks.
         This makes the content fill the header gap seamlessly. -->
    <div class="sidebar-content-wrapper">
      <div class="sidebar-spacer"></div>
      <div class="sidebar-main">
        <nav class="docs-nav">
          {#each data.sections as item}
            <div class="nav-section">
              {#if 'links' in item}
                <button
                  type="button"
                  class="nav-section-trigger"
                  onclick={() => toggleSection(item.title)}
                  aria-expanded={isSectionExpanded(item.title)}
                >
                  <span class="nav-title">{item.title}</span>
                  <svg
                    class="chevron-icon"
                    class:rotated={isSectionExpanded(item.title)}
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                {#if isSectionExpanded(item.title)}
                  <ul class="nav-links" transition:slide={{ duration: 200 }}>
                    {#each item.links as link}
                      <li>
                        <a
                          href={link.href}
                          class="nav-link"
                          class:active={isMatchingDocPath(link.href, page.url.pathname)}
                          onclick={() => (sidebarOpen = false)}
                        >
                          {link.name}
                        </a>
                      </li>
                    {/each}
                  </ul>
                {/if}
              {:else}
                <a
                  href={item.href}
                  class="nav-section-link"
                  class:active={isMatchingDocPath(item.href, page.url.pathname)}
                  onclick={() => (sidebarOpen = false)}
                >
                  <span class="nav-title">{item.name}</span>
                </a>
              {/if}
            </div>
          {/each}
        </nav>
      </div>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="docs-content">
    <div class="prose-wrapper">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          {#each breadcrumbs as crumb, i}
            <li>
              {#if i < breadcrumbs.length - 1}
                <a href={crumb.href}>{crumb.name}</a>
                <span class="breadcrumb-sep">/</span>
              {:else}
                <span class="breadcrumb-current">{crumb.name}</span>
              {/if}
            </li>
          {/each}
        </ol>
      </nav>
      {@render children()}
    </div>
  </main>
</div>

<style>
  .docs-container {
    display: flex;
    flex: 1;
    background-color: #f8fafc;
    min-height: calc(100vh - 64px);
    z-index: 10;
  }

  /* Sidebar Base */
  .docs-sidebar {
    width: 280px;
    position: sticky;
    top: 0;
    min-height: calc(100vh + 64px);
    display: flex;
    flex-direction: column;
    z-index: 20;
    flex-shrink: 0;
    margin-top: -64px; /* Pull into header space */
  }

  /* Background */
  .sidebar-bg {
    position: absolute;
    inset: 0;
    background-color: #ffffff;
    border-right: 1px solid #e2e8f0;
    z-index: -1;
  }

  /* Content Layer */
  .sidebar-content-wrapper {
    position: sticky;
    top: -64px; /* Sticks after moving up 64px */
    height: calc(100vh + 64px);
    display: flex;
    flex-direction: column;
    z-index: 5;
  }

  .sidebar-spacer {
    height: 64px;
    flex-shrink: 0;
  }

  .sidebar-main {
    flex: 1;
    padding: 1rem;
    padding-bottom: 96px; /* 1.5 header heights of space */
    overflow-y: auto;
    /* Hide scrollbar but keep functionality for a cleaner look */
    scrollbar-width: thin;
    scrollbar-color: #e2e8f0 transparent;
  }

  .docs-nav {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .nav-section-trigger,
  .nav-section-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.5rem 0.75rem;
    margin: 0;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    text-decoration: none;
    border-radius: 6px;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .nav-section-trigger:hover,
  .nav-section-link:hover {
    background-color: #f1f5f9;
  }

  .nav-section-link.active {
    background-color: #fce7e8;
  }

  .nav-section-link.active .nav-title {
    color: var(--c-brand, #cd1404);
  }

  .nav-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #475569;
  }

  .chevron-icon {
    color: #94a3b8;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .chevron-icon.rotated {
    transform: rotate(90deg);
  }

  .nav-links {
    list-style: none;
    padding: 0;
    margin: 0.25rem 0 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nav-link {
    display: block;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #64748b;
    text-decoration: none;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .nav-link:hover {
    color: var(--c-brand, #cd1404);
    background-color: #fff1f2;
  }

  .nav-link.active {
    color: var(--c-brand, #cd1404);
    background-color: #fce7e8;
    font-weight: 600;
  }

  /* Breadcrumbs */
  .breadcrumbs {
    margin-bottom: -1.25rem;
  }

  .breadcrumbs ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    list-style: none;
    padding: 0;
    margin: 0;
    gap: 0;
  }

  .breadcrumbs li {
    display: flex;
    align-items: center;
    font-size: 0.8125rem;
    line-height: 1;
  }

  .breadcrumbs a {
    color: #94a3b8;
    text-decoration: none;
  }

  .breadcrumbs a:hover {
    color: #64748b;
  }

  .breadcrumb-sep {
    margin: 0 0.5rem;
    color: #cbd5e1;
    font-size: 0.75rem;
  }

  .breadcrumb-current {
    color: #94a3b8;
  }

  /* Main Content Area */
  .docs-content {
    flex: 1;
    padding: 3rem;
    background: #ffffff;
    min-width: 0; /* Prevent horizontal overflow */
  }

  .prose-wrapper {
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.6;
    color: #334155;
  }

  /* Typography & Elements */
  :global(.prose-wrapper h1) {
    font-size: 2.5rem;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 1.5rem;
    letter-spacing: -0.025em;
  }

  :global(.prose-wrapper h2) {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin-top: 2.5rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 0.5rem;
  }

  :global(.prose-wrapper h3) {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
  }

  :global(.prose-wrapper p) {
    margin-bottom: 1.25rem;
  }

  :global(.prose-wrapper ul, .prose-wrapper ol) {
    margin-bottom: 1.25rem;
    padding-left: 1.5rem;
  }

  :global(.prose-wrapper ul) {
    list-style-type: none;
    padding-left: 0.5rem;
  }

  :global(.prose-wrapper ul li) {
    position: relative;
    padding-left: 1.5rem;
  }

  :global(.prose-wrapper ul li::before) {
    content: '•';
    color: var(--c-brand, #cd1404);
    position: absolute;
    left: 0;
    font-weight: bold;
  }

  :global(.prose-wrapper img) {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    margin: 2rem 0;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  :global(.prose-wrapper a) {
    color: var(--c-brand, #cd1404);
    font-weight: 500;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  :global(.prose-wrapper code) {
    background-color: #f1f5f9;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 0.875rem;
  }

  :global(.prose-wrapper pre code) {
    background-color: transparent;
    padding: 0;
  }

  :global(.prose-wrapper blockquote) {
    border-left: 4px solid var(--c-brand, #cd1404);
    background-color: #fef2f2;
    margin: 2rem 0;
    padding: 1.5rem;
    border-radius: 0 8px 8px 0;
    font-style: italic;
    color: #475569;
  }

  :global(.prose-wrapper table) {
    width: 100%;
    border-collapse: collapse;
    margin: 2rem 0;
    font-size: 0.9375rem;
  }

  :global(.prose-wrapper th) {
    text-align: left;
    background: #f8fafc;
    padding: 0.75rem 1rem;
    border-bottom: 2px solid #e2e8f0;
    color: #475569;
    font-weight: 600;
  }

  :global(.prose-wrapper td) {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f5f9;
  }

  :global(.prose-wrapper tr:last-child td) {
    border-bottom: none;
  }

  :global(.prose-wrapper pre) {
    background-color: #0f172a;
    color: #f8fafc;
    padding: 1.5rem;
    border-radius: 12px;
    margin: 2rem 0;
    overflow-x: auto;
    font-family: ui-monospace, monospace;
    font-size: 0.875rem;
    line-height: 1.7;
  }

  /* Mobile docs bar */
  .mobile-docs-bar {
    display: none;
  }

  .sidebar-backdrop {
    display: none;
  }

  @media (max-width: 1024px) {
    /* Lift the whole docs stacking context above the in-flow header
       (z-index 100) and mobile bar (z-index 50) so the open drawer and its
       backdrop overlay them at every scroll position. The sidebar (z-index
       200) and backdrop (z-index 100) inside then layer correctly. */
    .docs-container {
      z-index: 300;
    }

    .mobile-docs-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      position: relative;
      z-index: 50;
    }

    .mobile-menu-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      color: #334155;
      cursor: pointer;
    }

    .mobile-docs-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #475569;
    }

    .sidebar-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(0, 0, 0, 0.3);
    }

    .docs-sidebar {
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      transform: translateX(-100%);
      z-index: 200;
      box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
      margin-top: 0; /* No negative margin on mobile */
      transition: transform 0.3s ease;
    }

    .docs-sidebar.open {
      transform: translateX(0);
    }

    .sidebar-content-wrapper {
      position: relative; /* Not sticky on mobile */
      top: 0;
      height: 100vh;
    }

    .sidebar-spacer {
      display: none;
    }

    .docs-content {
      padding: 2rem 1.5rem;
    }
  }
</style>

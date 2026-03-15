<script lang="ts">
  import { page } from '$app/state'

  let isGuide = $derived(page.url.pathname.startsWith('/docs'))
  let isApp = $derived(page.url.pathname === '/')
</script>

<header class="border-b">
  <div>
    <a id="go-home" href="/">
      <img
        id="logo"
        width="23"
        height="23"
        src="/logos/gazeplotter.svg"
        alt="Logo"
      />
      <span id="sitetitle">GazePlotter</span>
    </a>
    <nav>
      <a href="/" class="nav-item" class:active={isApp}>App</a>
      <a href="/docs" class="nav-item" class:active={isGuide}>Guide</a>
      <a
        href="https://github.com/misavojte/GazePlotter"
        target="_blank"
        class="gh-link"
        rel="nofollow"
        aria-label="GitHub"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="19"
          height="19"
          fill="currentColor"
          viewBox="0 0 16 16"
        >
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
      </a>
    </nav>
  </div>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    background-color: var(--c-white);
    color: var(--c-black);
    position: relative;
    z-index: 100;
  }

  .border-b {
    border-bottom: var(--c-border) 1px solid;
  }

  header > div {
    width: 100%;
    margin: auto;
    padding: 30px;
    padding-block: 0 !important;
    height: 60px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 14px;
    box-sizing: border-box;
  }

  #go-home {
    text-decoration: none;
    display: flex;
    align-items: center;
    color: inherit;
  }

  #go-home:hover,
  #go-home:focus {
    opacity: 0.8;
  }

  #logo {
    margin-right: 10px;
  }

  #sitetitle {
    font-weight: bold;
    font-size: 17px;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .nav-item {
    padding: 6px 14px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
    text-decoration: none;
    border-radius: 6px;
  }

  .nav-item:hover {
    color: #1e293b;
    background-color: #f1f5f9;
  }

  .nav-item.active {
    color: var(--c-brand, #cd1404);
    background-color: #fff1f2;
    font-weight: 600;
  }

  .gh-link {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    padding-left: 12px;
    border-left: 1px solid #e2e8f0;
    color: #1f2328;
    text-decoration: none;
  }

  .gh-link:hover {
    color: var(--c-brand, #cd1404);
  }

  @media only screen and (max-width: 1000px) {
    header > div {
      padding-inline: 24px;
    }
  }

  @media only screen and (max-width: 740px) {
    header > div {
      padding-inline: 22px;
    }
  }

  @media only screen and (max-width: 665px) {
    header > div {
      padding-inline: 20px;
    }
  }

  @media only screen and (max-width: 540px) {
    header > div {
      padding-inline: 18px;
    }
  }

  @media only screen and (max-width: 420px) {
    header > div {
      padding-inline: 15px;
    }
    nav {
      gap: 2px;
    }
    .nav-item {
      padding: 6px 10px;
      font-size: 0.8125rem;
    }
    .gh-link {
      margin-left: 4px;
      padding-left: 8px;
    }
  }

  @media only screen and (max-width: 380px) {
    header > div {
      padding-inline: 12px;
    }
  }
</style>

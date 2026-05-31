<script lang="ts">
  import { page } from '$app/stores'
  import { ButtonMajor } from '$lib/shared/components'
  import AppWindow from 'lucide-svelte/icons/app-window'
  import BookOpen from 'lucide-svelte/icons/book-open'
  import FileText from 'lucide-svelte/icons/file-text'
</script>

<svelte:head>
  <title>Error {$page.status} | GazePlotter</title>
</svelte:head>

<main>
  <section class="error-section">
    <h1 class="title-heading">Error {$page.status}</h1>
    <div class="actions">
      <ButtonMajor href="/" variant="primary" target="_self">
        <span class="btn-content">
          <AppWindow size="1em" strokeWidth={1.75} />
          <span>Go to the app</span>
        </span>
      </ButtonMajor>
      <ButtonMajor href="/docs" variant="secondary" target="_self">
        <span class="btn-content">
          <BookOpen size="1em" strokeWidth={1.75} />
          <span>Go to the docs</span>
        </span>
      </ButtonMajor>
      <ButtonMajor
        href="https://link.springer.com/article/10.3758/s13428-026-02959-5"
        variant="secondary"
      >
        <span class="btn-content">
          <FileText size="1em" strokeWidth={1.75} />
          <span>Read GazePlotter article</span>
        </span>
      </ButtonMajor>
    </div>
  </section>
</main>

<style>
  main {
    color: var(--c-black);
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-section {
    max-width: 1280px;
    box-sizing: border-box;
    padding: 32px;
    margin-inline: auto;
    text-align: center;
  }

  .title-heading {
    font-size: 3rem;
    margin: 0 0 40px;
    font-weight: bold;
    line-height: 1.15;
    color: var(--c-text);
  }

  .actions {
    display: grid;
    grid-template-columns: minmax(0, 18rem);
    gap: 12px;
    justify-content: center;
  }

  .actions :global(a) {
    width: 100%;
    box-sizing: border-box;
  }

  .btn-content {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
  }

  @media only screen and (max-width: 740px) {
    .title-heading {
      font-size: 2rem;
    }
    .error-section {
      padding-inline: 22px;
    }
  }
</style>

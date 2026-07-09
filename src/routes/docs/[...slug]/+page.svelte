<script lang="ts">
  import { page } from '$app/state'
  import { getPrevNextLinks } from '../navigation'
  let { data } = $props()
  const Doc = $derived(data.doc.component)

  let prevNext = $derived.by(() => {
    return getPrevNextLinks(page.url.pathname, page.data.allLinks ?? [])
  })

  // trailingSlash = 'always' in the root layout, so pathname is already the
  // canonical slashed form; this collapses slash/non-slash duplicates for
  // search engines.
  const canonicalUrl = $derived(`https://gazeplotter.com${page.url.pathname}`)
</script>

<Doc />

<svelte:head>
  <title>{data.doc.metadata.seoTitle}</title>
  <link rel="canonical" href={canonicalUrl} />
  <meta property="og:title" content={data.doc.metadata.seoTitle} />
  <meta property="og:type" content="article" />
  <meta property="og:url" content={canonicalUrl} />
  {#if data.doc.metadata.description}
    <meta name="description" content={data.doc.metadata.description} />
    <meta property="og:description" content={data.doc.metadata.description} />
  {/if}
</svelte:head>

{#if prevNext.prev || prevNext.next}
  <nav class="prev-next" aria-label="Page navigation">
    {#if prevNext.prev}
      <a href={prevNext.prev.href} class="prev-next-link prev">
        <span class="prev-next-label">← Previous</span>
        <span class="prev-next-title">{prevNext.prev.name}</span>
      </a>
    {/if}
    {#if prevNext.next}
      <a href={prevNext.next.href} class="prev-next-link next">
        <span class="prev-next-label">Next →</span>
        <span class="prev-next-title">{prevNext.next.name}</span>
      </a>
    {/if}
  </nav>
{/if}

<style>
  .prev-next {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 4rem;
    padding-top: 2rem;
    border-top: 1px solid var(--c-grey);
  }

  .prev-next-link {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 1.25rem;
    border: 1px solid var(--c-grey);
    border-radius: 10px;
    text-decoration: none;
    transition: all var(--transition-normal) ease;
    min-width: 0;
  }

  .prev-next-link.prev {
    grid-column: 1;
  }

  .prev-next-link.next {
    grid-column: 2;
    text-align: right;
  }

  .prev-next-link:hover {
    border-color: var(--c-brand);
    background-color: color-mix(in srgb, var(--c-brand) 4%, var(--c-white));
  }

  .prev-next-label {
    font-size: 0.8rem;
    color: var(--c-darkgrey);
    font-weight: 500;
  }

  .prev-next-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--c-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prev-next-link:hover .prev-next-title {
    color: var(--c-brand);
  }

  @media (max-width: 640px) {
    .prev-next {
      grid-template-columns: 1fr;
    }

    .prev-next-link.next {
      grid-column: 1;
    }
  }
</style>
